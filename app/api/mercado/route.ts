import { NextResponse } from "next/server";
import { isGame } from "@/lib/games.ts";
import { marketData } from "@/lib/market.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mercado?game=mtg → { enabled, ofertas, suben, bajan }
export async function GET(req: Request) {
  const game = new URL(req.url).searchParams.get("game");
  if (!isGame(game)) return NextResponse.json({ error: "Juego inválido" }, { status: 400 });
  try {
    const data = await marketData(game);
    if (!data) return NextResponse.json({ enabled: false, ofertas: [], suben: [], bajan: [] });
    return NextResponse.json({ enabled: true, ...data }, { headers: { "Cache-Control": "public, s-maxage=900" } });
  } catch {
    return NextResponse.json({ enabled: true, ofertas: [], suben: [], bajan: [], error: "No se pudieron leer los datos" });
  }
}
