import type { CardInfo, Game, PriceSet } from "./types.ts";
import type { InfoIndex } from "./cardinfo.ts";
import { norm } from "./parse.ts";

/**
 * Calculadora de precios (como la de TCG Toolbox): todas las versiones de una carta con su precio
 * internacional, para armar una lista y ver el total en dólares o en pesos.
 * Los precios salen de las bases públicas de cartas (no se consulta la web de TCGplayer).
 */
export interface PriceVersion {
  id: string;
  name: string;
  code: string | null;
  setName: string | null;
  rarity: string | null;
  /** variante del precio: Normal, Foil, Reverse Holo, Parallel... */
  variant: string;
  image: string | null;
  /** TCGplayer en dólares (mercado, o el medio si no hay mercado) */
  usd: number | null;
  /** Cardmarket en euros (tendencia) */
  eur: number | null;
  tcgUrl: string | null;
  cmUrl: string | null;
  /** el precio es de la carta en general, no de esta impresión */
  cardLevel: boolean;
}

const VARIANT: Record<string, string> = {
  normal: "Normal", foil: "Foil", holofoil: "Holo", reverseHolofoil: "Reverse Holo", "1stEditionHolofoil": "1st Edition Holo",
  "1stEditionNormal": "1st Edition", unlimitedHolofoil: "Unlimited Holo", parallel: "Parallel", any: "Cualquier impresión",
};
const main = (s?: PriceSet) => s?.market ?? s?.mid ?? s?.low ?? s?.trend ?? s?.avg ?? null;
const title = (k: string) => VARIANT[k] ?? k.replace(/\b\w/g, (c) => c.toUpperCase());

/** Versiones con precio a partir del índice de fichas; primero las del nombre exacto, después las más caras */
export function priceVersions(game: Game, idx: InfoIndex, q: string, limit = 60): PriceVersion[] {
  const out: PriceVersion[] = [];
  const seen = new Set<CardInfo>();
  const add = (code: string | null, info: CardInfo) => {
    const m = info.market;
    if (!m || seen.has(info)) return;
    seen.add(info);
    const keys = [...new Set([...Object.keys(m.tcg ?? {}), ...Object.keys(m.cm ?? {})])];
    for (const k of keys) {
      const usd = main(m.tcg?.[k]);
      // Cardmarket por variante; en Yu-Gi-Oh! es de la carta en general ("any")
      const eur = main(m.cm?.[k]) ?? (game === "ygo" ? main(m.cm?.any) : null);
      if (!usd && !eur) continue;
      out.push({
        id: `${game}|${code ?? info.name}|${k}`,
        name: info.name,
        code,
        setName: info.setName ?? null,
        rarity: game === "ygo" && k !== "any" ? title(k) : info.rarity ?? null,
        variant: game === "ygo" ? (k === "any" ? VARIANT.any : "Normal") : title(k),
        image: info.image ?? null,
        usd,
        eur,
        tcgUrl: m.tcgUrl ?? null,
        cmUrl: m.cmUrl ?? null,
        cardLevel: k === "any" || !!m.cardLevel?.includes("tcg"),
      });
    }
  };
  // por código (cada impresión); las claves con "@" son resúmenes por edición de Magic y se saltean
  for (const [code, info] of idx.byCode) if (!code.includes("@") && !/^\d+$/.test(code)) add(code, info);
  // Yu-Gi-Oh!: si una carta no tiene precio por impresión, queda el de la carta en general
  for (const info of idx.byName.values()) add(null, info);
  const want = norm(q).replace(/[^a-z0-9]+/g, " ").trim();
  const exact = (v: PriceVersion) => norm(v.name).replace(/[^a-z0-9]+/g, " ").trim() === want || (v.code ?? "").toLowerCase() === q.trim().toLowerCase();
  return out
    .sort((a, b) => Number(exact(b)) - Number(exact(a)) || (b.usd ?? 0) - (a.usd ?? 0))
    .slice(0, limit);
}
