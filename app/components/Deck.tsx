"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Game, SearchResponse } from "@/lib/types.ts";
import { formatHint, parseDecklist, type DeckEntry, type DeckError } from "@/lib/decklist.ts";
import { coverageByStore, matchEntry, type DeckCard } from "@/lib/deck.ts";
import { cardKey, optimize, planText, type Plan } from "@/lib/optimizer.ts";
import { idDeckToText, isYdk, isYdke, parseYdk, parseYdke } from "@/lib/deckimport.ts";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import { STORES } from "@/lib/stores.ts";
import { deckUrl } from "@/lib/share.ts";
import { agoText, hoursSince, STALE_HOURS } from "@/lib/freshness.ts";
import { sameArea } from "@/lib/provinces.ts";
import type { WishOffer } from "@/lib/wishlist.ts";
import { AvisoMazo } from "./Aviso.tsx";
import { useWishlist } from "./useWishlist.ts";
import { ShareLinks } from "./ShareLinks.tsx";
import { ProvinceSelect, useProvince } from "./useProvince.tsx";
import { search, searchMany, trackClick } from "./searchClient.ts";
import { isTransient } from "@/lib/status.ts";
import type { ReportContext } from "./ReportDialog.tsx";

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const EXAMPLES = Object.fromEntries(GAME_IDS.map((g) => [g, GAMES[g].deckExample])) as Record<Game, string>;
const RAR_ORDER = Object.fromEntries(GAME_IDS.map((g) => [g, GAMES[g].rarityOrder])) as Record<Game, string[]>;
const STORE = new Map(STORES.map((s) => [s.id, s]));
const MAX_FILE = 200_000;

type View = "plan" | "tiendas" | "cartas";
type Strategy = "barata" | "menos" | "equilibrada" | "manual";
type Sort = "precio-desc" | "precio-asc" | "rareza" | "nombre" | "cantidad" | "faltantes";

const STRATEGY: Record<Strategy, { title: string; how: string }> = {
  barata: { title: "Menor costo total", how: "Suma cartas y envíos que conozcas. Si cargás un envío estimado, junta compras en menos tiendas cuando el ahorro de envío lo compensa." },
  menos: { title: "Menos tiendas", how: "Cubre el listado con la menor cantidad de tiendas posible, respetando el stock. Puede salir más caro en cartas." },
  equilibrada: { title: "Equilibrada", how: "La menor cantidad de tiendas pagando como mucho un 10 % más que la opción de menor costo." },
  manual: { title: "Personalizada", how: "Tus elecciones de tienda por carta; el resto se completa con lo más barato." },
};

