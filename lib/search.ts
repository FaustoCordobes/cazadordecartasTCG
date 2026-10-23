import type { CardGroup, CardInfo, Game, Listing, MissingVersion, RawListing, SearchResponse, StoreConfig, StoreStatus } from "./types.ts";
import { STORES } from "./stores.ts";
import { LIVE_ADAPTERS } from "./adapters/index.ts";
import { robotsAllows } from "./robots.ts";
import { digiImage, lookupInfo, mtgEnglishName, mtgFuzzyName, ygoEnglishName, type InfoIndex } from "./cardinfo.ts";
import { suggest } from "./suggest.ts";
import { SEALED } from "./games.ts";
import { matchesQuery, mtgRarity, norm, parseTitle, pkmRarity } from "./parse.ts";
import { TTLCache } from "./cache.ts";
import { detectPlatform, modeFor } from "./detect.ts";
import { catalog } from "./catalog.ts";

const searchCache = new TTLCache<SearchResponse>(10 * 60 * 1000);

/** ¿Lo que escribió el usuario es un código de carta? (BT2-077, RA01-EN008) */
export const looksLikeCode = (q: string) => /^[a-z0-9]{1,5}-[a-z0-9]{2,6}$/i.test(q.trim()) || /^[a-z]{0,4}\d{1,3}\/[a-z]{0,4}\d{1,3}$/i.test(q.trim());

export const queryWords = (q: string) =>
  norm(q).replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length >= 2);

const DIGI_RARITY: Record<string, string> = {
  common: "C", uncommon: "U", rare: "R", "super rare": "SR", "secret rare": "SEC", promo: "P",
};

function attachInfo(game: Game, l: Listing, idx: InfoIndex): CardInfo | null {
  if (l.code) {
    const byCode = idx.byCode.get(l.code.toUpperCase());
    if (byCode) return byCode;
  }
  // Por nombre solo cuando coincide exacto: en Digimon cada impresión puede tener
  // otro color, así que sin código no se inventan datos.
  const byName = idx.byName.get(norm(l.parsedName));
  if (!byName) return null;
  if (game === "digi") return { name: byName.name, tipo: byName.tipo, forma: byName.forma };
  return byName;
}

/** Si el título empieza con un nombre oficial conocido, se usa ese (el más largo) */
function officialName(title: string, idx: InfoIndex | null): string | null {
  if (!idx) return null;
  const t = norm(title).replace(/[^a-z0-9]+/g, " ").trim();
  let best: string | null = null;
  for (const [k, info] of idx.byName) {
    const n = k.replace(/[^a-z0-9]+/g, " ").trim();
    if (n.length >= 3 && (t === n || t.startsWith(n + " ")) && (!best || n.length > norm(best).length)) best = info.name;
  }
  return best;
}

/** Rareza escrita como la usa cada juego */
function normRarity(game: Game, r: string | null | undefined): string | null {
  if (!r) return null;
  if (game === "digi") return DIGI_RARITY[norm(r)] ?? r;
  if (game === "mtg") return mtgRarity(r) ?? r;
  if (game === "pkm") return pkmRarity(r) ?? r;
  if (game === "op") {
    const m: Record<string, string> = { "secret rare": "SEC", "super rare": "SR", uncommon: "UC", leader: "L", rare: "R", common: "C", "poco comun": "UC", comun: "C", rara: "R", "super rara": "SR", secreta: "SEC", lider: "L" };
    const v = m[norm(r)] ?? r.toUpperCase();
    return /^(C|UC|R|SR|SEC|L|SP|TR|P)$/.test(v) ? v : v === "PROMO" ? "P" : null;
  }
  return r;
}

