import { NextResponse } from "next/server";
import { isGame } from "@/lib/games.ts";
import { popularSearches } from "@/lib/stats.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/populares?game=mtg → cartas más buscadas en los últimos 7 días (con resultados)
export async function GET(req: Request) {
  const game = new URL(req.url).searchParams.get("game");
  if (!isGame(game)) return NextResponse.json([], { status: 400 });
  try {
    return NextResponse.json((await popularSearches(game)) ?? [], { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch {
    return NextResponse.json([]);
  }
}