export function Deck({ game, onAdded, initialText, autoRun, onReport }: {
  game: Game; onAdded?: (n: number) => void; initialText?: string; autoRun?: boolean; onReport?: (ctx: ReportContext) => void;
}) {
  const wish = useWishlist();
  const [text, setText] = useState(initialText ?? "");
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  const [cards, setCards] = useState<DeckCard[] | null>(null);
  const [errors, setErrors] = useState<DeckError[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<View>("plan");
  const [strategy, setStrategy] = useState<Strategy>("barata");
  const [shipping, setShipping] = useState("");
  const [pickupNear, setPickupNear] = useState(false);
  const [pickup, setPickup] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<Sort>("precio-desc");
  const [openStore, setOpenStore] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [catalogAt, setCatalogAt] = useState<string | null>(null);
  const [province, setProvince] = useProvince();
  const [onlyNear, setOnlyNear] = useState(false);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);
  const started = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Si se abrió desde un link compartido o desde "Buscar toda mi lista", se busca solo
  useEffect(() => {
    if (autoRun && initialText && !started.current) { started.current = true; run(initialText); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** YDK / YDKE (Yu-Gi-Oh!): pasa los códigos numéricos a nombres */
  async function convertIds(src: string): Promise<string | null> {
    const deck = isYdke(src) ? parseYdke(src) : parseYdk(src);
    const ids = [...new Set([...deck.main, ...deck.extra, ...deck.side])];
    if (!ids.length) { setNotice("No encontramos cartas en ese archivo."); return null; }
    const res = await fetch(`/api/ydk?ids=${ids.join(",")}`);
    const names = (await res.json()) as Record<string, string> & { error?: string };
    if (!res.ok || names.error) { setNotice(names.error ?? "No se pudieron leer los nombres de las cartas."); return null; }
    const { text: out, unknown } = idDeckToText(deck, names);
    setNotice(`Convertimos el archivo de Yu-Gi-Oh! a nombres${deck.side.length ? " (sin el Side Deck)" : ""}.${unknown.length ? ` No reconocimos ${unknown.length} código${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.` : ""}`);
    return out;
  }

  async function run(source = text) {
    setNotice(null);
    let src = source;
    if (game === "ygo" && (isYdk(src) || isYdke(src))) {
      const conv = await convertIds(src);
      if (!conv) return;
      src = conv;
      setText(conv);
    }
    const parsed = parseDecklist(src, game);
    setErrors(parsed.errors);
    setEntries(parsed.entries);
    setEdits({});
    setCards(null);
    setFailed([]);
    if (!parsed.entries.length) return;

    // Una búsqueda por nombre distinto, de a 3 a la vez; las repetidas salen de la memoria (10 min)
    const names = [...new Set(parsed.entries.map((e) => e.name))];
    const results = new Map<string, SearchResponse | null>();
    setProgress({ done: 0, total: names.length });
    let done = 0;
    await searchMany(names, async (name) => {
      try {
        results.set(name, await search(game, name, { stream: false }));
      } catch {
        results.set(name, null);
      }
      setProgress({ done: ++done, total: names.length });
    }, 2);

    // Reintento: las cartas en las que alguna tienda tardó o se cortó se vuelven a buscar de a una,
    // con una pausa (el servidor solo vuelve a consultar las tiendas que fallaron)
    const retry = names.filter((n) => { const r = results.get(n); return !r || r.stores.some((s) => isTransient(s.error)); });
    if (retry.length) {
      setNotice(`Algunas tiendas tardaron en responder: reintentando ${retry.length} carta${retry.length === 1 ? "" : "s"}…`);
      for (const name of retry) {
        await new Promise((r) => setTimeout(r, 1200));
        try { results.set(name, await search(game, name, { stream: false, fresh: true })); } catch { /* queda el resultado anterior */ }
      }
      setNotice(null);
    }

    const dates = [...results.values()].flatMap((r) => r?.stores.filter((s) => s.mode === "index" && s.ok && s.count > 0 && s.indexedAt).map((s) => s.indexedAt!) ?? []);
    setCatalogAt(dates.length ? dates.sort()[0] : null);
    // "No respondieron" = fallas reales en vivo; las tiendas cuyo catálogo todavía no se cargó se informan aparte
    const down = new Set([...results.values()].flatMap((r) => r?.stores.filter((s) => !s.ok && s.mode !== "index").map((s) => s.name) ?? []));
    const noCatalog = new Set([...results.values()].flatMap((r) => r?.stores.filter((s) => !s.ok && s.mode === "index").map((s) => s.name) ?? []));
    setFailed([...down]);
    setPending([...noCatalog]);

    setCards(parsed.entries.map((e) => {
      const res = results.get(e.name);
      if (!res) return { entry: e, name: e.name, known: false, error: "No se pudo buscar esta carta. Probá de nuevo en unos segundos.", offers: [], outOfStock: 0 } as DeckCard;
      return matchEntry(game, e, res);
    }));
    setOverrides({});
    setProgress(null);
  }

  /** Corrige una línea sin volver a pegar todo */
  function fixLine(line: number) {
    const v = edits[line];
    if (v === undefined) return;
    const lines = text.split(/\r?\n/);
    lines[line - 1] = v;
    const next = lines.join("\n");
    setText(next);
    run(next);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE) { setNotice("El archivo es muy grande (máximo 200 KB)."); return; }
    const content = await file.text();
    setText(content);
    setNotice(`Cargamos ${file.name}. Revisalo y tocá Buscar.`);
  }

  const valid = useMemo(() => (cards ?? []).filter((c) => !c.error), [cards]);
  const unknown = (cards ?? []).filter((c) => c.error);
  const totalCopies = valid.reduce((s, c) => s + c.entry.qty, 0);

  // Tiendas con retiro: las que marcás a mano + (si querés) todas las que tienen local en tu provincia
  const pickupSet = useMemo(() => {
    const s = new Set(pickup);
    if (pickupNear && province) for (const st of STORES) if (st.hasLocal && sameArea(province, st.province)) s.add(st.id);
    return s;
  }, [pickup, pickupNear, province]);
  const shipNum = shipping.trim() === "" ? null : Math.max(0, Number(shipping.replace(/\D/g, "")) || 0);
  const plans = useMemo(
    () => (valid.length ? optimize(valid, { shippingPerStore: shipNum, pickup: pickupSet, overrides }) : null),
    [valid, shipNum, pickupSet, overrides]
  );
  const plan: Plan | null = plans ? (strategy === "manual" ? plans.manual ?? plans.barata : plans[strategy]) : null;

  const isNear = (storeId: string, hasLocal: boolean) => hasLocal && sameArea(province, STORE.get(storeId)?.province);
  const allStores = useMemo(() => coverageByStore(valid), [valid]);
  const stores = onlyNear && province ? allStores.filter((s) => isNear(s.storeId, s.hasLocal)) : allStores;

  const sortedCards = useMemo(() => {
    const rar = (c: DeckCard) => { const r = c.offers[0]?.rarity; const i = r ? RAR_ORDER[game].indexOf(r) : -1; return i < 0 ? -1 : i; };
    const best = (c: DeckCard) => c.offers[0]?.price ?? Infinity;
    return [...valid].sort((a, b) => {
      switch (sort) {
        case "precio-desc": return (best(b) === Infinity ? -1 : best(b)) - (best(a) === Infinity ? -1 : best(a));
        case "precio-asc": return best(a) - best(b);
        case "rareza": return rar(b) - rar(a) || best(b) - best(a);
        case "nombre": return a.name.localeCompare(b.name);
        case "cantidad": return b.entry.qty - a.entry.qty;
        case "faltantes": return Number(a.offers.length > 0) - Number(b.offers.length > 0) || a.name.localeCompare(b.name);
      }
    });
  }, [valid, sort, game]);

  /** Pasa el plan elegido a "Mi lista", con la tienda de cada carta */
  function passToList() {
    if (!plan) return;
    const items = valid.filter((c) => c.offers.length).map((c) => {
      const line = plan.lines.find((l) => l.key === cardKey(c));
      const byStore = new Map<string, WishOffer>();
      for (const o of c.offers) if (!byStore.has(o.storeId)) byStore.set(o.storeId, { storeId: o.storeId, storeName: o.storeName, storeCity: o.storeCity, price: o.price, url: o.url, stock: o.stockKnown ? o.stock : null });
      const best = c.offers[0];
      return { game, name: c.name, code: c.entry.code ?? best.code, rarity: best.rarity, version: best.version, qty: c.entry.qty, offers: [...byStore.values()], storeId: line?.buys[0]?.storeId ?? best.storeId };
    });
    wish.addMany(items);
    onAdded?.(items.length);
  }

  async function copyPlan() {
    if (!plan) return;
    const t = planText(plan, STRATEGY[plan.id].title);
    try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt("Copiá el plan:", t); }
  }

  function setOverride(key: string, storeId: string) {
    const next = { ...overrides };
    if (storeId) next[key] = storeId; else delete next[key];
    setOverrides(next);
    setStrategy(Object.keys(next).length ? "manual" : "barata");
  }

  return (
    <section className="group" aria-labelledby="deck-t">
      <div className="panel">
        <div className="group-h"><h3 id="deck-t">Pegá tu lista de cartas</h3></div>
        <AvisoMazo />
        <div className="field">
          <label htmlFor="deck">Pegá tu listado de cartas / decklist</label>
          <textarea id="deck" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLES[game]} spellCheck={false} />
          <span className="hint">
            {formatHint(game)}. La cantidad puede ir antes o después del nombre (3, x3, 3x, -3).
            {game === "ygo" && " También acepta archivos .ydk y links ydke://."}
            {game === "pkm" && " Acepta el formato de Pokémon TCG Live."}
            {game === "mtg" && " Acepta el formato de Arena / Moxfield."}
          </span>
        </div>
        <div className="search">
          <button className="btn btn-primary" type="button" onClick={() => run()} disabled={!!progress || !text.trim()}>
            {progress ? `Buscando ${progress.done} de ${progress.total} cartas…` : "Buscar el listado en las tiendas"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => fileRef.current?.click()}>Subir archivo</button>
          <input ref={fileRef} type="file" accept=".txt,.ydk,.dek,.dck,.csv,text/plain" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button className="btn btn-ghost" type="button" onClick={() => setText(EXAMPLES[game])}>Usar lista de ejemplo</button>
          {progress && <span className="slow-note">Puede demorar unos segundos de más: buscamos cada carta en todas las tiendas.</span>}
        </div>
        {progress && (
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <i style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        )}
        {notice && <p className="translated" role="status">{notice}</p>}

        {(errors.length > 0 || unknown.length > 0) && (
          <div className="warn-box" role="alert">
            <b>Hay {errors.length + unknown.length} línea{errors.length + unknown.length === 1 ? "" : "s"} para revisar</b>
            <p className="translated">Corregila acá mismo y tocá Corregir: no hace falta volver a pegar todo.</p>
            <ul>
              {[...errors.map((e) => ({ line: e.line, raw: e.raw, reason: e.reason })), ...unknown.map((c) => ({ line: c.entry.line, raw: c.entry.raw, reason: c.error ?? "" }))].map((e) => (
                <li key={"e" + e.line}>
                  <code>Línea {e.line}: {e.raw.trim() || "(vacía)"}</code>
                  <span>{e.reason}</span>
                  <div className="fix">
                    <input aria-label={`Corregir línea ${e.line}`} value={edits[e.line] ?? e.raw.trim()} onChange={(ev) => setEdits({ ...edits, [e.line]: ev.target.value })} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => fixLine(e.line)}>Corregir</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {cards && valid.length > 0 && plans && plan && (
        <>
          <div className="stats">
            <div className="stat"><b>{valid.length}</b><span>cartas distintas · {totalCopies} copias</span></div>
            <div className="stat"><b>{plans.barata.copies}</b><span>copias encontradas en tiendas</span></div>
            <div className="stat"><b>{plans.barata.missingCopies}</b><span>copias que ninguna tienda tiene</span></div>
            <div className="stat"><b>{fmt.format(plans.barata.total)}</b><span>mejor total entre las tiendas consultadas</span></div>
          </div>

          <div className="res-tools">
            <p className="fresh-note">
              {catalogAt
                ? <>Algunas tiendas se leen una vez por día (la más vieja es {agoText(catalogAt)}{(hoursSince(catalogAt) ?? 0) > STALE_HOURS ? ", puede haber cambiado" : ""}). El resto son precios en vivo.</>
                : "Todos los precios se consultaron en vivo recién."}
              {failed.length > 0 && <> No respondieron en alguna carta (aun después de reintentar): {failed.join(", ")}.</>}
              {pending.length > 0 && <> Sin catálogo cargado todavía: {pending.join(", ")}.</>}
            </p>
            {typeof window !== "undefined" && entries.length > 0 && (
              <ShareLinks label="Compartir este listado" url={deckUrl(window.location.origin, game, entries)} text={`Mirá dónde conseguir las cartas de este listado (${totalCopies} copias):`} />
            )}
          </div>

          <div className="tabs" role="tablist">
            {([["plan", "Plan de compra"], ["tiendas", "Por tienda"], ["cartas", "Por carta"]] as [View, string][]).map(([v, l]) => (
              <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{l}</button>
            ))}
          </div>

          {view === "plan" && (
            <div className="list">
              <div className="panel opt-opts">
                <div className="field">
                  <label htmlFor="ship">Envío estimado por tienda (opcional)</label>
                  <input id="ship" inputMode="numeric" placeholder="Ej: 6000" value={shipping} onChange={(e) => setShipping(e.target.value.replace(/[^\d]/g, "").slice(0, 7))} />
                  <span className="hint">Lo ponés vos: cada tienda cobra distinto según tu ciudad. Sin este dato, los envíos quedan “sin datos” y no se suman.</span>
                </div>
                <div className="field">
                  <label htmlFor="deck-prov2">Tu provincia</label>
                  <ProvinceSelect id="deck-prov2" value={province} onChange={setProvince} />
                  <label className="check">
                    <input type="checkbox" checked={pickupNear && !!province} disabled={!province} onChange={(e) => setPickupNear(e.target.checked)} />
                    Retiro en los locales de mi provincia (envío $0)
                  </label>
                </div>
              </div>

              <div className="strategies" role="radiogroup" aria-label="Estrategia de compra">
                {(["barata", "menos", "equilibrada", ...(plans.manual ? ["manual"] : [])] as Strategy[]).map((s) => {
                  const p = s === "manual" ? plans.manual! : plans[s];
                  const diff = p.total - plans.barata.total;
                  return (
                    <button key={s} type="button" role="radio" aria-checked={strategy === s} className={`strat${strategy === s ? " on" : ""}`} onClick={() => setStrategy(s)}>
                      <b>{STRATEGY[s].title}</b>
                      <span className="strat-total">{fmt.format(p.total)}</span>
                      <small>{p.stores.length} tienda{p.stores.length === 1 ? "" : "s"}{diff > 0 ? ` · +${fmt.format(diff)}` : ""}{p.unknownShipping ? ` · ${p.unknownShipping} envío${p.unknownShipping === 1 ? "" : "s"} sin datos` : ""}</small>
                    </button>
                  );
                })}
              </div>
              <p className="translated">{STRATEGY[plan.id].how} Es el mejor resultado entre las tiendas que respondieron, no necesariamente el mínimo del país.</p>

              <div className="totals">
                <div><span>Cartas</span><b>{fmt.format(plan.cardsTotal)}</b></div>
                <div><span>Envíos conocidos</span><b>{fmt.format(plan.shippingKnown)}</b></div>
                <div><span>Envíos sin datos</span><b>{plan.unknownShipping ? `${plan.unknownShipping} tienda${plan.unknownShipping === 1 ? "" : "s"}` : "—"}</b></div>
                <div className="grand"><span>Total estimado{plan.unknownShipping ? " (sin esos envíos)" : ""}</span><b>{fmt.format(plan.total)}</b></div>
              </div>
              {(plan.unconfirmedStock > 0 || plan.missingCopies > 0) && (
                <p className="warn-inline">
                  {plan.unconfirmedStock > 0 && <>⚠️ {plan.unconfirmedStock} copia{plan.unconfirmedStock === 1 ? "" : "s"} en tiendas que no informan cuánto stock tienen: confirmá antes de pagar. </>}
                  {plan.missingCopies > 0 && <>❌ Faltan {plan.missingCopies} copia{plan.missingCopies === 1 ? "" : "s"} que ninguna tienda consultada tiene.</>}
                </p>
              )}

              {plan.stores.map((s) => {
                const st = STORE.get(s.storeId);
                return (
                  <article className="card store-card" key={s.storeId}>
                    <div className="info">
                      <div className="ttl">
                        <div>
                          <h3>{s.storeName}</h3>
                          <span className="alias">{st?.hasLocal ? `Local en ${st.city ?? "Argentina"}` : "Solo online"}{st?.cashDiscount ? ` · ${st.cashDiscount.percent}% OFF ${st.cashDiscount.label}` : ""}</span>
                        </div>
                        <div className="from">
                          <small>{s.items.reduce((n, i) => n + i.qty, 0)} copias</small>
                          <b>{fmt.format(s.subtotal)}</b>
                          <small>{s.pickup ? "Retiro en local: envío $0" : s.shipping !== null ? `+ envío est. ${fmt.format(s.shipping)}` : "+ envío sin datos"}</small>
                        </div>
                      </div>
                      {st?.hasLocal && !(pickupNear && sameArea(province, st.province)) && (
                        <label className="check">
                          <input type="checkbox" checked={pickup.has(s.storeId)} onChange={(e) => { const n = new Set(pickup); if (e.target.checked) n.add(s.storeId); else n.delete(s.storeId); setPickup(n); }} />
                          Retiro en el local (envío $0)
                        </label>
                      )}
                      <ul className="deck-items">
                        {s.items.map((it) => (
                          <li key={it.name + it.code + it.url}>
                            <span>{it.qty} × {it.name}{it.code ? ` (${it.code})` : ""}{it.version && <span className="tag ver">{it.version}</span>}</span>
                            <a href={it.url} target="_blank" rel="noopener" onClick={() => trackClick(game, s.storeId)}>{fmt.format(it.price)} c/u ↗</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                );
              })}

              <details className="filters">
                <summary>Elegir la tienda de cada carta a mano</summary>
                <div className="tbl">
                  <table>
                    <thead><tr><th>Cant.</th><th>Carta</th><th>Comprar en</th><th className="num">Subtotal</th></tr></thead>
                    <tbody>
                      {plan.lines.map((l) => {
                        const c = valid.find((x) => cardKey(x) === l.key);
                        const storesFor = [...new Map((c?.offers ?? []).map((o) => [o.storeId, o])).values()];
                        return (
                          <tr key={l.key} className={l.missing ? "row-miss" : ""}>
                            <td className="num">{l.qty}</td>
                            <td><b>{l.name}</b>{l.code && <div className="pc">{l.code}</div>}{l.missing > 0 && <div className="no">Faltan {l.missing}</div>}</td>
                            <td>
                              {storesFor.length ? (
                                <select aria-label={`Tienda para ${l.name}`} value={overrides[l.key] ?? ""} onChange={(e) => setOverride(l.key, e.target.value)}>
                                  <option value="">Automático ({l.buys.map((b) => b.storeName).join(" + ") || "sin stock"})</option>
                                  {storesFor.map((o) => <option key={o.storeId} value={o.storeId}>{o.storeName} · {fmt.format(o.price)}{o.stockKnown ? ` · ${o.stock} disp.` : ""}</option>)}
                                </select>
                              ) : <span className="no">Ninguna tienda la tiene</span>}
                            </td>
                            <td className="num">{fmt.format(l.buys.reduce((s, b) => s + b.qty * b.price, 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {Object.keys(overrides).length > 0 && <button type="button" className="linkbtn" onClick={() => { setOverrides({}); setStrategy("barata"); }}>Volver al cálculo automático</button>}
              </details>

              <div className="search">
                <button type="button" className="btn btn-primary" onClick={passToList}>Pasar este plan a mi lista</button>
                <button type="button" className="btn btn-ghost" onClick={copyPlan}>{copied ? "¡Copiado!" : "Copiar plan"}</button>
                <a className="btn btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(planText(plan, STRATEGY[plan.id].title))}`} target="_blank" rel="noopener">Mandar por WhatsApp</a>
              </div>
            </div>
          )}

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
                          <small>Tiene {s.cards} de {valid.length} cartas</small>
                          <b>{s.copies} / {totalCopies} copias</b>
                          <small>{fmt.format(s.cost)} por esas copias</small>
                        </div>
                      </div>
                      <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                      <button className="more" onClick={() => setOpenStore(isOpen ? null : s.storeId)}>{isOpen ? "Ocultar cartas" : "Ver qué cartas tiene"}</button>
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
                            <td>{nStores > 0 ? <button className="linkbtn" onClick={() => setOpenCard(openCard === k ? null : k)}>{nStores} tienda{nStores === 1 ? "" : "s"}</button> : "—"}</td>
                            <td className="num">{best ? fmt.format(best.price * c.entry.qty) : "—"}</td>
                          </tr>
                          {openCard === k && (
                            <tr className="row-x">
                              <td colSpan={6}>
                                <ul className="deck-items">
                                  {c.offers.map((o) => (
                                    <li key={o.url}>
                                      <span>{o.storeName} · {o.title}{o.stockKnown ? ` · ${o.stock} disp.` : " · stock sin confirmar"}</span>
                                      <a href={o.url} target="_blank" rel="noopener">{fmt.format(o.price)}</a>
                                      {onReport && <button type="button" className="o-rep" onClick={() => onReport({ types: ["precio", "stock", "link", "variante", "otra_carta"], game, carta: c.name, store_id: o.storeId, url: o.url })}>Reportar</button>}
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
