import { clamp, pick, rint, gauss, weighted, hash, uid } from './util.js';
import { NAMES, LEAGUE_NATS, SCHOOLS, COLLEGES, KNOWN_AGE } from './data.js';

/* ============================================================================
   Jugadores del modo carrera: atributos (los mismos 21 de NBA 2K26 que usa el juego), overall calculado por posición,
   perfiles de crecimiento, contratos y aspecto. El overall se calcula desde los atributos (+ un ajuste fijo `adj`,
   así un jugador cargado de la base conserva su overall oficial al empezar y después sube o baja con sus atributos).
   ========================================================================== */
export const AK = ['close', 'mid', 'three', 'ft', 'layup', 'dunkD', 'dunkS', 'post', 'passAcc', 'handle', 'speedBall', 'intD', 'perD', 'steal', 'block', 'oreb', 'dreb', 'speed', 'strength', 'vertical', 'stamina'];
export const AGROUP = {   // para entrenar: grupos de atributos
  Tiro: ['close', 'mid', 'three', 'ft'], Definición: ['layup', 'dunkD', 'dunkS', 'post'], Creación: ['passAcc', 'handle', 'speedBall'],
  Defensa: ['intD', 'perD', 'steal', 'block'], Rebote: ['oreb', 'dreb'], Físico: ['speed', 'strength', 'vertical', 'stamina'],
};
export const GROUPS = Object.keys(AGROUP);
export const ATTR_LABEL = { close: 'Tiro cercano', mid: 'Tiro de media', three: 'Triple', ft: 'Tiros libres', layup: 'Bandeja', dunkD: 'Mate en movimiento', dunkS: 'Mate parado', post: 'Juego de poste', passAcc: 'Precisión de pase', handle: 'Manejo de balón', speedBall: 'Velocidad con balón', intD: 'Defensa interior', perD: 'Defensa perimetral', steal: 'Robos', block: 'Tapones', oreb: 'Rebote ofensivo', dreb: 'Rebote defensivo', speed: 'Velocidad', strength: 'Fuerza', vertical: 'Salto', stamina: 'Resistencia' };
export const POS = ['PG', 'SG', 'SF', 'PF', 'C'];
export const POS_NAME = { PG: 'Armador', SG: 'Escolta', SF: 'Alero', PF: 'Ala-pívot', C: 'Pívot' };
/* offsets respecto del overall (igual que roster.js) */
const OFF = {
  PG: [-8, 0, 2, 4, 4, -8, -38, -28, 8, 10, 10, -34, 2, 4, -34, -38, -28, 8, -22, -4, 2],
  SG: [-4, 2, 4, 2, 2, -4, -34, -26, 0, 4, 6, -28, 2, 2, -26, -34, -24, 4, -16, 0, 0],
  SF: [0, 0, 0, 0, 0, 0, -22, -18, -6, -4, 0, -14, 0, 0, -16, -26, -16, 0, -8, 2, 0],
  PF: [4, -4, -10, -6, -2, 0, -6, -4, -12, -16, -12, 2, -10, -10, -2, -10, -6, -6, 4, 0, -2],
  C:  [6, -12, -22, -14, -6, -6, 6, 2, -16, -26, -22, 8, -22, -18, 6, 0, 2, -12, 10, -2, -4],
};
const W = {   // peso de cada atributo en el overall, por posición
  PG: { three: .13, mid: .06, ft: .03, layup: .07, handle: .15, passAcc: .14, speedBall: .08, perD: .09, steal: .05, speed: .08, stamina: .03, close: .03, dunkD: .02, dreb: .02, vertical: .02 },
  SG: { three: .15, mid: .09, ft: .04, layup: .08, handle: .10, passAcc: .06, speedBall: .06, perD: .10, steal: .05, speed: .08, vertical: .04, stamina: .03, close: .04, dunkD: .04, dreb: .02 },
  SF: { three: .10, mid: .07, ft: .03, layup: .08, close: .06, dunkD: .06, handle: .06, passAcc: .05, perD: .09, intD: .05, steal: .04, dreb: .05, oreb: .03, speed: .06, vertical: .06, strength: .05, stamina: .03 },
  PF: { close: .08, mid: .04, three: .05, layup: .06, dunkD: .07, dunkS: .05, post: .06, intD: .10, perD: .04, block: .06, oreb: .07, dreb: .09, strength: .08, vertical: .06, speed: .03, stamina: .03, passAcc: .03 },
  C:  { close: .09, dunkS: .08, dunkD: .05, post: .08, intD: .12, block: .09, oreb: .09, dreb: .11, strength: .09, vertical: .05, layup: .04, passAcc: .03, ft: .02, speed: .02, stamina: .03, mid: .01 },
};
const WSUM = Object.fromEntries(POS.map(p => [p, Object.values(W[p]).reduce((a, b) => a + b, 0)]));
export const wavg = (at, pos) => { let t = 0; for (const [k, w] of Object.entries(W[pos] || W.SF)) t += (at[k] ?? 50) * w; return t / (WSUM[pos] || 1); };
export const baseOvr = p => clamp(Math.round(wavg(p.at, p.pos) + (p.adj || 0)), 25, 100);
export const ovrNow = p => clamp(baseOvr(p) + Math.round(p.frm || 0), 25, 100);

