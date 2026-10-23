import type { CardInfo, Game } from "./types.ts";
import { getJSON, HttpError } from "./http.ts";
import { TTLCache } from "./cache.ts";
import { norm } from "./parse.ts";

/** Índice de fichas: por código impreso y por nombre normalizado */
export interface InfoIndex {
  byCode: Map<string, CardInfo>;
  byName: Map<string, CardInfo>;
}

const infoCache = new TTLCache<InfoIndex>(24 * 60 * 60 * 1000);

// ---------- Digimon: https://digimoncard.io/api-public ----------
const D_COLOR: Record<string, string> = {
  Red: "Rojo", Blue: "Azul", Yellow: "Amarillo", Green: "Verde", Black: "Negro", Purple: "Morado", White: "Blanco",
};
const D_ATTR: Record<string, string> = {
  Vaccine: "Vacuna", Virus: "Virus", Data: "Data", Free: "Libre", Variable: "Variable", Unknown: "Desconocido",
};
const D_TYPE: Record<string, string> = { Digimon: "Digimon", Tamer: "Tamer", Option: "Opción", "Digi-Egg": "Digi-Egg" };

export interface DigiApiCard {
  id: string;
  name: string;
  type?: string;
  color?: string | null;
  color2?: string | null;
  level?: number | null;
  stage?: string | null;
  attribute?: string | null;
  rarity?: string | null;
}

const D_RAR: Record<string, string> = { c: "C", common: "C", u: "U", uncommon: "U", r: "R", rare: "R", sr: "SR", "super rare": "SR", sec: "SEC", "secret rare": "SEC", ur: "UR", p: "P", promo: "P" };

export function digiInfo(c: DigiApiCard): CardInfo {
  const color = [c.color, c.color2].filter((x): x is string => !!x).map((x) => D_COLOR[x] ?? x);
  return {
    name: c.name,
    tipo: c.type ? D_TYPE[c.type] ?? c.type : undefined,
    color: color.length ? color : undefined,
    lvl: c.level ? `Lv.${c.level}` : undefined,
    forma: c.stage ?? undefined,
    attr: c.attribute ? D_ATTR[c.attribute] ?? c.attribute : undefined,
    rarity: c.rarity ? D_RAR[c.rarity.toLowerCase()] ?? c.rarity.toUpperCase() : undefined,
  };
}

/** Imagen oficial de una carta de Digimon */
export const digiImage = (code: string) => `https://images.digimoncard.io/images/cards/${code}.jpg`;

async function digiLookup(name: string): Promise<InfoIndex> {
  const idx: InfoIndex = { byCode: new Map(), byName: new Map() };
  let cards: DigiApiCard[] = [];
  try {
    const data = await getJSON<DigiApiCard[] | { error: string }>(
      `https://digimoncard.io/api-public/search.php?n=${encodeURIComponent(name)}`
    );
    if (Array.isArray(data)) cards = data;
  } catch (e) {
    if (!(e instanceof HttpError)) throw e; // 400 = sin resultados
  }
  // Si hay varias impresiones con el mismo nombre y faltan datos (forma), se completan entre sí
  const stageByName = new Map<string, string>();
  for (const c of cards) if (c.stage) stageByName.set(norm(c.name), c.stage);
  for (const c of cards) {
    const info = digiInfo({ ...c, stage: c.stage ?? stageByName.get(norm(c.name)) ?? null });
    idx.byCode.set(c.id.toUpperCase(), info);
    if (!idx.byName.has(norm(c.name))) idx.byName.set(norm(c.name), info);
  }
  return idx;
}

