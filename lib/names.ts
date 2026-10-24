import type { Game } from "./types.ts";
import { YGO_NOMBRES } from "./data/ygo-nombres.ts";
import { getJSON } from "./http.ts";
import { TTLCache } from "./cache.ts";
import { norm } from "./parse.ts";

/**
 * Nombres de cartas en español e inglés.
 *
 * Las tiendas argentinas publican a veces con el nombre en inglés ("Ash Blossom & Joyous Spring")
 * y a veces en español ("Flor de Ceniza & Primavera Feliz"), según la impresión que tengan.
 * Para no perder publicaciones, cada búsqueda se hace con los dos nombres cuando son distintos.
 *
 * Fuentes: Yu-Gi-Oh! → tabla local generada de YGOJSON (nombres oficiales de Konami);
 * Magic → Scryfall (nombres impresos en español); Pokémon → TCGdex (español de España y de Latinoamérica).
 * Digimon y One Piece no tienen impresión en español: no se traducen.
 */
export interface NamePair {
  en: string;
  es: string;
  /** en qué idioma lo escribió el usuario */
  typed: "en" | "es";
}

/** Clave para comparar nombres: sin tildes, sin signos, minúsculas */
export const nameKey = (s: string | null | undefined) => norm(s).replace(/[^a-z0-9]+/g, " ").trim();

const cache = new TTLCache<NamePair | null>(24 * 60 * 60 * 1000, 3000);

export async function translateName(game: Game, q: string): Promise<NamePair | null> {
  const k = nameKey(q);
  if (k.length < 2 || (game !== "ygo" && game !== "mtg" && game !== "pkm")) return null;
  const ck = `${game}:${k}`;
  const hit = cache.get(ck);
  if (hit !== undefined) return hit;
  let res: NamePair | null | undefined = null;
  try {
    // Como mucho 4 segundos: si la base de nombres tarda, se busca igual con lo que escribió el usuario
    res = game === "ygo" ? ygoPair(q) : await withTimeout(game === "mtg" ? mtgPair(q) : pkmPair(q), 4000);
  } catch {
    res = null;
  }
  if (res === undefined) return null; // se pasó del tiempo: no se guarda, la próxima vez se reintenta
  if (res && nameKey(res.en) === nameKey(res.es)) res = null;
  cache.set(ck, res);
  return res;
}

/** La promesa, o undefined si tarda más de ms */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<undefined>((r) => { timer = setTimeout(() => r(undefined), ms); })]).finally(() => clearTimeout(timer));
}

// ---------- Yu-Gi-Oh! (tabla local) ----------
interface YgoTable {
  pairs: { en: string; es: string; ken: string; kes: string }[];
  byEn: Map<string, number>;
  byEs: Map<string, number>;
}
let ygoTable: YgoTable | null = null;

function ygo(): YgoTable {
  if (ygoTable) return ygoTable;
  const pairs = YGO_NOMBRES.split("\n").map((line) => {
    const [en, es] = line.split("\t");
    return { en, es, ken: nameKey(en), kes: nameKey(es) };
  });
  const byEn = new Map<string, number>();
  const byEs = new Map<string, number>();
  pairs.forEach((p, i) => {
    if (!byEn.has(p.ken)) byEn.set(p.ken, i);
    if (!byEs.has(p.kes)) byEs.set(p.kes, i);
  });
  ygoTable = { pairs, byEn, byEs };
  return ygoTable;
}

export function ygoPair(q: string): NamePair | null {
  const t = ygo();
  const k = nameKey(q);
  const en = t.byEn.get(k);
  if (en !== undefined) return { en: t.pairs[en].en, es: t.pairs[en].es, typed: "en" };
  const es = t.byEs.get(k);
  if (es !== undefined) return { en: t.pairs[es].en, es: t.pairs[es].es, typed: "es" };
  // Nombre en español incompleto ("flor de ceniza"): solo si no es el comienzo de un nombre en inglés
  // ("gaia" o "blue eyes" siguen buscando todas las cartas con esas palabras).
  if (k.length < 4 || t.pairs.some((p) => p.ken.startsWith(k))) return null;
  let best: YgoTable["pairs"][number] | null = null;
  for (const p of t.pairs) if (p.kes.startsWith(k) && (!best || p.kes.length < best.kes.length)) best = p;
  return best ? { en: best.en, es: best.es, typed: "es" } : null;
}

/** Sugerencias en español para el autocompletado (con el nombre en inglés al lado) */
export function ygoSpanishSuggestions(q: string, limit = 10): { name: string; alt: string }[] {
  const words = nameKey(q).split(" ").filter(Boolean);
  if (!words.length) return [];
  const out: { name: string; alt: string; score: number }[] = [];
  for (const p of ygo().pairs) {
    if (!words.every((w) => p.kes.includes(w))) continue;
    out.push({ name: p.es, alt: p.en, score: (p.kes.startsWith(words.join(" ")) ? 0 : 1000) + p.kes.length });
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit).map(({ name, alt }) => ({ name, alt }));
}

