import { test } from "node:test";
import assert from "node:assert/strict";
import { convert, diffPct, searchLinks, variantKey, worldRows } from "../lib/worldprice.ts";
import { mtgInfo, pkmInfo } from "../lib/cardinfo.ts";

const rates = { usdArs: 1500, eurUsd: 1.1 };

test("convierte entre pesos, dólares y euros", () => {
  assert.equal(convert(3000, "ARS", "USD", rates), 2);
  assert.equal(convert(2, "USD", "ARS", rates), 3000);
  assert.equal(Math.round(convert(10, "EUR", "USD", rates)! * 100) / 100, 11);
  assert.equal(convert(10, "EUR", "ARS", rates), 16500);
  assert.equal(convert(10, "EUR", "USD", { usdArs: 1500, eurUsd: null }), null, "sin euro no se inventa");
  assert.equal(convert(10, "USD", "ARS", { usdArs: null, eurUsd: null }), null);
  assert.equal(diffPct(3, 2), 50);
  assert.equal(diffPct(1, 2), -50);
  assert.equal(diffPct(null, 2), null);
});

test("elige la variante correcta de cada juego", () => {
  assert.equal(variantKey("mtg", { rarity: null, version: "Foil" }, ["normal", "foil"]), "foil");
  assert.equal(variantKey("mtg", { rarity: null, version: "Foil" }, ["normal"]), null, "no usa el precio normal para una foil");
  assert.equal(variantKey("pkm", { rarity: null, version: "Reverse Holo" }, ["normal", "reverseHolofoil"]), "reverseHolofoil");
  assert.equal(variantKey("ygo", { rarity: "Ultra Rare", version: null }, ["ultra rare", "secret rare"]), "ultra rare");
  assert.equal(variantKey("ygo", { rarity: null, version: null }, ["any"]), "any");
  assert.equal(variantKey("op", { rarity: "SR", version: "Parallel" }, ["normal", "parallel"]), "parallel");
});

test("Magic: TCGplayer y Cardmarket por acabado, con link a la impresión", () => {
  const info = mtgInfo({
    name: "Sol Ring", set: "cmm", set_name: "Commander Masters", collector_number: "395", rarity: "uncommon",
    prices: { usd: "1.50", usd_foil: "4.00", eur: "1.20", eur_foil: null },
    purchase_uris: { tcgplayer: "https://tcgplayer.example/sol", cardmarket: "https://cardmarket.example/sol" },
  });
  const rows = worldRows("mtg", { rarity: null, version: null, info });
  assert.deepEqual(rows.map((r) => [r.site, r.currency, r.main]), [["TCGplayer", "USD", 1.5], ["Cardmarket", "EUR", 1.2]]);
  assert.equal(rows[0].url, "https://tcgplayer.example/sol");
  const foil = worldRows("mtg", { rarity: null, version: "Foil", info });
  assert.deepEqual(foil.map((r) => [r.site, r.main]), [["TCGplayer", 4]], "Cardmarket no tiene precio foil: no se muestra");
});

test("Pokémon: mercado, bajo, medio y alto de TCGplayer, y tendencia de Cardmarket", () => {
  const info = pkmInfo({
    id: "sv3-125", name: "Charizard ex", supertype: "Pokémon", number: "125", set: { id: "sv3", name: "Obsidian Flames", printedTotal: 197 },
    tcgplayer: { url: "https://t/x", prices: { holofoil: { market: 10.5, low: 8, mid: 11, high: 30 } } },
    cardmarket: { url: "https://c/x", prices: { trendPrice: 9.2, averageSellPrice: 9, lowPrice: 6 } },
  });
  const rows = worldRows("pkm", { rarity: null, version: null, info });
  assert.equal(rows[0].site, "TCGplayer");
  assert.equal(rows[0].main, 10.5);
  assert.deepEqual(rows[0].extra.map((e) => e.label), ["Más bajo", "Medio", "Más alto"]);
  assert.equal(rows[1].mainLabel, "Tendencia");
  assert.equal(rows[1].main, 9.2);
});

test("sin precios: links de búsqueda", () => {
  assert.deepEqual(worldRows("digi", { rarity: null, version: null, info: { name: "Agumon" } }), []);
  assert.match(searchLinks("digi", "Agumon").tcg, /digimon-card-game.*Agumon/);
});

import { priceVersions } from "../lib/worldlist.ts";
test("calculadora: versiones con precio, la carta buscada primero", () => {
  const sol = { name: "Sol Ring", setName: "CMM", rarity: "Rara", market: { tcg: { normal: { market: 1.5 }, foil: { market: 4 } }, cm: { normal: { trend: 1.2 } } } };
  const other = { name: "Sol Ring Token", market: { tcg: { normal: { market: 9 } } } };
  const idx = { byCode: new Map([["CMM-395", sol], ["sol ring@CMM", sol], ["TOK-1", other]]), byName: new Map([["sol ring", { name: "Sol Ring" }]]) };
  const v = priceVersions("mtg", idx as never, "Sol Ring");
  assert.deepEqual(v.map((x) => [x.name, x.variant, x.usd, x.eur]), [["Sol Ring", "Foil", 4, null], ["Sol Ring", "Normal", 1.5, 1.2], ["Sol Ring Token", "Normal", 9, null]]);
});
