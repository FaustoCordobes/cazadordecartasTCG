"use client";

import { useSyncExternalStore } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { authError, isWishState, mergeSettings, mergeWish, SYNC_KEYS } from "@/lib/accountsync.ts";
import { wishStore } from "./useWishlist.ts";

/**
 * Cuentas con mail y contraseña (Supabase Auth), sin paso de confirmación por mail:
 * en Supabase se desactiva "Confirm email" y la cuenta queda lista al crearla.
 *
 * "Mantener la sesión iniciada": si está tildado, la sesión se guarda en este navegador (localStorage)
 * y sigue abierta al volver; si no, se cierra al cerrar el navegador (sessionStorage).
 *
 * Lo que se guarda en la cuenta: "Mi lista" (todas las listas) y los ajustes (opciones del plan,
 * envíos por tienda, provincia). Se sincroniza al ingresar y cada vez que algo cambia.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY_ = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REMEMBER = "cazacartas:recordar";

export const accountsEnabled = !!(URL_ && KEY_);

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
const remember = () => safe(() => localStorage.getItem(REMEMBER) !== "0", true);

/** Guarda la sesión en localStorage o sessionStorage según "Mantener la sesión iniciada" */
const storage = {
  getItem: (k: string) => safe(() => localStorage.getItem(k) ?? sessionStorage.getItem(k), null),
  setItem: (k: string, v: string) => safe(() => {
    if (remember()) { localStorage.setItem(k, v); sessionStorage.removeItem(k); }
    else { sessionStorage.setItem(k, v); localStorage.removeItem(k); }
  }, undefined),
  removeItem: (k: string) => safe(() => { localStorage.removeItem(k); sessionStorage.removeItem(k); }, undefined),
};

let client: Promise<SupabaseClient> | null = null;
/** El cliente de Supabase se descarga recién cuando hace falta (no pesa en la carga de la página) */
export async function sb(): Promise<SupabaseClient | null> {
  if (!accountsEnabled || typeof window === "undefined") return null;
  if (!client) client = import("@supabase/supabase-js").then(({ createClient }) => {
    const c = createClient(URL_!, KEY_!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage, storageKey: "cazacartas:sesion" },
    });
    c.auth.onAuthStateChange((event, session) => {
      setState({ user: session?.user ?? null, loading: false, recovery: event === "PASSWORD_RECOVERY" ? true : state.recovery });
      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) void initialSync(session.user);
      if (event === "SIGNED_OUT") synced = false;
    });
    return c;
  });
  return client;
}

// ---------- estado compartido ----------
interface AccountState {
  user: User | null;
  loading: boolean;
  syncing: boolean;
  lastSync: string | null;
  error: string | null;
  /** vino desde el link de "olvidé mi contraseña": hay que pedir la nueva */
  recovery: boolean;
}
let state: AccountState = { user: null, loading: accountsEnabled, syncing: false, lastSync: null, error: null, recovery: false };
const listeners = new Set<() => void>();
function setState(p: Partial<AccountState>) { state = { ...state, ...p }; listeners.forEach((l) => l()); }
const SERVER: AccountState = { user: null, loading: false, syncing: false, lastSync: null, error: null, recovery: false };

// ---------- sincronización ----------
let synced = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function localSettings(): Record<string, string | null> {
  return Object.fromEntries(SYNC_KEYS.map((k) => [k, safe(() => localStorage.getItem(k), null)]));
}

async function upload() {
  const c = await sb();
  const u = state.user;
  if (!c || !u || !synced) return;
  setState({ syncing: true });
  const { error } = await c.from("cuentas_datos").upsert({
    user_id: u.id, listas: wishStore.get(), ajustes: mergeSettings(localSettings(), null), actualizado: new Date().toISOString(),
  });
  setState({ syncing: false, error: error ? "No se pudo guardar en tu cuenta. ¿Está corrida la migración 004?" : null, lastSync: error ? state.lastSync : new Date().toISOString() });
}

function scheduleUpload() {
  if (!synced) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void upload(); }, 1500);
}

