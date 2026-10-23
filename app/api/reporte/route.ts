import { NextResponse } from "next/server";
import { supabase } from "@/lib/supa.ts";
import { validateReport } from "@/lib/reports.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Límite simple por instancia para frenar spam (no se guarda la IP en ningún lado)
const recent = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const list = (recent.get(key) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  recent.set(key, list);
  return list.length > 8;
}

// POST /api/reporte  { tipo, game?, carta?, store_id?, url?, comentario?, email? }
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (limited(ip)) return NextResponse.json({ ok: false, error: "Mandaste muchos reportes seguidos. Probá en unos minutos." }, { status: 429 });
  let body: unknown;
  try { body = await req.json(); } catch { body = null; }
  const r = validateReport(body);
  if (typeof r === "string") return NextResponse.json({ ok: false, error: r }, { status: 400 });
  const call = supabase();
  if (!call) {
    return NextResponse.json({ ok: false, error: "Los reportes todavía no están activados. Escribinos por WhatsApp." }, { status: 503 });
  }
  try {
    await call("reportes", { method: "POST", body: JSON.stringify(r), timeoutMs: 5000 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo guardar el reporte. Probá de nuevo o escribinos por WhatsApp." }, { status: 502 });
  }
}
