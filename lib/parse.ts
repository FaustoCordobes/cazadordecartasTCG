import type { Game } from "./types.ts";

export const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
}

/** ¿El título de la tienda corresponde a lo que buscó el usuario? Todas las palabras tienen que estar. */
export function matchesQuery(title: string, q: string): boolean {
  const t = norm(title).replace(/[^a-z0-9]+/g, " ");
  const words = norm(q).replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length >= 2);
  if (!words.length) return false;
  const compact = t.replace(/ /g, "");
  return words.every((w) => t.includes(w) || compact.includes(w));
}

export interface Parsed {
  name: string;
  code: string | null;
  set: string | null;
  rarity: string | null;
  version: string | null;
  edition: string | null;
  lang: string | null;
}

// ---------- Digimon ----------
const DIGI_CODE = /\b((?:BT|EX|ST|AD|RB|LM|BO|P)\d{0,2}-\d{2,3})(?:-(C|U|R|SR|SEC|UR|P))?\b/i;

export function parseDigimon(title: string): Parsed {
  const m = title.match(DIGI_CODE);
  const code = m ? m[1].toUpperCase().replace(/^([A-Z]+)0(\d)-/, "$1$2-") : null;
  let rarity = m?.[2]?.toUpperCase() ?? null;
  if (!rarity) {
    const r = title.match(/\b(SEC|SR|UR)\b|\((C|U|R)\)/);
    rarity = r ? (r[1] || r[2]) : null;
  }
  // La variante va después del código ("Omnimon AD1-025-SEC Alter"); así no se confunde con
  // nombres como "Omnimon Alter-S".
  const tail = m ? title.slice((m.index ?? 0) + m[0].length) : title;
  const version = /\balter\b|alternate art|arte alterno/i.test(tail)
    ? "Alter"
    : /\bgold\b/i.test(tail)
      ? "Gold"
      : /\bfoil\b/i.test(tail)
        ? "Foil"
        : "Normal";
  const name = (m ? title.slice(0, m.index) : title)
    .replace(/digimon( card game| tcg)?/i, "")
    .replace(/[-–|(\[]+\s*$/, "")
    .trim();
  return { name: name || title, code, set: code ? code.split("-")[0] : null, rarity, version, edition: null, lang: null };
}

// ---------- Yu-Gi-Oh! ----------
const YGO_CODE = /\b([A-Z0-9]{3,5})-((EN|SP|JP|DE|FR|IT|PT|KR)[A-Z]?\d{2,3})\b/;
const YGO_LANG: Record<string, string> = {
  EN: "Inglés", SP: "Español", JP: "Japonés", DE: "Alemán", FR: "Francés", IT: "Italiano", PT: "Portugués", KR: "Coreano",
};
const YGO_RARITIES = [
  "Quarter Century Secret Rare",
  "Prismatic Collector's Rare",
  "Prismatic Secret Rare",
  "Platinum Secret Rare",
  "Premium Gold Rare",
  "Gold Secret Rare",
  "Collector's Rare",
  "Starlight Rare",
  "Ultimate Rare",
  "Ghost Rare",
  "Secret Rare",
  "Ultra Rare",
  "Super Rare",
  "Gold Rare",
  "Short Print",
  "Rare",
  "Common",
];

export function parseYgo(title: string): Parsed {
  const m = title.match(YGO_CODE);
  const code = m ? `${m[1]}-${m[2]}` : null;
  let rarity: string | null = /duel terminal/i.test(title) ? "Duel Terminal Parallel Rare" : null;
  if (!rarity) {
    const t = norm(title);
    rarity = YGO_RARITIES.find((r) => t.includes(norm(r))) ?? null;
  }
  const edition = /1st/i.test(title) ? "1st Edition" : /unlimited/i.test(title) ? "Unlimited" : null;
  const version = /alternate art|arte alternativo/i.test(title) ? "Arte alternativo" : null;
  let name = title
    .replace(/^yu-?gi-?oh!?\s*(tcg)?[,:]?\s*/i, "")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ");
  if (code) name = name.split(code)[0];
  name = name.split(/\s[-–|]\s/)[0];
  for (const r of YGO_RARITIES) name = name.replace(new RegExp("\\b" + r.replace(/'/g, "'?") + "\\b", "i"), " ");
  name = name.replace(/\b(1st edition|1st ed\.?|unlimited|near mint|nm)\b/gi, " ").replace(/\s+/g, " ").trim();
  return {
    name: name || title,
    code,
    set: m ? m[1] : null,
    rarity,
    version,
    edition,
    lang: m ? YGO_LANG[m[3]] ?? null : null,
  };
}

export const parseTitle = (game: Game, title: string) => (game === "digi" ? parseDigimon(title) : parseYgo(title));
