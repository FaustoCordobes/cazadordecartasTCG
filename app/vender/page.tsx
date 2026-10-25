import type { Metadata } from "next";
import { VenderClient } from "./VenderClient.tsx";

export const metadata: Metadata = {
  title: "Vender tus cartas: cuánto valen y qué tiendas compran",
  description: "Calculá cuánto se venden tus cartas en tiendas de Argentina y su precio de referencia internacional, y encontrá tiendas que compran cartas.",
  alternates: { canonical: "/vender" },
};

export default function Page() {
  return <VenderClient />;
}
