import { NextResponse } from "next/server";
import { isGame } from "@/lib/games.ts";
import { priceHistory } from "@/lib/stats.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/historial?game=op&key=OP10-118|SEC|Parallel|&dias=90
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");
  const key = (searchParams.get("key") ?? "").slice(0, 300);
  const dias = Math.min(365, Math.max(7, Number(searchParams.get("dias")) || 90));
  if (!isGame(game) || !key) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  try {
    const points = await priceHistory(game, key, dias);
    if (!points) return NextResponse.json({ enabled: false, points: [] });
    return NextResponse.json({ enabled: true, points }, { headers: { "Cache-Control": "public, s-maxage=1800" } });
  } catch {
    return NextResponse.json({ enabled: true, points: [], error: "No se pudo leer el historial" });
  }
}
