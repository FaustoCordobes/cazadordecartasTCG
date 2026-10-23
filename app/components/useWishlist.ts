"use client";

import { useSyncExternalStore } from "react";
import { addItem, type WishItem } from "@/lib/wishlist.ts";

/**
 * Estado de "Mi lista" compartido entre todas las pantallas y guardado en el navegador.
 * Si el navegador no permite guardar (modo incógnito estricto), la lista funciona igual
 * mientras la pestaña esté abierta.
 */
const KEY = "cazacartas:lista";
let list: WishItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) list = JSON.parse(raw) as WishItem[];
  } catch { /* sin almacenamiento */ }
}

function set(next: WishItem[]) {
  list = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
  listeners.forEach((l) => l());
}

const EMPTY: WishItem[] = [];

export function useWishlist() {
  const items = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => { load(); return list; },
    () => EMPTY
  );
  return {
    items,
    add: (item: Omit<WishItem, "id" | "addedAt">) => set(addItem(list, item)),
    addMany: (many: Omit<WishItem, "id" | "addedAt">[]) => set(many.reduce((acc, it) => addItem(acc, it), list)),
    setQty: (id: string, qty: number) => set(list.map((x) => (x.id === id ? { ...x, qty: Math.max(1, Math.min(60, qty)) } : x))),
    setStore: (id: string, storeId: string) => set(list.map((x) => (x.id === id ? { ...x, storeId } : x))),
    remove: (id: string) => set(list.filter((x) => x.id !== id)),
    clear: () => set([]),
  };
}
