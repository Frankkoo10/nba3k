// Genera supabase/009_all_star_iconos.sql a partir de ultimate/data/icons.js  ·  uso: node tools/gen_iconos_sql.mjs
import { ICONS, ICON_COLS, ICON_TEAMS } from '../ultimate/data/icons.js';
import fs from 'fs';
const q = v => v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const attrCols = Object.values(ICON_COLS);
const cols = ['team_ab', 'name', 'number', 'position', 'is_starter', 'sort_order', 'ovr', 'height_in', 'weight_lb', 'skin_tone', 'hair_style', 'hair_color', 'beard', 'headband', 'arm_sleeve', 'sleeve_color', 'knee_sleeve', 'knee_color', 'active', ...attrCols];
let o = `-- =====================================================================
-- 009 · All-Star Rojo / All-Star Azul + los 30 ÍCONOS (v65)
-- Pegalo completo en Supabase → SQL Editor → New query → Run.
-- Es seguro correrlo más de una vez. Necesita haber corrido antes 002, 003, 005, 006 y 007.
--
--  1) Crea los equipos ASR (All-Star Rojo) y ASB (All-Star Azul) en \`teams\`.
--  2) Carga los 30 íconos en \`players\` (15 y 15, 5 titulares por equipo, atributos estilo 2K, altura/peso reales y aspecto).
--  3) Permite media hasta 110 en \`ut_cards\` y agrega las 30 cartas ICON_* (con el equipo que muestra cada carta) enlazadas a su jugador.
-- "ovr" del jugador va con tope 99 (la media de la carta, que llega a 110, queda en ut_cards.ovr).
-- =====================================================================

insert into public.teams (ab, name, color1, color2) values
${ICON_TEAMS.map(t => `  (${q(t.ab)}, ${q(t.name)}, ${q(t.color1)}, ${q(t.color2)})`).join(',\n')}
on conflict (ab) do update set name = excluded.name, color1 = excluded.color1, color2 = excluded.color2;

-- Jugadores (si ya los habías cargado, se borran y se vuelven a insertar: el enlace de las cartas se rehace más abajo)
delete from public.players where team_ab in ('ASR', 'ASB');

insert into public.players (${cols.join(', ')}) values
${ICONS.map(i => '  (' + cols.map(c => q(i.row[c])).join(', ') + ')').join(',\n')};

-- Cartas: la media impresa llega a 110
alter table public.ut_cards drop constraint if exists ut_cards_ovr_check;
alter table public.ut_cards add constraint ut_cards_ovr_check check (ovr between 40 and 110);

insert into public.ut_cards (card_id, team_ab, surname, ovr, pos) values
${ICONS.map(i => `  (${q(i.id)}, ${q(i.team)}, ${q(i.name.split(' ').slice(-1)[0].toUpperCase())}, ${i.ovr}, ${q(i.pos)})`).join(',\n')}
on conflict (card_id) do update set team_ab = excluded.team_ab, surname = excluded.surname, ovr = excluded.ovr, pos = excluded.pos;

-- Enlace carta ↔ jugador (por nombre completo, nunca por apellido: hay dos Malone)
update public.ut_cards c set player_id = p.id
  from public.players p
 where p.team_ab in ('ASR', 'ASB') and c.card_id = case p.name
${ICONS.map(i => `   when ${q(i.name)} then ${q(i.id)}`).join('\n')}
 end;

-- Controles:
--   select team_ab, position, number, name, is_starter, ovr from public.players where team_ab in ('ASR','ASB') order by team_ab, is_starter desc, position;
--   select card_id, team_ab, ovr, player_id from public.ut_cards where card_id like 'ICON\\_%' order by ovr desc;
`;
fs.writeFileSync(new URL('../supabase/009_all_star_iconos.sql', import.meta.url), o);
console.log('009 generado');
