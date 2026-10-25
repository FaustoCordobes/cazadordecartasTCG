import type { Game } from "./types.ts";
import { GAMES } from "./games.ts";

/**
 * Lee una decklist pegada como texto. Acepta la cantidad antes o después del nombre:
 *   4 Angemon BT25-034      4x Angemon      x4 Angemon      -4 Angemon     4 - Angemon
 *   Angemon x4              Angemon 4       Angemon -4      Angemon (4)    Angemon: 4
 * y el código opcional en cualquier lado: "Angemon (BT25-034) x4", "BT25-034 Angemon 4".
 * Ignora comentarios (// o #), encabezados ("Main Deck:", "Digi-Egg", "Extra Deck") y líneas vacías.
 */

export interface DeckEntry {
  qty: number;
  name: string;
  code: string | null;
  /** Magic: código del set ("CMM") si la lista lo trae; sirve para pedir esa impresión */
  set?: string | null;
  /** número de línea (1 = primera) */
  line: number;
  raw: string;
}

export interface DeckError {
  line: number;
  raw: string;
  reason: string;
}

export interface ParsedDeck {
  entries: DeckEntry[];
  errors: DeckError[];
  /** total de copias */
  total: number;
}

export const FORMAT_HINT = "Escribí una carta por línea con la cantidad y el nombre, por ejemplo: 4 Angemon BT25-034  o  Exosister Karmael x2";

/** Ejemplo de línea correcta según el juego */
export const formatHint = (game: Game) => `Escribí una carta por línea con la cantidad y el nombre, por ejemplo: ${GAMES[game].deckHint}`;

const HEADERS = /^(main( deck)?|extra( deck)?|side( deck)?|deck|digi-?eggs?|eggs?|huevos?|tamers?|options?|opciones|monsters?|monstruos?|spells?|m[aá]gicas?|traps?|trampas?|digimon|cartas?|lista|decklist|sideboard|breeding|main deck \(\d+\)|extra deck \(\d+\)|side deck \(\d+\))\s*:?\s*(\(\d+\))?\s*:?$/i;

// Encabezados de Pokémon TCG Live, Magic (Arena/Moxfield) y One Piece: "Pokémon: 12", "Trainer (30)", "Commander"
const HEADERS2 = /^(pok[eé]mon|trainers?|entrenador(es)?|energ(y|ies|[ií]as?)|total cards|commander|comandante|companion|compa[nñ]ero|maybeboard|leaders?|l[ií]der(es)?|characters?|personajes?|events?|eventos?|stages?|escenarios?|lands?|tierras?|creatures?|criaturas?|instants?|sorceries|artifacts?|enchantments?|planeswalkers?)\s*[:(]?\s*\d*\s*\)?\s*:?$/i;

const DIGI_CODE = /\b((?:(?:BT|EX|ST|AD|RB|BO)\d{1,2}|LM\d{0,2}|P)-\d{2,3})\b/i;
const OP_CODE = /\b((?:OP|ST|EB|PRB)\d{2}-\d{3}|P-\d{3})\b/i;
// Magic Arena/Moxfield: "Sol Ring (CMM) 395 *F*" → se guarda el set (para "solo esa impresión")
const MTG_TAIL = /\s*\(([A-Z0-9]{2,6})\)\s*([\w★-]+)?\s*(\*[A-Z]+\*)?\s*$/i;
// Pokémon TCG Live: "Charizard ex OBF 125", "Pikachu PR-SV 27"
const PKM_TAIL = /\s+([A-Z]{2,4}(?:-[A-Z]{2,3})?)\s+([A-Z]{0,3}\d{1,3}[a-z]?)\s*$/;
const YGO_CODE = /\b([A-Z0-9]{3,5}-(?:EN|SP|JP|DE|FR|IT|PT|KR)?[A-Z]?\d{2,3})\b/;

