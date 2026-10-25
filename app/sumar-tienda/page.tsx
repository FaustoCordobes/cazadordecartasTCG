import type { Metadata } from "next";
import { SumarTienda } from "./SumarTienda.tsx";

export const metadata: Metadata = {
  title: "Sumá tu tienda a Cazacartas",
  description: "Tiendas de cartas de Argentina: aparecé gratis en el comparador. Sin comisiones; la gente compra directo en tu web o tu local.",
  alternates: { canonical: "/sumar-tienda" },
};

export default function Page() {
  return <SumarTienda />;
}
