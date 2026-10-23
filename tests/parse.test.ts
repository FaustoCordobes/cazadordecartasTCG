import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDigimon, parseYgo, matchesQuery, decodeEntities } from "../lib/parse.ts";
import { isPathAllowed, parseRobots } from "../lib/robots.ts";

// Títulos reales tomados de las tiendas el 23/10/2026

test("Digimon: código, rareza y versión (Rancho Store)", () => {
  assert.deepEqual(
    (({ name, code, set, rarity, version }) => ({ name, code, set, rarity, version }))(parseDigimon("Omnimon AD1-025-SEC Alter")),
    { name: "Omnimon", code: "AD1-025", set: "AD1", rarity: "SEC", version: "Alter" }
  );
  const x = parseDigimon("Omnimon (X Antibody) BT20-102-SEC Foil");
  assert.equal(x.name, "Omnimon (X Antibody)");
  assert.equal(x.version, "Foil");
  const s = parseDigimon("Omnimon Alter-s EX9-021-SR");
  assert.equal(s.name, "Omnimon Alter-s");
  assert.equal(s.version, "Normal", "Alter-S es parte del nombre, no la versión");
  assert.equal(parseDigimon("Kimeramon BT2-077-R").code, "BT2-077");
  assert.equal(parseDigimon("Agumon BT01-010").code, "BT1-010", "BT01 se normaliza a BT1");
});

test("Yu-Gi-Oh!: formatos de Haru TCG, Lair y Pokeshopcoast", () => {
  const h = parseYgo("Ash Blossom & Joyous Spring (L5DD-ENC09) Common");
  assert.equal(h.name, "Ash Blossom & Joyous Spring");
  assert.equal(h.code, "L5DD-ENC09");
  assert.equal(h.rarity, "Common");
  assert.equal(h.lang, "Inglés");

  const l = parseYgo("Ash Blossom & Joyous Spring [RA01-EN008] Quarter Century Secret Rare");
  assert.equal(l.code, "RA01-EN008");
  assert.equal(l.rarity, "Quarter Century Secret Rare");
  assert.equal(l.name, "Ash Blossom & Joyous Spring");

  const p = parseYgo("Dark Magician - SBC1-ENG01 - Secret Rare 1st Edition - Near Mint");
  assert.equal(p.name, "Dark Magician");
  assert.equal(p.code, "SBC1-ENG01");
  assert.equal(p.rarity, "Secret Rare");
  assert.equal(p.edition, "1st Edition");

  const g = parseYgo("Dark Magician (G) (SBC1-ENG10) Common");
  assert.equal(g.name, "Dark Magician");

  const dt = parseYgo("Dark Magician (DT01-EN002) Duel Terminal Rare Parallel Rare");
  assert.equal(dt.rarity, "Duel Terminal Parallel Rare");

  const alt = parseYgo("Ash Blossom & Joyous Spring (Alternate Art) [RA04-EN025] Super Rare");
  assert.equal(alt.version, "Arte alternativo");
  assert.equal(alt.rarity, "Super Rare");
});

test("matchesQuery descarta cartas que solo se parecen", () => {
  assert.ok(matchesQuery("Ash Blossom & Joyous Spring (L5DD-ENC09) Common", "ash blossom"));
  assert.ok(!matchesQuery("Lonefire Blossom (L5DD-ENA01) Common", "ash blossom"));
  assert.ok(matchesQuery("Blue-Eyes White Dragon (LOB-001)", "blue eyes white dragon"));
  assert.ok(matchesQuery("Kimeramon BT19-070-U", "BT19-070"));
});

test("decodeEntities (WooCommerce manda HTML en los nombres)", () => {
  assert.equal(decodeEntities("Ash Blossom &amp; Joyous Spring &#8211; Promo"), "Ash Blossom & Joyous Spring – Promo");
});

test("robots.txt: Tiendanube bloquea /search, Shopify permite suggest.json", () => {
  const tn = parseRobots("User-agent: *\nDisallow: /search/\nDisallow: /checkout/");
  assert.equal(isPathAllowed(tn, "/search/?q=omnimon"), false);
  assert.equal(isPathAllowed(tn, "/productos/omnimon/"), true);
  const shop = parseRobots("User-agent: *\nDisallow: /search\nAllow: /search/suggest.json\n\nUser-agent: Googlebot\nDisallow: /");
  assert.equal(isPathAllowed(shop, "/search/suggest.json?q=x"), true);
  assert.equal(isPathAllowed(shop, "/search?q=x"), false);
});
