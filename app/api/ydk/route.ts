import { NextResponse } from "next/server";
import { getJSON } from "@/lib/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ydk?ids=89631139,14558127 → { "89631139": "Blue-Eyes White Dragon", ... } (YGOPRODeck)
export async function GET(req: Request) {
  const ids = [...new Set((new URL(req.url).searchParams.get("ids") ?? "").split(",").filter((x) => /^\d{1,10}$/.test(x)))].slice(0, 150);
  if (!ids.length) return NextResponse.json({});
  try {
    const data = await getJSON<{ data: { id: number; name: string }[] }>(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${ids.join(",")}`, 10000);
    const out: Record<string, string> = {};
    for (const c of data.data ?? []) out[String(c.id)] = c.name;
    return NextResponse.json(out, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer los nombres de las cartas" }, { status: 502 });
  }
}
