import * as Auth from '../auth.js';
import { CARDS, BY_ID, TIER_BUCKETS, POS, posOf, posPenalty, value, valueOf, quickSell, quickSellOf, isIcon, rng, teamRating, makeOpponent, infoFor, fallbackRoster, teamOf, nick, WALKOUT, fmt } from './ut-data.js';

/* ============================================================================
   Ultimate Team · estado y reglas (sin pantallas). Todo lo que cambia monedas, cartas o progreso pasa por acá.
   Guardado: siempre en el navegador (localStorage); con cuenta, además en Supabase (tabla ut_saves, 007_ultimate_team.sql).
   ========================================================================== */

/* ------------------------------ tiempo ------------------------------ */
const pad2 = n => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const weekStart = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const weekKey = (d = new Date()) => dayKey(weekStart(d));
export const msToWeekEnd = () => { const e = weekStart(); e.setDate(e.getDate() + 7); return Math.max(0, e - new Date()); };
export const msToDayEnd = () => { const e = new Date(); e.setHours(24, 0, 0, 0); return Math.max(0, e - new Date()); };
export const fmtLeft = ms => { const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `${d} días ${h} hs` : h ? `${h} hs ${m % 60} min` : `${Math.max(1, m)} min`; };

/* ------------------------------ sobres ------------------------------ */
/* pr = probabilidad POR CARTA de cada rareza [Base, Plata, Oro, Élite, Estrella, Leyenda, Ícono].
   Íconos (v65, como en FC 27): solo en los sobres caros y con probabilidad MUY baja (EA muestra "menos del 1%" en sus sobres con Rare Gold; el Pack Rookie no puede traer).
   Por sobre salen así: Oro ≈ 0,04% · Élite ≈ 0,25% · Especial (200.000) = 2% (v71). Dentro de los íconos, cuanto más alta la media más raro (Jordan 110 es ~25 veces más raro que un 92). */
export const PACKS = {
  rookie: { name: 'Pack Rookie', cost: 5000, cur: 'coins', n: 3, min: 0, tr: false, pr: [.935, .060, .0045, .0005, 0, 0, 0], a: '#d08a4a', b: '#3b200c', col: 0xd9a066 },
  oro: { name: 'Pack Oro', cost: 15000, cur: 'coins', n: 4, min: 76, tr: true, pr: [.62, .31, .0665, .003, .0005, 0, .0001], a: '#ffd45a', b: '#6b4a06', col: 0xffd45a },
  elite: { name: 'Pack Élite', cost: 50000, cur: 'coins', n: 5, min: 80, tr: true, pr: [.24, .38, .35, .027, .0028, .0002, .0005], a: '#b06bff', b: '#2a1058', col: 0xb06bff },
  especial: { name: 'Pack Especial', cost: 200000, cur: 'coins', n: 3, min: 86, tr: true, pr: [0, 0, 0, .8933, .0957, .004, .00673], a: '#4fc3ff', b: '#0b2a5a', col: 0x4fc3ff },
};
export const packChance = (pk, i) => +((1 - Math.pow(1 - pk.pr.slice(i).reduce((a, b) => a + b, 0), pk.n)) * 100).toFixed(1);
/** Chance (en %) de que el sobre traiga al menos un ícono, con 2 decimales (packChance redondea a 1). */
export const iconChance = pk => +((1 - Math.pow(1 - (pk.pr[6] || 0), pk.n)) * 100).toFixed(2);
const iconW = c => Math.pow(0.8, c.o - 92);                           // 92 → 1 · 99 → 0,21 · 110 → 0,007
function roll(pk, min = 0) {
  const t = pk.pr.map((p, i) => ({ p, i, c: min ? TIER_BUCKETS[i].filter(x => x.o >= min) : TIER_BUCKETS[i] })).filter(x => x.c.length && x.p > 0);
  const pickIn = x => {
    if (x.i !== 6) return x.c[Math.random() * x.c.length | 0];
    let q = Math.random() * x.c.reduce((a, c) => a + iconW(c), 0);
    for (const c of x.c) { q -= iconW(c); if (q <= 0) return c; }
    return x.c[x.c.length - 1];
  };
  let q = Math.random() * t.reduce((a, x) => a + x.p, 0);
  for (const x of t) { q -= x.p; if (q <= 0) return pickIn(x); }
  return pickIn(t[t.length - 1]);
}
function draw(pk) {
  const a = []; for (let i = 0; i < pk.n; i++) a.push(roll(pk));
  if (Math.max(...a.map(p => p.o)) < pk.min) a[a.length - 1] = roll(pk, pk.min);
  return a.sort((x, y) => (isIcon(x) ? -1000 : 0) + x.o - ((isIcon(y) ? -1000 : 0) + y.o));       // v68: el ícono (si sale) va siempre PRIMERO (tiene su propia secuencia: pelota, mate y carta); después siguen las demás de menor a mayor
}

