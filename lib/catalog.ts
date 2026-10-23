import { promises as fs } from "node:fs";
import path from "node:path";
import type { CatalogItem, Game } from "./types.ts";
import { norm } from "./parse.ts";
import { supabase, type SupaCall } from "./supa.ts";

/**
 * Catálogo de las tiendas indexadas (Tiendanube, PrestaShop y las WooCommerce que bloquean su API).
 *
 * - Con SUPABASE_URL y SUPABASE_SERVICE_KEY: se guarda en Supabase (ver supabase/schema.sql).
 * - Sin esas variables: se guarda en .data/catalogo.json (sirve para probar en tu compu).
 */

export interface StoreIndexStatus {
  storeId: string;
  game: Game;
  indexedAt: string;
  count: number;
  error: string | null;
}

export interface CatalogBackend {
  replaceStore(storeId: string, game: Game, items: CatalogItem[], status: StoreIndexStatus): Promise<void>;
  search(game: Game, words: string[], storeIds: string[]): Promise<CatalogItem[]>;
  statuses(game: Game): Promise<StoreIndexStatus[]>;
}

// ---------- Archivo local ----------
const FILE = path.join(process.cwd(), ".data", "catalogo.json");
type FileData = { items: CatalogItem[]; status: StoreIndexStatus[] };

async function readFile(): Promise<FileData> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as FileData;
  } catch {
    return { items: [], status: [] };
  }
}

const fileBackend: CatalogBackend = {
  async replaceStore(storeId, game, items, status) {
    const data = await readFile();
    // Si el indexado falló, se conserva el catálogo anterior y solo se anota el error
    if (!status.error) data.items = data.items.filter((i) => !(i.storeId === storeId && i.game === game)).concat(items);
    data.status = data.status.filter((s) => !(s.storeId === storeId && s.game === game)).concat(status);
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(data));
  },
  async search(game, words, storeIds) {
    const data = await readFile();
    return data.items.filter(
      (i) => i.game === game && storeIds.includes(i.storeId) && words.every((w) => norm(i.title).includes(w))
    );
  },
  async statuses(game) {
    return (await readFile()).status.filter((s) => s.game === game);
  },
};

// ---------- Supabase ----------
type Row = {
  store_id: string; game: Game; title: string; title_norm: string; url: string; price: number;
  compare_price: number | null; available: boolean | null; stock: number | null; image: string | null; indexed_at: string;
};

const toRow = (i: CatalogItem): Row => ({
  store_id: i.storeId, game: i.game, title: i.title, title_norm: norm(i.title), url: i.url, price: i.price,
  compare_price: i.comparePrice ?? null, available: i.available, stock: i.stock, image: i.image ?? null, indexed_at: i.indexedAt,
});
const fromRow = (r: Row): CatalogItem => ({
  storeId: r.store_id, game: r.game, title: r.title, url: r.url, price: Number(r.price),
  comparePrice: r.compare_price, available: r.available, stock: r.stock, image: r.image ?? undefined, indexedAt: r.indexed_at,
});

function supabaseBackend(call: SupaCall): CatalogBackend {
  return {
    async replaceStore(storeId, game, items, status) {
      if (!status.error) {
        await call(`catalogo?store_id=eq.${storeId}&game=eq.${game}`, { method: "DELETE" });
        for (let i = 0; i < items.length; i += 500) {
          await call("catalogo", { method: "POST", body: JSON.stringify(items.slice(i, i + 500).map(toRow)) });
        }
      }
      await call("indice_tiendas", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ store_id: storeId, game, indexed_at: status.indexedAt, count: status.count, error: status.error }),
      });
    },
    async search(game, words, storeIds) {
      if (!storeIds.length || !words.length) return [];
      const and = words.map((w) => `title_norm.ilike.*${w.replace(/[(),*]/g, "")}*`).join(",");
      const p = `catalogo?select=*&game=eq.${game}&store_id=in.(${storeIds.join(",")})&and=(${encodeURIComponent(and)})&limit=300`;
      return ((await (await call(p)).json()) as Row[]).map(fromRow);
    },
    async statuses(game) {
      const rows = (await (await call(`indice_tiendas?select=*&game=eq.${game}`)).json()) as {
        store_id: string; game: Game; indexed_at: string; count: number; error: string | null;
      }[];
      return rows.map((r) => ({ storeId: r.store_id, game: r.game, indexedAt: r.indexed_at, count: r.count, error: r.error }));
    },
  };
}

export function catalog(): CatalogBackend {
  const call = supabase();
  return call ? supabaseBackend(call) : fileBackend;
}

export const catalogMode = () => (supabase() ? "supabase" : "archivo local");
