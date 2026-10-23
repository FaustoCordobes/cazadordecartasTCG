import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMagic, parseOnePiece, parsePokemon } from "../lib/parse.ts";
import { gameFromText } from "../lib/games.ts";
import { mapWoo } from "../lib/adapters/woocommerce.ts";
import { mapShopify } from "../lib/adapters/shopify.ts";
import { parseTiendanube, discoverCategories } from "../lib/adapters/catalog.ts";
import { toListings } from "../lib/search.ts";
import { parseDecklist } from "../lib/decklist.ts";
import { parseCrawlDelay, parseRobots, isPathAllowed } from "../lib/robots.ts";
import { cardUrl, readParams } from "../lib/share.ts";
import { linkFor, LINK_STORES } from "../lib/linkstores.ts";
import { STORES } from "../lib/stores.ts";
import type { StoreConfig } from "../lib/types.ts";

test("One Piece: código, rareza y Parallel desde títulos reales", () => {
  const a = parseOnePiece("Monkey.d.luffy OP17-093-SR Alter");
  assert.deepEqual([a.name, a.code, a.rarity, a.version], ["Monkey.d.luffy", "OP17-093", "SR", "Parallel"]);
  const b = parseOnePiece("Monkey.D.Luffy (118) - OP10-118 SEC (Parallel) - Royal Blood (OP10)");
  assert.deepEqual([b.name, b.code, b.rarity, b.version], ["Monkey.D.Luffy", "OP10-118", "SEC", "Parallel"]);
  const c = parseOnePiece("Luffy Is the Man Who Will Become the King of Pirates!!! – Starter Deck 32: GREEN Roronoa Zoro (OP12-039 R)");
  assert.equal(c.code, "OP12-039");
  assert.equal(c.rarity, "R");
});

test("Pokémon: número, expansión y rareza", () => {
  const a = parsePokemon("Pikachu (56) – 56/236 – SM – Unified Minds (SM11) – Common");
  assert.deepEqual([a.name, a.code, a.set, a.rarity], ["Pikachu", "56/236", "SM11", "Common"]);
  const b = parsePokemon("Pikachu ex – 057/191 – Ultra Rare");
  assert.deepEqual([b.name, b.code, b.rarity], ["Pikachu ex", "57/191", "Ultra Rare"]);
  assert.equal(parsePokemon("Solrock (69/147) [Sun & Moon: Burning Shadows]").set, "Sun & Moon: Burning Shadows");
});

test("Magic: set, número, foil e idioma", () => {
  const a = parseMagic("The Ten Rings - Marvel Super Heroes (MSH) #251 - Foil - Inglés");
  assert.deepEqual([a.name, a.code, a.version, a.lang], ["The Ten Rings", "MSH-251", "Foil", "Inglés"]);
  const b = parseMagic("Teferi's Protection MTG - Strixhaven Mystical Archive #11 [STA] (Español)");
  assert.deepEqual([b.name, b.set, b.lang], ["Teferi's Protection", "STA", "Español"]);
});

test("Reconocer el juego por la categoría o el tipo de la tienda", () => {
  assert.equal(gameFromText("Single Magic: The Gathering"), "mtg");
  assert.equal(gameFromText("Pokemon Single"), "pkm");
  assert.equal(gameFromText("one-piece op17"), "op");
  assert.equal(gameFromText("accesorios"), null);
  assert.equal(gameFromText("pokemon digimon"), null, "si nombra dos juegos no se adivina");
});

test("WooCommerce: atributos de Gravedad y filtro por juego", () => {
  const ls = mapWoo([
    {
      name: "Sol Ring: Foundations Commander Foil", permalink: "https://g/sol", is_in_stock: true,
      prices: { price: "6200", currency_minor_unit: 0 }, categories: [{ slug: "cartas-sueltas" }],
      attributes: [
        { name: "Juego", terms: [{ slug: "magic-the-gathering", name: "Magic: The Gathering" }] },
        { name: "Idioma", terms: [{ slug: "ingles", name: "Inglés" }] },
        { name: "Rareza", terms: [{ slug: "infrecuente", name: "Infrecuente" }] },
        { name: "Foil / Acabado", terms: [{ slug: "foil", name: "Foil" }] },
        { name: "Condición", terms: [{ slug: "nueva", name: "Nueva" }] },
      ],
    },
  ]);
  assert.deepEqual([ls[0].gameHint, ls[0].isSingle, ls[0].lang, ls[0].finish, ls[0].condition], ["mtg", true, "Inglés", "Foil", "NM"]);
  const store = { id: "x", name: "X", domain: "x", base: "https://x", platform: "woocommerce", games: ["mtg"], city: null, province: null, hasLocal: false } as StoreConfig;
  const mtg = toListings("mtg", store, "woocommerce", "live", ls);
  assert.equal(mtg.length, 1);
  assert.equal(mtg[0].rarity, "Infrecuente");
  assert.equal(mtg[0].version, "Foil");
  assert.equal(toListings("pkm", store, "woocommerce", "live", ls).length, 0, "una carta de Magic no aparece en Pokémon");
});

