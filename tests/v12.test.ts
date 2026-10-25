import { test } from "node:test";
import assert from "node:assert/strict";
import { optimize, shippingFor } from "../lib/optimizer.ts";
import { applyPrefs, DEFAULT_PREFS } from "../lib/deckprefs.ts";
import { archidektToText, deckSource, isDeckUrl, mainDeckText } from "../lib/deckurl.ts";
import { findCodes, guessName } from "../lib/scan.ts";
import { offerRows, pickMovers } from "../lib/market.ts";
import { bestFor, shouldNotify, validSub } from "../lib/push.ts";
import { watchKey } from "../lib/watchkey.ts";
import { parseDecklist } from "../lib/decklist.ts";
import { validateReport } from "../lib/reports.ts";
import type { DeckCard, DeckOffer } from "../lib/deck.ts";
import type { CardGroup, SearchResponse } from "../lib/types.ts";

const off = (storeId: string, price: number, o: Partial<DeckOffer> = {}): DeckOffer => ({
  storeId, storeName: storeId.toUpperCase(), storeCity: null, hasLocal: true, title: "", code: null, rarity: null, version: null,
  price, stock: 99, stockKnown: false, url: `https://${storeId}/${price}`, ...o,
});
const card = (name: string, qty: number, offers: DeckOffer[], e: Partial<DeckCard["entry"]> = {}): DeckCard => ({
  entry: { qty, name, code: null, line: 1, raw: `${qty} ${name}`, ...e }, name, known: true, error: null, offers: offers.sort((a, b) => a.price - b.price), outOfStock: 0,
});

// ---------- Envío por tienda ----------
test("envío gratis desde un monto", () => {
  assert.equal(shippingFor(40000, { cost: 5000, freeFrom: 50000 }, null), 5000);
  assert.equal(shippingFor(50000, { cost: 5000, freeFrom: 50000 }, null), 0);
  assert.equal(shippingFor(1000, undefined, 3000), 3000, "sin dato de la tienda, se usa el general");
  assert.equal(shippingFor(1000, undefined, null), null);
});

test("el plan junta compras en la tienda que envía gratis cuando conviene", () => {
  // A: todo a 10.000 c/u, envío 5000 gratis desde 20.000. B: una carta a 9.000, envío 5000.
  const deck = [card("Uno", 1, [off("a", 10000), off("b", 9000)]), card("Dos", 1, [off("a", 10000)])];
  const r = optimize(deck, { shippingPerStore: null, shipping: { a: { cost: 5000, freeFrom: 20000 }, b: { cost: 5000 } } });
  // A+B: 19.000 + 5000 + 5000 = 29.000 · solo A: 20.000 + envío gratis = 20.000
  assert.equal(r.barata.total, 20000);
  assert.equal(r.barata.stores.length, 1);
  assert.equal(r.barata.stores[0].shipping, 0);
});

// ---------- Opciones del plan ----------
test("estado mínimo, idioma, impresión exacta y sin versiones especiales", () => {
  const c = card("Sol Ring", 1, [
    off("a", 100, { condition: "HP" }), off("b", 200, { condition: "LP", lang: "Español" }), off("c", 300, { condition: null, set: "CMM" }),
    off("d", 50, { version: "Foil", set: "CMM" }),
  ], { set: "CMM" });
  const ids = (p: Partial<typeof DEFAULT_PREFS>) => applyPrefs([c], { ...DEFAULT_PREFS, ...p }, "mtg").cards[0].offers.map((o) => o.storeId).sort();
  assert.deepEqual(ids({}), ["a", "b", "c", "d"]);
  assert.deepEqual(ids({ minCond: "LP" }), ["b", "c", "d"], "sin estado informado se acepta");
  assert.deepEqual(ids({ lang: "Inglés" }), ["a", "c", "d"]);
  assert.deepEqual(ids({ lang: "Español" }), ["b"]);
  assert.deepEqual(ids({ printing: "exact" }), ["c", "d"]);
  assert.deepEqual(ids({ noSpecial: true }), ["a", "b", "c"]);
  assert.equal(applyPrefs([c], { ...DEFAULT_PREFS, minCond: "NM" }, "mtg").hidden, 2);
});

