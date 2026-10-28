import type { Game, RawListing, StoreConfig } from "../types.ts";
import { getJSON } from "../http.ts";
import { TTLCache } from "../cache.ts";

/**
 * La Workshop TCG (laworkshoptcg.com): web propia de Magic. Su buscador público es
 * la-workshop-tcg.onrender.com/api/search/products?name=... (el mismo que usa la página).
 * Los precios están en dólares: se pasan a pesos con la cotización que publica la misma tienda
 * (/api/settings/usd-rate), que es la que usa para cobrar.
 */
const API = "https://la-workshop-tcg.onrender.com";
export const workshopPath = (q: string) => `/api/search/products?${new URLSearchParams({ name: q.trim(), page: "1", per_page: "48" })}`;

const LANG: Record<string, string> = { English: "Inglés", Spanish: "Español", Japanese: "Japonés", Portuguese: "Portugués", Italian: "Italiano", German: "Alemán", French: "Francés" };
const COND: Record<string, string> = { "Near Mint": "NM", "Lightly Played": "LP", "Moderately Played": "MP", "Heavily Played": "HP", Damaged: "DMG" };

interface WsListing { id: number; current_price?: string | number; stock_quantity?: number | null; condition_name?: string | null; foil_type_name?: string | null; language_name?: string | null }
interface WsProduct {
  name: string; edition_code?: string; edition_name?: string; collector_number?: string; rarity_name?: string;
  image_uris?: { normal?: string }; listings?: WsListing[];
}

export function parseWorkshop(base: string, products: WsProduct[], usdRate: number): RawListing[] {
  const out: RawListing[] = [];
  for (const p of products) {
    for (const l of p.listings ?? []) {
      const usd = Number(l.current_price);
      if (!(usd > 0) || !(usdRate > 0)) continue;
      const foil = l.foil_type_name && !/non/i.test(l.foil_type_name) ? l.foil_type_name : null;
      const cond = l.condition_name ? COND[l.condition_name] ?? null : null;
      out.push({
        title: `${p.name} (${p.edition_code ?? ""}) #${p.collector_number ?? ""}${foil ? ` ${foil}` : ""}${cond ? ` ${cond}` : ""}`.replace(/\(\) #/, "#").trim(),
        url: `${base}/card/${l.id}`,
        price: Math.round(usd * usdRate),
        available: typeof l.stock_quantity === "number" ? l.stock_quantity > 0 : null,
        stock: typeof l.stock_quantity === "number" ? l.stock_quantity : null,
        image: p.image_uris?.normal,
        gameHint: "mtg",
        isSingle: true,
        name: p.name,
        rarity: p.rarity_name,
        setName: p.edition_code?.toUpperCase(),
        finish: foil,
        condition: cond,
        lang: l.language_name ? LANG[l.language_name] ?? l.language_name : null,
      });
    }
  }
  return out;
}

const rateCache = new TTLCache<number>(60 * 60 * 1000);
async function usdRate(): Promise<number> {
  const hit = rateCache.get("r");
  if (hit) return hit;
  const d = await getJSON<{ rate?: number }>(API + "/api/settings/usd-rate", 15000);
  if (!(Number(d.rate) > 0)) throw new Error("La tienda no informó su cotización del dólar");
  rateCache.set("r", Number(d.rate));
  return Number(d.rate);
}

export async function searchWorkshop(store: StoreConfig, q: string, game: Game): Promise<RawListing[]> {
  if (game !== "mtg") return [];
  // su servidor puede tardar en "despertar" si nadie lo usó hace un rato
  const [rate, d] = await Promise.all([usdRate(), getJSON<{ products?: WsProduct[] }>(API + workshopPath(q), 15000)]);
  return parseWorkshop(store.base, d.products ?? [], rate);
}
