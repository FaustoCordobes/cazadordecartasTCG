import type { Metadata } from "next";
import { CalculadoraClient } from "./CalculadoraClient.tsx";

export const metadata: Metadata = {
  title: "Calculadora de precios de cartas en dólares y pesos",
  description: "Armá una lista de cartas y mirá su precio en TCGplayer y Cardmarket, en dólares o en pesos argentinos al dólar del día.",
  alternates: { canonical: "/calculadora" },
};

export default function Page() {
  return <CalculadoraClient />;
}
