"use client";

import { useMemo, useState } from "react";
import { STORES } from "@/lib/stores.ts";
import type { CardGroup, Game, SearchResponse } from "@/lib/types.ts";
import { storesForGame } from "@/lib/directory.ts";
import { Autocomplete } from "./components/Autocomplete.tsx";
import { Deck } from "./components/Deck.tsx";
import { AvisoCompleto, AvisoCorto, AvisoTiendas } from "./components/Aviso.tsx";
import { Wishlist } from "./components/Wishlist.tsx";
import { useWishlist } from "./components/useWishlist.ts";
import type { WishOffer } from "@/lib/wishlist.ts";

type Tab = "carta" | "mazo" | "lista";

/** "hace 3 h", "hace 2 días" */
function ago(iso: string | null | undefined) {
  if (!iso) return "sin fecha";
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "de hace minutos";
  if (h < 48) return `de hace ${h} h`;
  return `de hace ${Math.round(h / 24)} días`;
}

const domainOf = (u: string | null) => {
  if (!u) return null;
  try { return new URL(u).host.replace(/^www\./, ""); } catch { return null; }
};

type Flat = CardGroup["listings"][number] & {
  tipo?: string; sub?: string; extra?: string; attr?: string; race?: string; lvl?: string; color?: string[]; forma?: string;
  rar?: string; ver?: string; g: Game; cardName: string; cardKey: string;
};
type FilterSpec = { k: keyof Flat; label: string; dep?: keyof Flat; resets?: (keyof Flat)[]; multi?: boolean };

const CARD_FILTERS: Record<Game, FilterSpec[]> = {
  ygo: [
    { k: "tipo", label: "Tipo de carta", resets: ["sub"] },
    { k: "sub", label: "Subtipo", dep: "tipo" },
    { k: "attr", label: "Atributo" },
    { k: "race", label: "Tipo de monstruo" },
    { k: "lvl", label: "Nivel / Rango / Link" },
    { k: "rar", label: "Rareza" },
    { k: "set", label: "Expansión" },
    { k: "ver", label: "Edición" },
    { k: "lang", label: "Idioma" },
  ],
  digi: [
    { k: "color", label: "Color", multi: true },
    { k: "tipo", label: "Tipo de carta" },
    { k: "lvl", label: "Nivel" },
    { k: "forma", label: "Forma" },
    { k: "attr", label: "Atributo" },
    { k: "rar", label: "Rareza" },
    { k: "set", label: "Expansión" },
    { k: "ver", label: "Versión" },
  ],
};
const DIGI_RAR: Record<string, string> = { C: "C · Común", U: "U · Poco común", R: "R · Rara", SR: "SR · Super rara", SEC: "SEC · Secreta", UR: "UR · Ultra rara", P: "P · Promo" };
const RAR_ORDER: Record<Game, string[]> = {
  digi: ["C", "U", "R", "SR", "SEC", "UR", "P"],
  ygo: ["Common", "Rare", "Super Rare", "Ultra Rare", "Secret Rare", "Ultimate Rare", "Ghost Rare", "Starlight Rare", "Platinum Secret Rare", "Prismatic Secret Rare", "Prismatic Collector's Rare", "Quarter Century Secret Rare"],
};
const QUICK: Record<Game, string[]> = {
  ygo: ["Ash Blossom", "Dark Magician", "Mago Oscuro", "Blue-Eyes White Dragon"],
  digi: ["Omnimon", "Kimeramon", "Imperialdramon", "BT19-070"],
};
const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const DIGI_COLORS: Record<string, string> = { Rojo: "#d8413a", Azul: "#2f7fd0", Amarillo: "#eac53a", Verde: "#3aa65a", Negro: "#3f3f48", Morado: "#8448c0", Blanco: "#e9e9ef" };
function thumbColors(l: Flat): [string, string, boolean] {
  if (l.g === "digi") {
    const c = l.color ?? ["Blanco"];
    return [DIGI_COLORS[c[0]] ?? "#777", DIGI_COLORS[c[1] ?? c[0]] ?? "#444", c.length === 1 && (c[0] === "Blanco" || c[0] === "Amarillo")];
  }
  if (l.tipo === "Mágica") return ["#1f9c86", "#0e5146", false];
  if (l.tipo === "Trampa") return ["#b53e86", "#5b1743", false];
  const m: Record<string, [string, string, boolean]> = {
    Normal: ["#e0bb64", "#9a742a", true], Efecto: ["#d0773c", "#7f3d17", false], Fusión: ["#9264b3", "#4a2766", false],
    Sincronía: ["#f4f4f4", "#b8b8c0", true], Xyz: ["#3a3a40", "#101012", false], Link: ["#2f73c0", "#143762", false],
    Péndulo: ["#d0773c", "#1f9c86", false], Ritual: ["#4d7fc4", "#203e6b", false],
  };
  return m[l.sub ?? ""] ?? ["#777", "#333", false];
}

