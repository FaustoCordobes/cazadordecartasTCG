import { NextResponse } from "next/server";
import { catalog } from "@/lib/catalog.ts";
import { GAME_IDS } from "@/lib/games.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/estado → última lectura de cada tienda indexada (por juego), con su error si falló
export async function GET() {
  try {
    const db = catalog();
    const all = (await Promise.all(GAME_IDS.map((g) => db.statuses(g).catch(() => [])))).flat();
    return NextResponse.json(all, { headers: { "Cache-Control": "public, s-maxage=600" } });
  } catch {
    return NextResponse.json([]);
  }
}
