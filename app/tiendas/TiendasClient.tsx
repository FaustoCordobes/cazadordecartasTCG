"use client";

import { useState } from "react";
import { StoreDirectory } from "../components/StoreDirectory.tsx";
import { ReportDialog, type ReportContext } from "../components/ReportDialog.tsx";
import { BRAND } from "@/lib/brand.ts";

export function TiendasClient() {
  const [report, setReport] = useState<ReportContext | null>(null);
  return (
    <div className="app" data-game="digi">
      <div className="wrap">
        <header className="top">
          <a className="brand" href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="logo" aria-hidden="true" />
            <div><h1>{BRAND.name}</h1><p>Volver al buscador</p></div>
          </a>
        </header>
        <StoreDirectory game="digi" startAll onReport={setReport} />
        <ReportDialog ctx={report} onClose={() => setReport(null)} />
      </div>
    </div>
  );
}
