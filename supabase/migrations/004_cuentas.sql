-- Cazacartas · migración 004 (25/10/2026): cuentas de usuario (mail + contraseña).
-- Pegala en Supabase → SQL Editor → Run. Se puede correr más de una vez.
--
-- Las cuentas las maneja Supabase Auth. Acá solo se guarda lo que la persona quiere tener en su cuenta:
-- sus listas ("Mi lista") y sus ajustes (opciones del plan, envíos por tienda, provincia).
-- Cada persona ve y cambia SOLO su fila (Row Level Security). Si borra la cuenta, se borra todo.

create table if not exists cuentas_datos (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  listas      jsonb       not null default '{}'::jsonb,
  ajustes     jsonb       not null default '{}'::jsonb,
  actualizado timestamptz not null default now(),
  -- límite de tamaño para que nadie use la base como depósito
  constraint cuentas_datos_tamano check (pg_column_size(listas) + pg_column_size(ajustes) < 500000)
);

alter table cuentas_datos enable row level security;

drop policy if exists "cuenta: leer la propia" on cuentas_datos;
drop policy if exists "cuenta: crear la propia" on cuentas_datos;
drop policy if exists "cuenta: cambiar la propia" on cuentas_datos;
drop policy if exists "cuenta: borrar la propia" on cuentas_datos;
create policy "cuenta: leer la propia"    on cuentas_datos for select to authenticated using ((select auth.uid()) = user_id);
create policy "cuenta: crear la propia"   on cuentas_datos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cuenta: cambiar la propia" on cuentas_datos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cuenta: borrar la propia"  on cuentas_datos for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on cuentas_datos to authenticated;
revoke all on cuentas_datos from anon;
