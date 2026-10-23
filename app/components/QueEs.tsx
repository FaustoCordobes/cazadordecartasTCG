import { STORES } from "@/lib/stores.ts";
import { LINK_STORES } from "@/lib/linkstores.ts";

const WA = "https://wa.me/5492944242906";

/** Presentación corta de la app, plegable para no empujar el buscador hacia abajo */
export function QueEs() {
  return (
    <details className="que-es">
      <summary>
        <span>🃏 ¿Qué es Cazacartas y qué tiene de bueno?</span>
        <span className="que-es-ver" aria-hidden="true">Ver</span>
      </summary>
      <div className="que-es-body">
        <p>
          ¿Te falta una carta para el mazo y no querés recorrer diez páginas? <b>Cazacartas la busca por vos.</b> Escribís el
          nombre y en segundos ves en qué tiendas está, a qué precio, si hay stock y dónde queda el local, con link directo a la
          publicación.
        </p>
        <ul className="que-es-list">
          <li><span aria-hidden="true">🎮</span><div><b>5 juegos:</b> Yu-Gi-Oh!, Digimon, Magic, Pokémon y One Piece, cada uno con sus filtros (rareza, expansión, idioma, foil, versión y más).</div></li>
          <li><span aria-hidden="true">🏪</span><div><b>{STORES.length} tiendas de todo el país</b> en una sola búsqueda, más {LINK_STORES.length} en el directorio para consultar.</div></li>
          <li><span aria-hidden="true">📋</span><div><b>Pegás tu decklist</b> y te dice qué tienda tiene más cartas de tu mazo y cuál es la compra más barata.</div></li>
          <li><span aria-hidden="true">⭐</span><div><b>Mi lista:</b> guardás las cartas que querés y te la mandás por WhatsApp con los links, sin crear cuenta.</div></li>
          <li><span aria-hidden="true">📍</span><div><b>Tiendas de tu provincia</b>, para retirar en el local y ahorrarte el envío.</div></li>
          <li><span aria-hidden="true">📲</span><div><b>Gratis</b>, se instala en el celular y tiene modo oscuro.</div></li>
        </ul>
        <div className="que-es-tiendas">
          <h3>🤝 Para las tiendas</h3>
          <p>
            Cazacartas no vende cartas, no cobra comisiones y no compite con nadie. Cada búsqueda termina en la página o el local
            de la tienda, y la compra se hace siempre directo con ella. La idea es simple: que los jugadores encuentren más rápido
            lo que buscan y que eso se convierta en <b>más ventas para las tiendas de Argentina</b>.
          </p>
          <p>
            Ninguna tienda paga por aparecer ni por salir primera. La app solo lee información pública y respeta las reglas de cada
            web. ¿Tenés una tienda y querés aparecer, corregir un dato o que te saquemos?{" "}
            <a href={WA} target="_blank" rel="noopener">Escribinos por WhatsApp</a> y lo resolvemos enseguida.
          </p>
        </div>
      </div>
    </details>
  );
}
