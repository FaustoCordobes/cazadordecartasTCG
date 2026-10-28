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
type Mode = "lista" | "cambio";
interface Saved { items: Item[]; source: Source; mode?: Mode; give?: Item[]; get?: Item[] }

/**
 * Calculadora de precios: armás una lista de cartas y ves el total en dólares o en pesos,
 * con el precio de TCGplayer (EE. UU.) o de Cardmarket (Europa).
 * Los precios salen de las bases públicas de cartas, se actualizan una vez por día.
 */
export function CalculadoraClient() {
  const [game, setGame] = useState<Game>("mtg");
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
          Armá una lista de cartas y mirá cuánto valen en <b>TCGplayer</b> (EE. UU.) o <b>Cardmarket</b> (Europa), en dólares o en pesos.
          Sirve como referencia para comprar, vender o cambiar cartas.
        </p>
        <div className="dir-filters" role="group" aria-label="Juego">
          {GAME_IDS.map((g) => <button key={g} type="button" className={`dir-chip g-${g}${game === g ? " on" : ""}`} aria-pressed={game === g} onClick={() => setGame(g)}>{GAMES[g].short}</button>)}
        </div>
        <PriceCalculator game={game} />
      </main>
    </div>
  );
}

export function PriceCalculator({ game, embedded }: { game: Game; embedded?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PriceVersion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = usePersisted<Saved>("cazacartas:calculadora", { items: [], source: "tcg", mode: "lista", give: [], get: [] });
  const mode: Mode = saved.mode ?? "lista";
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
  const give = saved.give ?? [], get = saved.get ?? [];
  const setList = (k: "items" | "give" | "get", next: Item[]) => setSaved({ ...saved, [k]: next });
  const addTo = (k: "items" | "give" | "get", v: PriceVersion) => {
    const list = (k === "items" ? items : k === "give" ? give : get);
    const i = list.findIndex((x) => x.id === v.id);
    setList(k, i >= 0 ? list.map((x, j) => (j === i ? { ...x, qty: Math.min(99, x.qty + 1) } : x)) : [...list, { ...v, game, qty: 1 }]);
  };
  const add = (v: PriceVersion) => addTo("items", v);
  const sum = (list: Item[]) => list.reduce((t, x) => t + (unitUsd(x) ?? 0) * x.qty, 0);
  const total = sum(items);
  const missing = items.filter((x) => unitUsd(x) === null).length;

  async function copy() {
    const lines = items.map((x) => `${x.qty} × ${x.name}${x.code ? ` (${x.code})` : ""}${x.variant !== "Normal" ? ` ${x.variant}` : ""} — ${show(unitUsd(x))} c/u`);
    const t = [`🃏 Lista de precios (${src === "tcg" ? "TCGplayer" : "Cardmarket"}) — Cazacartas`, ...lines, `Total: ${show(total)}`].join("\n");
    try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("Copiá la lista:", t); }
  }

  // al cambiar de juego, se limpian los resultados de búsqueda (la lista queda)
  useEffect(() => { setResults(null); }, [game]);

  return (
    <div className={embedded ? "calc-embedded" : undefined}>
        {embedded && (
          <p className="translated">
            Armá una lista y mirá cuánto vale en <b>TCGplayer</b> (EE. UU.) o <b>Cardmarket</b> (Europa), en pesos o dólares (botón 💲 arriba).
            Son precios de referencia internacionales: para ver las tiendas de Argentina usá “Buscar una carta”.
          </p>
        )}
        <div className="tabs calc-mode" role="tablist" aria-label="Modo">
          <button type="button" role="tab" aria-selected={mode === "lista"} className={mode === "lista" ? "on" : ""} onClick={() => setSaved({ ...saved, mode: "lista" })}>🧾 Lista de precios</button>
          <button type="button" role="tab" aria-selected={mode === "cambio"} className={mode === "cambio" ? "on" : ""} onClick={() => setSaved({ ...saved, mode: "cambio" })}>🔄 Intercambio</button>
        </div>
        {mode === "cambio" && <p className="translated">Cargá lo que das y lo que recibís, y mirá si el cambio está parejo según el precio internacional.</p>}
        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); find(); }}>
          <div className="field">
            <label htmlFor="cq">Buscá la carta</label>
            <Autocomplete id={embedded ? "cq-tab" : "cq"} game={game} value={q} onChange={setQ} onPick={(v) => find(v)} placeholder={GAMES[game].placeholder} />
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
                    {mode === "lista" ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => add(v)}>+ Agregar</button>
                    ) : (
                      <div className="calc-trade-btns">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addTo("give", v)}>+ Doy</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addTo("get", v)}>+ Recibo</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {mode === "cambio" && (
          <section className="panel calc-list">
            <div className="res-h">
              <h2>Intercambio</h2>
              <label className="calc-src">Precio de
                <select value={src} onChange={(e) => setSaved({ ...saved, source: e.target.value as Source })}>
                  <option value="tcg">TCGplayer (EE. UU.)</option>
                  <option value="cm">Cardmarket (Europa)</option>
                </select>
              </label>
            </div>
            <div className="trade-cols">
              {([["give", "📤 Doy", give], ["get", "📥 Recibo", get]] as const).map(([k, t, list]) => (
                <div key={k} className="trade-col">
                  <h3>{t} <small>{show(sum(list))}</small></h3>
                  {list.length === 0 ? <p className="hint">Buscá una carta y tocá “+ {k === "give" ? "Doy" : "Recibo"}”.</p> : (
                    <ul className="calc-items">
                      {list.map((x) => (
                        <li key={x.id}>
                          <div className="calc-info"><b>{x.name}</b><span className="alias">{[x.code, x.rarity, x.variant !== "Normal" ? x.variant : null].filter(Boolean).join(" · ")}</span></div>
                          <div className="qty">
                            <button type="button" aria-label="Una menos" onClick={() => setList(k, x.qty <= 1 ? list.filter((y) => y.id !== x.id) : list.map((y) => (y.id === x.id ? { ...y, qty: y.qty - 1 } : y)))}>−</button>
                            <span>{x.qty}</span>
                            <button type="button" aria-label="Una más" onClick={() => setList(k, list.map((y) => (y.id === x.id ? { ...y, qty: Math.min(99, y.qty + 1) } : y)))}>+</button>
                          </div>
                          <div className="calc-sub"><b>{show(unitUsd(x) === null ? null : unitUsd(x)! * x.qty)}</b></div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {(give.length > 0 || get.length > 0) && (() => {
              const d = sum(get) - sum(give);
              const pct = sum(give) > 0 ? Math.round((d / sum(give)) * 100) : null;
              return (
                <div className="calc-total">
                  <span>{Math.abs(d) < 0.5 ? "El cambio está parejo" : d > 0 ? "Recibís más de lo que das" : "Das más de lo que recibís"}{pct !== null && Math.abs(d) >= 0.5 ? ` (${pct > 0 ? "+" : ""}${pct} %)` : ""}</span>
                  <b>{d >= 0 ? "+" : "−"}{show(Math.abs(d))}</b>
                  <small>Para emparejar, {d > 0 ? "vos agregarías" : "la otra persona agregaría"} {show(Math.abs(d))} en cartas o dinero. <button type="button" className="linkbtn" onClick={() => setSaved({ ...saved, give: [], get: [] })}>Vaciar</button></small>
                </div>
              );
            })()}
          </section>
        )}

        {mode === "lista" && <section className="panel calc-list">
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
        </section>}

        <p className="pcmp-note">
          Precios de referencia sin envío ni impuestos, actualizados una vez por día por las bases públicas de cartas (Scryfall, YGOPRODeck,
          Pokémon TCG API, OPTCG API). No reflejan los precios de las tiendas de Argentina: para eso usá el buscador. Este sitio usa datos de
          TCGplayer, pero no está avalado ni certificado por TCGplayer.
        </p>
    </div>
  );
}
