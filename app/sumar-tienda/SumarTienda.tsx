"use client";

import { useState } from "react";
import { BRAND, waLink } from "@/lib/brand.ts";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import type { Game } from "@/lib/types.ts";

const ACCESS = {
  web: "Pueden buscar en nuestra web (una consulta por cada búsqueda de un usuario)",
  bot: "Tenemos protección anti-bots: vamos a habilitar a “CazacartasBot”",
  feed: "Les pasamos un archivo o link con el catálogo (Google Shopping, Facebook, CSV…)",
  nose: "No sé / prefiero que me contacten",
} as const;

/** Formulario para que una tienda se sume (como el "List your store" de TCGCompare) */
export function SumarTienda() {
  const [f, setF] = useState({ nombre: "", web: "", ciudad: "", instagram: "", feed: "", envio: "", gratis: "", compra: "", contacto: "", email: "", website: "" });
  const [games, setGames] = useState<Game[]>([]);
  const [access, setAccess] = useState<keyof typeof ACCESS>("web");
  const [buys, setBuys] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const summary = () => [
    `Tienda: ${f.nombre}`, `Juegos: ${games.map((g) => GAMES[g].short).join(", ") || "-"}`, `Ciudad/provincia: ${f.ciudad || "-"}`,
    `Instagram: ${f.instagram || "-"}`, `Acceso: ${ACCESS[access]}`, f.feed && `Catálogo: ${f.feed}`,
    (f.envio || f.gratis) && `Envío: ${f.envio || "?"} · gratis desde ${f.gratis || "-"}`,
    buys && `Compra cartas: sí · ${f.compra || "(sin link)"}`, `Contacto: ${f.contacto || "-"}`,
  ].filter(Boolean).join("\n");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim() || !/^https?:\/\//i.test(f.web.trim())) { setErr("Completá el nombre y la web (que empiece con https://)."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/reporte", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "tienda_alta", url: f.web.trim(), comentario: summary(), email: f.email.trim() || undefined, website: f.website }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string };
      if (!d.ok) setErr(d.error ?? "No se pudo enviar."); else setOk(true);
    } catch { setErr("No se pudo enviar. Probá por WhatsApp."); }
    finally { setBusy(false); }
  }

  return (
    <div className="app" data-game="digi">
      <main className="wrap guide">
        <header className="top">
          <a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="logo" aria-hidden="true" />
            <div><h1>{BRAND.name}</h1><p>Volver al buscador</p></div>
          </a>
        </header>
        <h1>Sumá tu tienda</h1>
        <p>
          {BRAND.name} es <b>gratis y sin comisiones</b>: no vende cartas ni cobra por aparecer. Muestra dónde está cada carta y manda a la
          gente a comprar <b>directo en tu web o tu local</b>, con el link a tu publicación. Si en algún momento preferís no aparecer, te sacamos al toque.
        </p>
        {ok ? (
          <div className="ok-box" role="status"><b>¡Gracias!</b> Recibimos los datos de {f.nombre}. Te contactamos para terminar de sumarla.</div>
        ) : (
          <form className="panel store-form" onSubmit={send}>
            <div className="prefs-row">
              <label>Nombre de la tienda *<input value={f.nombre} onChange={set("nombre")} maxLength={80} required /></label>
              <label>Web *<input value={f.web} onChange={set("web")} placeholder="https://…" maxLength={200} required /></label>
              <label>Ciudad y provincia<input value={f.ciudad} onChange={set("ciudad")} maxLength={80} /></label>
              <label>Instagram<input value={f.instagram} onChange={set("instagram")} placeholder="@tutienda" maxLength={60} /></label>
            </div>
            <fieldset>
              <legend>¿Qué juegos vendés en cartas sueltas?</legend>
              {GAME_IDS.map((g) => (
                <label className="check" key={g}><input type="checkbox" checked={games.includes(g)} onChange={(e) => setGames(e.target.checked ? [...games, g] : games.filter((x) => x !== g))} />{GAMES[g].short}</label>
              ))}
            </fieldset>
            <fieldset>
              <legend>¿Cómo leemos tus precios?</legend>
              {(Object.keys(ACCESS) as (keyof typeof ACCESS)[]).map((k) => (
                <label className="check" key={k}><input type="radio" name="acc" checked={access === k} onChange={() => setAccess(k)} />{ACCESS[k]}</label>
              ))}
              {access === "feed" && <label>Link del catálogo<input value={f.feed} onChange={set("feed")} placeholder="https://…" maxLength={200} /></label>}
            </fieldset>
            <fieldset>
              <legend>Envíos (opcional: así el plan de compra calcula el total real)</legend>
              <div className="prefs-row">
                <label>Costo de envío aprox.<input value={f.envio} onChange={set("envio")} inputMode="numeric" maxLength={20} /></label>
                <label>Envío gratis desde<input value={f.gratis} onChange={set("gratis")} inputMode="numeric" maxLength={20} /></label>
              </div>
            </fieldset>
            <fieldset>
              <legend>¿Comprás cartas?</legend>
              <label className="check"><input type="checkbox" checked={buys} onChange={(e) => setBuys(e.target.checked)} />Sí, compramos cartas (aparecés en “Vender mis cartas”)</label>
              {buys && <label>Link o WhatsApp para vender<input value={f.compra} onChange={set("compra")} maxLength={200} /></label>}
            </fieldset>
            <div className="prefs-row">
              <label>Contacto (WhatsApp o nombre)<input value={f.contacto} onChange={set("contacto")} maxLength={80} /></label>
              <label>Email (opcional)<input type="email" value={f.email} onChange={set("email")} maxLength={120} /></label>
            </div>
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set("website")} />
            {err && <div className="err-box">{err}</div>}
            <div className="search">
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar"}</button>
              <a className="btn btn-ghost" href={waLink(`Hola! Quiero sumar mi tienda a Cazacartas.\n${summary()}`)} target="_blank" rel="noopener">Mandarlo por WhatsApp</a>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
