-- =====================================================================
-- 005 · Aspecto de los jugadores: pelo, barba, vincha y manga
-- Pegalo completo en Supabase → SQL Editor → New query → Run.
-- Es seguro correrlo más de una vez. Necesita haber corrido antes el 002.
--
-- Todo es opcional: si dejás una columna vacía el juego usa su tabla interna de
-- jugadores conocidos (looks.js) y, si el jugador no está ahí, lo estima desde el nombre.
--
--   hair_style : 0 pelado · 1 corto · 2 rapado/fade · 3 afro · 4 high top · 5 trenzas · 6 rodete · 7 cola/pelo largo atado · 8 rizos largos · 9 corto-medio · 10 rizado medio
--   hair_color : '#rrggbb' (ej. '#15120f' negro, '#d8c27a' rubio teñido)
--   beard      : 0 sin barba · 1 barba corta · 2 barba tupida
--   headband   : color de la vincha '#rrggbb' (null = sin vincha)
--   arm_sleeve : 'L' brazo izquierdo · 'R' derecho · 'B' ambos (manga de compresión); sleeve_color: '#rrggbb'
--   skin_tone  : (ya existía) 0 muy claro · 1 trigueño · 2 marrón claro · 3 marrón · 4 oscuro · 5 muy oscuro
-- La altura (height_in) y el peso (weight_lb) del 003 definen el tamaño y la contextura.
-- =====================================================================

alter table public.players add column if not exists hair_style  int  check (hair_style between 0 and 10);
-- (si ya habías corrido una versión anterior de este archivo, esto amplía el rango a 0–10)
alter table public.players drop constraint if exists players_hair_style_check;
alter table public.players add constraint players_hair_style_check check (hair_style between 0 and 10);
alter table public.players add column if not exists hair_color  text;
alter table public.players add column if not exists beard       int  check (beard between 0 and 2);
alter table public.players add column if not exists headband    text;
alter table public.players add column if not exists arm_sleeve  text check (arm_sleeve in ('L','R','B'));
alter table public.players add column if not exists sleeve_color text;

