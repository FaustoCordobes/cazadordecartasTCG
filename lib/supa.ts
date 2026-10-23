/**
 * Cliente mínimo de la API REST de Supabase (sin dependencias).
 * La clave es de servidor: este archivo nunca se importa desde componentes del navegador.
 */
export type SupaCall = (path: string, init?: RequestInit & { timeoutMs?: number }) => Promise<Response>;

export function supabase(): SupaCall | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  // Claves nuevas (sb_secret_...) van solo en "apikey"; las legacy (JWT eyJ...) también en Authorization
  const headers: Record<string, string> = key.startsWith("sb_")
    ? { apikey: key, "Content-Type": "application/json" }
    : { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return async (p, init = {}) => {
    const { timeoutMs = 15000, ...rest } = init;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${url}/rest/v1/${p}`, {
        ...rest,
        headers: { ...headers, ...((rest.headers as Record<string, string>) ?? {}) },
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Supabase respondió ${res.status}: ${await res.text()}`);
      return res;
    } finally {
      clearTimeout(t);
    }
  };
}