test("Shopify: el tipo de producto separa cartas sueltas de figuras y sobres", () => {
  const ls = mapShopify("https://lair", {
    resources: { results: { products: [
      { title: "Pikachu (26/83) [XY: Generations]", url: "/products/p", price: "2800.00", available: true, type: "Pokemon Single", tags: ["Common", "Normal"] },
      { title: "Pokémon Model Kit: Pikachu", url: "/products/k", price: "40050.00", available: true, type: "Model Kits", tags: ["pokemon"] },
      { title: "Fluffal Dolphin [ROTD-EN021] Common", url: "/products/f", price: "500.00", available: true, type: "Yugioh Single", tags: [] },
    ] } },
  });
  const store = { id: "lair", name: "Lair", domain: "lair", base: "https://lair", platform: "shopify", games: ["pkm"], city: null, province: null, hasLocal: true } as StoreConfig;
  const pk = toListings("pkm", store, "shopify", "live", ls);
  assert.deepEqual(pk.map((l) => [l.parsedName, l.code]), [["Pikachu", "26/83"]]);
});

test("Tiendanube con otra plantilla (sin data-variants)", () => {
  const html = `<div class="js-item-product item"><div class="item-product-card"><div class="labels"><div class="js-stock-label label" style="display:none;"></div></div>
    <a href="https://m/productos/teferi/" title="Teferi's Protection MTG - Strixhaven Mystical Archive #11 [STA] (Español)" class="item-link">
    <div class="js-item-name item-name">Teferi's Protection MTG</div>
    <span class="js-price-display item-price" data-product-price="7800000"> $78.000,00 </span></a></div></div>`;
  const ls = parseTiendanube("https://m", html);
  assert.equal(ls.length, 1);
  assert.equal(ls[0].price, 78000);
  assert.equal(ls[0].available, true);
});

test("Encontrar las categorías de cada juego en la home", () => {
  const html = `<a href="/tcg/magic/singles/">Magic</a><a href="/tcg/magic/">Magic</a><a href="/tcg/pokemon/pokemon-singles/">P</a><a href="/tcg/one-piece-card-game/">OP</a>`;
  const c = discoverCategories("https://m.com", html);
  assert.deepEqual(c.mtg, ["/tcg/magic/singles/"]);
  assert.deepEqual(c.pkm, ["/tcg/pokemon/pokemon-singles/"]);
  assert.deepEqual(c.op, ["/tcg/one-piece-card-game/"]);
});

test("Decklists de Pokémon TCG Live, Magic Arena y One Piece", () => {
  const p = parseDecklist("Pokémon: 12\n3 Charizard ex OBF 125\nTrainer: 30\n4 Iono PAL 185\nEnergy: 8\n8 Fire Energy", "pkm");
  assert.deepEqual(p.entries.map((e) => [e.qty, e.name]), [[3, "Charizard ex"], [4, "Iono"], [8, "Fire Energy"]]);
  assert.equal(p.errors.length, 0);
  const m = parseDecklist("Deck\n2 Sol Ring (CMM) 395\n1 Lightning Bolt (2X2) 117 *F*\nSideboard\n3 Pyroblast", "mtg");
  assert.deepEqual(m.entries.map((e) => [e.qty, e.name]), [[2, "Sol Ring"], [1, "Lightning Bolt"], [3, "Pyroblast"]]);
  const o = parseDecklist("1 OP01-001 Roronoa Zoro\n4x OP01-016 Nami", "op");
  assert.deepEqual(o.entries.map((e) => [e.qty, e.name, e.code]), [[1, "Roronoa Zoro", "OP01-001"], [4, "Nami", "OP01-016"]]);
});

test("robots.txt: Crawl-delay y bloqueo de URLs con ?", () => {
  const txt = "User-agent: *\nDisallow:\nCrawl-delay: 60\nDisallow: /*?\n";
  assert.equal(parseCrawlDelay(txt), 60);
  assert.equal(isPathAllowed(parseRobots(txt), "/wp-json/wc/store/v1/products?search=x"), false);
  assert.equal(parseCrawlDelay("User-agent: GPTBot\nCrawl-delay: 10\n"), null, "solo cuenta lo que aplica a todos");
});

test("Links de los juegos nuevos y de las tiendas con buscador propio", () => {
  const p = readParams(new URL(cardUrl("https://x", "op", "Monkey.D.Luffy")).search);
  assert.deepEqual([p.game, p.card], ["op", "Monkey.D.Luffy"]);
  assert.equal(readParams("?juego=pokemon").game, "pkm");
  const pirulo = LINK_STORES.find((s) => s.id === "mtgpirulo")!;
  assert.equal(linkFor(pirulo, "mtg", "Sol Ring"), "https://mtgpirulo.com/search.php?search_query=Sol%20Ring");
  const refugio = LINK_STORES.find((s) => s.id === "elrefugio")!;
  assert.equal(linkFor(refugio, "pkm", "Pikachu"), "https://elrefugiosingles.com.ar/pokemon");
});

test("Ninguna tienda está a la vez en búsqueda automática y en el directorio de links", () => {
  const auto = new Set(STORES.map((s) => s.id));
  assert.deepEqual(LINK_STORES.filter((s) => auto.has(s.id)).map((s) => s.id), []);
});