// ---------- Yu-Gi-Oh!: https://db.ygoprodeck.com/api/v7 ----------
const Y_ATTR: Record<string, string> = {
  DARK: "OSCURIDAD", LIGHT: "LUZ", EARTH: "TIERRA", WATER: "AGUA", FIRE: "FUEGO", WIND: "VIENTO", DIVINE: "DIVINO",
};
const Y_RACE: Record<string, string> = {
  Aqua: "Aqua", Beast: "Bestia", "Beast-Warrior": "Guerrero-Bestia", Cyberse: "Ciberso", Dinosaur: "Dinosaurio",
  "Divine-Beast": "Bestia Divina", Dragon: "Dragón", Fairy: "Hada", Fiend: "Demonio", Fish: "Pez", Illusion: "Ilusión",
  Insect: "Insecto", Machine: "Máquina", Plant: "Planta", Psychic: "Psíquico", Pyro: "Piro", Reptile: "Reptil",
  Rock: "Roca", "Sea Serpent": "Serpiente Marina", Spellcaster: "Lanzador de Conjuros", Thunder: "Trueno",
  Warrior: "Guerrero", "Winged Beast": "Bestia Alada", Wyrm: "Wyrm", Zombie: "Zombi",
};
const Y_SPELL: Record<string, string> = {
  Normal: "Normal", "Quick-Play": "Rápida", Continuous: "Continua", Equip: "Equipo", Field: "Campo", Ritual: "Ritual",
  Counter: "Contraataque",
};
const Y_FRAME: Record<string, string> = {
  normal: "Normal", effect: "Efecto", fusion: "Fusión", synchro: "Sincronía", xyz: "Xyz", link: "Link", ritual: "Ritual",
};

export interface YgoApiCard {
  id: number;
  name: string;
  type: string;
  frameType: string;
  race: string;
  attribute?: string;
  level?: number;
  linkval?: number;
  card_sets?: { set_code: string; set_rarity: string }[];
}

export function ygoInfo(c: YgoApiCard): CardInfo {
  if (c.frameType === "spell" || c.frameType === "trap") {
    return { name: c.name, tipo: c.frameType === "spell" ? "Mágica" : "Trampa", sub: Y_SPELL[c.race] ?? c.race };
  }
  const sub = c.frameType.includes("pendulum") ? "Péndulo" : Y_FRAME[c.frameType] ?? c.frameType;
  const lvl = c.linkval ? `Link ${c.linkval}` : c.frameType.startsWith("xyz") ? `Rango ${c.level}` : c.level ? `Nivel ${c.level}` : undefined;
  return {
    name: c.name,
    tipo: "Monstruo",
    sub,
    extra: /tuner/i.test(c.type) ? "Sintonizador" : undefined,
    attr: c.attribute ? Y_ATTR[c.attribute] ?? c.attribute : undefined,
    race: Y_RACE[c.race] ?? c.race,
    lvl,
  };
}

