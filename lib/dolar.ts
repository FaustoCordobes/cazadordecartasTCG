import { TTLCache } from "./cache.ts";
import { getJSON } from "./http.ts";

/**
 * Cotización del dólar solo como referencia secundaria (los precios siempre son los de la tienda, en ARS).
 * Fuente: dolarapi.com. Tipo configurable con DOLAR_TIPO: bolsa (MEP, por defecto), blue u oficial.
 * Si la fuente falla o el dato tiene más de 3 días, no se muestra nada.
 */
export interface Dolar {
  tipo: string;
  nombre: string;
  venta: number;
  fecha: string;
  fuente: string;
}

const cache = new TTLCache<Dolar | null>(60 * 60 * 1000);
const NOMBRES: Record<string, string> = { bolsa: "dólar MEP", blue: "dólar blue", oficial: "dólar oficial" };

export function dolarTipo() {
  const t = (process.env.DOLAR_TIPO ?? "bolsa").toLowerCase();
  return t in NOMBRES ? t : "bolsa";
}

export function parseDolar(tipo: string, d: { venta?: number; fechaActualizacion?: string } | null, now = Date.now()): Dolar | null {
  if (!d || typeof d.venta !== "number" || d.venta <= 0 || !d.fechaActualizacion) return null;
  const age = now - new Date(d.fechaActualizacion).getTime();
  if (!(age < 3 * 24 * 3600 * 1000)) return null; // dato viejo: mejor no mostrar
  return { tipo, nombre: NOMBRES[tipo] ?? tipo, venta: d.venta, fecha: d.fechaActualizacion, fuente: "dolarapi.com" };
}

export async function getDolar(): Promise<Dolar | null> {
  const tipo = dolarTipo();
  const hit = cache.get(tipo);
  if (hit !== undefined) return hit;
  let out: Dolar | null = null;
  try {
    out = parseDolar(tipo, await getJSON(`https://dolarapi.com/v1/dolares/${tipo}`, 5000));
  } catch {
    out = null;
  }
  cache.set(tipo, out);
  return out;
}
