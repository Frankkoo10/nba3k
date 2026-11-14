import * as Auth from './auth.js';

/* ============================================================================
   Planteles. Si Supabase está configurado se leen de las tablas `teams` y `players`
   (supabase/002_equipos_jugadores.sql). Si falta algún jugador, o no hay conexión,
   se completan con jugadores genéricos para que siempre haya 5 titulares en cancha.
   ========================================================================== */

export const POS = ['PG', 'SG', 'SF', 'PF', 'C'];
const POS_NAME = { PG: 'Armador', SG: 'Escolta', SF: 'Alero', PF: 'Ala-pívot', C: 'Pívot' };
export const SKIN_TONES = [0xf1c9a5, 0xd9a47a, 0xb97a50, 0x8a5a3a, 0x6b4128, 0x4a2c1b];
const HEIGHT = { PG: 188, SG: 195, SF: 201, PF: 206, C: 212 };

/* ---- Atributos estilo NBA 2K26 (escala 25–99). Clave del juego → columna de Supabase · etiqueta · grupo ---- */
export const ATTRS = [
  // Tiro
  ['close',    'close_shot',      'Tiro cercano',        'Tiro'],
  ['mid',      'mid_range',       'Tiro de media',       'Tiro'],
  ['three',    'three_point',     'Triple',              'Tiro'],
  ['ft',       'free_throw',      'Tiros libres',        'Tiro'],
  // Definición
  ['layup',    'driving_layup',   'Bandeja',             'Definición'],
  ['dunkD',    'driving_dunk',    'Mate en movimiento',  'Definición'],
  ['dunkS',    'standing_dunk',   'Mate parado',         'Definición'],
  ['post',     'post_control',    'Juego de poste',      'Definición'],
  // Creación
  ['passAcc',  'pass_accuracy',   'Precisión de pase',   'Creación'],
  ['handle',   'ball_handle',     'Manejo de balón',     'Creación'],
  ['speedBall','speed_with_ball', 'Velocidad con balón', 'Creación'],
  // Defensa
  ['intD',     'interior_def',    'Defensa interior',    'Defensa'],
  ['perD',     'perimeter_def',   'Defensa perimetral',  'Defensa'],
  ['steal',    'steal',           'Robos',               'Defensa'],
  ['block',    'block',           'Tapones',             'Defensa'],
  // Rebote
  ['oreb',     'off_rebound',     'Rebote ofensivo',     'Rebote'],
  ['dreb',     'def_rebound',     'Rebote defensivo',    'Rebote'],
  // Físico
  ['speed',    'speed',           'Velocidad',           'Físico'],
  ['strength', 'strength',        'Fuerza',              'Físico'],
  ['vertical', 'vertical',        'Salto',               'Físico'],
  ['stamina',  'stamina',         'Resistencia',         'Físico'],
];
/* Si a un jugador le faltan atributos se estiman desde su "ovr" según la posición (offset respecto del ovr). */
const OFF = {
  //        close mid three ft layup dunkD dunkS post passAcc handle speedBall intD perD steal block oreb dreb speed strength vertical stamina
  PG: [-8, 0, 2, 4, 4, -8, -38, -28, 8, 10, 10, -34, 2, 4, -34, -38, -28, 8, -22, -4, 2],
  SG: [-4, 2, 4, 2, 2, -4, -34, -26, 0, 4, 6, -28, 2, 2, -26, -34, -24, 4, -16, 0, 0],
  SF: [0, 0, 0, 0, 0, 0, -22, -18, -6, -4, 0, -14, 0, 0, -16, -26, -16, 0, -8, 2, 0],
  PF: [4, -4, -10, -6, -2, 0, -6, -4, -12, -16, -12, 2, -10, -10, -2, -10, -6, -6, 4, 0, -2],
  C:  [6, -12, -22, -14, -6, -6, 6, 2, -16, -26, -22, 8, -22, -18, 6, 0, 2, -12, 10, -2, -4],
};
const AGG_KEYS = ['shooting', 'passing', 'defense', 'speed', 'rebound'];
const avg = (v, w) => v.reduce((t, x, i) => t + x * w[i], 0) / w.reduce((t, x) => t + x, 0);

const has = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const clampN = (v, lo, hi, d) => has(v) ? Math.min(hi, Math.max(lo, Number(v))) : d;   // null o vacío = "sin dato" → usa el valor por defecto
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export const inchesToFtIn = i => `${Math.floor(i / 12)}'${Math.round(i % 12)}"`;

