import type { CardGroup, Game } from "./types.ts";
import { norm } from "./parse.ts";
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
  /** copias que ya conseguiste */
  obtained?: number;
  /** precio de la tienda elegida cuando la guardaste */
  savedPrice?: number | null;
  /** alertas: se revisan cuando abrís la app y tocás "Actualizar precios" */
  alert?: { maxPrice?: number | null; backInStock?: boolean };
  /** última revisión de precios */
  lastCheck?: { at: string; best: number | null; storeName: string | null; available: boolean };
}

export interface WishList {
  id: string;
  name: string;
  createdAt: string;
  items: WishItem[];
}

export interface WishState {
  version: 2;
  active: string;
  lists: WishList[];
}

export const itemKey = (game: Game, name: string, code: string | null, rarity: string | null, version: string | null) =>
  [game, name.toLowerCase(), code ?? "", rarity ?? "", version ?? ""].join("|");

export const selectedOffer = (it: WishItem) => it.offers.find((o) => o.storeId === it.storeId) ?? it.offers[0];

/** Agrega o suma copias. Si ya estaba, actualiza precios/tiendas y respeta la tienda elegida salvo que se pida otra. */
export function addItem(list: WishItem[], item: Omit<WishItem, "id" | "addedAt">, now = new Date()): WishItem[] {
  const id = itemKey(item.game, item.name, item.code, item.rarity, item.version);
  const prev = list.find((x) => x.id === id);
  if (!prev) {
    const saved = item.offers.find((o) => o.storeId === item.storeId) ?? item.offers[0];
    return [...list, { ...item, id, addedAt: now.toISOString(), savedPrice: saved?.price ?? null }];
  }
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


// ---------- Varias listas ----------
export const LEGACY_KEY = "cazacartas:lista";
export const STATE_KEY = "cazacartas:listas";

export const newList = (name: string, now = new Date()): WishList => ({
  id: `l${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name: name.trim().slice(0, 40) || "Mi lista",
  createdAt: now.toISOString(),
  items: [],
});

/** Lee lo guardado: el formato nuevo, o la lista vieja (un solo array) convertida en "Mi lista" */
export function loadState(rawState: string | null, rawLegacy: string | null): WishState {
  try {
    if (rawState) {
      const s = JSON.parse(rawState) as WishState;
      if (s && s.version === 2 && Array.isArray(s.lists) && s.lists.length) {
        return { ...s, active: s.lists.some((l) => l.id === s.active) ? s.active : s.lists[0].id };
      }
    }
  } catch { /* dato roto: se sigue con lo viejo o vacío */ }
  let items: WishItem[] = [];
  try {
    const old = rawLegacy ? JSON.parse(rawLegacy) : [];
    if (Array.isArray(old)) items = old as WishItem[];
  } catch { /* nada */ }
  return { version: 2, active: "principal", lists: [{ id: "principal", name: "Mi lista", createdAt: new Date(0).toISOString(), items }] };
}

export const activeList = (s: WishState) => s.lists.find((l) => l.id === s.active) ?? s.lists[0];

export function updateList(s: WishState, id: string, fn: (items: WishItem[]) => WishItem[]): WishState {
  return { ...s, lists: s.lists.map((l) => (l.id === id ? { ...l, items: fn(l.items) } : l)) };
}

/** Copias que faltan conseguir de una lista */
export const missingCopies = (items: WishItem[]) => items.reduce((n, it) => n + Math.max(0, it.qty - (it.obtained ?? 0)), 0);

/** La lista como decklist de texto, para buscarla entera en "Listado de cartas" (solo lo que falta) */
export function listToDeckText(items: WishItem[]): string {
  return items
    .filter((it) => it.qty - (it.obtained ?? 0) > 0)
    .map((it) => `${it.qty - (it.obtained ?? 0)} ${it.name}${it.code && (it.game === "digi" || it.game === "op") ? ` ${it.code}` : ""}`)
    .join("\n");
}

// ---------- Revisión de precios y alertas ----------
/** Busca, entre los resultados de una búsqueda, la misma versión de la carta guardada */
export function matchGroup(it: WishItem, cards: CardGroup[]): CardGroup | null {
  const sameName = (n: string) => norm(n).replace(/[^a-z0-9]+/g, " ").trim() === norm(it.name).replace(/[^a-z0-9]+/g, " ").trim();
  const ver = (v: string | null) => (v && v !== "Normal" ? v : null);
  const candidates = cards.filter((g) =>
    it.code ? g.code?.toUpperCase() === it.code.toUpperCase() : sameName(g.name) || (g.info && sameName(g.info.name))
  );
  return (
    candidates.find((g) => (g.rarity ?? null) === (it.rarity ?? null) && ver(g.version) === ver(it.version)) ??
    candidates.find((g) => ver(g.version) === ver(it.version)) ??
    null
  );
}

export interface CheckResult { item: WishItem; messages: string[] }

/** Actualiza las tiendas y el mejor precio de una carta guardada y dice si se cumplió alguna alerta */
export function applyCheck(it: WishItem, group: CardGroup | null, now = new Date()): CheckResult {
  const avail = group ? group.listings.filter((l) => l.available !== false) : [];
  const byStore = new Map<string, WishOffer>();
  for (const l of avail) {
    const prev = byStore.get(l.storeId);
    if (!prev || l.price < prev.price) byStore.set(l.storeId, { storeId: l.storeId, storeName: l.storeName, storeCity: l.storeCity, price: l.price, url: l.url, stock: l.stock });
  }
  const offers = [...byStore.values()].sort((a, b) => a.price - b.price);
  const best = offers[0] ?? null;
  const wasAvailable = it.lastCheck ? it.lastCheck.available : it.offers.length > 0;
  const messages: string[] = [];
  const fmtP = (n: number) => fmt.format(n);
  if (best && it.alert?.maxPrice && best.price <= it.alert.maxPrice) {
    messages.push(`${it.name} está a ${fmtP(best.price)} en ${best.storeName} (tu alerta: hasta ${fmtP(it.alert.maxPrice)})`);
  }
  if (best && it.alert?.backInStock && !wasAvailable) messages.push(`${it.name} volvió a tener stock en ${best.storeName}`);
  const keepStore = offers.some((o) => o.storeId === it.storeId);
  return {
    item: {
      ...it,
      offers: offers.length ? offers : it.offers,
      storeId: keepStore ? it.storeId : best?.storeId ?? it.storeId,
      lastCheck: { at: now.toISOString(), best: best?.price ?? null, storeName: best?.storeName ?? null, available: !!best },
    },
    messages,
  };
}

// ---------- Exportar / importar ----------
export function exportState(s: WishState): string {
  return JSON.stringify({ app: "cazacartas", ...s }, null, 1);
}

/** Valida un archivo exportado. Devuelve las listas o un error */
export function importState(text: string): WishList[] | string {
  if (text.length > 2_000_000) return "El archivo es demasiado grande";
  try {
    const data = JSON.parse(text) as Partial<WishState> & { app?: string };
    const lists = Array.isArray(data.lists) ? data.lists : Array.isArray(data) ? [{ id: "importada", name: "Importada", createdAt: new Date().toISOString(), items: data }] : null;
    if (!lists) return "No es un archivo de listas de Cazacartas";
    const clean = lists
      .filter((l) => l && Array.isArray(l.items))
      .map((l) => ({
        id: newList(String(l.name ?? "Importada")).id,
        name: String(l.name ?? "Importada").slice(0, 40),
        createdAt: new Date().toISOString(),
        items: (l.items as WishItem[]).filter((it) => it && typeof it.name === "string" && typeof it.qty === "number" && Array.isArray(it.offers)).slice(0, 300),
      }));
    return clean.length ? clean : "El archivo no tiene listas";
  } catch {
    return "El archivo no se pudo leer (tiene que ser el .json que exportó Cazacartas)";
  }
}