test("Yu-Gi-Oh!: impresión exacta acepta el mismo código en otro idioma", () => {
  const c = card("Pot of Greed", 1, [off("a", 100, { code: "LOB-S119" }), off("b", 100, { code: "LOB-EN119" }), off("c", 100, { code: "SRL-EN050" })], { code: "LOB-EN119" });
  assert.deepEqual(applyPrefs([c], { ...DEFAULT_PREFS, printing: "exact" }, "ygo").cards[0].offers.map((o) => o.storeId).sort(), ["a", "b"]);
});

test("decklist de Magic guarda el set para la impresión exacta", () => {
  const d = parseDecklist("2 Sol Ring (CMM) 395\n4 Lightning Bolt", "mtg");
  assert.equal(d.entries[0].set, "CMM");
  assert.equal(d.entries[1].set, undefined);
});

// ---------- Importar mazo por link ----------
test("links de mazos", () => {
  assert.equal(deckSource("https://archidekt.com/decks/123456/mi-mazo")?.fetchUrl, "https://archidekt.com/api/decks/123456/");
  assert.equal(deckSource("https://tappedout.net/mtg-decks/burn-deck/")?.fetchUrl, "https://tappedout.net/mtg-decks/burn-deck/?fmt=txt");
  assert.equal(deckSource("https://www.mtggoldfish.com/deck/6543210")?.fetchUrl, "https://www.mtggoldfish.com/deck/download/6543210");
  assert.equal(deckSource("https://moxfield.com/decks/abc")?.kind, "manual");
  assert.equal(deckSource("hola"), null);
  assert.equal(isDeckUrl("https://archidekt.com/decks/1"), true);
  assert.equal(isDeckUrl("4 Lightning Bolt"), false);
});

test("Archidekt y listas en texto", () => {
  const t = archidektToText({ cards: [
    { quantity: 1, categories: ["Commander"], card: { oracleCard: { name: "Atraxa, Praetors' Voice" }, edition: { editioncode: "2xm" } } },
    { quantity: 4, categories: ["Maybeboard"], card: { oracleCard: { name: "Opt" } } },
    { quantity: 1, categories: null, card: { oracleCard: { name: "Sol Ring" } } },
  ] });
  assert.equal(t, "1 Atraxa, Praetors' Voice (2XM)\n1 Sol Ring");
  assert.equal(mainDeckText("4 Lightning Bolt\n4 Opt\n\n2 Pyroblast"), "4 Lightning Bolt\n4 Opt");
  assert.equal(mainDeckText("\n4 Bolt\nSideboard\n2 X"), "4 Bolt");
});

// ---------- Cámara (OCR) ----------
test("lee códigos del texto de una foto, con errores típicos del OCR", () => {
  assert.deepEqual(findCodes("digi", "BanchoLeomon\nBT2O-O36 U"), ["BT20-036"]);
  assert.deepEqual(findCodes("op", "Roronoa Zoro OP01 - 025 SR"), ["OP01-025"]);
  assert.deepEqual(findCodes("ygo", "Ash Blossom\nRA01-EN008"), ["RA01-EN008"]);
  assert.deepEqual(findCodes("pkm", "HP 330\n125 / 197"), ["125/197"]);
  assert.deepEqual(findCodes("digi", "nada por acá"), []);
  assert.equal(guessName("12\nLightning Bolt\nInstant"), "Lightning Bolt");
});

// ---------- Ofertas y movimientos ----------
const L = (storeId: string, price: number, available: boolean | null = true) => ({
  title: "x", url: `https://${storeId}/${price}`, price, available, stock: 2, storeId, storeName: storeId, storeDomain: "", storeCity: null, hasLocal: false,
  platform: "woocommerce" as const, mode: "live" as const, cashPrice: null, cashLabel: null, parsedName: "Sol Ring", code: null, set: null, rarity: null,
  version: null, edition: null, lang: null, info: null,
});
const group = (key: string, ls: ReturnType<typeof L>[], usd: number | null): CardGroup => ({
  key, name: "Sol Ring", code: null, rarity: null, version: null, setName: "CMM", exact: true,
  info: usd ? { name: "Sol Ring", ref: { src: "TCGplayer", prices: { normal: usd } } } : null, listings: ls,
});
const res = (cards: CardGroup[]): SearchResponse => ({ game: "mtg", q: "sol ring", query: "sol ring", searchedAt: "", stores: [], cards, missing: [], known: true });
const dolar = { tipo: "bolsa", nombre: "dólar MEP", venta: 1000, fecha: "", fuente: "" };

