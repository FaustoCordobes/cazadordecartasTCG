import type { CardInfo, Game, PriceSet } from "./types.ts";

/**
 * Comparador de precios internacional de una versión de carta: Argentina (tiendas) vs TCGplayer,
 * Cardmarket y otros sitios, en pesos o en dólares según elija la persona.
 *
 * Los precios internacionales salen de las bases públicas de cartas (Scryfall, YGOPRODeck,
 * Pokémon TCG API, OPTCG API), que los publican con cada carta. No se lee la web de TCGplayer.
 */
export type Currency = "ARS" | "USD";
export interface Rates { usdArs: number | null; eurUsd: number | null }

const n = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Qué variante de los precios corresponde a esta versión (normal, foil, reverse holo, rareza, parallel...) */
export function variantKey(game: Game, g: { rarity: string | null; version: string | null }, keys: string[]): string | null {
  if (!keys.length) return null;
  const has = (k: string) => keys.includes(k);
  const ver = n(g.version);
  const only = keys.length === 1 ? keys[0] : null;
  switch (game) {
    case "mtg":
      return /foil|etched/.test(ver) ? (has("foil") ? "foil" : null) : has("normal") ? "normal" : null;
    case "pkm":
      if (/reverse/.test(ver)) return has("reverseHolofoil") ? "reverseHolofoil" : null;
      if (/holo/.test(ver)) return has("holofoil") ? "holofoil" : null;
      return has("normal") ? "normal" : has("holofoil") ? "holofoil" : only;
    case "ygo":
      return g.rarity && has(n(g.rarity)) ? n(g.rarity) : has("any") ? "any" : only;
    case "op":
      return /parallel|alt|manga/.test(ver) ? (has("parallel") ? "parallel" : null) : has("normal") ? "normal" : null;
    default:
      return has("any") ? "any" : null;
  }
}

export interface WorldRow {
  site: string;
  region: string;
  /** moneda en que publica el sitio */
  currency: "ARS" | "USD" | "EUR";
  /** precio principal (mercado / tendencia / el más bajo) en la moneda del sitio */
  main: number;
  mainLabel: string;
  /** otros datos del sitio (bajo, medio, alto, promedio) */
  extra: { label: string; value: number }[];
  url?: string;
  /** el precio es de la carta en general (la impresión más barata), no de esta versión */
  cardLevel?: boolean;
}

const pick = (set: PriceSet | undefined, order: (keyof PriceSet)[]) => {
  for (const k of order) if (set?.[k]) return { key: k, value: set[k]! };
  return null;
};
const LABEL: Record<keyof PriceSet, string> = { market: "Mercado", low: "Más bajo", mid: "Medio", high: "Más alto", trend: "Tendencia", avg: "Promedio de venta" };

/** Filas del comparador para una versión de carta (sin la fila de Argentina, que se arma con las publicaciones) */
export function worldRows(game: Game, g: { rarity: string | null; version: string | null; info: CardInfo | null }): WorldRow[] {
  const m = g.info?.market;
  if (!m) return [];
  const rows: WorldRow[] = [];
  const add = (site: string, region: string, currency: "USD" | "EUR", sets: Record<string, PriceSet> | undefined, order: (keyof PriceSet)[], url?: string, cardLevel?: boolean) => {
    if (!sets) return;
    const k = variantKey(game, g, Object.keys(sets));
    const set = k ? sets[k] : undefined;
    const main = pick(set, order);
    if (!main) return;
    const extra = (Object.keys(LABEL) as (keyof PriceSet)[])
      .filter((f) => f !== main.key && set?.[f])
      .map((f) => ({ label: LABEL[f], value: set![f]! }));
    rows.push({ site, region, currency, main: main.value, mainLabel: LABEL[main.key], extra, url, cardLevel: cardLevel || k === "any" || undefined });
  };
  add("TCGplayer", "EE. UU.", "USD", m.tcg, ["market", "mid", "low"], m.tcgUrl, m.cardLevel?.includes("tcg"));
  add("Cardmarket", "Europa", "EUR", m.cm, ["trend", "avg", "low"], m.cmUrl, m.cardLevel?.includes("cm"));
  for (const o of m.others ?? []) rows.push({ site: o.name, region: "EE. UU.", currency: "USD", main: o.usd, mainLabel: "Precio", extra: [], cardLevel: true });
  return rows;
}

/** Pasa un precio a la moneda elegida; null si falta la cotización */
export function convert(amount: number, from: "ARS" | "USD" | "EUR", to: Currency, r: Rates): number | null {
  const usd = from === "USD" ? amount : from === "EUR" ? (r.eurUsd ? amount * r.eurUsd : null) : r.usdArs ? amount / r.usdArs : null;
  if (usd === null) return null;
  if (to === "USD") return usd;
  return r.usdArs ? usd * r.usdArs : null;
}

/** Diferencia en % del precio en Argentina contra el de afuera (positivo = acá es más caro) */
export function diffPct(local: number | null, abroad: number | null): number | null {
  if (!local || !abroad) return null;
  return Math.round(((local - abroad) / abroad) * 100);
}

/** Link de búsqueda en TCGplayer / Cardmarket cuando la base no trae uno (ej. Digimon) */
export function searchLinks(game: Game, name: string): { tcg: string; cm: string } {
  const q = encodeURIComponent(name);
  const tcgGame: Record<Game, string> = { mtg: "magic", ygo: "yugioh", pkm: "pokemon", op: "one-piece-card-game", digi: "digimon-card-game" };
  const cmGame: Record<Game, string> = { mtg: "Magic", ygo: "YuGiOh", pkm: "Pokemon", op: "OnePiece", digi: "Digimon" };
  return {
    tcg: `https://www.tcgplayer.com/search/${tcgGame[game]}/product?q=${q}`,
    cm: `https://www.cardmarket.com/es/${cmGame[game]}/Products/Search?searchString=${q}`,
  };
}
