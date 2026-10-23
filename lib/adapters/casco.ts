import { parse } from "node-html-parser";
import type { Game, RawListing, StoreConfig } from "../types.ts";
import { getText, parseARS } from "../http.ts";
import { decodeEntities } from "../parse.ts";

/**
 * Casco TCG (Rosario) tiene una web propia. Cada carta trae sus datos en el botón
 * "Agregar": nombre, rareza, expansión, precio y stock.
 * Búsqueda: /search?game_id=4&name=dark+magician (4 = Yu-Gi-Oh!, 8 = Digimon).
 */
export function cascoPath(q: string, store: StoreConfig, game: Game) {
  const id = store.gameIds?.[game] ?? "";
  return `/search?game_id=${id}&name=${encodeURIComponent(q).replace(/%20/g, "+")}`;
}

export function parseCasco(base: string, html: string): RawListing[] {
  const root = parse(html);
  const out: RawListing[] = [];
  for (const b of root.querySelectorAll("button.add-to-cart-btn")) {
    const id = b.getAttribute("data-id");
    const name = decodeEntities(b.getAttribute("data-name") ?? "").trim();
    const rarity = decodeEntities(b.getAttribute("data-rarity") ?? b.getAttribute("data-version") ?? "").trim();
    const setName = decodeEntities(b.getAttribute("data-expansion") ?? "").trim();
    const price = parseARS(b.getAttribute("data-price"));
    const stock = Number(b.getAttribute("data-stock") ?? "");
    if (!id || !name || !price) continue;
    out.push({
      title: [name, rarity, setName].filter(Boolean).join(" · "),
      url: `${base}/Productpage/${id}`,
      price,
      available: Number.isFinite(stock) ? stock > 0 : null,
      stock: Number.isFinite(stock) ? stock : null,
      image: b.getAttribute("data-image") ?? undefined,
      name,
      rarity: rarity || undefined,
      setName: setName || undefined,
    });
  }
  return out;
}

export async function searchCasco(store: StoreConfig, q: string, game: Game): Promise<RawListing[]> {
  const html = await getText(store.base + cascoPath(q, store, game), 15000);
  return parseCasco(store.base, html);
}