-- Jugadores conocidos (se buscan por nombre, sin importar mayúsculas; si en tu base el nombre se escribe distinto,
-- el juego igual los reconoce por su tabla interna). Cambiá lo que quieras: lo que cargues acá manda sobre el juego.
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = '#111111' where name ilike 'LeBron James';
update public.players set skin_tone = 2, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Stephen Curry';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Kevin Durant';
update public.players set skin_tone = 5, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Giannis Antetokounmpo';
update public.players set skin_tone = 0, hair_style = 7, hair_color = '#2b1d14', beard = 2, headband = null where name ilike 'Nikola Jokic';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#2b1d14', beard = 2, headband = null where name ilike 'Luka Doncic';
update public.players set skin_tone = 4, hair_style = 2, hair_color = '#15120f', beard = 2, headband = null where name ilike 'Joel Embiid';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Jayson Tatum';
update public.players set skin_tone = 4, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Jaylen Brown';
update public.players set skin_tone = 4, hair_style = 5, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Shai Gilgeous-Alexander';
update public.players set skin_tone = 4, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Anthony Edwards';
update public.players set skin_tone = 4, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Victor Wembanyama';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Ja Morant';
update public.players set skin_tone = 2, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Devin Booker';
update public.players set skin_tone = 4, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Kawhi Leonard';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Paul George';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Damian Lillard';
update public.players set skin_tone = 2, hair_style = 10, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Kyrie Irving';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 2, headband = null where name ilike 'James Harden';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Jimmy Butler';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Bam Adebayo';
update public.players set skin_tone = 2, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Trae Young';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Donovan Mitchell';
update public.players set skin_tone = 2, hair_style = 10, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Tyrese Haliburton';
update public.players set skin_tone = 2, hair_style = 8, hair_color = '#d8c27a', beard = 1, headband = null where name ilike 'LaMelo Ball';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Zion Williamson';
update public.players set skin_tone = 2, hair_style = 1, hair_color = '#15120f', beard = 2, headband = null where name ilike 'Karl-Anthony Towns';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Rudy Gobert';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Anthony Davis';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Draymond Green';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Jrue Holiday';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Chris Paul';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 2, headband = null where name ilike 'Russell Westbrook';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Bradley Beal';
update public.players set skin_tone = 2, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Jalen Brunson';
update public.players set skin_tone = 3, hair_style = 10, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Tyrese Maxey';
update public.players set skin_tone = 3, hair_style = 0, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Kyle Lowry';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 2, headband = null where name ilike 'Julius Randle';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Khris Middleton';
update public.players set skin_tone = 5, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Pascal Siakam';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Mikal Bridges';
update public.players set skin_tone = 4, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'OG Anunoby';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Josh Hart';
update public.players set skin_tone = 2, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Aaron Gordon';
update public.players set skin_tone = 3, hair_style = 10, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Jamal Murray';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 2, headband = null where name ilike 'Dillon Brooks';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Norman Powell';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Mike Conley';
update public.players set skin_tone = 2, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Dennis Schroder';
update public.players set skin_tone = 2, hair_style = 2, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Rui Hachimura';
update public.players set skin_tone = 4, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Luguentz Dort';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'DeAaron Fox';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Darius Garland';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Chet Holmgren';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Cade Cunningham';
update public.players set skin_tone = 2, hair_style = 10, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Paolo Banchero';
update public.players set skin_tone = 4, hair_style = 2, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Scottie Barnes';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Evan Mobley';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Jabari Smith Jr.';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Jalen Williams';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#7a5a36', beard = 0, headband = null where name ilike 'Cooper Flagg';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#4a3222', beard = 0, headband = null where name ilike 'Jared McCain';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#4a3222', beard = 0, headband = null where name ilike 'Brandin Podziemski';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#4a3222', beard = 0, headband = null where name ilike 'Christian Braun';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#2b1d14', beard = 0, headband = null where name ilike 'Josh Giddey';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#4a3222', beard = 0, headband = null where name ilike 'Franz Wagner';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Jalen Duren';
update public.players set skin_tone = 4, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Bilal Coulibaly';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Jaden McDaniels';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Trey Murphy III';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Andrew Nembhard';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Ayo Dosunmu';
update public.players set skin_tone = 2, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Zach LaVine';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 2, headband = null where name ilike 'Marcus Smart';
update public.players set skin_tone = 3, hair_style = 10, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Jarrett Allen';
update public.players set skin_tone = 3, hair_style = 10, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Jaren Jackson Jr.';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Kentavious Caldwell-Pope';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 2, headband = null where name ilike 'Bobby Portis';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'CJ McCollum';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Herbert Jones';
update public.players set skin_tone = 3, hair_style = 10, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Brandon Ingram';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 0, headband = null where name ilike 'Jordan Poole';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Kyle Kuzma';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Aaron Nesmith';
update public.players set skin_tone = 3, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Myles Turner';
update public.players set skin_tone = 4, hair_style = 2, hair_color = '#15120f', beard = 2, headband = null where name ilike 'Isaiah Stewart';
update public.players set skin_tone = 1, hair_style = 0, hair_color = '#8d8d8d', beard = 2, headband = null where name ilike 'Al Horford';
update public.players set skin_tone = 3, hair_style = 2, hair_color = '#15120f', beard = 1, headband = null where name ilike 'John Collins';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#7a5a36', beard = 0, headband = null where name ilike 'Cameron Johnson';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#4a3222', beard = 0, headband = null where name ilike 'Kevin Huerter';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#4a3222', beard = 1, headband = null where name ilike 'Max Strus';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#7a5a36', beard = 1, headband = null where name ilike 'Duncan Robinson';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#7a5a36', beard = 1, headband = null where name ilike 'Grayson Allen';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#2b1d14', beard = 1, headband = null where name ilike 'Donte DiVincenzo';
update public.players set skin_tone = 0, hair_style = 0, hair_color = '#15120f', beard = 1, headband = '#ffffff' where name ilike 'Alex Caruso';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#4a3222', beard = 1, headband = null where name ilike 'Klay Thompson';
update public.players set skin_tone = 0, hair_style = 1, hair_color = '#4a3222', beard = 2, headband = null where name ilike 'Domantas Sabonis';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#7a5a36', beard = 1, headband = null where name ilike 'Kristaps Porzingis';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#4a3222', beard = 0, headband = null where name ilike 'Tyler Herro';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#8a4a22', beard = 1, headband = null where name ilike 'Austin Reaves';
update public.players set skin_tone = 0, hair_style = 1, hair_color = '#2b1d14', beard = 1, headband = null where name ilike 'Isaiah Hartenstein';
update public.players set skin_tone = 0, hair_style = 1, hair_color = '#2b1d14', beard = 2, headband = null where name ilike 'Ivica Zubac';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#2b1d14', beard = 2, headband = null where name ilike 'Jusuf Nurkic';
update public.players set skin_tone = 1, hair_style = 0, hair_color = '#15120f', beard = 2, headband = null where name ilike 'Brook Lopez';
update public.players set skin_tone = 0, hair_style = 1, hair_color = '#4a3222', beard = 1, headband = null where name ilike 'Jakob Poeltl';
update public.players set skin_tone = 0, hair_style = 1, hair_color = '#2b1d14', beard = 1, headband = null where name ilike 'Nikola Vucevic';
update public.players set skin_tone = 0, hair_style = 1, hair_color = '#2b1d14', beard = 2, headband = null where name ilike 'Bogdan Bogdanovic';
update public.players set skin_tone = 0, hair_style = 9, hair_color = '#7a5a36', beard = 1, headband = null where name ilike 'Lauri Markkanen';
update public.players set skin_tone = 1, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Deni Avdija';
update public.players set skin_tone = 1, hair_style = 1, hair_color = '#15120f', beard = 1, headband = null where name ilike 'Alperen Sengun';

-- Ejemplos para editar uno a mano:
--   update public.players set hair_style = 8, hair_color = '#d8c27a' where name ilike 'LaMelo Ball';
--   update public.players set headband = '#ffffff' where name ilike 'Alex Caruso';
--   update public.players set arm_sleeve = 'R', sleeve_color = '#111111' where name ilike 'Jayson Tatum';