export default function Home() {
  const [game, setGame] = useState<Game>("digi");
  const [tab, setTab] = useState<Tab>("carta");
  const wish = useWishlist();
  const [toast, setToast] = useState<string | null>(null);
  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [sort, setSort] = useState("pasc");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const gameStores = STORES.filter((s) => s.games.includes(game));

  function switchGame(g: Game) {
    if (g === game) return;
    setGame(g); setData(null); setError(null); setQ(""); setF({}); setMin(""); setMax(""); setOpen(new Set());
  }

  async function search(text = q) {
    const term = text.trim();
    if (term.length < 2) { setError("Escribí al menos 2 letras del nombre o el código de la carta."); return; }
    setQ(term); setLoading(true); setError(null); setF({}); setMin(""); setMax(""); setOpen(new Set());
    try {
      const res = await fetch(`/api/buscar?game=${game}&q=${encodeURIComponent(term)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error en la búsqueda");
      setData(json as SearchResponse);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Cada publicación con los datos de la carta "aplanados" para filtrar
  const flat: Flat[] = useMemo(() => {
    if (!data) return [];
    return data.cards.flatMap((c) =>
      c.listings.map((l) => ({
        ...l,
        ...(l.info ?? {}),
        rar: l.rarity ?? undefined,
        ver: (game === "ygo" ? l.edition ?? l.version : l.version) ?? undefined,
        set: l.set,
        g: game,
        cardName: c.name,
        cardKey: c.key,
      }) as Flat)
    );
  }, [data, game]);

  function options(spec: FilterSpec): string[] {
    let ls = flat;
    if (spec.dep && f[spec.dep as string]) ls = ls.filter((l) => l[spec.dep!] === f[spec.dep as string]);
    const vals = [...new Set(ls.flatMap((l) => ([] as unknown[]).concat(l[spec.k] ?? [])).filter(Boolean) as string[])];
    if (spec.k === "rar") return vals.sort((a, b) => (RAR_ORDER[game].indexOf(a) + 1 || 99) - (RAR_ORDER[game].indexOf(b) + 1 || 99));
    return vals.sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }
  const label = (k: string, v: string) => (k === "rar" && game === "digi" ? DIGI_RAR[v] ?? v : v);

  function pass(l: Flat) {
    for (const s of CARD_FILTERS[game]) {
      const v = f[s.k as string];
      if (!v) continue;
      if (s.multi ? !((l[s.k] as string[] | undefined) ?? []).includes(v) : l[s.k] !== v) return false;
    }
    if (f.store && l.storeId !== f.store) return false;
    if (f.stock === "si" && l.available !== true) return false;
    if (f.stock === "no" && l.available !== false) return false;
    if (min !== "" && l.price < +min) return false;
    if (max !== "" && l.price > +max) return false;
    return true;
  }

  // Una tarjeta por versión de la carta (código + rareza + variante)
  const rows = useMemo(() => {
    const groups = new Map<string, Flat[]>();
    for (const l of flat) {
      if (!pass(l)) continue;
      if (!groups.has(l.cardKey)) groups.set(l.cardKey, []);
      groups.get(l.cardKey)!.push(l);
    }
    const meta = new Map((data?.cards ?? []).map((c) => [c.key, c]));
    const r = [...groups.entries()].map(([key, ls]) => {
      const avail = ls.filter((x) => x.available === true);
      const c = meta.get(key)!;
      return {
        key, name: c.name, code: c.code, rarity: c.rarity, version: c.version, setName: c.setName, ls,
        min: (avail[0] ?? ls[0]).price, hasAvail: avail.length > 0, stores: new Set(ls.map((x) => x.storeId)).size,
      };
    });
    r.sort((a, b) =>
      sort === "pasc" ? Number(b.hasAvail) - Number(a.hasAvail) || a.min - b.min
      : sort === "pdesc" ? b.min - a.min
      : sort === "stores" ? b.stores - a.stores || a.min - b.min
      : a.name.localeCompare(b.name) || (a.code ?? "").localeCompare(b.code ?? "", "en", { numeric: true })
    );
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, f, min, max, sort, game]);

  function setFilter(spec: FilterSpec | string, v: string) {
    const k = typeof spec === "string" ? spec : (spec.k as string);
    const next = { ...f, [k]: v };
    if (typeof spec !== "string") spec.resets?.forEach((r) => delete next[r as string]);
    setF(next);
  }

  const active: [string, string][] = [];
  CARD_FILTERS[game].forEach((s) => f[s.k as string] && active.push([s.k as string, `${s.label}: ${label(s.k as string, f[s.k as string])}`]));
  if (f.store) active.push(["store", "Tienda: " + (STORES.find((s) => s.id === f.store)?.name ?? f.store)]);
  if (f.stock) active.push(["stock", f.stock === "si" ? "Con stock" : "Agotado"]);
  if (min) active.push(["min", "Desde " + fmt.format(+min)]);
  if (max) active.push(["max", "Hasta " + fmt.format(+max)]);
  function removeActive(k: string) {
    if (k === "min") return setMin("");
    if (k === "max") return setMax("");
    const next = { ...f }; delete next[k];
    CARD_FILTERS[game].find((s) => s.k === k)?.resets?.forEach((r) => delete next[r as string]);
    setF(next);
  }

  /** Agrega una versión a "Mi lista" con las tiendas que la tienen; preferredStore = tienda elegida */
  function addToList(r: (typeof rows)[number], preferredStore?: string) {
    const byStore = new Map<string, WishOffer>();
    for (const l of r.ls) {
      if (l.available === false) continue;
      const prev = byStore.get(l.storeId);
      if (!prev || l.price < prev.price) {
        byStore.set(l.storeId, { storeId: l.storeId, storeName: l.storeName, storeCity: l.storeCity, price: l.price, url: l.url, stock: l.stock });
      }
    }
    const offers = [...byStore.values()].sort((a, b) => a.price - b.price);
    if (!offers.length) { notify("Ninguna tienda tiene stock de esta versión"); return; }
    const storeId = preferredStore && byStore.has(preferredStore) ? preferredStore : offers[0].storeId;
    wish.add({ game, name: r.name, code: r.code, rarity: r.rarity, version: r.version, qty: 1, offers, storeId });
    notify(`${r.name}${r.code ? " " + r.code : ""} agregada a tu lista (${byStore.get(storeId)!.storeName})`);
  }

  const pubs = rows.reduce((a, r) => a + r.ls.length, 0);

  return (
    <div className="app" data-game={game}>
      <div className="wrap">
        <header className="top">
          <div className="brand">
            <div className="logo" aria-hidden="true" />
            <div>
              <h1>Cazacartas</h1>
              <p>Buscá una carta y compará precios en tiendas TCG de Argentina</p>
            </div>
          </div>
          <span className="pill">Sin fines de lucro</span>
        </header>
        <AvisoCorto />

        <section aria-labelledby="s1">
          <div className="step"><b>1</b><h2 id="s1">Elegí el juego</h2></div>
          <div className="games">
            {(["ygo", "digi"] as Game[]).map((g) => {
              const n = STORES.filter((s) => s.games.includes(g)).length;
              return (
                <button key={g} className={`game g-${g}`} aria-pressed={game === g} onClick={() => switchGame(g)}>
                  <div className="emb">{g === "ygo" ? <span>YG</span> : "DG"}</div>
                  <div>
                    <strong>{g === "ygo" ? "Yu-Gi-Oh!" : "Digimon Card Game"}</strong>
                    <small>Busca en {n} tienda{n > 1 ? "s" : ""}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {tab === "lista" ? (
          <section aria-labelledby="s2l" className="group">
            <div className="step"><b>2</b><h2 id="s2l">Mi lista</h2></div>
            <ModeTabs tab={tab} setTab={setTab} count={wish.items.length} />
            <Wishlist onSearch={() => setTab("carta")} />
          </section>
        ) : tab === "mazo" ? (
          <section aria-labelledby="s2m" className="group">
            <div className="step"><b>2</b><h2 id="s2m">Armá tu mazo</h2></div>
            <ModeTabs tab={tab} setTab={setTab} count={wish.items.length} />
            <Deck key={game} game={game} onAdded={(n) => { notify(`Se agregaron ${n} cartas a tu lista`); }} />
          </section>
        ) : (
        <>
        <section aria-labelledby="s2">
          <div className="step"><b>2</b><h2 id="s2">Buscá la carta</h2></div>
          <ModeTabs tab={tab} setTab={setTab} count={wish.items.length} />
          <div className="panel">
            <form className="search" onSubmit={(e) => { e.preventDefault(); search(); }}>
              <div className="field">
                <label htmlFor="q">Nombre o código</label>
                <Autocomplete
                  id="q" game={game} value={q} onChange={setQ} onPick={(v) => search(v)}
                  placeholder={game === "ygo" ? "Ash Blossom, Mago Oscuro, RA01-EN008" : "Omnimon, Kimeramon, BT19-070"}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
            </form>
            <div className="quick">
              <span>Probá:</span>
              {QUICK[game].map((t) => <button key={t} type="button" onClick={() => search(t)}>{t}</button>)}
            </div>

            {loading && (
              <div className="stores-bar" aria-live="polite">
                <span className="sbadge wait"><i />Buscando en {gameStores.length} tiendas…</span>
              </div>
            )}
            {!loading && data && (() => {
              const withHits = data.stores.filter((s) => s.ok && s.count > 0);
              const answered = data.stores.filter((s) => s.ok).length;
              return (
                <div className="group" aria-live="polite">
                  <div className="stores-bar">
                    <span className="sbadge ok"><i />Respondieron {answered} de {data.stores.length} tiendas</span>
                    {withHits.map((s) => (
                      <span key={s.id} className="sbadge ok"><i />{s.name}: {s.count}</span>
                    ))}
                  </div>
                  <details className="store-status">
                    <summary>Ver el estado de cada tienda</summary>
                    <ul>
                      {data.stores.map((s) => (
                        <li key={s.id} className={s.ok ? "ok" : "err"}>
                          <b>{s.name}</b>{" "}
                          <span>
                            {s.ok
                              ? `${s.count} resultado${s.count === 1 ? "" : "s"} · ${s.mode === "index" ? `catálogo ${ago(s.indexedAt)}` : "en vivo"}`
                              : s.error}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <AvisoTiendas />
                  </details>
                </div>
              );
            })()}
            {data && data.query !== data.q && <p className="translated">Se buscó como “{data.query}”, que es como publican las tiendas.</p>}
            {error && <div className="err-box" role="alert">{error}</div>}

            {flat.length > 0 && (
              <>
                <div className="group">
                  <div className="group-h"><h3>{game === "ygo" ? "Carta de Yu-Gi-Oh!" : "Carta de Digimon"}</h3></div>
                  <div className="grid">
                    {CARD_FILTERS[game].map((s) => {
                      const dis = !!s.dep && !f[s.dep as string];
                      const id = "f-" + (s.k as string);
                      return (
                        <div className="field" key={id}>
                          <label htmlFor={id}>{s.label}</label>
                          <select id={id} disabled={dis} value={f[s.k as string] ?? ""} onChange={(e) => setFilter(s, e.target.value)}>
                            <option value="">{dis ? "Elegí el tipo de carta" : "Todos"}</option>
                            {options(s).map((v) => <option key={v} value={v}>{label(s.k as string, v)}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="group">
                  <div className="group-h"><h3>Tienda y disponibilidad</h3></div>
                  <div className="grid">
                    <div className="field">
                      <label htmlFor="f-store">Tienda</label>
                      <select id="f-store" value={f.store ?? ""} onChange={(e) => setFilter("store", e.target.value)}>
                        <option value="">Todas</option>
                        {[...new Set(flat.map((l) => l.storeId))].map((id) => <option key={id} value={id}>{STORES.find((s) => s.id === id)?.name ?? id}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="f-stock">Disponibilidad</label>
                      <select id="f-stock" value={f.stock ?? ""} onChange={(e) => setFilter("stock", e.target.value)}>
                        <option value="">Todas</option><option value="si">Con stock</option><option value="no">Agotado</option>
                      </select>
                    </div>
                    <div className="field">
                      <span className="lbl">Precio (ARS)</span>
                      <div className="price2">
                        <input type="number" id="pmin" min={0} step={500} placeholder="Desde" aria-label="Precio desde" value={min} onChange={(e) => setMin(e.target.value)} />
                        <input type="number" id="pmax" min={0} step={500} placeholder="Hasta" aria-label="Precio hasta" value={max} onChange={(e) => setMax(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
                {active.length > 0 && (
                  <div className="chips">
                    <span className="lbl">Activos</span>
                    {active.map(([k, l]) => <button key={k} className="chip" onClick={() => removeActive(k)} aria-label={`Quitar ${l}`}>{l} <span>×</span></button>)}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {data && (
          <section aria-labelledby="s3" className="group">
            <div className="res-h">
              <h2 id="s3">Resultados<small>{rows.length} versi{rows.length === 1 ? "ón" : "ones"} · {pubs} publicaciones</small></h2>
              <div className="sort">
                <label className="lbl" htmlFor="sort">Ordenar</label>
                <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="pasc">Menor precio</option>
                  <option value="pdesc">Mayor precio</option>
                  <option value="stores">Más tiendas</option>
                  <option value="name">Nombre A–Z</option>
                </select>
              </div>
            </div>
            <div className="list">
              {rows.length === 0 && (
                <div className="empty">
                  <h3>{flat.length ? "Ninguna publicación cumple esos filtros" : `Ninguna tienda tiene “${data.q}”`}</h3>
                  <p>{flat.length ? "Quitá algún filtro para ver más resultados." : "Revisá cómo está escrito o buscá por el código de la carta."}</p>
                </div>
              )}
              {rows.map((r) => {
                const first = r.ls[0];
                const [c1, c2, light] = thumbColors(first);
                const isOpen = open.has(r.key);
                const shown = isOpen ? r.ls : r.ls.slice(0, 5);
                const bestIdx = r.ls.findIndex((x) => x.available === true);
                const meta = first.g === "ygo"
                  ? [first.tipo && first.sub ? `${first.tipo} ${first.sub.toLowerCase()}${first.extra ? " · " + first.extra.toLowerCase() : ""}` : first.tipo, first.attr, first.lvl, first.race]
                  : [[...new Set(r.ls.flatMap((x) => x.color ?? []))].join(" / "), first.tipo, [[...new Set(r.ls.map((x) => x.lvl).filter(Boolean))].join(", "), first.forma].filter(Boolean).join(" · "), [...new Set(r.ls.map((x) => x.attr).filter(Boolean))].join(" / ")];
                return (
                  <article className="card" key={r.key}>
                    <div className={`thumb${light ? " light" : ""}`} style={{ ["--c1" as string]: c1, ["--c2" as string]: c2 }} aria-hidden="true">
                      {first.image && <img src={first.image} alt="" loading="lazy" />}
                      <span className="tn">{r.name}</span>
                      {r.code && <span className="tc">{r.code}</span>}
                    </div>
                    <div className="info">
                      <div className="ttl">
                        <div>
                          <h3>{r.name}</h3>
                          <div className="version">
                            {r.code && <span className="pc">{r.code}</span>}
                            {r.rarity && <span className="tag rar">{label("rar", r.rarity)}</span>}
                            {r.version && r.version !== "Normal" && <span className="tag ver">{r.version}</span>}
                            {!r.code && r.setName && <span className="alias">{r.setName}</span>}
                          </div>
                        </div>
                        <div className="from">
                          <small>{r.hasAvail ? "Desde" : "Último precio"}</small>
                          <b>{fmt.format(r.min)}</b>
                          <small>{r.ls.length} publicaciones en {r.stores} tienda{r.stores === 1 ? "" : "s"}</small>
                        </div>
                      </div>
                      <div className="meta">
                        {meta.filter(Boolean).map((m) => <span className="tag" key={m}>{m}</span>)}
                        <button type="button" className="btn btn-ghost add-wish" onClick={() => addToList(r)}>+ Agregar a mi lista</button>
                      </div>
                      <div className="offers">
                        {shown.map((l, i) => (
                          <div key={l.url} className={`offer${i === bestIdx ? " best" : ""}${l.available === false ? " out" : ""}`}>
                            <div className="o-store"><b>{l.storeName}</b><span>{l.hasLocal ? `Local en ${l.storeCity}` : "Solo online"}{l.mode === "index" ? " · precio del catálogo diario" : ""}</span></div>
                            <div className="o-print">
                              <span className="pc" title={l.title}>{l.title}</span>
                              <div className="o-tags">
                                {i === bestIdx && <span className="tag bestb">Mejor precio</span>}
                                {l.g === "ygo" && l.edition && <span className="tag">{l.edition}</span>}
                                {l.lang && l.lang !== "Inglés" && <span className="tag">{l.lang}</span>}
                              </div>
                            </div>
                            <div className={`o-stock ${l.available === true ? "ok" : l.available === false ? "no" : ""}`}>
                              {l.available === true ? (l.stock ? `${l.stock} disponible${l.stock > 1 ? "s" : ""}` : "Disponible") : l.available === false ? "Agotado" : "Consultar stock"}
                            </div>
                            <div className="o-price">
                              <b>{fmt.format(l.price)}</b>
                              {l.cashPrice && <small>{fmt.format(l.cashPrice)} {l.cashLabel}</small>}
                            </div>
                            <div className="o-actions">
                              <a className="o-go" href={l.url} target="_blank" rel="noopener">Ver en tienda</a>
                              {l.available !== false && (
                                <button type="button" className="o-add" title="Agregar a mi lista comprando en esta tienda" onClick={() => addToList(r, l.storeId)}>+ Lista</button>
                              )}
                            </div>
                          </div>
                        ))}
                        {r.ls.length > 5 && (
                          <button className="more" onClick={() => { const n = new Set(open); isOpen ? n.delete(r.key) : n.add(r.key); setOpen(n); }}>
                            {isOpen ? "Ver menos" : `Ver ${r.ls.length - 5} publicaciones más`}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {data.missing?.length > 0 && (
              <div className="group">
                <div className="group-h"><h3>Otras versiones que ninguna tienda tiene publicadas ({data.missing.length})</h3></div>
                <p className="translated">Existen según la base oficial de Digimon, pero ninguna de las tiendas consultadas las tiene a la venta ahora. Probá preguntar en las tiendas con local de abajo.</p>
                <div className="missing">
                  {data.missing.map((m) => (
                    <div className="miss" key={m.code}>
                      {m.image && <img src={m.image} alt={`${m.name} ${m.code}`} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                      <b>{m.name}</b>
                      <span className="pc">{m.code}</span>
                      <div className="o-tags">
                        {m.rarity && <span className="tag rar">{label("rar", m.rarity)}</span>}
                        {m.info.color && <span className="tag">{m.info.color.join(" / ")}</span>}
                        {m.info.lvl && <span className="tag">{m.info.lvl}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
        </>
        )}

        <PhysicalStores game={game} />

        <AvisoCompleto />
        {toast && <div className="toast" role="status">{toast} · <button type="button" className="linkbtn" onClick={() => setTab("lista")}>Ver mi lista</button></div>}

        <footer>
          <span>Propiedad de Cordobes Fausto</span>
          <a className="wa" href="https://wa.me/5492944242906" target="_blank" rel="noopener">Contacto por WhatsApp · 2944 24-2906</a>
        </footer>
      </div>
    </div>
  );
}

/** Tiendas con local del juego que no tienen web para buscar: se les consulta por Instagram */
function PhysicalStores({ game }: { game: Game }) {
  const [prov, setProv] = useState("");
  const searchable = new Set(STORES.flatMap((s) => [s.domain.replace(/^www\./, ""), (s.instagram ?? "").toLowerCase()]));
  const list = storesForGame(game).filter(
    (s) => !searchable.has(domainOf(s.web) ?? "-") && !searchable.has((s.instagram ?? "-").toLowerCase())
  );
  const provinces = [...new Set(list.map((s) => s.province))].sort((a, b) => a.localeCompare(b, "es"));
  const shown = list.filter((s) => !prov || s.province === prov).sort((a, b) => a.province.localeCompare(b.province, "es") || a.city.localeCompare(b.city, "es"));
  return (
    <section className="group" aria-labelledby="s4">
      <div className="res-h">
        <h2 id="s4">Tiendas con local para consultar<small>{list.length} sin tienda online</small></h2>
        <div className="sort">
          <label className="lbl" htmlFor="f-prov">Provincia</label>
          <select id="f-prov" value={prov} onChange={(e) => setProv(e.target.value)}>
            <option value="">Todas</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <p className="translated">Estas tiendas tienen {game === "ygo" ? "Yu-Gi-Oh!" : "Digimon"} pero no publican sus cartas en una web que se pueda buscar. Si no encontrás la carta arriba, preguntales por Instagram.</p>
      <div className="phys">
        {shown.map((s) => (
          <div className="phys-item" key={s.name}>
            <b>{s.name}</b>
            <span>{s.city}{s.city.startsWith(s.province) ? "" : `, ${s.province}`}</span>
            <span className="addr">{s.address}</span>
            {s.instagram
              ? <a href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noopener">@{s.instagram}</a>
              : s.web ? <a href={s.web} target="_blank" rel="noopener">{domainOf(s.web)}</a> : <span className="addr">Sin redes publicadas</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function ModeTabs({ tab, setTab, count }: { tab: Tab; setTab: (t: Tab) => void; count: number }) {
  return (
    <div className="tabs mode-tabs" role="tablist" aria-label="Qué querés hacer">
      <button role="tab" aria-selected={tab === "carta"} className={tab === "carta" ? "on" : ""} onClick={() => setTab("carta")}>Buscar una carta</button>
      <button role="tab" aria-selected={tab === "mazo"} className={tab === "mazo" ? "on" : ""} onClick={() => setTab("mazo")}>Armar un mazo</button>
      <button role="tab" aria-selected={tab === "lista"} className={tab === "lista" ? "on" : ""} onClick={() => setTab("lista")}>Mi lista{count ? ` (${count})` : ""}</button>
    </div>
  );
}
