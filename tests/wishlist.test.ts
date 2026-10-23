import { test } from "node:test";
import assert from "node:assert/strict";
import { addItem, buildShareText, SHARE_WARNING, whatsappLink, type WishItem } from "../lib/wishlist.ts";

const rancho = { storeId: "rancho", storeName: "Rancho Store", storeCity: "CABA", price: 560, url: "https://ranchostoretcg.com.ar/producto/kimeramon-bt19-070/", stock: 23 };
const cueva = { storeId: "cuevadragon", storeName: "La Cueva Dragon", storeCity: "Córdoba", price: 900, url: "https://lacuevadragon.com/productos/kimeramon/", stock: 3 };
const phoenix = { storeId: "phoenix", storeName: "Phoenix Reborn", storeCity: "CABA", price: 4200, url: "https://phoenixreborn.com.ar/producto/machinedramon/", stock: null };

test("Agregar la misma carta suma copias y conserva la tienda elegida", () => {
  let list: WishItem[] = [];
  list = addItem(list, { game: "digi", name: "Kimeramon", code: "BT19-070", rarity: "U", version: null, qty: 1, offers: [rancho, cueva], storeId: "rancho" });
  list = addItem(list, { game: "digi", name: "Kimeramon", code: "BT19-070", rarity: "U", version: null, qty: 2, offers: [rancho], storeId: "rancho" });
  assert.equal(list.length, 1);
  assert.equal(list[0].qty, 3);
  assert.deepEqual(list[0].offers.map((o) => o.storeId), ["rancho", "cuevadragon"]);
});

test("Texto para compartir por WhatsApp", () => {
  const list: WishItem[] = [
    { id: "a", game: "digi", name: "Kimeramon", code: "BT19-070", rarity: "U", version: null, qty: 3, offers: [rancho, cueva], storeId: "rancho", addedAt: "" },
    { id: "b", game: "digi", name: "Machinedramon", code: "BT4-111", rarity: "SEC", version: "Alter", qty: 3, offers: [phoenix], storeId: "phoenix", addedAt: "" },
  ];
  const text = buildShareText(list, new Date(2026, 9, 23, 5, 10));
  assert.match(text, /\*Kimeramon BT19-070\* — 3 copias en Rancho Store/);
  assert.match(text, /https:\/\/ranchostoretcg\.com\.ar\/producto\/kimeramon-bt19-070\//);
  assert.match(text, /\*Machinedramon BT4-111 Alter\* — 3 copias en Phoenix Reborn/);
  assert.match(text, /Total estimado: \*\$\s?14\.280\*/);
  assert.ok(text.trim().endsWith(SHARE_WARNING), "el aviso va al final");
  assert.ok(whatsappLink(text).startsWith("https://wa.me/?text=%F0%9F%83%8F"));
});
