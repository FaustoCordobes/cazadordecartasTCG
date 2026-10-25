import type { Metadata } from "next";
import { CuentaClient } from "./CuentaClient.tsx";

export const metadata: Metadata = { title: "Tu cuenta", robots: { index: false, follow: false } };

export default function Page() {
  return <CuentaClient />;
}