async function ygoLookup(name: string): Promise<InfoIndex> {
  const idx: InfoIndex = { byCode: new Map(), byName: new Map() };
  let cards: YgoApiCard[] = [];
  try {
    const data = await getJSON<{ data: YgoApiCard[] }>(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(name)}`
    );
    cards = data.data ?? [];
  } catch (e) {
    if (!(e instanceof HttpError)) throw e; // 400 = sin resultados
  }
  for (const c of cards.slice(0, 40)) {
    const info = ygoInfo(c);
    idx.byName.set(norm(c.name), info);
    for (const s of c.card_sets ?? []) idx.byCode.set(s.set_code.toUpperCase(), info);
  }
  return idx;
}

// ---------- Magic: https://api.scryfall.com ----------
const M_COLOR: Record<string, string> = { W: "Blanco", U: "Azul", B: "Negro", R: "Rojo", G: "Verde" };
const M_TYPES: [RegExp, string][] = [
  [/\bcreature\b/i, "Criatura"], [/\bplaneswalker\b/i, "Planeswalker"], [/\binstant\b/i, "Instantáneo"], [/\bsorcery\b/i, "Conjuro"],
  [/\benchantment\b/i, "Encantamiento"], [/\bartifact\b/i, "Artefacto"], [/\bland\b/i, "Tierra"], [/\bbattle\b/i, "Batalla"],
];
const M_RAR: Record<string, string> = { common: "Común", uncommon: "Infrecuente", rare: "Rara", mythic: "Mítica", special: "Especial", bonus: "Especial" };

export interface ScryfallCard {
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  colors?: string[];
  color_identity?: string[];
  type_line?: string;
  cmc?: number;
  image_uris?: { small?: string };
  card_faces?: { type_line?: string; colors?: string[]; image_uris?: { small?: string } }[];
}

export function mtgInfo(c: ScryfallCard): CardInfo {
  const typeLine = c.type_line ?? c.card_faces?.[0]?.type_line ?? "";
  const front = typeLine.split("//")[0];
  const colors = (c.colors ?? c.card_faces?.[0]?.colors ?? []).map((x) => M_COLOR[x] ?? x);
  return {
    name: c.name,
    tipo: M_TYPES.find(([re]) => re.test(front))?.[1] ?? "Otro",
    sub: /\blegendary\b/i.test(front) ? "Legendaria" : undefined,
    color: colors.length ? colors : ["Incoloro"],
    lvl: typeof c.cmc === "number" && !/\bland\b/i.test(front) ? `Coste ${c.cmc}` : undefined,
    rarity: M_RAR[c.rarity] ?? c.rarity,
    setName: c.set_name,
    image: c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small,
  };
}

async function mtgLookup(name: string): Promise<InfoIndex> {
  const idx: InfoIndex = { byCode: new Map(), byName: new Map() };
  let cards: ScryfallCard[] = [];
  try {
    // Nombre exacto primero; si no existe, búsqueda por palabras del nombre
    let data = await getJSON<{ data: ScryfallCard[] }>(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${name}"`)}&unique=prints&order=released`
    ).catch(() => null);
    if (!data?.data?.length) {
      data = await getJSON<{ data: ScryfallCard[] }>(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(name.split(/\s+/).map((w) => `name:${w}`).join(" "))}&unique=cards`
      ).catch(() => null);
    }
    cards = data?.data ?? [];
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
  }
  for (const c of cards.slice(0, 120)) {
    const info = mtgInfo(c);
    idx.byCode.set(`${c.set.toUpperCase()}-${c.collector_number}`, info);
    // por nombre se guarda la impresión sin rareza (cambia entre impresiones)
    if (!idx.byName.has(norm(c.name))) idx.byName.set(norm(c.name), { ...info, rarity: undefined, setName: undefined });
    // las cartas de dos caras también se encuentran por cada cara
    for (const face of c.name.split(" // ")) if (!idx.byName.has(norm(face))) idx.byName.set(norm(face), { ...info, name: c.name, rarity: undefined, setName: undefined });
  }
  return idx;
}

/** Magic: si el usuario escribe el nombre en español ("Rayo"), lo pasa al inglés */
const mtgEnCache = new TTLCache<string | null>(24 * 60 * 60 * 1000);
export async function mtgEnglishName(q: string): Promise<string | null> {
  const key = norm(q);
  const hit = mtgEnCache.get(key);
  if (hit !== undefined) return hit;
  let result: string | null = null;
  try {
    const data = await getJSON<{ data: { name: string; printed_name?: string }[] }>(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`lang:es "${q}"`)}&include_multilingual=true&unique=cards`
    );
    const list = data.data ?? [];
    const exact = list.find((c) => norm(c.printed_name) === key) ?? list.find((c) => norm(c.printed_name).startsWith(key));
    result = exact?.name ?? null;
  } catch {
    result = null;
  }
  mtgEnCache.set(key, result);
  return result;
}

/** Magic: nombre correcto a partir de uno mal escrito ("lightnin bolt" → "Lightning Bolt") */
export async function mtgFuzzyName(q: string): Promise<string | null> {
  try {
    const c = await getJSON<{ name: string }>(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(q)}`, 5000);
    return c.name ?? null;
  } catch {
    return null;
  }
}

