import type { Game, RawListing, StoreConfig } from "../types.ts";
import { getJSON, HttpError } from "../http.ts";
import { TTLCache } from "../cache.ts";

/**
 * Phoenix Reborn (phoenixreborn.com.ar): su web tiene Cloudflare y responde 403 a los servidores, pero
 * Phoenix Arena (phoenixarena.com.ar, la web de torneos de la misma tienda) muestra el precio y el stock
 * de cada carta de Digimon de las listas de torneo. Lo saca de su propia API pública:
 *   GET /WooCommerceProducts/search?cardIds=BT25-008,BT24-102
 * Solo busca por código exacto (SKU), así que un nombre se pasa antes a códigos con digimoncard.io.
 * Por ahora solo trae Digimon (los códigos de otros juegos no devuelven nada).
 */
export const PHOENIX_API = "https://phoenix-tournaments-api20250716010122.azurewebsites.net";
export const phoenixPath = (codes: string[]) => `/WooCommerceProducts/search?cardIds=${codes.map(encodeURIComponent).join(",")}`;

const CODE = /\b((?:BT|EX|ST|AD|RB|BO|LM)\d{1,2}-\d{2,3}|P-\d{3})\b/gi;
/** Máximo de códigos por nombre (un nombre común como "Agumon" tiene decenas de impresiones) y por pedido */
const MAX_CODES = 60;
const CHUNK = 20;

const RARITY: Record<string, string> = { common: "C", uncommon: "U", rare: "R", "super rare": "SR", "secret rare": "SEC", promo: "P", c: "C", u: "U", r: "R", sr: "SR", sec: "SEC", p: "P" };

export interface PhoenixProduct {
  id: number; name: string; sku?: string | null; permalink: string;
  regular_price?: number | null; price?: number | null; stock_Quantity?: number | null;
  images?: { src?: string }[];
}

/** "Coronamon (BT25-008) - Uncommon" / "BanchoLeomon - BT20-036 - Uncommon" / "Omnimon  - BT1-084 SR" */
export function phoenixName(p: PhoenixProduct): { name: string; rarity?: string } {
  const sku = (p.sku ?? "").trim();
  const t = p.name.replace(/\s+/g, " ").trim();
  const i = sku ? t.toUpperCase().indexOf(sku.toUpperCase()) : -1;
  const before = (i >= 0 ? t.slice(0, i) : t).replace(/[\s(\-–]+$/, "").trim();
  const after = (i >= 0 ? t.slice(i + sku.length) : "").replace(/^[\s)\-–]+/, "").trim();
  const rarity = RARITY[after.toLowerCase()] ?? (after ? after : undefined);
  return { name: before || t, rarity };
}

export function parsePhoenix(products: PhoenixProduct[]): RawListing[] {
  const out: RawListing[] = [];
  for (const p of products) {
    const price = Math.round(Number(p.price ?? p.regular_price));
    if (!p.name || !p.permalink || !(price > 0)) continue;
    const regular = Math.round(Number(p.regular_price));
    const { name, rarity } = phoenixName(p);
    const stock = typeof p.stock_Quantity === "number" ? p.stock_Quantity : null;
    out.push({
      title: [name, p.sku, rarity].filter(Boolean).join(" - "),
      url: p.permalink,
      price,
      comparePrice: regular > price ? regular : null,
      available: stock == null ? null : stock > 0,
      stock,
      image: p.images?.[0]?.src,
      gameHint: "digi",
      isSingle: true,
      name,
      rarity,
    });
  }
  return out;
}

/** Códigos escritos en la búsqueda (ej. "BT20-036") */
export const codesIn = (q: string) => [...new Set([...q.matchAll(CODE)].map((m) => m[1].toUpperCase()))];

const nameCodes = new TTLCache<string[]>(24 * 60 * 60 * 1000);
/** Nombre → códigos de todas sus impresiones (digimoncard.io, la misma base que usa la ficha de la carta) */
async function digiCodes(q: string): Promise<string[]> {
  const k = q.trim().toLowerCase();
  const hit = nameCodes.get(k);
  if (hit) return hit;
  let ids: string[] = [];
  try {
    const d = await getJSON<{ id: string }[] | { error: string }>(`https://digimoncard.io/api-public/search.php?n=${encodeURIComponent(q.trim())}`, 8000);
    if (Array.isArray(d)) ids = [...new Set(d.map((c) => c.id?.toUpperCase()).filter((x): x is string => !!x))];
  } catch (e) {
    if (!(e instanceof HttpError)) throw e; // 400 = ninguna carta con ese nombre
  }
  ids = ids.slice(0, MAX_CODES);
  nameCodes.set(k, ids);
  return ids;
}

export async function searchPhoenix(_store: StoreConfig, q: string, game: Game): Promise<RawListing[]> {
  if (game !== "digi") return [];
  const codes = codesIn(q).length ? codesIn(q) : q.trim().length >= 3 ? await digiCodes(q) : [];
  const out: RawListing[] = [];
  // De a 20 códigos por pedido, uno detrás del otro para no cargar su servidor
  for (let i = 0; i < codes.length; i += CHUNK) {
    const products = await getJSON<PhoenixProduct[]>(PHOENIX_API + phoenixPath(codes.slice(i, i + CHUNK)), 12000);
    if (Array.isArray(products)) out.push(...parsePhoenix(products));
  }
  return out;
}
