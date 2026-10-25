import { NextResponse } from "next/server";
import { isGame } from "@/lib/games.ts";
import { deleteSub, pushEnabled, saveWatch, validSub, vapidPublic, type WatchCard } from "@/lib/push.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → { enabled, publicKey }   POST { subscription, cartas } → guarda   DELETE { endpoint } → borra
export async function GET() {
  return NextResponse.json({ enabled: pushEnabled(), publicKey: vapidPublic() });
}

export async function POST(req: Request) {
  if (!pushEnabled()) return NextResponse.json({ error: "Los avisos al celular todavía no están activados." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { subscription?: unknown; cartas?: unknown } | null;
  if (!body || !validSub(body.subscription) || !Array.isArray(body.cartas)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const cartas: WatchCard[] = body.cartas
    .filter((c): c is WatchCard => !!c && isGame((c as WatchCard).game) && typeof (c as WatchCard).carta === "string" && (c as WatchCard).carta.trim().length >= 2)
    .map((c) => ({
      game: c.game,
      carta: c.carta.trim(),
      card_key: typeof c.card_key === "string" ? c.card_key : "",
      precio_max: typeof c.precio_max === "number" && c.precio_max > 0 ? Math.round(c.precio_max) : null,
    }));
  try {
    await saveWatch(body.subscription, cartas);
    return NextResponse.json({ ok: true, cartas: cartas.length });
  } catch {
    return NextResponse.json({ error: "No se pudieron guardar los avisos. ¿Está corrida la migración 003?" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "Falta el endpoint" }, { status: 400 });
  try { await deleteSub(body.endpoint); } catch { /* ya no estaba */ }
  return NextResponse.json({ ok: true });
}
