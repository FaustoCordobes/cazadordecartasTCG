import { NextResponse } from "next/server";
import { searchAll } from "@/lib/search.ts";
import { GAME_IDS, isGame } from "@/lib/games.ts";
import { recordSearch } from "@/lib/stats.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// En Vercel: hasta 60 s, porque algunas tiendas tardan en responder
export const maxDuration = 60;

/**
 * GET /api/buscar?game=digi&q=omnimon
 * GET /api/buscar?game=digi&q=omnimon&stream=1 → NDJSON: líneas {"type":"progress",...} a medida que
 * responde cada tienda y al final {"type":"done","data":{...}}.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game");
  const q = (searchParams.get("q") ?? "").trim();
  const stream = searchParams.get("stream") === "1";

  if (!isGame(game)) {
    return NextResponse.json({ error: `Elegí un juego: ${GAME_IDS.join(", ")}.` }, { status: 400 });
  }
  if (q.length < 2 || q.length > 60) {
    return NextResponse.json({ error: "Escribí entre 2 y 60 caracteres." }, { status: 400 });
  }

  if (!stream) {
    try {
      const data = await searchAll(game, q);
      await recordSearch(data).catch(() => {});
      return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
    } catch {
      return NextResponse.json({ error: "No se pudo completar la búsqueda. Probá de nuevo en unos segundos." }, { status: 500 });
    }
  }

  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const data = await searchAll(game, q, (p) => send({ type: "progress", ...p }));
        send({ type: "done", data });
        await recordSearch(data).catch(() => {});
      } catch {
        send({ type: "error", error: "No se pudo completar la búsqueda. Probá de nuevo en unos segundos." });
      }
      ctrl.close();
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
