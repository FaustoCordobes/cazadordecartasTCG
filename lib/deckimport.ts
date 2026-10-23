/**
 * Formatos de listas de Yu-Gi-Oh! que traen códigos numéricos (passcodes) en vez de nombres:
 *  - Archivo .ydk:   #main / #extra / !side y un passcode por línea
 *  - Link YDKE:      ydke://<main base64>!<extra base64>!<side base64>!
 * Los nombres se piden después a YGOPRODeck (/api/ydk).
 */
export interface IdDeck { main: string[]; extra: string[]; side: string[] }

export const isYdk = (text: string) => /^\s*(#created by.*\n)?\s*#main\b/im.test(text) || /^\s*#(main|extra)\s*$/m.test(text);
export const isYdke = (text: string) => /ydke:\/\//i.test(text);

export function parseYdk(text: string): IdDeck {
  const out: IdDeck = { main: [], extra: [], side: [] };
  let part: keyof IdDeck = "main";
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (/^#main/i.test(t)) part = "main";
    else if (/^#extra/i.test(t)) part = "extra";
    else if (/^!side/i.test(t)) part = "side";
    else if (/^\d{1,10}$/.test(t)) out[part].push(String(Number(t)));
  }
  return out;
}

function b64ToIds(b64: string): string[] {
  if (!b64) return [];
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const ids: string[] = [];
  for (let i = 0; i + 3 < bin.length; i += 4) {
    const n = bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8) | (bin.charCodeAt(i + 2) << 16) | (bin.charCodeAt(i + 3) << 24);
    ids.push(String(n >>> 0));
  }
  return ids;
}

export function parseYdke(text: string): IdDeck {
  const m = text.match(/ydke:\/\/([A-Za-z0-9+/=]*)!([A-Za-z0-9+/=]*)!([A-Za-z0-9+/=]*)!?/i);
  if (!m) return { main: [], extra: [], side: [] };
  return { main: b64ToIds(m[1]), extra: b64ToIds(m[2]), side: b64ToIds(m[3]) };
}

/** Convierte passcodes a una decklist de texto ("3 Ash Blossom & Joyous Spring"), con secciones */
export function idDeckToText(deck: IdDeck, names: Record<string, string>, includeSide = false): { text: string; unknown: string[] } {
  const unknown: string[] = [];
  const section = (title: string, ids: string[]) => {
    if (!ids.length) return [];
    const count = new Map<string, number>();
    for (const id of ids) count.set(id, (count.get(id) ?? 0) + 1);
    const lines = [`${title}:`];
    for (const [id, n] of count) {
      const name = names[id];
      if (!name) { unknown.push(id); continue; }
      lines.push(`${n} ${name}`);
    }
    return lines;
  };
  const text = [
    ...section("Main Deck", deck.main),
    ...section("Extra Deck", deck.extra),
    ...(includeSide ? section("Side Deck", deck.side) : []),
  ].join("\n");
  return { text, unknown };
}
