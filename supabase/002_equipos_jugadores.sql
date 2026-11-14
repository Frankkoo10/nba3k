-- =====================================================================
-- 002 · Equipos y jugadores (titulares y suplentes)
-- Pegalo completo en Supabase → SQL Editor → New query → Run.
-- Es seguro correrlo más de una vez (no duplica ni pisa lo que ya cargaste).
--
-- Después cargás los jugadores desde Table Editor → players → Insert row
-- (o con INSERT, ver los ejemplos al final). El juego los lee solo al elegir equipo.
-- =====================================================================

-- 1) Equipos (los 30 de la NBA, con las mismas abreviaturas que usa el juego)
create table if not exists public.teams (
  ab          text primary key,                 -- 'LAL', 'BOS'...
  name        text not null,
  color1      text,
  color2      text
);

insert into public.teams (ab, name, color1, color2) values
  ('ATL','Atlanta Hawks','#E03A3E','#C1D32F'),       ('BOS','Boston Celtics','#007A33','#FFFFFF'),
  ('BKN','Brooklyn Nets','#111111','#FFFFFF'),       ('CHA','Charlotte Hornets','#00788C','#1D1160'),
  ('CHI','Chicago Bulls','#CE1141','#111111'),       ('CLE','Cleveland Cavaliers','#860038','#FDBB30'),
  ('DAL','Dallas Mavericks','#00538C','#B8C4CA'),    ('DEN','Denver Nuggets','#0E2240','#FEC524'),
  ('DET','Detroit Pistons','#C8102E','#1D42BA'),     ('GSW','Golden State Warriors','#1D428A','#FFC72C'),
  ('HOU','Houston Rockets','#CE1141','#C4CED4'),     ('IND','Indiana Pacers','#002D62','#FDBB30'),
  ('LAC','LA Clippers','#C8102E','#1D428A'),         ('LAL','Los Angeles Lakers','#552583','#FDB927'),
  ('MEM','Memphis Grizzlies','#5D76A9','#12173F'),   ('MIA','Miami Heat','#98002E','#F9A01B'),
  ('MIL','Milwaukee Bucks','#00471B','#EEE1C6'),     ('MIN','Minnesota Timberwolves','#236192','#0C2340'),
  ('NOP','New Orleans Pelicans','#0C2340','#C8102E'),('NYK','New York Knicks','#006BB6','#F58426'),
  ('OKC','Oklahoma City Thunder','#007AC1','#EF3B24'),('ORL','Orlando Magic','#0077C0','#C4CED4'),
  ('PHI','Philadelphia 76ers','#006BB6','#ED174C'),  ('PHX','Phoenix Suns','#1D1160','#E56020'),
  ('POR','Portland Trail Blazers','#E03A3E','#111111'),('SAC','Sacramento Kings','#5A2D81','#63727A'),
  ('SAS','San Antonio Spurs','#C4CED4','#111111'),   ('TOR','Toronto Raptors','#CE1141','#111111'),
  ('UTA','Utah Jazz','#002B5C','#F9A01B'),           ('WAS','Washington Wizards','#002B5C','#E31837')
on conflict (ab) do nothing;

-- 2) Jugadores
create table if not exists public.players (
  id          bigint generated always as identity primary key,
  team_ab     text not null references public.teams(ab) on update cascade on delete cascade,
  name        text not null,
  number      int  not null default 0 check (number between 0 and 99),
  position    text not null default 'SF' check (position in ('PG','SG','SF','PF','C')),
  -- PG armador · SG escolta · SF alero · PF ala-pívot · C pívot
  is_starter  boolean not null default false,   -- true = titular, false = suplente
  sort_order  int  not null default 0,          -- para ordenar suplentes (menor = entra primero)
  -- Ratings 30–99 (si los dejás vacíos el juego usa "ovr" para todos)
  ovr         int  not null default 72 check (ovr between 40 and 99),
  shooting    int  check (shooting between 30 and 99),   -- tiro
  passing     int  check (passing  between 30 and 99),   -- pase y manejo
  defense     int  check (defense  between 30 and 99),   -- defensa, robos y tapones
  speed       int  check (speed    between 30 and 99),   -- velocidad
  rebound     int  check (rebound  between 30 and 99),   -- rebote
  height_cm   int  check (height_cm between 170 and 230),
  skin_tone   int  not null default 2 check (skin_tone between 0 and 5),   -- 0 muy claro … 5 muy oscuro
  active      boolean not null default true,    -- desmarcalo para "sacar" a alguien sin borrarlo
  created_at  timestamptz not null default now()
);
create index if not exists players_team_idx on public.players (team_ab, active);

-- Un solo "titular" por posición en cada equipo (así nunca hay 2 bases titulares)
create unique index if not exists players_one_starter_per_pos
  on public.players (team_ab, position) where is_starter and active;

-- 3) Seguridad (RLS): cualquiera puede LEER (el juego también anda sin cuenta),
--    pero nadie puede escribir desde el juego. Vos cargás desde el panel de Supabase
--    (Table Editor / SQL Editor), que usa el rol del proyecto y no pasa por estas reglas.
alter table public.teams   enable row level security;
alter table public.players enable row level security;

drop policy if exists "equipos visibles" on public.teams;
create policy "equipos visibles" on public.teams for select to anon, authenticated using (true);
drop policy if exists "jugadores visibles" on public.players;
create policy "jugadores visibles" on public.players for select to anon, authenticated using (true);

revoke insert, update, delete on public.teams, public.players from anon, authenticated;
grant  select on public.teams, public.players to anon, authenticated;

-- 4) Vista cómoda para mirar un plantel armado (titulares primero)
create or replace view public.plantel as
  select team_ab, case when is_starter then 'TITULAR' else 'SUPLENTE' end as rol,
         number, name, position, ovr, shooting, passing, defense, speed, rebound, height_cm
    from public.players where active
   order by team_ab, is_starter desc, sort_order, ovr desc;
grant select on public.plantel to anon, authenticated;

-- =====================================================================
-- EJEMPLOS (copiá, cambiá los datos y ejecutá; o cargalos desde Table Editor)
-- Si un equipo tiene menos de 5 titulares, el juego completa con jugadores genéricos.
--
-- insert into public.players (team_ab, name, number, position, is_starter, ovr, shooting, passing, defense, speed, rebound, height_cm, skin_tone) values
--   ('LAL', 'Nombre Armador', 1, 'PG', true,  85, 84, 88, 70, 86, 55, 188, 3),
--   ('LAL', 'Nombre Escolta', 2, 'SG', true,  82, 86, 72, 74, 82, 50, 196, 2),
--   ('LAL', 'Nombre Alero',   3, 'SF', true,  88, 82, 78, 80, 80, 66, 203, 4),
--   ('LAL', 'Nombre Ala-pívot',4,'PF', true,  80, 70, 66, 82, 70, 84, 208, 3),
--   ('LAL', 'Nombre Pívot',   5, 'C',  true,  86, 62, 60, 90, 62, 92, 213, 4),
--   ('LAL', 'Suplente Base',  11,'PG', false, 74, 72, 76, 66, 80, 50, 185, 2),
--   ('LAL', 'Suplente Pívot', 15,'C',  false, 72, 55, 52, 78, 58, 82, 211, 1);
--
-- Cambiar un titular:   update public.players set is_starter = false where id = 12;
-- Sacar a alguien:      update public.players set active = false where id = 12;
-- Ver un plantel:       select * from public.plantel where team_ab = 'LAL';
-- =====================================================================
