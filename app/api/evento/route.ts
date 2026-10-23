import { NextResponse } from "next/server";
import { isGame } from "@/lib/games.ts";
import { recordClick } from "@/lib/stats.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/evento  { tipo: "click", game, store } — solo suma un contador por día, sin datos de la persona
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { tipo?: string; game?: string; store?: string };
    if (b.tipo === "click" && isGame(b.game) && typeof b.store === "string" && /^[a-z0-9-]{2,40}$/.test(b.store)) {
      await recordClick(b.game, b.store).catch(() => {});
    }
  } catch { /* se ignora */ }
  return new NextResponse(null, { status: 204 });
}
