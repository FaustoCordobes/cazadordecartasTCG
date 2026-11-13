import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePhoenix, phoenixPath, codesIn, phoenixName } from "../lib/adapters/phoenix.ts";
import { parseTitle } from "../lib/parse.ts";
import { STORES } from "../lib/stores.ts";
import { LINK_STORES } from "../lib/linkstores.ts";

const data = JSON.parse(readFileSync(new URL("./fixtures/phoenix.json", import.meta.url), "utf8"));

test("Phoenix: lee precio, stock, rareza y link de su API", () => {
  const ls = parsePhoenix(data);
  assert.equal(ls.length, 4);
  const [coro, homeros, bancho, omni] = ls;
  assert.equal(coro.price, 595);
  assert.equal(coro.available, true);
  assert.equal(coro.stock, 20);
  assert.equal(coro.name, "Coronamon");
  assert.equal(coro.rarity, "U");
  assert.equal(coro.url, "https://phoenixreborn.com.ar/producto/coronamon-bt25-008-uncommon/");
  assert.equal(homeros.available, false);
  assert.equal(homeros.rarity, "SEC");
  assert.equal(bancho.name, "BanchoLeomon");
  assert.equal(bancho.price, 255);
  assert.equal(omni.name, "Omnimon");
  assert.equal(omni.rarity, "SR");
});

test("Phoenix: el título se entiende igual que el de las otras tiendas", () => {
  const [coro] = parsePhoenix(data);
  const p = parseTitle("digi", coro.title);
  assert.equal(p.code, "BT25-008");
  assert.match(p.name, /Coronamon/);
});

test("Phoenix: códigos en la búsqueda y ruta de la API", () => {
  assert.deepEqual(codesIn("bancholeomon bt20-036"), ["BT20-036"]);
  assert.deepEqual(codesIn("Omnimon"), []);
  assert.equal(phoenixPath(["BT25-008", "BT1-084"]), "/WooCommerceProducts/search?cardIds=BT25-008,BT1-084");
  assert.deepEqual(phoenixName({ id: 1, name: "X", permalink: "u" }), { name: "X", rarity: undefined });
});

test("Phoenix: Digimon en vivo y el resto con búsqueda manual, sin repetir id", () => {
  const live = STORES.find((s) => s.id === "phoenix");
  assert.equal(live?.platform, "phoenix");
  assert.deepEqual(live?.games, ["digi"]);
  const link = LINK_STORES.find((s) => s.name === "Phoenix Reborn");
  assert.ok(link && !link.games.includes("digi"));
  const ids = [...STORES.map((s) => s.id), ...LINK_STORES.map((s) => s.id)];
  assert.equal(new Set(ids).size, ids.length);
});