/* ------------------------------ objetivos ------------------------------ */
const sc = r => (r.coins ? { ...r, coins: Math.max(50, Math.round(r.coins * 0.6 / 50) * 50) } : r);   // economía dura: los objetivos repetibles pagan 60%
const D = (id, t, ev, n, r, kind = 'sum') => ({ id, t, ev, n, r: sc(r), kind, g: 'daily' });
const W = (id, t, ev, n, r, kind = 'sum') => ({ id, t, ev, n, r: sc(r), kind, g: 'weekly' });
const H = (id, t, ev, n, r, kind = 'sum') => ({ id, t, ev, n, r, kind, g: 'hito' });
export const OBJ = [
  D('d_win2', 'Ganá 2 partidos', 'win', 2, { coins: 1500 }), D('d_play3', 'Jugá 3 partidos', 'play', 3, { coins: 1000 }),
  D('d_tpm10', 'Anotá 10 triples', 'tpm', 10, { coins: 1000 }), D('d_ast15', 'Dá 15 asistencias', 'ast', 15, { coins: 1200 }),
  D('d_stl8', 'Conseguí 8 robos', 'stl', 8, { coins: 1000 }), D('d_blk5', 'Poné 5 tapones', 'blk', 5, { coins: 1000 }),
  D('d_pack1', 'Abrí 1 sobre', 'pack', 1, { coins: 1000 }), D('d_pts120', 'Anotá 120 puntos', 'pts', 120, { coins: 1200 }),
  D('d_sell1', 'Vendé 1 carta en el mercado', 'sold', 1, { coins: 800 }), D('d_buy1', 'Comprá 1 carta en el mercado', 'bought', 1, { coins: 800 }),
  D('d_reb25', 'Agarrá 25 rebotes', 'reb', 25, { coins: 1000 }),
  W('w_win10', 'Ganá 10 partidos', 'win', 10, { packs: ['oro'], coins: 2000 }), W('w_pack5', 'Abrí 5 sobres', 'pack', 5, { coins: 3000 }),
  W('w_dream5', 'Ganá 5 partidos en Dream Live', 'dream_win', 5, { packs: ['oro'] }), W('w_sb3', 'Ganá 3 Squad Battles', 'squad_win', 3, { coins: 2500 }),
  W('w_pts600', 'Anotá 600 puntos', 'pts', 600, { coins: 3000 }),
  H('h_first', 'Ganá tu primer partido', 'win', 1, { packs: ['rookie'] }), H('h_rk5', 'Superá 5 etapas de Rookie Battles', 'rookie_clear', 5, { coins: 2500, packs: ['oro'] }),
  H('h_rk10', 'Completá las 10 etapas de Rookie Battles', 'rookie_clear', 10, { coins: 6000, packs: ['elite'] }),
  H('h_r80', 'Armá un equipo de media 80+', 'rating', 80, { packs: ['oro'] }, 'max'), H('h_r85', 'Armá un equipo de media 85+', 'rating', 85, { packs: ['elite'] }, 'max'),
  H('h_r90', 'Armá un equipo de media 90+', 'rating', 90, { coins: 10000, packs: ['elite'] }, 'max'),
  H('h_wo', 'Sacá un walkout (86+) de un sobre', 'walkout', 1, { coins: 2000, }), H('h_icon', 'Sacá un ÍCONO de un sobre', 'icon', 1, { coins: 50000, packs: ['especial'] }), H('h_div5', 'Llegá a la División 5 de Dream Live', 'divprog', 6, { coins: 5000, packs: ['elite'] }, 'max'),
  H('h_win25', 'Ganá 25 partidos', 'win', 25, { coins: 5000, packs: ['oro'] }), H('h_win100', 'Ganá 100 partidos', 'win', 100, { coins: 15000, packs: ['especial'] }),
  H('h_col100', 'Juntá 100 cartas distintas', 'distinct', 100, { coins: 4000 }, 'max'), H('h_col250', 'Juntá 250 cartas distintas', 'distinct', 250, { coins: 10000, packs: ['elite'] }, 'max'),
  H('h_as5', 'Ganá 5 partidos en una All-Star Live', 'allstar_run', 5, { packs: ['elite'] }, 'max'),
];
const OBJ_BY = new Map(OBJ.map(o => [o.id, o]));
export const objById = id => OBJ_BY.get(id);

/* ------------------------------ modos ------------------------------ */
export const ROOKIE = Array.from({ length: 10 }, (_, i) => ({
  n: i + 1, rating: Math.round(66 + i * 1.4), diff: i < 4 ? 'rookie' : i < 8 ? 'semirookie' : 'pro',
  coins: 300 + i * 100, packs: i === 2 ? ['rookie'] : i === 5 ? ['oro'] : i === 9 ? ['elite'] : [],
}));
/** Todo partido terminado paga monedas: 500 por jugarlo, 700 si lo ganás (abandonar no paga). Los premios de cada modo se suman encima. */
export const MATCH_PAY = { play: 500, win: 700 };
/** Dream Live (estilo FC): 10 → 1. Racha de victorias = más puntos (2 seguidas ×2, 4 seguidas ×3). Si bajás de 0 puntos descendés (la División 10 no baja). */
export const DREAM = { perDiv: 15, win: 3, loss: 2, upMin: 4, relegPts: 8, lowest: 10, mult: streak => (streak >= 4 ? 3 : streak >= 2 ? 2 : 1),
  ratingOf: d => Math.round(72 + (10 - d) * 2.3), diffOf: d => (d >= 9 ? 'rookie' : d >= 7 ? 'semirookie' : d >= 5 ? 'pro' : d >= 3 ? 'semistar' : 'allstar'),      // cuanto más subís de división, más difícil (10-9 Rookie · 8-7 Semi-Rookie · 6-5 Profesional · 4-3 Semi-Star · 2-1 All-Star)
  weekly: [[3, { coins: 1000 }], [6, { packs: ['oro'] }], [10, { packs: ['elite'] }], [15, { coins: 5000, packs: ['elite'] }]] };
/** All-Star Live: entrada 10.000. v71: se juega en Semi-Star (la anteúltima dificultad: muy difícil, pero no tanto como All-Star, que quedó para Champion Star). Clasificatoria de 5 partidos (con 2 victorias pasás). Fase final: 10 partidos, premio por CADA victoria. */
export const ALLSTAR = { fee: 10000, perDay: 2,           // máximo 2 entradas por día y por usuario (clasificatoria + fase final cuentan como UNA entrada)
  qual: { games: 5, need: 2, rating: 84, diff: 'semistar', reward: { coins: 3000 }, consolation: { coins: 3000 } },
  /* Fase final: todos los partidos en All-Star (la dificultad más alta), pero el rival es AL AZAR en cada partido (tanto puede tocarte uno flojo como uno muy bueno).
     Si abandonás, ese partido cuenta como derrota y el siguiente rival se sortea de nuevo. */
  main: { games: 10, diff: 'semistar', pool: [[.30, 77, 82], [.40, 83, 88], [.25, 89, 94], [.05, 95, 97]],      // [probabilidad, media mínima, media máxima]
    ratingOf: () => { let q = Math.random(); for (const [p, lo, hi] of ALLSTAR.main.pool) { if ((q -= p) <= 0) return lo + Math.floor(Math.random() * (hi - lo + 1)); } return 90; } },
  /* Premio por la victoria N de la fase final (de la 5.ª en adelante ya son premios grandes). */
  rewards: [{ coins: 3000 }, { coins: 4000 }, { coins: 5000, packs: ['oro'] }, { coins: 8000 }, { coins: 20000, packs: ['elite'] }, { coins: 25000, packs: ['elite', 'elite'] }, { coins: 30000, packs: ['elite', 'elite'] }, { coins: 45000, packs: ['elite', 'especial'] }, { coins: 65000, packs: ['elite', 'especial'] }, { coins: 100000, packs: ['elite', 'especial', 'especial'] }] };
/** CHAMPION STAR (v71): la dificultad más alta (All-Star). Cada partido suma o resta puntos (los calcula el servidor: supabase/010_champion_star.sql) y el ranking se reinicia cada mes.
    Al terminar el mes, el TOP 3 reclama un premio grande (monedas y sobres). Hace falta tener cuenta: el ranking es de todos los jugadores. */
export const CHAMPION = { diff: 'allstar', win: 20, streakBonus: 2, streakMax: 5, bigWin: 5, bigMargin: 15, loss: 8, abandon: 15, ratingMin: 92, ratingMax: 97,
  top: [{ coins: 1000000, packs: ['especial', 'especial', 'especial', 'elite', 'elite'] }, { coins: 600000, packs: ['especial', 'especial', 'elite'] }, { coins: 300000, packs: ['especial', 'elite', 'elite'] }] };
