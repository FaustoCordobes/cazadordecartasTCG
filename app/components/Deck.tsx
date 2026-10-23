"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Game, SearchResponse } from "@/lib/types.ts";
import { formatHint, parseDecklist, type DeckError } from "@/lib/decklist.ts";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import { cheapestPlan, coverageByStore, matchEntry, type DeckCard } from "@/lib/deck.ts";
import { AvisoMazo } from "./Aviso.tsx";
import { useWishlist } from "./useWishlist.ts";
import type { WishOffer } from "@/lib/wishlist.ts";
import type { DeckEntry } from "@/lib/decklist.ts";
import { STORES } from "@/lib/stores.ts";
import { deckUrl } from "@/lib/share.ts";
import { agoText, hoursSince, STALE_HOURS } from "@/lib/freshness.ts";
import { sameArea } from "@/lib/provinces.ts";
import { ShareLinks } from "./ShareLinks.tsx";
import { ProvinceSelect, useProvince } from "./useProvince.tsx";

const STORE_PROVINCE = new Map(STORES.map((s) => [s.id, s.province]));

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const EXAMPLES = Object.fromEntries(GAME_IDS.map((g) => [g, GAMES[g].deckExample])) as Record<Game, string>;
const RAR_ORDER = Object.fromEntries(GAME_IDS.map((g) => [g, GAMES[g].rarityOrder])) as Record<Game, string[]>;

type View = "tiendas" | "barata" | "cartas";
type Sort = "precio-desc" | "precio-asc" | "rareza" | "nombre" | "cantidad" | "faltantes";

