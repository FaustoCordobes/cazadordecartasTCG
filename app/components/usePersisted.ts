"use client";

import { useEffect, useState } from "react";

/**
 * Estado que se guarda en este navegador (localStorage). Si el navegador no deja guardar
 * (modo privado, datos bloqueados) funciona igual, solo que no se recuerda.
 */
export function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) setValue({ ...(initial as object), ...JSON.parse(raw) } as T);
      } catch { /* sin almacenamiento */ }
    };
    load();
    // al ingresar a la cuenta se pueden traer ajustes guardados en otro dispositivo
    window.addEventListener("cazacartas:ajustes-sync", load);
    return () => window.removeEventListener("cazacartas:ajustes-sync", load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (v: T) => {
    setValue(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
    try { window.dispatchEvent(new Event("cazacartas:ajustes")); } catch { /* nada */ }
  };
  return [value, set];
}
