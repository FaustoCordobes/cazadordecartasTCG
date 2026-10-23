"use client";

import { useState } from "react";
import { buildShareText, selectedOffer, SHARE_WARNING, whatsappLink } from "@/lib/wishlist.ts";
import { useWishlist } from "./useWishlist.ts";

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function Wishlist({ onSearch }: { onSearch: () => void }) {
  const { items, setQty, setStore, remove, clear } = useWishlist();
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const total = items.reduce((s, it) => s + (selectedOffer(it)?.price ?? 0) * it.qty, 0);
  const copies = items.reduce((s, it) => s + it.qty, 0);
  const stores = new Set(items.map((it) => selectedOffer(it)?.storeName).filter(Boolean)).size;

  async function copy() {
    const text = buildShareText(items);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin acceso al portapapeles: se muestra el texto para copiarlo a mano
      window.prompt("Copiá el texto de tu lista:", text);
    }
  }

  async function nativeShare() {
    const text = buildShareText(items);
    try { await navigator.share({ title: "Mi lista de cartas", text }); } catch { /* el usuario canceló */ }
  }

  if (!items.length) {
    return (
      <div className="panel empty">
        <h3>Tu lista está vacía</h3>
        <p>Buscá una carta y tocá <b>Agregar a mi lista</b>, o pegá tu decklist en <b>Listado de cartas</b> y pasala entera a tu lista. Se guarda en este navegador, no hace falta crear una cuenta.</p>
        <button className="btn btn-primary" onClick={onSearch}>Buscar una carta</button>
      </div>
    );
  }

  return (
    <div className="group">
      <div className="stats">
        <div className="stat"><b>{items.length}</b><span>cartas · {copies} copias</span></div>
        <div className="stat"><b>{stores}</b><span>tienda{stores === 1 ? "" : "s"} elegida{stores === 1 ? "" : "s"}</span></div>
        <div className="stat"><b>{fmt.format(total)}</b><span>total estimado</span></div>
      </div>

      <div className="list">
        {items.map((it) => {
          const o = selectedOffer(it);
          return (
            <article className="card wish" key={it.id}>
              <div className="info">
                <div className="ttl">
                  <div>
                    <h3>{it.name}</h3>
                    <div className="version">
                      <span className="tag">{it.game === "ygo" ? "Yu-Gi-Oh!" : "Digimon"}</span>
                      {it.code && <span className="pc">{it.code}</span>}
                      {it.rarity && <span className="tag rar">{it.rarity}</span>}
                      {it.version && it.version !== "Normal" && <span className="tag ver">{it.version}</span>}
                    </div>
                  </div>
                  <div className="from">
                    <small>Subtotal</small>
                    <b>{o ? fmt.format(o.price * it.qty) : "—"}</b>
                    <small>{o ? `${fmt.format(o.price)} c/u` : ""}</small>
                  </div>
                </div>
                <div className="wish-row">
                  <div className="field">
                    <span className="lbl">Copias</span>
                    <div className="stepper">
                      <button type="button" aria-label="Una copia menos" onClick={() => setQty(it.id, it.qty - 1)} disabled={it.qty <= 1}>−</button>
                      <span aria-live="polite">{it.qty}</span>
                      <button type="button" aria-label="Una copia más" onClick={() => setQty(it.id, it.qty + 1)}>+</button>
                    </div>
                  </div>
                  <div className="field grow">
                    <label className="lbl" htmlFor={`st-${it.id}`}>Comprar en</label>
                    <select id={`st-${it.id}`} value={it.storeId} onChange={(e) => setStore(it.id, e.target.value)}>
                      {it.offers.map((x) => (
                        <option key={x.storeId} value={x.storeId}>
                          {x.storeName} · {fmt.format(x.price)}{x.stock ? ` · ${x.stock} disp.` : ""}{x.stock !== null && x.stock < it.qty ? " (no alcanza)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {o && <a className="o-go" href={o.url} target="_blank" rel="noopener">Ver en tienda</a>}
                  <button className="btn btn-ghost" type="button" onClick={() => remove(it.id)}>Quitar</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="panel share">
        <div className="group-h"><h3>Compartirte la lista</h3></div>
        <p className="translated">
          Mandátela por WhatsApp (podés elegir tu propio chat, "Mensaje para mí") con cada carta, la cantidad, la tienda que elegiste y el link para comprar.
        </p>
        <pre className="share-preview">{buildShareText(items)}</pre>
        <div className="search">
          <a className="btn btn-primary wa-btn" href={whatsappLink(buildShareText(items))} target="_blank" rel="noopener">Compartir por WhatsApp</a>
          <button className="btn btn-ghost" type="button" onClick={copy}>{copied ? "Copiada" : "Copiar lista"}</button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button className="btn btn-ghost" type="button" onClick={nativeShare}>Más opciones…</button>
          )}
        </div>
        <p className="aviso-corto">{SHARE_WARNING}</p>
        <div className="search">
          {!confirmClear ? (
            <button className="btn btn-ghost" type="button" onClick={() => setConfirmClear(true)}>Vaciar lista</button>
          ) : (
            <>
              <span className="translated">¿Seguro? Se borran todas las cartas de la lista.</span>
              <button className="btn btn-ghost danger" type="button" onClick={() => { clear(); setConfirmClear(false); }}>Sí, vaciar</button>
              <button className="btn btn-ghost" type="button" onClick={() => setConfirmClear(false)}>Cancelar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
