import { test } from "node:test";
import assert from "node:assert/strict";
import { isSpanishTitle, nameKey, translateName, ygoPair, ygoSpanishSuggestions } from "../lib/names.ts";
import { median, refUsd } from "../lib/refprice.ts";
import { matchEntry } from "../lib/deck.ts";
import type { CardGroup, SearchResponse } from "../lib/types.ts";

test("Yu-Gi-Oh!: nombre en español → inglés (exacto, sin tildes ni mayúsculas)", () => {
  assert.deepEqual(ygoPair("mago oscuro"), { en: "Dark Magician", es: "Mago Oscuro", typed: "es" });
  assert.deepEqual(ygoPair("FLOR DE CENIZA & PRIMAVERA FELIZ"), { en: "Ash Blossom & Joyous Spring", es: "Flor de Ceniza & Primavera Feliz", typed: "es" });
  assert.equal(ygoPair("olla de la codicia")?.en, "Pot of Greed");
});

test("Yu-Gi-Oh!: nombre en inglés → también se busca en español", () => {
  assert.deepEqual(ygoPair("Pot of Greed"), { en: "Pot of Greed", es: "Olla de la Codicia", typed: "en" });
});

test("Yu-Gi-Oh!: español incompleto se completa, pero no pisa búsquedas parciales en inglés", () => {
  assert.equal(ygoPair("flor de ceniza")?.en, "Ash Blossom & Joyous Spring");
  assert.equal(ygoPair("blue eyes"), null); // sigue buscando todas las Blue-Eyes
  assert.equal(ygoPair("dark"), null);
});

test("Yu-Gi-Oh!: sugerencias en español con el nombre en inglés al lado", () => {
  const s = ygoSpanishSuggestions("mago oscuro");
  assert.equal(s[0].name, "Mago Oscuro");
  assert.equal(s[0].alt, "Dark Magician");
  assert.ok(s.length > 1);
});

test("Digimon y One Piece no se traducen (no hay impresión en español)", async () => {
  assert.equal(await translateName("digi", "Agumon"), null);
  assert.equal(await translateName("op", "Roronoa Zoro"), null);
});

test("publicación titulada en español se reconoce", () => {
  const pair = { en: "Pot of Greed", es: "Olla de la Codicia", typed: "en" as const };
  assert.equal(isSpanishTitle(pair, "Olla de la Codicia", "Olla de la Codicia LOB-S119 Rare"), true);
  assert.equal(isSpanishTitle(pair, "Pot of Greed", "Pot of Greed LOB-119"), false);
  // otra carta que contiene esas palabras no se confunde
  assert.equal(isSpanishTitle(pair, "Espiritu de la Olla de la Codicia", "Espíritu de la Olla de la Codicia"), false);
  assert.equal(nameKey("Flor de Ceniza & Primavera Feliz"), "flor de ceniza primavera feliz");
});

test("precio de referencia: elige el de la versión correcta", () => {
  const info = (prices: Record<string, number>) => ({ name: "x", ref: { src: "TCGplayer", prices } });
  assert.equal(refUsd("mtg", { rarity: null, version: "Foil", info: info({ normal: 1, foil: 3 }) }), 3);
  assert.equal(refUsd("mtg", { rarity: null, version: null, info: info({ normal: 1, foil: 3 }) }), 1);
  assert.equal(refUsd("pkm", { rarity: null, version: "Reverse Holo", info: info({ normal: 0.2, reverseHolofoil: 0.9 }) }), 0.9);
  assert.equal(refUsd("pkm", { rarity: null, version: null, info: info({ holofoil: 4 }) }), 4);
  assert.equal(refUsd("ygo", { rarity: "Ultra Rare", version: null, info: info({ "ultra rare": 2, "secret rare": 9 }) }), 2);
  // varias rarezas y la tienda no dice cuál: no se inventa
  assert.equal(refUsd("ygo", { rarity: null, version: null, info: info({ "ultra rare": 2, "secret rare": 9 }) }), null);
  assert.equal(refUsd("op", { rarity: "SR", version: "Parallel", info: info({ normal: 1, parallel: 20 }) }), 20);
  assert.equal(refUsd("digi", { rarity: "R", version: null, info: info({ normal: 1 }) }), null);
  assert.equal(refUsd("mtg", { rarity: null, version: null, info: null }), null);
});

test("mediana de precios publicados", () => {
  assert.equal(median([3000, 1000, 2000]), 2000);
  assert.equal(median([1000, 2000, 3000, 4000]), 2500);
  assert.equal(median([]), null);
});

test("decklist: una carta escrita en español encuentra las publicaciones con el nombre en inglés", () => {
  const l = {
    title: "Ash Blossom & Joyous Spring RA01-EN008", url: "https://a.com/ash", price: 5000, available: true, stock: 2,
    storeId: "a", storeName: "A", storeDomain: "a.com", storeCity: "CABA", hasLocal: true,
    platform: "woocommerce" as const, mode: "live" as const, cashPrice: null, cashLabel: null,
    parsedName: "Ash Blossom & Joyous Spring", code: "RA01-EN008", set: "RA01", rarity: "Super Rare", version: null, edition: null, lang: null, info: null,
  };
  const g: CardGroup = { key: "k", name: "Ash Blossom & Joyous Spring", code: "RA01-EN008", rarity: "Super Rare", version: null, setName: null, info: null, listings: [l] };
  const other: CardGroup = { ...g, key: "k2", name: "Ash Blossom", listings: [{ ...l, url: "https://a.com/x" }] };
  const res: SearchResponse = {
    game: "ygo", q: "Flor de Ceniza & Primavera Feliz", query: "Ash Blossom & Joyous Spring", searchedAt: "", stores: [], cards: [g, other], missing: [], known: true,
    names: { en: "Ash Blossom & Joyous Spring", es: "Flor de Ceniza & Primavera Feliz", typed: "es" },
  };
  const card = matchEntry("ygo", { qty: 3, name: "Flor de Ceniza & Primavera Feliz", code: null, line: "" } as never, res);
  assert.equal(card.offers.length, 1);
  assert.equal(card.offers[0].price, 5000);
});
