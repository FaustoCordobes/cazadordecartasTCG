import type { DeckEntry } from "./decklist.ts";
import type { Game, SearchResponse } from "./types.ts";
import { norm } from "./parse.ts";

/** Una publicación que sirve para una carta del mazo */
export interface DeckOffer {
  storeId: string;
  storeName: string;
  storeCity: string | null;
  hasLocal: boolean;
  title: string;
  code: string | null;
  rarity: string | null;
  version: string | null;
  price: number;
  /** cantidad que se puede comprar (stock informado; si la tienda no lo informa, se asume que alcanza) */
  stock: number;
  stockKnown: boolean;
  url: string;
}

export interface DeckCard {
  entry: DeckEntry;
  /** nombre oficial si la base lo reconoció */
  name: string;
  known: boolean;
  error: string | null;
  /** solo publicaciones con stock, de la más barata a la más cara */
  offers: DeckOffer[];
  /** publicaciones agotadas (para mostrar que existe) */
  outOfStock: number;
}

/**
 * Elige, de los resultados de búsqueda, las publicaciones que sirven para una carta del mazo.
 * - Digimon: tiene que coincidir el código (Angemon BT25-034 y BT23-027 son cartas distintas).
 *   Las variantes Alter/Foil del mismo código sirven igual.
 * - Yu-Gi-Oh!: sirve cualquier impresión con el mismo nombre.
 */
export function matchEntry(game: Game, entry: DeckEntry, res: SearchResponse): DeckCard {
  const want = norm(entry.name).replace(/[^a-z0-9]+/g, " ").trim();
  const sameName = (n: string) => norm(n).replace(/[^a-z0-9]+/g, " ").trim() === want;

  const groups = res.cards.filter((g) => {
    if (game === "digi" && entry.code) return g.code?.toUpperCase() === entry.code.toUpperCase();
    return sameName(g.name) || (g.info && sameName(g.info.name));
  });
  // Si no hubo coincidencia exacta de nombre (ej. el usuario escribió en español), se aceptan
  // las versiones de una sola carta encontrada.
  const pool = groups.length || game === "digi" ? groups : new Set(res.cards.map((g) => norm(g.name))).size === 1 ? res.cards : [];

  const offers: DeckOffer[] = [];
  let outOfStock = 0;
  for (const g of pool) {
    for (const l of g.listings) {
      if (l.available === false) {
        outOfStock++;
        continue;
      }
      offers.push({
        storeId: l.storeId,
        storeName: l.storeName,
        storeCity: l.storeCity,
        hasLocal: l.hasLocal,
        title: l.title,
        code: l.code ?? g.code,
        rarity: g.rarity,
        version: g.version,
        price: l.price,
        stock: typeof l.stock === "number" && l.stock > 0 ? l.stock : 99,
        stockKnown: typeof l.stock === "number" && l.stock > 0,
        url: l.url,
      });
    }
  }
  offers.sort((a, b) => a.price - b.price);

  const name = pool[0]?.info?.name ?? pool[0]?.name ?? entry.name;
  let error: string | null = null;
  if (!res.known && !pool.length) {
    error = `No reconocimos "${entry.raw.trim()}". Revisá cómo está escrito el nombre${game === "digi" ? " y el código" : ""}, por ejemplo: ${
      game === "digi" ? "4 Angemon BT25-034" : "3 Ash Blossom & Joyous Spring"
    }`;
  }
  return { entry, name, known: res.known || pool.length > 0, error, offers, outOfStock };
}

export interface StoreCoverage {
  storeId: string;
  storeName: string;
  storeCity: string | null;
  hasLocal: boolean;
  /** cartas distintas del mazo que tiene */
  cards: number;
  /** copias que puede cubrir (respetando stock) */
  copies: number;
  /** costo de esas copias, al precio más barato de esa tienda */
  cost: number;
  items: { name: string; code: string | null; qty: number; covered: number; price: number; url: string }[];
}

/** Qué parte del mazo se puede comprar en cada tienda */
export function coverageByStore(cards: DeckCard[]): StoreCoverage[] {
  const map = new Map<string, StoreCoverage>();
  for (const c of cards) {
    const byStore = new Map<string, DeckOffer[]>();
    for (const o of c.offers) {
      if (!byStore.has(o.storeId)) byStore.set(o.storeId, []);
      byStore.get(o.storeId)!.push(o);
    }
    for (const [storeId, offers] of byStore) {
      let left = c.entry.qty;
      let cost = 0;
      for (const o of offers) {
        const take = Math.min(left, o.stock);
        cost += take * o.price;
        left -= take;
        if (!left) break;
      }
      const covered = c.entry.qty - left;
      const s =
        map.get(storeId) ??
        { storeId, storeName: offers[0].storeName, storeCity: offers[0].storeCity, hasLocal: offers[0].hasLocal, cards: 0, copies: 0, cost: 0, items: [] };
      s.cards++;
      s.copies += covered;
      s.cost += cost;
      s.items.push({ name: c.name, code: c.entry.code, qty: c.entry.qty, covered, price: offers[0].price, url: offers[0].url });
      map.set(storeId, s);
    }
  }
  return [...map.values()].sort((a, b) => b.copies - a.copies || b.cards - a.cards || a.cost - b.cost);
}

export interface CheapestPlan {
  total: number;
  copies: number;
  missingCopies: number;
  stores: number;
  lines: { name: string; code: string | null; qty: number; buys: { storeName: string; qty: number; price: number; url: string }[]; missing: number }[];
}

/** Compra más barata: cada copia en la tienda que la tenga a menor precio, respetando el stock */
export function cheapestPlan(cards: DeckCard[]): CheapestPlan {
  const lines: CheapestPlan["lines"] = [];
  const usedStores = new Set<string>();
  let total = 0, copies = 0, missingCopies = 0;
  for (const c of cards) {
    let left = c.entry.qty;
    const buys: CheapestPlan["lines"][number]["buys"] = [];
    for (const o of c.offers) {
      if (!left) break;
      const take = Math.min(left, o.stock);
      buys.push({ storeName: o.storeName, qty: take, price: o.price, url: o.url });
      usedStores.add(o.storeId);
      total += take * o.price;
      copies += take;
      left -= take;
    }
    missingCopies += left;
    lines.push({ name: c.name, code: c.entry.code, qty: c.entry.qty, buys, missing: left });
  }
  return { total, copies, missingCopies, stores: usedStores.size, lines };
}
