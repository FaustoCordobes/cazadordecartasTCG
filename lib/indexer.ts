import type { CatalogItem, Game, RawListing, StoreConfig } from "./types.ts";
import { getText, sleep } from "./http.ts";
import { robotsAllows, robotsCrawlDelay } from "./robots.ts";
import { GAMES } from "./games.ts";
import { detectPlatform, modeFor } from "./detect.ts";
import { discoverCategories, pageUrl, parsePrestashop, parseTiendanube, parseWooCategory } from "./adapters/catalog.ts";
import { catalog } from "./catalog.ts";

const PARSERS = { tiendanube: parseTiendanube, prestashop: parsePrestashop, woocommerce: parseWooCategory } as const;
type IndexPlatform = keyof typeof PARSERS;

export interface IndexOptions {
  /** pausa entre páginas, para no cargar a la tienda */
  delayMs?: number;
  /** tope de páginas por categoría */
  maxPages?: number;
  log?: (msg: string) => void;
}

/** Recorre las categorías de un juego en una tienda y devuelve todas sus publicaciones */
export async function crawlStore(store: StoreConfig, game: Game, opts: IndexOptions = {}): Promise<RawListing[]> {
  const { maxPages = 400, log = () => {} } = opts;
  let delayMs = opts.delayMs ?? 1500;
  // Se respeta el Crawl-delay de la tienda; si pide demasiado, no se indexa
  const crawlDelay = await robotsCrawlDelay(store.base);
  if (crawlDelay && crawlDelay > 20) throw new Error(`Su robots.txt pide ${crawlDelay} s entre consultas: no se indexa para no cargarla`);
  if (crawlDelay) delayMs = Math.max(delayMs, crawlDelay * 1000);
  const platform = await detectPlatform(store);
  if (!(platform in PARSERS)) throw new Error(`Plataforma ${platform}: no tiene lector de catálogo`);
  const parser = PARSERS[platform as IndexPlatform];

  let cats = store.categories?.[game];
  if (!cats?.length) {
    if (!(await robotsAllows(store.base, "/"))) throw new Error("Su robots.txt no permite leer la home");
    cats = discoverCategories(store.base, await getText(store.base + "/"))[game] ?? [];
    log(`  categorías encontradas: ${cats.join(", ") || "ninguna"}`);
  }
  if (!cats?.length) throw new Error("No se encontró una categoría de este juego en la home");

  const seen = new Map<string, RawListing>();
  for (const cat of cats) {
    for (let n = 1; n <= maxPages; n++) {
      const url = pageUrl(platform as IndexPlatform, store.base, cat, n);
      const u = new URL(url);
      if (!(await robotsAllows(store.base, u.pathname + u.search))) throw new Error(`Su robots.txt no permite leer ${u.pathname}`);
      let html: string;
      try {
        html = await getText(url, 20000);
      } catch (e) {
        if (n > 1 && /404/.test((e as Error).message)) break; // se terminó la paginación
        throw e;
      }
      const items = parser(store.base, html);
      const before = seen.size;
      for (const it of items) seen.set(it.url, { ...it, gameHint: game });
      log(`  ${cat} página ${n}: ${items.length} productos`);
      // fin: página vacía, o una página que repite lo que ya teníamos
      if (!items.length || seen.size === before) break;
      await sleep(delayMs);
    }
  }
  return [...seen.values()];
}

export interface IndexResult {
  storeId: string;
  game: Game;
  count: number;
  error: string | null;
}

/** Indexa todas las tiendas en modo "index" y guarda el catálogo */
export async function indexAll(stores: StoreConfig[], opts: IndexOptions & { only?: string[] } = {}): Promise<IndexResult[]> {
  const log = opts.log ?? (() => {});
  const db = catalog();
  const results: IndexResult[] = [];
  for (const store of stores) {
    if (opts.only?.length && !opts.only.includes(store.id)) continue;
    const platform = await detectPlatform(store);
    if (modeFor(store, platform) !== "index") {
      log(`- ${store.name}: se consulta en vivo (${platform}), no hace falta indexar`);
      continue;
    }
    for (const game of store.games) {
      log(`- ${store.name} · ${GAMES[game].short}`);
      const indexedAt = new Date().toISOString();
      try {
        const raw = await crawlStore(store, game, opts);
        const items: CatalogItem[] = raw.map((r) => ({ ...r, storeId: store.id, game, indexedAt }));
        await db.replaceStore(store.id, game, items, { storeId: store.id, game, indexedAt, count: items.length, error: null });
        log(`  ✓ ${items.length} publicaciones guardadas`);
        results.push({ storeId: store.id, game, count: items.length, error: null });
      } catch (e) {
        const msg = (e as Error).message;
        const error = msg === "fetch failed" || !msg ? "No se pudo conectar con la tienda" : msg;
        await db.replaceStore(store.id, game, [], { storeId: store.id, game, indexedAt, count: 0, error });
        log(`  ✗ ${error}`);
        results.push({ storeId: store.id, game, count: 0, error });
      }
    }
  }
  return results;
}