test("ofertas: solo con stock, 20 % o más por debajo de la referencia, y no cartas de centavos", () => {
  const rows = offerRows(res([
    group("a", [L("x", 7000), L("y", 9000)], 10),          // ref $10.000 → $7.000 = 30 % menos ✔
    group("b", [L("x", 9500)], 10),                        // 5 % menos ✘
    group("c", [L("x", 500)], 1),                          // ref $1.000: muy barata ✘
    group("d", [L("x", 100, false)], 10),                  // sin stock ✘
    group("e", [L("x", 100)], null),                       // sin referencia ✘
  ]), dolar);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].card_key, "a");
  assert.equal(rows[0].descuento, 30);
  assert.equal(offerRows(res([group("a", [L("x", 7000)], 10)]), null).length, 0, "sin dólar no se calcula");
});

test("subas y bajas: cambios de 5 % o más, ordenados", () => {
  const m = pickMovers([
    { card_key: "a", card_name: "A", antes: 1000, ahora: 1500, tiendas: 2 },
    { card_key: "b", card_name: "B", antes: "1000", ahora: "800", tiendas: "1" },
    { card_key: "c", card_name: "C", antes: 1000, ahora: 1020, tiendas: 1 },
    { card_key: "d", card_name: "D", antes: 1000, ahora: 1200, tiendas: 1 },
  ]);
  assert.deepEqual(m.suben.map((x) => x.card_key), ["a", "d"]);
  assert.deepEqual(m.bajan.map((x) => [x.card_key, x.cambio]), [["b", -20]]);
});

// ---------- Avisos al celular ----------
test("avisos: cuándo avisar sin repetir", () => {
  const now = Date.now();
  const yesterday = new Date(now - 86400000).toISOString();
  assert.equal(shouldNotify({ precio_max: 5000, ultimo_precio: null, ultimo_aviso: null }, { price: 4500 }, now), true);
  assert.equal(shouldNotify({ precio_max: 5000, ultimo_precio: null, ultimo_aviso: null }, { price: 6000 }, now), false);
  assert.equal(shouldNotify({ precio_max: 5000, ultimo_precio: 4500, ultimo_aviso: yesterday }, { price: 4500 }, now), false, "ya avisado y no bajó más");
  assert.equal(shouldNotify({ precio_max: 5000, ultimo_precio: 4500, ultimo_aviso: yesterday }, { price: 4000 }, now), true, "bajó más");
  assert.equal(shouldNotify({ precio_max: null, ultimo_precio: null, ultimo_aviso: null }, { price: 1 }, now), true, "volvió el stock");
  assert.equal(shouldNotify({ precio_max: null, ultimo_precio: 900, ultimo_aviso: null }, { price: 1 }, now), false, "ya había stock");
  assert.equal(shouldNotify({ precio_max: 5000, ultimo_precio: null, ultimo_aviso: null }, null, now), false);
});

test("avisos: precio de la versión vigilada", () => {
  const g1 = { ...group("a", [L("x", 3000), L("y", 2000, false)], null), code: "CMM-395", version: null };
  const g2 = { ...group("b", [L("z", 1000)], null), code: "C21-263", version: "Foil" };
  const r = res([g1, g2]);
  assert.equal(bestFor(r, "Sol Ring", "")?.price, 1000, "cualquier versión");
  assert.equal(bestFor(r, "Sol Ring", watchKey("CMM-395", null, null))?.price, 3000);
  assert.equal(watchKey(null, null, "Normal"), "");
  assert.equal(validSub({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "a", auth: "b" } }), true);
  assert.equal(validSub({ endpoint: "http://x", keys: { p256dh: "a", auth: "b" } }), false);
});

test("formulario de alta de tienda", () => {
  const r = validateReport({ tipo: "tienda_alta", url: "https://mitienda.com", comentario: "Tienda: X\n".repeat(100) });
  assert.equal(typeof r, "object");
  assert.ok((r as { comentario: string }).comentario.length > 600 && (r as { comentario: string }).comentario.length <= 2000);
});
