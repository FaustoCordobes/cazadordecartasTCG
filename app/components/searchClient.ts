"use client";

import type { CardGroup, Game, SearchResponse, StoreStatus } from "@/lib/types.ts";

/**
 * Búsqueda desde el navegador:
 *  - recibe los resultados a medida que responde cada tienda (stream NDJSON);
 *  - guarda cada respuesta 10 minutos para no volver a consultar las tiendas por lo mismo
 *    (útil en listados y en "Actualizar precios" de Mi lista);
 *  - junta pedidos iguales que estén en curso y se puede cancelar con AbortSignal.
 */
export interface Partial { done: number; total: number; stores: StoreStatus[]; cards: CardGroup[] }

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: SearchResponse }>();
const inflight = new Map<string, Promise<SearchResponse>>();

const keyOf = (game: Game, q: string) => `${game}:${q.trim().toLowerCase()}`;

export function cached(game: Game, q: string): SearchResponse | null {
  const hit = cache.get(keyOf(game, q));
  return hit && Date.now() - hit.at < TTL ? hit.data : null;
}

export async function search(
  game: Game,
  q: string,
  opts: { signal?: AbortSignal; onProgress?: (p: Partial) => void; stream?: boolean } = {}
): Promise<SearchResponse> {
  const key = keyOf(game, q);
  const hit = cached(game, q);
  if (hit) return hit;
  const running = inflight.get(key);
  if (running && !opts.onProgress) return running;

  const p = (async () => {
    const url = `/api/buscar?game=${game}&q=${encodeURIComponent(q.trim())}${opts.stream === false ? "" : "&stream=1"}`;
    const res = await fetch(url, { signal: opts.signal });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error ?? "Error en la búsqueda");
    }
    if (opts.stream === false || !res.body) return (await res.json()) as SearchResponse;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let final: SearchResponse | null = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as { type: string; data?: SearchResponse; error?: string } & Partial;
        if (msg.type === "progress") opts.onProgress?.(msg);
        else if (msg.type === "done" && msg.data) final = msg.data;
        else if (msg.type === "error") throw new Error(msg.error ?? "Error en la búsqueda");
      }
    }
    if (!final) throw new Error("La búsqueda se cortó. Probá de nuevo.");
    return final;
  })();
  inflight.set(key, p);
  try {
    const data = await p;
    cache.set(key, { at: Date.now(), data });
    return data;
  } finally {
    inflight.delete(key);
  }
}

/** Corre varias búsquedas de a pocas (para no cargar a las tiendas) */
export async function searchMany<T>(items: T[], fn: (it: T) => Promise<void>, concurrency = 3) {
  let i = 0;
  const worker = async () => {
    while (i < items.length) await fn(items[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

/** Cuenta un click hacia una tienda (sin datos de la persona; si falla no pasa nada) */
export function trackClick(game: Game, store: string) {
  try {
    const body = JSON.stringify({ tipo: "click", game, store });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/evento", new Blob([body], { type: "application/json" }));
    else fetch("/api/evento", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
  } catch { /* nada */ }
}