export const monthKey = (d = new Date()) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;                    // el mes del ranking cuenta en UTC (igual que el servidor)
export const msToMonthEnd = () => { const n = new Date(); return Math.max(0, Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1) - n.getTime()); };
export const monthLabel = k => { const [y, m] = String(k).split('-'); return `${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][(+m || 1) - 1]} de ${y}`; };
export const SQUADB = { levels: [
  { id: 'facil', name: 'Fácil', rating: 76, diff: 'rookie', coins: 400, pts: 1 }, { id: 'normal', name: 'Normal', rating: 83, diff: 'pro', coins: 900, pts: 2 },
  { id: 'dificil', name: 'Difícil', rating: 89, diff: 'semistar', coins: 1800, pts: 3 }, { id: 'extremo', name: 'Extremo', rating: 94, diff: 'allstar', coins: 4000, pts: 4 }],
  weekly: [[4, { coins: 1000 }], [10, { packs: ['oro'] }], [20, { packs: ['elite'] }], [35, { coins: 4000, packs: ['elite'] }]] };
export const EVENT = { name: 'Torneo Élite', target: 1000, reward: { coins: 5000, packs: ['especial'] }, pts: { champion: 120, allstar: 100, dream: 50, squad: 30, rookie: 20 } };
export const MODE_NAME = { rookie: 'Rookie Battles', dream: 'Dream Live', allstar: 'All-Star Live', squad: 'Squad Battles', champion: 'Champion Star' };

/* ------------------------------ estado ------------------------------ */
const LS = 'basket3d_ut_v1';
let S = null, userKey = 'guest', saveT = 0, remoteT = 0, cloud = 'local';
const subs = new Set();
export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach(f => f(S));
export const get = () => S;
export const cloudState = () => cloud;
const uid = () => { S.n = (S.n || 0) + 1; return 'x' + Date.now().toString(36) + S.n; };
const lsKey = () => `${LS}_${userKey}`;

function newState() {
  const R = rng(Date.now()), used = new Set();
  const pick = (pos, lo, hi) => { const pool = CARDS.filter(c => !used.has(c.id) && posOf(c) === pos && c.o >= lo && c.o <= hi); const c = pool[Math.floor(R() * pool.length)] || CARDS.find(x => !used.has(x.id)); used.add(c.id); return c; };
  const st = POS.map(p => pick(p, 72, 76)), bn = [...POS, 'PG', 'SF', 'C'].map(p => pick(p, 68, 73));
  const col = {}, untr = {}; for (const c of [...st, ...bn]) { col[c.id] = 1; untr[c.id] = 1; }
  const star = [...st].sort((a, b) => b.o - a.o)[0], p = Auth.getProfile();
  return {
    v: 1, ts: Date.now(), n: 0, club: { name: p?.username && p.username !== 'Invitado' ? `Club de ${p.username}` : 'Mi Club', team: star.t },
    coins: 5000, gems: 0, xp: 0, col, untr, squad: { s: st.map(c => c.id), b: bn.map(c => c.id) },
    packs: [{ id: 'welcome1', kind: 'rookie', tr: false }, { id: 'welcome2', kind: 'rookie', tr: false }], mkt: [],
    obj: { day: dayKey(), wk: weekKey(), prog: {}, claimed: {}, daily: [] },
    modes: { rookie: { stage: 1, stars: {} }, dream: { v: 2, div: 10, pts: 0, streak: 0, wk: weekKey(), w: 0, l: 0, claimed: [] }, allstar: { run: null, best: 0, day: { d: '', n: 0 } }, squad: { wk: weekKey(), pts: 0, played: 0, claimed: [] }, champion: { month: monthKey(), pts: 0, w: 0, l: 0, streak: 0, best: 0 } },
    ev: { wk: weekKey(), pts: 0, claimed: false }, stats: { p: 0, w: 0, l: 0, pts: 0, pk: 0, wo: 0, bought: 0, sold: 0 }, set: { q: 180 },
  };
}
function migrate(s) {
  const d = newState();
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  for (const k of Object.keys(d.modes)) s.modes[k] = { ...d.modes[k], ...(s.modes[k] || {}) };
  if (s.gems) { s.coins = (s.coins || 0) + s.gems * 100; s.gems = 0; }                  // las gemas ya no existen: 1 gema = 100 monedas
  const dm = s.modes.dream; if (dm.v !== 2) { dm.v = 2; dm.pts = Math.min(DREAM.perDiv - 1, Math.round((dm.pts || 0) / 2)); dm.streak = 0; }   // las divisiones ahora son de 15 puntos
  const ar = s.modes.allstar.run; if (ar && !ar.phase) { s.coins = (s.coins || 0) + 5000; s.modes.allstar.run = null; }                  // torneo viejo (otro formato): se devuelve la entrada
  s.stats = { ...d.stats, ...s.stats }; s.set = { ...d.set, ...s.set }; s.obj = { ...d.obj, ...s.obj };
  return s;
}

/** Carga el progreso (local + nube) del usuario actual. Llamar al abrir el modo. */
export async function init() {
  const p = Auth.getProfile(); userKey = p?.id || 'guest';
  let local = null; try { local = JSON.parse(localStorage.getItem(lsKey()) || 'null'); } catch { /* sin storage */ }
  let remote = null;
  if (Auth.configured && p?.id && !Auth.isGuest()) {
    try {
      const c = await Auth.getClient(); const { data, error } = await c.from('ut_saves').select('data,updated_at').eq('user_id', p.id).maybeSingle();
      if (error) throw error; if (data?.data) remote = data.data; cloud = 'sync';
    } catch (e) { cloud = 'error'; console.warn('Ultimate Team: no se pudo leer la nube (se usa lo guardado en este navegador):', e?.message || e); }
  } else cloud = 'local';
  const best = remote && (!local || (remote.ts || 0) >= (local.ts || 0)) ? remote : local;
  S = best ? migrate(best) : newState();
  roll_(); settleMarket(); refreshRating(); persist(true); emit();
  return S;
}
function persist(now = false) {
  if (!S) return; S.ts = Date.now(); emit();
  clearTimeout(saveT);
  const go = () => {
    try { localStorage.setItem(lsKey(), JSON.stringify(S)); } catch { /* sin storage */ }
    if (cloud === 'local' || !Auth.configured || Auth.isGuest()) return;
    clearTimeout(remoteT); remoteT = setTimeout(pushRemote, 2500);
  };
  if (now) go(); else saveT = setTimeout(go, 250);
}
async function pushRemote() {
  const p = Auth.getProfile(); if (!p?.id || !S) return;
  try { const c = await Auth.getClient(); const { error } = await c.from('ut_saves').upsert({ user_id: p.id, data: S, updated_at: new Date().toISOString() }); if (error) throw error; cloud = 'sync'; }
  catch (e) { cloud = 'error'; console.warn('Ultimate Team: no se pudo guardar en la nube:', e?.message || e); }
  emit();
}
export function flush() { clearTimeout(saveT); try { if (S) localStorage.setItem(lsKey(), JSON.stringify(S)); } catch { /* sin storage */ } if (cloud !== 'local') pushRemote(); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
export function resetAll() { S = newState(); persist(true); }

/* refresco por día / semana */
function roll_() {
  const dk = dayKey(), wk = weekKey(), o = S.obj;
  if (o.day !== dk || !o.daily?.length) {
    for (const id of o.daily || []) { delete o.prog[id]; delete o.claimed[id]; }
    const R = rng('d' + dk), pool = OBJ.filter(x => x.g === 'daily'); o.daily = [];
    while (o.daily.length < 3) { const x = pool[Math.floor(R() * pool.length)]; if (!o.daily.includes(x.id)) o.daily.push(x.id); }
    o.day = dk;
  }
  if (o.wk !== wk) { for (const x of OBJ) if (x.g === 'weekly') { delete o.prog[x.id]; delete o.claimed[x.id]; } o.wk = wk; }
  const m = S.modes;
  if (m.dream.wk !== wk) Object.assign(m.dream, { wk, w: 0, l: 0, claimed: [] });
  if (m.squad.wk !== wk) Object.assign(m.squad, { wk, pts: 0, played: 0, claimed: [] });
  if (S.ev.wk !== wk) Object.assign(S.ev, { wk, pts: 0, claimed: false });
}
export const tick = () => { roll_(); settleMarket(); };

/* ------------------------------ recompensas ------------------------------ */
export const LVL = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 60)) + 1;
export const xpFor = l => 60 * (l - 1) ** 2;
export function grant(r = {}) {
  const out = [];
  if (r.coins) { S.coins += r.coins; out.push(`+${fmt(r.coins)} monedas`); }
  if (r.gems) { S.gems += r.gems; out.push(`+${fmt(r.gems)} gemas`); }
  if (r.xp) { S.xp += r.xp; out.push(`+${r.xp} XP`); }
  for (const k of r.packs || []) { S.packs.push({ id: uid(), kind: k, tr: false }); out.push(PACKS[k].name); }
  return out;
}
export const rewardText = r => { const o = []; if (r.coins) o.push(`${fmt(r.coins)} monedas`); for (const k of r.packs || []) o.push(PACKS[k].name); return o.join(' + '); };

