/** Cuándo se leyó cada precio, en palabras */

export const STALE_HOURS = 30;

export function hoursSince(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.max(0, (now - t) / 3600000);
}

/** "hace minutos", "hace 3 h", "hace 2 días" */
export function agoText(iso: string | null | undefined, now = Date.now()) {
  const h = hoursSince(iso, now);
  if (h === null) return "sin fecha";
  if (h < 1) return "hace minutos";
  if (h < 48) return `hace ${Math.round(h)} h`;
  return `hace ${Math.round(h / 24)} días`;
}

export interface Freshness {
  text: string;
  stale: boolean;
}

/** live = se consultó en el momento de la búsqueda; index = viene del catálogo que se lee una vez por día */
export function priceFreshness(mode: "live" | "index", indexedAt: string | null | undefined, now = Date.now()): Freshness {
  if (mode === "live") return { text: "Precio en vivo", stale: false };
  const h = hoursSince(indexedAt, now);
  if (h === null) return { text: "Precio del catálogo (sin fecha)", stale: true };
  return { text: `Precio de ${agoText(indexedAt, now)}`, stale: h > STALE_HOURS };
}
