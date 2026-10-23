/**
 * Aviso de buena fe. Aparece en varios lugares de la app a propósito:
 * deja claro que Cazacartas no compite con las tiendas sino que les manda compradores.
 */

const WA = "https://wa.me/5492944242906";

export function AvisoCorto() {
  return (
    <p className="aviso-corto">
      Cazacartas es un proyecto <b>sin fines de lucro</b>: no vende cartas ni cobra comisiones. Solo te muestra dónde está
      cada carta y te lleva a la tienda para que le compres directamente a ella.
    </p>
  );
}

export function AvisoMazo() {
  return (
    <p className="aviso-corto">
      La idea es ayudarte a completar tu mazo comprándole a las tiendas de Argentina. Los precios y el stock son los que publica
      cada tienda y pueden cambiar: el valor que cuenta es siempre el que figura en su página o en su local.
    </p>
  );
}

export function AvisoTiendas() {
  return (
    <p className="aviso-corto">
      Solo se consulta información pública, respetando las reglas de cada sitio (robots.txt), con pausas y guardando los
      resultados para no cargar a ninguna tienda. Si sos dueño de una tienda y preferís no aparecer, <a href={WA} target="_blank" rel="noopener">escribinos</a> y te sacamos.
    </p>
  );
}

export function AvisoCompleto() {
  return (
    <section className="aviso" aria-labelledby="aviso-t">
      <h2 id="aviso-t">Sobre Cazacartas</h2>
      <p>
        Cazacartas nace con una sola intención: que a cada jugador le resulte más fácil y rápido conseguir las cartas que le
        faltan, y que eso se traduzca en <b>más ventas para las tiendas de Argentina</b>. No buscamos perjudicar a ninguna
        tienda ni competir con ellas.
      </p>
      <ul>
        <li><b>Es sin fines de lucro.</b> No vendemos cartas, no cobramos comisiones ni intermediamos pagos.</li>
        <li><b>La compra es siempre con la tienda.</b> Cada resultado te lleva a su página o a su local; los precios y el stock son los que ella publica.</li>
        <li><b>Cuidamos a las tiendas.</b> Solo leemos información pública, respetamos las reglas de cada sitio (robots.txt), nos identificamos y hacemos pausas entre consultas.</li>
        <li><b>Los datos pueden estar desactualizados.</b> Ante cualquier diferencia, vale lo que diga la tienda.</li>
        <li>Yu-Gi-Oh! es marca de Konami y Digimon Card Game es marca de Bandai. Cazacartas no está afiliado a ninguna de las dos.</li>
      </ul>
      <p>
        <b>¿Tenés una tienda?</b> Si querés que te saquemos, que corrijamos un dato o que te sumemos, escribinos por{" "}
        <a href={WA} target="_blank" rel="noopener">WhatsApp</a> y lo resolvemos lo antes posible.
      </p>
    </section>
  );
}
