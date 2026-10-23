import type { RawListing, StoreConfig } from "../types.ts";
import { gameFromText } from "../games.ts";
import { getJSON } from "../http.ts";

/** Forma (parcial) de /search/suggest.json de Shopify */
export interface ShopifySuggest {
  resources?: {
    results?: {
      products?: {
        title: string;
        url: string;
        price: string;
        available: boolean;
        type?: string | null;
        tags?: string[];
        image?: string | null;
        featured_image?: { url?: string | null } | null;
      }[];
    };
  };
}

/**
 * La búsqueda predictiva de Shopify devuelve como máximo 10 productos.
 * Alcanza para una carta puntual; para catálogos enteros conviene indexar
 * /collections/<coleccion>/products.json de forma programada.
 */
export function shopifyPath(q: string) {
  const params = new URLSearchParams({
    q,
    "resources[type]": "product",
    "resources[limit]": "10",
    "resources[options][unavailable_products]": "last",
  });
  return `/search/suggest.json?${params.toString()}`;
}

export function mapShopify(base: string, data: ShopifySuggest): RawListing[] {
  const products = data.resources?.results?.products ?? [];
  return products
    .map((p) => ({
      ...shopifyMeta(p.type ?? "", p.tags ?? []),
      title: p.title,
      url: base + p.url.split("?")[0],
      price: Number(p.price),
      available: p.available,
      stock: null,
      image: p.featured_image?.url || p.image || undefined,
    }))
    .filter((l) => l.price > 0);
}

const TAG_LANG: Record<string, string> = { en: "Inglés", es: "Español", jp: "Japonés", ja: "Japonés", pt: "Portugués", it: "Italiano", fr: "Francés", de: "Alemán" };

/** El tipo de producto ("MTG Single", "Pokemon Single") y los tags dicen el juego, idioma, rareza y acabado */
export function shopifyMeta(type: string, tags: string[]) {
  const tag = (k: string) => tags.find((t) => t.toLowerCase().startsWith(k + ":"))?.split(":")[1] ?? null;
  const flat = tags.join(" ");
  const finishTag = tag("finish");
  return {
    gameHint: gameFromText(type) ?? gameFromText(tag("game") === "mtg" ? "magic" : tag("game")) ?? gameFromText(flat),
    isSingle: /single|suelta/i.test(type) ? true : type ? false : null,
    lang: TAG_LANG[(tag("language") ?? "").toLowerCase()] ?? null,
    rarity: tag("rarity") ?? null,
    finish: finishTag
      ? (/foil|etched/i.test(finishTag) ? (/etched/i.test(finishTag) ? "Etched" : "Foil") : "Normal")
      : /reverse holo/i.test(flat) ? "Reverse Holo" : /\bholofoil\b/i.test(flat) ? "Holo" : null,
  };
}

export async function searchShopify(store: StoreConfig, q: string): Promise<RawListing[]> {
  const data = await getJSON<ShopifySuggest>(store.base + shopifyPath(q));
  return mapShopify(store.base, data);
}
