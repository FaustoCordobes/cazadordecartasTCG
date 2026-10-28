import { parse } from "node-html-parser";
import type { Game, RawListing, StoreConfig } from "../types.ts";
import { getText, parseARS } from "../http.ts";
import { decodeEntities } from "../parse.ts";

/**
 * Empretienda (tiendas argentinas como TiendaYGO, ygo.com.ar).
 * Búsqueda pública: /search?q=... → página con hasta 24 productos (nombre, link, precio, "SIN STOCK").
 * El juego, si es carta suelta o producto sellado, y el idioma salen de la categoría en el link:
 *   /yu-gi-oh/cartas/ocg-japones/...  /pokemon/productos-sellados/...  /one-piece/cartas/japones/...
 */
export const empretiendaPath = (q: string) => `/search?q=${encodeURIComponent(q.trim()).replace(/%20/g, "+")}`;

const GAME_PATH: [RegExp, Game][] = [
  [/\/yu-?gi-?oh/i, "ygo"], [/\/pokemon/i, "pkm"], [/\/one-?piece/i, "op"], [/\/magic|\/mtg/i, "mtg"], [/\/digimon/i, "digi"],
];

export function parseEmpretienda(base: string, html: string): RawListing[] {
  const root = parse(html);
  const out: RawListing[] = [];
  for (const card of root.querySelectorAll(".products-feed__product")) {
    const a = card.querySelector(".products-feed__product-name a");
    const url = a?.getAttribute("href")?.trim();
    const title = decodeEntities(a?.text ?? "").replace(/\s+/g, " ").trim();
    if (!url || !title) continue;
    const priceEl = card.querySelector(".products-feed__product-price");
    const del = priceEl?.querySelector("del");
    const compare = del ? parseARS(del.text) : null;
    // el precio actual es lo que queda después del tachado
    const price = parseARS((priceEl?.text ?? "").replace(del?.text ?? "", ""));
    if (!price) continue;
    const path = new URL(url, base).pathname;
    const game = GAME_PATH.find(([re]) => re.test(path))?.[1] ?? null;
    const single = /\/(cartas|singles)(\/|$)/i.test(path) ? true : /sellad|accesorios|lotes|folios|carpetas|juegos-de-mesa|torneos/i.test(path) ? false : null;
    const lang = /japones/i.test(path) ? "Japonés" : /chino/i.test(path) ? "Chino" : /coreano/i.test(path) ? "Coreano" : null;
    const out_ = /SIN STOCK/i.test(card.querySelector(".products-feed__product-out-stock")?.text ?? "");
    out.push({
      title,
      url: url.startsWith("http") ? url : base + url,
      price,
      comparePrice: compare && compare > price ? compare : null,
      available: !out_,
      stock: null,
      image: card.querySelector("img.products-feed__product-image")?.getAttribute("src") ?? undefined,
      gameHint: game,
      isSingle: single,
      lang,
      // cartas gradeadas (PSA, etc.) no son comparables con una carta común
      ...(/gradead/i.test(path) ? { isSingle: false } : {}),
    });
  }
  return out;
}

export async function searchEmpretienda(store: StoreConfig, q: string): Promise<RawListing[]> {
  const html = await getText(store.base + empretiendaPath(q), 15000);
  return parseEmpretienda(store.base, html);
}
