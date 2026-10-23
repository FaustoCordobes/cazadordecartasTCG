import type { StoreConfig } from "./types.ts";

/**
 * Tiendas con web que la app consulta.
 *
 * - WooCommerce, Shopify y Casco TCG se consultan EN VIVO en cada búsqueda.
 * - Tiendanube y PrestaShop bloquean su buscador en robots.txt, así que se
 *   INDEXAN: `npm run indexar` recorre sus categorías de Yu-Gi-Oh!/Digimon una
 *   vez por día y guarda el catálogo (ver README).
 * - platform "auto": la plataforma se detecta sola la primera vez.
 *
 * Todas respetan robots.txt: si una tienda bloquea lo que hace falta, se saltea
 * y la app muestra el motivo.
 */
export const STORES: StoreConfig[] = [
  // ---------- En vivo ----------
  {
    id: "rancho", name: "Rancho Store", domain: "ranchostoretcg.com.ar", base: "https://ranchostoretcg.com.ar",
    platform: "woocommerce", games: ["digi"], city: "CABA (Floresta)", province: "CABA", hasLocal: true,
    instagram: "ranchodelprofesor", cashDiscount: { percent: 10, label: "en efectivo" },
  },
  {
    id: "phoenix", name: "Phoenix Reborn", domain: "phoenixreborn.com.ar", base: "https://phoenixreborn.com.ar",
    platform: "woocommerce", games: ["ygo", "digi"], city: "CABA (Villa Devoto)", province: "CABA", hasLocal: true,
    instagram: "phoenixrebornstore",
  },
  {
    id: "azeroth", name: "Azeroth Comic Store", domain: "azerothcomicstore.shop", base: "https://azerothcomicstore.shop",
    platform: "woocommerce", wooApiPrefix: "/index.php/wp-json", games: ["ygo"], city: "La Rioja", province: "La Rioja",
    hasLocal: true, instagram: "azeroth.comicstore",
  },
  {
    id: "lair", name: "Lair (Magic Lair)", domain: "lair.com.ar", base: "https://www.lair.com.ar",
    platform: "shopify", games: ["ygo"], city: "CABA (Caballito)", province: "CABA", hasLocal: true, instagram: "lair_argentina",
  },
  {
    id: "hisui", name: "El Ático de Hisui", domain: "aticodehisui.com", base: "https://aticodehisui.com",
    platform: "shopify", games: ["ygo", "digi"], city: "Mar del Plata", province: "Buenos Aires", hasLocal: true,
    instagram: "el.atico.de.hisui",
  },
  {
    id: "haru", name: "Haru TCG", domain: "harutcg.com", base: "https://harutcg.com",
    platform: "shopify", games: ["ygo"], city: null, province: null, hasLocal: false,
  },
  {
    id: "casco", name: "Casco TCG", domain: "cascotcg.com", base: "https://cascotcg.com",
    platform: "casco", games: ["ygo", "digi"], gameIds: { ygo: 4, digi: 8 }, city: "Rosario", province: "Santa Fe",
    hasLocal: true, instagram: "cascotcg",
  },

  // ---------- Indexadas (Tiendanube) ----------
  {
    id: "cuevadragon", name: "La Cueva Dragon", domain: "lacuevadragon.com", base: "https://lacuevadragon.com",
    platform: "tiendanube", games: ["ygo", "digi"], city: "Córdoba", province: "Córdoba", hasLocal: true, instagram: "lacuevadragon",
    categories: {
      digi: ["/folios-de-cartas/trading-card-game/digimon/"],
      ygo: ["/folios-de-cartas/trading-card-game/yu-gi-oh/"],
    },
  },
  {
    id: "polybius", name: "Polybius", domain: "polybiustore.com.ar", base: "https://www.polybiustore.com.ar",
    platform: "tiendanube", games: ["ygo", "digi"], city: "Merlo", province: "Buenos Aires", hasLocal: true, instagram: "polybius1280",
    categories: { ygo: ["/tcg/yu-gi-oh1/"], digi: ["/tcg/digimon/"] },
  },
  {
    id: "abismo", name: "El Abismo de Helm Wargames", domain: "elabismodehelmwargames.ar", base: "https://www.elabismodehelmwargames.ar",
    platform: "tiendanube", games: ["ygo", "digi"], city: "CABA (Villa Crespo)", province: "CABA", hasLocal: true,
    instagram: "elabismodehelmwargames", categories: { ygo: ["/tcg/yugioh1/"], digi: ["/tcg/digimon1/"] },
  },
  {
    id: "dragones", name: "Aquí hay Dragones", domain: "aquihaydragones.com.ar", base: "https://www.aquihaydragones.com.ar",
    platform: "tiendanube", games: ["ygo"], city: "Mendoza", province: "Mendoza", hasLocal: true, instagram: "aquihaydragonesarg",
    categories: { ygo: ["/tcg/yu-gi-oh/"] },
  },
  {
    id: "confluencia", name: "Confluencia TCG", domain: "confluenciatcg.mitiendanube.com", base: "https://confluenciatcg.mitiendanube.com",
    platform: "tiendanube", games: ["ygo"], city: "Neuquén", province: "Neuquén", hasLocal: true, instagram: "confluenciatcg",
    categories: { ygo: ["/ygo/"] },
  },
  {
    id: "duelistcity", name: "Duelist City", domain: "duelistcity.com.ar", base: "https://www.duelistcity.com.ar",
    platform: "tiendanube", games: ["ygo", "digi"], city: "Villa Ballester", province: "Buenos Aires", hasLocal: true,
    instagram: "duelistcity",
    categories: {
      ygo: ["/juegos-de-cartas-coleccionables/yu-gi-oh/"],
      digi: ["/juegos-de-cartas-coleccionables/digimon/"],
    },
  },
  {
    id: "ludik", name: "Ludik: Legends and Lattes", domain: "ludiktcg.mitiendanube.com", base: "https://ludiktcg.mitiendanube.com",
    platform: "tiendanube", games: ["ygo"], city: "Bahía Blanca", province: "Buenos Aires", hasLocal: true, instagram: "ludik.tcg",
  },

  // ---------- Indexadas (PrestaShop) ----------
  {
    id: "invictvs", name: "Invictvs", domain: "invictvs.com.ar", base: "https://invictvs.com.ar",
    platform: "prestashop", games: ["ygo"], city: "Rosario y Paraná", province: "Santa Fe", hasLocal: true, instagram: "invictvsrosario",
    categories: { ygo: ["/tienda/855-yu-gi-oh"] },
  },

  // ---------- Plataforma a detectar ----------
  {
    id: "spacegaming", name: "Space Gaming", domain: "spacegaminglomas.com", base: "https://spacegaminglomas.com",
    platform: "woocommerce", mode: "index", games: ["ygo", "digi"], city: "Banfield", province: "Buenos Aires", hasLocal: true,
    instagram: "spacegaminglomas",
    // Su robots.txt bloquea la API y la búsqueda; el indexador recorre la categoría (permitida).
    categories: { digi: ["/categoria-producto/digimon/"] },
  },
  {
    id: "hadouken", name: "Hadouken", domain: "hadouken.com.ar", base: "https://hadouken.com.ar",
    platform: "auto", games: ["ygo", "digi"], city: "Córdoba", province: "Córdoba", hasLocal: true, instagram: "hadoukencba",
  },
  {
    id: "batikueva", name: "La Batikueva Store", domain: "labatikuevastore.com", base: "https://www.labatikuevastore.com",
    platform: "auto", games: ["ygo"], city: "CABA (Caballito)", province: "CABA", hasLocal: true, instagram: "La_Batikueva_Store",
  },
  {
    id: "dima", name: "Dima Game", domain: "dimagame.com", base: "https://www.dimagame.com",
    platform: "auto", games: ["ygo", "digi"], city: "CABA (Flores)", province: "CABA", hasLocal: true, instagram: "dimagames",
  },
  {
    id: "tolaria", name: "Tolaria", domain: "tolariashop.com", base: "https://www.tolariashop.com",
    platform: "auto", games: ["ygo"], city: "Mar del Plata", province: "Buenos Aires", hasLocal: true, instagram: "tolariashop",
  },
  {
    id: "lordpipas", name: "Lordpipas Store", domain: "lordpipas.com", base: "https://lordpipas.com",
    platform: "auto", games: ["ygo"], city: "Los Polvorines", province: "Buenos Aires", hasLocal: true, instagram: "lordpipasstore",
  },
  {
    id: "creepshop", name: "Creepshop Castelar", domain: "creepshop.com.ar", base: "https://creepshop.com.ar",
    platform: "auto", games: ["ygo"], city: "Castelar", province: "Buenos Aires", hasLocal: true, instagram: "creepshop.ar",
  },
];

export const storeById = (id: string) => STORES.find((s) => s.id === id);
