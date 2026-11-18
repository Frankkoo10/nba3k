import { makeRng, clamp, gauss, pick, rint, shuffle, day, uid } from './util.js';
import { LEAGUES, CLUBS, DIVISIONS, CITY } from './data.js';
import * as GEN from './gen.js';
import { baseOvr, ovrNow, POS } from './gen.js';
import { seasonDates, cupDraw, buildSchedule, buildPreseason, confOf, divOf, NBA_TEAMS, resetGid, getGid } from './cal.js';
import { indexRosters, place, ros, msg, news, teamStrength } from './state.js';

/* ============================================================================
   Creación del mundo: 30 equipos NBA (con los planteles de tu base de datos), G League, 5 ligas de afuera con sus clubes,
   clases de secundarias para los próximos drafts, picks, calendario y finanzas.
   ========================================================================== */
export const DIFFS = {
  rookie: { name: 'Novato', trade: 0.88, board: 0.8, desc: 'El mercado y la directiva son generosos.' },
  pro: { name: 'Profesional', trade: 1.0, board: 1.0, desc: 'Equilibrado.' },
  allstar: { name: 'All-Star', trade: 1.1, board: 1.15, desc: 'La IA negocia más duro y la directiva exige más.' },
  legend: { name: 'Leyenda', trade: 1.22, board: 1.3, desc: 'Cada cambio cuesta. La directiva no perdona.' },
};
export const DEFAULT_COACH = { first: 'Alex', last: 'Navarro', nat: 'ARG', age: 41, skin: 2, hair: 1, hairColor: '#15120f', beard: 1, glasses: 0, suit: 'formal', suitColor: '#1f2a44', shirtColor: '#ffffff', tieColor: '#b3202a', arch: 'tactico', philosophy: 'equilibrado' };

/** Perfil de ataque/defensa por defecto del equipo (usa las mismas opciones del menú previo del partido). */
export const defaultTactic = () => ({ pace: 'normal', shot: 'balanced', pass: 'balanced', def: 'normal' });

function fillRoster(G, rng, ab, list) {
  const players = list.filter(r => !r.generic).map(r => GEN.fromNormalized(rng, r, ab));
  const want = 14;
  const lvl = players.length ? players.map(baseOvr).sort((a, b) => b - a).slice(0, 8).reduce((a, b) => a + b, 0) / Math.min(8, players.length) : 72;
  let k = 0;
  while (players.length < want) {
    const pos = POS[(k++ + players.length) % 5], deep = players.length >= 9;
    const o = Math.round(deep ? gauss(rng, 52, 4) : gauss(rng, Math.min(lvl - 9, 66), 4));
    const age = deep ? rint(rng, 19, 31) : rint(rng, 22, 34);
    players.push(GEN.genPlayer(rng, { ovr: clamp(o, 42, 72), age, pos, league: 'NBA' }));
  }
  const used = new Set(); for (const p of players) { while (used.has(p.num)) p.num = rint(rng, 0, 55); used.add(p.num); p.tm = ab; p.lg = 'NBA'; }
  players.sort((a, b) => ovrNow(b) - ovrNow(a));
  players.forEach((p, i) => {
    const o = ovrNow(p), young = p.age <= 22 && o < 70;
    if (young) GEN.setContract(p, GEN.rookieSalary(rint(rng, 3, 40)), rint(rng, 1, 3), 'rookie');
    else GEN.setContract(p, GEN.salaryFor(o, p.age) * (0.85 + rng() * 0.3), o >= 80 ? rint(rng, 2, 5) : rint(rng, 1, 4), 'std');
    if (i >= 13 && o < 55) { GEN.setContract(p, 0.65, 2, 'two'); p.gl = true; }
    G.P[p.id] = p;
  });
}

function makeClub(G, rng, lg, c) {
  const [id, name, c1, c2, city, prestige] = c, key = `${lg}:${id}`, L = LEAGUES[lg];
  G.clubs[key] = { key, lg, id, name, c1, c2, city, prestige, w: 0, l: 0 };
  const n = 12;
  for (let i = 0; i < n; i++) {
    const lvl = L.lvl + (prestige - 0.6) * 12, o = Math.round(i < 2 ? gauss(rng, lvl + 8, 5) : gauss(rng, lvl - i * 0.9, 4.5));
    const p = GEN.genPlayer(rng, { league: lg, ovr: clamp(o, 40, lg === 'EUR' ? 86 : 78), age: rint(rng, 19, 36), pos: POS[(i + rint(rng, 0, 4)) % 5] });
    p.tm = key; p.lg = lg;
    GEN.setContract(p, 0.5 + Math.max(0, ovrNow(p) - 50) * 0.08, rint(rng, 1, 3), 'std', { clause: 0 });
    G.P[p.id] = p;
  }
}

export function newProspectClass(G, rng, cls, size, Y) {
  const lag = cls - (Y + 1);                              // 0 = el próximo draft, 1 = el siguiente…
  for (let i = 0; i < size; i++) {
    const p = GEN.genProspect(rng, i, cls);
    p.age = 18 - lag + (p.prospect.src === 'COL' ? rint(rng, 1, 3) : p.prospect.src === 'INT' ? rint(rng, 0, 2) : 0);
    if (lag) { for (const k of GEN.AK) p.at[k] = clamp(p.at[k] - 3 * lag - rint(rng, 0, 2), 25, 99); }
    G.P[p.id] = p; G.prospects.push(p.id);
  }
}
export const sortProspects = (G, cls) => G.prospects.map(id => G.P[id]).filter(p => p && p.prospect.cls === cls);

