import type { CardInfo, Game } from "./types.ts";

const n = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Precio de referencia internacional (TCGplayer, EE. UU., en dólares) de una versión de carta.
 * Sirve para saber si un precio local está muy por encima o por debajo de lo normal.
 * Devuelve null si no hay un dato que corresponda con seguridad a esa versión.
 */
export function refUsd(game: Game, g: { rarity: string | null; version: string | null; info: CardInfo | null }): number | null {
  const p = g.info?.ref?.prices;
  if (!p) return null;
  const ver = n(g.version);
  const one = () => {
    const v = Object.values(p);
    return v.length === 1 ? v[0] : null;
  };
  switch (game) {
    case "mtg":
      return /foil|etched/.test(ver) ? p.foil ?? null : p.normal ?? null;
    case "pkm":
      if (/reverse/.test(ver)) return p.reverseHolofoil ?? null;
      if (/holo/.test(ver)) return p.holofoil ?? null;
      return p.normal ?? p.holofoil ?? one();
    case "ygo":
      return (g.rarity ? p[n(g.rarity)] : undefined) ?? one();
    case "op":
      return /parallel|alt|manga/.test(ver) ? p.parallel ?? null : p.normal ?? null;
    default:
      return null;
  }
}

/** Mediana de precios (redondeada), como el "Listed Median" de TCGplayer */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}
