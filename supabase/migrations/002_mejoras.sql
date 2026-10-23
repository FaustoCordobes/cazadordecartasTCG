-- Cazacartas · migración 002 (23/10/2026)
-- Pegala en Supabase → SQL Editor → Run. Se puede correr más de una vez sin romper nada.

-- 1) El catálogo ahora guarda los 5 juegos (antes solo aceptaba ygo y digi)
alter table catalogo drop constraint if exists catalogo_game_check;
alter table catalogo add constraint catalogo_game_check check (game in ('ygo', 'digi', 'mtg', 'pkm', 'op'));

-- 2) Historial de precios: el precio más bajo de cada versión de carta por tienda y por día.
--    Se guarda solo lo que la app ve en las búsquedas reales; no se inventan puntos.
create table if not exists historial_precios (
  dia        date    not null,
  game       text    not null,
  card_key   text    not null,
  card_name  text    not null,
  store_id   text    not null,
  precio     numeric not null,
  stock      integer,
  primary key (dia, game, card_key, store_id)
);
create index if not exists historial_carta on historial_precios (game, card_key, dia);

-- 3) Reportes y formularios (precio incorrecto, link roto, sugerir/corregir/eliminar tienda, contacto).
--    No se guarda IP ni datos del navegador. El email es opcional y solo si la persona lo deja para que le respondan.
create table if not exists reportes (
  id         bigserial primary key,
  creado     timestamptz not null default now(),
  tipo       text not null,
  game       text,
  carta      text,
  store_id   text,
  url        text,
  comentario text,
  email      text,
  estado     text not null default 'nuevo'
);

-- 4) Analítica sin cookies: solo contadores por día. Sin IP, sin usuario, sin identificadores.
create table if not exists busquedas_dia (
  dia        date    not null,
  game       text    not null,
  consulta   text    not null,   -- nombre de la carta reconocida o lo que se escribió (normalizado)
  veces      integer not null default 1,
  sin_result integer not null default 0,
  primary key (dia, game, consulta)
);
create table if not exists clicks_dia (
  dia      date    not null,
  game     text    not null,
  store_id text    not null,
  veces    integer not null default 1,
  primary key (dia, game, store_id)
);

-- Suma contadores de forma atómica (la app llama a estas funciones)
create or replace function sumar_busqueda(p_game text, p_consulta text, p_sin boolean)
returns void language sql as $$
  insert into busquedas_dia (dia, game, consulta, veces, sin_result)
  values ((now() at time zone 'America/Argentina/Buenos_Aires')::date, p_game, p_consulta, 1, case when p_sin then 1 else 0 end)
  on conflict (dia, game, consulta) do update
    set veces = busquedas_dia.veces + 1,
        sin_result = busquedas_dia.sin_result + excluded.sin_result;
$$;

create or replace function sumar_click(p_game text, p_store text)
returns void language sql as $$
  insert into clicks_dia (dia, game, store_id, veces)
  values ((now() at time zone 'America/Argentina/Buenos_Aires')::date, p_game, p_store, 1)
  on conflict (dia, game, store_id) do update set veces = clicks_dia.veces + 1;
$$;

alter table historial_precios enable row level security;
alter table reportes enable row level security;
alter table busquedas_dia enable row level security;
alter table clicks_dia enable row level security;