export function Deck({ game, onAdded, initialText, autoRun }: { game: Game; onAdded?: (n: number) => void; initialText?: string; autoRun?: boolean }) {
  const wish = useWishlist();
  const [text, setText] = useState(initialText ?? "");
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  /** el catálogo diario más viejo entre las tiendas que respondieron */
  const [catalogAt, setCatalogAt] = useState<string | null>(null);
  const [province, setProvince] = useProvince();
  const [onlyNear, setOnlyNear] = useState(false);
  const started = useRef(false);

  // Si se abrió desde un link compartido, se busca solo
  useEffect(() => {
    if (autoRun && initialText && !started.current) { started.current = true; run(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [errors, setErrors] = useState<DeckError[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [view, setView] = useState<View>("tiendas");
  const [sort, setSort] = useState<Sort>("precio-desc");
  const [openStore, setOpenStore] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);

  async function run() {
    const parsed = parseDecklist(text, game);
    setErrors(parsed.errors);
    setEntries(parsed.entries);
    setCards(null);
    if (!parsed.entries.length) return;

    // Una búsqueda por nombre distinto (Angemon BT25 y BT23 comparten búsqueda), de a 3 a la vez
    const names = [...new Set(parsed.entries.map((e) => e.name))];
    const results = new Map<string, SearchResponse | null>();
    setProgress({ done: 0, total: names.length });
    let i = 0, done = 0;
    async function worker() {
      while (i < names.length) {
        const name = names[i++];
        try {
          const res = await fetch(`/api/buscar?game=${game}&q=${encodeURIComponent(name)}`);
          results.set(name, res.ok ? ((await res.json()) as SearchResponse) : null);
        } catch {
          results.set(name, null);
        }
        setProgress({ done: ++done, total: names.length });
      }
    }
    await Promise.all([worker(), worker(), worker()]);

    const dates = [...results.values()].flatMap((r) => r?.stores.filter((s) => s.mode === "index" && s.ok && s.count > 0 && s.indexedAt).map((s) => s.indexedAt!) ?? []);
    setCatalogAt(dates.length ? dates.sort()[0] : null);

    const matched = parsed.entries.map((e) => {
      const res = results.get(e.name);
      if (!res) {
        return { entry: e, name: e.name, known: false, error: "No se pudo buscar esta carta. Probá de nuevo en unos segundos.", offers: [], outOfStock: 0 } as DeckCard;
      }
      return matchEntry(game, e, res);
    });
    setCards(matched);
    setProgress(null);
  }

  /** Pasa las cartas con stock a "Mi lista", eligiendo la tienda más barata de cada una */
  function passToList() {
    if (!cards) return;
    const items = cards
      .filter((c) => !c.error && c.offers.length)
      .map((c) => {
        const byStore = new Map<string, WishOffer>();
        for (const o of c.offers) {
          if (!byStore.has(o.storeId)) {
            byStore.set(o.storeId, { storeId: o.storeId, storeName: o.storeName, storeCity: o.storeCity, price: o.price, url: o.url, stock: o.stockKnown ? o.stock : null });
          }
        }
        const best = c.offers[0];
        return { game, name: c.name, code: c.entry.code ?? best.code, rarity: best.rarity, version: best.version, qty: c.entry.qty, offers: [...byStore.values()], storeId: best.storeId };
      });
    wish.addMany(items);
    onAdded?.(items.length);
  }

  const allStores = useMemo(() => (cards ? coverageByStore(cards.filter((c) => !c.error)) : []), [cards]);
  const isNear = (storeId: string, hasLocal: boolean) => hasLocal && sameArea(province, STORE_PROVINCE.get(storeId));
  const stores = useMemo(
    () => (onlyNear && province ? allStores.filter((s) => isNear(s.storeId, s.hasLocal)) : allStores),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allStores, onlyNear, province]
  );
  const plan = useMemo(() => (cards ? cheapestPlan(cards.filter((c) => !c.error)) : null), [cards]);
  const totalCopies = cards?.filter((c) => !c.error).reduce((s, c) => s + c.entry.qty, 0) ?? 0;
  const totalCards = cards?.filter((c) => !c.error).length ?? 0;
  const unknown = cards?.filter((c) => c.error) ?? [];

  const sortedCards = useMemo(() => {
    if (!cards) return [];
    const list = cards.filter((c) => !c.error);
    const rar = (c: DeckCard) => {
      const r = c.offers[0]?.rarity;
      const i = r ? RAR_ORDER[game].indexOf(r) : -1;
      return i < 0 ? -1 : i;
    };
    const best = (c: DeckCard) => c.offers[0]?.price ?? Infinity;
    return [...list].sort((a, b) => {
      switch (sort) {
        case "precio-desc": return (best(b) === Infinity ? -1 : best(b)) - (best(a) === Infinity ? -1 : best(a));
        case "precio-asc": return best(a) - best(b);
        case "rareza": return rar(b) - rar(a) || best(b) - best(a);
        case "nombre": return a.name.localeCompare(b.name);
        case "cantidad": return b.entry.qty - a.entry.qty;
        case "faltantes": return Number(a.offers.length > 0) - Number(b.offers.length > 0) || a.name.localeCompare(b.name);
      }
    });
  }, [cards, sort, game]);

  return (
    <section className="group" aria-labelledby="deck-t">
      <div className="panel">
        <div className="group-h"><h3 id="deck-t">Pegá tu lista de cartas</h3></div>
        <AvisoMazo />
        <div className="field">
          <label htmlFor="deck">Pegá tu listado de cartas / decklist</label>
          <textarea
            id="deck" rows={10} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLES[game]} spellCheck={false}
          />
          <span className="hint">{formatHint(game)}. La cantidad puede ir antes o después del nombre (3, x3, 3x, -3).</span>
        </div>
        <div className="search">
          <button className="btn btn-primary" type="button" onClick={run} disabled={!!progress || !text.trim()}>
            {progress ? `Buscando ${progress.done} de ${progress.total} cartas…` : "Buscar el listado en las tiendas"}
          </button>
          {progress && <span className="slow-note">Puede demorar unos segundos de más: buscamos cada carta en todas las tiendas.</span>}
          <button className="btn btn-ghost" type="button" onClick={() => setText(EXAMPLES[game])}>Usar lista de ejemplo</button>
        </div>
        {progress && (
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <i style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        )}

        {(errors.length > 0 || unknown.length > 0) && (
          <div className="warn-box" role="alert">
            <b>Hay {errors.length + unknown.length} línea{errors.length + unknown.length === 1 ? "" : "s"} para revisar</b>
            <ul>
              {errors.map((e) => <li key={"e" + e.line}><code>Línea {e.line}: {e.raw.trim() || "(vacía)"}</code><span>{e.reason}</span></li>)}
              {unknown.map((c) => <li key={"u" + c.entry.line}><code>Línea {c.entry.line}: {c.entry.raw.trim()}</code><span>{c.error}</span></li>)}
            </ul>
          </div>
        )}
      </div>

      {cards && totalCards > 0 && plan && (
        <>
          <div className="stats">
            <div className="stat"><b>{totalCards}</b><span>cartas distintas · {totalCopies} copias</span></div>
            <div className="stat"><b>{plan.copies}</b><span>copias disponibles en tiendas</span></div>
            <div className="stat"><b>{fmt.format(plan.total)}</b><span>comprando cada copia al mejor precio</span></div>
            <div className="stat"><b>{plan.missingCopies}</b><span>copias que ninguna tienda tiene</span></div>
          </div>

          <div className="res-tools">
            <p className="fresh-note">
              {catalogAt
                ? <>Algunas tiendas se leen una vez por día (la más vieja es {agoText(catalogAt)}{(hoursSince(catalogAt) ?? 0) > STALE_HOURS ? ", puede haber cambiado" : ""}). El resto son precios en vivo.</>
                : "Todos los precios se consultaron en vivo recién."}
            </p>
            {typeof window !== "undefined" && entries.length > 0 && (
              <ShareLinks label="Compartir este listado" url={deckUrl(window.location.origin, game, entries)} text={`Mirá dónde conseguir las cartas de este listado (${totalCopies} copias):`} />
            )}
          </div>

          <div className="tabs" role="tablist">
            {([["tiendas", "Por tienda"], ["barata", "Compra más barata"], ["cartas", "Por carta"]] as [View, string][]).map(([v, l]) => (
              <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{l}</button>
            ))}
          </div>

          {view === "tiendas" && (
            <div className="list">
              <p className="translated">Ordenadas por cuántas copias de tu mazo tienen. Ideal para comprar todo en un solo lugar.</p>
              <div className="near-bar">
                <label className="lbl" htmlFor="deck-prov">Tu provincia</label>
                <ProvinceSelect id="deck-prov" value={province} onChange={(p) => { setProvince(p); if (!p) setOnlyNear(false); }} />
                <label className="check">
                  <input type="checkbox" checked={onlyNear && !!province} disabled={!province} onChange={(e) => setOnlyNear(e.target.checked)} />
                  Solo tiendas con local en mi provincia
                </label>
              </div>
              {stores.length === 0 && <div className="empty"><p>{onlyNear && province ? `Ninguna tienda con local en ${province} tiene cartas de este listado. Destildá el filtro para ver las que envían.` : "Ninguna tienda tiene cartas de este mazo con stock."}</p></div>}
              {stores.map((s) => {
                const pct = Math.round((s.copies / totalCopies) * 100);
                const isOpen = openStore === s.storeId;
                return (
                  <article className="card store-card" key={s.storeId}>
                    <div className="info">
                      <div className="ttl">
                        <div>
                          <h3>{s.storeName}</h3>
                          <span className="alias">{s.hasLocal ? `Local en ${s.storeCity}` : "Solo online"}{isNear(s.storeId, s.hasLocal) && <span className="near"> · 📍 En tu provincia</span>}</span>
                        </div>
                        <div className="from">
                          <small>Tiene {s.cards} de {totalCards} cartas</small>
                          <b>{s.copies} / {totalCopies} copias</b>
                          <small>{fmt.format(s.cost)} por esas copias</small>
                        </div>
                      </div>
                      <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                      <button className="more" onClick={() => setOpenStore(isOpen ? null : s.storeId)}>
                        {isOpen ? "Ocultar cartas" : "Ver qué cartas tiene"}
                      </button>
                      {isOpen && (
                        <ul className="deck-items">
                          {s.items.map((it) => (
                            <li key={it.name + it.code}>
                              <span>{it.covered}/{it.qty} · {it.name}{it.code ? ` (${it.code})` : ""}</span>
                              <a href={it.url} target="_blank" rel="noopener">{fmt.format(it.price)} c/u</a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {view === "barata" && (
            <div className="list">
              <div className="res-h">
                <p className="translated">Cada copia en la tienda que la tiene más barata, respetando el stock informado. Usa {plan.stores} tienda{plan.stores === 1 ? "" : "s"}.</p>
                <button type="button" className="btn btn-primary" onClick={passToList}>Pasar todo a mi lista</button>
              </div>
              <div className="tbl">
                <table>
                  <thead><tr><th>Cant.</th><th>Carta</th><th>Dónde comprar</th><th className="num">Subtotal</th></tr></thead>
                  <tbody>
                    {plan.lines.map((l) => (
                      <tr key={l.name + l.code}>
                        <td className="num">{l.qty}</td>
                        <td><b>{l.name}</b>{l.code && <div className="pc">{l.code}</div>}</td>
                        <td>
                          {l.buys.map((b) => (
                            <div key={b.url}>{b.qty} × <a href={b.url} target="_blank" rel="noopener">{b.storeName}</a> a {fmt.format(b.price)}</div>
                          ))}
                          {l.missing > 0 && <div className="no">Faltan {l.missing}: ninguna tienda las tiene</div>}
                        </td>
                        <td className="num">{fmt.format(l.buys.reduce((s, b) => s + b.qty * b.price, 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td colSpan={3}>Total</td><td className="num">{fmt.format(plan.total)}</td></tr></tfoot>
                </table>
              </div>
            </div>
          )}

          {view === "cartas" && (
            <div className="list">
              <div className="res-h">
                <p className="translated">El mejor precio de cada carta y en cuántas tiendas está.</p>
                <div className="sort">
                  <label className="lbl" htmlFor="deck-sort">Ordenar</label>
                  <select id="deck-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                    <option value="precio-desc">Más caras primero</option>
                    <option value="precio-asc">Más baratas primero</option>
                    <option value="rareza">Rareza</option>
                    <option value="cantidad">Cantidad</option>
                    <option value="faltantes">Las que faltan primero</option>
                    <option value="nombre">Nombre A–Z</option>
                  </select>
                </div>
              </div>
              <div className="tbl">
                <table>
                  <thead><tr><th>Cant.</th><th>Carta</th><th>Rareza</th><th>Mejor precio</th><th>Tiendas</th><th className="num">Subtotal</th></tr></thead>
                  <tbody>
                    {sortedCards.map((c) => {
                      const k = c.name + (c.entry.code ?? "");
                      const best = c.offers[0];
                      const nStores = new Set(c.offers.map((o) => o.storeId)).size;
                      return (
                        <Fragment key={k}>
                          <tr className={best ? "" : "row-miss"}>
                            <td className="num">{c.entry.qty}</td>
                            <td><b>{c.name}</b>{c.entry.code && <div className="pc">{c.entry.code}</div>}</td>
                            <td>{best?.rarity ?? "—"}</td>
                            <td>{best ? <><a href={best.url} target="_blank" rel="noopener">{fmt.format(best.price)}</a> <span className="alias">en {best.storeName}</span></> : <span className="no">Sin stock{c.outOfStock ? ` (${c.outOfStock} agotadas)` : ""}</span>}</td>
                            <td>
                              {nStores > 0
                                ? <button className="linkbtn" onClick={() => setOpenCard(openCard === k ? null : k)}>{nStores} tienda{nStores === 1 ? "" : "s"}</button>
                                : "—"}
                            </td>
                            <td className="num">{best ? fmt.format(best.price * c.entry.qty) : "—"}</td>
                          </tr>
                          {openCard === k && (
                            <tr className="row-x">
                              <td colSpan={6}>
                                <ul className="deck-items">
                                  {c.offers.map((o) => (
                                    <li key={o.url}>
                                      <span>{o.storeName} · {o.title}{o.stockKnown ? ` · ${o.stock} disp.` : ""}</span>
                                      <a href={o.url} target="_blank" rel="noopener">{fmt.format(o.price)}</a>
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