export function createWorld(o) {
  const seed = o.seed ?? Math.floor(Math.random() * 1e9), rng = makeRng(seed), Y = o.Y ?? 2026;
  GEN.resetNames(); resetGid(0);
  const D = seasonDates(Y);
  const G = {
    v: 1, seed, id: 'c' + Date.now().toString(36), created: Date.now(), Y, today: D.camp, D, phase: 'camp', coach: { ...DEFAULT_COACH, ...(o.coach || {}) }, user: o.user, diff: o.diff || 'pro',
    teams: {}, clubs: {}, P: {}, R: {}, prospects: [], picks: [], sched: [], cup: { groups: {}, ko: null, champ: null, mvp: null }, po: null, pi: null, sl: null, dr: null, lott: null,
    inbox: [], news: [], log: [], mid: 0, hist: { champs: [], awards: [], seasons: [] }, dead: {}, settings: { autoTrain: true, intensity: 'normal', pause: ['game'] },
    staff: { coach: 2, scout: 2, med: 2, gm: 2 }, fin: { budget: 0, cash: 0 }, board: { conf: 62, goals: [], seasonsW: 0 }, sc: { watch: [], know: {} },
    tac: defaultTactic(), lineup: [], plan: {}, mailQ: [], rec: { w: 0, l: 0 }, stats: { coachW: 0, coachL: 0, titles: 0, cups: 0, playoffs: 0 }, flags: {}, offers: [],
  };
  G.rng = rng;
  /* equipos */
  for (const [dn, { conf, teams }] of Object.entries(DIVISIONS)) for (const ab of teams) {
    const base = o.teams.find(t => t.ab === ab);
    G.teams[ab] = { ab, name: base.name, c1: base.c1, c2: base.c2, logo: base.logo, conf, div: dn, w: 0, l: 0, pf: 0, pa: 0, cw: 0, cl: 0, cpd: 0, streak: 0, l10: [], strat: 'mid', tac: defaultTactic(), lineup: [], hw: 0, hl: 0 };
    fillRoster(G, rng, ab, o.rosters?.[ab] ? [...o.rosters[ab].starters, ...o.rosters[ab].bench] : []);
  }
  /* cap: se ajustan salarios para que ningún equipo se vaya por las nubes ni quede desierto */
  for (const ab of NBA_TEAMS) {
    const ps = Object.values(G.P).filter(p => p.tm === ab), tot = ps.reduce((t, p) => t + p.con.sal, 0);
    const k = tot > 212 ? 205 / tot : tot < 125 ? 140 / tot : 1; if (k !== 1) for (const p of ps) p.con.sal = Math.max(GEN.CAP.min * (p.con.type === 'two' ? 0.5 : 1), Math.round(p.con.sal * k * 10) / 10);
  }
  /* libres: NBA-level y G League */
  for (let i = 0; i < 46; i++) { const p = GEN.genPlayer(rng, { ovr: clamp(Math.round(gauss(rng, 55, 4.5)), 44, 68), age: rint(rng, 23, 36), league: 'FA' }); p.lg = 'FA'; p.fa = { ask: GEN.salaryFor(baseOvr(p), p.age) * 0.9, yrs: rint(rng, 1, 2) }; G.P[p.id] = p; }
  for (let i = 0; i < 80; i++) { const p = GEN.genPlayer(rng, { ovr: clamp(Math.round(gauss(rng, 50, 4)), 40, 62), age: rint(rng, 20, 28), league: 'GL', potBonus: rint(rng, 0, 7) }); p.lg = 'GL'; p.fa = { ask: 0.6, yrs: 2 }; G.P[p.id] = p; }
  /* ligas de afuera */
  for (const [lg, clubs] of Object.entries(CLUBS)) for (const c of clubs) makeClub(G, rng, lg, c);
  /* clases de prospectos */
  newProspectClass(G, rng, Y + 1, 130, Y); newProspectClass(G, rng, Y + 2, 100, Y); newProspectClass(G, rng, Y + 3, 90, Y);
  /* picks de los próximos 4 drafts */
  for (let k = 1; k <= 4; k++) for (const rd of [1, 2]) for (const ab of NBA_TEAMS) G.picks.push({ y: Y + k, rd, orig: ab, own: ab });
  indexRosters(G);
  /* calendario */
  const ranked = { E: [], W: [] }; for (const conf of ['E', 'W']) ranked[conf] = NBA_TEAMS.filter(t => confOf[t] === conf).sort((a, b) => teamStrength(G, b) - teamStrength(G, a));
  G.cup.groups = cupDraw(rng, ranked);
  G.sched = [...buildPreseason(rng, D), ...buildSchedule(rng, D, G.cup.groups)].sort((a, b) => a.d - b.d || a.id - b.id);
  G.gid = getGid();
  /* estrategia IA, líneas, finanzas */
  initStrategies(G);
  const ut = G.teams[G.user], str = teamStrength(G, G.user), rk = NBA_TEAMS.slice().sort((a, b) => teamStrength(G, b) - teamStrength(G, a)).indexOf(G.user) + 1;
  G.fin = { budget: Math.round(16 + (30 - rk) * 0.35), cash: 12, rev: 0, exp: 0 };
  G.stats.startRank = rk;
  return G;
}

export function initStrategies(G) {
  const rk = NBA_TEAMS.slice().sort((a, b) => teamStrength(G, b) - teamStrength(G, a));
  rk.forEach((ab, i) => { G.teams[ab].strat = i < 9 ? 'contender' : i < 21 ? 'mid' : 'rebuild'; G.teams[ab].rk0 = i + 1; });
}
