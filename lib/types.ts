/** ygo = Yu-Gi-Oh!, digi = Digimon, mtg = Magic, pkm = Pokémon, op = One Piece */
export type Game = "ygo" | "digi" | "mtg" | "pkm" | "op";

/** Plataformas con adaptador. "auto" = se detecta sola la primera vez. */
export type Platform = "woocommerce" | "shopify" | "tiendanube" | "prestashop" | "casco" | "auto";

/** live = se consulta en cada búsqueda; index = se recorre su catálogo una vez por día */
export type Mode = "live" | "index";

export interface StoreConfig {
  id: string;
  name: string;
  domain: string;
  /** URL base sin barra final, ej: https://ranchostoretcg.com.ar */
  base: string;
  platform: Platform;
  /** Forzar modo. Por defecto: live para WooCommerce/Shopify/Casco, index para Tiendanube/PrestaShop. */
  mode?: Mode;
  games: Game[];
  /** Ciudad del local (o null si la tienda es solo online) */
  city: string | null;
  province: string | null;
  hasLocal: boolean;
  instagram?: string;
  /** Precio alternativo (ej. efectivo) */
  cashDiscount?: { percent: number; label: string };
  /** Categorías del catálogo por juego (para tiendas indexadas). Si falta, se buscan solas en la home. */
  categories?: Partial<Record<Game, string[]>>;
  /** WooCommerce sin URLs "lindas" usa /index.php/wp-json */
  wooApiPrefix?: string;
  /** Casco TCG: id interno de cada juego */
  gameIds?: Partial<Record<Game, number>>;
  /** WooCommerce: categoría (slug) de cada juego, para que la búsqueda traiga solo ese juego */
  wooCategory?: Partial<Record<Game, string>>;
  /** Dirección del local, si la tienda la publica */
  address?: string;
  /** Envío publicado por la tienda (solo datos verificados, con fecha): costo y monto desde el que es gratis */
  shipping?: { cost?: number; freeFrom?: number; note?: string; checked: string };
  /** La tienda compra cartas (buylist): link o WhatsApp que la tienda publica o nos pasó */
  buylist?: { url?: string; whatsapp?: string; note?: string; checked: string };
}

/** Lo que devuelve un adaptador, tal cual sale de la tienda */
export interface RawListing {
  title: string;
  url: string;
  price: number;
  /** precio tachado si la tienda lo muestra en oferta */
  comparePrice?: number | null;
  /** true = hay stock, false = agotado, null = la tienda no lo informa */
  available: boolean | null;
  /** cantidad exacta si la tienda la informa */
  stock: number | null;
  image?: string;
  /** Algunas tiendas ya separan estos datos; si vienen, se usan en lugar de leerlos del título */
  name?: string;
  rarity?: string | null;
  setName?: string;
  /** juego según la tienda (categoría, tipo de producto, atributo); null = no lo dice */
  gameHint?: Game | null;
  /** la tienda lo marca como carta suelta (true) o como otro producto (false); null = no lo dice */
  isSingle?: boolean | null;
  lang?: string | null;
  /** Foil, Reverse Holo, Etched... */
  finish?: string | null;
  /** NM, LP, MP, HP, DMG */
  condition?: string | null;
}

/** Ficha oficial de la carta (digimoncard.io / YGOPRODeck), ya traducida */
export interface CardInfo {
  name: string;
  tipo?: string;
  sub?: string;
  extra?: string;
  attr?: string;
  race?: string;
  lvl?: string;
  color?: string[];
  forma?: string;
  /** Digimon: rareza oficial de esa impresión (C, U, R, SR, SEC...) */
  rarity?: string;
  /** Pokémon/One Piece: expansión; Magic: tipo de línea completo */
  setName?: string;
  /** Magic/One Piece: coste; Pokémon: subtipos */
  cost?: string;
  image?: string;
  /**
   * Precio de referencia internacional de esa impresión, en dólares (TCGplayer, EE. UU.).
   * Claves según el juego: normal/foil (Magic), normal/holofoil/reverseHolofoil (Pokémon),
   * rareza normalizada (Yu-Gi-Oh!), normal/parallel (One Piece).
   */
  ref?: { src: string; prices: Record<string, number> };
}

export interface Listing extends RawListing {
  storeId: string;
  storeName: string;
  storeDomain: string;
  storeCity: string | null;
  hasLocal: boolean;
  platform: Exclude<Platform, "auto">;
  mode: Mode;
  cashPrice: number | null;
  cashLabel: string | null;
  /** nombre de la carta según el título de la tienda */
  parsedName: string;
  code: string | null;
  set: string | null;
  rarity: string | null;
  version: string | null;
  edition: string | null;
  lang: string | null;
  condition?: string | null;
}

/** Una versión concreta de una carta: mismo código + rareza + variante (Alter, Foil, Gold...) */
export interface CardGroup {
  key: string;
  name: string;
  code: string | null;
  rarity: string | null;
  version: string | null;
  setName: string | null;
  /** idioma que separa esta versión (null = inglés o la tienda no lo dice) */
  lang?: string | null;
  /** el nombre o el código coincide exacto con lo buscado */
  exact?: boolean;
  /** nombre de la carta en español, cuando es distinto del nombre en inglés */
  altName?: string;
  info: CardInfo | null;
  listings: (Listing & { info: CardInfo | null })[];
}

/** Versiones que existen según la base oficial pero ninguna tienda publicó */
export interface MissingVersion {
  code: string;
  name: string;
  rarity: string | null;
  info: CardInfo;
  image: string | null;
}

export interface StoreStatus {
  id: string;
  name: string;
  domain: string;
  platform: Platform;
  mode: Mode | null;
  ok: boolean;
  count: number;
  ms: number;
  /** tiendas indexadas: cuándo se leyó su catálogo por última vez */
  indexedAt?: string | null;
  error?: string;
}

export interface SearchResponse {
  game: Game;
  q: string;
  /** texto que realmente se buscó en las tiendas (puede ser la traducción al inglés) */
  query: string;
  searchedAt: string;
  stores: StoreStatus[];
  cards: CardGroup[];
  missing: MissingVersion[];
  /** la base oficial reconoce el nombre o código buscado */
  known: boolean;
  /** si no hubo resultados: nombres parecidos para probar */
  didYouMean?: string[];
  /** la carta se buscó con su nombre en inglés y en español */
  names?: { en: string; es: string; typed: "en" | "es" };
}

/** Una publicación guardada en el catálogo indexado */
export interface CatalogItem extends RawListing {
  storeId: string;
  game: Game;
  indexedAt: string;
}
