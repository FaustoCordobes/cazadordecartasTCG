import type { DeckCard, DeckOffer } from "./deck.ts";
import type { Game } from "./types.ts";

/**
 * Opciones del plan de compra de un listado (como el estado mínimo y "cualquier impresión" de
 * ScryPrice o Mana Pool). Se aplican filtrando las publicaciones de cada carta antes de optimizar.
 */
export interface DeckPrefs {
  /** estado mínimo aceptado; las publicaciones que no dicen el estado se aceptan (la mayoría vende NM) */
  minCond: "any" | "NM" | "LP" | "MP" | "HP";
  /** idioma; "Inglés" incluye las publicaciones que no dicen el idioma */
  lang: "any" | "Inglés" | "Español" | "Japonés";
  /** "exact": solo la impresión que pide la lista (código o set), cuando la lista la indica */
  printing: "any" | "exact";
  /** sin versiones especiales (Alter, Foil, Parallel...) */
  noSpecial: boolean;
}

export const DEFAULT_PREFS: DeckPrefs = { minCond: "any", lang: "any", printing: "any", noSpecial: false };

export const COND_ORDER = ["NM", "LP", "MP", "HP", "DMG"] as const;
export const COND_LABEL: Record<DeckPrefs["minCond"], string> = {
  any: "Cualquier estado", NM: "Solo NM (casi nuevo)", LP: "NM o LP", MP: "Hasta MP", HP: "Hasta HP",
};

export function offerPasses(o: DeckOffer, card: DeckCard, p: DeckPrefs, game: Game): boolean {
  if (p.minCond !== "any" && o.condition) {
    const max = COND_ORDER.indexOf(p.minCond);
    const got = COND_ORDER.indexOf(o.condition as (typeof COND_ORDER)[number]);
    if (got > max) return false;
  }
  if (p.lang !== "any") {
    const l = o.lang ?? null;
    if (p.lang === "Inglés" ? l !== null && l !== "Inglés" : l !== p.lang) return false;
  }
  if (p.noSpecial && o.version && o.version !== "Normal" && !/^(1st|unlimited|limited)/i.test(o.version)) return false;
  if (p.printing === "exact") {
    const e = card.entry;
    if (e.code && game !== "mtg" && game !== "pkm") {
      // Yu-Gi-Oh!: el código impreso cambia con el idioma (LOB-EN005 / LOB-S005): se compara el set y el número
      const k = (c: string | null | undefined) => (c ?? "").toUpperCase().replace(/-(EN|SP|S|E|JP|DE|FR|IT|PT|KR)(?=\d)/, "-");
      if (!o.code || k(o.code) !== k(e.code)) return false;
    }
    if (e.set && game === "mtg") {
      const set = (o.set ?? o.code?.split("-")[0] ?? "").toUpperCase();
      if (set !== e.set.toUpperCase()) return false;
    }
  }
  return true;
}

/** Cartas con las publicaciones que cumplen las opciones; `hidden` = cuántas quedaron afuera */
export function applyPrefs(cards: DeckCard[], p: DeckPrefs, game: Game): { cards: DeckCard[]; hidden: number } {
  if (p.minCond === "any" && p.lang === "any" && p.printing === "any" && !p.noSpecial) return { cards, hidden: 0 };
  let hidden = 0;
  const out = cards.map((c) => {
    const offers = c.offers.filter((o) => offerPasses(o, c, p, game));
    hidden += c.offers.length - offers.length;
    return { ...c, offers };
  });
  return { cards: out, hidden };
}

/** ¿Las opciones cambian algo? (para mostrar el aviso) */
export const prefsActive = (p: DeckPrefs) => p.minCond !== "any" || p.lang !== "any" || p.printing !== "any" || p.noSpecial;
