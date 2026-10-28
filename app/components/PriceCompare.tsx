"use client";

import type { CardInfo, Game } from "@/lib/types.ts";
import { convert, diffPct, searchLinks, worldRows, type Currency, type Rates } from "@/lib/worldprice.ts";

const ARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const EUR = new Intl.NumberFormat("es-AR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const orig = (v: number, c: "ARS" | "USD" | "EUR") => (c === "ARS" ? ARS : c === "USD" ? USD : EUR).format(v);

/**
 * Comparador de precios de una versión de carta: tiendas de Argentina vs TCGplayer, Cardmarket y otros sitios.
 * Todo se muestra en la moneda elegida (pesos o dólares), con el precio original al lado.
 */
export function PriceCompare({ game, name, rarity, version, info, local, median, stores, currency, rates }: {
  game: Game; name: string; rarity: string | null; version: string | null; info: CardInfo | null;
  /** precio más bajo con stock en Argentina (pesos) */
  local: number | null; median: number | null; stores: number; currency: Currency; rates: Rates;
}) {
  const rows = worldRows(game, { rarity, version, info });
  const show = (v: number, from: "ARS" | "USD" | "EUR") => {
    const c = convert(v, from, currency, rates);
    return c === null ? orig(v, from) : currency === "ARS" ? ARS.format(Math.round(c)) : USD.format(c);
  };
  const localUsd = local !== null ? convert(local, "ARS", "USD", rates) : null;
  const links = searchLinks(game, name);

  return (
    <div className="pcmp" role="region" aria-label={`Comparar precios de ${name}`}>
      <div className="tbl">
        <table>
          <thead><tr><th>Dónde</th><th className="num">Precio ({currency === "ARS" ? "pesos" : "dólares"})</th><th className="num">Argentina vs. este sitio</th></tr></thead>
          <tbody>
            <tr className="pcmp-local">
              <td><b>🇦🇷 Tiendas de Argentina</b><div className="hint">Más barata con stock · {stores} tienda{stores === 1 ? "" : "s"}</div></td>
              <td className="num" data-label="Precio">{local !== null ? <><b>{show(local, "ARS")}</b>{median && <div className="hint">Mediana {show(median, "ARS")}</div>}</> : <span className="hint">Sin stock</span>}</td>
              <td className="num pcmp-empty">—</td>
            </tr>
            {rows.map((r) => {
              const abroadUsd = convert(r.main, r.currency, "USD", rates);
              const d = diffPct(localUsd, abroadUsd);
              return (
                <tr key={r.site}>
                  <td>
                    <b>{r.site}</b> <span className="hint">({r.region})</span>
                    {r.url && <> · <a href={r.url} target="_blank" rel="noopener">Ver ↗</a></>}
                    <div className="hint">{r.mainLabel}{r.cardLevel ? " · de la carta (la impresión más barata), no de esta versión" : ""}</div>
                  </td>
                  <td className="num" data-label="Precio">
                    <b>{show(r.main, r.currency)}</b>
                    {(r.currency as string) !== currency && <div className="hint">{orig(r.main, r.currency)}</div>}
                    {r.extra.length > 0 && <div className="hint">{r.extra.map((e) => `${e.label}: ${show(e.value, r.currency)}`).join(" · ")}</div>}
                  </td>
                  <td className="num" data-label="Argentina vs. este sitio">
                    {d === null ? "—" : <span className={d > 0 ? "mv-up" : "mv-down"}>{d > 0 ? `+${d} % más caro acá` : d < 0 ? `${d} % más barato acá` : "igual"}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="hint">
          No tenemos el precio internacional de esta versión. Podés buscarla en{" "}
          <a href={links.tcg} target="_blank" rel="noopener">TCGplayer ↗</a> o <a href={links.cm} target="_blank" rel="noopener">Cardmarket ↗</a>.
        </p>
      )}
      <p className="pcmp-note">
        Precios de afuera sin envío ni impuestos de importación, actualizados una vez por día por las bases públicas de cartas
        (Scryfall, YGOPRODeck, Pokémon TCG API, OPTCG API). Pesos y dólares al {rates.usdArs ? `dólar del día (${ARS.format(rates.usdArs)})` : "dólar del día"}
        {rates.eurUsd ? `; euro a US$ ${rates.eurUsd.toLocaleString("es-AR")}` : ""}.
        {rows.some((r) => r.site === "TCGplayer") && " Este sitio usa datos de TCGplayer, pero no está avalado ni certificado por TCGplayer."}
      </p>
    </div>
  );
}
