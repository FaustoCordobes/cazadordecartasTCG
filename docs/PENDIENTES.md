# Pendientes, riesgos y propuestas (23/10/2026)

## Lo que quedó fuera a propósito
- **Cuentas**: hechas (v13) con mail y contraseña, sin confirmación. Pendiente: verificación opcional del mail más adelante, ingreso con Google, y CAPTCHA si aparecen cuentas de bots.
- **Avisos con la app cerrada (email, push, Telegram)**: necesitan cuentas o suscripciones con doble opt-in y un proceso programado. Hoy las alertas se revisan al tocar "Actualizar precios". Propuesta: Web Push (gratis, sin email) + cron diario en GitHub Actions que revise solo las cartas con alerta, guardando la suscripción en Supabase con link de baja.
- **Panel para tiendas / feed oficial de stock**: propuesta más simple → una tienda nos manda la URL de un CSV o de su feed de Google Merchant (columnas: título, precio, stock, url, juego) y el indexador lo lee una vez por día como una plataforma más (`platform: "feed"`). Se suma sin login: la tienda pide el alta por el formulario. No se implementó todavía porque ninguna tienda lo pidió.
- **Newsletter / canal**, **testimonios**, **calendario de torneos**, **"busco esta carta"**: dependen de comunidad y moderación; no hay datos reales todavía.
- **Oportunidades (precio por debajo del promedio)**: se puede hacer cuando el historial tenga algunas semanas de datos. Sin eso sería inventar.

## Mercado Libre como precio de referencia (evaluación, sin implementar)
- A favor: tiene mucha oferta de singles y API oficial (`api.mercadolibre.com/sites/MLA/search`).
- En contra: desde 2024 la búsqueda pública pide token OAuth de una app registrada; los títulos son muy desordenados (lotes, proxies, cartas falsas); no es una tienda TCG y mezclaría "precio de particular" con "precio de tienda", lo que confunde y puede molestar a las tiendas que la app quiere ayudar.
- Recomendación: no sumarlo a la comparación; como mucho, un link "ver en Mercado Libre" en el estado vacío.

## Marca
- La app se llama **Cazacartas** y el dominio es `cazadordecartas-tcg.vercel.app`. Recomendación: quedarse con "Cazacartas" (corto y fácil de decir) y, cuando se pueda, comprar un dominio propio (por ejemplo cazacartas.com.ar, si está libre) y ponerlo en `NEXT_PUBLIC_SITE_URL`. El nombre y los datos de contacto están en `lib/brand.ts`.

## Riesgos
- Si una tienda cambia su web, su lector puede romperse: lo muestra `/estado` (indexadas) y "temporalmente no disponible" en cada búsqueda (en vivo).
- Las bases de cartas externas (Scryfall, pokemontcg.io, optcgapi.com, YGOPRODeck, digimoncard.io) pueden tardar o caerse: la búsqueda sigue, solo sin ficha.
- El historial solo tiene datos de las cartas que alguien buscó y de los días en que se buscaron.
- `next/image` no se usa a propósito: las imágenes vienen de muchos dominios y el plan gratis de Vercel limita las optimizaciones. Se usan `<img loading="lazy">` con tamaño fijo.

## Decisiones
- Sin dependencias nuevas.
- Analítica propia en Supabase, solo contadores diarios (sin cookies, sin IP).
- Las páginas por carta se indexan en buscadores solo si la carta tuvo búsquedas con resultados en el último mes; `/api/` está bloqueado en robots.txt para que los buscadores no generen consultas a las tiendas.
