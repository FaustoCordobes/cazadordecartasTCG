import type { Metadata } from "next";
import { OfertasClient } from "./OfertasClient.tsx";

export const metadata: Metadata = {
  title: "Ofertas y precios que se movieron esta semana",
  description: "Cartas sueltas que tiendas de Argentina venden por debajo del precio de referencia de TCGplayer, y las cartas que más subieron y bajaron en la semana.",
  alternates: { canonical: "/ofertas" },
};

export default function OfertasPage() {
  return <OfertasClient />;
}