/* ------------------------------ colección ------------------------------ */
export const qty = id => S.col[id] || 0;
const slotsOf = () => [...S.squad.s, ...S.squad.b];
export const inSquad = id => slotsOf().includes(id);
export const tradable = id => Math.max(0, qty(id) - (S.untr[id] || 0));
export const sellable = id => Math.max(0, qty(id) - (inSquad(id) ? 1 : 0));
export const listable = id => Math.max(0, Math.min(tradable(id), qty(id) - (inSquad(id) ? 1 : 0)));
export const distinct = () => Object.keys(S.col).length;
function addCard(id, tr) { S.col[id] = (S.col[id] || 0) + 1; if (!tr) S.untr[id] = (S.untr[id] || 0) + 1; }
function takeCard(id, preferUntr) {
  S.col[id] = (S.col[id] || 1) - 1;
  if (preferUntr && S.untr[id] > 0) S.untr[id]--;
  if (S.untr[id] > S.col[id]) S.untr[id] = S.col[id];
  if (S.col[id] <= 0) { delete S.col[id]; delete S.untr[id]; }
}
export const ownedCards = () => Object.keys(S.col).map(id => BY_ID.get(id)).filter(Boolean);

export function openPack(pack) {                                     // pack = { kind, tr } (ya pagado o sacado del inventario)
  const def = PACKS[pack.kind], cards = draw(def);
  for (const c of cards) addCard(c.id, pack.tr);
  S.stats.pk++; track('pack', 1);
  const wo = cards.filter(c => c.o >= WALKOUT).length; if (wo) { S.stats.wo += wo; track('walkout', wo); }
  const ics = cards.filter(isIcon).length; if (ics) { S.stats.ic = (S.stats.ic || 0) + ics; track('icon', ics); }
  track('distinct', distinct(), true); persist();
  return cards;
}
export function buyPack(kind) {
  const def = PACKS[kind], cur = def.cur;
  if ((S[cur] || 0) < def.cost) return null;
  S[cur] -= def.cost; persist();
  return { id: uid(), kind, tr: def.tr };
}
export function takeStoredPack(id) { const i = S.packs.findIndex(p => p.id === id); if (i < 0) return null; const [p] = S.packs.splice(i, 1); persist(); return p; }
export function sellQuick(id) {
  if (sellable(id) < 1) return 0;
  const c = BY_ID.get(id), g = quickSellOf(c); takeCard(id, true); S.coins += g; track('sold_quick', 1); persist(); return g;
}

/* ------------------------------ plantilla ------------------------------ */
const where = id => { for (const g of ['s', 'b']) { const i = S.squad[g].indexOf(id); if (i >= 0) return { g, i }; } return null; };
export function place(g, i, id) {
  if (id && qty(id) < 1) return false;
  const old = id ? where(id) : null, cur = S.squad[g][i] || null;
  if (old && old.g === g && old.i === i) return true;
  if (old) S.squad[old.g][old.i] = cur;
  S.squad[g][i] = id || null; refreshRating(); persist(); return true;
}
export const clearSlot = (g, i) => { S.squad[g][i] = null; refreshRating(); persist(); };
export function squadCards() { return { s: S.squad.s.map(id => BY_ID.get(id) || null), b: S.squad.b.map(id => BY_ID.get(id) || null) }; }
export function rating() { const q = squadCards(); return teamRating(q.s, q.b); }
export function squadReady() { return S.squad.s.every(id => id && qty(id) > 0); }
function refreshRating() { track('rating', rating(), true); }
export function autoSquad() {
  const cards = ownedCards(), used = new Set(), starters = [null, null, null, null, null];
  const pairs = []; for (const c of cards) POS.forEach((p, i) => pairs.push({ c, i, e: c.o - posPenalty(posOf(c), p) }));
  pairs.sort((a, b) => b.e - a.e);
  for (const x of pairs) if (!starters[x.i] && !used.has(x.c.id)) { starters[x.i] = x.c; used.add(x.c.id); }
  const rest = cards.filter(c => !used.has(c.id)).sort((a, b) => b.o - a.o).slice(0, 8);
  S.squad.s = starters.map(c => c?.id || null); S.squad.b = Array.from({ length: 8 }, (_, i) => rest[i]?.id || null);
  refreshRating(); persist();
}
export function setClub(p) { Object.assign(S.club, p); persist(); }
export function setQ(q) { S.set.q = q; persist(); }
/** Los 13 jugadores que entran al partido (titulares en su casillero + suplentes). */
export function matchLineup(sq = squadCards(), teamAb = S.club.team) {
  const starters = sq.s.map((c, i) => infoFor(c, POS[i])), bench = sq.b.filter(Boolean).map(c => infoFor(c));
  const team = teamOf(teamAb);
  if (bench.length < 5) bench.push(...fallbackRoster(team).bench.slice(0, 5 - bench.length));
  return { starters, bench };
}