/* ---- perfiles de crecimiento (como los 6 "Growth Profiles" de FC 27) ---- */
export const PROFILES = [
  { id: 0, name: 'Precoz', desc: 'Llega rápido a su techo y cae antes.', peak: 25, decl: 29, rate: 1.25 },
  { id: 1, name: 'Equilibrado', desc: 'Crece y cae a un ritmo normal.', peak: 27, decl: 31, rate: 1 },
  { id: 2, name: 'Tardío', desc: 'Madura tarde y dura más.', peak: 29, decl: 33, rate: 0.8 },
  { id: 3, name: 'Explosivo', desc: 'Pega un salto grande de golpe.', peak: 26, decl: 30, rate: 1.0 },
  { id: 4, name: 'Duradero', desc: 'Cae muy despacio con los años.', peak: 28, decl: 34, rate: 0.9 },
  { id: 5, name: 'Irregular', desc: 'Sube y baja de un año a otro.', peak: 27, decl: 31, rate: 1.0 },
];
export const TRAITS = ['Líder', 'Ambicioso', 'Leal', 'Mercenario', 'Competitivo', 'Tranquilo', 'Showman'];

const HAIR_BY_SKIN = [[1, 9, 9, 7, 0], [1, 9, 9, 2, 7], [1, 2, 9, 10, 4, 5], [2, 1, 4, 5, 10, 0, 3], [2, 1, 0, 3, 5, 4, 10], [2, 0, 1, 3, 5, 4]];
const HAIR_COL = ['#15120f', '#15120f', '#2b1d14', '#4a3222', '#7a5a36', '#c9a45a'];
const usedNames = new Set();
export const resetNames = names => { usedNames.clear(); for (const n of names || []) usedNames.add(n); };

function natPick(rng, table) { return weighted(rng, Object.keys(table), k => table[k]); }
export function genName(rng, nat) {
  const [, fn, ln] = NAMES[nat] || NAMES.USA;
  for (let t = 0; t < 40; t++) { const n = `${pick(rng, fn)} ${pick(rng, ln)}`; if (!usedNames.has(n)) { usedNames.add(n); return n; } }
  const n = `${pick(rng, fn)} ${pick(rng, ln)} ${pick(rng, ['Jr.', 'II', 'III'])}`; usedNames.add(n); return n;
}
function heightFor(rng, pos, nat) {
  const base = { PG: 187, SG: 195, SF: 201, PF: 206, C: 212 }[pos], shift = ((NAMES[nat] || NAMES.USA)[3] - 198) * 0.35;
  return Math.round(clamp(gauss(rng, base + shift, 3.6), 173, 226));
}
function lookFor(rng, nat, skinBias) {
  const skin = clamp(Math.round(gauss(rng, skinBias, 1.1)), 0, 5), hs = HAIR_BY_SKIN[skin];
  return { skin, hair: pick(rng, hs), hairColor: skin >= 3 || rng() < 0.55 ? '#15120f' : pick(rng, HAIR_COL), beard: rng() < 0.38 ? (rng() < 0.4 ? 2 : 1) : 0 };
}
const SKIN_BIAS = { USA: 3.4, NGR: 4.5, FRA: 2.6, BRA: 2.6, CAN: 2.8, LAT: 2.0, AUS: 1.7, CHN: 1.0, ARG: 1.3, ESP: 1.0, SRB: 0.5, GRE: 0.7, LIT: 0.3, SLO: 0.4, TUR: 0.9, GER: 0.6, ITA: 0.8, CRO: 0.5, LAV: 0.3 };

