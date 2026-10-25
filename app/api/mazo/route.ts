import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/http.ts";
import { robotsAllows } from "@/lib/robots.ts";
import { archidektToText, deckSource, mainDeckText } from "@/lib/deckurl.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mazo?url=https://archidekt.com/decks/123 → { text, source, game }  o  { error, howTo }
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  const src = deckSource(raw.slice(0, 500));
  if (!src) return NextResponse.json({ error: "Ese link no parece de un mazo." }, { status: 400 });
  if (!src.fetchUrl) return NextResponse.json({ error: `No podemos leer mazos de ${src.name} automáticamente.`, howTo: src.howTo, game: src.game }, { status: 422 });
  const u = new URL(src.fetchUrl);
  try {
    if (!(await robotsAllows(u.origin, u.pathname + u.search))) {
      return NextResponse.json({ error: `${src.name} no permite leer sus mazos automáticamente.`, howTo: "Exportá el mazo como texto y pegalo acá." }, { status: 422 });
    }
    const res = await fetchWithTimeout(src.fetchUrl, 10000, src.kind === "archidekt" ? "application/json" : "text/plain");
    if (!res.ok) return NextResponse.json({ error: res.status === 404 ? "No encontramos ese mazo (¿es privado?)." : `${src.name} respondió ${res.status}.`, howTo: "Exportá el mazo como texto y pegalo acá." }, { status: 502 });
    const text = src.kind === "archidekt" ? archidektToText(await res.json()) : mainDeckText((await res.text()).slice(0, 200_000));
    if (!text.trim()) return NextResponse.json({ error: "El mazo está vacío o no lo pudimos leer.", howTo: "Exportá el mazo como texto y pegalo acá." }, { status: 422 });
    return NextResponse.json({ text, source: src.name, game: src.game }, { headers: { "Cache-Control": "public, s-maxage=600" } });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer el mazo: ${(e as Error).message}`, howTo: "Exportá el mazo como texto y pegalo acá." }, { status: 502 });
  }
}