let watching = false;
function watchChanges() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  wishStore.subscribe(scheduleUpload);
  window.addEventListener("cazacartas:ajustes", scheduleUpload);
}

/** Al ingresar: junta lo de la cuenta con lo de este navegador y guarda el resultado en los dos lados */
async function initialSync(user: User) {
  const c = await sb();
  if (!c || synced) return;
  setState({ syncing: true, error: null });
  const { data, error } = await c.from("cuentas_datos").select("listas, ajustes").eq("user_id", user.id).maybeSingle();
  if (error) { setState({ syncing: false, error: "No se pudieron leer los datos de tu cuenta. ¿Está corrida la migración 004?" }); return; }
  const remoteLists = data?.listas && isWishState(data.listas) ? data.listas : null;
  const merged = mergeWish(wishStore.get(), remoteLists);
  if (merged !== wishStore.get()) wishStore.set(merged);
  const settings = mergeSettings(localSettings(), (data?.ajustes as Record<string, unknown>) ?? null);
  let changed = false;
  for (const [k, v] of Object.entries(settings)) {
    if (safe(() => localStorage.getItem(k), null) !== v) { safe(() => localStorage.setItem(k, v), undefined); changed = true; }
  }
  if (changed) window.dispatchEvent(new Event("cazacartas:ajustes-sync"));
  synced = true;
  watchChanges();
  setState({ syncing: false });
  await upload();
}

// ---------- acciones ----------
async function run<T>(fn: () => Promise<{ error: { message: string } | null } & T>): Promise<string | null> {
  setState({ error: null });
  try {
    const r = await fn();
    return r.error ? authError(r.error.message) : null;
  } catch (e) {
    return authError((e as Error).message);
  }
}

export const account = {
  setRemember: (v: boolean) => safe(() => localStorage.setItem(REMEMBER, v ? "1" : "0"), undefined),
  remember,
  /** Crea la cuenta. Sin confirmación por mail, queda ingresada al toque. */
  async signUp(email: string, password: string): Promise<{ error: string | null; needsConfirm?: boolean }> {
    const c = await sb();
    if (!c) return { error: "Las cuentas no están activadas." };
    let needsConfirm = false;
    const error = await run(async () => {
      const r = await c.auth.signUp({ email: email.trim(), password });
      needsConfirm = !r.error && !r.data.session; // Supabase todavía pide confirmar el mail
      return r;
    });
    return { error, needsConfirm };
  },
  async signIn(email: string, password: string) {
    const c = await sb();
    if (!c) return "Las cuentas no están activadas.";
    return run(() => c.auth.signInWithPassword({ email: email.trim(), password }));
  },
  async signOut() {
    const c = await sb();
    if (timer) { clearTimeout(timer); await upload(); }
    synced = false;
    await c?.auth.signOut();
  },
  async resetPassword(email: string) {
    const c = await sb();
    if (!c) return "Las cuentas no están activadas.";
    return run(() => c.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/cuenta` }));
  },
  async updatePassword(password: string) {
    const c = await sb();
    if (!c) return "Las cuentas no están activadas.";
    const err = await run(() => c.auth.updateUser({ password }));
    if (!err) setState({ recovery: false });
    return err;
  },
  async syncNow() { if (state.user) { synced ? await upload() : await initialSync(state.user); } },
  /** Borra la cuenta y todo lo guardado en ella (lo que hay en este navegador queda) */
  async deleteAccount(): Promise<string | null> {
    const c = await sb();
    const token = (await c?.auth.getSession())?.data.session?.access_token;
    if (!c || !token) return "Tenés que haber ingresado.";
    const r = await fetch("/api/cuenta", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!r?.ok) return ((await r?.json().catch(() => null)) as { error?: string } | null)?.error ?? "No se pudo borrar la cuenta.";
    synced = false;
    await c.auth.signOut().catch(() => {});
    setState({ user: null });
    return null;
  },
};

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (cb) => { void sb(); listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => SERVER
  );
}
