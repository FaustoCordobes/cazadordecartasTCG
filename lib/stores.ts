import type { StoreConfig } from "./types.ts";

/**
 * Tiendas con web que la app consulta.
 *
 * - WooCommerce, Shopify y Casco TCG se consultan EN VIVO en cada búsqueda.
 * - Tiendanube y PrestaShop bloquean su buscador en robots.txt, así que se
 *   INDEXAN: `npm run indexar` recorre sus categorías de cada juego una
 *   vez por día y guarda el catálogo (ver README).
 * - platform "auto": la plataforma se detecta sola la primera vez.
 *
 * Todas respetan robots.txt: si una tienda bloquea lo que hace falta, se saltea
 * y la app muestra el motivo. Las tiendas que no se pueden consultar así están en
 * lib/linkstores.ts (la app muestra un link a su buscador).
 */
export const STORES: StoreConfig[] = [
  // ---------- En vivo ----------
  {
    id: "rancho", name: "Rancho Store", domain: "ranchostoretcg.com.ar", base: "https://ranchostoretcg.com.ar",
    platform: "woocommerce", games: ["digi", "op", "pkm", "mtg"], city: "CABA (Floresta)", province: "CABA", hasLocal: true,
    instagram: "ranchodelprofesor", cashDiscount: { percent: 10, label: "en efectivo" },
    wooCategory: { digi: "digimon", op: "one-piece", pkm: "pokemon", mtg: "magic" },
  },
  // Phoenix Reborn pasó a "búsqueda manual" (lib/linkstores.ts): su Cloudflare responde 403 a los servidores.
  {
    id: "gravedad", name: "Gravedad", domain: "gravedad.com.ar", base: "https://gravedad.com.ar",
    platform: "woocommerce", games: ["mtg", "pkm", "op", "digi"], city: "José C. Paz", province: "Buenos Aires", hasLocal: true,
    address: "Roque Sáenz Peña 5086", instagram: "gravedadstore",
  },
  {
    id: "misato", name: "Misato Comics + Games", domain: "misatocomics.com.ar", base: "https://www.misatocomics.com.ar",
    platform: "woocommerce", games: ["pkm", "mtg", "op"], city: "CABA (Monserrat y Flores)", province: "CABA", hasLocal: true,
    address: "Salta 388, Monserrat · Av. Rivadavia 6743 local 63, Flores", instagram: "misatocomics",
    wooCategory: { pkm: "cartas-singles", mtg: "magic-the-gathering", op: "one-piece-tcg" },
  },
  {
    id: "azeroth", name: "Azeroth Comic Store", domain: "azerothcomicstore.shop", base: "https://azerothcomicstore.shop",
    platform: "woocommerce", wooApiPrefix: "/index.php/wp-json", games: ["ygo"], city: "La Rioja", province: "La Rioja",
    hasLocal: true, instagram: "azeroth.comicstore",
  },
  {
    id: "lair", name: "Lair (Magic Lair)", domain: "lair.com.ar", base: "https://www.lair.com.ar",
    platform: "shopify", games: ["ygo", "mtg", "pkm", "op"], city: "CABA (Caballito)", province: "CABA", hasLocal: true, instagram: "lair_argentina",
  },
  {
    id: "morgana", name: "Morgana Store", domain: "morganastore.com.ar", base: "https://morganastore.com.ar",
    platform: "shopify", games: ["mtg", "pkm"], city: null, province: null, hasLocal: false, instagram: "morganastore.arg",
  },
  {
    id: "hisui", name: "El Ático de Hisui", domain: "aticodehisui.com", base: "https://aticodehisui.com",
    platform: "shopify", games: ["ygo", "digi"], city: "Mar del Plata", province: "Buenos Aires", hasLocal: true,
    instagram: "el.atico.de.hisui",
  },
  {
    id: "haru", name: "Haru TCG", domain: "harutcg.com", base: "https://harutcg.com",
    platform: "shopify", games: ["ygo", "op"], city: null, province: null, hasLocal: false,
  },
  {
    id: "casco", name: "Casco TCG", domain: "cascotcg.com", base: "https://cascotcg.com",
    platform: "casco", games: ["ygo", "digi", "mtg", "pkm", "op"], gameIds: { mtg: 1, ygo: 4, pkm: 5, digi: 8, op: 15 }, city: "Rosario", province: "Santa Fe",
    hasLocal: true, instagram: "cascotcg",
  },
  {
    // Empretienda. Catálogo web: el pago y el envío se coordinan por Instagram. Retiro en un punto de encuentro (no es un local).
    id: "tiendaygo", name: "TiendaYGO", domain: "ygo.com.ar", base: "https://ygo.com.ar",
    platform: "empretienda", games: ["ygo", "pkm", "op"], city: "CABA (Almagro, punto de encuentro)", province: "CABA",
    hasLocal: false, instagram: "yugioh_argentina_cards",
  },
  {
    // Empretienda. Cartas sueltas de One Piece y Magic (también Riftbound, que la app todavía no tiene)
    id: "5alacara", name: "5 A La Cara", domain: "5alacara.com.ar", base: "https://www.5alacara.com.ar",
    platform: "empretienda", games: ["op", "mtg"], city: "CABA (Monserrat)", province: "CABA", hasLocal: true,
    address: "Salta 121, Monserrat",
  },
  {
    // Web propia de Yu-Gi-Oh! con catálogo público (api.gardentcg.com.ar)
    id: "garden", name: "GardenTCG", domain: "gardentcg.com.ar", base: "https://gardentcg.com.ar",
    platform: "garden", games: ["ygo"], city: null, province: null, hasLocal: false, instagram: "gardentcg",
  },
  {
    // Web propia de Magic; precios en dólares a la cotización de la tienda
    id: "workshop", name: "La Workshop TCG", domain: "laworkshoptcg.com", base: "https://laworkshoptcg.com",
    platform: "workshop", games: ["mtg"], city: "Buenos Aires", province: null, hasLocal: false, instagram: "laworkshoptcg",
  },

  // ---------- Indexadas (Tiendanube) ----------
  {
    id: "magicgamestore", name: "Magic Game Store", domain: "magicgamestore.com.ar", base: "https://www.magicgamestore.com.ar",
    platform: "tiendanube", games: ["mtg", "pkm", "op", "digi"], city: null, province: null, hasLocal: true,
    address: "Olivera 719, e/ Medrano y Rondeau", instagram: "magic_game_store",
    categories: {
      mtg: ["/tcg/magic/singles/"],
      pkm: ["/tcg/pokemon/pokemon-singles/"],
      op: ["/tcg/one-piece-card-game/singles1/"],
      digi: ["/tcg/digimon-card-game/singles2/"],
    },
  },
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
    // Tiendanube: su robots.txt bloquea el buscador; se lee la categoría de singles una vez por día
    id: "chainlink", name: "ChainlinkTCG", domain: "chainlinktcg.mitiendanube.com", base: "https://chainlinktcg.mitiendanube.com",
    platform: "tiendanube", games: ["ygo"], city: "CABA (retiro por depósito)", province: "CABA", hasLocal: false,
    categories: { ygo: ["/singles/"] },
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

  {
    id: "s32", name: "S32 Supplies", domain: "s32supplies.com.ar", base: "https://www.s32supplies.com.ar",
    platform: "tiendanube", games: ["mtg"], city: null, province: null, hasLocal: false, instagram: "s32supplies",
    categories: { mtg: ["/trading-card-games/mtg-singles/"] },
  },

  // ---------- Indexadas (PrestaShop) ----------
  {
    id: "invictvs", name: "Invictvs", domain: "invictvs.com.ar", base: "https://invictvs.com.ar",
    platform: "prestashop", games: ["ygo"], city: "Rosario y Paraná", province: "Santa Fe", hasLocal: true, instagram: "invictvsrosario",
    categories: { ygo: ["/tienda/855-yu-gi-oh"] },
  },

  // ---------- Plataforma a detectar ----------
  // (Space Gaming pasó a "Buscá en su web": su robots.txt pide 60 s entre consultas y bloquea las URLs con "?")
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
