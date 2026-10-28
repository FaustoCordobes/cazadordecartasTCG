import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { empretiendaPath, parseEmpretienda } from "../lib/adapters/empretienda.ts";
import { toListings } from "../lib/search.ts";
import { STORES } from "../lib/stores.ts";

const html = readFileSync(new URL("./fixtures/empretienda.html", import.meta.url), "utf8");
const store = STORES.find((s) => s.id === "tiendaygo")!;

test("Empretienda: lee nombre, precio, precio tachado, stock, juego e idioma desde la categoría", () => {
  const r = parseEmpretienda("https://ygo.com.ar", html);
  assert.equal(r.length, 4);
  assert.deepEqual([r[0].title, r[0].price, r[0].comparePrice, r[0].available, r[0].gameHint, r[0].isSingle], ["Ash Blossom and Joyous Spring - RA05-EN091", 15000, 20000, false, "ygo", true]);
  assert.equal(r[1].title, "Ash Blossom & Joyous Spring - MGED-EN153");
  assert.equal(r[1].available, true);
  assert.equal(r[2].isSingle, false, "folios = accesorio");
  assert.deepEqual([r[3].gameHint, r[3].lang], ["op", "Japonés"]);
  assert.equal(empretiendaPath("ash blossom"), "/search?q=ash+blossom");
});

test("Empretienda: cada publicación queda en su juego y con su código", () => {
  const raw = parseEmpretienda("https://ygo.com.ar", html);
  const ygo = toListings("ygo", store, "empretienda", "live", raw);
  assert.deepEqual(ygo.map((l) => l.code), ["RA05-EN091", "MGED-EN153"]);
  const op = toListings("op", store, "empretienda", "live", raw);
  assert.deepEqual(op.map((l) => [l.code, l.lang]), [["OP07-091", "Japonés"]]);
});
