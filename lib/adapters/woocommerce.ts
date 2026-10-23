import type { RawListing, StoreConfig } from "../types.ts";
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
}

export function wooPath(q: string, store?: StoreConfig) {
  return `${store?.wooApiPrefix ?? "/wp-json"}/wc/store/v1/products?search=${encodeURIComponent(q)}&per_page=50`;
}

export function mapWoo(products: WooProduct[]): RawListing[] {
  return products
    .map((p) => {
      const price = Number(p.prices?.price ?? 0) / 10 ** (p.prices?.currency_minor_unit ?? 2);
      const m = p.stock_availability?.text?.match(/(\d+)/);
      const stock = p.low_stock_remaining ?? (m ? Number(m[1]) : null);
      const regular = Number(p.prices?.regular_price ?? 0) / 10 ** (p.prices?.currency_minor_unit ?? 2);
      return {
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

export async function searchWoo(store: StoreConfig, q: string): Promise<RawListing[]> {
  const data = await getJSON<WooProduct[]>(store.base + wooPath(q, store));
  if (!Array.isArray(data)) throw new Error("La API no devolvió productos");
  return mapWoo(data);
}
