import { NextResponse } from "next/server";
import { isGame } from "@/lib/games.ts";
import { lookupInfo } from "@/lib/cardinfo.ts";
import { priceVersions } from "@/lib/worldlist.ts";
import { translateName } from "@/lib/names.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/precios?game=ygo&q=ash blossom → versiones de la carta con su precio en TCGplayer (US$) y Cardmarket (€)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");
  let q = (searchParams.get("q") ?? "").trim().slice(0, 60);
  if (!isGame(game) || q.length < 2) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  try {
    // también acepta el nombre en español ("Mago Oscuro")
    const names = await translateName(game, q).catch(() => null);
    if (names?.typed === "es") q = names.en;
    const idx = await lookupInfo(game, [q]);
    return NextResponse.json({ q, versions: priceVersions(game, idx, q) }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  } catch {
    return NextResponse.json({ q, versions: [], error: "No se pudieron leer los precios. Probá de nuevo." });
  }
}
