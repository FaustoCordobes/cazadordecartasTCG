import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDecklist } from "../lib/decklist.ts";

test("Decklist de DigimonCard.io (cantidad, nombre y código)", () => {
  const text = `// DigimonCard.io Deck List
4 Angemon BT25-034
3 Angemon BT23-027
1 Angewomon EX12-044
4 Asuna Shiroki BT24-088
1 Heat Training LM-059
1 Sepia Memory Boost! LM-037
1 Yellow Memory Boost! P-037
2 Yellow Scramble LM-029`;
  const d = parseDecklist(text, "digi");
  assert.equal(d.errors.length, 0);
  assert.equal(d.entries.length, 8);
  assert.equal(d.total, 17);
  assert.deepEqual(d.entries[0], { qty: 4, name: "Angemon", code: "BT25-034", line: 2, raw: "4 Angemon BT25-034" });
  assert.equal(d.entries[1].code, "BT23-027", "dos Angemon distintos quedan separados");
  assert.equal(d.entries[5].name, "Sepia Memory Boost!");
  assert.equal(d.entries[6].code, "P-037");
});

test("Lista simple de Yu-Gi-Oh! con la cantidad al final", () => {
  const text = `Ichiki Sayori-Hime x3
Exosister Betrayal x3
Exosister Karmael x2
Sanaki the Mikanko Devotee x2
Mikanko Shinbu - Noble Twins x3
Uzuhime the Manifested Mikanko x2`;
  const d = parseDecklist(text, "ygo");
  assert.equal(d.errors.length, 0);
  assert.deepEqual(d.entries.map((e) => [e.qty, e.name]), [
    [3, "Ichiki Sayori-Hime"],
    [3, "Exosister Betrayal"],
    [2, "Exosister Karmael"],
    [2, "Sanaki the Mikanko Devotee"],
    [3, "Mikanko Shinbu - Noble Twins"],
    [2, "Uzuhime the Manifested Mikanko"],
  ]);
});

test("Todas las formas de escribir la cantidad", () => {
  const text = [
    "3 Ash Blossom & Joyous Spring",
    "3x Called by the Grave",
    "x2 Infinite Impermanence",
    "-1 Pot of Prosperity",
    "2 - Triple Tactics Talent",
    "Forbidden Droplet 3",
    "Crossout Designator -1",
    "Nibiru, the Primal Being (2)",
    "Droll & Lock Bird: 1",
    "Effect Veiler ×2",
  ].join("\n");
  const d = parseDecklist(text, "ygo");
  assert.equal(d.errors.length, 0, JSON.stringify(d.errors));
  assert.deepEqual(d.entries.map((e) => [e.qty, e.name]), [
    [3, "Ash Blossom & Joyous Spring"],
    [3, "Called by the Grave"],
    [2, "Infinite Impermanence"],
    [1, "Pot of Prosperity"],
    [2, "Triple Tactics Talent"],
    [3, "Forbidden Droplet"],
    [1, "Crossout Designator"],
    [2, "Nibiru, the Primal Being"],
    [1, "Droll & Lock Bird"],
    [2, "Effect Veiler"],
  ]);
});

test("Ignora encabezados y comentarios, avisa lo que no entiende", () => {
  const text = `Main Deck:
3 Ash Blossom & Joyous Spring
Extra Deck (15)
Accesscode Talker
# comentario
1 Accesscode Talker
-----
x3`;
  const d = parseDecklist(text, "ygo");
  assert.deepEqual(d.entries.map((e) => [e.qty, e.name]), [[3, "Ash Blossom & Joyous Spring"], [1, "Accesscode Talker"]]);
  assert.deepEqual(d.errors.map((e) => e.line), [4, 8], "sin cantidad y sin nombre");
  assert.match(d.errors[0].reason, /cantidad/);
});

test("Código entre paréntesis y líneas repetidas", () => {
  const d = parseDecklist("Angemon (BT25-034) x2\n2 Angemon BT25-034\n1 Agumon BT01-010", "digi");
  assert.equal(d.entries.length, 2);
  assert.deepEqual([d.entries[0].qty, d.entries[0].name, d.entries[0].code], [4, "Angemon", "BT25-034"]);
  assert.equal(d.entries[1].code, "BT1-010");
});
