import type { Game } from "./types.ts";
import { GAME_IDS, GAMES } from "./games.ts";

/** /magic → "mtg", /onepiece → "op" */
export const gameFromParam = (p: string): Game | null => GAME_IDS.find((g) => GAMES[g].param === p.toLowerCase()) ?? null;

export const GAME_SEO: Record<Game, { title: string; description: string; intro: string }> = {
  ygo: {
    title: "Cartas de Yu-Gi-Oh! en Argentina: precios y stock",
    description: "Compará precios de singles de Yu-Gi-Oh! en tiendas de Argentina. Buscá por nombre (en español o inglés) o por código de set, como RA01-EN008.",
    intro: "Buscá cualquier carta de Yu-Gi-Oh! por nombre, en español o en inglés, o por su código de set (por ejemplo RA01-EN008). Cada resultado separa la rareza, la edición y el idioma, para que compares la misma impresión.",
  },
  digi: {
    title: "Cartas de Digimon Card Game en Argentina: precios y stock",
    description: "Compará precios de singles de Digimon Card Game en tiendas de Argentina. Buscá por nombre o por código, como BT19-070.",
    intro: "Buscá cartas de Digimon por nombre o por código (por ejemplo BT19-070). Cada código es una carta distinta: Angemon BT25-034 no es lo mismo que BT23-027, y las versiones Alter se muestran aparte.",
  },
  mtg: {
    title: "Cartas de Magic: The Gathering en Argentina: precios y stock",
    description: "Compará precios de singles de Magic en tiendas de Argentina. Buscá en español o inglés, con filtros de set, foil, idioma y estado.",
    intro: "Buscá singles de Magic por nombre, en inglés o en español (por ejemplo “Rayo” encuentra Lightning Bolt). Separamos foil y no foil, idioma y estado, para que no compares cartas distintas.",
  },
  pkm: {
    title: "Cartas de Pokémon TCG en Argentina: precios y stock",
    description: "Compará precios de singles de Pokémon TCG en tiendas de Argentina. Buscá por nombre o por número de colección, como 125/197.",
    intro: "Buscá cartas de Pokémon por nombre o por su número de colección (por ejemplo 125/197). Separamos reverse holo, idioma y expansión, y podés pegar tu lista de Pokémon TCG Live para ver dónde conviene comprarla.",
  },
  op: {
    title: "Cartas de One Piece Card Game en Argentina: precios y stock",
    description: "Compará precios de singles de One Piece Card Game en tiendas de Argentina. Buscá por nombre o por código, como OP01-025.",
    intro: "Buscá cartas de One Piece por nombre o por código (por ejemplo OP01-025). Las versiones Parallel, Manga y SP se muestran aparte de la normal, porque su precio es muy distinto.",
  },
};
