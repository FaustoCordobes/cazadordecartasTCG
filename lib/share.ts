import type { Game } from "./types.ts";
import type { DeckEntry } from "./decklist.ts";

/**
 * Links para compartir una búsqueda o un listado de cartas.
 *   /?juego=digi&carta=kimeramon
 *   /?juego=digi&listado=4%20Angemon%20BT25-034%0A...
 */

export interface SharedParams {
  game: Game | null;
  card: string | null;
  deck: string | null;
}

const GAME_PARAM: Record<Game, string> = { ygo: "yugioh", digi: "digimon" };

function gameFrom(v: string | null): Game | null {
  const s = (v ?? "").toLowerCase();
  if (["ygo", "yugioh", "yu-gi-oh"].includes(s)) return "ygo";
  if (["digi", "digimon"].includes(s)) return "digi";
  return null;
}

export function readParams(search: string): SharedParams {
  const p = new URLSearchParams(search);
  const clip = (v: string | null, n: number) => (v && v.trim() ? v.trim().slice(0, n) : null);
  return { game: gameFrom(p.get("juego")), card: clip(p.get("carta"), 60), deck: clip(p.get("listado"), 6000) };
}

export function cardUrl(origin: string, game: Game, card: string) {
  return `${origin}/?juego=${GAME_PARAM[game]}&carta=${encodeURIComponent(card.trim())}`;
}

/** El listado va normalizado ("4 Angemon BT25-034") para que el link sea lo más corto posible */
export function deckText(entries: Pick<DeckEntry, "qty" | "name" | "code">[]) {
  return entries.map((e) => `${e.qty} ${e.name}${e.code ? " " + e.code : ""}`).join("\n");
}

export function deckUrl(origin: string, game: Game, entries: Pick<DeckEntry, "qty" | "name" | "code">[]) {
  return `${origin}/?juego=${GAME_PARAM[game]}&listado=${encodeURIComponent(deckText(entries))}`;
}