/* ------------------------------ mercado ------------------------------ */
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const marketDay = () => dayKey();
export function mktPrice(c) { const n = (hash(c.id + marketDay() + 'p') % 1000) / 1000; return Math.max(10, Math.round(valueOf(c) * (0.88 + 0.26 * n) / (isIcon(c) ? 1000 : 10)) * (isIcon(c) ? 1000 : 10)); }
export const onSale = c => hash(c.id + marketDay() + 's') % 100 < (isIcon(c) ? 8 : 62);     // los íconos casi nunca aparecen en el mercado simulado (8% de los días)
/** ¿Mercado ONLINE (entre jugadores, Supabase) o simulado (invitados / sin Supabase, como siempre)? */
export const marketOnline = () => !!(Auth.configured && !Auth.isGuest() && Auth.getProfile()?.id);
export const priceRange = c => marketOnline()
  ? [Math.max(10, Math.floor(valueOf(c) / 2 / 10) * 10), valueOf(c)]                    // tope de venta = valor de la carta (85 → 25.000 · Wemby 99 → 500.000)
  : [Math.max(10, Math.round(valueOf(c) * 0.7 / 10) * 10), valueOf(c)];
export const MKT_TAX = 0.05, MKT_HOURS = 12, MKT_SLOTS = 12;
export const ONLINE_HOURS = 72, ONLINE_SLOTS = 20;                          // mercado online: duran 3 días, hasta 20 publicaciones
export const mktSlots = () => (marketOnline() ? ONLINE_SLOTS : MKT_SLOTS);
export const mktHours = () => (marketOnline() ? ONLINE_HOURS : MKT_HOURS);
export function buyMarket(id) {
  const c = BY_ID.get(id); if (!c) return { ok: false, err: 'Esa carta no existe.' };
  const p = mktPrice(c); if (S.coins < p) return { ok: false, err: 'No te alcanzan las monedas.' };
  S.coins -= p; addCard(id, true); S.stats.bought++; track('bought', 1); track('distinct', distinct(), true); persist();
  return { ok: true, price: p };
}
export function listCard(id, price) {
  const c = BY_ID.get(id); if (!c || listable(id) < 1) return { ok: false, err: 'No podés vender esa carta (está en tu equipo o es intransferible).' };
  if (S.mkt.length >= mktSlots()) return { ok: false, err: `Ya tenés ${mktSlots()} cartas en venta.` };
  const [lo, hi] = priceRange(c); price = Math.round(price / 10) * 10;
  if (price < lo || price > hi) return { ok: false, err: `El precio tiene que estar entre ${fmt(lo)} y ${fmt(hi)}.` };
  takeCard(id, false); S.mkt.push({ uid: uid(), id, price, t0: Date.now(), r: Math.random() }); persist();
  return { ok: true };
}
export function cancelListing(u) { const i = S.mkt.findIndex(x => x.uid === u); if (i < 0) return; const [l] = S.mkt.splice(i, 1); addCard(l.id, true); persist(); }
/** Minutos que tarda en venderse una publicación (más cara = mucho más lenta). */
export const sellMinutes = (c, price, r = 0.5) => Math.pow(5, (price / valueOf(c) - 0.8) / 0.1) * (0.5 + r);
/** Vende / vence lo que corresponda. Devuelve los avisos para mostrar. */
export function settleMarket() {
  if (!S) return []; const msgs = [], now = Date.now(); let ch = false;
  S.mkt = S.mkt.filter(l => {
    if (l.online) return true;                                          // las online las resuelve syncMarket() con el servidor
    const c = BY_ID.get(l.id), el = (now - l.t0) / 60000;
    if (el >= sellMinutes(c, l.price, l.r)) { const net = Math.round(l.price * (1 - MKT_TAX)); S.coins += net; S.stats.sold++; track('sold', 1); msgs.push(`Se vendió ${c.n} por ${fmt(net)} monedas`); ch = true; return false; }
    if (el >= MKT_HOURS * 60) { addCard(l.id, true); msgs.push(`${c.n} no se vendió: volvió a tu colección`); ch = true; return false; }
    return true;
  });
  if (ch) persist(); return msgs;
}

/* ------------------------------ mercado ONLINE (supabase/008_mercado_online.sql) ------------------------------ */
const friendly = m => (/does not exist|schema cache|could not find|relation/i.test(m || '') ? 'Falta correr supabase/008_mercado_online.sql en Supabase.' : m || 'Error de conexión');
async function rpc(fn, args = {}) {
  const c = await Auth.getClient(); const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(friendly(error.message)); return data;
}
/** Publicaciones activas de todos los jugadores (ordenadas por precio). */
export async function marketRows() {
  const c = await Auth.getClient();
  const { data, error } = await c.from('utm_vista').select('id,card_id,price,expires_at,seller,seller_name').order('price', { ascending: true }).limit(500);
  if (error) throw new Error(friendly(error.message));
  return (data || []).filter(r => BY_ID.has(r.card_id)).map(r => ({ ...r, id: String(r.id) }));
}
export async function buyOnline(row) {
  if (!BY_ID.has(row.card_id)) return { ok: false, err: 'Esa carta no existe.' };
  if (S.coins < row.price) return { ok: false, err: 'No te alcanzan las monedas.' };
  try {
    const r = await rpc('utm_buy', { p_id: row.id });
    S.coins -= r.price; addCard(r.card_id, true); S.stats.bought++; track('bought', 1); track('distinct', distinct(), true); persist(true);
    return { ok: true, price: r.price, id: r.card_id };
  } catch (e) { return { ok: false, err: e.message }; }
}
export async function listCardOnline(id, price) {
  const c = BY_ID.get(id); if (!c || listable(id) < 1) return { ok: false, err: 'No podés vender esa carta (está en tu equipo o es intransferible).' };
  if (S.mkt.length >= ONLINE_SLOTS) return { ok: false, err: `Ya tenés ${ONLINE_SLOTS} cartas en venta.` };
  const [lo, hi] = priceRange(c); price = Math.round(price / 10) * 10;
  if (!(price >= lo && price <= hi)) return { ok: false, err: `El precio tiene que estar entre ${fmt(lo)} y ${fmt(hi)}.` };
  try {
    const r = await rpc('utm_list', { p_card: id, p_price: price });
    takeCard(id, false); S.mkt.push({ uid: String(r.id), id, price, t0: Date.now(), exp: Date.parse(r.exp) || Date.now() + ONLINE_HOURS * 3600000, online: true }); persist(true);
    return { ok: true };
  } catch (e) { return { ok: false, err: e.message }; }
}
export async function cancelOnline(u) {
  const l = S.mkt.find(x => x.uid === u); if (!l) return { ok: false, err: 'Esa publicación no existe.' };
  try { await rpc('utm_cancel', { p_id: u }); } catch (e) { const m = await syncMarket().catch(() => []); return { ok: false, err: e.message, msgs: m }; }
  S.mkt = S.mkt.filter(x => x !== l); addCard(l.id, true); persist(true); return { ok: true };
}
/* v72 · COMPRADORES AUTOMÁTICOS (supabase/011_mercado_bots.sql): sin otros jugadores nadie compraba. Ahora, de a ratos, un bot le compra a ALGUNAS de tus publicaciones online:
   · solo a ~60 % de las cartas (el resto espera a un jugador real);
   · tarda lo mismo que una venta simulada (sellMinutes) × 2,5: más barata = más rápido, al precio máximo tarda más de media hora;
   · el servidor exige 3 minutos publicada y 15 ventas a bots por día como máximo. */
