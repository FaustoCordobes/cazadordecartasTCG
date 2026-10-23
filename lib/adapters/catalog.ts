import { parse, type HTMLElement } from "node-html-parser";
import type { RawListing } from "../types.ts";
import { parseARS } from "../http.ts";
import { decodeEntities } from "../parse.ts";

/**
 * Lectores de páginas de categoría, para las tiendas que se indexan.
 * Cada uno recibe el HTML de una página del listado y devuelve sus productos.
 */

const abs = (base: string, href: string | undefined) =>
  !href ? "" : href.startsWith("http") ? href : href.startsWith("//") ? "https:" + href : base + (href.startsWith("/") ? "" : "/") + href;

// ---------- Tiendanube ----------
// Cada producto del listado trae un atributo data-variants con precio, stock y disponibilidad.
interface TNVariant {
  price_number?: number | null;
  compare_at_price_number?: number | null;
  stock?: number | null;
  available?: boolean;
  image_url?: string | null;
}

export function parseTiendanube(base: string, html: string): RawListing[] {
  const root = parse(html);
  const out: RawListing[] = [];
  for (const c of root.querySelectorAll(".js-product-container[data-variants], [data-product-id][data-variants]")) {
    let variants: TNVariant[] = [];
    try {
      variants = JSON.parse(decodeEntities(c.getAttribute("data-variants") ?? "[]"));
    } catch {
      continue;
    }
    const a = c.querySelector('a[href*="/productos/"]') ?? c.querySelector("a[href]");
    const title = decodeEntities(
      (a?.getAttribute("title") || c.querySelector(".js-item-name, .item-name")?.text || "").trim()
    );
    const url = abs(base, a?.getAttribute("href"));
    if (!title || !url) continue;
    const priced = variants.filter((v) => (v.price_number ?? 0) > 0);
    if (!priced.length) continue;
    const best = [...priced].sort(
      (x, y) => Number(!!y.available) - Number(!!x.available) || (x.price_number ?? 0) - (y.price_number ?? 0)
    )[0];
    const anyAvail = priced.some((v) => v.available);
    const stock = priced.reduce((s, v) => s + (typeof v.stock === "number" ? v.stock : 0), 0);
    const hasStockNumbers = priced.some((v) => typeof v.stock === "number");
    out.push({
      title,
      url,
      price: best.price_number ?? 0,
      comparePrice: best.compare_at_price_number && best.compare_at_price_number > (best.price_number ?? 0) ? best.compare_at_price_number : null,
      available: anyAvail,
      stock: hasStockNumbers ? stock : null, // stock null en Tiendanube = ilimitado
      image: best.image_url ? abs(base, best.image_url.replace(/\\\//g, "/")) : undefined,
    });
  }
  return out;
}

// ---------- PrestaShop 1.7+ ----------
export function parsePrestashop(base: string, html: string): RawListing[] {
  const root = parse(html);
  const out: RawListing[] = [];
  for (const art of root.querySelectorAll("article.product-miniature, .product-miniature")) {
    const a = art.querySelector(".product-title a, h2 a, h3 a");
    const title = decodeEntities((a?.text ?? "").trim());
    const url = abs(base, a?.getAttribute("href"));
    const price = parseARS(art.querySelector(".price, [itemprop=price]")?.text);
    if (!title || !url || !price) continue;
    const regular = parseARS(art.querySelector(".regular-price")?.text);
    const unavailable = !!art.querySelector(".product-unavailable, .out-of-stock") || /agotado|sin stock/i.test(art.text);
    out.push({
      title,
      url,
      price,
      comparePrice: regular > price ? regular : null,
      available: unavailable ? false : null,
      stock: null,
      image: art.querySelector("img")?.getAttribute("data-full-size-image-url") ?? art.querySelector("img")?.getAttribute("src") ?? undefined,
    });
  }
  return out;
}

// ---------- WooCommerce (páginas de categoría) ----------
function amount(el: HTMLElement | null) {
  return el ? parseARS(el.text) : 0;
}

export function parseWooCategory(base: string, html: string): RawListing[] {
  const root = parse(html);
  const out: RawListing[] = [];
  for (const li of root.querySelectorAll("li.product, div.product.type-product")) {
    const a = li.querySelector("a.woocommerce-LoopProduct-link, a.woocommerce-loop-product__link") ?? li.querySelector("a[href]");
    const title = decodeEntities((li.querySelector(".woocommerce-loop-product__title, h2, h3")?.text ?? "").trim());
    const url = abs(base, a?.getAttribute("href"));
    const priceBox = li.querySelector(".price");
    const price = amount(priceBox?.querySelector("ins .amount") ?? priceBox?.querySelector(".amount") ?? null);
    if (!title || !url || !price) continue;
    const regular = amount(priceBox?.querySelector("del .amount") ?? null);
    const cls = li.getAttribute("class") ?? "";
    out.push({
      title,
      url,
      price,
      comparePrice: regular > price ? regular : null,
      available: /\boutofstock\b/.test(cls) ? false : /\binstock\b/.test(cls) ? true : null,
      stock: null,
      image: li.querySelector("img")?.getAttribute("src") ?? undefined,
    });
  }
  return out;
}

/** URL de la página N de una categoría, según la plataforma */
export function pageUrl(platform: "tiendanube" | "prestashop" | "woocommerce", base: string, path: string, n: number) {
  const url = abs(base, path);
  if (n <= 1) return url;
  if (platform === "woocommerce") return url.replace(/\/?$/, "/") + `page/${n}/`;
  return url + (url.includes("?") ? "&" : "?") + `page=${n}`;
}

/**
 * Busca en la home los links a las categorías de cada juego, para las tiendas
 * que no tienen categorías configuradas. Se queda con la más corta (la principal).
 */
export function discoverCategories(base: string, html: string): { ygo: string[]; digi: string[] } {
  const root = parse(html);
  const host = new URL(base).host.replace(/^www\./, "");
  const found = { ygo: new Set<string>(), digi: new Set<string>() };
  for (const a of root.querySelectorAll("a[href]")) {
    const href = abs(base, a.getAttribute("href"));
    let u: URL;
    try {
      u = new URL(href);
    } catch {
      continue;
    }
    if (u.host.replace(/^www\./, "") !== host) continue;
    if (/\/(productos?|products?)\//.test(u.pathname) || /\.html$/.test(u.pathname) || u.search) continue;
    const p = u.pathname.toLowerCase();
    if (/yu-?gi-?oh|\bygo\b/.test(p)) found.ygo.add(u.pathname);
    if (/digimon/.test(p)) found.digi.add(u.pathname);
  }
  const top = (s: Set<string>) => {
    const arr = [...s].sort((a, b) => a.length - b.length);
    return arr.length ? [arr[0]] : [];
  };
  return { ygo: top(found.ygo), digi: top(found.digi) };
}
