"use client";

import { useEffect, useMemo, useState } from "react";
import type { Game } from "@/lib/types.ts";
import { STORES } from "@/lib/stores.ts";
import { DIRECTORY_REVIEWED, LINK_STORES, linkFor } from "@/lib/linkstores.ts";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import { sameArea } from "@/lib/provinces.ts";
import { agoText } from "@/lib/freshness.ts";
import { useProvince } from "./useProvince.tsx";
import { trackClick } from "./searchClient.ts";
import type { ReportContext } from "./ReportDialog.tsx";

/** Una fila del directorio: tiendas que la app busca sola + tiendas con link a su buscador */
interface Row {
  id: string;
  name: string;
  url: string;
  games: Game[];
  auto: boolean;
  index: boolean;
  kind: "tienda" | "marketplace";
  place: string;
  province: string | null;
  hasLocal: boolean;
  instagram?: string;
  note?: string;
  cash?: string;
  link: (g: Game, q?: string) => string;
  searchLink: boolean;
}

const ROWS: Row[] = [
  ...STORES.map((s): Row => ({
    id: s.id, name: s.name, url: s.base, games: s.games, auto: true,
    index: s.platform === "tiendanube" || s.platform === "prestashop" || s.mode === "index",
    kind: "tienda",
    place: [s.address, s.city].filter(Boolean).join(" · ") || (s.hasLocal ? "Local (consultar dirección)" : "Solo online"),
    province: s.province, hasLocal: s.hasLocal, instagram: s.instagram,
    cash: s.cashDiscount ? `${s.cashDiscount.percent}% OFF ${s.cashDiscount.label}` : undefined,
    link: () => s.base, searchLink: false,
  })),
  ...LINK_STORES.map((s): Row => ({
    id: s.id, name: s.name, url: s.url, games: s.games, auto: false, index: false, kind: s.kind,
    place: [s.address, s.city].filter(Boolean).join(" · ") || (s.kind === "marketplace" ? "Varios vendedores" : s.hasLocal ? "Local" : "Solo online"),
    province: s.province, hasLocal: s.hasLocal, instagram: s.instagram, note: s.note,
    link: (g, q) => linkFor(s, g, q), searchLink: !!s.searchUrl,
  })),
];

type Filter = Game | "todos";
type IndexStatus = { storeId: string; game: Game; indexedAt: string; count: number; error: string | null };

/**
 * Directorio de tiendas con filtro por juego.
 * "Búsqueda integrada" = sus cartas ya aparecen en los resultados.
 * "Búsqueda manual" = la app no la consulta sola; el botón abre su web (o su buscador con la carta escrita).
 */
