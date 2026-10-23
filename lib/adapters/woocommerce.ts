import type { Game, RawListing, StoreConfig } from "../types.ts";
import { gameFromText } from "../games.ts";
import { getJSON } from "../http.ts";
import { decodeEntities } from "../parse.ts";

/** Forma (parcial) de la respuesta de la Store API pública de WooCommerce */
export interface WooProduct {
  name: string;
  permalink: string;
  prices: { price: string; regular_price?: string; sale_price?: string; currency_minor_unit: number };
  is_in_stock: boolean;
  low_stock_remaining?: number | null;
  stock_availability?: { text?: string; class?: string };
  images?: { thumbnail?: string; src?: string }[];
  categories?: { slug: string; name?: string }[];
  attributes?: { name: string; terms?: { name?: string; slug: string }[] }[];
}

const LANG: Record<string, string> = { ingles: "Inglés", english: "Inglés", espanol: "Español", spanish: "Español", japones: "Japonés", japanese: "Japonés" };
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Atributos que algunas tiendas cargan aparte (Juego, Idioma, Rareza, Foil, Condición, Set) */
function wooAttrs(p: WooProduct) {
  const get = (re: RegExp) => p.attributes?.find((a) => re.test(fold(a.name)))?.terms?.map((t) => t.name ?? t.slug) ?? [];
  const lang = get(/idioma|language/)[0];
  const finish = get(/foil|acabado|finish/)[0];
  const cond = get(/condicion|estado|condition/)[0];
  return {
    game: gameFromText(get(/juego|game/).join(" ")),
    lang: lang ? LANG[fold(lang).replace(/[^a-z]/g, "")] ?? lang : null,
    rarity: get(/rareza|rarity/)[0] ?? null,
    finish: finish ? (/foil|holo/i.test(finish) && !/non/i.test(finish) ? "Foil" : "Normal") : null,
    condition: cond ? (/nueva|nm|near|mint/i.test(cond) ? "NM" : cond.toUpperCase()) : null,
    setName: get(/set|coleccion|expansion/)[0] ?? undefined,
  };
}

export function wooPath(q: string, store?: StoreConfig, game?: Game) {
  const cat = game ? store?.wooCategory?.[game] : undefined;
  return `${store?.wooApiPrefix ?? "/wp-json"}/wc/store/v1/products?search=${encodeURIComponent(q)}&per_page=50${cat ? `&category=${encodeURIComponent(cat)}` : ""}`;
}

/** forcedGame: la búsqueda ya se filtró por la categoría de ese juego */
export function mapWoo(products: WooProduct[], forcedGame: Game | null = null): RawListing[] {
  return products
    .map((p) => {
      const price = Number(p.prices?.price ?? 0) / 10 ** (p.prices?.currency_minor_unit ?? 2);
      const m = p.stock_availability?.text?.match(/(\d+)/);
      const stock = p.low_stock_remaining ?? (m ? Number(m[1]) : null);
      const regular = Number(p.prices?.regular_price ?? 0) / 10 ** (p.prices?.currency_minor_unit ?? 2);
      const attrs = wooAttrs(p);
      const cats = (p.categories ?? []).map((c) => `${c.slug} ${c.name ?? ""}`).join(" ");
      const single = /single|suelta/i.test(cats) ? true : null;
      return {
        gameHint: forcedGame ?? attrs.game ?? gameFromText(cats),
        isSingle: single,
        lang: attrs.lang,
        rarity: attrs.rarity,
        finish: attrs.finish,
        condition: attrs.condition,
        setName: attrs.setName,
        title: decodeEntities(p.name),
        comparePrice: regular > price ? regular : null,
        url: p.permalink,
        price,
        available: p.is_in_stock,
        stock: p.is_in_stock ? stock : 0,
        image: p.images?.[0]?.thumbnail || p.images?.[0]?.src,
      };
    })
    .filter((l) => l.price > 0); // precio 0 = la tienda no le cargó precio
}

export async function searchWoo(store: StoreConfig, q: string, game?: Game): Promise<RawListing[]> {
  const data = await getJSON<WooProduct[]>(store.base + wooPath(q, store, game));
  if (!Array.isArray(data)) throw new Error("La API no devolvió productos");
  return mapWoo(data, game && store.wooCategory?.[game] ? game : null);
}
