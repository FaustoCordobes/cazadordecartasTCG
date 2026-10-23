"use client";

import { useEffect, useState } from "react";
import type { Game } from "@/lib/types.ts";

/** Cartas más buscadas esta semana (datos reales; si no hay, no se muestra nada) */
export function Populares({ game, onPick }: { game: Game; onPick: (q: string) => void }) {
  const [list, setList] = useState<{ consulta: string; veces: number }[]>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    setList([]);
    fetch(`/api/populares?game=${game}`, { signal: ctrl.signal }).then((r) => r.json()).then((l) => Array.isArray(l) && setList(l)).catch(() => {});
    return () => ctrl.abort();
  }, [game]);
  if (list.length < 3) return null;
  return (
    <div className="quick popular">
      <span>Más buscadas esta semana:</span>
      {list.map((p) => <button key={p.consulta} type="button" onClick={() => onPick(p.consulta)} title={`${p.veces} búsquedas`}>{p.consulta}</button>)}
    </div>
  );
}
