import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/cuenta  (Authorization: Bearer <token de la sesión>)
 * Borra la cuenta de quien la pide y, en cascada, sus listas y ajustes guardados.
 * Necesita la clave de servidor: borrar usuarios no se puede hacer desde el navegador.
 */
export async function DELETE(req: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return NextResponse.json({ error: "Las cuentas no están configuradas en el servidor." }, { status: 503 });
  if (!token) return NextResponse.json({ error: "Tenés que haber ingresado." }, { status: 401 });
  const admin: Record<string, string> = key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
  try {
    // 1) ¿De quién es la sesión? (lo confirma Supabase con el token)
    const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!who.ok) return NextResponse.json({ error: "La sesión venció. Ingresá de nuevo." }, { status: 401 });
    const { id } = (await who.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
    // 2) Se borra esa cuenta (sus datos se borran en cascada)
    const del = await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin, cache: "no-store" });
    if (!del.ok) return NextResponse.json({ error: "No se pudo borrar la cuenta. Escribinos y la borramos a mano." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo borrar la cuenta. Probá de nuevo." }, { status: 502 });
  }
}
