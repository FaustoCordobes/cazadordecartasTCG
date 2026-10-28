"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STORES } from "@/lib/stores.ts";
import type { CardGroup, Game, SearchResponse, StoreStatus } from "@/lib/types.ts";
import { storesForGame } from "@/lib/directory.ts";
import { Autocomplete } from "./Autocomplete.tsx";
import { ScanCard } from "./ScanCard.tsx";
import { Deck } from "./Deck.tsx";
import { AvisoCompleto, AvisoCorto, AvisoTiendas } from "./Aviso.tsx";
import { Donar } from "./Donar.tsx";
import { QueEs } from "./QueEs.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { AccountButton } from "./AccountButton.tsx";
import { CurrencyToggle, useCurrency } from "./useCurrency.tsx";
import { PriceCompare } from "./PriceCompare.tsx";
import { PriceCalculator } from "../calculadora/CalculadoraClient.tsx";
import { InstallApp } from "./InstallApp.tsx";
import { ShareLinks } from "./ShareLinks.tsx";
import { ProvinceSelect, useProvince } from "./useProvince.tsx";
import { Onboarding } from "./Onboarding.tsx";
import { Populares } from "./Populares.tsx";
import { PriceHistory } from "./PriceHistory.tsx";
import { ReportDialog, type ReportContext } from "./ReportDialog.tsx";
import { StoreDirectory } from "./StoreDirectory.tsx";
import { Wishlist } from "./Wishlist.tsx";
import { useWishlist } from "./useWishlist.ts";
import { search as runSearch, trackClick, type Partial } from "./searchClient.ts";
import { cardUrl, readParams } from "@/lib/share.ts";
import { agoText, priceFreshness, type Freshness } from "@/lib/freshness.ts";
import { sameArea } from "@/lib/provinces.ts";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import { LINK_STORES, linkFor } from "@/lib/linkstores.ts";
import { BRAND, waLink } from "@/lib/brand.ts";
import { norm } from "@/lib/parse.ts";
import { median, refUsd } from "@/lib/refprice.ts";
import type { WishOffer } from "@/lib/wishlist.ts";
import type { Dolar } from "@/lib/dolar.ts";

type Tab = "carta" | "mazo" | "lista" | "precios";

const STORE_PROVINCE = new Map(STORES.map((s) => [s.id, s.province]));
const STORE_CASH = new Map(STORES.filter((s) => s.cashDiscount).map((s) => [s.id, s.cashDiscount!]));
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });
const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fmtUsd = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

type Flat = CardGroup["listings"][number] & {
  tipo?: string; sub?: string; extra?: string; attr?: string; race?: string; lvl?: string; color?: string[]; forma?: string;
  rar?: string; ver?: string; cond?: string; idioma?: string; g: Game; cardName: string; cardKey: string; exact: boolean;
  near: boolean; fresh: Freshness; img?: string;
};
type FilterSpec = { k: keyof Flat; label: string; dep?: keyof Flat; resets?: (keyof Flat)[]; multi?: boolean };

/** Filtros de cada juego. Los que no tienen opciones en los resultados no se muestran. */
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
    { k: "idioma", label: "Idioma" },
    { k: "cond", label: "Estado" },
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
    { k: "cond", label: "Estado" },
  ],
  mtg: [
    { k: "color", label: "Color", multi: true },
    { k: "tipo", label: "Tipo de carta" },
    { k: "lvl", label: "Coste de maná" },
    { k: "rar", label: "Rareza" },
    { k: "set", label: "Edición / set" },
    { k: "ver", label: "Acabado (foil)" },
    { k: "idioma", label: "Idioma" },
    { k: "cond", label: "Estado" },
  ],
  pkm: [
    { k: "tipo", label: "Tipo de carta", resets: ["sub"] },
    { k: "sub", label: "Fase / clase", dep: "tipo" },
    { k: "extra", label: "Mecánica (ex, V, VMAX...)" },
    { k: "color", label: "Tipo de energía", multi: true },
    { k: "rar", label: "Rareza" },
    { k: "set", label: "Expansión" },
    { k: "ver", label: "Acabado (holo)" },
    { k: "idioma", label: "Idioma" },
    { k: "cond", label: "Estado" },
  ],
  op: [
    { k: "color", label: "Color", multi: true },
    { k: "tipo", label: "Tipo de carta" },
    { k: "lvl", label: "Coste" },
    { k: "attr", label: "Atributo" },
    { k: "rar", label: "Rareza" },
    { k: "set", label: "Expansión" },
    { k: "ver", label: "Versión (Parallel, Manga)" },
    { k: "idioma", label: "Idioma" },
    { k: "cond", label: "Estado" },
  ],
};
const RAR_ORDER = Object.fromEntries(GAME_IDS.map((g) => [g, GAMES[g].rarityOrder])) as Record<Game, string[]>;

const SORTS: Record<string, string> = {
  rel: "Relevancia: primero la carta exacta, después las que tienen stock, y por precio",
  pasc: "Menor precio (con stock primero)",
  pdesc: "Mayor precio",
  stores: "Más tiendas",
  fresh: "Precio más reciente",
  near: "Cerca mío primero",
  name: "Nombre A–Z",
};