/** Atributos que dan exactamente (±1) el overall pedido para esa posición. */
export function attrsFor(rng, pos, target, spread = 4) {
  const o = OFF[pos], at = {};
  AK.forEach((k, i) => { at[k] = clamp(target + o[i] + gauss(rng, 0, spread), 25, 99); });
  for (let it = 0; it < 6; it++) {
    const d = target - wavg(at, pos); if (Math.abs(d) < 0.6) break;
    for (const k of AK) at[k] = clamp(at[k] + d, 25, 99);
  }
  return at;
}

/* ---- contratos ---- */
export const CAP = { cap: 165, tax: 200, apron: 208, floor: 148, min: 1.3, maxPct: 0.35 };
export const salaryFor = (ovr, age = 27) => {
  const pts = [[48, 0.9], [55, 1.3], [60, 1.9], [65, 3.5], [70, 7], [75, 13], [80, 23], [85, 34], [90, 46], [95, 56], [100, 62]];
  let v = 1.3; for (let i = 1; i < pts.length; i++) if (ovr <= pts[i][0]) { const [a, b] = [pts[i - 1], pts[i]]; v = a[1] + (b[1] - a[1]) * (ovr - a[0]) / (b[0] - a[0]); break; } else v = pts[i][1];
  if (age <= 22) v *= 0.85; else if (age >= 34) v *= 0.7;
  return Math.max(CAP.min, Math.round(v * 10) / 10);
};
export const ROOKIE_SCALE = [14.2, 12.8, 11.6, 10.6, 9.7, 8.9, 8.2, 7.6, 7.1, 6.6, 6.2, 5.8, 5.5, 5.2, 4.9, 4.7, 4.5, 4.3, 4.1, 3.9, 3.7, 3.55, 3.4, 3.25, 3.1, 3.0, 2.9, 2.8, 2.7, 2.6];
export const rookieSalary = pick0 => (pick0 < 30 ? ROOKIE_SCALE[pick0] : pick0 < 45 ? 1.7 : 1.35);
const potFor = (rng, ovr, age, bonus = 0) => {
  if (age >= 28) return ovr;
  const room = Math.max(0, 27 - age) * (age <= 20 ? 2.9 : age <= 23 ? 1.9 : 1.1);
  return clamp(Math.round(ovr + room * (0.4 + rng() * 0.9) + bonus), ovr, 99);
};

/** Crea un jugador nuevo. opts: { nat, league, ovr, age, pos, potBonus, team, rookie } */
export function genPlayer(rng, o = {}) {
  const nat = o.nat || natPick(rng, LEAGUE_NATS[o.league] || LEAGUE_NATS.NBA), pos = o.pos || pick(rng, POS);
  const ovr = clamp(Math.round(o.ovr ?? 60), 28, 99), age = o.age ?? rint(rng, 19, 34), at = attrsFor(rng, pos, ovr), ht = heightFor(rng, pos, nat), L = lookFor(rng, nat, SKIN_BIAS[nat] ?? 2);
  const gp = weighted(rng, PROFILES, p => [1, 3, 1.2, 0.8, 0.8, 0.6][p.id]).id;
  const p = {
    id: 'p' + uid(), n: o.name || genName(rng, nat), nat, pos, age, ht, wt: Math.round(clamp(100 + (ht - 170) * 2.0 + gauss(rng, 0, 9), 140, 330)), at, adj: 0, frm: 0, mor: 70, gp,
    pot: 0, tm: o.team || null, lg: o.league || 'FA', num: rint(rng, 0, 99), trait: pick(rng, TRAITS), skin: L.skin, hair: L.hair, hc: L.hairColor, bd: L.beard,
    con: null, inj: null, st: null, hist: [], tr: { focus: null, xp: 0 }, ng: 0, role: 'rotación', xpGames: 0, perf: 0,
  };
  p.pot = potFor(rng, ovr, age, o.potBonus || 0);
  return p;
}

/** Aplica un contrato nuevo. type: 'std' | 'rookie' | 'min' | 'two' */
export const setContract = (p, sal, yrs, type = 'std', extra = {}) => { p.con = { sal: Math.round(sal * 100) / 100, yrs, type, ...extra }; return p; };

