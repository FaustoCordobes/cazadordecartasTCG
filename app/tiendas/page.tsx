import type { Metadata } from "next";
import { TiendasClient } from "./TiendasClient.tsx";

export const metadata: Metadata = {
  title: "Tiendas TCG de Argentina con cartas sueltas",
  description: "Directorio de tiendas argentinas que venden singles de Yu-Gi-Oh!, Digimon, Magic, Pokémon y One Piece, con su web, local e Instagram.",
  alternates: { canonical: "/tiendas" },
};

export default function TiendasPage() {
  return <TiendasClient />;
}
