import type { CardGroup, Game, SearchResponse } from "./types.ts";
import { supabase } from "./supa.ts";
import { norm } from "./parse.ts";

/**
 * Avisos al celular (notificaciones push) sin cuentas.
 *
 * La persona activa los avisos desde "Mi lista": el navegador da una dirección anónima de notificaciones
 * (no es un email ni un teléfono) y se guardan las cartas con alerta. Una vez por día, GitHub Actions
 * (scripts/avisos.ts) busca esas cartas y avisa si bajaron al precio pedido o volvieron a tener stock.
 *
 * Variables de entorno: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT (ver README).
 */

export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string } }
export interface WatchCard { game: Game; carta: string; card_key: string; precio_max: number | null }

export const vapidPublic = () => process.env.VAPID_PUBLIC_KEY ?? null;
export const pushEnabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && supabase());

export function validSub(s: unknown): s is PushSub {
  const x = s as PushSub;
  return !!x && typeof x.endpoint === "string" && /^https:\/\//.test(x.endpoint) && x.endpoint.length < 1000 &&
    typeof x.keys?.p256dh === "string" && typeof x.keys?.auth === "string" && x.keys.p256dh.length < 200 && x.keys.auth.length < 100;
}

export { watchKey } from "./watchkey.ts";

/** Guarda (o reemplaza) las cartas vigiladas de una suscripción */
export async function saveWatch(sub: PushSub, cards: WatchCard[]) {
  const call = supabase();
  if (!call) throw new Error("Supabase no está configurado");
  const r = await call("avisos_push?on_conflict=endpoint&select=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }),
  });
  const [{ id }] = (await r.json()) as { id: string }[];
  await call(`avisos_cartas?push_id=eq.${id}`, { method: "DELETE" });
  if (cards.length) {
    await call("avisos_cartas", {
      method: "POST",
      body: JSON.stringify(cards.slice(0, 60).map((c) => ({ push_id: id, game: c.game, carta: c.carta.slice(0, 80), card_key: c.card_key.slice(0, 120), precio_max: c.precio_max }))),
    });
  }
  return id;
}

export async function deleteSub(endpoint: string) {
  const call = supabase();
  if (!call) return;
  await call(`avisos_push?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE" });
}

/** Precio más bajo con stock de la carta vigilada en una búsqueda (null = nadie la tiene) */
export function bestFor(res: SearchResponse, carta: string, cardKey: string): { price: number; store: string; url: string } | null {
  const [code, rarity, version] = cardKey ? cardKey.split("|") : ["", "", ""];
  const n = norm(carta).replace(/[^a-z0-9]+/g, " ").trim();
  const ok = (g: CardGroup) =>
    (code ? (g.code ?? "").toUpperCase() === code.toUpperCase() : norm(g.name).replace(/[^a-z0-9]+/g, " ").trim() === n || !!g.exact) &&
    (!rarity || g.rarity === rarity) && (!version || (g.version ?? "") === version);
  let best: { price: number; store: string; url: string } | null = null;
  for (const g of res.cards.filter(ok)) {
    for (const l of g.listings) {
      if (l.available !== true) continue;
      if (!best || l.price < best.price) best = { price: l.price, store: l.storeName, url: l.url };
    }
  }
  return best;
}

/** ¿Hay que avisar? Precio pedido alcanzado, o vuelve a haber stock; sin repetir el mismo aviso */
export function shouldNotify(
  w: { precio_max: number | null; ultimo_precio: number | null; ultimo_aviso: string | null },
  best: { price: number } | null,
  now = Date.now()
): boolean {
  if (!best) return false;
  const recent = w.ultimo_aviso ? now - new Date(w.ultimo_aviso).getTime() < 3 * 86400000 : false;
  if (w.precio_max != null) {
    if (best.price > w.precio_max) return false;
    // ya avisado hace poco y no bajó más: no se repite
    return !(recent && w.ultimo_precio != null && best.price >= w.ultimo_precio);
  }
  // solo "avisame cuando vuelva a haber stock": cuando antes no había
  return w.ultimo_precio == null && !recent;
}
