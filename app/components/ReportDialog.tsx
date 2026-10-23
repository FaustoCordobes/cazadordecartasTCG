"use client";

import { useEffect, useRef, useState } from "react";
import { REPORT_TYPES, type ReportType } from "@/lib/reports.ts";
import { waLink } from "@/lib/brand.ts";

export interface ReportContext {
  types: ReportType[];
  title?: string;
  game?: string;
  carta?: string;
  store_id?: string;
  url?: string;
}

/**
 * Formulario de reporte / contacto en un <dialog>. Se envía de verdad a /api/reporte.
 * Si el servidor no puede guardarlo, lo dice y ofrece WhatsApp: nunca simula que se envió.
 */
export function ReportDialog({ ctx, onClose }: { ctx: ReportContext | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tipo, setTipo] = useState<ReportType>("precio");
  const [comentario, setComentario] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!ctx) return;
    setTipo(ctx.types[0]); setComentario(""); setEmail(""); setUrl(ctx.url ?? ""); setState("idle"); setMsg("");
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, [ctx]);

  function close() {
    ref.current?.close();
    onClose();
  }

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const website = (new FormData(e.currentTarget).get("website") as string) ?? "";
    setState("sending");
    try {
      const res = await fetch("/api/reporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, comentario, email, url, website, game: ctx?.game, carta: ctx?.carta, store_id: ctx?.store_id }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && j.ok) { setState("ok"); return; }
      setState("error");
      setMsg(j.error ?? "No se pudo enviar.");
    } catch {
      setState("error");
      setMsg("No se pudo enviar (sin conexión).");
    }
  }

  const waText = `Hola! Quiero reportar en Cazacartas: ${REPORT_TYPES[tipo]}${ctx?.carta ? ` · ${ctx.carta}` : ""}${ctx?.store_id ? ` · tienda ${ctx.store_id}` : ""}${comentario ? ` · ${comentario}` : ""}`;

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="rep-t">
      <form method="dialog" className="dialog-x"><button aria-label="Cerrar" onClick={close}>×</button></form>
      <h2 id="rep-t">{ctx?.title ?? "Reportar un problema"}</h2>
      {ctx?.carta && <p className="translated">{ctx.carta}{ctx.store_id ? ` · ${ctx.store_id}` : ""}</p>}
      {state === "ok" ? (
        <div className="ok-box" role="status">
          <b>¡Gracias! Lo recibimos.</b> Lo revisamos a mano; si dejaste tu email te respondemos ahí.
          <div className="search"><button type="button" className="btn btn-primary" onClick={close}>Listo</button></div>
        </div>
      ) : (
        <form className="rep-form" onSubmit={send}>
          {ctx && ctx.types.length > 1 && (
            <div className="field">
              <label htmlFor="rep-tipo">¿Qué pasa?</label>
              <select id="rep-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as ReportType)}>
                {ctx.types.map((t) => <option key={t} value={t}>{REPORT_TYPES[t]}</option>)}
              </select>
            </div>
          )}
          {(tipo === "tienda_nueva" || tipo === "tienda_cerrada" || tipo === "link") && (
            <div className="field">
              <label htmlFor="rep-url">{tipo === "tienda_nueva" ? "Web o Instagram de la tienda" : "Link"}</label>
              <input id="rep-url" type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="rep-com">Contanos más {tipo === "contacto" || tipo === "tienda_nueva" ? "" : "(opcional)"}</label>
            <textarea id="rep-com" rows={3} maxLength={600} value={comentario} onChange={(e) => setComentario(e.target.value)}
              placeholder={tipo === "tienda_nueva" ? "Nombre, ciudad, qué juegos vende…" : "Ej: el precio en la tienda es $8.000"} />
          </div>
          <div className="field">
            <label htmlFor="rep-mail">Tu email (opcional, solo si querés respuesta)</label>
            <input id="rep-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {/* campo trampa para bots: las personas no lo ven */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
          <p className="aviso-corto">No guardamos tu IP ni datos del navegador. El email se usa solo para responderte y se borra cuando se resuelve.</p>
          {state === "error" && (
            <div className="err-box" role="alert">
              {msg} <a href={waLink(waText)} target="_blank" rel="noopener">Mandalo por WhatsApp</a>
            </div>
          )}
          <div className="search">
            <button className="btn btn-primary" type="submit" disabled={state === "sending"}>{state === "sending" ? "Enviando…" : "Enviar"}</button>
            <a className="btn btn-ghost" href={waLink(waText)} target="_blank" rel="noopener">Prefiero WhatsApp</a>
          </div>
        </form>
      )}
    </dialog>
  );
}
