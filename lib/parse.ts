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
  /** NM, LP, MP, HP, DMG */
  condition?: string | null;
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

// ---------- Comunes a Magic, Pokémon y One Piece ----------
const LANGS: [RegExp, string][] = [
  [/\b(espa[nñ]ol|spanish|castellano|\(esp?\)|\[esp?\]|- es\b|\bes\s*$)/i, "Español"],
  [/\b(japon[eé]s|japanese|\bjp\b|\bjap\b|\(jp\)|\[jp\])/i, "Japonés"],
  [/\b(ingl[eé]s|english|\(en\)|\[en\]|- en\b)/i, "Inglés"],
  [/\b(portugu[eé]s|portuguese)\b/i, "Portugués"],
  [/\b(italiano|italian)\b/i, "Italiano"],
  [/\b(franc[eé]s|french)\b/i, "Francés"],
  [/\b(alem[aá]n|german)\b/i, "Alemán"],
  [/\b(chino|chinese)\b/i, "Chino"],
  [/\b(coreano|korean)\b/i, "Coreano"],
];
export function detectLang(text: string): string | null {
  for (const [re, l] of LANGS) if (re.test(text)) return l;
  return null;
}

export function detectCondition(text: string): string | null {
  if (/\b(near mint|nm|mint|nueva|nuevo)\b/i.test(text)) return "NM";
  if (/\b(lightly played|lp|excellent|ex\b(?!\s*-))/i.test(text) && !/\bex\b/i.test(text)) return "LP";
  if (/\b(moderately played|mp|played)\b/i.test(text)) return "MP";
  if (/\b(heavily played|hp)\b/i.test(text)) return "HP";
  if (/\b(damaged|dmg|da[nñ]ada)\b/i.test(text)) return "DMG";
  return null;
}