const BOT_SLOW = 2.5;
const botWants = l => hash(l.uid + 'bot') % 100 < 60;
function botDue(l) {
  const c = BY_ID.get(l.id); if (!c || !l.online || !botWants(l)) return false;
  const r = (hash(l.uid + 'r') % 1000) / 1000, el = (Date.now() - (l.t0 || Date.now())) / 60000;
  return el >= Math.max(4, sellMinutes(c, l.price, r) * BOT_SLOW);
}
let botMissing = false;
let syncing = false;
/** Cobra lo vendido, recupera lo vencido y alinea mis publicaciones con el servidor. Devuelve los avisos para mostrar. */
export async function syncMarket() {
  if (!S || !marketOnline() || syncing) return []; syncing = true;
  try {
    if (!botMissing) for (const l of S.mkt.filter(botDue)) {                                        // v72: bots compradores
      try { await rpc('utm_botbuy', { p_id: l.uid }); } catch (e) { if (/function|schema cache|could not find/i.test(e?.message || '')) { botMissing = true; break; } }
    }
    const r = await rpc('utm_collect'), msgs = []; let ch = false;
    const nm = id => BY_ID.get(id)?.n || 'Tu carta';
    for (const x of r.sold || []) { S.coins += x.payout; S.stats.sold++; track('sold', 1); S.mkt = S.mkt.filter(l => l.uid !== String(x.id)); msgs.push(`Se vendió ${nm(x.card_id)} por ${fmt(x.payout)} monedas`); ch = true; }
    for (const x of r.expired || []) { addCard(x.card_id, true); S.mkt = S.mkt.filter(l => l.uid !== String(x.id)); msgs.push(`${nm(x.card_id)} no se vendió: volvió a tu colección`); ch = true; }
    const act = new Map((r.active || []).map(a => [String(a.id), a]));
    const before = S.mkt.length;
    S.mkt = S.mkt.filter(l => !l.online || act.has(l.uid));                                         // ya no existe en el servidor
    for (const a of act.values()) if (!S.mkt.some(l => l.uid === String(a.id))) {                    // existe en el servidor pero no en mi guardado (otro dispositivo / corte)
      if (qty(a.card_id) > 0) takeCard(a.card_id, false);
      S.mkt.push({ uid: String(a.id), id: a.card_id, price: a.price, t0: Date.now(), exp: Date.parse(a.exp), online: true }); ch = true;
    }
    if (S.mkt.length !== before) ch = true;
    if (ch) { track('distinct', distinct(), true); persist(true); }
    return msgs;
  } catch (e) { console.warn('Mercado online:', e?.message || e); return []; }
  finally { syncing = false; }
}

/* ------------------------------ objetivos ------------------------------ */
export const activeObjectives = () => [...S.obj.daily.map(objById), ...OBJ.filter(o => o.g === 'weekly'), ...OBJ.filter(o => o.g === 'hito')].filter(Boolean);
export const progOf = o => Math.min(o.n, S.obj.prog[o.id] || 0);
export const isClaimed = o => !!S.obj.claimed[o.id];
export const claimable = () => activeObjectives().filter(o => progOf(o) >= o.n && !isClaimed(o)).length;
let done_ = [];
export function track(ev, n = 1, max = false) {
  if (!S) return;
  for (const o of activeObjectives()) {
    if (o.ev !== ev) continue;
    const before = S.obj.prog[o.id] || 0, nxt = (max || o.kind === 'max') ? Math.max(before, n) : before + n;
    S.obj.prog[o.id] = Math.min(o.n, nxt);
    if (before < o.n && S.obj.prog[o.id] >= o.n) done_.push(o.t);
  }
}
export const takeDone = () => { const d = done_; done_ = []; return d; };
export function claimObjective(id) {
  const o = objById(id); if (!o || isClaimed(o) || progOf(o) < o.n) return null;
  S.obj.claimed[id] = 1; const out = grant(o.r); persist(); return out;
}

