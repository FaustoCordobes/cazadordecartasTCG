"use client";

import { useEffect, useState } from "react";
import type { Game } from "@/lib/types.ts";

interface Point { dia: string; min: number; tiendas: number }
const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

/** Precio mínimo por día de una versión de carta, desde que Cazacartas empezó a medir. Sin datos inventados. */
export function PriceHistory({ game, cardKey }: { game: Game; cardKey: string }) {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<{ enabled: boolean; points: Point[] } | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setData(null); setErr(false);
    fetch(`/api/historial?game=${game}&key=${encodeURIComponent(cardKey)}&dias=${range}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setData)
      .catch((e) => { if (e.name !== "AbortError") setErr(true); });
    return () => ctrl.abort();
  }, [game, cardKey, range]);

  const pts = data?.points ?? [];
  const W = 320, H = 90, P = 6;
  const lo = Math.min(...pts.map((p) => p.min)), hi = Math.max(...pts.map((p) => p.min));
  const x = (i: number) => P + (pts.length < 2 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (pts.length - 1));
  const y = (v: number) => (hi === lo ? H / 2 : H - P - ((v - lo) * (H - 2 * P)) / (hi - lo));

  return (
    <div className="hist">
      <div className="hist-h">
        <b>Precio más bajo por día</b>
        <div className="seg" role="group" aria-label="Rango">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" aria-pressed={range === d} className={range === d ? "on" : ""} onClick={() => setRange(d)}>{d} días</button>
          ))}
        </div>
      </div>
      {err ? <p className="translated">No se pudo cargar el historial.</p>
        : !data ? <div className="skel" style={{ height: H }} />
        : !data.enabled ? <p className="translated">El historial de precios todavía no está activado en este servidor.</p>
        : pts.length === 0 ? <p className="translated">Todavía no hay datos: empezamos a medir esta carta desde que alguien la busca en Cazacartas.</p>
        : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="hist-svg" role="img" aria-label={`Precio mínimo: de ${fmt.format(pts[0].min)} a ${fmt.format(pts[pts.length - 1].min)}`}>
              <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.map((p, i) => `${x(i)},${y(p.min)}`).join(" ")} />
              {pts.map((p, i) => <circle key={p.dia} cx={x(i)} cy={y(p.min)} r="2.5" fill="currentColor"><title>{`${day(p.dia)}: ${fmt.format(p.min)} (${p.tiendas} tienda${p.tiendas === 1 ? "" : "s"})`}</title></circle>)}
            </svg>
            <div className="hist-f">
              <span>{day(pts[0].dia)}: {fmt.format(pts[0].min)}</span>
              <span>Mín. {fmt.format(lo)} · Máx. {fmt.format(hi)}</span>
              <span>{day(pts[pts.length - 1].dia)}: {fmt.format(pts[pts.length - 1].min)}</span>
            </div>
            <p className="translated">Desde que empezamos a medir ({pts.length} día{pts.length === 1 ? "" : "s"} con datos). Solo cuenta los días en que alguien buscó la carta.</p>
          </>
        )}
    </div>
  );
}
