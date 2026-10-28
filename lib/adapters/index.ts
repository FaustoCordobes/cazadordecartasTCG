import type { Game, RawListing, StoreConfig } from "../types.ts";
import { searchWoo, wooPath } from "./woocommerce.ts";
import { searchShopify, shopifyPath } from "./shopify.ts";
import { searchCasco, cascoPath } from "./casco.ts";
import { searchEmpretienda, empretiendaPath } from "./empretienda.ts";
import { searchGarden, gardenPath } from "./garden.ts";
import { searchWorkshop, workshopPath } from "./workshop.ts";

type LiveAdapter = {
  search: (s: StoreConfig, q: string, game: Game) => Promise<RawListing[]>;
  /** ruta que se consulta, para revisar robots.txt antes */
  path: (q: string, s: StoreConfig, game: Game) => string;
};

/** Plataformas que se consultan en vivo en cada búsqueda */
export const LIVE_ADAPTERS: Partial<Record<string, LiveAdapter>> = {
  woocommerce: { search: (s, q, g) => searchWoo(s, q, g), path: (q, s, g) => wooPath(q, s, g) },
  shopify: { search: (s, q) => searchShopify(s, q), path: (q) => shopifyPath(q) },
  casco: { search: searchCasco, path: cascoPath },
  empretienda: { search: (s, q) => searchEmpretienda(s, q), path: (q) => empretiendaPath(q) },
  garden: { search: searchGarden, path: (q) => gardenPath(q) },
  workshop: { search: searchWorkshop, path: (q) => workshopPath(q) },
};