/** Convierte un jugador de la base (o genérico) al formato de la carrera. `norm` = salida de normalizePlayer (roster.js). */
export function fromNormalized(rng, norm, team) {
  const at = {}; for (const k of AK) at[k] = norm[k];
  const key = String(norm.name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const age = KNOWN_AGE[key] ?? clamp(Math.round(gauss(rng, norm.ovr >= 86 ? 27 : norm.ovr >= 76 ? 27 : 26, 3.8)), 19, 38);
  const gp = weighted(rng, PROFILES, p => [1, 3, 1.2, 0.8, 0.8, 0.6][p.id]).id;
  const p = {
    id: 'p' + uid(), n: norm.name, nat: 'USA', pos: norm.pos, age, ht: norm.height, wt: norm.weightLb || Math.round(clamp(100 + (norm.height - 170) * 2.0, 150, 320)), at, adj: 0, frm: 0, mor: 70, gp,
    pot: 0, tm: team, lg: 'NBA', num: norm.number, trait: pick(rng, TRAITS), skin: norm.skin, look: norm.look || null, db: true,
    con: null, inj: null, st: null, hist: [], tr: { focus: null, xp: 0 }, ng: 0, role: 'rotación', xpGames: 0, perf: 0,
  };
  p.adj = norm.ovr - Math.round(wavg(p.at, p.pos));        // conserva el overall oficial de la base
  p.pot = potFor(rng, norm.ovr, age, 0);
  return p;
}

/** Fila para roster.js (normalizePlayer): sirve para armar los planteles del partido 3D. */
export function toRow(p, starter = false) {
  const COL = { close: 'close_shot', mid: 'mid_range', three: 'three_point', ft: 'free_throw', layup: 'driving_layup', dunkD: 'driving_dunk', dunkS: 'standing_dunk', post: 'post_control', passAcc: 'pass_accuracy', handle: 'ball_handle', speedBall: 'speed_with_ball', intD: 'interior_def', perD: 'perimeter_def', steal: 'steal', block: 'block', oreb: 'off_rebound', dreb: 'def_rebound', speed: 'speed', strength: 'strength', vertical: 'vertical', stamina: 'stamina' };
  const f = Math.round(p.frm || 0), r = { id: p.id, name: p.n, number: p.num, position: p.pos, is_starter: starter, ovr: ovrNow(p), height_cm: p.ht, weight_lb: p.wt, skin_tone: p.skin };
  for (const k of AK) r[COL[k]] = clamp(Math.round(p.at[k]) + f, 25, 99);
  if (p.look) { Object.assign(r, { hair_style: p.look.hair, hair_color: p.look.hairColor, beard: p.look.beard, headband: p.look.band, arm_sleeve: p.look.sleeve, sleeve_color: p.look.sleeveColor, wrist_band: p.look.wrist, wrist_color: p.look.wristColor, knee_sleeve: p.look.knee, knee_color: p.look.kneeColor }); }
  else if (p.hair != null) Object.assign(r, { hair_style: p.hair, hair_color: p.hc, beard: p.bd });
  return r;
}

/** Prospecto de secundaria / internacional / universidad para el Draft. `strength` 0-1 sube el techo (para armar clases fuertes). */
export function genProspect(rng, rank, classYear) {
  const src = rng() < 0.64 ? 'HS' : rng() < 0.6 ? 'INT' : 'COL';
  const nat = natPick(rng, LEAGUE_NATS[src === 'INT' ? 'INT' : 'HS']);
  const age = src === 'HS' ? 18 : src === 'COL' ? rint(rng, 19, 22) : rint(rng, 18, 21);
  const ovr = clamp(Math.round(gauss(rng, 49 + (src === 'COL' ? 5 : 0), 5.5) + (rank < 8 ? 10 : rank < 25 ? 5 : 0)), 38, 70);
  const pot = clamp(Math.round(ovr + (src === 'HS' ? 14 : 10) + gauss(rng, 0, 7) + (rank < 5 ? 14 : rank < 14 ? 8 : rank < 35 ? 3 : -3)), ovr + 2, 99);
  const p = genPlayer(rng, { nat, ovr, age, league: src === 'INT' ? 'INT' : 'HS', potBonus: 0 });
  p.pot = pot; p.lg = 'PROS'; p.tm = null; p.prospect = { src, cls: classYear, school: src === 'HS' ? pick(rng, SCHOOLS) : src === 'COL' ? pick(rng, COLLEGES) : 'Cantera europea', err: rint(rng, -9, 9), rank, ppg: 0 };
  p.role = 'prospecto'; p.con = null;
  return p;
}

/** Cuánto sabés de un prospecto (0-100): sube con los ojeadores. Define qué tan ancho es el rango de potencial que se muestra. */
export function potRange(p, know = 0, scoutLvl = 1) {
  const spread = Math.round(clamp(14 - know * 0.1 - scoutLvl * 1.6, 2, 14)), mid = p.pot + Math.round(p.prospect.err * (1 - know / 100));
  const o = baseOvr(p); return [clamp(mid - spread, o, 99), clamp(mid + spread, o, 99)];
}
