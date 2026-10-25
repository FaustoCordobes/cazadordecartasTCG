import { itemKey, type WishItem, type WishList, type WishState } from "./wishlist.ts";

/**
 * Sincronización de "Mi lista" y los ajustes con la cuenta.
 * Al ingresar desde otro dispositivo se juntan las dos versiones sin perder nada:
 * listas con el mismo id se unen, y una misma carta (juego + nombre + código + rareza + versión)
 * queda una sola vez (gana la de este dispositivo, que es la que la persona está mirando).
 */

/** Claves de localStorage que se guardan en la cuenta (opciones del plan, envíos por tienda, provincia) */
export const SYNC_KEYS = ["cazacartas:plan-prefs", "cazacartas:envios", "cazacartas:provincia"] as const;

const key = (it: WishItem) => itemKey(it.game, it.name, it.code, it.rarity, it.version);

export function isWishState(x: unknown): x is WishState {
  const s = x as WishState;
  return !!s && s.version === 2 && Array.isArray(s.lists) && s.lists.every((l) => l && typeof l.id === "string" && Array.isArray(l.items));
}

const isEmpty = (s: WishState) => s.lists.every((l) => !l.items.length);

export function mergeWish(local: WishState, remote: WishState | null): WishState {
  if (!remote || !isWishState(remote) || isEmpty(remote)) return local;
  if (isEmpty(local)) return { ...remote, active: remote.lists.some((l) => l.id === local.active) ? local.active : remote.active };
  const lists = new Map<string, WishList>();
  for (const l of remote.lists) lists.set(l.id, { ...l, items: [...l.items] });
  for (const l of local.lists) {
    const r = lists.get(l.id);
    if (!r) { lists.set(l.id, l); continue; }
    const byKey = new Map(r.items.map((it) => [key(it), it]));
    for (const it of l.items) byKey.set(key(it), it); // la de este dispositivo pisa
    lists.set(l.id, { ...r, name: l.name || r.name, items: [...byKey.values()] });
  }
  const all = [...lists.values()];
  return { version: 2, lists: all, active: all.some((l) => l.id === local.active) ? local.active : all[0].id };
}

/** Ajustes: lo que hay en este dispositivo manda; lo que falta acá se toma de la cuenta */
export function mergeSettings(local: Record<string, string | null>, remote: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SYNC_KEYS) {
    const l = local[k];
    const r = remote?.[k];
    if (l) out[k] = l;
    else if (typeof r === "string" && r) out[k] = r;
  }
  return out;
}

/** Validación de la contraseña al crear la cuenta */
export function passwordProblem(p: string, repeat?: string): string | null {
  if (p.length < 8) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Usá letras y números en la contraseña.";
  if (repeat !== undefined && p !== repeat) return "Las contraseñas no coinciden.";
  return null;
}

export const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** Mensajes de error de Supabase Auth en castellano */
export function authError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "El mail o la contraseña no son correctos.";
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already exists")) return "Ya hay una cuenta con ese mail. Ingresá o recuperá la contraseña.";
  if (m.includes("email not confirmed")) return "Falta confirmar el mail. (En Supabase hay que desactivar “Confirm email” para que no lo pida.)";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos seguidos. Probá en unos minutos.";
  if (m.includes("password") && m.includes("weak")) return "La contraseña es muy débil. Usá una más larga, con letras y números.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "La creación de cuentas está desactivada por ahora.";
  return "No se pudo completar: " + msg;
}
