"use client";

import { useSyncExternalStore } from "react";
import { PROVINCES } from "@/lib/provinces.ts";

/** Provincia del usuario, recordada en el navegador y compartida entre pantallas ("" = sin elegir) */
const KEY = "cazacartas:provincia";
let value = "";
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const v = window.localStorage.getItem(KEY) ?? "";
    value = PROVINCES.includes(v) ? v : "";
  } catch { /* sin almacenamiento */ }
}

export function useProvince(): [string, (p: string) => void] {
  const v = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => { load(); return value; },
    () => ""
  );
  function set(p: string) {
    value = p;
    try { p ? window.localStorage.setItem(KEY, p) : window.localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
    listeners.forEach((l) => l());
  }
  return [v, set];
}

export function ProvinceSelect({ id, value, onChange }: { id: string; value: string; onChange: (p: string) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Elegí tu provincia</option>
      {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
    </select>
  );
}
