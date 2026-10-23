"use client";

import { useMemo, useState } from "react";
import type { Game } from "@/lib/types.ts";
import { STORES } from "@/lib/stores.ts";
import { LINK_STORES, linkFor } from "@/lib/linkstores.ts";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import { sameArea } from "@/lib/provinces.ts";
import { useProvince } from "./useProvince.tsx";

/** Una fila del directorio: tiendas que la app busca sola + tiendas con link a su buscador */
interface Row {
  id: string;
  name: string;
  url: string;
  games: Game[];
  auto: boolean;
  kind: "tienda" | "marketplace";
  place: string;
  province: string | null;
  hasLocal: boolean;
  instagram?: string;
  note?: string;
  link: (g: Game, q?: string) => string;
}

const ROWS: Row[] = [
  ...STORES.map((s): Row => ({
    id: s.id,
    name: s.name,
    url: s.base,
    games: s.games,
    auto: true,
    kind: "tienda",
    place: [s.address, s.city].filter(Boolean).join(" · ") || (s.hasLocal ? "Local (consultar dirección)" : "Solo online"),
    province: s.province,
    hasLocal: s.hasLocal,
    instagram: s.instagram,
    link: () => s.base,
  })),
  ...LINK_STORES.map((s): Row => ({
    id: s.id,
    name: s.name,
    url: s.url,
    games: s.games,
    auto: false,
    kind: s.kind,
    place: [s.address, s.city].filter(Boolean).join(" · ") || (s.kind === "marketplace" ? "Varios vendedores" : s.hasLocal ? "Local" : "Solo online"),
    province: s.province,
    hasLocal: s.hasLocal,
    instagram: s.instagram,
    note: s.note,
    link: (g, q) => linkFor(s, g, q),
  })),
];

type Filter = Game | "todos";

/**
 * Directorio de tiendas con filtro por juego.
 * "La app busca acá" = sus cartas ya aparecen en los resultados.
 * "Buscá en su web" = la app no puede consultarla sola; el botón abre su buscador.
 */
export function StoreDirectory({ game, q }: { game: Game; q?: string }) {
  const [filter, setFilter] = useState<Filter>(game);
  const [onlyLink, setOnlyLink] = useState(false);
  const [province] = useProvince();
  const shownGame: Game = filter === "todos" ? game : filter;

  // si cambia el juego elegido arriba, el directorio lo sigue
  const [lastGame, setLastGame] = useState(game);
  if (lastGame !== game) {
    setLastGame(game);
    setFilter(game);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: ROWS.length };
    for (const g of GAME_IDS) c[g] = ROWS.filter((r) => r.games.includes(g)).length;
    return c;
  }, []);

  const rows = ROWS.filter((r) => (filter === "todos" || r.games.includes(filter)) && (!onlyLink || !r.auto)).sort(
    (a, b) =>
      Number(sameArea(province, b.province) && b.hasLocal) - Number(sameArea(province, a.province) && a.hasLocal) ||
      Number(a.auto) - Number(b.auto) ||
      a.name.localeCompare(b.name, "es")
  );
  const query = q && q.trim().length >= 2 ? q.trim() : undefined;

  return (
    <section className="group" aria-labelledby="dir-t">
      <div className="res-h">
        <h2 id="dir-t">Directorio de tiendas<small>{rows.length} de {ROWS.length}</small></h2>
      </div>
      <p className="translated">
        Tiendas de Argentina con cartas sueltas. En las marcadas <b>“La app busca acá”</b> sus cartas ya aparecen en los resultados;
        en las demás, el botón abre su web{query ? <> con “{query}” ya buscado</> : null}.
      </p>
      <div className="dir-filters" role="group" aria-label="Filtrar por juego">
        {(["todos", ...GAME_IDS] as Filter[]).map((f) => (
          <button key={f} type="button" className={`dir-chip${filter === f ? " on" : ""}${f !== "todos" ? ` g-${f}` : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "todos" ? "Todos" : GAMES[f].short} <span>{counts[f]}</span>
          </button>
        ))}
        <label className="check dir-only">
          <input type="checkbox" checked={onlyLink} onChange={(e) => setOnlyLink(e.target.checked)} />
          Solo las que hay que buscar a mano
        </label>
      </div>
      <div className="dir-grid">
        {rows.map((r) => {
          const g = r.games.includes(shownGame) ? shownGame : r.games[0];
          return (
            <article className="dir-item" key={r.id}>
              <div className="dir-top">
                <b>{r.name}</b>
                <span className={`dir-badge ${r.auto ? "auto" : "manual"}`}>{r.auto ? "La app busca acá" : r.kind === "marketplace" ? "Marketplace" : "Buscá en su web"}</span>
              </div>
              <span className="dir-place">
                {r.place}
                {province && r.hasLocal && sameArea(province, r.province) && <span className="near"> · 📍 En tu provincia</span>}
              </span>
              <div className="dir-games">
                {r.games.map((x) => <span key={x} className={`dir-game g-${x}`}>{GAMES[x].short}</span>)}
              </div>
              {r.note && <span className="dir-note">{r.note}</span>}
              <div className="dir-actions">
                <a className="btn btn-ghost btn-sm" href={r.auto ? r.url : r.link(g, query)} target="_blank" rel="noopener">
                  {r.auto ? "Ir a la tienda" : query ? `Buscar “${query.length > 18 ? query.slice(0, 18) + "…" : query}”` : `Ver ${GAMES[g].short}`} ↗
                </a>
                {r.instagram && <a className="dir-ig" href={`https://instagram.com/${r.instagram}`} target="_blank" rel="noopener">@{r.instagram}</a>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