export function StoreDirectory({ game, q, onReport, startAll }: { game: Game; q?: string; onReport?: (ctx: ReportContext) => void; startAll?: boolean }) {
  const [filter, setFilter] = useState<Filter>(startAll ? "todos" : game);
  const [onlyLink, setOnlyLink] = useState(false);
  const [province] = useProvince();
  const [status, setStatus] = useState<IndexStatus[]>([]);
  const shownGame: Game = filter === "todos" ? game : filter;

  const [lastGame, setLastGame] = useState(game);
  if (lastGame !== game) { setLastGame(game); setFilter(game); }

  useEffect(() => {
    fetch("/api/estado").then((r) => r.json()).then((l) => Array.isArray(l) && setStatus(l)).catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, { total: number; auto: number; manual: number }> = {};
    for (const f of ["todos", ...GAME_IDS] as Filter[]) {
      const rows = ROWS.filter((r) => f === "todos" || r.games.includes(f));
      c[f] = { total: rows.length, auto: rows.filter((r) => r.auto).length, manual: rows.filter((r) => !r.auto).length };
    }
    return c;
  }, []);

  /** Integración caída: la última lectura del catálogo de ese juego falló */
  const broken = (r: Row, g: Game) => r.index && status.find((s) => s.storeId === r.id && s.game === g)?.error;
  const indexedAt = (r: Row, g: Game) => (r.index ? status.find((s) => s.storeId === r.id && s.game === g && !s.error)?.indexedAt : undefined);

  const rows = ROWS.filter((r) => (filter === "todos" || r.games.includes(filter)) && (!onlyLink || !r.auto)).sort(
    (a, b) =>
      Number(sameArea(province, b.province) && b.hasLocal) - Number(sameArea(province, a.province) && a.hasLocal) ||
      Number(a.auto) - Number(b.auto) ||
      a.name.localeCompare(b.name, "es")
  );
  const query = q && q.trim().length >= 2 ? q.trim() : undefined;
  const c = counts[filter];

  return (
    <section className="group" aria-labelledby="dir-t">
      <div className="res-h">
        <h2 id="dir-t">Directorio de tiendas<small>{rows.length} de {ROWS.length}</small></h2>
        {onReport && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onReport({ types: ["tienda_nueva", "tienda_dato", "tienda_cerrada", "tienda_baja"], title: "Sugerir o corregir una tienda" })}>
            + Sugerir una tienda
          </button>
        )}
      </div>
      <p className="translated">
        Tiendas de Argentina con cartas sueltas{filter !== "todos" ? ` de ${GAMES[filter].short}` : ""}: <b>{c.total}</b> en total ·
        <b> {c.auto}</b> con búsqueda integrada (aparecen en los resultados) · <b>{c.manual}</b> con búsqueda manual (el botón abre su web
        {query ? <> con “{query}” ya escrito cuando se puede</> : null}). Directorio revisado el {new Date(DIRECTORY_REVIEWED + "T12:00:00").toLocaleDateString("es-AR")}.
      </p>
      <div className="dir-filters" role="group" aria-label="Filtrar por juego">
        {(["todos", ...GAME_IDS] as Filter[]).map((f) => (
          <button key={f} type="button" className={`dir-chip${filter === f ? " on" : ""}${f !== "todos" ? ` g-${f}` : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "todos" ? "Todos" : GAMES[f].short} <span>{counts[f].total}</span>
          </button>
        ))}
        <label className="check dir-only">
          <input type="checkbox" checked={onlyLink} onChange={(e) => setOnlyLink(e.target.checked)} />
          Solo búsqueda manual
        </label>
      </div>
      <div className="dir-grid">
        {rows.map((r) => {
          const g = r.games.includes(shownGame) ? shownGame : r.games[0];
          const down = broken(r, g);
          const at = indexedAt(r, g);
          return (
            <article className="dir-item" key={r.id}>
              <div className="dir-top">
                <b>{r.name}</b>
                <span className={`dir-badge ${down ? "down" : r.auto ? "auto" : "manual"}`}>
                  {down ? "Integración no disponible" : r.auto ? "Búsqueda integrada" : r.kind === "marketplace" ? "Marketplace · manual" : "Búsqueda manual"}
                </span>
              </div>
              <span className="dir-place">
                {r.place}
                {province && r.hasLocal && sameArea(province, r.province) && <span className="near"> · 📍 En tu provincia</span>}
              </span>
              <div className="dir-games">
                {r.games.map((x) => <span key={x} className={`dir-game g-${x}`}>{GAMES[x].short}</span>)}
              </div>
              <span className="dir-note">
                {r.auto ? (r.index ? (at ? `Catálogo leído ${agoText(at)}` : down ? "La última lectura falló; se reintenta todos los días" : "Se lee su catálogo una vez por día") : "Se consulta en vivo en cada búsqueda") : r.note ?? "La app no la consulta sola"}
              </span>
              <span className="dir-pay">{r.cash ? `💵 ${r.cash}` : "Medios de pago y envíos: sin datos verificados, consultalos en la tienda"}</span>
              <div className="dir-actions">
                <a className="btn btn-ghost btn-sm" href={r.auto ? r.url : r.link(g, query)} target="_blank" rel="noopener" onClick={() => trackClick(g, r.id)}>
                  {r.auto ? "Ir a la tienda" : query && r.searchLink ? `Buscar “${query.length > 18 ? query.slice(0, 18) + "…" : query}” en su web` : `Ver ${GAMES[g].short} en su web`} ↗
                </a>
                {r.instagram && <a className="dir-ig" href={`https://instagram.com/${r.instagram}`} target="_blank" rel="noopener">@{r.instagram}</a>}
                {onReport && <button type="button" className="o-rep" onClick={() => onReport({ types: ["tienda_dato", "tienda_cerrada", "link", "tienda_baja"], title: `Reportar: ${r.name}`, store_id: r.id, url: r.url })}>Reportar</button>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
