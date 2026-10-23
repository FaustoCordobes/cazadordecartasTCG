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

/** Busca la ficha oficial de varias cartas a la vez y arma un índice único */
export async function lookupInfo(game: Game, names: string[]): Promise<InfoIndex> {
  const merged: InfoIndex = { byCode: new Map(), byName: new Map() };
  const results = await Promise.allSettled(
    names.map(async (n) => {
      const key = `${game}:${norm(n)}`;
      let idx = infoCache.get(key);
      if (!idx) {
        idx = game === "digi" ? await digiLookup(n) : await ygoLookup(n);
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
