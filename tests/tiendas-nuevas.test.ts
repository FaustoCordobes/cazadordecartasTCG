import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGarden, gardenPath } from "../lib/adapters/garden.ts";
import { parseWorkshop } from "../lib/adapters/workshop.ts";
import { parseEmpretienda } from "../lib/adapters/empretienda.ts";
import { toListings } from "../lib/search.ts";
import { STORES } from "../lib/stores.ts";

const store = (id: string) => STORES.find((s) => s.id === id)!;

test("GardenTCG: versión por código y rareza, descuento de la expansión, tokens afuera", () => {
  const r = parseGarden("https://gardentcg.com.ar", [
    { id: 3436, name: "Ash Blossom & Joyous Spring", art: "Alternate art", code: "RA04-EN025", stock: 3, price: "12000.00", state: "active",
      CardName: { slug: "ash-blossom-joyous-spring", Images: [{ webpPath: "/images/cards/14558127.webp" }] }, Set: { name: "Quarter Century Stampede", discount: 10 }, Rarity: { name: "Prismatic Ultimate Rare" } },
    { id: 1722, name: "Ash Blossom & Joyous Spring", code: "RA01-EN008", stock: 0, price: "4000.00", state: "active", CardName: { slug: "ash-blossom-joyous-spring" }, Rarity: { name: "Super Rare" } },
    { id: 5218, name: "Ash Blossom", art: "Ash", code: "FIELD CENTER TOKEN", stock: 1, price: "5000.00", state: "active", CardName: { slug: "ash-blossom" }, Rarity: { name: "Token" } },
  ]);
  assert.equal(r[0].price, 10800);
  assert.equal(r[0].comparePrice, 12000);
  assert.equal(r[0].url, "https://gardentcg.com.ar/singles/ash-blossom-joyous-spring#v3436");
  assert.equal(r[0].image, "https://api.gardentcg.com.ar/images/cards/14558127.webp");
  assert.equal(r[1].available, false);
  assert.equal(r[2].isSingle, false);
  const ls = toListings("ygo", store("garden"), "garden", "live", r);
  assert.deepEqual(ls.map((l) => [l.code, l.rarity]), [["RA04-EN025", "Prismatic Ultimate Rare"], ["RA01-EN008", "Super Rare"]]);
  assert.match(gardenPath("ash blossom"), /name=ash\+blossom/);
});

test("La Workshop: cada publicación (acabado, estado, idioma) en pesos a la cotización de la tienda", () => {
  const r = parseWorkshop("https://laworkshoptcg.com", [{
    name: "Sol Ring", edition_code: "FIC", edition_name: "Final Fantasy Commander", collector_number: "357", rarity_name: "Uncommon",
    listings: [
      { id: 29215, current_price: "14.99", stock_quantity: 1, condition_name: "Near Mint", foil_type_name: "Foil", language_name: "English" },
      { id: 29216, current_price: "2.50", stock_quantity: 0, condition_name: "Lightly Played", foil_type_name: null, language_name: "Spanish" },
    ],
  }], 1600);
  assert.deepEqual(r.map((x) => [x.price, x.finish, x.condition, x.lang, x.available, x.url]), [
    [23984, "Foil", "NM", "Inglés", true, "https://laworkshoptcg.com/card/29215"],
    [4000, null, "LP", "Español", false, "https://laworkshoptcg.com/card/29216"],
  ]);
  const ls = toListings("mtg", store("workshop"), "workshop", "live", r);
  assert.equal(ls.length, 2);
  assert.equal(ls[0].set, "FIC");
});

test("Empretienda: /singles/ cuenta como carta suelta y /producto-sellado/ no (5 A La Cara)", () => {
  const html = `<div class="products-feed__product"><h3 class="products-feed__product-name"><a href="https://www.5alacara.com.ar/singles/one-piece/paramount-war-op02/roronoa-zoro-op02-043">Roronoa Zoro OP02-043</a></h3><p class="products-feed__product-price">$2.200,00</p></div>
  <div class="products-feed__product"><h3 class="products-feed__product-name"><a href="https://www.5alacara.com.ar/producto-sellado/one-piece/booster-op09">Booster OP09</a></h3><p class="products-feed__product-price">$9.000,00</p></div>`;
  const r = parseEmpretienda("https://www.5alacara.com.ar", html);
  assert.deepEqual(r.map((x) => [x.gameHint, x.isSingle]), [["op", true], ["op", false]]);
  const ls = toListings("op", store("5alacara"), "empretienda", "live", r);
  assert.deepEqual(ls.map((l) => l.code), ["OP02-043"]);
});
