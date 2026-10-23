import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDecklist } from "../lib/decklist.ts";
import { cheapestPlan, coverageByStore, matchEntry } from "../lib/deck.ts";
import { rank } from "../lib/suggest.ts";
import type { CardGroup, SearchResponse } from "../lib/types.ts";

function listing(storeId: string, price: number, stock: number | null, code: string | null, available: boolean | null = true) {
  return {
    title: `x ${code}`, url: `https://${storeId}.com/${code}-${price}`, price, available, stock,
    storeId, storeName: storeId.toUpperCase(), storeDomain: storeId + ".com", storeCity: "CABA", hasLocal: true,
    platform: "woocommerce" as const, mode: "live" as const, cashPrice: null, cashLabel: null,
    parsedName: "", code, set: null, rarity: null, version: null, edition: null, lang: null, info: null,
  };
}
const group = (name: string, code: string | null, rarity: string, listings: ReturnType<typeof listing>[]): CardGroup =>
  ({ key: `${code}|${rarity}`, name, code, rarity, version: null, setName: null, info: { name }, listings });
const res = (cards: CardGroup[], known = true): SearchResponse =>
  ({ game: "digi", q: "", query: "", searchedAt: "", stores: [], cards, missing: [], known });

test("Digimon: cada línea del mazo toma solo su código", () => {
  const deck = parseDecklist("4 Angemon BT25-034\n3 Angemon BT23-027", "digi");
  const r = res([
    group("Angemon", "BT25-034", "U", [listing("rancho", 800, 2, "BT25-034"), listing("cueva", 500, 1, "BT25-034")]),
    group("Angemon", "BT23-027", "R", [listing("cueva", 1200, 5, "BT23-027")]),
    group("MagnaAngemon", "BT25-040", "SR", [listing("rancho", 9000, 3, "BT25-040")]),
  ]);
  const [a, b] = deck.entries.map((e) => matchEntry("digi", e, r));
  assert.deepEqual(a.offers.map((o) => [o.storeId, o.price]), [["cueva", 500], ["rancho", 800]]);
  assert.deepEqual(b.offers.map((o) => o.code), ["BT23-027"]);

  // Compra más barata: 1 en cueva + 2 en rancho y falta 1 (stock 1 + 2 < 4)
  const plan = cheapestPlan([a, b]);
  assert.deepEqual(plan.lines[0].buys.map((x) => [x.storeName, x.qty]), [["CUEVA", 1], ["RANCHO", 2]]);
  assert.equal(plan.lines[0].missing, 1);
  assert.equal(plan.total, 500 + 1600 + 3 * 1200);

  // Por tienda: La Cueva tiene las dos cartas
  const stores = coverageByStore([a, b]);
  assert.equal(stores[0].storeId, "cueva");
  assert.equal(stores[0].cards, 2);
  assert.equal(stores[0].copies, 1 + 3);
});

test("Yu-Gi-Oh!: sirve cualquier impresión con el mismo nombre; agotadas no cuentan", () => {
  const [e] = parseDecklist("Exosister Karmael x2", "ygo").entries;
  const r = res([
    group("Exosister Karmael", "GRCR-EN029", "Common", [listing("haru", 999, null, "GRCR-EN029")]),
    group("Exosister Karmael", "RA03-EN099", "Super Rare", [listing("lair", 1500, 0, "RA03-EN099", false)]),
    group("Exosister Kaspitell", "GRCR-EN030", "Ultra Rare", [listing("lair", 700, 3, "GRCR-EN030")]),
  ]);
  const card = matchEntry("ygo", e, r);
  assert.deepEqual(card.offers.map((o) => o.storeId), ["haru"]);
  assert.equal(card.offers[0].stockKnown, false, "Shopify no informa cantidad: se asume que alcanza");
  assert.equal(card.outOfStock, 1);
});

test("Carta que no existe: avisa cómo escribirla", () => {
  const [e] = parseDecklist("3 Exosister Karmeal", "ygo").entries;
  const card = matchEntry("ygo", e, res([], false));
  assert.match(card.error ?? "", /No reconocimos "3 Exosister Karmeal"/);
});

test("Sugerencias: primero las que empiezan con lo escrito", () => {
  const list = rank([{ name: "Kashtira Ash Blossom" }, { name: "Ash Blossom & Joyous Spring" }, { name: "Lonefire Blossom" }, { name: "Ash Blossom & Joyous Spring" }], "ash");
  assert.deepEqual(list.map((s) => s.name), ["Ash Blossom & Joyous Spring", "Kashtira Ash Blossom", "Lonefire Blossom"]);
});
