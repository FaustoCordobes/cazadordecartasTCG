import type { Game } from "./types.ts";

/**
 * Tiendas que la app NO consulta sola, pero que se muestran en el directorio con un link
 * a su buscador (lo abre la persona, como cualquier visita normal).
 *
 * Están acá porque su robots.txt no permite consultas automáticas, porque usan un sistema
 * propio sin una forma permitida de buscar, o porque son marketplaces de varios vendedores.
 * {q} en searchUrl se reemplaza por la carta buscada.
 */
export interface LinkStore {
  id: string;
  name: string;
  url: string;
  games: Game[];
  kind: "tienda" | "marketplace";
  city: string | null;
  province: string | null;
  hasLocal: boolean;
  address?: string;
  instagram?: string;
  searchUrl?: string;
  /** página de cada juego, si la búsqueda no se puede abrir con un link */
  gameUrls?: Partial<Record<Game, string>>;
  /** por qué no se consulta sola, o un dato útil (ej. precios en dólares) */
  note?: string;
}

export const LINK_STORES: LinkStore[] = [
  {
    id: "surtcg", name: "Sur TCG", url: "https://www.surtcg.com.ar", games: ["pkm"],
    kind: "tienda", city: "Quilmes", province: "Buenos Aires", hasLocal: true,
    gameUrls: { pkm: "https://www.surtcg.com.ar/tienda?categoria=pokemon" },
    note: "Web propia con pocas cartas sueltas; su robots.txt no permite leer su API",
  },
  {
    id: "sylvancards", name: "SylvanCards", url: "https://sylvancards.com", games: ["pkm", "mtg", "ygo", "digi", "op"],
    kind: "marketplace", city: "Rosario", province: "Santa Fe", hasLocal: false,
    gameUrls: { pkm: "https://sylvancards.com/cartas?game=pokemon", mtg: "https://sylvancards.com/cartas?game=magic", ygo: "https://sylvancards.com/cartas?game=yugioh", digi: "https://sylvancards.com/cartas?game=digimon", op: "https://sylvancards.com/cartas?game=one-piece" },
    note: "Marketplace: venden personas y tiendas, cada una por su cuenta",
  },
  {
    id: "phoenix", name: "Phoenix Reborn", url: "https://phoenixreborn.com.ar", games: ["ygo", "digi", "pkm", "op"],
    kind: "tienda", city: "CABA (Villa Devoto)", province: "CABA", hasLocal: true, instagram: "phoenixrebornstore",
    searchUrl: "https://phoenixreborn.com.ar/?s={q}&post_type=product",
    note: "Su protección anti-bots (Cloudflare) bloquea las consultas automáticas: buscá en su web",
  },
  {
    id: "spacegaming", name: "Space Gaming", url: "https://spacegaminglomas.com", games: ["pkm", "op", "mtg", "ygo", "digi"],
    kind: "tienda", city: "Lomas de Zamora", province: "Buenos Aires", hasLocal: true, instagram: "spacegaminglomas",
    searchUrl: "https://spacegaminglomas.com/?s={q}&post_type=product",
    note: "Pide no recibir consultas automáticas seguidas",
  },
  {
    id: "mtgpirulo", name: "MTG Pirulo", url: "https://mtgpirulo.com", games: ["mtg"],
    kind: "tienda", city: "CABA (Colegiales)", province: "CABA", hasLocal: true, address: "Álvarez Thomas 198, 3° M",
    searchUrl: "https://mtgpirulo.com/search.php?search_query={q}",
    note: "Más de 140.000 singles · precios en dólares",
  },
  {
    id: "elrefugio", name: "El Refugio Singles", url: "https://elrefugiosingles.com.ar", games: ["mtg", "pkm"],
    kind: "tienda", city: "CABA (Belgrano)", province: "CABA", hasLocal: true, address: "Av. Cabildo 2040, local 83 (Galería Los Andes)",
    instagram: "elrefugiomagic",
    gameUrls: { mtg: "https://elrefugiosingles.com.ar/magic", pkm: "https://elrefugiosingles.com.ar/pokemon" },
    note: "Precios en dólares",
  },
  {
    id: "manainfinito", name: "Maná Infinito", url: "https://singles.manainfinito.com.ar", games: ["mtg"],
    kind: "tienda", city: null, province: null, hasLocal: false,
    note: "Importa listas de Moxfield y Archidekt",
  },
  {
    id: "magicpalace", name: "Magic Palace TCG", url: "https://magicpalacetcg.com.ar", games: ["mtg", "pkm"],
    kind: "tienda", city: null, province: null, hasLocal: false,
    searchUrl: "https://magicpalacetcg.com.ar/search.php?search_query={q}",
  },
  {
    id: "deltaold", name: "Delta Old", url: "https://www.deltaold.com.ar", games: ["pkm", "op", "ygo"],
    kind: "tienda", city: null, province: null, hasLocal: false,
    searchUrl: "https://www.deltaold.com.ar/tienda?single=true&search={q}",
    note: "También cartas certificadas (PSA, Beckett)",
  },
  {
    id: "pokeshopcoast", name: "PokeShop Coast", url: "https://www.pokeshopcoast.com.ar", games: ["pkm", "ygo"],
    kind: "tienda", city: "La Costa", province: "Buenos Aires", hasLocal: false, instagram: "pokeshopcoast",
    searchUrl: "https://www.pokeshopcoast.com.ar/search?q={q}",
  },
  {
    id: "tcgfans", name: "TCG Fans", url: "https://tcg.fans", games: ["pkm", "op"],
    kind: "marketplace", city: null, province: null, hasLocal: false,
    gameUrls: { pkm: "https://tcg.fans/pokemon", op: "https://tcg.fans/one-piece" },
    note: "Marketplace: vende cada vendedor por su cuenta",
  },
  {
    id: "pokeargentum", name: "PokeArgentum", url: "https://www.pokeargentum.com", games: ["pkm"],
    kind: "tienda", city: null, province: null, hasLocal: false, instagram: "pokeargentum",
    gameUrls: { pkm: "https://www.pokeargentum.com/all" },
  },
  {
    id: "albattle", name: "Albattle", url: "https://singles.albattletcg.com", games: ["mtg", "pkm"],
    kind: "tienda", city: null, province: null, hasLocal: false,
    gameUrls: { pkm: "https://singles.albattletcg.com/pokemon" },
    note: "Búsqueda por lista en /bulk",
  },
  {
    id: "mmagiccouple", name: "MMagic Couple", url: "https://www.mmagiccouple.com", games: ["mtg"],
    kind: "tienda", city: null, province: null, hasLocal: false,
    note: "Búsqueda por lista en /bulk",
  },
  {
    id: "mundopoketcg", name: "MundoPokeTCG", url: "https://www.mundopoketcg.com.ar", games: ["pkm"],
    kind: "tienda", city: null, province: null, hasLocal: false, instagram: "mundopoketcg",
    note: "Vende por TCG Fans y por WhatsApp",
  },
];

/** Fecha de la última revisión manual del directorio (webs, juegos, robots.txt) */
export const DIRECTORY_REVIEWED = "2026-10-27";

/** Link para buscar una carta en una tienda del directorio (o su página del juego) */
export function linkFor(s: LinkStore, game: Game, q?: string): string {
  if (q && s.searchUrl) return s.searchUrl.replace("{q}", encodeURIComponent(q.trim()));
  return s.gameUrls?.[game] ?? s.url;
}
