import type { CardGroup, CardInfo, Game, Listing, MissingVersion, RawListing, SearchResponse, StoreConfig, StoreStatus } from "./types.ts";
import { STORES } from "./stores.ts";
import { LIVE_ADAPTERS } from "./adapters/index.ts";
import { robotsAllows } from "./robots.ts";
import { digiImage, lookupInfo, ygoEnglishName, type InfoIndex } from "./cardinfo.ts";
import { matchesQuery, norm, parseTitle } from "./parse.ts";
import { TTLCache } from "./cache.ts";
import { detectPlatform, modeFor } from "./detect.ts";
import { catalog } from "./catalog.ts";

const searchCache = new TTLCache<SearchResponse>(10 * 60 * 1000);

/** ¿Lo que escribió el usuario es un código de carta? (BT2-077, RA01-EN008) */
export const looksLikeCode = (q: string) => /^[a-z0-9]{2,5}-[a-z0-9]{2,6}$/i.test(q.trim());

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

/** Convierte lo que devolvió una tienda en publicaciones de cartas sueltas */
function toListings(game: Game, store: StoreConfig, platform: Listing["platform"], mode: Listing["mode"], raw: RawListing[]): Listing[] {
  const out: Listing[] = [];
  for (const r of raw) {
    const p = parseTitle(game, r.title);
    // Si la tienda ya separa nombre y rareza (Casco), se confía en eso.
    // Si no, las cartas sueltas siempre traen su código (BT2-077, RA01-EN008):
    // sin código suele ser un sobre, un mazo o una inscripción a torneo.
    if (!p.code && !r.name) continue;
    let rarity = r.rarity ?? p.rarity;
    if (game === "digi" && rarity) rarity = DIGI_RARITY[norm(rarity)] ?? rarity;
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
      parsedName: r.name ?? p.name,
      code: p.code,
      set: p.set ?? r.setName ?? null,
      rarity: rarity ?? null,
      version: p.version,
      edition: p.edition,
      lang: p.lang ?? (game === "digi" ? "Inglés" : null),
    });
  }
  return out;
}

const NET_ERR = (msg: string) => (msg === "fetch failed" || !msg ? "No se pudo conectar con la tienda" : msg);

export async function searchAll(game: Game, q: string): Promise<SearchResponse> {
  const key = `${game}:${norm(q)}`;
  const cached = searchCache.get(key);
  if (cached) return cached;

  // 1) Qué texto mandar a las tiendas (Yu-Gi-Oh!: traduce nombres en español)
  let query = q.trim();
  if (game === "ygo" && !looksLikeCode(query)) {
    const en = await ygoEnglishName(query);
    if (en && norm(en) !== norm(query)) query = en;
  }
  const relevant = (title: string) => matchesQuery(title, query) || (looksLikeCode(q) && matchesQuery(title, q));

  const stores = STORES.filter((s) => s.games.includes(game));
  const statuses: StoreStatus[] = [];
  const listings: Listing[] = [];
  const indexStores: { store: StoreConfig; platform: Listing["platform"] }[] = [];

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
        const ls = toListings(game, s, platform as Listing["platform"], "live", raw);
        listings.push(...ls);
        statuses.push({ ...base, ok: true, count: ls.length, ms: Date.now() - t0 });
      } catch (e) {
        statuses.push({ ...base, ms: Date.now() - t0, error: NET_ERR((e as Error).message) });
      }
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
        const ls = toListings(game, store, platform, "index", raw);
        listings.push(...ls);
        statuses.push({
          id: store.id, name: store.name, domain: store.domain, platform: store.platform, mode: "index",
          ok: !!st && !st.error, count: ls.length, ms: Date.now() - t0, indexedAt: st?.indexedAt ?? null,
          error: !st ? "Su catálogo todavía no se indexó" : st.error ?? undefined,
        });
      }
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

  // 5) Agrupar por VERSIÓN: cada impresión (código + rareza + variante) es una tarjeta aparte.
  //    Así Kimeramon BT19-070, BT8-084 y EX9-074 Alter aparecen por separado.
  const groups = new Map<string, CardGroup>();
  for (const l of listings) {
    const info = attachInfo(game, l, idx);
    const name = info?.name ?? l.parsedName;
    const rarity = l.rarity ?? info?.rarity ?? null;
    const variant = game === "digi" ? (l.version && l.version !== "Normal" ? l.version : null) : l.version;
    const k = l.code
      ? [l.code.toUpperCase(), rarity ?? "", variant ?? ""].join("|")
      : [norm(name), rarity ?? "", variant ?? "", norm(l.set)].join("|");
    if (!groups.has(k)) {
      groups.set(k, { key: k, name, code: l.code, rarity, version: variant, setName: l.set, info, listings: [] });
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

  // 6) Digimon: versiones que existen (base oficial) pero ninguna tienda tiene publicadas
  const missing: MissingVersion[] = [];
  if (game === "digi") {
    const words = queryWords(query);
    const found = new Set(listings.map((l) => l.code?.toUpperCase()).filter(Boolean));
    const byCodeQuery = looksLikeCode(q) ? q.trim().toUpperCase() : null;
    for (const [code, info] of idx.byCode) {
      if (found.has(code)) continue;
      const matches = byCodeQuery ? code === byCodeQuery : words.length > 0 && words.every((w) => norm(info.name).includes(w));
      if (!matches) continue;
      missing.push({ code, name: info.name, rarity: info.rarity ?? null, info, image: digiImage(code) });
    }
    missing.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
  }

  const res: SearchResponse = {
    game,
    q,
    query,
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
