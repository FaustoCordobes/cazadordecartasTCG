import { test } from "node:test";
import assert from "node:assert/strict";
import { cardUrl, deckUrl, readParams } from "../lib/share.ts";
import { priceFreshness, agoText } from "../lib/freshness.ts";
import { sameArea } from "../lib/provinces.ts";

test("Link de una carta ida y vuelta", () => {
  const url = cardUrl("https://x.app", "ygo", "Ash Blossom & Joyous Spring");
  const p = readParams(new URL(url).search);
  assert.deepEqual(p, { game: "ygo", card: "Ash Blossom & Joyous Spring", deck: null });
});

test("Link de un listado ida y vuelta", () => {
  const url = deckUrl("https://x.app", "digi", [{ qty: 4, name: "Angemon", code: "BT25-034" }, { qty: 2, name: "Yellow Scramble", code: null }]);
  const p = readParams(new URL(url).search);
  assert.equal(p.game, "digi");
  assert.equal(p.deck, "4 Angemon BT25-034\n2 Yellow Scramble");
});

test("Parámetros inválidos se ignoran", () => {
  assert.deepEqual(readParams("?juego=magic&carta=%20"), { game: null, card: null, deck: null });
});

test("Antigüedad del precio", () => {
  const now = Date.parse("2026-10-23T15:00:00Z");
  assert.deepEqual(priceFreshness("live", null, now), { text: "Precio en vivo", stale: false });
  assert.deepEqual(priceFreshness("index", "2026-10-23T12:00:00Z", now), { text: "Precio de hace 3 h", stale: false });
  assert.equal(priceFreshness("index", "2026-10-21T12:00:00Z", now).stale, true);
  assert.equal(agoText("2026-10-23T14:50:00Z", now), "hace minutos");
});

test("Cercanía por provincia", () => {
  assert.ok(sameArea("CABA", "Buenos Aires"));
  assert.ok(sameArea("Neuquén", "Neuquén"));
  assert.ok(!sameArea("Neuquén", "Río Negro"));
  assert.ok(!sameArea(null, "CABA"));
});
