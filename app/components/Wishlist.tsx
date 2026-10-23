"use client";

import { useRef, useState } from "react";
import type { Game } from "@/lib/types.ts";
import { GAMES } from "@/lib/games.ts";
import { agoText, hoursSince } from "@/lib/freshness.ts";
import {
  applyCheck, buildShareText, exportState, listToDeckText, matchGroup, missingCopies, selectedOffer, SHARE_WARNING, whatsappLink, type WishItem,
} from "@/lib/wishlist.ts";
import { useWishlist } from "./useWishlist.ts";
import { search, searchMany } from "./searchClient.ts";

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function Wishlist({ onSearch, onSearchAll }: { onSearch: () => void; onSearchAll?: (deckText: string, game: Game) => void }) {
  const w = useWishlist();
  const { items, list, state } = w;
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<"clear" | "delete" | null>(null);
  const [checking, setChecking] = useState<{ done: number; total: number } | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const pending = items.filter((it) => it.qty - (it.obtained ?? 0) > 0);
  const total = pending.reduce((s, it) => s + (selectedOffer(it)?.price ?? 0) * (it.qty - (it.obtained ?? 0)), 0);
  const stores = new Set(pending.map((it) => selectedOffer(it)?.storeName).filter(Boolean)).size;
  const games = [...new Set(pending.map((it) => it.game))];
  const withAlerts = items.filter((it) => it.alert?.maxPrice || it.alert?.backInStock);
  const lastCheck = items.map((it) => it.lastCheck?.at).filter(Boolean).sort().pop() ?? null;
  const shouldCheck = withAlerts.length > 0 && (!lastCheck || (hoursSince(lastCheck) ?? 99) > 6);

  /** Vuelve a buscar cada carta de la lista (de a 3 por vez) y revisa las alertas */
  async function refresh() {
    setAlerts([]); setMsg(null);
    const todo = items.filter((it) => it.qty - (it.obtained ?? 0) > 0);
    setChecking({ done: 0, total: todo.length });
    const updated = new Map<string, WishItem>();
    const found: string[] = [];
    let done = 0, fails = 0;
    await searchMany(todo, async (it) => {
      try {
        const q = it.code && (it.game === "digi" || it.game === "op") ? it.code : it.name;
        const res = await search(it.game, q, { stream: false });
        const r = applyCheck(it, matchGroup(it, res.cards));
        updated.set(it.id, r.item);
        found.push(...r.messages);
      } catch {
        fails++;
      }
      setChecking({ done: ++done, total: todo.length });
    });
    w.replaceItems(items.map((it) => updated.get(it.id) ?? it));
    setAlerts(found);
    setChecking(null);
    setMsg(`Listo: revisamos ${todo.length - fails} carta${todo.length - fails === 1 ? "" : "s"}${fails ? ` (${fails} no se pudieron buscar)` : ""}.${found.length ? "" : withAlerts.length ? " Ninguna alerta se cumplió." : ""}`);
  }

  async function copy() {
    const text = buildShareText(pending.length ? pending : items);
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt("Copiá el texto de tu lista:", text); }
  }

  function download() {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cazacartas-listas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) { setMsg("El archivo es demasiado grande."); return; }
    const err = w.importLists(await f.text());
    setMsg(err ?? "Listas importadas. Ya están en el selector de arriba.");
  }

  const listBar = (
    <div className="list-bar">
      <div className="field grow">
        <label className="lbl" htmlFor="wl-sel">Lista</label>
        <select id="wl-sel" value={list.id} onChange={(e) => w.selectList(e.target.value)}>
          {state.lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.items.length})</option>)}
        </select>
      </div>
      {renaming ? (
        <form className="search" onSubmit={(e) => { e.preventDefault(); w.renameList(list.id, newName); setRenaming(false); }}>
          <input aria-label="Nuevo nombre" value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <button className="btn btn-ghost btn-sm" type="submit">Guardar</button>
        </form>
      ) : (
        <>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => { const n = window.prompt("Nombre de la nueva lista:", "Mazo nuevo"); if (n !== null) w.createList(n); }}>+ Nueva lista</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setNewName(list.name); setRenaming(true); }}>Renombrar</button>
          {state.lists.length > 1 && (confirm === "delete"
            ? <><button className="btn btn-ghost btn-sm danger" type="button" onClick={() => { w.deleteList(list.id); setConfirm(null); }}>Sí, borrar “{list.name}”</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirm(null)}>Cancelar</button></>
            : <button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirm("delete")}>Borrar lista</button>)}
        </>
      )}
    </div>
  );

  const io = (
    <div className="search">
      <button className="btn btn-ghost btn-sm" type="button" onClick={download}>Exportar mis listas (.json)</button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => fileRef.current?.click()}>Importar</button>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }} />
      <span className="hint">Se guarda solo en este navegador. Para pasarla a otro dispositivo, exportala e importala.</span>
    </div>
  );

  if (!items.length) {
    return (
      <div className="group">
        {listBar}
        <div className="panel empty">
          <h3>“{list.name}” está vacía</h3>
          <p>Buscá una carta y tocá <b>Agregar a mi lista</b>, o pegá tu decklist en <b>Listado de cartas</b> y pasá el plan entero a tu lista. No hace falta crear una cuenta.</p>
          <button className="btn btn-primary" onClick={onSearch}>Buscar una carta</button>
        </div>
        {msg && <p className="translated" role="status">{msg}</p>}
        {io}
      </div>
    );
  }

  return (
    <div className="group">
      {listBar}
      {w.saveError && <div className="err-box" role="alert">No se pudo guardar en este navegador (¿modo incógnito o memoria llena?). Exportá la lista para no perderla.</div>}

      <div className="stats">
        <div className="stat"><b>{items.length}</b><span>cartas · {items.reduce((n, i) => n + i.qty, 0)} copias</span></div>
        <div className="stat"><b>{missingCopies(items)}</b><span>copias que faltan conseguir</span></div>
        <div className="stat"><b>{stores}</b><span>tienda{stores === 1 ? "" : "s"} elegida{stores === 1 ? "" : "s"}</span></div>
        <div className="stat"><b>{fmt.format(total)}</b><span>total estimado de lo que falta</span></div>
      </div>

      <div className="panel">
        <div className="search">
          <button className="btn btn-primary" type="button" onClick={refresh} disabled={!!checking || !pending.length}>
            {checking ? `Revisando ${checking.done} de ${checking.total}…` : "🔄 Actualizar precios y alertas"}
          </button>
          {onSearchAll && games.map((g) => (
            <button key={g} className="btn btn-ghost" type="button" onClick={() => onSearchAll(listToDeckText(pending.filter((it) => it.game === g)), g)}>
              Optimizar la compra{games.length > 1 ? ` de ${GAMES[g].short}` : ""}
            </button>
          ))}
        </div>
        {checking && <span className="slow-note">Puede demorar unos segundos de más: buscamos cada carta en todas las tiendas.</span>}
        <p className="hint">{lastCheck ? `Última revisión: ${agoText(lastCheck)}.` : "Todavía no revisaste precios."} Las alertas se revisan cuando abrís la app y tocás este botón: no te llegan avisos con la app cerrada.</p>
        {shouldCheck && !checking && <p className="warn-inline">🔔 Tenés {withAlerts.length} alerta{withAlerts.length === 1 ? "" : "s"} configurada{withAlerts.length === 1 ? "" : "s"} sin revisar hace un rato. Tocá “Actualizar precios”.</p>}
        {alerts.length > 0 && (
          <div className="ok-box" role="status">
            <b>🔔 Se cumplieron {alerts.length} alerta{alerts.length === 1 ? "" : "s"}:</b>
            <ul>{alerts.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}
        {msg && <p className="translated" role="status">{msg}</p>}
      </div>

      <div className="list">
        {items.map((it) => {
          const o = selectedOffer(it);
          const left = it.qty - (it.obtained ?? 0);
          const done = left <= 0;
          const now = it.lastCheck?.best ?? null;
          const diff = it.savedPrice && now ? now - it.savedPrice : null;
          return (
            <article className={`card wish${done ? " done" : ""}`} key={it.id}>
              <div className="info">
                <div className="ttl">
                  <div>
                    <h3>{done && "✅ "}{it.name}</h3>
                    <div className="version">
                      <span className="tag">{GAMES[it.game].short}</span>
                      {it.code && <span className="pc">{it.code}</span>}
                      {it.rarity && <span className="tag rar">{it.rarity}</span>}
                      {it.version && it.version !== "Normal" && <span className="tag ver">{it.version}</span>}
                    </div>
                  </div>
                  <div className="from">
                    <small>{done ? "Completa" : `Faltan ${left}`}</small>
                    <b>{o && !done ? fmt.format(o.price * left) : "—"}</b>
                    <small>{o ? `${fmt.format(o.price)} c/u` : ""}</small>
                    {diff !== null && diff !== 0 && <small className={diff < 0 ? "down" : "up"}>{diff < 0 ? "▼" : "▲"} {fmt.format(Math.abs(diff))} desde que la guardaste</small>}
                  </div>
                </div>
                {it.lastCheck && (
                  <p className="hint">
                    Revisado {agoText(it.lastCheck.at)}: {it.lastCheck.available ? `mejor precio ${fmt.format(it.lastCheck.best!)} en ${it.lastCheck.storeName}` : "ninguna tienda la tiene ahora"}.
                  </p>
                )}
                <div className="wish-row">
                  <div className="field">
                    <span className="lbl">Copias</span>
                    <div className="stepper">
                      <button type="button" aria-label="Una copia menos" onClick={() => w.setQty(it.id, it.qty - 1)} disabled={it.qty <= 1}>−</button>
                      <span aria-live="polite">{it.qty}</span>
                      <button type="button" aria-label="Una copia más" onClick={() => w.setQty(it.id, it.qty + 1)}>+</button>
                    </div>
                  </div>
                  <div className="field">
                    <span className="lbl">Conseguidas</span>
                    <div className="stepper">
                      <button type="button" aria-label="Una conseguida menos" onClick={() => w.setObtained(it.id, (it.obtained ?? 0) - 1)} disabled={!it.obtained}>−</button>
                      <span aria-live="polite">{it.obtained ?? 0}</span>
                      <button type="button" aria-label="Una conseguida más" onClick={() => w.setObtained(it.id, (it.obtained ?? 0) + 1)} disabled={done}>+</button>
                    </div>
                  </div>
                  <div className="field grow">
                    <label className="lbl" htmlFor={`st-${it.id}`}>Comprar en</label>
                    <select id={`st-${it.id}`} value={it.storeId} onChange={(e) => w.setStore(it.id, e.target.value)}>
                      {it.offers.map((x) => (
                        <option key={x.storeId} value={x.storeId}>
                          {x.storeName} · {fmt.format(x.price)}{x.stock ? ` · ${x.stock} disp.` : ""}{x.stock !== null && x.stock < left ? " (no alcanza)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {o && <a className="o-go" href={o.url} target="_blank" rel="noopener">Ver publicación</a>}
                  <button className="btn btn-ghost" type="button" onClick={() => w.remove(it.id)}>Quitar</button>
                </div>
                <details className="alert-box">
                  <summary>🔔 Alerta {it.alert?.maxPrice || it.alert?.backInStock ? "(activa)" : ""}</summary>
                  <div className="wish-row">
                    <div className="field">
                      <label className="lbl" htmlFor={`al-${it.id}`}>Avisame si baja de</label>
                      <input id={`al-${it.id}`} inputMode="numeric" placeholder="$" value={it.alert?.maxPrice ?? ""}
                        onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); w.setAlert(it.id, { ...it.alert, maxPrice: n || null }); }} />
                    </div>
                    <label className="check">
                      <input type="checkbox" checked={!!it.alert?.backInStock} onChange={(e) => w.setAlert(it.id, { ...it.alert, backInStock: e.target.checked })} />
                      Avisame si vuelve el stock
                    </label>
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>

      <div className="panel share">
        <div className="group-h"><h3>Compartirte la lista</h3></div>
        <p className="translated">Mandátela por WhatsApp (podés elegir tu propio chat, "Mensaje para mí") con cada carta que falta, la cantidad, la tienda que elegiste y el link para comprar.</p>
        <pre className="share-preview">{buildShareText(pending.length ? pending : items)}</pre>
        <div className="search">
          <a className="btn btn-primary wa-btn" href={whatsappLink(buildShareText(pending.length ? pending : items))} target="_blank" rel="noopener">Compartir por WhatsApp</a>
          <button className="btn btn-ghost" type="button" onClick={copy}>{copied ? "Copiada" : "Copiar lista"}</button>
        </div>
        <p className="aviso-corto">{SHARE_WARNING}</p>
        {io}
        <div className="search">
          {confirm !== "clear" ? (
            <button className="btn btn-ghost" type="button" onClick={() => setConfirm("clear")}>Vaciar esta lista</button>
          ) : (
            <>
              <span className="translated">¿Seguro? Se borran todas las cartas de “{list.name}”.</span>
              <button className="btn btn-ghost danger" type="button" onClick={() => { w.clear(); setConfirm(null); }}>Sí, vaciar</button>
              <button className="btn btn-ghost" type="button" onClick={() => setConfirm(null)}>Cancelar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
