import type { Game, RawListing, StoreConfig } from "../types.ts";
import { getJSON } from "../http.ts";

/**
 * GardenTCG (gardentcg.com.ar): web propia de Yu-Gi-Oh!. Su catálogo público se lee de
 * api.gardentcg.com.ar/api/cards/catalogue?name=... (lo mismo que usa su página de singles).
 * El precio final aplica el descuento de la expansión, si tiene.
 */
const API = "https://api.gardentcg.com.ar";
export const gardenPath = (q: string) => `/api/cards/catalogue?${new URLSearchParams({ name: q.trim(), _sort: "updatedAt", _order: "DESC", page: "1", rows: "48" })}`;

interface GardenCard {
  id: number; name: string; art?: string | null; code?: string | null; stock?: number | null; price?: string | number;
  state?: string; preorder?: boolean;
  CardName?: { slug?: string; Images?: { webpPath?: string; originalPath?: string }[] };
  Set?: { name?: string; discount?: number | null } | null;
  Rarity?: { name?: string } | null;
}

export function parseGarden(base: string, cards: GardenCard[]): RawListing[] {
  const out: RawListing[] = [];
  for (const c of cards) {
    if (c.state && c.state !== "active") continue;
    const list = Number(c.price);
    if (!c.name || !(list > 0)) continue;
    const disc = Number(c.Set?.discount ?? 0);
    const price = Math.round(disc > 0 ? list * (1 - disc / 100) : list);
    const img = c.CardName?.Images?.[0];
    const rarity = c.Rarity?.name ?? undefined;
    out.push({
      title: [c.name, c.code, rarity, c.art && !/^ash$/i.test(c.art) ? c.art : null, c.preorder ? "Preventa" : null].filter(Boolean).join(" - "),
      // cada versión es una publicación distinta aunque compartan la página de la carta
      url: `${base}/singles/${c.CardName?.slug ?? "unknown"}#v${c.id}`,
      price,
      comparePrice: disc > 0 ? Math.round(list) : null,
      available: typeof c.stock === "number" ? c.stock > 0 : null,
      stock: typeof c.stock === "number" ? c.stock : null,
      image: img ? API + (img.webpPath ?? img.originalPath) : undefined,
      gameHint: "ygo",
      isSingle: !/token/i.test(rarity ?? "") && !/token/i.test(c.code ?? ""),
      name: c.name,
      rarity,
      setName: c.Set?.name ?? undefined,
    });
  }
  return out;
}

export async function searchGarden(store: StoreConfig, q: string, game: Game): Promise<RawListing[]> {
  if (game !== "ygo") return [];
  const d = await getJSON<{ success?: boolean; data?: { cards?: GardenCard[] } }>(API + gardenPath(q), 15000);
  return parseGarden(store.base, d.data?.cards ?? []);
}
