import type { Game, RawListing, StoreConfig } from "../types.ts";
import { searchWoo, wooPath } from "./woocommerce.ts";
import { searchShopify, shopifyPath } from "./shopify.ts";
import { searchCasco, cascoPath } from "./casco.ts";

type LiveAdapter = {
  search: (s: StoreConfig, q: string, game: Game) => Promise<RawListing[]>;
  /** ruta que se consulta, para revisar robots.txt antes */
  path: (q: string, s: StoreConfig, game: Game) => string;
};

/** Plataformas que se consultan en vivo en cada búsqueda */
export const LIVE_ADAPTERS: Partial<Record<string, LiveAdapter>> = {
  woocommerce: { search: (s, q) => searchWoo(s, q), path: (q, s) => wooPath(q, s) },
  shopify: { search: (s, q) => searchShopify(s, q), path: (q) => shopifyPath(q) },
  casco: { search: searchCasco, path: cascoPath },
};
