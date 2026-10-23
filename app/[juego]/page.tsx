import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { App } from "../components/App.tsx";
import { GAME_IDS, GAMES } from "@/lib/games.ts";
import { GAME_SEO, gameFromParam } from "@/lib/seo.ts";

export const dynamicParams = false;
export function generateStaticParams() {
  return GAME_IDS.map((g) => ({ juego: GAMES[g].param }));
}

export async function generateMetadata({ params }: { params: Promise<{ juego: string }> }): Promise<Metadata> {
  const g = gameFromParam((await params).juego);
  if (!g) return {};
  return {
    title: GAME_SEO[g].title,
    description: GAME_SEO[g].description,
    alternates: { canonical: `/${GAMES[g].param}` },
    openGraph: { title: GAME_SEO[g].title, description: GAME_SEO[g].description, images: ["/og.png"] },
  };
}

export default async function GamePage({ params }: { params: Promise<{ juego: string }> }) {
  const g = gameFromParam((await params).juego);
  if (!g) notFound();
  return <App initialGame={g} intro={<p className="seo-intro">{GAME_SEO[g].intro}</p>} />;
}
