"use client";

import { useState } from "react";
import { account, accountsEnabled, googleEnabled, useAccount } from "./account.ts";
import { emailOk, passwordProblem } from "@/lib/accountsync.ts";
import { agoText } from "@/lib/freshness.ts";

/**
 * Crear cuenta / ingresar / mantener la sesión / olvidé mi contraseña / cuenta ingresada.
 * La cuenta queda lista al crearla: no hay que confirmar el mail.
 */
export function AccountPanel({ onDone }: { onDone?: () => void }) {
  const a = useAccount();
  const [mode, setMode] = useState<"ingresar" | "crear" | "olvide">("crear");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(() => account.remember());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  if (!accountsEnabled) return <p className="translated">Las cuentas todavía no están activadas en esta versión de la app.</p>;
  if (a.loading) return <p className="translated">Cargando…</p>;

  // Vino del link "olvidé mi contraseña": pedir la nueva
  if (a.recovery) {
    return (
      <form className="acc-form" onSubmit={async (e) => {
        e.preventDefault();
        const p = passwordProblem(pass, pass2);
        if (p) { setErr(p); return; }
        setBusy(true); setErr(null);
        const r = await account.updatePassword(pass);
        setBusy(false);
        if (r) setErr(r); else setOk("Listo, cambiaste la contraseña.");
      }}>
        <h3>Elegí una contraseña nueva</h3>
        <PassFields pass={pass} pass2={pass2} setPass={setPass} setPass2={setPass2} show={show} setShow={setShow} repeat />
        {err && <div className="err-box" role="alert">{err}</div>}
        {ok && <div className="ok-box" role="status">{ok}</div>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña"}</button>
      </form>
    );
  }

  if (a.user) {
    return (
      <div className="acc-form">
        <p>Ingresaste como <b>{a.user.email}</b>.</p>
        <div className="ok-box">
          ☁️ <b>Tu lista se guarda en tu cuenta:</b> todas tus listas, las alertas, las opciones del plan de compra, los envíos que cargaste y tu provincia.
          Ingresá con el mismo mail en otro celular o compu y las tenés ahí.
        </div>
        <p className="hint" role="status">
          {a.syncing ? "Guardando…" : a.lastSync ? `Guardado ${agoText(a.lastSync)}.` : ""} {a.error && <span className="no">{a.error}</span>}
        </p>
        <div className="search">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => account.syncNow()}>Guardar ahora</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await account.signOut(); onDone?.(); }}>Cerrar sesión</button>
        </div>
        <details className="acc-danger">
          <summary>Borrar mi cuenta</summary>
          <p className="hint">Se borran tu cuenta y lo guardado en ella. Lo que tengas en este navegador queda.</p>
          {!confirmDel ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(true)}>Quiero borrar mi cuenta</button>
          ) : (
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={async () => {
              setBusy(true); const r = await account.deleteAccount(); setBusy(false);
              if (r) setErr(r); else { setOk("Tu cuenta se borró."); onDone?.(); }
            }}>Sí, borrar definitivamente</button>
          )}
          {err && <div className="err-box" role="alert">{err}</div>}
        </details>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null);
    if (!emailOk(email)) { setErr("Revisá el mail: no parece válido."); return; }
    if (mode === "olvide") {
      setBusy(true);
      const r = await account.resetPassword(email);
      setBusy(false);
      if (r) setErr(r); else setOk("Si hay una cuenta con ese mail, te mandamos un link para elegir una contraseña nueva. Revisá también el spam.");
      return;
    }
    if (mode === "crear") { const p = passwordProblem(pass, pass2); if (p) { setErr(p); return; } }
    else if (!pass) { setErr("Escribí tu contraseña."); return; }
    account.setRemember(keep);
    setBusy(true);
    if (mode === "crear") {
      const r = await account.signUp(email, pass);
      setBusy(false);
      if (r.error) setErr(r.error);
      else if (r.needsConfirm) setOk("Cuenta creada, pero Supabase todavía pide confirmar el mail: revisá tu correo. (Para que no lo pida, hay que desactivar “Confirm email” en Supabase.)");
      else onDone?.();
    } else {
      const r = await account.signIn(email, pass);
      setBusy(false);
      if (r) setErr(r); else onDone?.();
    }
  }

  return (
    <form className="acc-form" onSubmit={submit} noValidate>
      {mode !== "olvide" && (
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "crear"} className={mode === "crear" ? "on" : ""} onClick={() => { setMode("crear"); setErr(null); }}>Crear cuenta</button>
          <button type="button" role="tab" aria-selected={mode === "ingresar"} className={mode === "ingresar" ? "on" : ""} onClick={() => { setMode("ingresar"); setErr(null); }}>Ingresar</button>
        </div>
      )}
      {googleEnabled && mode !== "olvide" && (
        <>
          <button type="button" className="btn btn-ghost google-btn" onClick={async () => { account.setRemember(keep); const r = await account.signInWithGoogle(); if (r) setErr(r); }}>
            <span aria-hidden="true" className="g-logo">G</span> Continuar con Google
          </button>
          <p className="hint or-line">o con tu mail</p>
        </>
      )}
      {mode === "crear" && <p className="hint">Es gratis y la cuenta queda lista al toque: no hay que confirmar el mail. Sirve para tener tu lista en todos tus dispositivos.</p>}
      {mode === "olvide" && <h3>Recuperar la contraseña</h3>}
      <label>Mail<input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} /></label>
      {mode !== "olvide" && (
        <PassFields pass={pass} pass2={pass2} setPass={setPass} setPass2={setPass2} show={show} setShow={setShow} repeat={mode === "crear"} newPass={mode === "crear"} />
      )}
      {mode !== "olvide" && (
        <label className="check"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />Mantener la sesión iniciada en este dispositivo</label>
      )}
      {err && <div className="err-box" role="alert">{err}</div>}
      {ok && <div className="ok-box" role="status">{ok}</div>}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Un momento…" : mode === "crear" ? "Crear cuenta" : mode === "ingresar" ? "Ingresar" : "Mandarme el link"}
      </button>
      {mode === "ingresar" && <button type="button" className="linkbtn" onClick={() => { setMode("olvide"); setErr(null); }}>Me olvidé la contraseña</button>}
      {mode === "olvide" && <button type="button" className="linkbtn" onClick={() => { setMode("ingresar"); setErr(null); setOk(null); }}>Volver</button>}
      <p className="aviso-corto">
        Guardamos tu mail y lo que elijas guardar (tus listas y ajustes). No lo compartimos con nadie, no mandamos publicidad y podés borrar la cuenta cuando quieras.
        {mode === "crear" && " Escribí bien tu mail: es la única forma de recuperar la contraseña."}
      </p>
    </form>
  );
}

function PassFields({ pass, pass2, setPass, setPass2, show, setShow, repeat, newPass }: {
  pass: string; pass2: string; setPass: (v: string) => void; setPass2: (v: string) => void; show: boolean; setShow: (v: boolean) => void; repeat?: boolean; newPass?: boolean;
}) {
  return (
    <>
      <label>Contraseña{newPass || repeat ? " (mínimo 8, con letras y números)" : ""}
        <input type={show ? "text" : "password"} autoComplete={newPass || repeat ? "new-password" : "current-password"} value={pass} onChange={(e) => setPass(e.target.value)} maxLength={72} />
      </label>
      {repeat && <label>Repetí la contraseña<input type={show ? "text" : "password"} autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} maxLength={72} /></label>}
      <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />Mostrar contraseña</label>
    </>
  );
}