// ---------- Pokémon: https://api.pokemontcg.io/v2 ----------
const P_TYPE: Record<string, string> = {
  Fire: "Fuego", Water: "Agua", Grass: "Planta", Lightning: "Rayo", Psychic: "Psíquico", Fighting: "Lucha",
  Darkness: "Oscuridad", Metal: "Metal", Dragon: "Dragón", Fairy: "Hada", Colorless: "Incoloro",
};
const P_SUPER: Record<string, string> = { "Pokémon": "Pokémon", Trainer: "Entrenador", Energy: "Energía" };
const P_SUB: Record<string, string> = {
  Basic: "Básico", "Stage 1": "Fase 1", "Stage 2": "Fase 2", Supporter: "Partidario", Item: "Objeto", Stadium: "Estadio",
  "Pokémon Tool": "Herramienta", Special: "Especial",
};

export interface PkmApiCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  types?: string[];
  rarity?: string;
  number: string;
  set: { id: string; name: string; printedTotal: number; ptcgoCode?: string };
  images?: { small?: string };
}

export function pkmInfo(c: PkmApiCard): CardInfo {
  const subs = c.subtypes ?? [];
  const stage = subs.find((x) => P_SUB[x]);
  const mech = subs.filter((x) => !P_SUB[x] && !/^(Tera|Single Strike|Rapid Strike|Fusion Strike|Ancient|Future)$/.test(x));
  return {
    name: c.name,
    tipo: P_SUPER[c.supertype] ?? c.supertype,
    sub: stage ? P_SUB[stage] : undefined,
    extra: mech.length ? mech.join(" ") : undefined,
    color: c.types?.map((t) => P_TYPE[t] ?? t),
    rarity: c.rarity,
    setName: c.set.name,
    image: c.images?.small,
  };
}