/* ------------------------------ partidos: preparación ------------------------------ */
const oppName = o => `${nick(o.team)} de ${o.star.n.charAt(0) + o.star.n.slice(1).toLowerCase()}`;
function plan(mode, { rating, diff, title, sub, meta = {}, seed }) {
  const opp = makeOpponent(rating, seed ?? Math.random()); opp.name = oppName(opp);
  return { mode, title, sub, diff, opp, meta, qLen: S.set.q || 180 };
}
export const modeState = k => S.modes[k];
export function planRookie(stage) { const st = ROOKIE[stage - 1]; return plan('rookie', { rating: st.rating, diff: st.diff, title: `Etapa ${stage}`, sub: 'Rookie Battles', meta: { stage }, seed: 'rk' + stage + dayKey() }); }
export function planDream() { const d = S.modes.dream; return plan('dream', { rating: DREAM.ratingOf(d.div), diff: DREAM.diffOf(d.div), title: `División ${d.div}`, sub: 'Dream Live', meta: { div: d.div } }); }
export function planSquad(lvlId) { const l = SQUADB.levels.find(x => x.id === lvlId); return plan('squad', { rating: l.rating, diff: l.diff, title: `Nivel ${l.name}`, sub: 'Squad Battles', meta: { lvl: l.id } }); }
const champRating = () => CHAMPION.ratingMin + Math.floor(Math.random() * (CHAMPION.ratingMax - CHAMPION.ratingMin + 1));
export function planChampion() { championRoll(); return plan('champion', { rating: champRating(), diff: CHAMPION.diff, title: 'Partido del ranking', sub: 'Champion Star', meta: { month: S.modes.champion.month } }); }
export function planAllStar() {
  const r = S.modes.allstar.run, A = ALLSTAR;
  if (r.phase === 'qual') return plan('allstar', { rating: A.qual.rating, diff: A.qual.diff, title: `Clasificatoria · partido ${r.qg + 1} de ${A.qual.games}`, sub: 'All-Star Live', meta: { run: true, phase: 'qual' } });
  return plan('allstar', { rating: A.main.ratingOf(r.g), diff: A.main.diff, title: `Fase final · partido ${r.g + 1} de ${A.main.games}`, sub: 'All-Star Live', meta: { run: true, phase: 'main' } });
}
/** Entradas que le quedan hoy al All-Star Live (se reinicia cada día a las 00:00). */
export function allstarLeft() { const a = S.modes.allstar; return a.day?.d === dayKey() ? Math.max(0, ALLSTAR.perDay - (a.day.n || 0)) : ALLSTAR.perDay; }
export function enterAllStar() {
  const a = S.modes.allstar; if (a.run) return { ok: false, err: 'Ya tenés un torneo en curso.' };
  if (allstarLeft() <= 0) return { ok: false, err: `Ya jugaste el All-Star Live ${ALLSTAR.perDay} veces hoy. Volvé mañana.` };
  if (S.coins < ALLSTAR.fee) return { ok: false, err: 'No te alcanzan las monedas para la entrada.' };
  if (a.day?.d !== dayKey()) a.day = { d: dayKey(), n: 0 };
  a.day.n++; S.coins -= ALLSTAR.fee; a.run = { phase: 'qual', qw: 0, ql: 0, qg: 0, w: 0, l: 0, g: 0, qh: [], mh: [] }; persist(); return { ok: true };
}
/** Suma el resultado de un partido al torneo. rw = premios del partido (null si abandonó: sin premios). Devuelve el estado para la pantalla de resultado. */
function allstarApply(win, rw, lines) {
  const a = S.modes.allstar, r = a.run, A = ALLSTAR, played = r.phase;
  const after = { phase: played, qualified: false, failed: false, done: false };
  if (played === 'qual') {
    r.qg++; (r.qh ||= []).push(win ? 'w' : 'l'); if (win) r.qw++; else r.ql++;
    if (r.qw >= A.qual.need) {
      r.phase = 'main'; after.qualified = true; lines.push(`¡Clasificaste! Ahora vienen ${A.main.games} partidos en Semi-Star: cada victoria te da un premio.`);
      if (rw) { rw.coins += A.qual.reward.coins; lines.push(`Premio por clasificar: ${A.qual.reward.coins.toLocaleString('es-AR')} monedas`); }
    }
    else if (r.qw + (A.qual.games - r.qg) < A.qual.need) {
      after.failed = after.done = true; lines.push(`No clasificaste: hacían falta ${A.qual.need} victorias en ${A.qual.games} partidos.`);
      if (rw) { rw.coins += A.qual.consolation.coins; lines.push(`Premio consuelo: ${A.qual.consolation.coins.toLocaleString('es-AR')} monedas`); }
      a.run = null;
    }
  } else {
    r.g++; (r.mh ||= []).push(win ? 'w' : 'l');
    if (win) { r.w++; const rd = A.rewards[r.w - 1]; if (rw && rd) { rw.coins += rd.coins || 0; rw.packs.push(...(rd.packs || [])); } lines.push(`Premio de la victoria ${r.w} de ${A.main.games}`); } else r.l++;
    if (r.g >= A.main.games) { after.done = true; a.best = Math.max(a.best || 0, r.w); lines.push(`Terminó tu All-Star: ${r.w} victoria${r.w === 1 ? '' : 's'} de ${A.main.games}.`); a.run = null; }
  }
  Object.assign(after, { qw: r.qw, ql: r.ql, qg: r.qg, w: r.w, l: r.l, g: r.g });
  return after;
}

/** Dream Live: aplica un resultado (sube/baja puntos, racha, ascenso y descenso). */
function dreamApply(d, win, lines) {
  const out = { mult: 1, gain: 0, up: false, down: false };
  if (win) {
    d.w++; d.streak = (d.streak || 0) + 1; out.mult = DREAM.mult(d.streak); out.gain = DREAM.win * out.mult; d.pts += out.gain;
    lines.push(`+${out.gain} puntos${out.mult > 1 ? ` · racha de ${d.streak} = ×${out.mult}` : ''}`);
    if (d.pts >= DREAM.perDiv) {
      if (d.div > 1) { d.div--; d.pts = Math.min(DREAM.perDiv - 1, Math.max(DREAM.upMin, d.pts - DREAM.perDiv)); out.up = true; lines.push(`¡Ascendiste a la División ${d.div}!`); }
      else d.pts = DREAM.perDiv;
    }
  } else {
    d.l++; const had = d.streak || 0; d.streak = 0; d.pts -= DREAM.loss;
    lines.push(`−${DREAM.loss} puntos${had >= 2 ? ` · se cortó la racha de ${had}` : ''}`);
    if (d.pts < 0) {
      if (d.div < DREAM.lowest) { d.div++; d.pts = DREAM.relegPts; out.down = true; lines.push(`Descendiste a la División ${d.div}.`); }
      else d.pts = 0;
    }
  }
  return out;
}

/* ------------------------------ partidos: resultado ------------------------------ */
const evAdd = (mode, win) => { if (!win) return 0; const p = EVENT.pts[mode] || 0; S.ev.pts += p; return p; };
/** result = { scoreA, scoreB, stats:{tpm,ast,stl,blk,reb} } (A = el usuario). Devuelve el resumen para la pantalla de resultado. */
export function finishMatch(pl, result) {
  if (result.abandoned) return abandonMatch(pl);
  const sa = result.scoreA, sb = result.scoreB, win = sa > sb, m = pl.mode, st = result.stats || {};
  S.stats.p++; win ? S.stats.w++ : S.stats.l++; S.stats.pts += sa;
  track('play', 1); if (win) track('win', 1); track('pts', sa);
  for (const k of ['tpm', 'ast', 'stl', 'blk', 'reb']) if (st[k]) track(k, st[k]);
  const lines = [], rw = { coins: win ? MATCH_PAY.win : MATCH_PAY.play, xp: win ? 40 : 15, packs: [] }, extra = [];
  let stars = 0;
  if (m === 'rookie') {
    const stg = pl.meta.stage, def = ROOKIE[stg - 1], R = S.modes.rookie, first = !(R.stars[stg] > 0);
    if (win) {
      stars = sa - sb >= 15 ? 3 : sa - sb >= 8 ? 2 : 1; R.stars[stg] = Math.max(R.stars[stg] || 0, stars);
      if (first) { rw.coins += def.coins; rw.packs.push(...def.packs); R.stage = Math.max(R.stage, Math.min(10, stg + 1)); lines.push(`Etapa ${stg} superada por primera vez`); }
      track('rookie_clear', Object.values(R.stars).filter(x => x > 0).length, true);
      evAdd('rookie', true) && extra.push(`+${EVENT.pts.rookie} pts ${EVENT.name}`);
    }
  } else if (m === 'dream') {
    const d = S.modes.dream;
    if (win) { track('dream_win', 1); evAdd('dream', true); extra.push(`+${EVENT.pts.dream} pts ${EVENT.name}`); }
    const r = dreamApply(d, win, lines);
    if (r.up) { rw.packs.push(d.div <= 5 ? 'elite' : 'oro'); rw.coins += 1000; track('divprog', 11 - d.div, true); }
    pl.meta.after = { div: d.div, pts: d.pts, streak: d.streak, mult: r.mult, gain: r.gain, up: r.up, down: r.down };
  } else if (m === 'squad') {
    const l = SQUADB.levels.find(x => x.id === pl.meta.lvl), q = S.modes.squad; q.played++;
    if (win) { q.pts += l.pts; rw.coins += l.coins; track('squad_win', 1); evAdd('squad', true); extra.push(`+${EVENT.pts.squad} pts ${EVENT.name}`); lines.push(`+${l.pts} puntos de la semana`); }
  } else if (m === 'champion') {
    const c = championRoll(), margin = sa - sb, d = championApply(c, win, margin, false);
    lines.push(win ? `+${d} puntos del ranking${c.streak >= 2 ? ` · racha de ${c.streak}` : ''}${margin >= CHAMPION.bigMargin ? ' · victoria amplia' : ''}` : `${d} puntos del ranking`);
    if (win) { evAdd('champion', true); extra.push(`+${EVENT.pts.champion} pts ${EVENT.name}`); }
    pl.meta.after = { pts: c.pts, delta: d, streak: c.streak, w: c.w, l: c.l };
    reportChampion(win, margin, false);
  } else if (m === 'allstar') {
    if (win) { evAdd('allstar', true); extra.push(`+${EVENT.pts.allstar} pts ${EVENT.name}`); }
    const after = allstarApply(win, rw, lines); pl.meta.after = after;
    if (win && after.phase === 'main') track('allstar_run', after.w, true);
  }
  const got = grant(rw); S.stats.lastXpWin = win;
  try { Auth.queueXp(win ? 35 : 10); } catch { /* sin perfil */ }
  persist();
  return { win, sa, sb, stars, lines: [...lines, ...extra], rewards: got, ot: result.ot || 0 };
}

