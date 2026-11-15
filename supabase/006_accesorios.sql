-- =====================================================================
-- 006 · Accesorios de los jugadores: muñequeras y rodilleras (v35)
-- Pegalo completo en Supabase → SQL Editor → New query → Run.
-- Es seguro correrlo más de una vez. Necesita haber corrido antes el 002 y el 005.
--
--   wrist_band  : 'L' muñequera izquierda · 'R' derecha · 'B' ambas;   wrist_color : '#rrggbb'
--   knee_sleeve : 'L' rodillera izquierda · 'R' derecha · 'B' ambas;    knee_color  : '#rrggbb'
--   (la manga del antebrazo sigue siendo arm_sleeve / sleeve_color del 005)
-- Todo es opcional: lo que dejes vacío lo completa la tabla de looks.js.
-- =====================================================================
alter table public.players add column if not exists wrist_band  text check (wrist_band  in ('L','R','B'));
alter table public.players add column if not exists wrist_color text;
alter table public.players add column if not exists knee_sleeve text check (knee_sleeve in ('L','R','B'));
alter table public.players add column if not exists knee_color  text;

-- Ejemplos (descomentá y cambiá):
-- update public.players set arm_sleeve = 'L', sleeve_color = '#ffffff' where name ilike 'Jaylen Brown';
-- update public.players set knee_sleeve = 'L', knee_color = '#111111' where name ilike 'Joel Embiid';
