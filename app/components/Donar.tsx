"use client";

/**
 * Donación voluntaria por Cafecito (cafecito.app): se paga con un toque, con tarjeta o Mercado Pago,
 * sin copiar alias ni transferir a mano.
 */
export const DONAR_URL = "https://cafecito.app/faust0cordobes";

export function Donar({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <a className="linkbtn donar-link" href={DONAR_URL} target="_blank" rel="noopener">
        ☕ Invitame un cafecito para mantener el servidor
      </a>
    );
  }
  return (
    <section className="donar" aria-labelledby="donar-t">
      <div>
        <h2 id="donar-t">¿Te sirvió Cazacartas?</h2>
        <p>
          Si te gustó la app y te ayudó a encontrar tus cartas, podés apoyar el proyecto invitando un cafecito. Es <b>totalmente
          voluntario</b> y se usa <b>únicamente para pagar el servidor</b> y que la app siga online y gratis para todos.
        </p>
        <p>Se paga en un minuto desde Cafecito, con tarjeta o Mercado Pago. Podés dejar un mensaje si querés.</p>
        <p className="donar-nota">
          Donar no da ningún beneficio: no cambia los resultados ni el orden de las tiendas, y ninguna tienda paga por aparecer.
        </p>
      </div>
      <div className="donar-acciones">
        <a className="donar-btn" href={DONAR_URL} target="_blank" rel="noopener">
          <span aria-hidden="true">☕</span> Invitame un cafecito
        </a>
        <span className="donar-hint">Se abre cafecito.app/faust0cordobes</span>
      </div>
    </section>
  );
}