// ---------- Magic (Scryfall) ----------
interface ScryPrint { name: string; printed_name?: string; lang?: string }

async function mtgPair(q: string): Promise<NamePair | null> {
  const k = nameKey(q);
  q = q.replace(/["\\]/g, " ").trim();
  const search = (query: string) =>
    getJSON<{ data: ScryPrint[] }>(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&include_multilingual=true&unique=cards`, 5000
    ).then((d) => d.data ?? []).catch(() => [] as ScryPrint[]);
  // ¿Es el nombre exacto en inglés? → se busca cómo se imprimió en español
  const [asEnglish, asSpanish] = await Promise.all([search(`!"${q}" lang:es`), search(`lang:es "${q}"`)]);
  const en = asEnglish.find((c) => c.printed_name && nameKey(c.name.split(" // ")[0]) === k);
  if (en) return { en: en.name.split(" // ")[0], es: en.printed_name!.split(" // ")[0], typed: "en" };
  // ¿Es un nombre en español? ("Rayo", "Contrahechizo")
  const exact = asSpanish.find((c) => nameKey(c.printed_name) === k) ?? asSpanish.find((c) => nameKey(c.printed_name).startsWith(k));
  if (exact?.printed_name) return { en: exact.name.split(" // ")[0], es: exact.printed_name.split(" // ")[0], typed: "es" };
  return null;
}

// ---------- Pokémon (TCGdex) ----------
interface DexBrief { id: string; name: string; image?: string }
const DEX = "https://api.tcgdex.net/v2";

const dexList = (lang: string, q: string) =>
  getJSON<DexBrief[]>(`${DEX}/${lang}/cards?name=${encodeURIComponent("like:" + q)}&pagination:page=1&pagination:itemsPerPage=100`, 5000)
    .then((d) => (Array.isArray(d) ? d : []))
    .catch(() => [] as DexBrief[]);

/** Nombre de la misma carta (mismo id) en otro idioma */
async function dexNameIn(lang: string, ids: string[]): Promise<string | null> {
  for (const id of ids.slice(0, 3)) {
    const c = await getJSON<{ name?: string }>(`${DEX}/${lang}/cards/${encodeURIComponent(id)}`, 5000).catch(() => null);
    if (c?.name) return c.name;
  }
  return null;
}

async function pkmPair(q: string): Promise<NamePair | null> {
  const k = nameKey(q);
  const [en, es, mx] = await Promise.all([dexList("en", q), dexList("es", q), dexList("es-mx", q)]);
  const enHits = en.filter((c) => nameKey(c.name) === k);
  if (enHits.length) {
    const esName = await dexNameIn("es", enHits.map((c) => c.id)) ?? await dexNameIn("es-mx", enHits.map((c) => c.id));
    return esName ? { en: enHits[0].name, es: esName, typed: "en" } : null;
  }
  // En español: exacto, o el más corto que empiece así (si no es el comienzo de un nombre en inglés)
  const esAll = [...es, ...mx];
  let hits = esAll.filter((c) => nameKey(c.name) === k);
  if (!hits.length && !en.some((c) => nameKey(c.name).startsWith(k))) {
    const pref = esAll.filter((c) => nameKey(c.name).startsWith(k)).sort((a, b) => a.name.length - b.name.length);
    if (pref.length) hits = pref.filter((c) => nameKey(c.name) === nameKey(pref[0].name));
  }
  if (!hits.length) return null;
  const enName = await dexNameIn("en", hits.map((c) => c.id));
  return enName ? { en: enName, es: hits[0].name, typed: "es" } : null;
}

/** Sugerencias de Pokémon en español (TCGdex), con imagen chica */
export async function pkmSpanishSuggestions(q: string): Promise<{ name: string; image?: string }[]> {
  const [es, mx] = await Promise.all([dexList("es", q), dexList("es-mx", q)]);
  return [...es, ...mx].map((c) => ({ name: c.name, image: c.image ? `${c.image}/low.webp` : undefined }));
}

/**
 * ¿Esta publicación está escrita con el nombre en español? Se reconoce porque el nombre leído
 * del título es el nombre en español, o el título empieza con él.
 */
export function isSpanishTitle(pair: NamePair, parsedName: string, title: string): boolean {
  const kes = nameKey(pair.es);
  if (!kes || nameKey(pair.en) === kes) return false;
  const n = nameKey(parsedName);
  const t = nameKey(title);
  return n === kes || t === kes || t.startsWith(kes + " ");
}
