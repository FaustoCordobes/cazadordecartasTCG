-- Catálogo de las tiendas indexadas (Tiendanube, PrestaShop y WooCommerce sin API).
-- Pegalo en Supabase → SQL Editor → Run.

create table if not exists catalogo (
  id            bigserial primary key,
  store_id      text        not null,
  game          text        not null check (game in ('ygo', 'digi')),
  title         text        not null,
  title_norm    text        not null,  -- título en minúsculas y sin acentos, para buscar
  url           text        not null,
  price         numeric     not null,
  compare_price numeric,
  available     boolean,
  stock         integer,
  image         text,
  indexed_at    timestamptz not null default now()
);

create index if not exists catalogo_busqueda on catalogo (game, store_id);
create extension if not exists pg_trgm;
create index if not exists catalogo_titulo on catalogo using gin (title_norm gin_trgm_ops);

-- Última vez que se indexó cada tienda, y el error si falló
create table if not exists indice_tiendas (
  store_id   text not null,
  game       text not null,
  indexed_at timestamptz not null,
  count      integer not null default 0,
  error      text,
  primary key (store_id, game)
);

-- La app usa la service key solo del lado del servidor; nadie más necesita acceso.
alter table catalogo enable row level security;
alter table indice_tiendas enable row level security;
