import { NextResponse } from "next/server";
import { getDolar } from "@/lib/dolar.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/dolar → cotización de referencia o null (si falla, la app no muestra USD)
export async function GET() {
  return NextResponse.json(await getDolar(), { headers: { "Cache-Control": "public, s-maxage=3600" } });
}
