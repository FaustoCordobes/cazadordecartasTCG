import type { Game } from "./types.ts";

/** Datos de cada juego que usa toda la app (nombres, ejemplos, orden de rarezas) */
export interface GameMeta {
  id: Game;
  name: string;
  short: string;
  /** texto del emblema del botón */
  emblem: string;
  /** cómo se escribe en los links compartidos (?juego=...) */
  param: string;
  placeholder: string;
  quick: string[];
  rarityOrder: string[];
  rarityLabel?: Record<string, string>;
  deckExample: string;
  deckHint: string;
}

export const GAME_IDS: Game[] = ["ygo", "digi", "mtg", "pkm", "op"];

export const GAMES: Record<Game, GameMeta> = {
  ygo: {
    id: "ygo", name: "Yu-Gi-Oh!", short: "Yu-Gi-Oh!", emblem: "YG", param: "yugioh",
    placeholder: "Ash Blossom, Mago Oscuro, RA01-EN008",
    quick: ["Ash Blossom", "Dark Magician", "Mago Oscuro", "Blue-Eyes White Dragon"],
    rarityOrder: ["Common", "Rare", "Super Rare", "Ultra Rare", "Secret Rare", "Ultimate Rare", "Ghost Rare", "Starlight Rare",
      "Platinum Secret Rare", "Prismatic Secret Rare", "Prismatic Collector's Rare", "Quarter Century Secret Rare"],
    deckExample: `Ichiki Sayori-Hime x3
Exosister Betrayal x3
Exosister Karmael x2
Sanaki the Mikanko Devotee x2
Mikanko Shinbu - Noble Twins x3
Uzuhime the Manifested Mikanko x2`,
    deckHint: "3 Ash Blossom & Joyous Spring",
  },
  digi: {
    id: "digi", name: "Digimon Card Game", short: "Digimon", emblem: "DG", param: "digimon",
    placeholder: "Omnimon, Kimeramon, BT19-070",
    quick: ["Omnimon", "Kimeramon", "Imperialdramon", "BT19-070"],
    rarityOrder: ["C", "U", "R", "SR", "SEC", "UR", "P"],
    rarityLabel: { C: "C · Común", U: "U · Poco común", R: "R · Rara", SR: "SR · Super rara", SEC: "SEC · Secreta", UR: "UR · Ultra rara", P: "P · Promo" },
    deckExample: `// DigimonCard.io Deck List
4 Angemon BT25-034
3 Angemon BT23-027
1 Angewomon EX12-044
4 Patamon BT25-031
4 Tokomon BT14-003
2 Yellow Scramble LM-029`,
    deckHint: "4 Angemon BT25-034",
  },
  mtg: {
    id: "mtg", name: "Magic: The Gathering", short: "Magic", emblem: "MTG", param: "magic",
    placeholder: "Sol Ring, Rayo, Lightning Bolt",
    quick: ["Sol Ring", "Lightning Bolt", "Counterspell", "Rhystic Study"],
    rarityOrder: ["Común", "Infrecuente", "Rara", "Mítica", "Especial"],
    deckExample: `4 Lightning Bolt
4 Monastery Swiftspear
2 Sol Ring (CMM) 395
1 Rhystic Study
20 Mountain`,
    deckHint: "4 Lightning Bolt",
  },
  pkm: {
    id: "pkm", name: "Pokémon TCG", short: "Pokémon", emblem: "PK", param: "pokemon",
    placeholder: "Pikachu, Charizard ex, 125/197",
    quick: ["Pikachu", "Charizard ex", "Gardevoir ex", "Iono"],
    rarityOrder: ["Common", "Uncommon", "Rare", "Rare Holo", "Double Rare", "Ultra Rare", "Illustration Rare",
      "Special Illustration Rare", "Hyper Rare", "Secret Rare", "ACE SPEC Rare", "Shiny Rare", "Promo"],
    deckExample: `Pokémon: 12
4 Charmander MEW 4
3 Charizard ex OBF 125
2 Pidgey MEW 16
Trainer: 40
4 Iono PAL 185
4 Rare Candy SVI 191
Energy: 8
8 Fire Energy`,
    deckHint: "3 Charizard ex OBF 125",
  },
  op: {
    id: "op", name: "One Piece Card Game", short: "One Piece", emblem: "OP", param: "onepiece",
    placeholder: "Luffy, Zoro, OP01-025",
    quick: ["Monkey.D.Luffy", "Roronoa Zoro", "Shanks", "OP01-025"],
    rarityOrder: ["C", "UC", "R", "SR", "SEC", "L", "SP", "TR", "P"],
    rarityLabel: { C: "C · Común", UC: "UC · Poco común", R: "R · Rara", SR: "SR · Super rara", SEC: "SEC · Secreta", L: "L · Líder", SP: "SP · Especial", TR: "TR · Treasure", P: "P · Promo" },
    deckExample: `1 OP01-001 Roronoa Zoro
4 OP01-025 Roronoa Zoro
4 ST01-012 Monkey.D.Luffy
4x OP01-016 Nami
2 OP01-029 Radical Beam!!`,
    deckHint: "4 OP01-025 Roronoa Zoro",
  },
};

export const isGame = (v: unknown): v is Game => typeof v === "string" && (GAME_IDS as string[]).includes(v);

/**
 * Reconoce el juego por un texto de la tienda (categoría, tipo de producto, atributo o tag).
 * Devuelve null si no menciona ninguno o si menciona más de uno.
 */
export function gameFromText(text: string | null | undefined): Game | null {
  const t = (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!t) return null;
  const found = new Set<Game>();
  if (/yu-?gi-?oh|\bygo\b/.test(t)) found.add("ygo");
  if (/digimon/.test(t)) found.add("digi");
  if (/magic|\bmtg\b/.test(t)) found.add("mtg");
  if (/pokemon/.test(t)) found.add("pkm");
  if (/one[\s-]?piece|\bop\s?tcg\b|\boptcg\b/.test(t)) found.add("op");
  return found.size === 1 ? [...found][0] : null;
}

/** Productos que no son cartas sueltas (cuando el título no trae código de carta) */
export const SEALED =
  /\b(booster|sobres?|caja|box|display|bundle|blister|elite trainer|etb|starter deck|structure deck|mazo|deck box|playmat|tapete|folios?|sleeves?|protectores?|carpeta|binder|portfolio|peluche|plush|figura|figure|model kit|tin|lata|collection|coleccion|pack|kit|dados|dice|token pack|preventa de caja)\b/i;
