-- =====================================================================
-- 004 · Salas de Casual Online (partidas públicas y privadas)
-- Pegalo completo en Supabase → SQL Editor → New query → Run  (después del 001)
-- =====================================================================

-- 1) Tabla de salas. El anfitrión crea la sala y define las reglas del partido (settings).
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                       -- código corto para entrar a salas privadas (ej: K7QX2)
  name        text not null,
  is_public   boolean not null default true,
  status      text not null default 'waiting' check (status in ('waiting', 'playing', 'closed')),
  host_id     uuid not null references auth.users(id) on delete cascade,
  host_name   text not null,
  guest_id    uuid references auth.users(id) on delete set null,
  guest_name  text,
  settings    jsonb not null default '{}'::jsonb,         -- cancha, dificultad, duración, 24 s, cansancio, cambios
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),         -- el anfitrión lo renueva cada ~30 s (latido): así no quedan salas fantasma en la lista
  constraint room_name_len check (char_length(name) between 1 and 40)
);
create index if not exists rooms_lista_idx on public.rooms (is_public, status, updated_at desc);

-- 2) Seguridad (RLS): se pueden VER las salas públicas en espera y las tuyas.
--    Crear, entrar y salir se hace SOLO con las funciones de abajo (nadie escribe directo en la tabla).
alter table public.rooms enable row level security;
drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select to authenticated
  using ((is_public and status = 'waiting') or host_id = auth.uid() or guest_id = auth.uid());

-- 3) Crear sala (cierra las salas viejas del mismo jugador y limpia las abandonadas)
create or replace function public.create_room(p_name text, p_public boolean, p_settings jsonb)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  uname text;
  new_code text;
  r public.rooms;
  tries int := 0;
begin
  if uid is null then raise exception 'sin_sesion'; end if;
  select username into uname from public.profiles where id = uid;
  if uname is null then raise exception 'sin_perfil'; end if;

  delete from public.rooms where updated_at < now() - interval '6 hours';
  update public.rooms set status = 'closed', updated_at = now() where host_id = uid and status <> 'closed';
  update public.rooms set guest_id = null, guest_name = null, updated_at = now() where guest_id = uid and status <> 'closed';

  loop
    -- sin 0/O/1/I para que el código se lea fácil
    new_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 5));
    begin
      insert into public.rooms (code, name, is_public, host_id, host_name, settings)
      values (new_code, left(trim(coalesce(nullif(p_name, ''), 'Sala de ' || uname)), 40), coalesce(p_public, true), uid, uname, coalesce(p_settings, '{}'::jsonb))
      returning * into r;
      return r;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 8 then raise; end if;
    end;
  end loop;
end $$;

-- 4) Entrar a una sala: por código (públicas y privadas) o por id (las de la lista pública)
create or replace function public.join_room(p_code text default null, p_id uuid default null)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  uname text;
  r public.rooms;
begin
  if uid is null then raise exception 'sin_sesion'; end if;
  select username into uname from public.profiles where id = uid;
  if uname is null then raise exception 'sin_perfil'; end if;

  if p_id is not null then
    select * into r from public.rooms where id = p_id and is_public for update;
  elsif p_code is not null then
    select * into r from public.rooms where code = upper(trim(p_code)) for update;
  end if;

  if r.id is null or r.status = 'closed' then raise exception 'sala_no_existe'; end if;
  if r.host_id = uid then raise exception 'sala_propia'; end if;
  if r.guest_id = uid then return r; end if;                         -- ya estabas adentro (reconexión)
  if r.guest_id is not null or r.status <> 'waiting' then raise exception 'sala_llena'; end if;

  update public.rooms set guest_id = uid, guest_name = uname, updated_at = now() where id = r.id returning * into r;
  return r;
end $$;

-- 5) Salir: si salís vos de invitado, la sala vuelve a quedar libre; si salís de anfitrión, la sala se cierra
create or replace function public.leave_room(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  update public.rooms set status = 'closed', updated_at = now() where id = p_id and host_id = uid;
  update public.rooms set guest_id = null, guest_name = null, status = 'waiting', updated_at = now() where id = p_id and guest_id = uid and status <> 'closed';
end $$;

-- 6) Latido del anfitrión (mantiene viva la sala en la lista)
create or replace function public.touch_room(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.rooms set updated_at = now() where id = p_id and host_id = auth.uid() and status <> 'closed';
$$;

-- 7) El anfitrión pasa la sala a "playing" al empezar (y la vuelve a "waiting" si vuelven a la sala)
create or replace function public.set_room_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('waiting', 'playing') then raise exception 'estado_invalido'; end if;
  update public.rooms set status = p_status, updated_at = now() where id = p_id and host_id = auth.uid() and status <> 'closed';
end $$;

revoke all on function public.create_room(text, boolean, jsonb), public.join_room(text, uuid), public.leave_room(uuid), public.touch_room(uuid), public.set_room_status(uuid, text) from public, anon;
grant execute on function public.create_room(text, boolean, jsonb), public.join_room(text, uuid), public.leave_room(uuid), public.touch_room(uuid), public.set_room_status(uuid, text) to authenticated;

-- 8) Tiempo real: la lista de salas y la sala en la que estás se actualizan solas
do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null; when undefined_object then null;
end $$;
