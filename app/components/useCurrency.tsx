"use client";

import { useSyncExternalStore } from "react";
import type { Currency } from "@/lib/worldprice.ts";

/** Moneda en que la persona quiere ver los precios (pesos o dólares), recordada y sincronizada con la cuenta */
const KEY = "cazacartas:moneda";
let value: Currency = "ARS";
let loaded = false;
let listening = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { value = window.localStorage.getItem(KEY) === "USD" ? "USD" : "ARS"; } catch { /* sin almacenamiento */ }
  if (!listening) {
    listening = true;
    window.addEventListener("cazacartas:ajustes-sync", () => { loaded = false; load(); listeners.forEach((l) => l()); });
  }
}

export function useCurrency(): [Currency, (c: Currency) => void] {
  const v = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => { load(); return value; },
    () => "ARS" as Currency
  );
  function set(c: Currency) {
    value = c;
    try { window.localStorage.setItem(KEY, c); } catch { /* sin almacenamiento */ }
    try { window.dispatchEvent(new Event("cazacartas:ajustes")); } catch { /* nada */ }
    listeners.forEach((l) => l());
  }
  return [v, set];
}

/** Botón para cambiar entre pesos y dólares */
export function CurrencyToggle() {
  const [cur, setCur] = useCurrency();
  return (
    <button type="button" className="theme-btn" onClick={() => setCur(cur === "ARS" ? "USD" : "ARS")} title="Ver los precios en pesos o en dólares" aria-label={`Ver precios en ${cur === "ARS" ? "dólares" : "pesos"}`}>
      <span aria-hidden="true">💲</span><span>{cur === "ARS" ? "Pesos" : "Dólares"}</span>
    </button>
  );
}
