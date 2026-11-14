-- =====================================================================
-- 003 · Atributos estilo NBA 2K26, altura en pulgadas y peso en libras
-- Pegalo completo en Supabase → SQL Editor → New query → Run.
-- Es seguro correrlo más de una vez. Necesita haber corrido antes el 002.
--
-- Todos los atributos van de 25 a 99 (como en 2K). Si dejás alguno vacío,
-- el juego lo estima a partir de "ovr" y la posición del jugador.
-- =====================================================================

-- 1) Medidas físicas (como las muestra 2K: altura en pulgadas, peso en libras)
alter table public.players add column if not exists height_in   int check (height_in   between 67 and 90);   -- 74 = 6'2"
alter table public.players add column if not exists weight_lb   int check (weight_lb   between 130 and 340);
alter table public.players add column if not exists wingspan_in int check (wingspan_in between 67 and 100);  -- envergadura

-- 2) Atributos (mismos nombres que 2K)
-- Tiro
alter table public.players add column if not exists close_shot      int check (close_shot      between 25 and 99);  -- tiro cercano
alter table public.players add column if not exists mid_range       int check (mid_range       between 25 and 99);  -- tiro de media distancia
alter table public.players add column if not exists three_point     int check (three_point     between 25 and 99);  -- triple
alter table public.players add column if not exists free_throw      int check (free_throw      between 25 and 99);  -- tiros libres
-- Definición
alter table public.players add column if not exists driving_layup   int check (driving_layup   between 25 and 99);  -- bandeja
alter table public.players add column if not exists driving_dunk    int check (driving_dunk    between 25 and 99);  -- mate en movimiento
alter table public.players add column if not exists standing_dunk   int check (standing_dunk   between 25 and 99);  -- mate parado
alter table public.players add column if not exists post_control    int check (post_control    between 25 and 99);  -- juego de poste
-- Creación de juego
alter table public.players add column if not exists pass_accuracy   int check (pass_accuracy   between 25 and 99);
alter table public.players add column if not exists ball_handle     int check (ball_handle     between 25 and 99);  -- manejo de balón
alter table public.players add column if not exists speed_with_ball int check (speed_with_ball between 25 and 99);
-- Defensa
alter table public.players add column if not exists interior_def    int check (interior_def    between 25 and 99);
alter table public.players add column if not exists perimeter_def   int check (perimeter_def   between 25 and 99);
alter table public.players add column if not exists steal           int check (steal           between 25 and 99);  -- robos
alter table public.players add column if not exists block           int check (block           between 25 and 99);  -- tapones
-- Rebote
alter table public.players add column if not exists off_rebound     int check (off_rebound     between 25 and 99);
alter table public.players add column if not exists def_rebound     int check (def_rebound     between 25 and 99);
-- Físico  ("speed" ya existía del 002: ahora también va de 25 a 99)
alter table public.players add column if not exists strength        int check (strength        between 25 and 99);  -- fuerza
alter table public.players add column if not exists vertical        int check (vertical        between 25 and 99);  -- salto
alter table public.players add column if not exists stamina         int check (stamina         between 25 and 99);  -- resistencia

-- 3) Si cargás la altura en pulgadas, height_cm se calcula solo (el juego usa los dos)
create or replace function public.sync_height_cm() returns trigger language plpgsql as $$
begin
  if new.height_in is not null then
    new.height_cm := round(new.height_in * 2.54);
  end if;
  return new;
end $$;

drop trigger if exists players_sync_height on public.players;
create trigger players_sync_height before insert or update of height_in on public.players
  for each row execute function public.sync_height_cm();

-- 4) Vistas cómodas
-- Plantel con todo (titulares primero). Se agregan columnas al final para no romper la vista anterior.
create or replace view public.plantel as
  select team_ab, case when is_starter then 'TITULAR' else 'SUPLENTE' end as rol,
         number, name, position, ovr, shooting, passing, defense, speed, rebound, height_cm,
         height_in, (height_in / 12) || '''' || (height_in % 12) || '"' as altura, weight_lb, wingspan_in,
         close_shot, mid_range, three_point, free_throw, driving_layup, driving_dunk, standing_dunk, post_control,
         pass_accuracy, ball_handle, speed_with_ball, interior_def, perimeter_def, steal, block,
         off_rebound, def_rebound, strength, vertical, stamina
    from public.players where active
   order by team_ab, is_starter desc, sort_order, ovr desc;
grant select on public.plantel to anon, authenticated;

-- Promedios por equipo (solo titulares): para ver qué equipo es mejor en cada cosa
create or replace view public.equipos_resumen as
  select t.ab, t.name,
         count(p.*)                           as titulares,
         round(avg(p.ovr))                    as ovr,
         round(avg(p.three_point))            as triple,
         round(avg(p.mid_range))              as media,
         round(avg(p.ball_handle))            as manejo,
         round(avg(p.perimeter_def))          as def_perimetral,
         round(avg(p.interior_def))           as def_interior,
         round(avg(p.steal))                  as robos,
         round(avg(p.block))                  as tapones,
         round(avg((p.off_rebound + p.def_rebound) / 2.0)) as rebote,
         round(avg(p.height_in), 1)           as altura_prom_in,
         round(avg(p.weight_lb))              as peso_prom_lb
    from public.teams t
    left join public.players p on p.team_ab = t.ab and p.active and p.is_starter
   group by t.ab, t.name
   order by ovr desc nulls last;
grant select on public.equipos_resumen to anon, authenticated;

-- =====================================================================
-- EJEMPLO (inventado, cambiá los datos): un jugador con todo cargado.
--
-- insert into public.players
--   (team_ab, name, number, position, is_starter, ovr, height_in, weight_lb, wingspan_in, skin_tone,
--    close_shot, mid_range, three_point, free_throw, driving_layup, driving_dunk, standing_dunk, post_control,
--    pass_accuracy, ball_handle, speed_with_ball, interior_def, perimeter_def, steal, block,
--    off_rebound, def_rebound, speed, strength, vertical, stamina)
-- values
--   ('GSW', 'Nombre Armador', 30, 'PG', true, 90, 74, 185, 79, 2,
--    74, 89, 99, 92, 85, 40, 28, 30,
--    85, 92, 88, 30, 72, 75, 30,
--    28, 45, 84, 45, 55, 85);
--
-- Cambiar un atributo:  update public.players set three_point = 95 where id = 12;
-- Ver un plantel:       select * from public.plantel where team_ab = 'GSW';
-- Ranking de equipos:   select * from public.equipos_resumen;
-- =====================================================================
