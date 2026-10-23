import type { Game } from "./types.ts";
import { GAMES } from "./games.ts";

/**
 * "Mi lista": las cartas que el usuario quiere comprar, guardadas en su navegador
 * (sin cuenta). Cada carta guarda las tiendas que la tenían al momento de agregarla,
 * para que el usuario elija en cuál comprar antes de compartirse la lista.
 */

export interface WishOffer {
  storeId: string;
  storeName: string;
  storeCity: string | null;
  price: number;
  url: string;
  /** stock informado al agregarla (null = la tienda no lo informa) */
  stock: number | null;
}

export interface WishItem {
  id: string;
  game: Game;
  name: string;
  code: string | null;
  rarity: string | null;
  version: string | null;
  qty: number;
  offers: WishOffer[];
  /** tienda elegida para comprar */
  storeId: string;
  addedAt: string;
}

export const itemKey = (game: Game, name: string, code: string | null, rarity: string | null, version: string | null) =>
  [game, name.toLowerCase(), code ?? "", rarity ?? "", version ?? ""].join("|");

export const selectedOffer = (it: WishItem) => it.offers.find((o) => o.storeId === it.storeId) ?? it.offers[0];

/** Agrega o suma copias. Si ya estaba, actualiza precios/tiendas y respeta la tienda elegida salvo que se pida otra. */
export function addItem(list: WishItem[], item: Omit<WishItem, "id" | "addedAt">, now = new Date()): WishItem[] {
  const id = itemKey(item.game, item.name, item.code, item.rarity, item.version);
  const prev = list.find((x) => x.id === id);
  if (!prev) return [...list, { ...item, id, addedAt: now.toISOString() }];
  const offers = [...item.offers, ...prev.offers.filter((o) => !item.offers.some((n) => n.storeId === o.storeId))];
  return list.map((x) => (x.id === id ? { ...x, qty: x.qty + item.qty, offers, storeId: item.storeId || x.storeId } : x));
}

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export const SHARE_WARNING =
  "⚠️ Este listado está actualizado solo al momento en que te lo compartiste. Si volvés más tarde y ya no hay copias de alguna carta, el listado no se actualiza solo: tenés que revisarlo vos en cada tienda.";

/** Texto para mandarse la lista por WhatsApp */
export function buildShareText(list: WishItem[], now = new Date()): string {
  const fecha = now.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const games = [...new Set(list.map((i) => GAMES[i.game].short))].join(" y ");
  const lines: string[] = [`🃏 *Mi lista de cartas* (${games})`, `Armada el ${fecha} con Cazacartas`, ""];
  let total = 0;
  for (const it of list) {
    const o = selectedOffer(it);
    const label = [it.name, it.code, it.version && it.version !== "Normal" ? it.version : null].filter(Boolean).join(" ");
    const copias = `${it.qty} ${it.qty === 1 ? "copia" : "copias"}`;
    if (o) {
      total += o.price * it.qty;
      lines.push(`• *${label}* — ${copias} en ${o.storeName} (${fmt.format(o.price)} c/u)`);
      lines.push(`  ${o.url}`);
    } else {
      lines.push(`• *${label}* — ${copias} (sin tienda elegida)`);
    }
  }
  lines.push("", `Total estimado: *${fmt.format(total)}*`, "", SHARE_WARNING);
  return lines.join("\n");
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
