"use client";

import { useEffect, useState } from "react";
import type { Game } from "@/lib/types.ts";
import type { PriceVersion } from "@/lib/worldlist.ts";
import { convert, type Rates } from "@/lib/worldprice.ts";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import { BRAND } from "@/lib/brand.ts";
import { cardUrl } from "@/lib/share.ts";
import { Autocomplete } from "../components/Autocomplete.tsx";
import { CurrencyToggle, useCurrency } from "../components/useCurrency.tsx";
import { usePersisted } from "../components/usePersisted.ts";

const ARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

type Item = PriceVersion & { game: Game; qty: number };
type Source = "tcg" | "cm";

/**
 * Calculadora de precios: armás una lista de cartas y ves el total en dólares o en pesos,
 * con el precio de TCGplayer (EE. UU.) o de Cardmarket (Europa).
 * Los precios salen de las bases públicas de cartas, se actualizan una vez por día.
 */
export function CalculadoraClient() {
  const [game, setGame] = useState<Game>("mtg");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PriceVersion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = usePersisted<{ items: Item[]; source: Source }>("cazacartas:calculadora", { items: [], source: "tcg" });
  const [cur] = useCurrency();
  const [rates, setRates] = useState<Rates>({ usdArs: null, eurUsd: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/dolar").then((r) => r.json()).then((d) => d && setRates({ usdArs: d.venta ?? null, eurUsd: d.eurUsd ?? null })).catch(() => {});
  }, []);

  async function find(text = q) {
    const t = text.trim();
    if (t.length < 2) return;
    setQ(t); setLoading(true); setErr(null); setResults(null);
    try {
      const d = (await (await fetch(`/api/precios?game=${game}&q=${encodeURIComponent(t)}`)).json()) as { versions?: PriceVersion[]; error?: string };
      setResults(d.versions ?? []);
      if (d.error) setErr(d.error);
    } catch { setErr("No se pudieron leer los precios. Probá de nuevo."); }
    finally { setLoading(false); }
  }

  const src = saved.source;
  /** precio unitario de una versión en dólares, según la fuente elegida */
  const unitUsd = (v: PriceVersion) => (src === "tcg" ? v.usd ?? (v.eur && rates.eurUsd ? v.eur * rates.eurUsd : null) : v.eur && rates.eurUsd ? v.eur * rates.eurUsd : v.usd);
  const show = (usd: number | null) => {
    if (usd === null) return "—";
    const c = convert(usd, "USD", cur, rates);
    return c === null ? USD.format(usd) : cur === "ARS" ? ARS.format(Math.round(c)) : USD.format(c);
  };
  const other = (usd: number | null) => {
    if (usd === null) return null;
    if (cur === "ARS") return USD.format(usd);
    const ars = convert(usd, "USD", "ARS", rates);
    return ars === null ? null : ARS.format(Math.round(ars));
  };

  const items = saved.items;
  const setItems = (next: Item[]) => setSaved({ ...saved, items: next });
  const add = (v: PriceVersion) => {
    const i = items.findIndex((x) => x.id === v.id);
    if (i >= 0) setItems(items.map((x, j) => (j === i ? { ...x, qty: Math.min(99, x.qty + 1) } : x)));
    else setItems([...items, { ...v, game, qty: 1 }]);
  };
  const total = items.reduce((s, x) => s + (unitUsd(x) ?? 0) * x.qty, 0);
  const missing = items.filter((x) => unitUsd(x) === null).length;

  async function copy() {
    const lines = items.map((x) => `${x.qty} × ${x.name}${x.code ? ` (${x.code})` : ""}${x.variant !== "Normal" ? ` ${x.variant}` : ""} — ${show(unitUsd(x))} c/u`);
    const t = [`🃏 Lista de precios (${src === "tcg" ? "TCGplayer" : "Cardmarket"}) — Cazacartas`, ...lines, `Total: ${show(total)}`].join("\n");
    try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("Copiá la lista:", t); }
  }

  return (
    <div className="app" data-game={game}>
      <main className="wrap">
        <header className="top">
          <a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="logo" aria-hidden="true" />
            <div><h1>{BRAND.name}</h1><p>Volver al buscador</p></div>
          </a>
          <nav className="top-actions"><CurrencyToggle /></nav>
        </header>
        <h1 className="page-h">Calculadora de precios</h1>
        <p className="translated">
          Armá una lista de cartas y mirá cuánto valen en <b>TCGplayer</b> (EE. UU.) o <b>Cardmarket</b> (Europa), en dólares o en pesos
          {rates.usdArs ? ` (dólar del día: ${ARS.format(rates.usdArs)})` : ""}. Sirve como referencia para comprar, vender o cambiar cartas.
        </p>

        <div className="dir-filters" role="group" aria-label="Juego">
          {GAME_IDS.map((g) => <button key={g} type="button" className={`dir-chip g-${g}${game === g ? " on" : ""}`} aria-pressed={game === g} onClick={() => { setGame(g); setResults(null); }}>{GAMES[g].short}</button>)}
        </div>

        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); find(); }}>
          <div className="field">
            <label htmlFor="cq">Buscá la carta</label>
            <Autocomplete id="cq" game={game} value={q} onChange={setQ} onPick={(v) => find(v)} placeholder={GAMES[game].placeholder} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
        </form>
        {err && <div className="err-box">{err}</div>}

        {results && (
          <section className="group">
            <div className="res-h"><h2>Versiones de “{q}”<small>{results.length}</small></h2></div>
            {results.length === 0 ? (
              <div className="empty"><p>{game === "digi" ? "Para Digimon no hay precios internacionales públicos." : "No encontramos precios para esa carta. Revisá cómo está escrita."}</p></div>
            ) : (
              <div className="calc-results">
                {results.map((v) => (
                  <div className="calc-ver" key={v.id}>
                    {v.image ? <img src={v.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} /> : <span className="ac-noimg" />}
                    <div className="calc-info">
                      <b>{v.name}</b>
                      <span className="alias">{[v.code, v.setName, v.rarity, v.variant !== "Normal" ? v.variant : null].filter(Boolean).join(" · ")}</span>
                      <span className="calc-prices">
                        {v.usd !== null && <span>TCGplayer <b>{show(v.usd)}</b></span>}
                        {v.eur !== null && <span>Cardmarket <b>{show(rates.eurUsd ? v.eur * rates.eurUsd : null)}</b>{!rates.eurUsd && ` €${v.eur}`}</span>}
                      </span>
                      {v.cardLevel && <small className="hint">Precio de la carta en general (la impresión más barata)</small>}
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => add(v)}>+ Agregar</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="panel calc-list">
          <div className="res-h">
            <h2>Tu lista<small>{items.reduce((n, x) => n + x.qty, 0)} cartas</small></h2>
            <label className="calc-src">Precio de
              <select value={src} onChange={(e) => setSaved({ ...saved, source: e.target.value as Source })}>
                <option value="tcg">TCGplayer (EE. UU.)</option>
                <option value="cm">Cardmarket (Europa)</option>
              </select>
            </label>
          </div>
          {items.length === 0 ? <p className="translated">Buscá una carta y tocá “+ Agregar”.</p> : (
            <>
              <ul className="calc-items">
                {items.map((x) => (
                  <li key={x.id}>
                    <div className="calc-info">
                      <b>{x.name}</b>
                      <span className="alias">{GAMES[x.game].short} · {[x.code, x.rarity, x.variant !== "Normal" ? x.variant : null].filter(Boolean).join(" · ")}</span>
                      <a className="hint" href={cardUrl("", x.game, x.code && (x.game === "digi" || x.game === "op") ? x.code : x.name)}>Ver precios en tiendas de Argentina →</a>
                    </div>
                    <div className="qty">
                      <button type="button" aria-label="Una menos" onClick={() => setItems(x.qty <= 1 ? items.filter((y) => y.id !== x.id) : items.map((y) => (y.id === x.id ? { ...y, qty: y.qty - 1 } : y)))}>−</button>
                      <span>{x.qty}</span>
                      <button type="button" aria-label="Una más" onClick={() => setItems(items.map((y) => (y.id === x.id ? { ...y, qty: Math.min(99, y.qty + 1) } : y)))}>+</button>
                    </div>
                    <div className="calc-sub">
                      <b>{show(unitUsd(x) === null ? null : unitUsd(x)! * x.qty)}</b>
                      <small>{show(unitUsd(x))} c/u{other(unitUsd(x)) ? ` · ${other(unitUsd(x))}` : ""}</small>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="calc-total">
                <span>Total {src === "tcg" ? "TCGplayer" : "Cardmarket"}{missing ? ` (sin ${missing} carta${missing === 1 ? "" : "s"} sin precio)` : ""}</span>
                <b>{show(total)}</b>
                {other(total) && <small>{other(total)}</small>}
              </div>
              <div className="search">
                <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>{copied ? "¡Copiada!" : "Copiar lista"}</button>
                <button type="button" className="linkbtn" onClick={() => setItems([])}>Vaciar</button>
              </div>
            </>
          )}
        </section>

        <p className="pcmp-note">
          Precios de referencia sin envío ni impuestos, actualizados una vez por día por las bases públicas de cartas (Scryfall, YGOPRODeck,
          Pokémon TCG API, OPTCG API). No reflejan los precios de las tiendas de Argentina: para eso usá el buscador. Este sitio usa datos de
          TCGplayer, pero no está avalado ni certificado por TCGplayer.
        </p>
      </main>
    </div>
  );
}
