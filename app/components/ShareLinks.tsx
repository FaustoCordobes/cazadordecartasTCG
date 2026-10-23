"use client";

import { useState } from "react";

/** Compartir un link: WhatsApp, menú del celular o copiar */
export function ShareLinks({ url, text, label = "Compartir" }: { url: string; text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiá el link:", url);
    }
  }

  return (
    <div className="share-links" role="group" aria-label={label}>
      <span className="lbl">{label}</span>
      <a className="btn btn-ghost btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`} target="_blank" rel="noopener">WhatsApp</a>
      {canNative && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigator.share({ title: "Cazacartas", text, url }).catch(() => {})}>Más opciones</button>
      )}
      <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>{copied ? "¡Link copiado!" : "Copiar link"}</button>
    </div>
  );
}
