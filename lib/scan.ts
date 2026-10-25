import type { Game } from "./types.ts";

/**
 * Lectura del código impreso en una carta a partir del texto que saca el OCR de una foto.
 * Es más confiable que reconocer la imagen: el código identifica la versión exacta.
 *   Yu-Gi-Oh!: RA01-EN008 · Digimon: BT20-036 · One Piece: OP01-025 · Pokémon: 125/197
 * Magic no tiene un código único impreso: se propone la primera línea legible (el nombre).
 */

/** El OCR confunde letras y números: en las partes que tienen que ser números, O→0, I/l→1, S→5, B→8 */
const digits = (s: string) => s.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/S/g, "5").replace(/B/g, "8");

export function findCodes(game: Game, raw: string): string[] {
  const text = raw.replace(/[–—]/g, "-").replace(/\s*-\s*/g, "-");
  const out: string[] = [];
  const add = (c: string) => { if (!out.includes(c)) out.push(c); };
  if (game === "digi") {
    for (const m of text.matchAll(/\b(BT|EX|ST|RB|LM|AD|BO)\s?([0-9OIl]{1,2})-([0-9OIlSB]{3})\b/gi)) add(`${m[1].toUpperCase()}${Number(digits(m[2]))}-${digits(m[3])}`);
    for (const m of text.matchAll(/\b(P|LM)-([0-9OIlSB]{3})\b/g)) add(`${m[1]}-${digits(m[2])}`);
  } else if (game === "op") {
    for (const m of text.matchAll(/\b(OP|ST|EB|PRB)([0-9OIl]{2})-([0-9OIlSB]{3})\b/gi)) add(`${m[1].toUpperCase()}${digits(m[2])}-${digits(m[3])}`);
    for (const m of text.matchAll(/\bP-([0-9OIlSB]{3})\b/g)) add(`P-${digits(m[1])}`);
  } else if (game === "ygo") {
    for (const m of text.matchAll(/\b([A-Z0-9]{2,4})-(EN|SP|DE|FR|IT|PT|JP|KR|E|S)?([A-Z]?[0-9OIlSB]{2,3})\b/g)) {
      if (!/[A-Z]/.test(m[1])) continue;
      const num = m[3].replace(/^([A-Z]?)(.*)$/, (_, p, n) => p + digits(n));
      add(`${m[1]}-${m[2] ?? ""}${num}`);
    }
  } else if (game === "pkm") {
    for (const m of text.matchAll(/\b([0-9OIl]{1,3})\s?\/\s?([0-9OIl]{2,3})\b/g)) {
      const a = Number(digits(m[1])), b = Number(digits(m[2]));
      if (a > 0 && b >= 10) add(`${a}/${b}`);
    }
  }
  return out.slice(0, 4);
}

/** Primera línea que parece un nombre (para Magic, o si no se encontró código) */
export function guessName(raw: string): string | null {
  for (const line of raw.split(/\n/)) {
    const l = line.replace(/[^A-Za-zÀ-ÿ' ,-]/g, " ").replace(/\s+/g, " ").trim();
    if (l.length >= 4 && /[A-Za-z]{3}/.test(l) && l.split(" ").length <= 6) return l;
  }
  return null;
}
