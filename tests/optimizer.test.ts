import { test } from "node:test";
import assert from "node:assert/strict";
import { optimize, assign, cardKey, planText } from "../lib/optimizer.ts";
import { parseYdk, parseYdke, idDeckToText, isYdk, isYdke } from "../lib/deckimport.ts";
import type { DeckCard, DeckOffer } from "../lib/deck.ts";

const off = (storeId: string, price: number, stock = 99, stockKnown = stock !== 99): DeckOffer => ({
  storeId, storeName: storeId.toUpperCase(), storeCity: null, hasLocal: true, title: "", code: null, rarity: null, version: null,
  price, stock, stockKnown, url: `https://${storeId}/x`,
});
const card = (name: string, qty: number, offers: DeckOffer[]): DeckCard => ({
  entry: { qty, name, code: null, line: 1, raw: `${qty} ${name}` }, name, known: true, error: null, offers: offers.sort((a, b) => a.price - b.price), outOfStock: 0,
});

// A tiene todo un poco más caro; B y C tienen cada una una carta más barata
const deck = () => [
  card("Uno", 3, [off("a", 1000), off("b", 900)]),
  card("Dos", 2, [off("a", 2000), off("c", 1800)]),
  card("Tres", 1, [off("a", 500)]),
];

test("Sin envío cargado: la más barata compra cada carta donde está más barata", () => {
  const r = optimize(deck(), { shippingPerStore: null });
  assert.equal(r.barata.cardsTotal, 3 * 900 + 2 * 1800 + 500);
  assert.equal(r.barata.stores.length, 3);
  assert.equal(r.barata.unknownShipping, 3, "envíos sin datos, no se suman como $0 confirmado");
  assert.equal(r.menos.stores.length, 1, "la tienda A sola cubre todo");
  assert.equal(r.menos.cardsTotal, 3 * 1000 + 2 * 2000 + 500);
});

test("Con envío estimado conviene juntar en una sola tienda (efecto consolidación)", () => {
  const r = optimize(deck(), { shippingPerStore: 3000 });
  // 3 tiendas: 6800 + 9000 de envío = 15800 · solo A: 7500 + 3000 = 10500
  assert.equal(r.barata.stores.length, 1);
  assert.equal(r.barata.total, 10500);
  assert.equal(r.barata.shippingKnown, 3000);
});

test("Retiro en local: esa tienda no paga envío", () => {
  const r = optimize(deck(), { shippingPerStore: 3000, pickup: new Set(["a"]) });
  assert.equal(r.barata.total, 7500);
  assert.equal(r.barata.stores[0].pickup, true);
});

test("Equilibrada: menos tiendas sin pasarse del 10 % sobre la más barata", () => {
  const cards = [
    card("Uno", 1, [off("a", 1000), off("b", 950)]),
    card("Dos", 1, [off("a", 1000), off("c", 600)]),
    card("Tres", 1, [off("a", 500), off("d", 480)]),
  ];
  const r = optimize(cards, { shippingPerStore: null });
  assert.equal(r.barata.cardsTotal, 2030);
  assert.equal(r.barata.stores.length, 3);
  // A+C: 2100 (3,4 % más) con 2 tiendas · solo A: 2500 (23 % más) no entra
  assert.equal(r.equilibrada.cardsTotal, 2100);
  assert.equal(r.equilibrada.stores.length, 2);
  assert.equal(r.menos.stores.length, 1);
});

test("Respeta el stock y avisa lo que falta", () => {
  const cards = [card("Escasa", 3, [off("a", 100, 1), off("b", 200, 1)])];
  const p = assign(cards, null, { shippingPerStore: null });
  assert.deepEqual(p.lines[0].buys.map((b) => [b.storeId, b.qty]), [["a", 1], ["b", 1]]);
  assert.equal(p.lines[0].missing, 1);
  assert.equal(p.missingCopies, 1);
});

test("Elegir la tienda a mano recalcula sin perder el resto", () => {
  const cards = deck();
  const r = optimize(cards, { shippingPerStore: null, overrides: { [cardKey(cards[0])]: "a" } });
  assert.ok(r.manual);
  assert.equal(r.manual!.lines[0].buys[0].storeId, "a");
  assert.equal(r.manual!.lines[1].buys[0].storeId, "c");
  assert.match(planText(r.manual!, "Mi compra"), /Envíos sin datos/);
});

test("Archivo .ydk y link YDKE", () => {
  const ydk = "#created by YGOPro\n#main\n14558127\n14558127\n89631139\n#extra\n1861629\n!side\n27204311\n";
  assert.ok(isYdk(ydk));
  const d = parseYdk(ydk);
  assert.deepEqual(d, { main: ["14558127", "14558127", "89631139"], extra: ["1861629"], side: ["27204311"] });
  const { text, unknown } = idDeckToText(d, { "14558127": "Ash Blossom & Joyous Spring", "1861629": "Decode Talker" });
  assert.equal(text, "Main Deck:\n2 Ash Blossom & Joyous Spring\nExtra Deck:\n1 Decode Talker");
  assert.deepEqual(unknown, ["89631139"]);
  // ydke: 14558127 = 0x00DE23AF → bytes AF 23 DE 00 (little endian)
  const b64 = Buffer.from([0xaf, 0x23, 0xde, 0x00, 0xaf, 0x23, 0xde, 0x00]).toString("base64");
  const y = `ydke://${b64}!!!`;
  assert.ok(isYdke(y));
  assert.deepEqual(parseYdke(y).main, ["14558127", "14558127"]);
});