const DIGI_COLORS: Record<string, string> = {
  Rojo: "#d8413a", Azul: "#2f7fd0", Amarillo: "#eac53a", Verde: "#3aa65a", Negro: "#3f3f48", Morado: "#8448c0", Blanco: "#e9e9ef",
  Incoloro: "#a7a7b2", Fuego: "#e0582f", Agua: "#3a8fd8", Planta: "#4caf50", Rayo: "#f2c230", "Psíquico": "#a35bc4",
  Lucha: "#b5653a", Oscuridad: "#3d3b4f", Metal: "#8e98a3", "Dragón": "#b39338", Hada: "#e58fbf",
};
const LIGHT = new Set(["Blanco", "Amarillo", "Rayo", "Incoloro"]);
function thumbColors(l: Flat): [string, string, boolean] {
  if (l.g !== "ygo") {
    const c = l.color?.length ? l.color : [l.g === "mtg" ? "Incoloro" : "Blanco"];
    return [DIGI_COLORS[c[0]] ?? "#777", DIGI_COLORS[c[1] ?? c[0]] ?? "#444", c.length === 1 && LIGHT.has(c[0])];
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

/** Estado de stock en palabras: nunca se afirma stock sin que la tienda lo diga */
function stockText(l: Flat): { text: string; cls: string } {
  if (l.available === false) return { text: "Agotado", cls: "no" };
  if (l.available === null) return { text: "Stock sin confirmar", cls: "" };
  if (typeof l.stock === "number" && l.stock > 0) return l.stock <= 2 ? { text: `Últimas unidades (${l.stock})`, cls: "ok low" } : { text: `${l.stock} disponibles`, cls: "ok" };
  return { text: "Disponible (sin cantidad)", cls: "ok" };
}

// Filtros que se guardan en el link (?f_rar=SR&orden=pasc&min=1000...)
const URL_KEYS = ["orden", "min", "max", "cerca", "exacta"];

export function App({ initialGame, initialQuery, intro }: { initialGame?: Game; initialQuery?: string; intro?: React.ReactNode }) {
  const [game, setGame] = useState<Game>(initialGame ?? "digi");
  const [tab, setTab] = useState<Tab>("carta");
  const wish = useWishlist();
  const [toast, setToast] = useState<string | null>(null);
  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }
  const [q, setQ] = useState(initialQuery ?? "");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [partial, setPartial] = useState<Partial | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [sort, setSort] = useState("rel");
  const [exactOnly, setExactOnly] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [hist, setHist] = useState<string | null>(null);
  // Comparador de precios internacional: abierto en la primera carta exacta hasta que la persona toque algo
  const [cmp, setCmp] = useState<Set<string>>(new Set());
  const [cmpTouched, setCmpTouched] = useState(false);
  const [cur] = useCurrency();
  const [province, setProvince] = useProvince();
  const [onlyNear, setOnlyNear] = useState(false);
  const [deckInit, setDeckInit] = useState<{ text: string; auto: boolean } | null>(null);
  const [origin, setOrigin] = useState("");
  const [usd, setUsd] = useState<Dolar | null>(null);
  const [report, setReport] = useState<ReportContext | null>(null);
  const [dirOpen, setDirOpen] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const ready = useRef(false);

  // Links compartidos: /?juego=digimon&carta=kimeramon&f_rar=SR&orden=pasc o /?juego=digimon&listado=...
  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/dolar").then((r) => r.json()).then((d) => d && setUsd(d)).catch(() => {});
    const sp = new URLSearchParams(window.location.search);
    const p = readParams(window.location.search);
    const g = p.game ?? initialGame ?? "digi";
    if (p.game) setGame(g);
    const keep: Record<string, string> = {};
    sp.forEach((v, k) => { if (k.startsWith("f_")) keep[k.slice(2)] = v.slice(0, 80); });
    if (sp.get("orden") && SORTS[sp.get("orden")!]) setSort(sp.get("orden")!);
    if (sp.get("min")) setMin(sp.get("min")!.replace(/\D/g, ""));
    if (sp.get("max")) setMax(sp.get("max")!.replace(/\D/g, ""));
    if (sp.get("cerca") === "1") setOnlyNear(true);
    if (sp.get("exacta") === "1") setExactOnly(true);
    if (sp.get("vista") === "lista") setTab("lista");
    if (sp.get("vista") === "precios") setTab("precios");
    if (window.location.hash === "#directorio") setDirOpen(true);
    if (p.deck) { setTab("mazo"); setDeckInit({ text: p.deck, auto: true }); }
    else if (p.card || initialQuery) search(p.card ?? initialQuery!, g, keep);
    ready.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El link de la barra de direcciones siempre refleja la búsqueda y los filtros, para compartirlo
  useEffect(() => {
    if (!ready.current || !data || tab !== "carta") return;
    const u = new URL(cardUrl(window.location.origin, game, data.q));
    for (const [k, v] of Object.entries(f)) if (v) u.searchParams.set("f_" + k, v);
    if (sort !== "rel") u.searchParams.set("orden", sort);
    if (min) u.searchParams.set("min", min);
    if (max) u.searchParams.set("max", max);
    if (onlyNear) u.searchParams.set("cerca", "1");
    if (exactOnly) u.searchParams.set("exacta", "1");
    window.history.replaceState(null, "", u.pathname + u.search);
  }, [data, f, sort, min, max, onlyNear, exactOnly, game, tab]);

  const gameStores = STORES.filter((s) => s.games.includes(game));

  function resetFilters() { setF({}); setMin(""); setMax(""); setExactOnly(false); setOnlyNear(false); }

  function switchGame(g: Game) {
    if (g === game) return;
    ctrl.current?.abort();
    setGame(g); setData(null); setPartial(null); setError(null); setQ(""); resetFilters(); setOpen(new Set()); setDeckInit(null); setLoading(false);
    window.history.replaceState(null, "", "/");
  }

  async function search(text = q, g: Game = game, keepFilters?: Record<string, string>) {
    const term = text.trim();
    if (term.length < 2) { setError("Escribí al menos 2 letras del nombre o el código de la carta."); return; }
    ctrl.current?.abort(); // cancela la búsqueda anterior si seguía en curso
    const c = new AbortController();
    ctrl.current = c;
    setQ(term); setLoading(true); setError(null); setData(null); setPartial(null); setOpen(new Set()); setHist(null); setCmp(new Set()); setCmpTouched(false);
    if (keepFilters) setF(keepFilters); else resetFilters();
    try {
      const res = await runSearch(g, term, { signal: c.signal, onProgress: (p) => !c.signal.aborted && setPartial((prev) => ({ ...p, cards: p.cards.length ? p.cards : prev?.cards ?? [] })) });
      if (c.signal.aborted) return;
      setData(res);
      if (!keepFilters) window.history.replaceState(null, "", cardUrl("", g, term));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setData(null);
    } finally {
      if (ctrl.current === c) { setLoading(false); setPartial(null); }
    }
  }

  const cards: CardGroup[] = data?.cards ?? partial?.cards ?? [];
  const statuses: StoreStatus[] = data?.stores ?? partial?.stores ?? [];

  // Cada publicación con los datos de la carta "aplanados" para filtrar
  const flat: Flat[] = useMemo(() => {
    const indexedAt = new Map(statuses.map((s) => [s.id, s.indexedAt ?? null]));
    return cards.flatMap((c) =>
      c.listings.map((l) => ({
        ...l,
        ...(l.info ?? {}),
        img: l.image ?? l.info?.image,
        rar: l.rarity ?? undefined,
        ver: (game === "ygo" ? l.edition ?? l.version : l.version) ?? undefined,
        cond: l.condition ?? undefined,
        idioma: l.lang ?? undefined,
        set: l.set,
        g: game,
        cardName: c.name,
        cardKey: c.key,
        exact: !!c.exact,
        near: l.hasLocal && sameArea(province, STORE_PROVINCE.get(l.storeId)),
        fresh: priceFreshness(l.mode, indexedAt.get(l.storeId)),
      }) as Flat)
    );
  }, [cards, statuses, game, province]);

  function options(spec: FilterSpec): string[] {
    let ls = flat;
    if (spec.dep && f[spec.dep as string]) ls = ls.filter((l) => l[spec.dep!] === f[spec.dep as string]);
    const vals = [...new Set(ls.flatMap((l) => ([] as unknown[]).concat(l[spec.k] ?? [])).filter(Boolean) as string[])];
    if (spec.k === "rar") return vals.sort((a, b) => (RAR_ORDER[game].indexOf(a) + 1 || 99) - (RAR_ORDER[game].indexOf(b) + 1 || 99));
    return vals.sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }
  const label = (k: string, v: string) => (k === "rar" ? GAMES[game].rarityLabel?.[v] ?? v : v);

  function pass(l: Flat) {
    for (const s of CARD_FILTERS[game]) {
      const v = f[s.k as string];
      if (!v) continue;
      if (s.multi ? !((l[s.k] as string[] | undefined) ?? []).includes(v) : l[s.k] !== v) return false;
    }
    if (f.store && l.storeId !== f.store) return false;
    if (onlyNear && province && !l.near) return false;
    if (exactOnly && !l.exact) return false;
    if (f.stock === "si" && l.available !== true) return false;
    if (f.stock === "no" && l.available !== false) return false;
    if (min !== "" && l.price < +min) return false;
    if (max !== "" && l.price > +max) return false;
    return true;
  }

  // Una tarjeta por versión de la carta (código + rareza + variante + idioma)
  const rows = useMemo(() => {
    const groups = new Map<string, Flat[]>();
    for (const l of flat) {
      if (!pass(l)) continue;
      if (!groups.has(l.cardKey)) groups.set(l.cardKey, []);
      groups.get(l.cardKey)!.push(l);
    }
    const meta = new Map(cards.map((c) => [c.key, c]));
    const r = [...groups.entries()].map(([key, ls]) => {
      if (sort === "near") ls = [...ls].sort((a, b) => Number(b.near) - Number(a.near));
      const avail = ls.filter((x) => x.available === true);
      const c = meta.get(key)!;
      const conds = new Set(ls.map((x) => x.cond ?? "sin dato"));
      const copies = avail.reduce((t, x) => t + (typeof x.stock === "number" ? x.stock : 0), 0);
      return {
        altName: c.altName, info: c.info, ref: refUsd(game, c), median: avail.length >= 3 ? median(avail.map((x) => x.price)) : null,
        copies, copiesKnown: avail.length > 0 && avail.every((x) => typeof x.stock === "number"),
        key, name: c.name, code: c.code, rarity: c.rarity, version: c.version, setName: c.setName, lang: c.lang ?? null, exact: !!c.exact, ls,
        min: Math.min(...(avail.length ? avail : ls).map((x) => x.price)), hasAvail: avail.length > 0, stores: new Set(ls.map((x) => x.storeId)).size,
        near: ls.some((x) => x.near && x.available !== false),
        onlyOne: avail.length === 1,
        condMix: conds.size > 1,
        newest: Math.max(...ls.map((x) => (x.mode === "live" ? Date.now() : 0))),
      };
    });
    r.sort((a, b) =>
      sort === "pasc" ? Number(b.hasAvail) - Number(a.hasAvail) || a.min - b.min
      : sort === "pdesc" ? b.min - a.min
      : sort === "stores" ? b.stores - a.stores || a.min - b.min
      : sort === "fresh" ? b.newest - a.newest || a.min - b.min
      : sort === "near" ? Number(b.near) - Number(a.near) || Number(b.hasAvail) - Number(a.hasAvail) || a.min - b.min
      : sort === "name" ? a.name.localeCompare(b.name) || (a.code ?? "").localeCompare(b.code ?? "", "en", { numeric: true })
      : Number(b.exact) - Number(a.exact) || Number(b.hasAvail) - Number(a.hasAvail) || a.min - b.min
    );
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, f, min, max, sort, game, onlyNear, province, exactOnly]);

  function setFilter(spec: FilterSpec | string, v: string) {
    const k = typeof spec === "string" ? spec : (spec.k as string);
    const next = { ...f, [k]: v };
    if (typeof spec !== "string") spec.resets?.forEach((r) => delete next[r as string]);
    setF(next);
  }

  const active: [string, string][] = [];
  CARD_FILTERS[game].forEach((s) => f[s.k as string] && active.push([s.k as string, `${s.label}: ${label(s.k as string, f[s.k as string])}`]));
  if (f.store) active.push(["store", "Tienda: " + (STORES.find((s) => s.id === f.store)?.name ?? f.store)]);
  if (onlyNear && province) active.push(["near", "Solo locales en " + province]);
  if (exactOnly) active.push(["exact", "Solo coincidencia exacta"]);
  if (f.stock) active.push(["stock", f.stock === "si" ? "Con stock" : "Agotado"]);
  if (min) active.push(["min", "Desde " + fmt.format(+min)]);
  if (max) active.push(["max", "Hasta " + fmt.format(+max)]);
  function removeActive(k: string) {
    if (k === "min") return setMin("");
    if (k === "max") return setMax("");
    if (k === "near") return setOnlyNear(false);
    if (k === "exact") return setExactOnly(false);
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
    notify(`${r.name}${r.code ? " " + r.code : ""} agregada a "${wish.list.name}" (${byStore.get(storeId)!.storeName})`);
  }

  function shareCard(r: (typeof rows)[number]) {
    const label = [r.name, r.code, r.version].filter(Boolean).join(" ");
    const text = `🃏 ${label}: desde ${fmt.format(r.min)} en ${r.stores} tienda${r.stores === 1 ? "" : "s"} de Argentina (precios al ${new Date().toLocaleDateString("es-AR")}).\nMirá dónde: ${cardUrl(origin, game, r.code && (game === "digi" || game === "op") ? r.code : data?.q ?? r.name)}`;
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
  }

  const pubs = rows.reduce((a, r) => a + r.ls.length, 0);
  const extraStores = LINK_STORES.filter((s) => s.games.includes(game));
  const shownQuery = data?.query ?? q;
  const usdOf = (ars: number) => (usd ? fmtUsd.format(ars / usd.venta) : null);
  /** Precio en la moneda elegida (pesos o dólares) y el otro, chico al lado */
  const money = (ars: number) => (cur === "USD" && usd ? fmtUsd.format(ars / usd.venta) : fmt.format(ars));
  const moneyAlt = (ars: number) => (cur === "USD" && usd ? fmt.format(ars) : usdOf(ars));

  function goList() { setTab("lista"); document.getElementById("s2")?.scrollIntoView({ behavior: "smooth", block: "start" }); }

  return (
    <div className="app" data-game={game}>
      <a className="skip" href="#q">Saltar al buscador</a>
      <div className="wrap">
        <header className="top">
          <div className="brand">
            <div className="logo" aria-hidden="true" />
            <div>
              <h1>{BRAND.name}</h1>
              <p>Buscá una carta y compará precios en tiendas TCG de Argentina</p>
            </div>
          </div>
          <nav className="top-actions" aria-label="Accesos">
            <button type="button" className="theme-btn" onClick={goList}><span aria-hidden="true">⭐</span><span>Mi lista{wish.count ? ` (${wish.count})` : ""}</span></button>
            <a className="theme-btn" href={`/ofertas?juego=${GAMES[game].param}`}><span aria-hidden="true">🔥</span><span>Ofertas</span></a>
            <a className="theme-btn" href="/tiendas"><span aria-hidden="true">🏪</span><span>Tiendas</span></a>
            <button type="button" className="theme-btn" onClick={() => { setTab("precios"); document.getElementById("s2")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><span aria-hidden="true">🧮</span><span>Calculadora</span></button>
            <a className="theme-btn" href="/vender"><span aria-hidden="true">💱</span><span>Vender</span></a>
            <a className="theme-btn" href="/guia"><span aria-hidden="true">📘</span><span>Guía</span></a>
            <AccountButton />
            <InstallApp />
            <CurrencyToggle />
            <ThemeToggle />
          </nav>
        </header>
        {usd && (
          <p className="dolar-hoy" title={`Fuente: ${usd.fuente}, ${new Date(usd.fecha).toLocaleString("es-AR")}`}>
            💵 {usd.nombre[0].toUpperCase() + usd.nombre.slice(1)} hoy: <b>{fmt.format(usd.venta)}</b>
            <span> · se usa para pasar precios a dólares</span>
          </p>
        )}
        <AvisoCorto />
        {intro}
        <Onboarding />

        <section aria-labelledby="s1">
          <div className="step"><b>1</b><h2 id="s1">Elegí el juego</h2></div>
          <div className="games" role="group" aria-label="Juego">
            {GAME_IDS.map((g) => {
              const n = STORES.filter((s) => s.games.includes(g)).length;
              const links = LINK_STORES.filter((s) => s.games.includes(g)).length;
              return (
                <button key={g} className={`game g-${g}`} aria-pressed={game === g} onClick={() => switchGame(g)}>
                  <div className="emb"><span>{GAMES[g].emblem}</span></div>
                  <div>
                    <strong>{GAMES[g].short}</strong>
                    <small>{n} con búsqueda{links ? ` · ${links} con link` : ""}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="s2" className="group" id="s2wrap">
          <div className="step"><b>2</b><h2 id="s2">{tab === "lista" ? "Mi lista" : tab === "mazo" ? "Listado de cartas / Decklist" : tab === "precios" ? "Precios en dólares y pesos" : "Buscá la carta"}</h2></div>
          <ModeTabs tab={tab} setTab={setTab} count={wish.count} />

          {tab === "precios" ? (
            <PriceCalculator game={game} embedded />
          ) : tab === "lista" ? (
            <Wishlist
              onSearch={() => setTab("carta")}
              onSearchAll={(text, g) => { if (g !== game) switchGame(g); setDeckInit({ text, auto: true }); setTab("mazo"); }}
            />
          ) : tab === "mazo" ? (
            <Deck key={game + (deckInit?.text ?? "")} game={game} initialText={deckInit?.text} autoRun={deckInit?.auto}
              onAdded={(n) => notify(`Se agregaron ${n} cartas a "${wish.list.name}"`)}
              onReport={(ctx) => setReport(ctx)} />
          ) : (
            <div className="panel">
              <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); search(); }}>
                <div className="field">
                  <label htmlFor="q">Nombre o código de la carta{GAMES[game].bilingual && <small className="lbl-hint"> · en español o en inglés</small>}</label>
                  <Autocomplete id="q" game={game} value={q} onChange={setQ} onPick={(v) => search(v)} placeholder={GAMES[game].placeholder} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button>
              </form>
              <div className="quick">
                <span>Probá:</span>
                {GAMES[game].quick.map((t) => <button key={t} type="button" onClick={() => search(t)}>{t}</button>)}
              </div>
              <ScanCard game={game} onFound={(t) => search(t)} />
              <Populares game={game} onPick={(t) => search(t)} />

              {loading && (
                <div className="stores-bar" aria-live="polite">
                  <span className="sbadge wait"><i />{partial ? `Respondieron ${partial.done} de ${partial.total} tiendas…` : `Buscando en ${gameStores.length} tiendas…`}</span>
                  <span className="slow-note">La búsqueda puede demorar unos segundos de más: consultamos cada tienda en el momento.</span>
                  {partial && <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={partial.total} aria-valuenow={partial.done}><i style={{ width: `${(partial.done / Math.max(1, partial.total)) * 100}%` }} /></div>}
                </div>
              )}
              {!loading && data && (() => {
                const withHits = data.stores.filter((s) => s.ok && s.count > 0);
                const answered = data.stores.filter((s) => s.ok).length;
                const failed = data.stores.filter((s) => !s.ok);
                return (
                  <div className="group" aria-live="polite">
                    <div className="stores-bar">
                      <span className="sbadge ok"><i />Respondieron {answered} de {data.stores.length} tiendas</span>
                      {withHits.map((s) => <span key={s.id} className="sbadge ok"><i />{s.name}: {s.count}</span>)}
                      {failed.length > 0 && <span className="sbadge err"><i />{failed.length} temporalmente no disponible{failed.length === 1 ? "" : "s"}</span>}
                    </div>
                    <details className="store-status">
                      <summary>Ver el estado de cada tienda</summary>
                      <ul>
                        {data.stores.map((s) => (
                          <li key={s.id} className={s.ok ? "ok" : "err"}>
                            <b>{s.name}</b>{" "}
                            <span>
                              {s.ok
                                ? `${s.count} resultado${s.count === 1 ? "" : "s"} · ${s.mode === "index" ? `catálogo de ${agoText(s.indexedAt)}` : "consultada en vivo"}`
                                : `Integración temporalmente no disponible: ${s.error}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <AvisoTiendas />
                    </details>
                  </div>
                );
              })()}
              {data?.names ? (
                <p className="translated bilingual">
                  🌐 Se buscó con los dos nombres: <b>{data.names.en}</b> (inglés) y <b>{data.names.es}</b> (español), porque cada tienda publica con el de la impresión que tiene.
                </p>
              ) : data && data.query !== data.q ? <p className="translated">Se buscó como “{data.query}”, que es como publican las tiendas.</p> : null}
              {error && <div className="err-box" role="alert">{error} <button type="button" className="linkbtn" onClick={() => search()}>Reintentar</button></div>}

              {flat.length > 0 && (
                <details className="filters" open={active.length > 0 || undefined}>
                  <summary>Filtros{active.length ? ` (${active.length})` : ""}</summary>
                  <div className="group">
                    <div className="group-h"><h3>Carta de {GAMES[game].short}</h3></div>
                    <div className="grid">
                      {CARD_FILTERS[game].map((s) => {
                        const opts = options(s);
                        if (!opts.length && !f[s.k as string] && !s.dep) return null; // filtros sin datos no se muestran
                        const dis = !!s.dep && !f[s.dep as string];
                        if (s.dep && !dis && !opts.length) return null;
                        const id = "f-" + (s.k as string);
                        return (
                          <div className="field" key={id}>
                            <label htmlFor={id}>{s.label}</label>
                            <select id={id} disabled={dis} value={f[s.k as string] ?? ""} onChange={(e) => setFilter(s, e.target.value)}>
                              <option value="">{dis ? "Elegí el tipo de carta" : "Todos"}</option>
                              {opts.map((v) => <option key={v} value={v}>{label(s.k as string, v)}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                    <label className="check"><input type="checkbox" checked={exactOnly} onChange={(e) => setExactOnly(e.target.checked)} /> Solo coincidencia exacta con lo que buscaste</label>
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
                        <label htmlFor="f-prov-user">Tu provincia</label>
                        <ProvinceSelect id="f-prov-user" value={province} onChange={(p) => { setProvince(p); if (!p) { setOnlyNear(false); if (sort === "near") setSort("rel"); } }} />
                        <label className="check">
                          <input type="checkbox" checked={onlyNear && !!province} disabled={!province} onChange={(e) => setOnlyNear(e.target.checked)} />
                          Solo tiendas con local en mi provincia (para retirar)
                        </label>
                      </div>
                      <div className="field">
                        <label htmlFor="f-stock">Disponibilidad</label>
                        <select id="f-stock" value={f.stock ?? ""} onChange={(e) => setFilter("stock", e.target.value)}>
                          <option value="">Todas</option><option value="si">Con stock confirmado</option><option value="no">Agotado</option>
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
                </details>
              )}
              {active.length > 0 && (
                <div className="chips">
                  <span className="lbl">Activos</span>
                  {active.map(([k, l]) => <button key={k} className="chip" onClick={() => removeActive(k)} aria-label={`Quitar ${l}`}>{l} <span>×</span></button>)}
                  <button type="button" className="linkbtn" onClick={resetFilters}>Quitar todos</button>
                </div>
              )}
            </div>
          )}
        </section>

        {tab === "carta" && (data || (loading && partial)) && (
          <section aria-labelledby="s3" className="group">
            <div className="res-h">
              <h2 id="s3">Resultados<small>{rows.length} versi{rows.length === 1 ? "ón" : "ones"} · {pubs} publicaciones{loading ? " · llegando…" : ""}</small></h2>
              <div className="sort">
                <label className="lbl" htmlFor="sort">Ordenar</label>
                <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                  {Object.entries(SORTS).filter(([k]) => k !== "near" || province).map(([k, v]) => <option key={k} value={k}>{v.split(":")[0].split(" (")[0]}</option>)}
                </select>
              </div>
            </div>
            <p className="sort-note">Orden: {SORTS[sort]}. Ninguna tienda paga por aparecer ni por salir primera.</p>
            {data && (
              <div className="res-tools">
                <p className="fresh-note">
                  Precios consultados a las {hhmm(data.searchedAt)}. Algunas tiendas se leen una vez por día: cada precio dice de cuándo es.
                  {usd && <> Referencia en dólares: {usd.nombre} a {fmt.format(usd.venta)} ({new Date(usd.fecha).toLocaleDateString("es-AR")}, {usd.fuente}).</>}
                </p>
                {extraStores.length > 0 && (
                  <details className="also-in-d">
                    <summary>Buscala también en {extraStores.length} tienda{extraStores.length === 1 ? "" : "s"} con búsqueda manual</summary>
                    <div className="also-in">
                      {extraStores.map((s) => (
                        <a key={s.id} className="chip-link" href={linkFor(s, game, data.query)} target="_blank" rel="noopener" title={s.searchUrl ? "Abre la búsqueda en su web (no es una publicación puntual)" : s.note}>
                          {s.name} ↗
                        </a>
                      ))}
                    </div>
                  </details>
                )}
                {origin && <ShareLinks label="Compartir esta búsqueda" url={cardUrl(origin, game, data.q)} text={`Mirá dónde conseguir ${data.q} en tiendas de Argentina:`} />}
              </div>
            )}
            <div className="list">
              {loading && !rows.length && [0, 1].map((i) => <div key={i} className="card skel-card" aria-hidden="true"><div className="skel thumb-skel" /><div className="skel-lines"><div className="skel" /><div className="skel" /><div className="skel" /></div></div>)}
              {!loading && data && rows.length === 0 && (
                <div className="empty">
                  {flat.length ? (
                    <>
                      <h3>Ninguna publicación cumple esos filtros</h3>
                      <p>Hay {flat.length} publicaciones de “{data.q}”, pero los filtros las ocultan.</p>
                      <button type="button" className="btn btn-primary" onClick={resetFilters}>Quitar filtros</button>
                    </>
                  ) : (
                    <>
                      <h3>Ninguna tienda consultada tiene “{data.q}” ahora</h3>
                      {data.didYouMean?.length ? (
                        <div className="quick"><span>¿Quisiste decir?</span>{data.didYouMean.map((n) => <button key={n} type="button" onClick={() => search(n)}>{n}</button>)}</div>
                      ) : null}
                      <ul className="empty-tips">
                        <li>Revisá cómo está escrito, o buscá por el <b>código</b> de la carta ({GAMES[game].placeholder.split(", ").pop()}).</li>
                        {extraStores.length > 0 && <li>Buscala a mano en las tiendas del directorio: {extraStores.map((s, i) => <span key={s.id}>{i ? ", " : ""}<a href={linkFor(s, game, data.q)} target="_blank" rel="noopener">{s.name}</a></span>)}.</li>}
                        {storesForGame(game).length > 0 && <li>Más abajo están las tiendas con local que no venden online: preguntales por Instagram.</li>}
                        <li>Si creés que una tienda la tiene y no aparece, <button type="button" className="linkbtn" onClick={() => setReport({ types: ["otra_carta", "tienda_dato"], title: "Avisanos qué falta", game, carta: data.q })}>avisanos</button>.</li>
                      </ul>
                    </>
                  )}
                </div>
              )}
              {rows.map((r, rIdx) => {
                const first = r.ls[0];
                const [c1, c2, light] = thumbColors(first);
                const isOpen = open.has(r.key);
                const shown = isOpen ? r.ls : r.ls.slice(0, 6);
                const bestIdx = r.ls.reduce((bi, x, i) => (x.available === true && (bi < 0 || x.price < r.ls[bi].price) ? i : bi), -1);
                const img = r.ls.find((x) => x.img)?.img;
                const meta = first.g === "ygo"
                  ? [first.tipo && first.sub ? `${first.tipo} ${first.sub.toLowerCase()}${first.extra ? " · " + first.extra.toLowerCase() : ""}` : first.tipo, first.attr, first.lvl, first.race]
                  : [[...new Set(r.ls.flatMap((x) => x.color ?? []))].join(" / "), first.tipo, [[...new Set(r.ls.map((x) => x.lvl).filter(Boolean))].join(", "), first.forma, first.sub, first.extra].filter(Boolean).join(" · "), [...new Set(r.ls.map((x) => x.attr).filter(Boolean))].join(" / ")];
                const exactVs = data ? norm(data.q) : "";
                const cmpOpen = cmpTouched ? cmp.has(r.key) : rIdx === 0 && r.exact;
                return (
                  <article className="card" key={r.key} aria-label={`${r.name} ${r.code ?? ""}`}>
                    <div className={`thumb${light ? " light" : ""}`} style={{ ["--c1" as string]: c1, ["--c2" as string]: c2 }} aria-hidden="true">
                      {img && <img src={img} alt="" loading="lazy" decoding="async" width={59} height={86} referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
                      <span className="tn">{r.name}</span>
                      {r.code && <span className="tc">{r.code}</span>}
                    </div>
                    <div className="info">
                      <div className="ttl">
                        <div>
                          <h3>{r.name}</h3>
                          {r.altName && <span className="alt-name" lang="es">En español: {r.altName}</span>}
                          <div className="version">
                            {r.code && <span className="pc">{r.code}</span>}
                            {r.rarity && <span className="tag rar">{label("rar", r.rarity)}</span>}
                            {r.version && r.version !== "Normal" && <span className="tag ver">{r.version}</span>}
                            {r.lang && <span className="tag">{r.lang}</span>}
                            {!r.code && r.setName && <span className="alias">{r.setName}</span>}
                            {exactVs && (r.exact ? <span className="tag match">Coincidencia exacta</span> : <span className="tag partial" title="El nombre no es exactamente el que buscaste">Coincidencia parcial</span>)}
                          </div>
                        </div>
                        <div className="from">
                          <small>{r.hasAvail ? "Desde" : "Último precio visto"}</small>
                          <b>{money(r.min)}</b>
                          {moneyAlt(r.min) && <small className="usd" title={usd ? `Referencia: ${usd.nombre} del ${new Date(usd.fecha).toLocaleDateString("es-AR")}` : undefined}>≈ {moneyAlt(r.min)}</small>}
                          <small>{r.ls.length} publicaci{r.ls.length === 1 ? "ón" : "ones"} en {r.stores} tienda{r.stores === 1 ? "" : "s"}</small>
                        </div>
                      </div>
                      <div className="meta">
                        {meta.filter(Boolean).map((m) => <span className="tag" key={m}>{m}</span>)}
                        {r.onlyOne && <span className="tag only">Único en stock</span>}
                      </div>
                      {(r.median || r.ref || r.copiesKnown) && (
                        <dl className="pguide">
                          {r.median && <div><dt>Mediana publicada</dt><dd>{money(r.median)}</dd></div>}
                          {r.copiesKnown && <div><dt>Copias en stock</dt><dd>{r.copies}</dd></div>}
                          {r.ref && (
                            <div title="Precio de mercado en TCGplayer (Estados Unidos), sin envío ni impuestos de importación. Es solo una referencia para saber si un precio está muy alto o muy bajo.">
                              <dt>Referencia TCGplayer (EE. UU.)</dt>
                              <dd>{cur === "USD" || !usd ? fmtUsd.format(r.ref) : fmt.format(Math.round(r.ref * usd.venta))}{usd && <small> ≈ {cur === "USD" ? fmt.format(Math.round(r.ref * usd.venta)) : fmtUsd.format(r.ref)}</small>}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                      {(r.median || r.ref) && (
                        <details className="pg-help">
                          <summary>¿Qué significan estos precios?</summary>
                          <ul>
                            <li><b>Desde:</b> la publicación más barata con stock entre las tiendas consultadas.</li>
                            <li><b>Mediana publicada:</b> el precio del medio entre las tiendas con stock (la mitad cobra menos y la mitad más). Sirve para saber cuánto cuesta “normalmente” sin que una oferta o un precio inflado engañen.</li>
                            <li><b>Copias en stock:</b> la suma de las copias que informan las tiendas. Algunas no dicen cuántas tienen.</li>
                            <li><b>Referencia TCGplayer:</b> precio de mercado en Estados Unidos (de ventas reales allá), pasado a pesos con el dólar del día. No incluye envío ni impuestos de importación: en Argentina suele costar más. Si una tienda la tiene bastante más barata, es una buena oferta.</li>
                          </ul>
                        </details>
                      )}
                      {r.condMix && <p className="warn-inline">⚠️ Hay publicaciones en distinto estado (NM, LP…). Fijate el estado de cada una antes de comparar precios.</p>}
                      <div className="card-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addToList(r)}><span>⭐<span className="lg"> Agregar a mi</span> lista</span></button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => shareCard(r)}>Compartir</button>
                        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={cmpOpen} onClick={() => { setCmpTouched(true); const n = new Set(cmpTouched ? cmp : rows.filter((x, i) => i === 0 && x.exact).map((x) => x.key)); if (n.has(r.key)) n.delete(r.key); else n.add(r.key); setCmp(n); }}><span>🌎<span className="lg"> Comparar</span> precio</span></button>
                        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={hist === r.key} onClick={() => setHist(hist === r.key ? null : r.key)}>📈 Historial</button>
                      </div>
                      {hist === r.key && <PriceHistory game={game} cardKey={r.key} />}
                      {cmpOpen && (
                        <PriceCompare game={game} name={r.name} rarity={r.rarity} version={r.version} info={r.info}
                          local={r.hasAvail ? r.min : null} median={r.median} stores={r.stores} currency={cur}
                          rates={{ usdArs: usd?.venta ?? null, eurUsd: usd?.eurUsd ?? null }} />
                      )}
                      <div className="offers" role="table" aria-label={`Comparación de precios de ${r.name}`}>
                        <div className="offer offer-head" role="row" aria-hidden="true">
                          <span>Tienda</span><span>Publicación</span><span>Stock</span><span>Precio</span><span />
                        </div>
                        {shown.map((l, i) => {
                          const st = stockText(l);
                          const cash = STORE_CASH.get(l.storeId);
                          return (
                            <div key={l.url} role="row" className={`offer${i === bestIdx ? " best" : ""}${l.available === false ? " out" : ""}`}>
                              <div className="o-store" role="cell">
                                <b>{l.storeName}</b>
                                <span>{l.hasLocal ? `Local en ${l.storeCity ?? "Argentina"}` : "Solo online"}</span>
                                {l.near && <span className="near near-line">📍 En tu provincia</span>}
                                <small className={`fresh${l.fresh.stale ? " stale" : ""}`}>{l.mode === "live" ? "Precio verificado recién" : `Último precio detectado · ${l.fresh.text.replace("Precio de ", "")}`}{l.fresh.stale ? " · puede haber cambiado" : ""}</small>
                              </div>
                              <div className="o-print" role="cell">
                                <span className="pc" title={l.title}>{l.title}</span>
                                <div className="o-tags">
                                  {i === bestIdx && <span className="tag bestb">Mejor precio</span>}
                                  {l.g === "ygo" && l.edition && <span className="tag">{l.edition}</span>}
                                  {l.lang && <span className="tag">{l.lang}</span>}
                                  {l.condition && <span className="tag cond">{l.condition}</span>}
                                  {r.code && !l.code && (game === "digi" || game === "op") && <span className="tag partial" title="La tienda no publica el código: la juntamos por nombre y expansión. Confirmalo en la publicación.">código sin confirmar</span>}
                                  {cash && <span className="tag cash">{cash.percent}% OFF {cash.label}</span>}
                                </div>
                              </div>
                              <div className={`o-stock ${st.cls}`} role="cell">{st.text}</div>
                              <div className="o-price" role="cell">
                                <b>{money(l.price)}</b>
                                {l.cashPrice && <small>{money(l.cashPrice)} {l.cashLabel}</small>}
                                {moneyAlt(l.price) && <small className="usd">≈ {moneyAlt(l.price)}</small>}
                              </div>
                              <div className="o-actions" role="cell">
                                <a className="o-go" href={l.url} target="_blank" rel="noopener" onClick={() => trackClick(game, l.storeId)}>Ver publicación</a>
                                {l.available !== false && (
                                  <button type="button" className="o-add" title="Agregar a mi lista comprando en esta tienda" onClick={() => addToList(r, l.storeId)}>+ Lista</button>
                                )}
                                <button type="button" className="o-rep" onClick={() => setReport({ types: ["precio", "stock", "link", "variante", "otra_carta"], game, carta: `${r.name}${r.code ? " " + r.code : ""}`, store_id: l.storeId, url: l.url })}>Reportar</button>
                              </div>
                            </div>
                          );
                        })}
                        {r.ls.length > 6 && (
                          <button className="more" onClick={() => { const n = new Set(open); if (isOpen) n.delete(r.key); else n.add(r.key); setOpen(n); }}>
                            {isOpen ? "Ver menos" : `Ver ${r.ls.length - 6} publicaciones más`}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {data && data.missing?.length > 0 && (
              <div className="group">
                <div className="group-h"><h3>Otras versiones que ninguna tienda tiene publicadas ({data.missing.length})</h3></div>
                <p className="translated">Existen según la base oficial de {GAMES[game].short}, pero ninguna de las tiendas consultadas las tiene a la venta ahora. Probá en las tiendas del directorio.</p>
                <div className="missing">
                  {data.missing.map((m) => (
                    <div className="miss" key={m.code}>
                      {m.image && <img src={m.image} alt={`${m.name} ${m.code}`} loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />}
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
            {data && !loading && extraStores.length > 0 && (
              <div className="manual-box">
                <h3>¿No está o querés comparar más? Buscala en estas tiendas</h3>
                <p className="translated">
                  Estas tiendas también venden {GAMES[game].short}, pero la app no puede consultarlas sola (por ejemplo, su protección anti-bots
                  lo bloquea). El botón abre su web con la búsqueda; sus precios no aparecen arriba.
                </p>
                <div className="also-in">
                  {extraStores.map((s) => (
                    <a key={s.id} className="chip-link" href={linkFor(s, game, data.query)} target="_blank" rel="noopener" onClick={() => trackClick(game, s.id)} title={s.note}>
                      {s.searchUrl ? `Buscar en ${s.name}` : s.name} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <details className="dir-wrap" id="directorio" open={dirOpen || undefined} onToggle={(e) => setDirOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>🏪 Directorio de tiendas de {GAMES[game].short}</summary>
          {dirOpen && <StoreDirectory game={game} q={shownQuery} onReport={setReport} />}
        </details>
        {storesForGame(game).length > 0 && <PhysicalStores game={game} />}

        <QueEs />
        <Donar />
        <AvisoCompleto />
        {toast && <div className="toast" role="status">{toast} · <button type="button" className="linkbtn" onClick={goList}>Ver mi lista</button></div>}
        <ReportDialog ctx={report} onClose={() => setReport(null)} />

        <footer>
          <span>Propiedad de {BRAND.owner}</span>
          <Donar compact />
          <button type="button" className="linkbtn" onClick={() => setReport({ types: ["contacto", "tienda_nueva", "tienda_dato", "tienda_baja"], title: "Contacto" })}>Contacto</button>
          <a href="/estado">Estado de las tiendas</a>
          <a className="wa" href={waLink()} target="_blank" rel="noopener">WhatsApp · {BRAND.whatsappLabel}</a>
        </footer>
      </div>
    </div>
  );
}

/** Tiendas con local del juego que no tienen web para buscar: se les consulta por Instagram */
function PhysicalStores({ game }: { game: Game }) {
  const [prov, setProv] = useState("");
  const searchable = new Set(STORES.flatMap((s) => [s.domain.replace(/^www\./, ""), (s.instagram ?? "").toLowerCase()]));
  const domainOf = (u: string | null) => { if (!u) return null; try { return new URL(u).host.replace(/^www\./, ""); } catch { return null; } };
  const list = storesForGame(game).filter(
    (s) => !searchable.has(domainOf(s.web) ?? "-") && !searchable.has((s.instagram ?? "-").toLowerCase())
  );
  const provinces = [...new Set(list.map((s) => s.province))].sort((a, b) => a.localeCompare(b, "es"));
  const shown = list.filter((s) => !prov || s.province === prov).sort((a, b) => a.province.localeCompare(b.province, "es") || a.city.localeCompare(b.city, "es"));
  return (
    <details className="dir-wrap">
      <summary>🏠 Tiendas con local para consultar ({list.length} sin tienda online)</summary>
      <section className="group" aria-labelledby="s4">
        <div className="res-h">
          <h2 id="s4" className="sr-only">Tiendas con local para consultar</h2>
          <div className="sort">
            <label className="lbl" htmlFor="f-prov">Provincia</label>
            <select id="f-prov" value={prov} onChange={(e) => setProv(e.target.value)}>
              <option value="">Todas</option>
              {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <p className="translated">Estas tiendas tienen {GAMES[game].short} pero no publican sus cartas en una web que se pueda buscar. Si no encontrás la carta arriba, preguntales por Instagram.</p>
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
    </details>
  );
}

function ModeTabs({ tab, setTab, count }: { tab: Tab; setTab: (t: Tab) => void; count: number }) {
  return (
    <div className="tabs mode-tabs" role="tablist" aria-label="Qué querés hacer">
      <button role="tab" aria-selected={tab === "carta"} className={tab === "carta" ? "on" : ""} onClick={() => setTab("carta")}>🔎 Buscar<span className="lg">&nbsp;una carta</span></button>
      <button role="tab" aria-selected={tab === "mazo"} className={tab === "mazo" ? "on" : ""} onClick={() => setTab("mazo")}><span>📋<span className="lg"> Listado de cartas /</span> Decklist</span></button>
      <button role="tab" aria-selected={tab === "lista"} className={tab === "lista" ? "on" : ""} onClick={() => setTab("lista")}>⭐ Mi lista{count ? ` (${count})` : ""}</button>
      <button role="tab" aria-selected={tab === "precios"} className={tab === "precios" ? "on" : ""} onClick={() => setTab("precios")}>💲 Precios<span className="lg">&nbsp;USD/ARS</span></button>
    </div>
  );
}
