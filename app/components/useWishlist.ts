"use client";

import { useSyncExternalStore } from "react";
import {
  activeList, addItem, importState, LEGACY_KEY, loadState, newList, STATE_KEY, updateList,
  type WishItem, type WishList, type WishState,
} from "@/lib/wishlist.ts";

/**
 * "Mi lista" (varias listas con nombre), compartida entre pantallas y guardada en este navegador.
 * Si la persona ingresa a su cuenta, se sincroniza con ella (ver account.ts); si no, queda solo en este navegador.
 * Si el navegador no permite guardar, funciona igual mientras la pestaña esté abierta.
 */
let state: WishState | null = null;
let saveError = false;
const listeners = new Set<() => void>();

function get(): WishState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null, legacy: string | null = null;
  try {
    raw = window.localStorage.getItem(STATE_KEY);
    legacy = window.localStorage.getItem(LEGACY_KEY);
  } catch { /* sin almacenamiento */ }
  state = loadState(raw, legacy);
  return state;
}

function set(next: WishState) {
  state = next;
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
    saveError = false;
  } catch {
    saveError = true; // lleno o bloqueado: se avisa en pantalla
  }
  listeners.forEach((l) => l());
}

const EMPTY: WishState = { version: 2, active: "principal", lists: [{ id: "principal", name: "Mi lista", createdAt: "", items: [] }] };

type NewItem = Omit<WishItem, "id" | "addedAt">;

export function useWishlist() {
  const s = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    get,
    () => EMPTY
  );
  const list = activeList(s);
  const upd = (fn: (items: WishItem[]) => WishItem[]) => set(updateList(get(), activeList(get()).id, fn));
  const upItem = (id: string, fn: (x: WishItem) => WishItem) => upd((items) => items.map((x) => (x.id === id ? fn(x) : x)));
  return {
    state: s,
    list,
    items: list.items,
    /** total de cartas en todas las listas (para el contador de la pestaña) */
    count: s.lists.reduce((n, l) => n + l.items.length, 0),
    saveError,
    add: (item: NewItem) => upd((items) => addItem(items, item)),
    addMany: (many: NewItem[]) => upd((items) => many.reduce((acc, it) => addItem(acc, it), items)),
    setQty: (id: string, qty: number) => upItem(id, (x) => ({ ...x, qty: Math.max(1, Math.min(60, qty)), obtained: Math.min(x.obtained ?? 0, Math.max(1, Math.min(60, qty))) })),
    setObtained: (id: string, n: number) => upItem(id, (x) => ({ ...x, obtained: Math.max(0, Math.min(x.qty, n)) })),
    setStore: (id: string, storeId: string) => upItem(id, (x) => ({ ...x, storeId })),
    setAlert: (id: string, alert: WishItem["alert"]) => upItem(id, (x) => ({ ...x, alert })),
    replaceItems: (items: WishItem[]) => upd(() => items),
    remove: (id: string) => upd((items) => items.filter((x) => x.id !== id)),
    clear: () => upd(() => []),
    // listas
    selectList: (id: string) => set({ ...get(), active: id }),
    createList: (name: string) => { const l = newList(name); set({ ...get(), lists: [...get().lists, l], active: l.id }); },
    renameList: (id: string, name: string) => set({ ...get(), lists: get().lists.map((l) => (l.id === id ? { ...l, name: name.trim().slice(0, 40) || l.name } : l)) }),
    deleteList: (id: string) => {
      const rest = get().lists.filter((l) => l.id !== id);
      const lists = rest.length ? rest : [newList("Mi lista")];
      set({ ...get(), lists, active: lists[0].id });
    },
    importLists: (text: string): string | null => {
      const r = importState(text);
      if (typeof r === "string") return r;
      set({ ...get(), lists: [...get().lists, ...r], active: r[0].id });
      return null;
    },
  };
}

export type { WishList };

/** Acceso directo al estado (para sincronizar con la cuenta) */
export const wishStore = {
  get,
  set,
  subscribe: (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
};
