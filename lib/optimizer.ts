import type { DeckCard, DeckOffer } from "./deck.ts";

/**
 * Optimizador de compra de un listado de cartas.
 *
 * Tres estrategias, todas sobre las tiendas que respondieron (no es "el mínimo absoluto del país"):
 *  A. Menor costo total: cartas + envíos conocidos. Si cargaste un envío estimado, junta compras en menos
 *     tiendas cuando el ahorro de envío supera la diferencia de precio ("efecto consolidación").
 *  B. Menos tiendas: cubre el listado con la menor cantidad de tiendas (elige siempre la que cubre más copias).
 *  C. Equilibrado: la menor cantidad de tiendas pagando como mucho un 10 % más que la opción A.
 * Además, la persona puede elegir a mano en qué tienda comprar cada carta ("Personalizado").
 *
 * Envíos: nunca se inventan. Solo se suman si la persona carga un envío estimado por tienda, o si elige
 * retirar en el local (envío $0). El resto se informa como "envío sin datos".
 */

export interface OptimizerOptions {
  /** envío estimado por tienda que cargó la persona; null = no se sabe */
  shippingPerStore: number | null;
  /** tiendas donde la persona retira en el local (envío $0) */
  pickup?: Set<string>;
  /** clave de carta → tienda elegida a mano */
  overrides?: Record<string, string>;
}

export interface PlanBuy { storeId: string; storeName: string; qty: number; price: number; url: string; stockKnown: boolean; version: string | null; codeUnverified?: boolean }
export interface PlanLine { key: string; name: string; code: string | null; qty: number; buys: PlanBuy[]; missing: number }
export interface PlanStore {
  storeId: string;
  storeName: string;
  items: { name: string; code: string | null; qty: number; price: number; url: string; version: string | null; codeUnverified?: boolean }[];
  subtotal: number;
  /** null = envío sin datos */
  shipping: number | null;
  pickup: boolean;
}
export interface Plan {
  id: "barata" | "menos" | "equilibrada" | "manual";
  lines: PlanLine[];
  stores: PlanStore[];
  cardsTotal: number;
  shippingKnown: number;
  unknownShipping: number;
  /** cartas + envíos conocidos */
  total: number;
  copies: number;
  missingCopies: number;
  unconfirmedStock: number;
}

export const cardKey = (c: DeckCard) => `${c.name.toLowerCase()}|${c.entry.code ?? ""}`;

/** Reparte cada carta entre las tiendas permitidas, de la más barata a la más cara, respetando el stock */
export function assign(cards: DeckCard[], allowed: Set<string> | null, opts: OptimizerOptions, id: Plan["id"] = "barata"): Plan {
  const lines: PlanLine[] = [];
  for (const c of cards) {
    const key = cardKey(c);
    const forced = opts.overrides?.[key];
    let offers: DeckOffer[] = c.offers.filter((o) => !allowed || allowed.has(o.storeId) || o.storeId === forced);
    if (forced) offers = [...offers.filter((o) => o.storeId === forced), ...offers.filter((o) => o.storeId !== forced)];
    let left = c.entry.qty;
    const buys: PlanBuy[] = [];
    for (const o of offers) {
      if (!left) break;
      const take = Math.min(left, o.stock);
      if (take <= 0) continue;
      buys.push({ storeId: o.storeId, storeName: o.storeName, qty: take, price: o.price, url: o.url, stockKnown: o.stockKnown, version: o.version && o.version !== "Normal" ? o.version : null, codeUnverified: o.codeUnverified });
      left -= take;
    }
    lines.push({ key, name: c.name, code: c.entry.code, qty: c.entry.qty, buys, missing: left });
  }
  return summarize(lines, opts, id);
}

function summarize(lines: PlanLine[], opts: OptimizerOptions, id: Plan["id"]): Plan {
  const byStore = new Map<string, PlanStore>();
  let cardsTotal = 0, copies = 0, missingCopies = 0, unconfirmedStock = 0;
  for (const l of lines) {
    missingCopies += l.missing;
    for (const b of l.buys) {
      cardsTotal += b.qty * b.price;
      copies += b.qty;
      if (!b.stockKnown) unconfirmedStock += b.qty;
      const pickup = !!opts.pickup?.has(b.storeId);
      const s = byStore.get(b.storeId) ?? {
        storeId: b.storeId, storeName: b.storeName, items: [], subtotal: 0, pickup,
        shipping: pickup ? 0 : opts.shippingPerStore,
      };
      s.items.push({ name: l.name, code: l.code, qty: b.qty, price: b.price, url: b.url, version: b.version, codeUnverified: b.codeUnverified });
      s.subtotal += b.qty * b.price;
      byStore.set(b.storeId, s);
    }
  }
  const stores = [...byStore.values()].sort((a, b) => b.subtotal - a.subtotal);
  const shippingKnown = stores.reduce((s, x) => s + (x.shipping ?? 0), 0);
  const unknownShipping = stores.filter((x) => x.shipping === null).length;
  return { id, lines, stores, cardsTotal, shippingKnown, unknownShipping, total: cardsTotal + shippingKnown, copies, missingCopies, unconfirmedStock };
}

