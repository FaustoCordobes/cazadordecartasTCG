"use client";

import { useRef, useState } from "react";
import type { Game } from "@/lib/types.ts";
import { findCodes, guessName } from "@/lib/scan.ts";
import { GAMES } from "@/lib/games.ts";

/**
 * Sacale una foto a la carta y buscamos su código (OCR en el navegador: la foto no se sube a ningún lado).
 * El lector (Tesseract) se descarga recién la primera vez que se usa.
 */
export function ScanCard({ game, onFound }: { game: Game; onFound: (q: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);

  async function read(file: File | undefined) {
    if (!file) return;
    setOptions([]);
    setStatus("Leyendo la carta… (la primera vez tarda un poco más)");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const codes = findCodes(game, data.text);
      const name = guessName(data.text);
      if (codes.length === 1) { setStatus(`Encontramos ${codes[0]}.`); onFound(codes[0]); return; }
      const opts = codes.length ? codes : name ? [name] : [];
      setOptions(opts);
      setStatus(opts.length ? "¿Cuál es? Tocá para buscar:" : `No pudimos leer el código. Acercá la cámara al código de la carta (${GAMES[game].placeholder.split(", ").pop()}), con buena luz y sin reflejos.`);
    } catch {
      setStatus("No se pudo leer la foto en este navegador.");
    }
  }

  return (
    <div className="scan">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.click()}>📷 Buscar con una foto de la carta</button>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
      {status && <span className="hint" role="status">{status}</span>}
      {options.length > 0 && <div className="quick">{options.map((o) => <button key={o} type="button" onClick={() => onFound(o)}>{o}</button>)}</div>}
    </div>
  );
}
