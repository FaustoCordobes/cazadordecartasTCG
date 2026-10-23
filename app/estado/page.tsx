import type { Metadata } from "next";
import { STORES } from "@/lib/stores.ts";
import { catalog, catalogMode } from "@/lib/catalog.ts";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import { BRAND } from "@/lib/brand.ts";

export const metadata: Metadata = { title: "Estado de las tiendas", robots: { index: false, follow: false } };
export const revalidate = 600;

const when = (iso: string) => new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });

/** Panel interno: cuándo se leyó por última vez cada tienda indexada y si falló (para detectar scrapers rotos) */
export default async function Estado() {
  let rows: { storeId: string; game: string; indexedAt: string; count: number; error: string | null }[] = [];
  let err: string | null = null;
  try {
    const db = catalog();
    rows = (await Promise.all(GAME_IDS.map((g) => db.statuses(g)))).flat();
  } catch (e) {
    err = (e as Error).message;
  }
  const live = STORES.filter((s) => s.platform === "woocommerce" || s.platform === "shopify" || s.platform === "casco").filter((s) => s.mode !== "index");
  return (
    <div className="app" data-game="digi">
      <main className="wrap guide">
        <header className="top"><a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}><div className="logo" aria-hidden="true" /><div><h1>{BRAND.name}</h1><p>Volver al buscador</p></div></a></header>
        <h1>Estado de las tiendas</h1>
        <p>Catálogo guardado en: {catalogMode()}. Las tiendas indexadas se leen una vez por día; las demás se consultan en vivo en cada búsqueda.</p>
        {err && <div className="err-box">No se pudo leer el estado: {err}</div>}
        <h2>Tiendas indexadas</h2>
        <div className="tbl"><table>
          <thead><tr><th>Tienda</th><th>Juego</th><th>Última lectura</th><th className="num">Publicaciones</th><th>Estado</th></tr></thead>
          <tbody>
            {rows.sort((a, b) => Number(!!b.error) - Number(!!a.error) || a.storeId.localeCompare(b.storeId)).map((r) => (
              <tr key={r.storeId + r.game} className={r.error ? "row-miss" : ""}>
                <td>{STORES.find((s) => s.id === r.storeId)?.name ?? r.storeId}</td>
                <td>{GAMES[r.game as keyof typeof GAMES]?.short ?? r.game}</td>
                <td>{when(r.indexedAt)}</td>
                <td className="num">{r.count}</td>
                <td>{r.error ? `❌ ${r.error}` : "✅ OK"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5}>Todavía no hay lecturas guardadas.</td></tr>}
          </tbody>
        </table></div>
        <h2>Tiendas en vivo</h2>
        <p>{live.map((s) => s.name).join(", ")}. Si una falla, se avisa en cada búsqueda como “temporalmente no disponible” y el resto sigue funcionando.</p>
      </main>
    </div>
  );
}
