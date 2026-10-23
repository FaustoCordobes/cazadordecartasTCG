"use client";

import { useEffect, useState } from "react";

const KEY = "cazacartas:onboarding-ok";

/** Cómo funciona, en 3 pasos. Se puede cerrar y no vuelve a aparecer en este navegador. */
export function Onboarding() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(!localStorage.getItem(KEY)); } catch { setShow(true); }
  }, []);
  if (!show) return null;
  return (
    <div className="onb" role="note" aria-label="Cómo funciona">
      <ol>
        <li><b>1</b> Elegí el juego</li>
        <li><b>2</b> Buscá la carta (nombre o código)</li>
        <li><b>3</b> Compará y comprá directo en la tienda</li>
      </ol>
      <button type="button" className="linkbtn" onClick={() => { setShow(false); try { localStorage.setItem(KEY, "1"); } catch { /* nada */ } }}>Entendido</button>
    </div>
  );
}
