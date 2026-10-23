import type { Game } from "./types.ts";
import { getJSON, HttpError } from "./http.ts";
import { TTLCache } from "./cache.ts";
import { norm } from "./parse.ts";
import { digiImage, opCleanName } from "./cardinfo.ts";

/**
 * Sugerencias de nombres mientras el usuario escribe.
 * Digimon: digimoncard.io · Yu-Gi-Oh!: YGOPRODeck · Magic: Scryfall · Pokémon: pokemontcg.io · One Piece: optcgapi.com
 */
export interface Suggestion {
  name: string;
  /** nombre en otro idioma, si la sugerencia vino del español */
  alt?: string;
  /** imagen chica de la carta, si la base la tiene */
  image?: string;
}

const cache = new TTLCache<Suggestion[]>(6 * 60 * 60 * 1000, 2000);

/** Ordena: primero los que empiezan con lo escrito, después los que lo contienen; más cortos primero */
export function rank(names: Suggestion[], q: string, limit = 8): Suggestion[] {
  const nq = norm(q);
  const seen = new Set<string>();
  const unique = names.filter((s) => {
    const k = norm(s.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const score = (s: Suggestion) => {
    const n = norm(s.name);
    return (n.startsWith(nq) ? 0 : n.split(/[^a-z0-9]+/).some((w) => w.startsWith(nq)) ? 1 : 2) * 1000 + n.length;
  };
  return unique.sort((a, b) => score(a) - score(b)).slice(0, limit);
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof HttpError) return fallback; // 400 = sin resultados
    throw e;
  }
}

export async function suggest(game: Game, q: string): Promise<Suggestion[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const key = `${game}:${norm(term)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let out: Suggestion[] = [];
  if (game === "mtg") {
    const [auto, es] = await Promise.all([
      safe(getJSON<{ data: string[] }>(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(term)}`, 5000), { data: [] }),
      safe(getJSON<{ data: { name: string; printed_name?: string }[] }>(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`lang:es "${term}"`)}&include_multilingual=true&unique=cards`, 5000), { data: [] }),
    ]);
    out = [
      ...(auto.data ?? []).filter((n) => !n.includes(" // ") || !auto.data.includes(n.split(" // ")[0])).map((name) => ({ name })),
      ...(es.data ?? []).filter((c) => c.printed_name).slice(0, 10).map((c) => ({ name: c.printed_name!, alt: c.name })),
    ];
  } else if (game === "pkm") {
    const q = term.replace(/["*:]/g, " ").split(/\s+/).filter(Boolean).map((w) => `name:"${w}*"`).join(" ");
    const data = await safe(
      getJSON<{ data: { name: string; images?: { small?: string } }[] }>(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=60&select=name,images`, 6000),
      { data: [] }
    ).catch(() => ({ data: [] }));
    out = (data.data ?? []).map((c) => ({ name: c.name, image: (c as { images?: { small?: string } }).images?.small }));
  } else if (game === "op") {
    const lists = await Promise.all(
      ["sets", "decks"].map((k) =>
        safe(getJSON<{ card_name: string; card_image?: string }[]>(`https://optcgapi.com/api/${k}/filtered/?card_name=${encodeURIComponent(term)}`, 6000), []).catch(() => [])
      )
    );
    out = lists.flat().filter((c) => c && typeof c.card_name === "string").map((c) => ({ name: opCleanName(c.card_name), image: c.card_image ?? undefined }));
  } else if (game === "digi") {
    const cards = await safe(
      getJSON<{ name: string; id?: string }[] | { error: string }>(`https://digimoncard.io/api-public/search.php?n=${encodeURIComponent(term)}`, 5000),
      []
    );
    out = Array.isArray(cards) ? cards.map((c) => ({ name: c.name, image: c.id ? digiImage(c.id) : undefined })) : [];
  } else {
    const [en, es] = await Promise.all([
      safe(getJSON<{ data: { name: string; card_images?: { image_url_small?: string }[] }[] }>(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(term)}`, 5000), { data: [] }),
      safe(getJSON<{ data: { name: string; name_en?: string }[] }>(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(term)}&language=es`, 5000), { data: [] }),
    ]);
    out = [
      ...(en.data ?? []).map((c) => ({ name: c.name, image: c.card_images?.[0]?.image_url_small })),
      ...(es.data ?? []).map((c) => ({ name: c.name, alt: c.name_en })),
    ];
  }
  const ranked = rank(out, term);
  cache.set(key, ranked);
  return ranked;
}
