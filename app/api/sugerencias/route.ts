import { NextResponse } from "next/server";
import { suggest } from "@/lib/suggest.ts";
import { isGame } from "@/lib/games.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/sugerencias?game=ygo&q=ash
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");
  const q = (searchParams.get("q") ?? "").slice(0, 60);
  if (!isGame(game)) return NextResponse.json([], { status: 400 });
  try {
    const list = await suggest(game, q);
    return NextResponse.json(list, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch {
    return NextResponse.json([]); // sin sugerencias no se rompe nada
  }
}
