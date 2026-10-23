import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTiendanube, parseWooCategory, parsePrestashop, discoverCategories, pageUrl } from "../lib/adapters/catalog.ts";
import { parseCasco } from "../lib/adapters/casco.ts";
import { detectFromHtml } from "../lib/detect.ts";
import { parseARS } from "../lib/http.ts";

// Marcado tomado de las páginas reales el 23/10/2026 (recortado)

const TN_ITEM = (name: string, slug: string, price: number, stock: number | null, available = true) => `
<div class="js-product-container js-quickshop-container position-relative" data-variants="${JSON.stringify([
  { product_id: 1, price_number: price, compare_at_price_number: null, stock, available, image_url: "\\/\\/acdn-us.mitiendanube.com\\/stores\\/006\\/x.webp" },
]).replace(/"/g, "&quot;")}">
  <a href="https://lacuevadragon.com/productos/${slug}/" title="${name}"><img src="x.webp"></a>
  <div class="js-item-name item-name">${name}</div>
</div>`;

test("Tiendanube: lee precio, stock y link del atributo data-variants (La Cueva Dragon)", () => {
  const html = TN_ITEM("Impmon Dawn of Liberator EX11-047 # Common", "impmon-dawn-of-liberator-ex11-047-common-1562t", 450, 26)
    + TN_ITEM("Loudmon Dawn of Liberator EX11-050 # Uncommon", "loudmon-ex11-050", 450, 0, false);
  const items = parseTiendanube("https://lacuevadragon.com", html);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Impmon Dawn of Liberator EX11-047 # Common");
  assert.equal(items[0].price, 450);
  assert.equal(items[0].stock, 26);
  assert.equal(items[0].available, true);
  assert.equal(items[0].url, "https://lacuevadragon.com/productos/impmon-dawn-of-liberator-ex11-047-common-1562t/");
  assert.equal(items[0].image, "https://acdn-us.mitiendanube.com/stores/006/x.webp");
  assert.equal(items[1].available, false);
});

test("Casco TCG: lee los datos del botón Agregar", () => {
  const html = `<div class="card"><a href="https://cascotcg.com/Productpage/320047"><img src="x"></a>
    <span class="casco-card-price" data-price-for="320047">ARS 7.900,00</span>
    <button type="button" class="btn btn-primary w-100 add-to-cart-btn" data-id="320047" data-name="Dark Magician Girl"
      data-price="ARS 7.900,00" data-version="Secret Rare" data-expansion="Battles of Legend: Glorious Gallery"
      data-image="https://cardtrader.com/x.jpg" data-stock="1" data-listing-id="320047" data-rarity="Secret Rare">Agregar</button></div>`;
  const [it] = parseCasco("https://cascotcg.com", html);
  assert.equal(it.name, "Dark Magician Girl");
  assert.equal(it.price, 7900);
  assert.equal(it.stock, 1);
  assert.equal(it.rarity, "Secret Rare");
  assert.equal(it.setName, "Battles of Legend: Glorious Gallery");
  assert.equal(it.url, "https://cascotcg.com/Productpage/320047");
});

test("WooCommerce: página de categoría (marcado estándar)", () => {
  const html = `<ul class="products">
    <li class="product type-product instock"><a href="https://spacegaminglomas.com/tienda/agumon-bt12-034/" class="woocommerce-LoopProduct-link woocommerce-loop-product__link">
      <h2 class="woocommerce-loop-product__title">Agumon – BT12-034 (C)</h2>
      <span class="price"><del><span class="woocommerce-Price-amount amount">$&nbsp;600,00</span></del> <ins><span class="woocommerce-Price-amount amount">$&nbsp;500,00</span></ins></span></a></li>
    <li class="product type-product outofstock"><a href="https://spacegaminglomas.com/tienda/abbadomon/" class="woocommerce-LoopProduct-link">
      <h2 class="woocommerce-loop-product__title">Abbadomon – Versus Monsters (EX9-055 R)</h2>
      <span class="price"><span class="woocommerce-Price-amount amount">$&nbsp;1.800,00</span></span></a></li></ul>`;
  const items = parseWooCategory("https://spacegaminglomas.com", html);
  assert.equal(items.length, 2);
  assert.equal(items[0].price, 500);
  assert.equal(items[0].comparePrice, 600);
  assert.equal(items[0].available, true);
  assert.equal(items[1].price, 1800);
  assert.equal(items[1].available, false);
});

test("PrestaShop: página de categoría (marcado estándar)", () => {
  const html = `<article class="product-miniature js-product-miniature" data-id-product="17261">
    <img src="https://invictvs.com.ar/x.jpg"><h2 class="h3 product-title"><a href="https://invictvs.com.ar/tienda/yu-gi-oh/1-ash.html">Ash Blossom &amp; Joyous Spring RA01-EN008</a></h2>
    <span class="price">$ 4.500,00</span></article>`;
  const [it] = parsePrestashop("https://invictvs.com.ar", html);
  assert.equal(it.title, "Ash Blossom & Joyous Spring RA01-EN008");
  assert.equal(it.price, 4500);
});

test("Paginación y detección de categorías", () => {
  assert.equal(pageUrl("tiendanube", "https://x.com", "/tcg/digimon/", 3), "https://x.com/tcg/digimon/?page=3");
  assert.equal(pageUrl("woocommerce", "https://x.com", "/categoria-producto/digimon/", 2), "https://x.com/categoria-producto/digimon/page/2/");
  const cats = discoverCategories("https://www.polybiustore.com.ar", `
    <a href="/tcg/yu-gi-oh1/">Yu-Gi-Oh!</a><a href="/tcg/yu-gi-oh1/sobres/">Sobres</a>
    <a href="https://www.polybiustore.com.ar/tcg/digimon/">Digimon</a><a href="/productos/digimon-bt1/">x</a>
    <a href="https://otra.com/digimon/">otra</a>`);
  assert.deepEqual(cats, { ygo: ["/tcg/yu-gi-oh1/"], digi: ["/tcg/digimon/"] });
});

test("Detección de plataforma por el HTML de la home", () => {
  assert.equal(detectFromHtml('<img src="https://acdn-us.mitiendanube.com/stores/1.png">'), "tiendanube");
  assert.equal(detectFromHtml('<link href="/cdn/shop/t/1/assets/x.css">'), "shopify");
  assert.equal(detectFromHtml('<link href="/wp-content/plugins/woocommerce/x.css">'), "woocommerce");
  assert.equal(detectFromHtml("<script>var prestashop = {};</script>"), "prestashop");
  assert.equal(detectFromHtml("<html>hola</html>"), "desconocida");
});

test("Precios en pesos", () => {
  assert.equal(parseARS("$ 1.234,56"), 1234.56);
  assert.equal(parseARS("ARS 7.900,00"), 7900);
  assert.equal(parseARS("3499.00"), 3499);
  assert.equal(parseARS("$ 12.499"), 12499);
});