/** Menos tiendas: elige una y otra vez la tienda que cubre más copias pendientes */
function fewestStores(cards: DeckCard[], opts: OptimizerOptions): Set<string> {
  const need = new Map(cards.map((c) => [cardKey(c), c.entry.qty]));
  const chosen = new Set<string>();
  const all = [...new Set(cards.flatMap((c) => c.offers.map((o) => o.storeId)))];
  for (;;) {
    let best: { id: string; cover: number; cost: number } | null = null;
    for (const id of all) {
      if (chosen.has(id)) continue;
      let cover = 0, cost = 0;
      for (const c of cards) {
        const left = need.get(cardKey(c)) ?? 0;
        if (!left) continue;
        let take = 0;
        for (const o of c.offers.filter((x) => x.storeId === id)) {
          const t = Math.min(left - take, o.stock);
          take += t;
          cost += t * o.price;
        }
        cover += take;
      }
      if (cover > 0 && (!best || cover > best.cover || (cover === best.cover && cost < best.cost))) best = { id, cover, cost };
    }
    if (!best) break;
    chosen.add(best.id);
    for (const c of cards) {
      const k = cardKey(c);
      let left = need.get(k) ?? 0;
      for (const o of c.offers.filter((x) => x.storeId === best!.id)) left -= Math.min(left, o.stock);
      need.set(k, left);
    }
  }
  // tiendas con retiro en local que no suman tiendas nuevas no se fuerzan; el reparto final elige lo más barato dentro del grupo
  void opts;
  return chosen;
}

/** Calcula las tres estrategias (y la manual si hay elecciones a mano) */
export function optimize(cards: DeckCard[], opts: OptimizerOptions): { barata: Plan; menos: Plan; equilibrada: Plan; manual: Plan | null } {
  const usable = cards.filter((c) => c.offers.length);
  const base = assign(cards, null, { ...opts, overrides: undefined }, "barata");
  const fullCopies = base.copies;

  // Búsqueda local: se parte de todas las tiendas y se va sacando, de a una, la tienda usada cuya salida
  // cuesta menos (sus cartas pasan a otras tiendas), sin perder copias. Se guarda cada paso.
  const steps: Plan[] = [base];
  let current = new Set(cards.flatMap((c) => c.offers.map((o) => o.storeId)));
  let last = base;
  for (;;) {
    let bestNext: { set: Set<string>; plan: Plan } | null = null;
    for (const id of last.stores.map((x) => x.storeId)) {
      const set = new Set([...current].filter((x) => x !== id));
      const plan = assign(cards, set, { ...opts, overrides: undefined }, "barata");
      if (plan.copies < fullCopies) continue;
      if (!bestNext || plan.total < bestNext.plan.total) bestNext = { set, plan };
    }
    if (!bestNext) break;
    steps.push(bestNext.plan);
    current = bestNext.set;
    last = bestNext.plan;
  }
  const coverSet = fewestStores(usable, opts);
  const menos = { ...assign(cards, coverSet, { ...opts, overrides: undefined }), id: "menos" as const };
  if (menos.copies >= fullCopies) steps.push(menos);

  const barata = { ...steps.reduce((a, b) => (b.total < a.total || (b.total === a.total && b.stores.length < a.stores.length) ? b : a)), id: "barata" as const };
  const limit = barata.total * 1.1;
  const equilibrada = {
    ...steps.filter((p) => p.total <= limit).reduce((a, b) => (b.stores.length < a.stores.length || (b.stores.length === a.stores.length && b.total < a.total) ? b : a), barata),
    id: "equilibrada" as const,
  };
  const manual = opts.overrides && Object.keys(opts.overrides).length
    ? assign(cards, new Set(barata.stores.map((s) => s.storeId)), opts, "manual")
    : null;
  return { barata, menos, equilibrada, manual };
}

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/** Texto del plan para copiar o mandar por WhatsApp */
export function planText(p: Plan, title: string): string {
  const out = [`🛒 *${title}* — armado con Cazacartas`, ""];
  for (const s of p.stores) {
    out.push(`*${s.storeName}* — ${fmt.format(s.subtotal)}${s.pickup ? " (retiro en local)" : s.shipping !== null ? ` + envío est. ${fmt.format(s.shipping)}` : " + envío sin datos"}`);
    for (const it of s.items) out.push(`• ${it.qty} × ${it.name}${it.code ? ` ${it.code}` : ""}${it.version ? ` (${it.version})` : ""} a ${fmt.format(it.price)} — ${it.url}`);
    out.push("");
  }
  const miss = p.lines.filter((l) => l.missing > 0);
  if (miss.length) out.push(`Sin stock en las tiendas consultadas: ${miss.map((l) => `${l.missing} × ${l.name}`).join(", ")}`, "");
  out.push(`Cartas: ${fmt.format(p.cardsTotal)}`);
  if (p.shippingKnown) out.push(`Envíos estimados: ${fmt.format(p.shippingKnown)}`);
  if (p.unknownShipping) out.push(`Envíos sin datos: ${p.unknownShipping} tienda${p.unknownShipping === 1 ? "" : "s"}`);
  out.push(`Total estimado: *${fmt.format(p.total)}*`, "", "⚠️ Precios y stock al momento de armarlo. Confirmalos en cada tienda antes de comprar.");
  return out.join("\n");
}