/** Saca del título lo que no es el nombre: [Set], (Set), " - resto", "#123" */
function baseName(title: string) {
  return title
    .split(/\s[-–|—]\s|\s\[|\s\(|\s#|:\s(?=[A-Z][a-z]+\s(?:Commander|Edition|Set|Collection))/)[0]
    .replace(/\b(mtg|magic the gathering|pok[eé]mon tcg|one piece( tcg| card game)?|single|carta suelta)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Magic ----------
const MTG_RARITY: Record<string, string> = {
  common: "Común", comun: "Común", c: "Común",
  uncommon: "Infrecuente", infrecuente: "Infrecuente", u: "Infrecuente",
  rare: "Rara", rara: "Rara", r: "Rara",
  mythic: "Mítica", "mythic rare": "Mítica", mitica: "Mítica", m: "Mítica",
  special: "Especial", bonus: "Especial", especial: "Especial",
};
export const mtgRarity = (r: string | null | undefined) => (r ? MTG_RARITY[norm(r).trim()] ?? null : null);

export function parseMagic(title: string): Parsed {
  const setCode = title.match(/[[(]([A-Z0-9]{3,5})[\])]/)?.[1] ?? null;
  const number = title.match(/#\s?(\d{1,4}[a-z★]?)\b/i)?.[1] ?? null;
  const finish = /\betched\b/i.test(title) ? "Etched" : /\b(foil|surge|raised|oilslick|galaxy|textured)\b/i.test(title) && !/non-?foil/i.test(title) ? "Foil" : "Normal";
  const r = title.match(/\b(mythic|common|uncommon|rare|m[ií]tica|com[uú]n|infrecuente|rara)\b/i)?.[1];
  return {
    name: baseName(title) || title,
    code: setCode && number ? `${setCode}-${number}` : null,
    set: setCode,
    rarity: mtgRarity(r),
    version: finish,
    edition: null,
    lang: detectLang(title),
    condition: detectCondition(title),
  };
}

// ---------- Pokémon ----------
const PKM_NUMBER = /\b([A-Z]{0,4}\d{1,3}[a-z]?)\s*\/\s*([A-Z]{0,4}\d{1,3})\b/;
const PKM_PROMO = /\b((?:SWSH|SVP|SV|SM|XY|BW|HGSS|DP|MEP)\s?\d{2,3})\b/;
const PKM_RARITIES = [
  "Special Illustration Rare", "Illustration Rare", "Hyper Rare", "Ultra Rare", "Double Rare", "Secret Rare", "ACE SPEC Rare",
  "Shiny Ultra Rare", "Shiny Rare", "Rare Holo VMAX", "Rare Holo VSTAR", "Rare Holo V", "Rare Holo EX", "Rare Holo GX", "Rare Holo",
  "Holo Rare", "Rare", "Uncommon", "Common", "Promo",
];
export function pkmRarity(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = norm(text);
  if (/\bsir\b/.test(t)) return "Special Illustration Rare";
  if (/\bir\b/.test(t)) return "Illustration Rare";
  const map: Record<string, string> = { comun: "Common", "poco comun": "Uncommon", infrecuente: "Uncommon", rara: "Rare", "holo rare": "Rare Holo" };
  for (const [k, v] of Object.entries(map)) if (t.includes(k)) return v;
  const hit = PKM_RARITIES.find((r) => t.includes(norm(r)));
  return hit === "Holo Rare" ? "Rare Holo" : hit ?? null;
}

export function parsePokemon(title: string): Parsed {
  const m = title.match(PKM_NUMBER);
  const promo = m ? null : title.match(PKM_PROMO)?.[1]?.replace(/\s/, "") ?? null;
  const code = m ? `${m[1].replace(/^0+(?=\d)/, "")}/${m[2].replace(/^0+(?=\d)/, "")}` : promo;
  const set = title.match(/\[([^\]]+)\]/)?.[1] ?? title.match(/\(([A-Z][A-Z0-9]{1,5})\)/)?.[1] ?? null;
  const version = /reverse/i.test(title) ? "Reverse Holo" : /\b(holo|holofoil|foil)\b/i.test(title) ? "Holo" : /1st edition|primera edici/i.test(title) ? "1st Edition" : "Normal";
  let name = baseName(title.replace(/\(\d{1,3}\)/, " "));
  if (m) name = name.split(m[0])[0].trim() || name;
  return {
    name: name.replace(/\s+\d{1,3}\s*$/, "") || title,
    code,
    set,
    rarity: pkmRarity(title),
    version,
    edition: null,
    lang: detectLang(title),
    condition: detectCondition(title),
  };
}

// ---------- One Piece ----------
const OP_CODE = /\b((?:OP|ST|EB|PRB)\d{2}-\d{3}|P-\d{3})(?:[-\s]?(SEC|SR|UC|SP|TR|L|C|R|P)\b)?/i;
const OP_RARITY = /\b(SEC|SR|UC|SP|TR|L|C|R)\b/;
export function parseOnePiece(title: string): Parsed {
  const m = title.match(OP_CODE);
  const code = m ? m[1].toUpperCase() : null;
  const tail = m ? title.slice(m.index ?? 0) : title;
  const rarity = (m?.[2] ?? tail.match(OP_RARITY)?.[1] ?? title.match(/\b(Secret Rare|Super Rare|Uncommon|Leader|Rare|Common)\b/i)?.[1] ?? null);
  const R: Record<string, string> = { "secret rare": "SEC", "super rare": "SR", uncommon: "UC", leader: "L", rare: "R", common: "C" };
  const version = /manga/i.test(title) ? "Manga" : /parallel|alter|alternate art|arte alternativ|\bAA\b/i.test(title) ? "Parallel" : /\bSP\b|special card/i.test(title) ? "SP" : /gold|pirate foil|foil/i.test(title) ? "Foil" : "Normal";
  let name = m ? title.slice(0, m.index).trim() : title;
  name = baseName(name.replace(/^one piece( tcg| card game)?\s*[-:]?\s*/i, "")).replace(/\s*\(\d{3}\)\s*$/, "").replace(/[-–(\[]+\s*$/, "").trim();
  return {
    name: name || baseName(title) || title,
    code,
    set: code ? code.split("-")[0] : title.match(/\[([^\]]+)\]/)?.[1] ?? null,
    rarity: rarity ? R[rarity.toLowerCase()] ?? rarity.toUpperCase() : null,
    version,
    edition: null,
    lang: detectLang(title),
    condition: detectCondition(title),
  };
}

export function parseTitle(game: Game, title: string): Parsed {
  switch (game) {
    case "digi": return parseDigimon(title);
    case "ygo": return parseYgo(title);
    case "mtg": return parseMagic(title);
    case "pkm": return parsePokemon(title);
    case "op": return parseOnePiece(title);
  }
}