/** Normaliza una fila de la base (o un objeto cualquiera) a lo que usa el juego. */
export function normalizePlayer(r, team, i = 0) {
  const pos = POS.includes(String(r.position).toUpperCase()) ? String(r.position).toUpperCase() : POS[i % 5];
  const ovr = clampN(r.ovr, 40, 99, 72);
  const detailed = ATTRS.some(([, col]) => col !== 'speed' && has(r[col]));          // ¿la fila trae atributos estilo 2K?
  // altura: pulgadas (height_in) → cm; si solo hay cm, se calcula la pulgada
  const heightIn = has(r.height_in) ? clampN(r.height_in, 67, 90, 78) : null;
  const height = heightIn ? Math.round(heightIn * 2.54) : clampN(r.height_cm, 170, 230, HEIGHT[pos]);
  const weightLb = has(r.weight_lb) ? clampN(r.weight_lb, 130, 340, 220) : null;
  const o = OFF[pos], at = {};
  ATTRS.forEach(([key, col], k) => {
    const legacy = col === 'speed' ? r.speed : null;
    at[key] = has(r[col]) ? clampN(r[col], 25, 99, ovr) : has(legacy) ? clampN(legacy, 25, 99, ovr) : clampN(ovr + o[k], 25, 99, ovr);
  });
  // Agregados que usa el resto del juego: con atributos 2K salen de ellos; si no, de las columnas viejas (shooting, passing...)
  const agg = detailed ? {
    shooting: avg([at.three, at.mid, at.close, at.layup], [0.35, 0.30, 0.15, 0.20]),
    passing: avg([at.passAcc, at.handle], [0.6, 0.4]),
    defense: avg([at.perD, at.intD, at.steal], [0.4, 0.4, 0.2]),
    speed: at.speed,
    rebound: avg([at.oreb, at.dreb], [0.4, 0.6]),
  } : {
    shooting: clampN(r.shooting, 30, 99, ovr), passing: clampN(r.passing, 30, 99, ovr), defense: clampN(r.defense, 30, 99, ovr),
    speed: clampN(r.speed, 30, 99, ovr), rebound: clampN(r.rebound, 30, 99, ovr),
  };
  AGG_KEYS.forEach(k => { agg[k] = Math.round(agg[k]); });
  return {
    id: r.id ?? `${team.ab}-${i}`, team: team.ab, name: r.name || `${POS_NAME[pos]} ${team.ab}`,
    number: clampN(r.number, 0, 99, i + 1), pos, starter: !!r.is_starter, ovr, ...at, ...agg, detailed,
    height, heightIn: heightIn ?? Math.round(height / 2.54), weightLb, wingspanIn: has(r.wingspan_in) ? clampN(r.wingspan_in, 67, 100, null) : null,
    skin: clampN(r.skin_tone, 0, SKIN_TONES.length - 1, hash(team.ab + i) % SKIN_TONES.length),
    generic: !!r.generic,
  };
}

/** Jugador genérico (se usa cuando en la base todavía no cargaste a alguien). */
function generic(team, pos, k, starter) {
  const h = hash(team.ab + pos + k), base = starter ? 74 : 64;
  return normalizePlayer({
    name: `${POS_NAME[pos]} ${team.ab}${starter ? '' : ' (supl.)'}`, number: starter ? 1 + (h % 30) : 31 + (h % 60), position: pos, is_starter: starter,
    ovr: base + (h % 9), shooting: base + ((h >> 3) % 12) - (pos === 'C' ? 8 : 0), passing: base + ((h >> 5) % 10) + (pos === 'PG' ? 6 : 0),
    defense: base + ((h >> 7) % 10) + (pos === 'C' ? 6 : 0), speed: base + ((h >> 9) % 10) + (pos === 'PG' ? 6 : 0) - (pos === 'C' ? 8 : 0),
    rebound: base + ((h >> 11) % 10) + (pos === 'C' || pos === 'PF' ? 8 : -6), generic: true,
  }, team, k);
}

/** Arma 5 titulares (uno por posición si se puede) + suplentes a partir de una lista de jugadores. */
export function buildRoster(team, list) {
  const players = list.map((r, i) => normalizePlayer(r, team, i));
  const starters = [null, null, null, null, null], used = new Set();
  const take = (slot, p) => { starters[slot] = p; used.add(p); };
  for (const wantStarter of [true, false]) {                    // 1º titulares de la base, 2º suplentes para completar huecos
    POS.forEach((pos, slot) => {
      if (starters[slot]) return;
      const p = players.find(x => !used.has(x) && x.starter === wantStarter && x.pos === pos);
      if (p) take(slot, p);
    });
  }
  starters.forEach((s, slot) => {                              // si todavía faltan, cualquier titular libre; después cualquiera
    if (s) return;
    const p = players.find(x => !used.has(x) && x.starter) || players.find(x => !used.has(x));
    take(slot, p ? { ...p, pos: POS[slot] } : generic(team, POS[slot], slot, true));
  });
  const bench = players.filter(p => !used.has(p));
  POS.forEach((pos, k) => { if (bench.length < 5 && !bench.some(b => b.pos === pos)) bench.push(generic(team, pos, 10 + k, false)); });
  return { starters, bench };
}
export const fallbackRoster = team => buildRoster(team, []);

const cache = new Map();
/** Devuelve { starters:[5], bench:[...] } para un equipo. Nunca falla: si no hay base, usa jugadores genéricos. */
export async function loadRoster(team) {
  if (cache.has(team.ab)) return cache.get(team.ab);
  let list = [];
  if (Auth.configured) {
    try {
      const c = await Auth.getClient();
      const { data, error } = await c.from('players').select('*').eq('team_ab', team.ab).eq('active', true).order('sort_order').order('ovr', { ascending: false });
      if (error) throw error;
      list = data || [];
    } catch (e) { console.warn('No se pudo leer el plantel de', team.ab, '(se usan jugadores genéricos):', e?.message || e); }
  }
  const r = buildRoster(team, list);
  cache.set(team.ab, r);
  return r;
}
export const clearRosterCache = () => cache.clear();