/** Abandonar un partido: NO da monedas, ni XP, ni sobres, ni objetivos, ni puntos de evento. Solo cuenta como derrota donde se podría abusar (Dream Live / All-Star). */
function abandonMatch(pl) {
  const m = pl.mode, lines = ['Abandonaste: no ganás monedas ni experiencia.'];
  S.stats.p++; S.stats.l++;
  if (m === 'dream') { const d = S.modes.dream; const r = dreamApply(d, false, lines); pl.meta.after = { div: d.div, pts: d.pts, streak: 0, mult: 1, gain: 0, up: false, down: r.down }; }
  else if (m === 'allstar') { lines.push('Contó como derrota en el torneo.'); pl.meta.after = allstarApply(false, null, lines); }
  else if (m === 'champion') { const c = championRoll(), d = championApply(c, false, 0, true); lines.push(`${d} puntos del ranking por abandonar.`); pl.meta.after = { pts: c.pts, delta: d, streak: 0, w: c.w, l: c.l }; reportChampion(false, 0, true); }
  persist();
  return { win: false, sa: 0, sb: 0, stars: 0, lines, rewards: [], ot: 0, abandoned: true };
}

/* ------------------------------ Champion Star (ranking mensual online) ------------------------------ */
export const championAvailable = () => !!(Auth.configured && Auth.getProfile()?.id && !Auth.isGuest());
const csFriendly = m => (/does not exist|schema cache|could not find|relation|function/i.test(m || '') ? 'Falta correr supabase/010_champion_star.sql en Supabase.' : m || 'Error de conexión');
async function csRpc(fn, args = {}) {
  const c = await Auth.getClient(); const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(csFriendly(error.message)); return data;
}
/** Si cambió el mes, el puntaje arranca de cero (el servidor hace lo mismo). */
function championRoll() { const c = S.modes.champion, mk = monthKey(); if (c.month !== mk) Object.assign(c, { month: mk, pts: 0, w: 0, l: 0, streak: 0, best: 0 }); return c; }
/** Misma cuenta que el servidor (cs_report): sirve para mostrar el resultado al instante; después manda lo que dice el servidor. Devuelve la variación de puntos. */
function championApply(c, win, margin, abandon) {
  const C = CHAMPION, before = c.pts;
  if (win && !abandon) { const d = C.win + Math.min(c.streak || 0, C.streakMax) * C.streakBonus + (margin >= C.bigMargin ? C.bigWin : 0); c.pts += d; c.w++; c.streak = (c.streak || 0) + 1; c.best = Math.max(c.best || 0, c.streak); }
  else { c.pts = Math.max(0, c.pts - (abandon ? C.abandon : C.loss)); c.l++; c.streak = 0; }
  return c.pts - before;
}
async function reportChampion(win, margin, abandon) {
  if (!championAvailable()) return;
  try {
    const r = await csRpc('cs_report', { p_win: !!win, p_margin: Math.max(0, Math.round(margin || 0)), p_abandon: !!abandon });
    const c = S.modes.champion; if (r && r.month === c.month) { c.pts = r.pts; c.w = r.w; c.l = r.l; c.streak = r.streak; c.best = r.best; }
    persist();
  } catch (e) { console.warn('Champion Star: no se pudo reportar el partido:', e?.message || e); }
}
/** Ranking del mes: { month, rows: [{ rk, name, pts, w, l, me }], me: { rk, pts, w, l, streak, best } | null } */
export async function championBoard() {
  const r = await csRpc('cs_board', { p_limit: 30 }), c = championRoll();
  if (r?.me && r.month === c.month) { c.pts = r.me.pts; c.w = r.me.w; c.l = r.me.l; c.streak = r.me.streak; c.best = r.me.best; persist(); }
  return r;
}
/** ¿Tengo un premio de un mes terminado sin reclamar? → { month, rank } o null */
export async function championPending() { try { return await csRpc('cs_pending'); } catch (e) { console.warn('Champion Star:', e?.message || e); return null; } }
export async function claimChampion(month) {
  try {
    const r = await csRpc('cs_claim', { p_month: month }), rw = CHAMPION.top[(r?.rank || 0) - 1];
    if (!rw) return { ok: false, err: 'No quedaste entre los 3 primeros.' };
    const lines = grant(rw); persist(); return { ok: true, rank: r.rank, lines };
  } catch (e) { return { ok: false, err: e.message }; }
}

/* ------------------------------ premios semanales ------------------------------ */
export function claimWeekly(kind, idx) {
  const lists = { dream: [DREAM.weekly, S.modes.dream.claimed, S.modes.dream.w], squad: [SQUADB.weekly, S.modes.squad.claimed, S.modes.squad.pts] };
  const [tbl, claimed, val] = lists[kind]; const t = tbl[idx]; if (!t || claimed.includes(idx) || val < t[0]) return null;
  claimed.push(idx); const out = grant(t[1]); persist(); return out;
}
export function claimEvent() { if (S.ev.claimed || S.ev.pts < EVENT.target) return null; S.ev.claimed = true; const out = grant(EVENT.reward); persist(); return out; }
export { value, valueOf, quickSell, quickSellOf };

export const DIFF_NAME = { rookie: 'Rookie', semirookie: 'Semi-Rookie', pro: 'Profesional', semistar: 'Semi-Star', allstar: 'All-Star' };
