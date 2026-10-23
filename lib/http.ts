export const USER_AGENT =
  "CazacartasBot/0.1 (comparador de precios TCG; contacto: WhatsApp +54 9 2944 24-2906)";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** fetch con tiempo límite y User-Agent propio, para identificarnos ante las tiendas */
export async function fetchWithTimeout(url: string, ms = 8000, accept = "application/json"): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, Accept: accept },
      cache: "no-store",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error(`La tienda tardó más de ${ms / 1000} s`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function getJSON<T>(url: string, ms = 8000): Promise<T> {
  const res = await fetchWithTimeout(url, ms);
  if (!res.ok) throw new HttpError(res.status, `Respondió ${res.status}`);
  return (await res.json()) as T;
}

export async function getText(url: string, ms = 12000): Promise<string> {
  const res = await fetchWithTimeout(url, ms, "text/html,application/xhtml+xml");
  if (!res.ok) throw new HttpError(res.status, `Respondió ${res.status}`);
  return res.text();
}

/** "$ 1.234,56" / "ARS 7.900,00" / "1234.56" → número */
export function parseARS(s: string | null | undefined): number {
  if (!s) return 0;
  const m = s.replace(/\s/g, "").match(/[\d.,]+/);
  if (!m) return 0;
  let n = m[0];
  if (/,\d{1,2}$/.test(n)) n = n.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}(\D|$)/.test(n) || /\.\d{3}\./.test(n)) n = n.replace(/\./g, "");
  else n = n.replace(/,/g, "");
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
