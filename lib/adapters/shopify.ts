import type { RawListing, StoreConfig } from "../types.ts";
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
      title: p.title,
      url: base + p.url.split("?")[0],
      price: Number(p.price),
      available: p.available,
      stock: null,
      image: p.featured_image?.url || p.image || undefined,
    }))
    .filter((l) => l.price > 0);
}

export async function searchShopify(store: StoreConfig, q: string): Promise<RawListing[]> {
  const data = await getJSON<ShopifySuggest>(store.base + shopifyPath(q));
  return mapShopify(store.base, data);
}
