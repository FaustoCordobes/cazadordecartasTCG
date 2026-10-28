-- Cazacartas · migración 003 (25/10/2026): ofertas, subas y bajas, y avisos al celular.
-- Pegala en Supabase → SQL Editor → Run. Se puede correr más de una vez sin romper nada.
-- (Antes tiene que estar corrida la 002.)

-- 1) Ofertas: publicaciones que la app vio por debajo del precio de referencia de TCGplayer.
--    Se guardan solo desde búsquedas reales; la página muestra las de los últimos días con la fecha.
create table if not exists ofertas (
  game       text        not null,
  card_key   text        not null,
  store_id   text        not null,
  card_name  text        not null,
  code       text,
  rarity     text,
  version    text,
  store_name text        not null,
  url        text        not null,
  precio     numeric     not null,
  ref_usd    numeric     not null,
  dolar      numeric     not null,
  descuento  numeric     not null,   -- % por debajo de la referencia pasada a pesos
  imagen     text,
  visto      timestamptz not null default now(),
  primary key (game, card_key, store_id)
);
create index if not exists ofertas_visto on ofertas (game, visto desc);

-- 2) Subas y bajas: compara, en cada tienda, el último precio de los últimos p_dias con el último
--    precio de los 30 días anteriores. Solo cuenta tiendas que tienen precio en los dos períodos.
create or replace function movimientos(p_game text, p_dias int default 7)
returns table (card_key text, card_name text, antes numeric, ahora numeric, tiendas bigint)
language sql stable as $$
  with ult as (
    select distinct on (card_key, store_id) card_key, store_id, card_name, precio
    from historial_precios
    where game = p_game and dia >= current_date - p_dias
    order by card_key, store_id, dia desc
  ), prev as (
    select distinct on (card_key, store_id) card_key, store_id, precio
    from historial_precios
    where game = p_game and dia < current_date - p_dias and dia >= current_date - p_dias - 30
    order by card_key, store_id, dia desc
  )
  select u.card_key, max(u.card_name), min(p.precio), min(u.precio), count(*)
  from ult u join prev p using (card_key, store_id)
  group by u.card_key
$$;

-- 3) Avisos al celular (notificaciones push), sin cuentas.
--    Se guarda solo la "dirección" anónima de notificaciones que da el navegador y las cartas a vigilar.
create table if not exists avisos_push (
  id        uuid primary key default gen_random_uuid(),
  endpoint  text unique not null,
  p256dh    text not null,
  auth      text not null,
  creado    timestamptz not null default now()
);
create table if not exists avisos_cartas (
  push_id       uuid not null references avisos_push(id) on delete cascade,
  game          text not null,
  carta         text not null,          -- nombre o código a buscar
  card_key      text not null default '',  -- versión elegida ('' = cualquiera)
  precio_max    numeric,                -- avisar si baja a este precio o menos (null = cuando vuelva a haber stock)
  ultimo_precio numeric,
  ultimo_aviso  timestamptz,
  primary key (push_id, game, carta, card_key)
);

alter table ofertas enable row level security;
alter table avisos_push enable row level security;
alter table avisos_cartas enable row level security;

-- Permisos para la clave de servidor (proyectos nuevos de Supabase no los dan solos)
grant usage on schema public to service_role;
grant select, insert, update, delete on historial_precios, reportes, busquedas_dia, clicks_dia, ofertas, avisos_push, avisos_cartas to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function movimientos(text, int), sumar_busqueda(text, text, boolean), sumar_click(text, text) to service_role;
notify pgrst, 'reload schema';
