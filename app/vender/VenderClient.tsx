"use client";

import { useState } from "react";
import type { Game, SearchResponse } from "@/lib/types.ts";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import { BRAND } from "@/lib/brand.ts";
import { STORES } from "@/lib/stores.ts";
import { parseDecklist } from "@/lib/decklist.ts";
import { matchEntry } from "@/lib/deck.ts";
import { refUsd } from "@/lib/refprice.ts";
import { cardUrl } from "@/lib/share.ts";
import { search, searchMany } from "../components/searchClient.ts";

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const usdF = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

type Row = { qty: number; name: string; low: number | null; stores: number; ref: number | null };

/**
 * Vender cartas: cuánto se venden hoy en tiendas (precio de venta más bajo) y la referencia de TCGplayer,
 * para negociar con datos (como los comparadores de buylist tipo CardRouter). Y las tiendas que compran.
 */
export function VenderClient() {
  const [game, setGame] = useState<Game>("mtg");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dolar, setDolar] = useState<number | null>(null);
  const buyers = STORES.filter((s) => s.buylist && s.games.includes(game));

  async function run() {
    const parsed = parseDecklist(text, game);
    if (!parsed.entries.length) { setProgress("Escribí una carta por línea con la cantidad, por ejemplo: 1 Sol Ring"); return; }
    fetch("/api/dolar").then((r) => r.json()).then((d) => setDolar(d?.venta ?? null)).catch(() => {});
    const names = [...new Set(parsed.entries.map((e) => e.name))].slice(0, 60);
    const res = new Map<string, SearchResponse | null>();
    let done = 0;
    setRows(null);
    setProgress(`Buscando 0 de ${names.length}…`);
    await searchMany(names, async (n) => {
      try { res.set(n, await search(game, n, { stream: false })); } catch { res.set(n, null); }
      setProgress(`Buscando ${++done} de ${names.length}…`);
    }, 4);
    setRows(parsed.entries.slice(0, 60).map((e) => {
      const r = res.get(e.name);
      if (!r) return { qty: e.qty, name: e.name, low: null, stores: 0, ref: null };
      const card = matchEntry(game, e, r);
      const exact = r.cards.find((g) => g.exact && refUsd(game, g));
      return { qty: e.qty, name: card.name, low: card.offers[0]?.price ?? null, stores: new Set(card.offers.map((o) => o.storeId)).size, ref: exact ? refUsd(game, exact) : null };
    }));
    setProgress(null);
  }

  const total = rows?.reduce((s, r) => s + (r.low ?? 0) * r.qty, 0) ?? 0;

  return (
    <div className="app" data-game={game}>
      <main className="wrap guide">
        <header className="top">
          <a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="logo" aria-hidden="true" />
            <div><h1>{BRAND.name}</h1><p>Volver al buscador</p></div>
          </a>
        </header>
        <h1>Vender tus cartas</h1>
        <p>Antes de vender, fijate cuánto se venden hoy en las tiendas y su precio de referencia internacional. Las tiendas que compran suelen pagar menos que su precio de venta, porque después tienen que revenderla: usá estos números como referencia para negociar.</p>

        <div className="dir-filters" role="group" aria-label="Juego">
          {GAME_IDS.map((g) => <button key={g} type="button" className={`dir-chip g-${g}${game === g ? " on" : ""}`} aria-pressed={game === g} onClick={() => { setGame(g); setRows(null); }}>{GAMES[g].short}</button>)}
        </div>

        <section className="panel">
          <div className="field">
            <label htmlFor="sell">Tus cartas (una por línea, con la cantidad)</label>
            <textarea id="sell" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={GAMES[game].deckExample.split("\n").slice(0, 4).join("\n")} spellCheck={false} />
          </div>
          <div className="search">
            <button className="btn btn-primary" type="button" onClick={run} disabled={!!progress?.startsWith("Buscando") || !text.trim()}>Calcular cuánto valen</button>
            {progress && <span className="slow-note" role="status">{progress}</span>}
          </div>
          {rows && (
            <div className="tbl">
              <table>
                <thead><tr><th>Cant.</th><th>Carta</th><th className="num">Menor precio de venta en tiendas</th><th className="num">Referencia TCGplayer</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="num">{r.qty}</td>
                      <td><a href={cardUrl("", game, r.name)}>{r.name}</a></td>
                      <td className="num">{r.low ? <>{fmt.format(r.low)}<div className="hint">{r.stores} tienda{r.stores === 1 ? "" : "s"}</div></> : <span className="hint">Ninguna la tiene</span>}</td>
                      <td className="num">{r.ref ? <>{usdF.format(r.ref)}{dolar && <div className="hint">≈ {fmt.format(Math.round(r.ref * dolar))}</div>}</> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={2}><b>Total a precio de venta en tiendas</b></td><td className="num"><b>{fmt.format(total)}</b></td><td /></tr></tfoot>
              </table>
            </div>
          )}
        </section>

        <h2>Tiendas que compran cartas de {GAMES[game].short}</h2>
        {buyers.length ? (
          <ul className="buyers">
            {buyers.map((s) => (
              <li key={s.id}>
                <b>{s.name}</b> {s.city ? `· ${s.city}` : ""}
                {s.buylist?.url && <> · <a href={s.buylist.url} target="_blank" rel="noopener">Ver qué compran ↗</a></>}
                {s.buylist?.whatsapp && <> · <a href={`https://wa.me/${s.buylist.whatsapp}`} target="_blank" rel="noopener">WhatsApp ↗</a></>}
                {s.buylist?.note && <div className="hint">{s.buylist.note}</div>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <p>Todavía ninguna tienda nos confirmó que compra cartas de {GAMES[game].short}. Muchas compran: preguntales por Instagram o en su local.</p>
            <p>¿Tenés una tienda que compra cartas? <a href="/sumar-tienda">Sumala acá</a> y aparece en esta lista.</p>
          </div>
        )}
      </main>
    </div>
  );
}
