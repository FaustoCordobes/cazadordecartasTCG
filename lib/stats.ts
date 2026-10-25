import type { Game, SearchResponse } from "./types.ts";
import { supabase } from "./supa.ts";
import { norm } from "./parse.ts";
import { getDolar } from "./dolar.ts";
import { offerRows, saveOffers } from "./market.ts";

/**
 * Historial de precios y analítica sin cookies, guardados en Supabase.
 * Todo es "de mejor esfuerzo": si Supabase no está configurado o tarda, la búsqueda sigue igual.
 * No se guarda ningún dato de la persona (ni IP, ni navegador, ni identificadores).
 */

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }); // YYYY-MM-DD

/** Filas de historial: el precio más bajo con stock de cada versión en cada tienda, hoy */
export function historyRows(res: SearchResponse, day = today()) {
  const rows = new Map<string, { dia: string; game: Game; card_key: string; card_name: string; store_id: string; precio: number; stock: number | null }>();
  for (const c of res.cards) {
    for (const l of c.listings) {
      if (l.available === false || !(l.price > 0)) continue;
      const k = `${c.key}|${l.storeId}`;
      const prev = rows.get(k);
      if (!prev || l.price < prev.precio) {
        rows.set(k, { dia: day, game: res.game, card_key: c.key, card_name: c.name, store_id: l.storeId, precio: l.price, stock: l.stock });
      }
    }
  }
  return [...rows.values()].slice(0, 200);
}

/** Qué se guarda como "consulta": el nombre reconocido si lo hay, o lo escrito, normalizado y recortado */
export function searchLabel(res: SearchResponse) {
  const top = res.cards[0]?.info?.name ?? res.cards[0]?.name;
  const exact = top && norm(top).includes(norm(res.query).trim()) ? top : null;
  return (exact ?? norm(res.query).replace(/[^a-z0-9 .'!&/-]+/g, " ").replace(/\s+/g, " ").trim()).slice(0, 80);
}

export async function recordSearch(res: SearchResponse) {
  const call = supabase();
  if (!call) return;
  const rows = historyRows(res);
  await Promise.allSettled([
    rows.length
      ? call("historial_precios", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(rows), timeoutMs: 2500 })
      : Promise.resolve(),
    call("rpc/sumar_busqueda", {
      method: "POST",
      body: JSON.stringify({ p_game: res.game, p_consulta: searchLabel(res), p_sin: res.cards.length === 0 }),
      timeoutMs: 2500,
    }),
    // Ofertas: lo que esta búsqueda encontró bien por debajo de la referencia de TCGplayer
    getDolar().then((d) => saveOffers(offerRows(res, d))),
  ]);
}

export async function recordClick(game: Game, storeId: string) {
  const call = supabase();
  if (!call) return false;
  await call("rpc/sumar_click", { method: "POST", body: JSON.stringify({ p_game: game, p_store: storeId }), timeoutMs: 2500 });
  return true;
}

export interface HistoryPoint { dia: string; min: number; tiendas: number }

/** Precio mínimo por día de una versión de carta (todas las tiendas) */
export async function priceHistory(game: Game, cardKey: string, days = 90): Promise<HistoryPoint[] | null> {
  const call = supabase();
  if (!call) return null;
  const since = new Date(Date.now() - days * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const p = `historial_precios?select=dia,precio,store_id&game=eq.${game}&card_key=eq.${encodeURIComponent(cardKey)}&dia=gte.${since}&order=dia.asc&limit=2000`;
  const rows = (await (await call(p, { timeoutMs: 5000 })).json()) as { dia: string; precio: number; store_id: string }[];
  const byDay = new Map<string, { min: number; stores: Set<string> }>();
  for (const r of rows) {
    const d = byDay.get(r.dia) ?? { min: Infinity, stores: new Set<string>() };
    d.min = Math.min(d.min, Number(r.precio));
    d.stores.add(r.store_id);
    byDay.set(r.dia, d);
  }
  return [...byDay.entries()].map(([dia, v]) => ({ dia, min: v.min, tiendas: v.stores.size }));
}

/** Cartas más buscadas en los últimos días (solo búsquedas que encontraron algo) */
export async function popularSearches(game: Game, days = 7, limit = 8): Promise<{ consulta: string; veces: number }[] | null> {
  const call = supabase();
  if (!call) return null;
  const since = new Date(Date.now() - days * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const rows = (await (await call(`busquedas_dia?select=consulta,veces,sin_result&game=eq.${game}&dia=gte.${since}&limit=5000`, { timeoutMs: 5000 })).json()) as {
    consulta: string; veces: number; sin_result: number;
  }[];
  const sum = new Map<string, number>();
  for (const r of rows) {
    const ok = r.veces - r.sin_result;
    if (ok > 0) sum.set(r.consulta, (sum.get(r.consulta) ?? 0) + ok);
  }
  return [...sum.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([consulta, veces]) => ({ consulta, veces }));
}
