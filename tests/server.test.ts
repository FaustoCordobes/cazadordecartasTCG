import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReport } from "../lib/reports.ts";
import { parseDolar } from "../lib/dolar.ts";
import { historyRows, searchLabel } from "../lib/stats.ts";
import { groupListings } from "../lib/search.ts";
import type { Listing, SearchResponse } from "../lib/types.ts";

test("Reportes: valida tipo, link, email y frena bots", () => {
  assert.equal(typeof validateReport({ tipo: "nada" }), "string");
  assert.equal(typeof validateReport({ tipo: "link", url: "javascript:alert(1)" }), "string");
  assert.equal(typeof validateReport({ tipo: "contacto", comentario: "hola", email: "mal" }), "string");
  assert.equal(typeof validateReport({ tipo: "precio", website: "spam" }), "string");
  const ok = validateReport({ tipo: "precio", game: "op", carta: "Luffy", store_id: "rancho", comentario: "x".repeat(900) });
  assert.ok(typeof ok !== "string");
  assert.equal((ok as { comentario: string }).comentario.length, 600);
});

test("Dólar: se oculta si el dato es viejo o falta", () => {
  const now = Date.parse("2026-10-23T16:00:00Z");
  assert.equal(parseDolar("bolsa", { venta: 1556.6, fechaActualizacion: "2026-10-23T15:59:00Z" }, now)?.venta, 1556.6);
  assert.equal(parseDolar("bolsa", { venta: 1556.6, fechaActualizacion: "2026-10-10T15:59:00Z" }, now), null);
  assert.equal(parseDolar("bolsa", null, now), null);
});

const L = (o: Partial<Listing>): Listing => ({
  title: "t", url: "https://x/" + Math.random(), price: 1000, available: true, stock: null, storeId: "a", storeName: "A", storeDomain: "a",
  storeCity: null, hasLocal: true, platform: "woocommerce", mode: "live", cashPrice: null, cashLabel: null, parsedName: "Sol Ring",
  code: null, set: "CMM", rarity: "Rara", version: "Normal", edition: null, lang: null, ...o,
});

test("Versiones: no se mezcla japonés con inglés, y se marca la coincidencia exacta", () => {
  const idx = { byCode: new Map(), byName: new Map() };
  const g = groupListings("mtg", [L({}), L({ lang: "Inglés", storeId: "b" }), L({ lang: "Japonés", storeId: "c" }), L({ parsedName: "Sol Ring Token" })], idx, "sol ring");
  assert.equal(g.length, 3);
  const main = g.find((x) => x.name === "Sol Ring" && !x.lang)!;
  assert.equal(main.listings.length, 2, "inglés y 'sin dato' van juntos");
  assert.equal(main.exact, true);
  assert.equal(g.find((x) => x.lang === "Japonés")!.listings.length, 1);
  assert.equal(g.find((x) => x.name === "Sol Ring Token")!.exact, false);
});

test("Historial: un precio por versión y tienda (el más bajo con stock)", () => {
  const res = {
    game: "mtg", q: "sol ring", query: "sol ring", searchedAt: "", stores: [], missing: [], known: true,
    cards: [{ key: "k", name: "Sol Ring", code: null, rarity: null, version: null, setName: null, info: null,
      listings: [L({ price: 900 }), L({ price: 700 }), L({ price: 500, available: false }), L({ storeId: "b", price: 800 })].map((x) => ({ ...x, info: null })) }],
  } as SearchResponse;
  const rows = historyRows(res, "2026-10-23");
  assert.deepEqual(rows.map((r) => [r.store_id, r.precio]), [["a", 700], ["b", 800]]);
  assert.equal(searchLabel(res), "Sol Ring");
});

test("Fallas pasajeras: se reintentan; las permanentes no", async () => {
  const { isTransient } = await import("../lib/status.ts");
  assert.ok(isTransient("La tienda tardó más de 8 s"));
  assert.ok(isTransient("No se pudo conectar con la tienda"));
  assert.ok(isTransient("Respondió 503"));
  assert.ok(!isTransient("Respondió 403"));
  assert.ok(!isTransient("Su robots.txt no permite esta búsqueda"));
  assert.ok(!isTransient(undefined));
});
