"use client";

import { useState } from "react";

/**
 * Donación voluntaria por Mercado Pago.
 * - DONAR_ALIAS: tu alias de Mercado Pago (se copia con un toque y se transfiere desde cualquier banco o billetera).
 * - DONAR_URL: link de pago de Mercado Pago. Dejalo vacío ("") hasta tener uno que funcione:
 *   el botón de link solo aparece si hay un link cargado.
 */
export const DONAR_ALIAS = "faust08";
export const DONAR_URL = "";

function useCopy() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(DONAR_ALIAS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copiá el alias de Mercado Pago:", DONAR_ALIAS);
    }
  }
  return { copied, copy };
}

export function Donar({ compact = false }: { compact?: boolean }) {
  const { copied, copy } = useCopy();

  if (compact) {
    return (
      <button type="button" className="linkbtn donar-link" onClick={copy}>
        💛 {copied ? `Alias copiado: ${DONAR_ALIAS}` : "Donar para mantener el servidor"}
      </button>
    );
  }
  return (
    <section className="donar" aria-labelledby="donar-t">
      <div>
        <h2 id="donar-t">¿Te sirvió Cazacartas?</h2>
        <p>
          Si te gustó la app y te ayudó a encontrar tus cartas, podés apoyar el proyecto con una donación. Es <b>totalmente
          voluntaria</b> y se usa <b>únicamente para pagar el servidor</b> y que la app siga online y gratis para todos.
        </p>
        <p>
          Transferí el monto que quieras al alias de Mercado Pago <b className="alias-mp">{DONAR_ALIAS}</b>, desde Mercado Pago o desde cualquier banco o billetera.
        </p>
        <p className="donar-nota">
          Donar no da ningún beneficio: no cambia los resultados ni el orden de las tiendas, y ninguna tienda paga por aparecer.
        </p>
      </div>
      <div className="donar-acciones">
        <button type="button" className="donar-btn" onClick={copy}>
          <span aria-hidden="true">💛</span> {copied ? "¡Alias copiado!" : "Donar para mantener el servidor"}
        </button>
        <span className="donar-hint">{copied ? "Pegalo en Transferir de tu app" : `Copia el alias ${DONAR_ALIAS}`}</span>
        {DONAR_URL && <a className="donar-link" href={DONAR_URL} target="_blank" rel="noopener">o pagá con link de Mercado Pago ↗</a>}
      </div>
    </section>
  );
}
