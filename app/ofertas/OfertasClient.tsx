"use client";

import { useEffect, useState } from "react";
import type { Game } from "@/lib/types.ts";
import type { Mover, OfferRow } from "@/lib/market.ts";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import { BRAND } from "@/lib/brand.ts";
import { cardUrl } from "@/lib/share.ts";
import { agoText } from "@/lib/freshness.ts";
import { OFFER_MIN_DISCOUNT } from "@/lib/market.ts";
import { trackClick } from "../components/searchClient.ts";

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

type Data = { enabled: boolean; ofertas: OfferRow[]; suben: Mover[]; bajan: Mover[]; error?: string | null };

/**
 * Ofertas (como el "Deal Finder" de RiftCompare) y subas/bajas de la semana (como los "Top Movers" de PokéPrice o MTGStocks).
 * Salen solo de búsquedas reales hechas en la app: si una carta nadie la buscó, no aparece.
 */
export function OfertasClient() {
  const [game, setGame] = useState<Game>("mtg");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try { const g = new URLSearchParams(location.search).get("juego"); const id = GAME_IDS.find((x) => GAMES[x].param === g || x === g); if (id) setGame(id); } catch { /* nada */ }
  }, []);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/mercado?game=${game}`).then((r) => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
    try { history.replaceState(null, "", `/ofertas?juego=${GAMES[game].param}`); } catch { /* nada */ }
  }, [game]);

  const link = (name: string) => cardUrl("", game, name);

  return (
    <div className="app" data-game={game}>
      <main className="wrap">
        <header className="top">
          <a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="logo" aria-hidden="true" />
            <div><h1>{BRAND.name}</h1><p>Volver al buscador</p></div>
          </a>
        </header>
        <h1 className="page-h">Ofertas y movimientos de precios</h1>
        <div className="dir-filters" role="group" aria-label="Juego">
          {GAME_IDS.map((g) => (
            <button key={g} type="button" className={`dir-chip g-${g}${game === g ? " on" : ""}`} aria-pressed={game === g} onClick={() => setGame(g)}>{GAMES[g].short}</button>
          ))}
        </div>

        {loading && <p className="translated">Cargando…</p>}
        {!loading && data && !data.enabled && <div className="warn-box">Esta sección necesita la base de datos (Supabase) configurada.</div>}
        {!loading && data?.error && <div className="warn-box">{data.error}</div>}

        {!loading && data?.enabled && (
          <>
            <section className="group">
              <div className="res-h"><h2>🔥 Ofertas de {GAMES[game].short}</h2></div>
              <p className="translated">
                Publicaciones con stock al menos un {OFFER_MIN_DISCOUNT} % por debajo del precio de mercado de TCGplayer (EE. UU.) pasado a pesos.
                Salen de búsquedas que hizo la gente en los últimos 3 días: el precio puede haber cambiado, confirmalo en la tienda.
              </p>
              {data.ofertas.length === 0 ? (
                <div className="empty"><p>Todavía no hay ofertas detectadas para {GAMES[game].short}. Aparecen a medida que la gente busca cartas.</p></div>
              ) : (
                <div className="deal-grid">
                  {data.ofertas.map((o) => (
                    <article className="deal" key={o.card_key + o.store_id}>
                      {o.imagen && <img src={o.imagen} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                      <div>
                        <b>{o.card_name}</b>
                        <span className="alias">{[o.code, o.rarity, o.version && o.version !== "Normal" ? o.version : null].filter(Boolean).join(" · ")}</span>
                        <span className="deal-price">{fmt.format(Number(o.precio))} <span className="tag match">-{Math.round(Number(o.descuento))} %</span></span>
                        <small>Referencia TCGplayer: {usd.format(Number(o.ref_usd))} ≈ {fmt.format(Math.round(Number(o.ref_usd) * Number(o.dolar)))}</small>
                        <small>{o.store_name} · visto {agoText(o.visto)}</small>
                        <div className="deal-actions">
                          <a className="btn btn-primary btn-sm" href={o.url} target="_blank" rel="noopener" onClick={() => trackClick(game, o.store_id)}>Ver publicación ↗</a>
                          <a className="btn btn-ghost btn-sm" href={link(o.card_name)}>Comparar</a>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="group">
              <div className="res-h"><h2>📈 Subas y bajas de la semana</h2></div>
              <p className="translated">Comparamos, tienda por tienda, el último precio de los últimos 7 días con el de las semanas anteriores (cambios de 5 % o más).</p>
              <div className="movers">
                {([["bajan", "Bajaron", data.bajan], ["suben", "Subieron", data.suben]] as const).map(([k, t, list]) => (
                  <div key={k}>
                    <h3>{k === "bajan" ? "📉" : "📈"} {t}</h3>
                    {list.length === 0 ? <p className="translated">Todavía no hay datos suficientes.</p> : (
                      <ol>
                        {list.map((m) => (
                          <li key={m.card_key}>
                            <a href={link(m.card_name)}>{m.card_name}</a>
                            <span className={k === "bajan" ? "mv-down" : "mv-up"}>{m.cambio > 0 ? "+" : ""}{m.cambio.toLocaleString("es-AR")} %</span>
                            <small>{fmt.format(m.antes)} → {fmt.format(m.ahora)}</small>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
