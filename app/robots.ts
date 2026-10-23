import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand.ts";

// /api/ queda fuera: así los buscadores no disparan consultas a las tiendas
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/estado"] }],
    sitemap: `${BRAND.url}/sitemap.xml`,
  };
}
