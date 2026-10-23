import type { Platform, StoreConfig } from "./types.ts";
import { getText } from "./http.ts";
import { TTLCache } from "./cache.ts";
import { robotsAllows } from "./robots.ts";

export type Detected = Exclude<Platform, "auto"> | "empretienda" | "desconocida" | "sin-conexion";

const cache = new TTLCache<Detected>(24 * 60 * 60 * 1000);

/** Reconoce la plataforma por huellas típicas del HTML de la home */
export function detectFromHtml(html: string): Detected {
  if (/mitiendanube\.com|tiendanube\.com|nuvemshop/i.test(html)) return "tiendanube";
  if (/cdn\.shopify\.com|\/cdn\/shop\/|Shopify\.theme/i.test(html)) return "shopify";
  if (/woocommerce/i.test(html) && /wp-content/i.test(html)) return "woocommerce";
  if (/var prestashop|prestashop\s*=|content="PrestaShop"/i.test(html)) return "prestashop";
  if (/empretienda/i.test(html)) return "empretienda";
  if (/add-to-cart-btn[^>]+data-listing-id/i.test(html)) return "casco";
  return "desconocida";
}

export async function detectPlatform(store: StoreConfig): Promise<Detected> {
  if (store.platform !== "auto") return store.platform;
  const hit = cache.get(store.id);
  if (hit) return hit;
  let d: Detected = "desconocida";
  try {
    if (await robotsAllows(store.base, "/")) d = detectFromHtml(await getText(store.base + "/"));
  } catch {
    // sin conexión: no se cachea, se reintenta en la próxima búsqueda
    return "sin-conexion";
  }
  cache.set(store.id, d);
  return d;
}

/** live para lo que tiene buscador consultable, index para el resto */
export function modeFor(store: StoreConfig, platform: Detected): "live" | "index" | null {
  if (store.mode) return store.mode;
  if (platform === "woocommerce" || platform === "shopify" || platform === "casco") return "live";
  if (platform === "tiendanube" || platform === "prestashop") return "index";
  return null;
}
