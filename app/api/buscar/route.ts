import { NextResponse } from "next/server";
import { searchAll } from "@/lib/search.ts";
import type { Game } from "@/lib/types.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// En Vercel: hasta 60 s, porque algunas tiendas tardan en responder
export const maxDuration = 60;

// GET /api/buscar?game=digi&q=omnimon
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");
  const q = (searchParams.get("q") ?? "").trim();

  if (game !== "ygo" && game !== "digi") {
    return NextResponse.json({ error: "Elegí un juego: ygo o digi." }, { status: 400 });
  }
  if (q.length < 2 || q.length > 60) {
    return NextResponse.json({ error: "Escribí entre 2 y 60 caracteres." }, { status: 400 });
  }

  try {
    const data = await searchAll(game as Game, q);
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo completar la búsqueda. Probá de nuevo en unos segundos." }, { status: 500 });
  }
}
