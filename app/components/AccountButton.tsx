"use client";

import { useEffect, useRef, useState } from "react";
import { accountsEnabled, useAccount } from "./account.ts";
import { AccountPanel } from "./AccountPanel.tsx";

/** Botón "Cuenta" del encabezado: abre el panel para crear cuenta / ingresar, o muestra la cuenta ingresada */
export function AccountButton() {
  const a = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  if (!accountsEnabled) return null;
  const label = a.user ? (a.user.email ?? "Mi cuenta").split("@")[0].slice(0, 12) : "Cuenta";
  return (
    <>
      <button type="button" className="theme-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span aria-hidden="true">{a.user ? "☁️" : "👤"}</span><span>{label}</span>
      </button>
      <dialog ref={ref} className="dialog" onClose={() => setOpen(false)} aria-labelledby="acc-t">
        <form method="dialog" className="dialog-x"><button aria-label="Cerrar">×</button></form>
        <h2 id="acc-t">{a.user ? "Tu cuenta" : "Tu cuenta en Cazacartas"}</h2>
        {open && <AccountPanel onDone={() => setOpen(false)} />}
      </dialog>
    </>
  );
}
