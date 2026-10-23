import type { Game } from "./types.ts";
import { getJSON, HttpError } from "./http.ts";
import { TTLCache } from "./cache.ts";
import { norm } from "./parse.ts";

/**
 * Sugerencias de nombres mientras el usuario escribe.
 * Digimon: digimoncard.io · Yu-Gi-Oh!: YGOPRODeck (nombres en inglés y en español).
 */
export interface Suggestion {
  name: string;
  /** nombre en otro idioma, si la sugerencia vino del español */
  alt?: string;
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
  if (term.length < 3) return [];
  const key = `${game}:${norm(term)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let out: Suggestion[] = [];
  if (game === "digi") {
    const cards = await safe(
      getJSON<{ name: string }[] | { error: string }>(`https://digimoncard.io/api-public/search.php?n=${encodeURIComponent(term)}`, 5000),
      []
    );
    out = Array.isArray(cards) ? cards.map((c) => ({ name: c.name })) : [];
  } else {
    const [en, es] = await Promise.all([
      safe(getJSON<{ data: { name: string }[] }>(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(term)}`, 5000), { data: [] }),
      safe(getJSON<{ data: { name: string; name_en?: string }[] }>(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(term)}&language=es`, 5000), { data: [] }),
    ]);
    out = [
      ...(en.data ?? []).map((c) => ({ name: c.name })),
      ...(es.data ?? []).map((c) => ({ name: c.name, alt: c.name_en })),
    ];
  }
  const ranked = rank(out, term);
  cache.set(key, ranked);
  return ranked;
}
