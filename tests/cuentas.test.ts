import { test } from "node:test";
import assert from "node:assert/strict";
import { authError, emailOk, mergeSettings, mergeWish, passwordProblem } from "../lib/accountsync.ts";
import type { WishItem, WishState } from "../lib/wishlist.ts";

const item = (id: string, name: string, qty = 1): WishItem => ({
  id, game: "mtg", name, code: null, rarity: null, version: null, qty, offers: [], storeId: "a", addedAt: "",
});
const st = (lists: { id: string; name?: string; items: WishItem[] }[], active = lists[0].id): WishState => ({
  version: 2, active, lists: lists.map((l) => ({ id: l.id, name: l.name ?? l.id, createdAt: "", items: l.items })),
});

test("al ingresar: si la cuenta está vacía queda lo de este navegador, y al revés", () => {
  const local = st([{ id: "principal", items: [item("1", "Sol Ring")] }]);
  assert.equal(mergeWish(local, null), local);
  assert.equal(mergeWish(local, st([{ id: "principal", items: [] }])), local);
  const remote = st([{ id: "principal", items: [item("9", "Opt")] }]);
  assert.deepEqual(mergeWish(st([{ id: "principal", items: [] }]), remote).lists[0].items.map((i) => i.name), ["Opt"]);
});

test("al ingresar desde otro dispositivo se juntan las listas sin duplicar cartas", () => {
  const local = st([{ id: "principal", items: [item("1", "Sol Ring", 2), item("2", "Lightning Bolt")] }, { id: "l2", name: "Commander", items: [item("3", "Atraxa")] }]);
  const remote = st([{ id: "principal", items: [item("x", "Sol Ring", 4), item("y", "Opt")] }, { id: "l3", name: "Modern", items: [item("z", "Ragavan")] }]);
  const m = mergeWish(local, remote);
  assert.deepEqual(m.lists.map((l) => l.id).sort(), ["l2", "l3", "principal"]);
  const main = m.lists.find((l) => l.id === "principal")!;
  assert.deepEqual(main.items.map((i) => i.name).sort(), ["Lightning Bolt", "Opt", "Sol Ring"]);
  assert.equal(main.items.find((i) => i.name === "Sol Ring")!.qty, 2, "gana la de este dispositivo");
  assert.equal(m.active, "principal");
});

test("ajustes: manda lo de este dispositivo, lo que falta se trae de la cuenta", () => {
  const r = mergeSettings({ "cazacartas:provincia": "Neuquén", "cazacartas:envios": null, "cazacartas:plan-prefs": null }, { "cazacartas:provincia": "CABA", "cazacartas:envios": "{\"a\":{\"cost\":5000}}", otra: "x" });
  assert.deepEqual(r, { "cazacartas:provincia": "Neuquén", "cazacartas:envios": "{\"a\":{\"cost\":5000}}" });
});

test("contraseña y mail", () => {
  assert.match(passwordProblem("abc")!, /8 caracteres/);
  assert.match(passwordProblem("abcdefgh")!, /letras y números/);
  assert.match(passwordProblem("abcd1234", "abcd12345")!, /no coinciden/);
  assert.equal(passwordProblem("abcd1234", "abcd1234"), null);
  assert.equal(emailOk("fausto@gmail.com"), true);
  assert.equal(emailOk("fausto@gmail"), false);
  assert.match(authError("Invalid login credentials"), /no son correctos/);
  assert.match(authError("User already registered"), /Ya hay una cuenta/);
});
