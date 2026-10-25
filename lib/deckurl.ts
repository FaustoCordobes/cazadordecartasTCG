import type { Game } from "./types.ts";

/**
 * Importar un mazo pegando su link (como los botones "Comprar" de Mana Pool en Archidekt o Moxfield).
 *
 * Solo se leen sitios que publican el mazo para exportarlo (una API pública o un "descargar como texto"),
 * siempre respetando su robots.txt. Para los que no lo permiten se explica cómo exportarlo como texto.
 */
export interface DeckSource {
  id: string;
  name: string;
  game: Game;
  /** URL del mazo para exportar (JSON o texto), o null si hay que exportarlo a mano */
  fetchUrl: string | null;
  kind: "archidekt" | "text" | "manual";
  /** cómo exportarlo a mano, si no se puede leer solo */
  howTo?: string;
}

const EXPORT_TEXT = "Abrí el mazo, buscá Exportar / Export → “Texto” o “Copiar lista” y pegala acá.";

export function deckSource(raw: string): DeckSource | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "archidekt.com") {
    const id = u.pathname.match(/\/decks\/(\d+)/)?.[1];
    return id ? { id: "archidekt", name: "Archidekt", game: "mtg", kind: "archidekt", fetchUrl: `https://archidekt.com/api/decks/${id}/` } : null;
  }
  if (host === "tappedout.net") {
    const slug = u.pathname.match(/\/mtg-decks\/([\w-]+)/)?.[1];
    return slug ? { id: "tappedout", name: "TappedOut", game: "mtg", kind: "text", fetchUrl: `https://tappedout.net/mtg-decks/${slug}/?fmt=txt` } : null;
  }
  if (host === "mtggoldfish.com") {
    const id = u.pathname.match(/\/deck\/(?:download\/)?(\d+)/)?.[1];
    return id ? { id: "mtggoldfish", name: "MTGGoldfish", game: "mtg", kind: "text", fetchUrl: `https://www.mtggoldfish.com/deck/download/${id}` } : null;
  }
  // Sitios cuyo contenido no se lee automáticamente: se explica cómo exportar
  const manual: Record<string, [string, Game, string]> = {
    "moxfield.com": ["Moxfield", "mtg", "En Moxfield: More → Export → “Copy for MTGA” y pegalo acá."],
    "ygoprodeck.com": ["YGOPRODeck", "ygo", "En YGOPRODeck: “Download YDK” y subí el archivo con “Subir archivo”, o copiá el link ydke://."],
    "limitlesstcg.com": ["Limitless", "pkm", "En Limitless: “Export” → copiá la lista (formato PTCGL) y pegala acá."],
    "digimoncard.io": ["DigimonCard.io", "digi", EXPORT_TEXT],
    "digimoncard.dev": ["DigimonCard.dev", "digi", EXPORT_TEXT],
    "onepiecetopdecks.com": ["One Piece Top Decks", "op", EXPORT_TEXT],
    "egmanevents.com": ["Egman Events", "op", EXPORT_TEXT],
  };
  const m = manual[host];
  if (m) return { id: host, name: m[0], game: m[1], kind: "manual", fetchUrl: null, howTo: m[2] };
  return { id: host, name: host, game: "mtg", kind: "manual", fetchUrl: null, howTo: `No sabemos leer mazos de ${host}. ${EXPORT_TEXT}` };
}

/** ¿El texto pegado es solo un link? */
export const isDeckUrl = (t: string) => /^https?:\/\/\S+$/i.test(t.trim());

interface ArchidektCard {
  quantity?: number;
  categories?: string[] | null;
  card?: { oracleCard?: { name?: string }; name?: string; edition?: { editioncode?: string } };
}

/** Archidekt (JSON) → texto "4 Lightning Bolt (2X2)"; sin Maybeboard ni Sideboard */
export function archidektToText(data: { name?: string; cards?: ArchidektCard[] }): string {
  const lines: string[] = [];
  for (const c of data.cards ?? []) {
    const cats = (c.categories ?? []).map((x) => x.toLowerCase());
    if (cats.some((x) => x === "maybeboard" || x === "sideboard")) continue;
    const name = c.card?.oracleCard?.name ?? c.card?.name;
    if (!name || !c.quantity) continue;
    const set = c.card?.edition?.editioncode;
    lines.push(`${c.quantity} ${name}${set ? ` (${set.toUpperCase()})` : ""}`);
  }
  return lines.join("\n");
}

/** Lista en texto (TappedOut, MTGGoldfish): se queda con el mazo principal (hasta "Sideboard" o la primera línea vacía) */
export function mainDeckText(txt: string): string {
  const out: string[] = [];
  let started = false;
  for (const raw of txt.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l) { if (started) break; continue; }
    if (/^(sideboard|maybeboard|sb:)/i.test(l)) break;
    started = true;
    out.push(l);
  }
  return out.join("\n");
}
