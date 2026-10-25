import type { Game, SearchResponse } from "./types.ts";
import type { Dolar } from "./dolar.ts";
import { refUsd } from "./refprice.ts";
import { supabase } from "./supa.ts";

/**
 * "Mercado": ofertas (publicaciones por debajo del precio de referencia de TCGplayer) y subas/bajas
 * de la semana. Todo sale de búsquedas reales que la app ya hizo: no se consultan tiendas de más.
 */

/** Descuento mínimo contra la referencia para llamarlo oferta, y referencia mínima (evita cartas de centavos) */
export const OFFER_MIN_DISCOUNT = 20;
export const OFFER_MIN_REF_ARS = 2000;

export interface OfferRow {
  game: Game; card_key: string; store_id: string; card_name: string; code: string | null; rarity: string | null; version: string | null;
  store_name: string; url: string; precio: number; ref_usd: number; dolar: number; descuento: number; imagen: string | null; visto: string;
}

/** Filas de ofertas de una búsqueda: la publicación más barata con stock de cada versión, si está bien por debajo de la referencia */
export function offerRows(res: SearchResponse, dolar: Dolar | null, now = new Date()): OfferRow[] {
  if (!dolar) return [];
  const out: OfferRow[] = [];
  for (const g of res.cards) {
    const ref = refUsd(res.game, g);
    if (!ref) continue;
    const refArs = ref * dolar.venta;
    if (refArs < OFFER_MIN_REF_ARS) continue;
    const best = g.listings.filter((l) => l.available === true && l.price > 0).sort((a, b) => a.price - b.price)[0];
    if (!best) continue;
    const descuento = Math.round((1 - best.price / refArs) * 1000) / 10;
    if (descuento < OFFER_MIN_DISCOUNT) continue;
    out.push({
      game: res.game, card_key: g.key, store_id: best.storeId, card_name: g.name, code: g.code, rarity: g.rarity, version: g.version,
      store_name: best.storeName, url: best.url, precio: best.price, ref_usd: ref, dolar: dolar.venta, descuento,
      imagen: best.image ?? g.info?.image ?? null, visto: now.toISOString(),
    });
  }
  return out.slice(0, 50);
}

export async function saveOffers(rows: OfferRow[]) {
  const call = supabase();
  if (!call || !rows.length) return;
  await call("ofertas", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(rows), timeoutMs: 2500 });
}

export interface Mover { card_key: string; card_name: string; antes: number; ahora: number; cambio: number; tiendas: number }

/** De las filas de la función movimientos(): las que más subieron y bajaron (cambios de 5 % o más) */
export function pickMovers(rows: { card_key: string; card_name: string; antes: number | string; ahora: number | string; tiendas: number | string }[], limit = 8) {
  const all: Mover[] = rows
    .map((r) => ({ card_key: r.card_key, card_name: r.card_name, antes: Number(r.antes), ahora: Number(r.ahora), tiendas: Number(r.tiendas), cambio: 0 }))
    .filter((r) => r.antes > 0 && r.ahora > 0)
    .map((r) => ({ ...r, cambio: Math.round(((r.ahora - r.antes) / r.antes) * 1000) / 10 }))
    .filter((r) => Math.abs(r.cambio) >= 5);
  return {
    suben: all.filter((r) => r.cambio > 0).sort((a, b) => b.cambio - a.cambio).slice(0, limit),
    bajan: all.filter((r) => r.cambio < 0).sort((a, b) => a.cambio - b.cambio).slice(0, limit),
  };
}

export async function marketData(game: Game, days = 3) {
  const call = supabase();
  if (!call) return null;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [o, m] = await Promise.allSettled([
    call(`ofertas?select=*&game=eq.${game}&visto=gte.${encodeURIComponent(since)}&order=descuento.desc&limit=40`, { timeoutMs: 5000 }).then((r) => r.json() as Promise<OfferRow[]>),
    call("rpc/movimientos", { method: "POST", body: JSON.stringify({ p_game: game, p_dias: 7 }), timeoutMs: 6000 }).then((r) => r.json()),
  ]);
  return {
    ofertas: o.status === "fulfilled" && Array.isArray(o.value) ? o.value : [],
    ...(m.status === "fulfilled" && Array.isArray(m.value) ? pickMovers(m.value) : { suben: [], bajan: [] }),
    error: o.status === "rejected" || m.status === "rejected" ? "Falta correr la migración 003 en Supabase" : null,
  };
}