/** Convierte lo que devolvió una tienda en publicaciones de cartas sueltas */
export function toListings(game: Game, store: StoreConfig, platform: Listing["platform"], mode: Listing["mode"], raw: RawListing[], idx: InfoIndex | null = null): Listing[] {
  const out: Listing[] = [];
  for (const r0 of raw) {
    // Las tiendas indexadas se leen por la categoría de cada juego
    const r = mode === "index" && r0.gameHint == null ? { ...r0, gameHint: game } : r0;
    // Si la tienda dice que es de otro juego, o que no es una carta suelta, se descarta
    if (r.gameHint && r.gameHint !== game) continue;
    if (r.isSingle === false) continue;
    const p = parseTitle(game, r.title);
    // Sin código ni confirmación de la tienda, suele ser un sobre, un mazo o una inscripción a torneo.
    // Con la categoría o el tipo de la tienda alcanza, salvo que el título sea de un producto sellado.
    const confirmed = !!r.name || r.isSingle === true || (r.gameHint === game && !SEALED.test(r.title));
    if (!p.code && !confirmed) continue;
    if (game === "ygo" || game === "digi") {
      if (!p.code && !r.name && r.isSingle !== true) continue;
    }
    let rarity = normRarity(game, r.rarity ?? p.rarity);
    if (game === "digi" && !p.rarity && !r.rarity) {
      const m = r.title.match(/#\s*(super rare|secret rare|uncommon|common|rare|promo)\b/i);
      if (m) rarity = DIGI_RARITY[m[1].toLowerCase()];
    }
    out.push({
      ...r,
      storeId: store.id,
      storeName: store.name,
      storeDomain: store.domain,
      storeCity: store.city,
      hasLocal: store.hasLocal,
      platform,
      mode,
      cashPrice: store.cashDiscount ? Math.round(r.price * (1 - store.cashDiscount.percent / 100)) : null,
      cashLabel: store.cashDiscount?.label ?? null,
      parsedName: r.name ?? officialName(r.title, idx) ?? p.name,
      code: p.code,
      set: p.set ?? r.setName ?? null,
      rarity: rarity ?? null,
      version: (game === "mtg" || game === "pkm") && r.finish && p.version === "Normal" ? r.finish : p.version,
      edition: p.edition,
      lang: r.lang ?? p.lang ?? (game === "digi" ? "Inglés" : null),
      condition: r.condition ?? p.condition ?? null,
    });
  }
  return out;
}

/** Idioma que separa versiones: solo cuando la tienda lo dice y no es inglés (inglés y "sin dato" van juntos) */
const langKey = (lang: string | null | undefined) => (lang && lang !== "Inglés" ? lang : "");

/**
 * Agrupa por VERSIÓN: cada impresión (código + rareza + variante + idioma) es una tarjeta aparte, así
 * Kimeramon BT19-070, BT8-084 y EX9-074 Alter aparecen por separado y una carta en japonés no se compara
 * con una en inglés. La condición (NM/LP...) se muestra por publicación y se avisa si se mezclan.
 */
export function groupListings(game: Game, listings: Listing[], idx: InfoIndex, query: string, q = query): CardGroup[] {
  const groups = new Map<string, CardGroup>();
  const wanted = norm(query).replace(/[^a-z0-9]+/g, " ").trim();
  const wantedQ = norm(q).replace(/[^a-z0-9]+/g, " ").trim();
  for (const l of listings) {
    const info = attachInfo(game, l, idx);
    const name = info?.name ?? l.parsedName;
    const rarity = l.rarity ?? info?.rarity ?? null;
    const variant = game === "ygo" ? l.version : l.version && l.version !== "Normal" ? l.version : null;
    const lk = game === "ygo" ? "" : langKey(l.lang);
    // Magic: la misma carta en distintas tiendas casi nunca trae código igual; se agrupa por nombre, set y acabado
    const k =
      game === "mtg" ? [norm(name), norm(l.set), variant ?? "", lk].join("|")
      : game === "pkm" ? [norm(name), l.code ?? norm(l.set), variant ?? "", lk].join("|")
      : l.code ? [l.code.toUpperCase(), rarity ?? "", variant ?? "", lk].join("|")
      : [norm(name), rarity ?? "", variant ?? "", norm(l.set), lk].join("|");
    if (!groups.has(k)) {
      const n = norm(name).replace(/[^a-z0-9]+/g, " ").trim();
      const exact = n === wanted || n === wantedQ || (!!l.code && (l.code.toUpperCase() === q.trim().toUpperCase()));
      groups.set(k, { key: k, name, code: l.code, rarity, version: variant, setName: l.set, lang: lk || null, exact, info, listings: [] });
    }
    const g = groups.get(k)!;
    if (!g.info && info) g.info = info;
    g.listings.push({ ...l, info });
  }
  const cards = [...groups.values()];
  for (const c of cards) {
    c.listings.sort(
      (a, b) =>
        Number(b.available === true) - Number(a.available === true) ||
        Number(b.available === null) - Number(a.available === null) ||
        a.price - b.price
    );
  }
  return cards;
}

export interface SearchProgress {
  done: number;
  total: number;
  stores: StoreStatus[];
  /** resultados parciales (con las tiendas que ya respondieron) */
  cards: CardGroup[];
}

const NET_ERR = (msg: string) => (msg === "fetch failed" || !msg ? "No se pudo conectar con la tienda" : msg);

export async function searchAll(game: Game, q: string, onProgress?: (p: SearchProgress) => void): Promise<SearchResponse> {
  const key = `${game}:${norm(q)}`;
  const cached = searchCache.get(key);
  if (cached) return cached;

  // 1) Qué texto mandar a las tiendas (Yu-Gi-Oh!: traduce nombres en español)
  let query = q.trim();
  if ((game === "ygo" || game === "mtg") && !looksLikeCode(query)) {
    const en = game === "ygo" ? await ygoEnglishName(query) : await mtgEnglishName(query);
    if (en && norm(en) !== norm(query)) query = en.split(" // ")[0];
  }
  // La ficha oficial se busca antes, para reconocer nombres en los títulos de las tiendas
  const idxQuery = await lookupInfo(game, [query]);
  const relevant = (title: string) => matchesQuery(title, query) || (looksLikeCode(q) && matchesQuery(title, q));

  const stores = STORES.filter((s) => s.games.includes(game));
  const statuses: StoreStatus[] = [];
  const listings: Listing[] = [];
  const indexStores: { store: StoreConfig; platform: Listing["platform"] }[] = [];

  // Avisos de avance: cada vez que responde una tienda (los resultados parciales, como mucho cada 600 ms)
  let lastCards = 0;
  const progress = () => {
    if (!onProgress) return;
    const now = Date.now();
    const withCards = now - lastCards > 600;
    if (withCards) lastCards = now;
    onProgress({
      done: statuses.length,
      total: stores.length,
      stores: [...statuses],
      cards: withCards ? groupListings(game, listings, idxQuery, query, q) : [],
    });
  };

  // 2) Tiendas en vivo: todas al mismo tiempo
  await Promise.all(
    stores.map(async (s) => {
      const t0 = Date.now();
      const platform = await detectPlatform(s);
      const mode = modeFor(s, platform);
      const base: StoreStatus = { id: s.id, name: s.name, domain: s.domain, platform: s.platform, mode, ok: false, count: 0, ms: 0 };
      if (mode === "index") {
        indexStores.push({ store: s, platform: platform as Listing["platform"] });
        return;
      }
      const adapter = mode === "live" ? LIVE_ADAPTERS[platform] : undefined;
      if (!adapter) {
        statuses.push({
          ...base,
          error:
            platform === "sin-conexion" ? "No se pudo conectar con la tienda"
            : platform === "desconocida" ? "No se pudo reconocer su tienda online"
            : `Su plataforma (${platform}) todavía no tiene adaptador`,
        });
        return;
      }
      try {
        if (!(await robotsAllows(s.base, adapter.path(query, s, game)))) {
          statuses.push({ ...base, ms: Date.now() - t0, error: "Su robots.txt no permite esta búsqueda" });
          return;
        }
        const raw = (await adapter.search(s, query, game)).filter((r) => relevant(r.name ?? r.title));
        const ls = toListings(game, s, platform as Listing["platform"], "live", raw, idxQuery);
        listings.push(...ls);
        statuses.push({ ...base, ok: true, count: ls.length, ms: Date.now() - t0 });
      } catch (e) {
        statuses.push({ ...base, ms: Date.now() - t0, error: NET_ERR((e as Error).message) });
      }
      progress();
    })
  );

  // 3) Tiendas indexadas: una sola consulta al catálogo guardado
  if (indexStores.length) {
    const t0 = Date.now();
    const db = catalog();
    const ids = indexStores.map((x) => x.store.id);
    try {
      const [items, idxStatus] = await Promise.all([db.search(game, queryWords(query), ids), db.statuses(game)]);
      for (const { store, platform } of indexStores) {
        const st = idxStatus.find((x) => x.storeId === store.id);
        const raw = items.filter((i) => i.storeId === store.id && relevant(i.title));
        const ls = toListings(game, store, platform, "index", raw, idxQuery);
        listings.push(...ls);
        statuses.push({
          id: store.id, name: store.name, domain: store.domain, platform: store.platform, mode: "index",
          ok: !!st && !st.error, count: ls.length, ms: Date.now() - t0, indexedAt: st?.indexedAt ?? null,
          error: !st ? "Su catálogo todavía no se indexó" : st.error ?? undefined,
        });
      }
      progress();
    } catch (e) {
      for (const { store } of indexStores) {
        statuses.push({
          id: store.id, name: store.name, domain: store.domain, platform: store.platform, mode: "index",
          ok: false, count: 0, ms: Date.now() - t0, error: "No se pudo leer el catálogo guardado: " + (e as Error).message,
        });
      }
    }
  }

  // 4) Ficha oficial de cada carta (lo que buscó el usuario + hasta 5 nombres encontrados)
  const names = [...new Set([query, ...listings.map((l) => l.parsedName)])].slice(0, 6);
  const idx = await lookupInfo(game, names);

  // 5) Agrupar por VERSIÓN (ver groupListings)
  const cards = groupListings(game, listings, idx, query, q);

  // 6) Digimon: versiones que existen (base oficial) pero ninguna tienda tiene publicadas
  const missing: MissingVersion[] = [];
  if (game === "digi" || game === "op") {
    const words = queryWords(query);
    const found = new Set(listings.map((l) => l.code?.toUpperCase()).filter(Boolean));
    const byCodeQuery = looksLikeCode(q) ? q.trim().toUpperCase() : null;
    for (const [code, info] of idx.byCode) {
      if (found.has(code)) continue;
      const matches = byCodeQuery ? code === byCodeQuery : words.length > 0 && words.every((w) => norm(info.name).includes(w));
      if (!matches) continue;
      missing.push({ code, name: info.name, rarity: info.rarity ?? null, info, image: game === "digi" ? digiImage(code) : info.image ?? null });
    }
    missing.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
  }

  // 7) Sin resultados: sugerencias de nombres parecidos (tolerante a errores de tipeo)
  let didYouMean: string[] = [];
  if (!cards.length && !looksLikeCode(q)) {
    try {
      const sug = await suggest(game, q.trim().slice(0, 40));
      didYouMean = sug.map((x) => x.alt && game === "mtg" ? x.alt : x.name).filter((n) => norm(n) !== norm(query)).slice(0, 4);
      if (!didYouMean.length && game === "mtg") {
        const fz = await mtgFuzzyName(q);
        if (fz && norm(fz) !== norm(query)) didYouMean = [fz];
      }
    } catch { /* sin sugerencias */ }
  }

  const res: SearchResponse = {
    game,
    q,
    query,
    didYouMean,
    searchedAt: new Date().toISOString(),
    stores: statuses.sort((a, b) => Number(b.ok) - Number(a.ok) || b.count - a.count || a.name.localeCompare(b.name)),
    cards,
    missing,
    known:
      (looksLikeCode(q) && idx.byCode.has(q.trim().toUpperCase())) ||
      [...idx.byName.keys()].some((n) => queryWords(query).every((w) => n.includes(w))),
  };
  if (statuses.some((s) => s.ok)) searchCache.set(key, res);
  return res;
}
