import type { Metadata } from "next";
import { BRAND } from "@/lib/brand.ts";

export const metadata: Metadata = {
  title: "Guía para comprar cartas sueltas (singles) en Argentina",
  description: "Qué significan NM, LP y HP, cómo leer los códigos de set de cada juego, qué es foil, reverse holo o parallel, y consejos para comprar singles en tiendas de Argentina.",
  alternates: { canonical: "/guia" },
};

export default function Guia() {
  return (
    <div className="app" data-game="mtg">
      <main className="wrap guide">
        <header className="top">
          <a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="logo" aria-hidden="true" />
            <div><h1>{BRAND.name}</h1><p>Volver al buscador</p></div>
          </a>
        </header>
        <h1>Guía rápida para comprar singles</h1>
        <p>Un <b>single</b> es una carta suelta: la comprás individualmente en vez de abrir sobres. Para comparar precios bien, hay que mirar que sea <b>la misma versión</b>.</p>

        <h2>Estado de la carta (condición)</h2>
        <ul>
          <li><b>NM — Near Mint:</b> como nueva, sin marcas visibles.</li>
          <li><b>LP — Lightly Played:</b> algún detalle mínimo en bordes o esquinas.</li>
          <li><b>MP — Moderately Played:</b> desgaste visible, se puede jugar en folio.</li>
          <li><b>HP — Heavily Played:</b> mucho desgaste, pliegues o marcas.</li>
          <li><b>DMG — Damaged:</b> dañada (dobleces, roturas, manchas).</li>
        </ul>
        <p>Una carta LP suele costar menos que una NM. Cazacartas muestra el estado cuando la tienda lo publica y avisa si se mezclan estados distintos.</p>

        <h2>Códigos de set de cada juego</h2>
        <ul>
          <li><b>Yu-Gi-Oh!:</b> <code>RA01-EN008</code> = set (RA01) + idioma (EN inglés, SP español) + número. La misma carta en otro set es otra impresión, con otro precio.</li>
          <li><b>Digimon:</b> <code>BT19-070</code> = set + número. Cada código es una carta distinta aunque se llame igual.</li>
          <li><b>One Piece:</b> <code>OP01-025</code> = set + número. Las versiones <i>Parallel</i>, <i>Manga</i> y <i>SP</i> comparten código pero valen mucho más.</li>
          <li><b>Pokémon:</b> <code>125/197</code> = número de la carta / total del set. Los números por encima del total (por ejemplo 215/197) son rarezas secretas.</li>
          <li><b>Magic:</b> el set son 3 a 5 letras (<code>CMM</code>, <code>MH3</code>) y el número de coleccionista. La misma carta tiene decenas de impresiones.</li>
        </ul>

        <h2>Foil, holo, reverse y parallel</h2>
        <ul>
          <li><b>Foil (Magic):</b> brillante. Vale distinto que la no foil.</li>
          <li><b>Holo / Reverse Holo (Pokémon):</b> holo brilla en la ilustración; reverse brilla en el resto de la carta.</li>
          <li><b>Parallel / Alternate Art (One Piece, Digimon):</b> otra ilustración, más rara.</li>
          <li><b>1st Edition (Yu-Gi-Oh!):</b> primera tirada del set.</li>
        </ul>

        <h2>Consejos para comprar</h2>
        <ul>
          <li>Confirmá precio y stock en la tienda antes de pagar: los datos pueden cambiar.</li>
          <li>Si comprás varias cartas, usá <b>Listado de cartas</b>: calcula si conviene juntar todo en menos tiendas por el envío.</li>
          <li>Si hay un local en tu provincia, retirar en persona te ahorra el envío.</li>
          <li>Preguntá por descuentos en efectivo o transferencia: muchas tiendas los tienen.</li>
        </ul>
        <p><a className="btn btn-primary" href="/">Buscar una carta</a></p>
      </main>
    </div>
  );
}
