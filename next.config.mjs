import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // La raíz del proyecto es esta carpeta, aunque haya otro package-lock.json más arriba
  outputFileTracingRoot: here,
  // Permite abrir la app desde el celular en la misma red WiFi
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
