-- =====================================================================
-- 001 · Perfiles de jugador (cuenta, nivel y XP)
-- Pegalo completo en Supabase → SQL Editor → New query → Run
-- =====================================================================

-- 1) Tabla de perfiles: una fila por jugador, ligada a auth.users
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null,
  level       int  not null default 1,
  xp          int  not null default 0,
  coins       int  not null default 0,          -- para el modo tipo Ultimate Team (todavía sin usar)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- 2) Nivel según XP:  nivel = 1 + floor(sqrt(xp / 50))   →  nivel 2 = 50 XP, nivel 3 = 200, nivel 4 = 450...
create or replace function public.level_for_xp(p_xp int)
returns int language sql immutable as $$
  select floor(sqrt(greatest(p_xp, 0) / 50.0))::int + 1
$$;

-- 3) Al registrarse alguien, se crea su perfil solo (toma el username que manda el juego)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text;
  uname text;
begin
  base := left(regexp_replace(coalesce(new.raw_user_meta_data->>'username', ''), '[^A-Za-z0-9_]', '', 'g'), 20);
  if length(base) < 3 then
    base := 'jugador' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  uname := base;
  begin
    insert into public.profiles (id, username) values (new.id, uname);
  exception when unique_violation then
    uname := left(base, 15) || '_' || substr(md5(random()::text), 1, 4);
    insert into public.profiles (id, username) values (new.id, uname);
  end;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 5) Seguridad (RLS): los jugadores logueados ven los perfiles (para listas/online más adelante),
--    pero cada uno solo puede cambiar SU username. Nivel, XP y monedas solo cambian por funciones del servidor.
alter table public.profiles enable row level security;

drop policy if exists "perfiles visibles para logueados" on public.profiles;
create policy "perfiles visibles para logueados"
  on public.profiles for select to authenticated using (true);

drop policy if exists "cada uno edita su perfil" on public.profiles;
create policy "cada uno edita su perfil"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

revoke update on public.profiles from authenticated, anon;
grant  update (username) on public.profiles to authenticated;

-- 6) ¿Está libre el nombre? (se puede llamar antes de registrarse)
create or replace function public.username_disponible(p_username text)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(p_username))
$$;
grant execute on function public.username_disponible(text) to anon, authenticated;

-- 7) Sumar XP (lo llama el juego). Máx. 300 por llamada.
--    OJO: mientras el juego corre en el navegador, el cliente "dice" cuánta XP ganó, así que esto no es anti-trampas.
--    Cuando hagamos el online, la XP se va a validar desde el servidor.
create or replace function public.add_xp(p_amount int)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare r public.profiles;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 300 then raise exception 'cantidad inválida'; end if;
  update public.profiles
     set xp = xp + p_amount,
         level = public.level_for_xp(xp + p_amount)
   where id = auth.uid()
   returning * into r;
  return r;
end $$;
revoke all on function public.add_xp(int) from public, anon;
grant execute on function public.add_xp(int) to authenticated;
