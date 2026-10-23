import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// El catálogo local se guarda en <cwd>/.data: se usa una carpeta temporal para no tocar el proyecto
process.chdir(mkdtempSync(path.join(tmpdir(), "cazacartas-")));
const { searchAll } = await import("../lib/search.ts");
const { indexAll } = await import("../lib/indexer.ts");
const { STORES } = await import("../lib/stores.ts");

/**
 * Prueba de punta a punta de la búsqueda, con fetch simulado.
 * Las respuestas son las que dieron las tiendas y las bases de cartas el 23/10/2026.
 */
const RESPONSES: [RegExp, unknown, number?][] = [
  [/ranchostoretcg\.com\.ar\/robots\.txt/, "User-agent: *\nDisallow: /wp-admin/\nDisallow: /*?s=\nDisallow: /*?orderby=\n\nUser-agent: AhrefsBot\nDisallow: /"],
  [/harutcg\.com\/robots\.txt/, "User-agent: *\nDisallow: /cart\nDisallow: /collections/*sort_by*"],
  [/lair\.com\.ar\/robots\.txt/, "", 404],
  [
    /ranchostoretcg\.com\.ar\/wp-json\/wc\/store\/v1\/products\?search=kimeramon/,
    [
      { name: "Kimeramon EX9-074-SEC Alter", permalink: "https://ranchostoretcg.com.ar/producto/kimeramon-ex9-074-sec-alter/", prices: { price: "2880000", currency_minor_unit: 2 }, is_in_stock: false, stock_availability: { text: "Sin existencias" } },
      { name: "Kimeramon BT19-070-U", permalink: "https://ranchostoretcg.com.ar/producto/kimeramon-bt19-070/", prices: { price: "56000", currency_minor_unit: 2 }, is_in_stock: true, stock_availability: { text: "23 disponibles" } },
      { name: "Kimeramon BT18-015-R", permalink: "https://ranchostoretcg.com.ar/producto/kimeramon-bt18-015/", prices: { price: "112000", currency_minor_unit: 2 }, is_in_stock: true, stock_availability: { text: "2 disponibles" } },
      { name: "Kimeramon BT8-084-SR", permalink: "https://ranchostoretcg.com.ar/producto/kimeramon-bt8-084/", prices: { price: "0", currency_minor_unit: 2 }, is_in_stock: false },
      { name: "Torneo Kimeramon Cup", permalink: "https://ranchostoretcg.com.ar/producto/torneo/", prices: { price: "2000000", currency_minor_unit: 2 }, is_in_stock: true },
    ],
  ],
  [
    /digimoncard\.io\/api-public\/search\.php\?n=Kimeramon/,
    [
      { id: "BT18-015", name: "Kimeramon", type: "Digimon", color: "Red", color2: "Purple", level: 5, stage: null, attribute: "Data" },
      { id: "BT19-070", name: "Kimeramon", type: "Digimon", color: "Purple", color2: "Red", level: 5, stage: null, attribute: "Data" },
      { id: "BT2-077", name: "Kimeramon", type: "Digimon", color: "Purple", color2: null, level: 5, stage: "Ultimate", attribute: "Data" },
      { id: "EX9-074", name: "Kimeramon", type: "Digimon", color: "White", color2: null, level: 5, stage: null, attribute: "Data", rarity: "SEC" },
      { id: "BT8-084", name: "Kimeramon", type: "Digimon", color: "White", color2: null, level: 5, stage: null, attribute: "Data", rarity: "sr" },
    ],
  ],
  [
    /harutcg\.com\/search\/suggest\.json/,
    { resources: { results: { products: [
      { title: "Ash Blossom & Joyous Spring (L5DD-ENC09) Common", url: "/products/ash-blossom-joyous-spring-l5dd-enc09-l5dd-enc09-1st-edition?_pos=1", price: "3499.00", available: true },
      { title: "Lonefire Blossom (L5DD-ENA01) Common", url: "/products/lonefire-blossom-l5dd-ena01-1st-edition", price: "899.00", available: true },
    ] } } },
  ],
  [
    /lair\.com\.ar\/search\/suggest\.json/,
    { resources: { results: { products: [
      { title: "Ash Blossom & Joyous Spring [RA01-EN008] Quarter Century Secret Rare", url: "/products/ash-blossom-joyous-spring-ra01-en008-quarter-century-secret-rare", price: "37900.00", available: false },
    ] } } },
  ],
  [/ygoprodeck\.com\/api\/v7\/cardinfo\.php\?fname=ash%20blossom&language=es/, { error: "No card matching your query was found" }, 400],
  [
    /ygoprodeck\.com\/api\/v7\/cardinfo\.php\?fname=Ash/,
    { data: [{ id: 14558127, name: "Ash Blossom & Joyous Spring", type: "Tuner Monster", frameType: "effect", race: "Zombie", attribute: "FIRE", level: 3,
      card_sets: [{ set_code: "L5DD-ENC09", set_rarity: "Common" }, { set_code: "RA01-EN008", set_rarity: "Quarter Century Secret Rare" }] }] },
  ],
  [/lacuevadragon\.com\/robots\.txt/, "User-agent: *\nDisallow: /search/\nDisallow: /checkout/"],
  [/lacuevadragon\.com\/folios-de-cartas\/trading-card-game\/digimon\/\?page=2/, "<html><body>sin productos</body></html>"],
  [
    /lacuevadragon\.com\/folios-de-cartas\/trading-card-game\/digimon\/$/,
    `<div class="js-product-container" data-variants="${JSON.stringify([{ price_number: 900, stock: 3, available: true }]).replace(/"/g, "&quot;")}">
       <a href="https://lacuevadragon.com/productos/kimeramon-bt2-077-r/" title="Kimeramon Ultimate Power BT2-077 # Rare"></a></div>
     <div class="js-product-container" data-variants="${JSON.stringify([{ price_number: 300, stock: 9, available: true }]).replace(/"/g, "&quot;")}">
       <a href="https://lacuevadragon.com/productos/agumon-bt1-010/" title="Agumon New Evolution BT1-010 # Common"></a></div>`,
  ],
];

globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  const hit = RESPONSES.find(([re]) => re.test(url));
  if (!hit) return new Response("not found", { status: 404 });
  const [, body, status = 200] = hit;
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}) as typeof fetch;

test("Indexador: recorre la categoría de Digimon de La Cueva Dragon", async () => {
  const res = await indexAll(STORES, { only: ["cuevadragon"], delayMs: 0 });
  const digi = res.find((r) => r.game === "digi");
  assert.equal(digi?.error, null);
  assert.equal(digi?.count, 2);
});

test("Digimon: Kimeramon en Rancho Store (en vivo) y La Cueva Dragon (catálogo)", async () => {
  const r = await searchAll("digi", "kimeramon");
  const rancho = r.stores.find((s) => s.id === "rancho");
  const cueva = r.stores.find((s) => s.id === "cuevadragon");
  assert.equal(rancho?.ok, true);
  assert.equal(rancho?.mode, "live");
  assert.equal(cueva?.ok, true);
  assert.equal(cueva?.mode, "index");
  assert.equal(cueva?.count, 1, "Agumon no es lo que se buscó");
  assert.ok(r.stores.some((s) => !s.ok), "las tiendas que no responden quedan marcadas");
  // Cada versión es una tarjeta aparte (el torneo y la de precio 0 no cuentan)
  const codes = r.cards.map((c) => `${c.code}${c.version ? " " + c.version : ""}`).sort();
  assert.deepEqual(codes, ["BT18-015", "BT19-070", "BT2-077", "EX9-074 Alter"]);
  assert.ok(r.cards.every((c) => c.name === "Kimeramon"));

  const bt2 = r.cards.find((c) => c.code === "BT2-077")!;
  assert.equal(bt2.listings.length, 1);
  const fromCueva = bt2.listings.find((l) => l.storeId === "cuevadragon");
  assert.equal(fromCueva?.rarity, "R");
  assert.equal(fromCueva?.info?.forma, "Ultimate");
  assert.deepEqual(fromCueva?.info?.color, ["Morado"]);

  const bt19 = r.cards.find((c) => c.code === "BT19-070")!;
  const first = bt19.listings[0];
  assert.equal(bt19.rarity, "U");
  assert.equal(first.price, 560);
  assert.equal(first.stock, 23);
  assert.equal(first.cashPrice, 504);
  assert.deepEqual(first.info?.color, ["Morado", "Rojo"]);
  assert.equal(first.info?.forma, "Ultimate", "la forma se completa con otra impresión");

  // BT8-084 existe pero ninguna tienda la tiene con precio
  assert.deepEqual(r.missing.map((m) => m.code), ["BT8-084"]);
  assert.equal(r.missing[0].rarity, "SR");
  assert.equal(r.missing[0].image, "https://images.digimoncard.io/images/cards/BT8-084.jpg");
});

test("Yu-Gi-Oh!: Ash Blossom en dos tiendas Shopify", async () => {
  const r = await searchAll("ygo", "ash blossom");
  assert.equal(r.stores.find((s) => s.id === "lair")?.ok, true, "Lair sin robots.txt también se consulta");
  assert.equal(r.stores.find((s) => s.id === "haru")?.ok, true);
  // Dos versiones distintas (Lonefire Blossom queda afuera)
  assert.deepEqual(r.cards.map((c) => c.code).sort(), ["L5DD-ENC09", "RA01-EN008"]);
  const haru = r.cards.find((c) => c.code === "L5DD-ENC09")!;
  assert.equal(haru.info?.attr, "FUEGO");
  assert.equal(haru.info?.extra, "Sintonizador");
  assert.equal(haru.listings[0].url, "https://harutcg.com/products/ash-blossom-joyous-spring-l5dd-enc09-l5dd-enc09-1st-edition");
  const qcsr = r.cards.find((c) => c.code === "RA01-EN008")!;
  assert.equal(qcsr.rarity, "Quarter Century Secret Rare");
  assert.equal(qcsr.listings[0].storeName, "Lair (Magic Lair)");
  assert.deepEqual(r.missing, [], "las versiones faltantes solo se listan en Digimon");
});