async function pkmLookup(name: string): Promise<InfoIndex> {
  const idx: InfoIndex = { byCode: new Map(), byName: new Map() };
  const words = name.replace(/["*:]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return idx;
  let cards: PkmApiCard[] = [];
  try {
    const q = words.map((w) => `name:"${w}*"`).join(" ");
    const data = await getJSON<{ data: PkmApiCard[] }>(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=150&orderBy=-set.releaseDate&select=id,name,supertype,subtypes,types,rarity,number,set,images`,
      12000
    );
    cards = data.data ?? [];
  } catch (e) {
    if (!(e instanceof HttpError)) return idx; // la base de Pokémon a veces tarda: se sigue sin ficha
  }
  for (const c of cards) {
    const info = pkmInfo(c);
    idx.byCode.set(`${c.number}/${c.set.printedTotal}`.toUpperCase(), info);
    idx.byCode.set(c.number.toUpperCase().replace(/\s/g, ""), info); // promos: SWSH001, SVP050
    if (!idx.byName.has(norm(c.name))) idx.byName.set(norm(c.name), { ...info, rarity: undefined, setName: undefined });
  }
  return idx;
}

// ---------- One Piece: https://optcgapi.com ----------
const O_COLOR: Record<string, string> = { Red: "Rojo", Green: "Verde", Blue: "Azul", Purple: "Morado", Black: "Negro", Yellow: "Amarillo" };
const O_TYPE: Record<string, string> = { Leader: "Líder", Character: "Personaje", Event: "Evento", Stage: "Escenario", "DON!!": "DON!!" };
const O_ATTR: Record<string, string> = { Slash: "Corte", Strike: "Golpe", Ranged: "A distancia", Special: "Especial", Wisdom: "Sabiduría" };

export interface OpApiCard {
  card_name: string;
  set_name: string;
  rarity: string;
  card_set_id: string;
  card_color?: string | null;
  card_type?: string | null;
  card_cost?: string | null;
  sub_types?: string | null;
  attribute?: string | null;
  card_image?: string | null;
}

/** "Roronoa Zoro (025) (Parallel)" → "Roronoa Zoro" */
export const opCleanName = (n: string) => n.replace(/\s*\((?:\d{3}|parallel|manga|alternate art|sp|[^)]*rare[^)]*)\)/gi, "").replace(/\s+/g, " ").trim();

export function opInfo(c: OpApiCard): CardInfo {
  return {
    name: opCleanName(c.card_name),
    tipo: c.card_type ? O_TYPE[c.card_type] ?? c.card_type : undefined,
    color: c.card_color ? c.card_color.split(/[\s/]+/).filter(Boolean).map((x) => O_COLOR[x] ?? x) : undefined,
    lvl: c.card_cost ? `Coste ${c.card_cost}` : undefined,
    attr: c.attribute ? c.attribute.split(/[\s/]+/).map((x) => O_ATTR[x] ?? x).join(" / ") : undefined,
    race: c.sub_types ?? undefined,
    rarity: c.rarity === "L" ? "L" : c.rarity,
    setName: c.set_name,
    image: c.card_image ?? undefined,
  };
}

async function opLookup(name: string): Promise<InfoIndex> {
  const idx: InfoIndex = { byCode: new Map(), byName: new Map() };
  const isCode = /^(?:OP|ST|EB|PRB)\d{2}-\d{3}$|^P-\d{3}$/i.test(name.trim());
  const urls = isCode
    ? [`https://optcgapi.com/api/sets/card/${name.trim().toUpperCase()}/`, `https://optcgapi.com/api/decks/card/${name.trim().toUpperCase()}/`]
    : ["sets", "decks", "promos"].map((k) => `https://optcgapi.com/api/${k}/filtered/?card_name=${encodeURIComponent(name)}`);
  const results = await Promise.allSettled(urls.map((u) => getJSON<OpApiCard[]>(u, 10000)));
  for (const r of results) {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) continue;
    for (const c of r.value) {
      const info = opInfo(c);
      // la versión normal manda; la Parallel comparte código
      if (!idx.byCode.has(c.card_set_id) || !/parallel/i.test(c.card_name)) idx.byCode.set(c.card_set_id.toUpperCase(), info);
      if (!idx.byName.has(norm(info.name))) idx.byName.set(norm(info.name), { ...info, rarity: undefined, setName: undefined, image: undefined });
    }
  }
  return idx;
}

const LOOKUP: Record<Game, (name: string) => Promise<InfoIndex>> = {
  digi: digiLookup, ygo: ygoLookup, mtg: mtgLookup, pkm: pkmLookup, op: opLookup,
};

/** Busca la ficha oficial de varias cartas a la vez y arma un índice único */
export async function lookupInfo(game: Game, names: string[]): Promise<InfoIndex> {
  const merged: InfoIndex = { byCode: new Map(), byName: new Map() };
  const results = await Promise.allSettled(
    names.map(async (n) => {
      const key = `${game}:${norm(n)}`;
      let idx = infoCache.get(key);
      if (!idx) {
        idx = await LOOKUP[game](n);
        infoCache.set(key, idx);
      }
      return idx;
    })
  );
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    r.value.byCode.forEach((v, k) => merged.byCode.set(k, v));
    r.value.byName.forEach((v, k) => merged.byName.set(k, v));
  }
  return merged;
}

/**
 * Yu-Gi-Oh!: si el usuario escribe el nombre en español ("mago oscuro"),
 * lo traduce al nombre en inglés, que es como publican las tiendas.
 */
const enNameCache = new TTLCache<string | null>(24 * 60 * 60 * 1000);

export async function ygoEnglishName(q: string): Promise<string | null> {
  const key = norm(q);
  const hit = enNameCache.get(key);
  if (hit !== undefined) return hit;
  const result = await ygoEnglishNameUncached(q);
  enNameCache.set(key, result);
  return result;
}

async function ygoEnglishNameUncached(q: string): Promise<string | null> {
  try {
    const es = await getJSON<{ data: { id: number; name: string }[] }>(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(q)}&language=es`
    );
    const first = es.data?.find((c) => norm(c.name) === norm(q)) ?? es.data?.[0];
    if (!first) return null;
    const en = await getJSON<{ data: { name: string }[] }>(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${first.id}`);
    return en.data?.[0]?.name ?? null;
  } catch {
    return null;
  }
}