function extractCode(game: Game, text: string): { code: string | null; rest: string; set?: string | null } {
  if (game === "mtg") return { code: null, rest: text.replace(MTG_TAIL, ""), set: text.match(MTG_TAIL)?.[1]?.toUpperCase() ?? null };
  if (game === "pkm") return { code: null, rest: text.replace(PKM_TAIL, "") };
  const re = game === "digi" ? DIGI_CODE : game === "op" ? OP_CODE : YGO_CODE;
  const m = text.match(re);
  if (!m) return { code: null, rest: text };
  let code = m[1].toUpperCase();
  if (game === "digi") code = code.replace(/^([A-Z]+)0(\d)-/, "$1$2-");
  const rest = (text.slice(0, m.index) + " " + text.slice((m.index ?? 0) + m[0].length))
    .replace(/\(\s*\)|\[\s*\]/g, " ");
  return { code, rest };
}

const clean = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—•*·:|,]+|[\s\-–—•*·:|,]+$/g, "")
    .trim();

/** Busca la cantidad al principio o al final de la línea */
function extractQty(text: string): { qty: number | null; rest: string } {
  const t = text.trim();
  // al principio: "4 ", "4x ", "x4 ", "-4 ", "4 - ", "4) ", "4. "
  let m = t.match(/^[-–•*]?\s*[xX×]?\s*(\d{1,2})\s*[xX×]?\s*(?:[-–:.)]\s*|\s+)(.+)$/);
  if (m && /[a-zA-ZÀ-ÿ]/.test(m[2])) return { qty: Number(m[1]), rest: m[2] };
  // al final: " x4", " 4x", " 4", " -4", " (4)", ": 4", " ×4"
  m = t.match(/^(.+?)\s*(?:\(\s*[xX×]?\s*(\d{1,2})\s*[xX×]?\s*\)|[-–:]\s*[xX×]?\s*(\d{1,2})|[xX×]\s*(\d{1,2})|\s(\d{1,2})\s*[xX×]?)\s*$/);
  if (m) {
    const n = m[2] ?? m[3] ?? m[4] ?? m[5];
    if (n && /[a-zA-ZÀ-ÿ]/.test(m[1])) return { qty: Number(n), rest: m[1] };
  }
  return { qty: null, rest: t };
}

export function parseDecklist(text: string, game: Game): ParsedDeck {
  const entries: DeckEntry[] = [];
  const errors: DeckError[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, i) => {
    const line = i + 1;
    let t = raw.replace(/ /g, " ").trim();
    if (!t || t.startsWith("//") || t.startsWith("#") || /^[-=_*]{3,}$/.test(t)) return;
    t = t.replace(/\s+\/\/.*$/, "").trim(); // comentario al final de la línea
    if (HEADERS.test(t) || HEADERS2.test(t)) return;

    // El código puede estar pegado a la cantidad ("BT25-034 x4"): primero se separa el código
    const { code, rest: withoutCode, set } = extractCode(game, t);
    const { qty, rest } = extractQty(clean(withoutCode));
    const name = clean(rest.replace(/[[\]()]/g, " "));

    if (qty === null) {
      errors.push({ line, raw, reason: "No encontramos la cantidad. " + formatHint(game) });
      return;
    }
    if (qty < 1 || qty > 60) {
      errors.push({ line, raw, reason: `La cantidad (${qty}) no parece válida. ` + formatHint(game) });
      return;
    }
    if (!name || !/[a-zA-ZÀ-ÿ]{2,}/.test(name)) {
      errors.push({ line, raw, reason: "No encontramos el nombre de la carta. " + formatHint(game) });
      return;
    }
    entries.push({ qty, name, code, line, raw, ...(set ? { set } : {}) });
  });

  // Une líneas repetidas de la misma carta
  const merged = new Map<string, DeckEntry>();
  for (const e of entries) {
    const k = `${e.name.toLowerCase()}|${e.code ?? ""}`;
    const prev = merged.get(k);
    if (prev) prev.qty += e.qty;
    else merged.set(k, { ...e });
  }
  const list = [...merged.values()];
  return { entries: list, errors, total: list.reduce((s, e) => s + e.qty, 0) };
}
