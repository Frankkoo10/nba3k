import { clamp, gauss, pick, rint, shuffle, sum, avg, day, fmtDay, money, onOrAfter, dow, ymd } from './util.js';
import * as GEN from './gen.js';
import { ovrNow, baseOvr, CAP, genProspect, genPlayer, AK, setContract, POS } from './gen.js';
import * as SIM from './sim.js';
import * as P from './prog.js';
import * as M from './market.js';
import * as E from './events.js';
import { seasonDates, cupDraw, buildSchedule, buildPreseason, buildSummerLeague, seriesGames, confOf, NBA_TEAMS, mkGame, resetGid, getGid } from './cal.js';
import { ros, place, msg, news, standingsOf, payroll, teamStrength, rosterCount, removePlayer, rankIn, indexRosters } from './state.js';
import { newProspectClass } from './world.js';

/* ============================================================================
   Motor de la temporada: avanza día por día. Simula todos los partidos de la liga, mantiene tablas, NBA Cup, play-in y playoffs,
   hace evolucionar a los jugadores (forma, actualizaciones, entrenamiento, verano), maneja lesiones, mensajes, agencia libre,
   lotería/draft/Summer League y el cambio de temporada.
   El usuario manda cuándo parar: solo se frena por sus partidos (si no los simula), el draft, el recorte de plantel o si lo echan.
   ========================================================================== */
const byDay = G => { if (!G._bd || G._bdN !== G.sched.length) { G._bd = new Map(); for (const g of G.sched) { const a = G._bd.get(g.d); a ? a.push(g) : G._bd.set(g.d, [g]); } G._bdN = G.sched.length; } return G._bd; };
export const gamesOn = (G, d) => byDay(G).get(d) || [];
const addGames = (G, gs) => { for (const g of gs) G.sched.push(g); G.sched.sort((a, b) => a.d - b.d || a.id - b.id); G._bdN = -1; G.gid = getGid(); };
export const userGameOn = (G, d = G.today) => gamesOn(G, d).find(g => !g.done && (g.h === G.user || g.a === G.user)) || null;
export const nextUserGame = G => G.sched.find(g => !g.done && g.d >= G.today && (g.h === G.user || g.a === G.user)) || null;
export const lastUserGame = G => { for (let i = G.sched.length - 1; i >= 0; i--) { const g = G.sched[i]; if (g.done && (g.h === G.user || g.a === G.user)) return g; } return null; };
const rng_ = G => G.rng;
export const isSeasonGame = g => g.ty === 'rs' || g.ty === 'cup';

/* ---------- planteles y partidos ---------- */
export function healthy(G, ab) {
  let h = ros(G, ab).filter(p => p.lg === 'NBA' && !p.gl && !SIM.isOut(p));
  if (h.length < 9) h = h.concat(ros(G, ab).filter(p => p.lg === 'NBA' && p.gl && !SIM.isOut(p)));
  return h;
}
export function lineupFor(G, ab, pool = null) {
  const h = pool || healthy(G, ab);
  return ab === G.user && G.lineup.length ? SIM.applyLineup(G.lineup, h) : SIM.autoLineup(h);
}
const COACH_BONUS = { tactico: 0.5, motivador: 0.2, formador: 0.1, ofensivo: 0.3, defensivo: 0.3 };
function levelOf(G, ab, lineup) {
  const tl = SIM.teamLevel(lineup);
  if (ab === G.user) { tl.r += (COACH_BONUS[G.coach.arch] || 0.3) + (G.coach.perk || 0); const t = G.tac; if (t.shot === 'threes') tl.off += 0.8; if (t.def === 'pressure') tl.def += 0.8; if (t.pass === 'team') tl.off += 0.4; }
  return tl;
}
export function simGame(G, g, ovr = null) {
  const rng = rng_(G), H = lineupFor(G, g.h), A = lineupFor(G, g.a), tH = levelOf(G, g.h, H), tA = levelOf(G, g.a, A);
  const neutral = g.ty === 'cupS' || g.ty === 'cupF' || g.ty === 'sl' && false;
  const isUser = g.h === G.user || g.a === G.user;
  let sc = ovr ? { hs: ovr.hs, as: ovr.as, ot: ovr.ot || 0 } : SIM.simScore(rng, { tl: tH }, { tl: tA }, { neutral, pace: (g.h === G.user ? G.tac : g.a === G.user ? G.tac : null)?.pace === 'fast' ? 1.03 : (isUser && G.tac.pace === 'slow') ? 0.97 : 1 });
  if (g.ty === 'sl') sc = ovr ? sc : { ...sc, hs: Math.round(sc.hs * 0.82), as: Math.round(sc.as * 0.82) };
  const bH = SIM.boxScore(rng, H, sc.hs, sc.as, sc.ot, ovr?.ptsH), bA = SIM.boxScore(rng, A, sc.as, sc.hs, sc.ot, ovr?.ptsA);
  return finishGame(G, g, sc, bH, bA, H, A);
}
function finishGame(G, g, sc, bH, bA, H, A) {
  const rng = rng_(G);
  g.done = true; g.hs = sc.hs; g.as = sc.as; g.ot = sc.ot || 0;
  const user = g.h === G.user || g.a === G.user;
  if (user) g.box = { h: bH, a: bA };
  const rec = isSeasonGame(g), po = g.ty === 'po', th = G.teams[g.h], ta = G.teams[g.a], hw = g.hs > g.as;
  if (rec) {
    th.pf += g.hs; th.pa += g.as; ta.pf += g.as; ta.pa += g.hs;
    if (hw) { th.w++; ta.l++; th.streak = th.streak > 0 ? th.streak + 1 : 1; ta.streak = ta.streak < 0 ? ta.streak - 1 : -1; } else { ta.w++; th.l++; ta.streak = ta.streak > 0 ? ta.streak + 1 : 1; th.streak = th.streak < 0 ? th.streak - 1 : -1; }
    th.l10.push(hw ? 1 : 0); ta.l10.push(hw ? 0 : 1); if (th.l10.length > 10) th.l10.shift(); if (ta.l10.length > 10) ta.l10.shift();
    if (g.ty === 'cup') { const d = g.hs - g.as; if (hw) { th.cw++; ta.cl++; } else { ta.cw++; th.cl++; } th.cpd += d; ta.cpd -= d; }
  }
  const meta = { won: [hw, !hw], ab: [g.h, g.a] };
  [[bH, H, g.h, hw, g.hs - g.as], [bA, A, g.a, !hw, g.as - g.hs]].forEach(([box, lineup, ab, won, mg]) => {
    for (const l of box) {
      const p = G.P[l.id]; if (!p) continue;
      const pf = SIM.perfOf(l, ovrNow(p));
      if (g.ty === 'sl') { p.sl = p.sl || SIM.newStats(); SIM.addLine(p.sl, l, pf); }
      else if (g.ty !== 'pre') {
        if (po) { p.stp = p.stp || SIM.newStats(); SIM.addLine(p.stp, l, pf); } else { p.st = p.st || SIM.newStats(); SIM.addLine(p.st, l, pf); }
        P.setForm(p, pf, l.min); p.upd = (p.upd || 0) + 1;
        if (ab === G.user || true) { const exp = P.roleMin(p.role); p.mor = clamp((p.mor || 60) + (won ? 0.35 : -0.3) + (l.min < exp * 0.55 && p.role !== 'banco' && p.role !== 'prospecto' ? -0.9 : l.min >= exp * 0.85 ? 0.15 : 0), 5, 99); }
      }
      if (!p.inj) { const inj = SIM.rollInjury(G.rng, p, l.min, ab === G.user ? G.staff.med : 2, ab === G.user && G.settings.intensity === 'high' ? 1.1 : 1); if (inj) { p.inj = inj; if (ab === G.user) msg(G, { kind: 'injury', from: 'med', pid: p.id, subj: `Lesión: ${p.n}`, body: `${p.n} sufrió: ${inj.t.toLowerCase()}. Estará fuera unos ${inj.d} días${inj.d > 120 ? ' (se perderá el resto de la temporada).' : '.'}` }); } }
    }
  });
  if (user) {
    const mine = g.h === G.user, won = mine ? hw : !hw;
    if (['rs', 'cup', 'po', 'cupQ', 'cupS', 'cupF'].includes(g.ty)) { if (won) G.stats.coachW++; else G.stats.coachL++; }
    G.board.conf = clamp(G.board.conf + (won ? 0.12 : -0.15), 0, 100);
    userAfter(G, g, won, mine);
  }
  if (po) seriesAfter(G, g);
  return g;
}
function userAfter(G, g, won, mine) {
  const rng = rng_(G), opp = mine ? g.a : g.h, box = mine ? g.box.h : g.box.a;
  const mg = Math.abs(g.hs - g.as), t = G.teams[G.user], hot = box.filter(l => l.pts >= 30).sort((a, b) => b.pts - a.pts)[0];
  const ro = box.filter(l => G.P[l.id]?.rk === G.Y + (G.phase === 'rs' ? 0 : 0) && l.min >= 12)[0];
  const ctx = { lost: !won, won, diff: mg, opp: G.teams[opp]?.name || opp, score: `${g.hs}-${g.as}`, starLine: hot ? G.P[hot.id] : null, rookie: ro ? G.P[ro.id] : null, streakL: t.streak < 0 ? -t.streak : 0, deadline: G.today >= G.D.deadline - 10 && G.today < G.D.deadline };
  if (g.ty === 'rs' || g.ty === 'po' || g.ty === 'cup') E.pressConference(G, rng, ctx);
  for (const l of box) { const p = G.P[l.id]; if (p && l.pts >= 40 && !p.flag40) { p.flag40 = G.Y; msg(G, { kind: 'info', from: 'press', subj: `¡${p.n} anotó ${l.pts}!`, body: `Noche histórica de ${p.n}: ${l.pts} puntos, ${l.reb} rebotes y ${l.ast} asistencias contra ${ctx.opp}.` }); p.mor = clamp(p.mor + 6, 5, 99); } }
}

/* ---------- series, Copa, play-in ---------- */
function seriesAfter(G, g) {
  const s = G.po?.all.find(x => x.id === g.ser); if (!s) return;
  const hiWon = (g.h === s.hi) === (g.hs > g.as);
  if (hiWon) s.wh++; else s.wl++;
  if (s.wh === 4 || s.wl === 4) {
    s.done = true; s.win = s.wh === 4 ? s.hi : s.lo; s.end = g.d;
    G.sched = G.sched.filter(x => !(x.ser === s.id && !x.done)); G._bdN = -1;
  }
}
function leagueRanks(G) { return { E: standingsOf(G, 'E').map(t => t.ab), W: standingsOf(G, 'W').map(t => t.ab) }; }
function startPlayIn(G) {
  const R = leagueRanks(G), D = G.D, games = [];
  G.pi = { E: {}, W: {} };
  for (const c of ['E', 'W']) {
    const s = R[c]; G.pi[c] = { seeds: s.slice(0, 10), done: false };
    games.push(mkGame(D.piStart, s[6], s[7], 'pi', { k: '78', conf: c }), mkGame(D.piStart, s[8], s[9], 'pi', { k: '910', conf: c }));
  }
  addGames(G, games); G.phase = 'pi';
  news(G, 'Comienza el Play-in: los puestos 7 a 10 de cada conferencia pelean por los dos últimos lugares de playoffs.', 'liga');
}
const wonBy = g => (g.hs > g.as ? g.h : g.a), lostBy = g => (g.hs > g.as ? g.a : g.h);
function playInTick(G) {
  const D = G.D;
  if (G.today === D.piStart && !G.pi.E.g3 && gamesOn(G, D.piStart).filter(g => g.ty === 'pi').every(g => g.done)) {
    const games = [];
    for (const c of ['E', 'W']) {
      const a = G.sched.find(g => g.ty === 'pi' && g.conf === c && g.k === '78'), b = G.sched.find(g => g.ty === 'pi' && g.conf === c && g.k === '910');
      G.pi[c].s7 = wonBy(a); G.pi[c].g3 = true;
      games.push(mkGame(D.pi2, lostBy(a), wonBy(b), 'pi', { k: '8', conf: c }));
    }
    addGames(G, games);
  } else if (G.today === D.pi2 && gamesOn(G, D.pi2).filter(g => g.ty === 'pi').length && gamesOn(G, D.pi2).filter(g => g.ty === 'pi').every(g => g.done)) {
    for (const c of ['E', 'W']) { const g = G.sched.find(x => x.ty === 'pi' && x.conf === c && x.k === '8'); G.pi[c].s8 = wonBy(g); G.pi[c].done = true; }
    startPlayoffs(G);
  }
}
function startPlayoffs(G) {
  const R = leagueRanks(G), D = G.D, all = []; let sid = 0;
  const mk = (rd, conf, hi, lo, src, sh, sl) => { const s = { id: ++sid, rd, conf, hi, lo, sh, sl, wh: 0, wl: 0, done: false, win: null, src, started: false }; all.push(s); return s; };
  const seeds = {};
  for (const c of ['E', 'W']) { const s = R[c].slice(0, 6); s.push(G.pi[c].s7, G.pi[c].s8); seeds[c] = s; }
  const rounds = [[], [], [], []];
  for (const c of ['E', 'W']) {
    const s = seeds[c];
    const a = mk(1, c, s[0], s[7], null, 1, 8), b = mk(1, c, s[3], s[4], null, 4, 5), d = mk(1, c, s[2], s[5], null, 3, 6), e = mk(1, c, s[1], s[6], null, 2, 7);
    const sf1 = mk(2, c, null, null, [a.id, b.id]), sf2 = mk(2, c, null, null, [d.id, e.id]);
    mk(3, c, null, null, [sf1.id, sf2.id]);
  }
  const cfs = all.filter(s => s.rd === 3); mk(4, 'F', null, null, [cfs[0].id, cfs[1].id]);
  G.po = { all, seeds, round: 1, champ: null, fin: null };
  for (const s of all.filter(s => s.rd === 1)) startSeries(G, s, D.poStart);
  G.phase = 'po'; news(G, '¡Arrancan los playoffs de la NBA!', 'liga'); G.stats.userPO = Object.values(seeds).flat().includes(G.user);
  if (G.stats.userPO) { G.stats.playoffs++; msg(G, { kind: 'info', from: 'board', subj: '¡Playoffs!', body: `${G.teams[G.user].name} clasificó a los playoffs de la NBA.` }); }
}
function startSeries(G, s, start) {
  s.started = true;
  const w = ab => G.teams[ab].w / Math.max(1, G.teams[ab].w + G.teams[ab].l);
  if (s.rd === 4 && w(s.lo) > w(s.hi)) [s.hi, s.lo] = [s.lo, s.hi];
  addGames(G, seriesGames(s.hi, s.lo, start, 'po', s.id));
}
function playoffsTick(G) {
  const po = G.po; if (!po || po.champ) return;
  for (const s of po.all) {
    if (s.started) continue;
    const [a, b] = s.src.map(id => po.all.find(x => x.id === id));
    if (a.done && b.done) {
      const rk = ab => G.teams[ab].w / Math.max(1, G.teams[ab].w + G.teams[ab].l);
      const wa = a.win, wb = b.win; const hiFirst = s.rd === 4 ? true : (po.seeds[s.conf].indexOf(wa) < po.seeds[s.conf].indexOf(wb));
      s.hi = hiFirst ? wa : wb; s.lo = hiFirst ? wb : wa; s.sh = po.seeds[s.conf]?.indexOf(s.hi) + 1; s.sl = po.seeds[s.conf]?.indexOf(s.lo) + 1;
      startSeries(G, s, Math.max(G.today + 1, Math.max(a.end, b.end) + 2));
    }
  }
  const fin = po.all.find(s => s.rd === 4);
  if (fin.done && !po.champ) {
    po.champ = fin.win; G.phase = 'post'; G.hist.champs.push({ y: G.Y, ab: fin.win, fin: [fin.hi, fin.lo], sc: [fin.wh, fin.wl] });
    finalsMvp(G, fin); endSeason(G);
  }
}
function finalsMvp(G, fin) {
  const best = ros(G, fin.win).filter(p => p.stp).map(p => ({ p, s: p.stp.pts / Math.max(1, p.stp.gp) + p.stp.ast * 0.4 / Math.max(1, p.stp.gp) + p.stp.reb * 0.3 / Math.max(1, p.stp.gp) })).sort((a, b) => b.s - a.s)[0];
  const w = G.teams[fin.win];
  news(G, `🏆 ${w.name} son campeones de la NBA ${G.Y}-${String((G.Y + 1) % 100)}.${best ? ` MVP de las Finales: ${best.p.n}.` : ''}`, 'liga'); G.po.mvp = best?.p.id;
  if (fin.win === G.user) { G.stats.titles++; G.board.conf = clamp(G.board.conf + 12, 0, 100); msg(G, { kind: 'info', from: 'board', subj: '¡CAMPEONES!', body: `Ganaste el título de la NBA con ${w.name}. La directiva y la ciudad están de fiesta.` }); }
  addAward(G, 'Finals MVP', best?.p);
}
function addAward(G, name, p, extra = '') { if (!p) return; (G.hist.awards ||= []).push({ y: G.Y, a: name, id: p.id, n: p.n, tm: p.tm, x: extra }); (p.aw ||= []).push(`${name} ${G.Y}-${String((G.Y + 1) % 100)}`); }

function cupTick(G) {
  const D = G.D, c = G.cup;
  if (G.today === D.cupNights[4] && !c.ko && gamesOn(G, D.cupNights[4]).filter(g => g.ty === 'cup').every(g => g.done)) cupMakeKO(G);
  if (!c.ko || c.champ) return;
  const qf = G.sched.filter(g => g.ty === 'cupQ'), sf = G.sched.filter(g => g.ty === 'cupS'), f = G.sched.find(g => g.ty === 'cupF');
  if (!sf.length && qf.length && qf.every(g => g.done)) {
    const games = [];
    for (const conf of ['E', 'W']) {
      const q = qf.filter(g => confOf[g.h] === conf).sort((a, b) => a.k - b.k); games.push(mkGame(D.cupS, wonBy(q[0]), wonBy(q[1]), 'cupS', { conf }));
    }
    addGames(G, games);
  } else if (sf.length && !f && sf.every(g => g.done)) {
    const e = sf.find(g => g.conf === 'E'), w = sf.find(g => g.conf === 'W'); addGames(G, [mkGame(D.cupF, wonBy(e), wonBy(w), 'cupF')]);
  } else if (f && f.done && !c.champ) {
    c.champ = wonBy(f); c.runner = lostBy(f);
    const best = ros(G, c.champ).filter(p => p.st).map(p => ({ p, s: p.st.perf })).sort((a, b) => b.s - a.s)[0];
    news(G, `🏆 ${G.teams[c.champ].name} ganan la NBA Cup ${G.Y} (${Math.max(f.hs, f.as)}-${Math.min(f.hs, f.as)} a ${G.teams[c.runner].name}).`, 'liga'); addAward(G, 'MVP NBA Cup', best?.p);
    if (c.champ === G.user) { G.stats.cups++; G.board.conf = clamp(G.board.conf + 4, 0, 100); G.fin.cash += 2; msg(G, { kind: 'info', from: 'board', subj: '¡Campeones de la NBA Cup!', body: `Ganaste la NBA Cup. El premio en efectivo para el plantel va a la caja del club.` }); }
  }
}
function cupMakeKO(G) {
  const D = G.D, gs = Object.entries(G.cup.groups), q = { E: [], W: [] };
  const sortT = (a, b) => G.teams[b].cw - G.teams[a].cw || G.teams[b].cpd - G.teams[a].cpd || G.teams[b].w - G.teams[a].w;
  for (const conf of ['E', 'W']) {
    const groups = gs.filter(([k]) => k[0] === conf).map(([, ts]) => ts.slice().sort(sortT)), win = groups.map(g => g[0]), seconds = groups.map(g => g[1]).sort(sortT);
    q[conf] = [...win, seconds[0]].sort(sortT);
  }
  G.cup.ko = q;
  const games = [];
  for (const [i, conf] of ['E', 'W'].entries()) {
    const s = q[conf]; games.push(mkGame(D.cupQ[0] + (i ? 1 : 0), s[0], s[3], 'cupQ', { k: 1 }), mkGame(D.cupQ[0] + (i ? 1 : 0), s[1], s[2], 'cupQ', { k: 2 }));
  }
  addGames(G, games);
  news(G, `Terminó la fase de grupos de la NBA Cup. Cuartos de final: ${[...q.E, ...q.W].map(a => a).join(', ')}.`, 'liga');
  if ([...q.E, ...q.W].includes(G.user)) { G.stats.userCupQ = true; msg(G, { kind: 'info', from: 'board', subj: '¡A cuartos de la NBA Cup!', body: `${G.teams[G.user].name} avanzó a los cuartos de final de la NBA Cup.` }); }
}

/* ---------- el día ---------- */
export function blocker(G, mode = {}) {
  if (G.fired) return 'fired';
  if (G.dr && !G.dr.done && G.today >= G.D.draft && M.onClock(G)?.own === G.user && !mode.simUser) return 'draft';
  if (G.today === G.D.cuts + 1 - 1 && G.phase === 'pre' && rosterCount(G, G.user) > 15 && !G.flags.cutOk) return 'roster';
  if (!mode.simUser && userGameOn(G)) return 'game';
  return null;
}
export function advance(G, mode = {}) {
  const out = { days: 0, stop: null };
  const lim = mode.limit || 460;
  const before = G.inbox.filter(m => !m.read && m.acts?.length && !m.done).length;
  while (out.days < lim) {
    if (mode.until === 'date' && G.today >= mode.date) { out.stop = 'date'; break; }
    if (mode.until === 'days' && out.days >= mode.n) { out.stop = 'days'; break; }
    const b = blocker(G, mode); if (b) { out.stop = b; break; }
    if (mode.until === 'phase' && G.phase === mode.phase && out.days > 0) { out.stop = 'phase'; break; }
    stepDay(G, mode); out.days++;
    if (!mode.ignoreMsgs && G.inbox.filter(m => !m.read && m.acts?.length && !m.done).length > before && mode.until !== 'days') { out.stop = 'msg'; break; }
    if (mode.until === 'game' && userGameOn(G) && !mode.simUser) { out.stop = 'game'; break; }
  }
  return out;
}
export function stepDay(G, mode = {}) {
  const rng = rng_(G), D = G.D, d = G.today;
  onDate(G, mode);
  for (const g of gamesOn(G, d).slice()) {
    if (g.done) continue;
    if ((g.h === G.user || g.a === G.user) && !mode.simUser && g.ty !== 'sl') continue;      // el del usuario se juega o se simula a mano
    if (g.ty === 'sl' && (g.h === G.user || g.a === G.user) && !mode.simUser) continue;
    simGame(G, g);
  }
  postDay(G, mode);
  G.today++;
}
export function simUserGame(G, g) { return simGame(G, g); }
/** Resultado de un partido jugado en 3D: { hs, as, ptsUser:{id:pts}, ptsOpp:{id:pts} } */
export function applyPlayed(G, g, res) {
  const mineH = g.h === G.user, ot = res.ot || 0;
  return simGame(G, g, { hs: res.hs, as: res.as, ot, ptsH: mineH ? res.ptsUser : res.ptsOpp, ptsA: mineH ? res.ptsOpp : res.ptsUser });
}

function postDay(G, mode) {
  const rng = rng_(G), D = G.D, d = G.today;
  cupTick(G); if (G.pi && !G.pi.E.done) playInTick(G); playoffsTick(G);
  /* lesiones (todos) */
  for (const p of Object.values(G.P)) if (p.inj) { p.inj.d--; if (p.inj.d <= 0) { if (p.tm === G.user && p.lg === 'NBA') msg(G, { kind: 'info', from: 'med', pid: p.id, subj: `${p.n} vuelve de su lesión`, body: `${p.n} está recuperado y disponible.` }); p.inj = null; } }
  /* forma: sin jugar tiende a 0 */
  if (dow(d) === 1) weekly(G, rng);
  if ((d - D.camp) % 14 === 0 && ['rs', 'po', 'pre'].includes(G.phase)) updatesBatch(G, rng);
  if (['rs', 'pre', 'po'].includes(G.phase)) { E.dailyMessages(G, rng); if (rng() < 0.12 && G.phase === 'rs') M.aiTrades(G, rng, 1); }
  if (d % 3 === 0) E.expireMessages(G);
  checkFired(G);
}
function weekly(G, rng) {
  if (G.coach.arch === 'motivador') for (const p of ros(G, G.user)) p.mor = clamp(p.mor + 1, 5, 99);
  const med = G.staff.med, coach = G.staff.coach, intensity = G.settings.intensity || 'normal';
  M.scoutTick(G, rng);
  for (const p of Object.values(G.P)) {
    if (p.prospect) { p.mor = 62; continue; }
    p.mor = clamp((p.mor || 60) + ((p.mor || 60) > 66 ? -0.6 : (p.mor || 60) < 56 ? 0.8 : 0.1), 5, 99);
    if (p.promise && G.today > p.promise.until) { const mpg = p.st && p.st.gp ? p.st.min / p.st.gp : 0; if (mpg < p.promise.min * 0.7) { p.mor = clamp(p.mor - 14, 5, 99); if (p.tm === G.user) msg(G, { kind: 'info', from: p.id, pid: p.id, subj: `${p.n} se siente engañado`, body: `Me prometiste minutos y no los cumpliste.` }); } p.promise = null; }
    p.flagMin = p.flagMin && G.today - p.flagMin > 25 ? null : p.flagMin;
    if (!p.st || !p.st.gp) { P.restForm(p); }
    if (p.lg === 'NBA' && p.tm && ['camp', 'pre', 'rs', 'po', 'summer', 'sl', 'fa'].includes(G.phase)) {
      const mine = p.tm === G.user, focus = mine ? (G.plan[p.id] || (G.settings.autoTrain ? P.autoFocus(p) : null)) : P.autoFocus(p);
      const k = P.trainWeek(rng, p, focus, mine ? intensity : 'normal', mine ? coach : 2, (G.phase === 'rs' || G.phase === 'po' ? 0.8 : 1.25) * (mine && G.coach.arch === 'formador' ? 1.2 : 1));
      if (k && mine) msg(G, { kind: 'train', from: 'gm', pid: p.id, subj: `Entrenamiento: ${p.n} mejoró`, body: `${p.n} subió ${GEN.ATTR_LABEL[k]} (${p.at[k]}) en el entrenamiento. Overall: ${baseOvr(p)}.` });
    }
  }
}
function updatesBatch(G, rng) {
  const ups = [], downs = [], mine = [];
  for (const p of Object.values(G.P)) {
    if (!p.tm || p.prospect) continue;
    const nba = p.lg === 'NBA' && !p.gl;
    if (nba && (p.upd || 0) < 12) continue;
    if (!nba && rng() > 0.45) continue;
    const b = baseOvr(p), r = P.rateUpdate(rng, p, nba ? null : p.gl ? 26 : 24); if (nba) p.upd = 0;
    const a = baseOvr(p); if (a === b) continue;
    p.dY = (p.dY || 0) + (a - b); (a > b ? ups : downs).push({ p, b, a });
  }
  const tm = x => x.p.tm === G.user, top = (arr, f) => arr.filter(x => G.teams[x.p.tm] && (tm(x) || Math.abs(x.a - x.b) >= 2 && ovrNow(x.p) >= 70)).sort(f).slice(0, 6);
  E.ratingDigest(G, top(ups, (a, b) => (tm(b) - tm(a)) || (b.a - b.b) - (a.a - a.b)), top(downs, (a, b) => (tm(b) - tm(a)) || (a.a - a.b) - (b.a - b.b)));
}

/* ---------- fechas del calendario ---------- */
function onDate(G, mode) {
  const rng = rng_(G), D = G.D, d = G.today;
  if (d === D.camp) { G.phase = 'camp'; msg(G, { kind: 'info', from: 'gm', subj: 'Arrancó el campus de entrenamiento', body: `Empieza la pretemporada ${G.Y}-${String((G.Y + 1) % 100)}. Revisá tu plantel (máx. 15 al arrancar la temporada), elegí el entrenamiento de cada jugador y ajustá tu quinteto. Si no querés ocuparte, el entrenamiento automático lo hace por vos.` }); E.setBoardGoals(G); }
  if (d === D.preStart) G.phase = 'pre';
  if (d === D.cuts - 0) { aiCuts(G, rng); }
  if (d === D.open) {
    if (rosterCount(G, G.user) > 15) autoCut(G, G.user);
    G.phase = 'rs'; news(G, `¡Arranca la temporada ${G.Y}-${String((G.Y + 1) % 100)} de la NBA!`, 'liga');
  }
  if (d === D.deadline + 1) news(G, 'Cerró el mercado de cambios: ya no se pueden hacer traspasos hasta después de las Finales.', 'liga');
  if (d === D.asg) allStar(G, rng);
  if (d === D.endRS + 1) endRegularSeason(G, rng);
  if (d === D.lottery && G.po) { const po = new Set([...G.po.seeds.E, ...G.po.seeds.W]); const dr = M.runLottery(G, rng, po); news(G, `Lotería del Draft: ${G.teams[G.lott.top[0]].name} ganan el pick #1, seguido de ${G.lott.top.slice(1).map(a => G.teams[a].name).join(', ')}.`, 'draft'); const mine = dr.order.filter(o => o.own === G.user); if (mine.length) msg(G, { kind: 'info', from: 'gm', subj: 'Tus picks del Draft', body: `Tenés ${mine.length} pick${mine.length > 1 ? 's' : ''}: ${mine.map(o => '#' + o.n).join(', ')}. Mirá la pestaña Draft para ver a los prospectos y preparar tu tablero.` }); }
  if (d === D.draft && G.dr && !G.dr.done) { G.phase = 'draft'; news(G, 'Comienza el Draft de la NBA.', 'draft'); M.draftRun(G, rng); }
  if (d === D.faOpen) openFreeAgency(G, rng);
  if (d > D.faOpen && d <= D.faOpen + 21 && G.phase === 'fa') M.aiFreeAgency(G, rng, d < D.faOpen + 5 ? 0.9 : 0.4);
  if (d === D.slStart) { G.phase = 'sl'; news(G, 'Arranca la Summer League en Las Vegas.', 'liga'); }
  if (d === D.slEnd + 1) endSummerLeague(G, rng);
  if (d === D.devTick) devTick(G, rng);
  if (d === D.nextCamp) newSeason(G, rng);
  if (G.dr && !G.dr.done && d > D.draft) M.draftRun(G, rng, mode.simUser || false);
  if (G.dr && !G.dr.done && d > D.draft + 1) M.draftRun(G, rng, true);
}
function aiCuts(G, rng) {
  for (const ab of NBA_TEAMS) {
    if (ab === G.user) continue;
    const ps = ros(G, ab).sort((a, b) => ovrNow(b) - ovrNow(a));
    for (let i = 15; i < ps.length; i++) { const p = ps[i]; if (p.con?.type === 'two' || ovrNow(p) < 52) M.releasePlayer(G, p, { noDead: true }); else { p.gl = true; } }
    while (rosterCount(G, ab) > 15) { const p = ros(G, ab).sort((a, b) => ovrNow(a) - ovrNow(b))[0]; M.releasePlayer(G, p, { noDead: true }); }
  }
  M.aiFreeAgency(G, rng, 1);
}
export function autoCut(G, ab) {
  while (rosterCount(G, ab) > 15) { const p = ros(G, ab).filter(x => x.lg === 'NBA').sort((a, b) => ((a.con?.sal || 0) < 3 ? 0 : 1) - ((b.con?.sal || 0) < 3 ? 0 : 1) || ovrNow(a) - ovrNow(b))[0]; M.releasePlayer(G, p); msg(G, { kind: 'info', from: 'gm', subj: `Recorte automático`, body: `Con el plantel pasado de 15, se cortó a ${p.n}.` }); }
}
function allStar(G, rng) {
  const res = {};
  for (const c of ['E', 'W']) res[c] = Object.values(G.P).filter(p => p.lg === 'NBA' && p.tm && G.teams[p.tm]?.conf === c && p.st && p.st.gp >= 20).map(p => ({ p, s: p.st.pts / p.st.gp + 1.3 * p.st.ast / p.st.gp + 0.9 * p.st.reb / p.st.gp + ovrNow(p) * 0.3 })).sort((a, b) => b.s - a.s).slice(0, 12).map(x => x.p);
  G.allstar = { E: res.E.map(p => p.id), W: res.W.map(p => p.id) };
  const mine = [...res.E, ...res.W].filter(p => p.tm === G.user);
  for (const p of mine) { p.mor = clamp(p.mor + 8, 5, 99); (p.aw ||= []).push(`All-Star ${G.Y + 1}`); }
  news(G, `All-Star ${G.Y + 1}: ${res.E.slice(0, 3).map(p => p.n).join(', ')} (Este) y ${res.W.slice(0, 3).map(p => p.n).join(', ')} (Oeste) entre los elegidos.`, 'liga');
  if (mine.length) msg(G, { kind: 'info', from: 'press', subj: 'All-Stars de tu equipo', body: `${mine.map(p => p.n).join(' y ')} fueron elegidos para el All-Star Game.` });
}

/* ---------- fin de temporada regular y premios ---------- */
function comp(p) { const s = p.st; if (!s || s.gp < 20) return -1; const g = s.gp; return (s.pts + 1.2 * s.reb + 1.5 * s.ast + 2 * s.stl + 2 * s.blk - s.tov) / g * Math.min(1, g / 60) + ovrNow(p) * 0.18; }
function endRegularSeason(G, rng) {
  const ranks = leagueRanks(G);
  for (const t of Object.values(G.teams)) { t.po = ranks[t.conf].indexOf(t.ab) < 10; t.seed = ranks[t.conf].indexOf(t.ab) + 1; }
  const all = Object.values(G.P).filter(p => p.lg === 'NBA' && p.tm && p.st && p.st.gp >= 20);
  const best = (arr, f, n = 1) => arr.map(p => ({ p, s: f(p) })).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.p);
  const winp = p => G.teams[p.tm].w / Math.max(1, G.teams[p.tm].w + G.teams[p.tm].l);
  const mvp = best(all, p => comp(p) * (0.7 + winp(p) * 0.6))[0];
  const dpoy = best(all, p => (p.st.stl * 2.2 + p.st.blk * 2.6 + p.st.reb * 0.5) / p.st.gp + p.at.perD * 0.04 + p.at.intD * 0.04)[0];
  const roy = best(all.filter(p => p.rk === G.Y), comp)[0];
  const smoy = best(all.filter(p => p.st.gs <= p.st.gp * 0.25), comp)[0];
  const mip = best(all.filter(p => p.age <= 28 && p.ovrY != null), p => baseOvr(p) - p.ovrY)[0];
  const allnba = best(all, comp, 15);
  addAward(G, 'MVP', mvp); addAward(G, 'DPOY', dpoy); addAward(G, 'Rookie del año', roy); addAward(G, 'Sexto hombre', smoy); addAward(G, 'Jugador más mejorado', mip);
  allnba.forEach((p, i) => (p.aw ||= []).push(`All-NBA ${i < 5 ? '1.er' : i < 10 ? '2.º' : '3.er'} equipo ${G.Y + 1}`));
  G.awards = { y: G.Y, mvp: mvp?.id, dpoy: dpoy?.id, roy: roy?.id, smoy: smoy?.id, mip: mip?.id, allnba: allnba.map(p => p.id) };
  news(G, `Premios de la temporada: MVP ${mvp?.n || '-'}, DPOY ${dpoy?.n || '-'}, Novato ${roy?.n || '-'}.`, 'liga');
  for (const p of [mvp, dpoy, roy, smoy, mip, ...allnba]) if (p && p.tm === G.user) { p.mor = clamp(p.mor + 7, 5, 99); }
  const mine = [mvp && ['MVP', mvp], dpoy && ['DPOY', dpoy], roy && ['Rookie del año', roy], smoy && ['Sexto hombre', smoy]].filter(Boolean).filter(([, p]) => p.tm === G.user);
  for (const [n, p] of mine) msg(G, { kind: 'info', from: 'press', subj: `${p.n}: ${n}`, body: `${p.n} ganó el premio de ${n}. ¡Felicitaciones!` });
  /* contratos por vencer */
  const exp = ros(G, G.user).filter(p => p.con && p.con.yrs <= 1 && p.con.type !== 'two');
  if (exp.length) msg(G, { kind: 'info', from: 'gm', subj: 'Contratos por vencer', body: `Se les termina el contrato a: ${exp.map(p => `${p.n} (${ovrNow(p)})`).join(', ')}. Tenés hasta el 30 de junio para renovarlos; si no, salen a la agencia libre.` });
  /* ligas de afuera */
  for (const lg of ['EUR', 'ARG', 'AUS', 'CHN', 'BRA']) foreignSeason(G, rng, lg);
  if (G.user && (G.teams[G.user].po)) { /* clasificó (play-in incluido) */ }
  else { G.stats.userPO = false; }
  startPlayIn(G);
}
function foreignSeason(G, rng, lg) {
  const clubs = Object.values(G.clubs).filter(c => c.lg === lg);
  const sc = clubs.map(c => ({ c, s: avg(ros(G, c.key).map(ovrNow).sort((a, b) => b - a).slice(0, 8)) * 1 + gauss(rng, 0, 3.5) + c.prestige * 3 })).sort((a, b) => b.s - a.s);
  const best = Object.values(G.P).filter(p => p.lg === lg && p.tm).sort((a, b) => ovrNow(b) - ovrNow(a))[0];
  G.foreign ||= {}; G.foreign[lg] = { y: G.Y, champ: sc[0].c.key, order: sc.map(x => x.c.key), mvp: best?.id };
  news(G, `${require_name(lg)}: ${sc[0].c.name} campeón de la temporada ${G.Y}-${String((G.Y + 1) % 100)}${best ? ` (figura: ${best.n}, ${ovrNow(best)})` : ''}.`, 'intl');
}
const require_name = lg => ({ EUR: 'EuroLeague', ARG: 'Liga Nacional', AUS: 'NBL', CHN: 'CBA', BRA: 'NBB' }[lg] || lg);

/* ---------- cierre de temporada (después de las Finales) ---------- */
function endSeason(G) {
  const t = G.teams[G.user], po = G.po, res = {};
  const mySeries = po.all.filter(s => s.hi === G.user || s.lo === G.user), rounds = mySeries.length ? Math.max(...mySeries.map(s => s.rd)) : 0;
  const myLast = mySeries.find(s => s.rd === rounds), advanced = myLast && myLast.win === G.user;
  const ctx = { finals: rounds >= 4, round: advanced ? rounds + 1 : rounds, po: t.po, seed: t.seed || 99, cupQ: !!G.stats.userCupQ };
  const results = E.evalBoard(G, ctx);
  G.hist.seasons.push({ y: G.Y, w: t.w, l: t.l, seed: t.seed, rounds, champ: po.champ === G.user, cup: G.cup.champ === G.user, tm: G.user });
  msg(G, { kind: 'board', from: 'board', subj: `Balance de la temporada ${G.Y}-${String((G.Y + 1) % 100)}`, body: `Récord: ${t.w}-${t.l}. ${po.champ === G.user ? '¡CAMPEONES!' : rounds ? `Llegaste hasta la ronda ${rounds}${advanced ? ' (y ganaste la serie)' : ''}.` : 'No clasificaron a playoffs.'}\n\n${results.map(([g, ok]) => `${ok ? '✔' : '✘'} ${g.t}`).join('\n')}\n\nConfianza de la directiva: ${Math.round(G.board.conf)}%.` });
  /* finanzas */
  const pay = payroll(G, G.user), tax = Math.max(0, pay - CAP.tax) * 1.5, rev = 12 + (t.w - 41) * 0.45 + rounds * 5 + (po.champ === G.user ? 12 : 0) + (G.cup.champ === G.user ? 2 : 0) + (30 - (t.rk0 || 15)) * 0.2;
  const staffCost = (G.staff.coach + G.staff.scout + G.staff.med + G.staff.gm) * 1.2, profit = rev - tax - staffCost - Math.max(0, (pay - 150) * 0.12);
  G.fin.cash += profit; G.fin.last = { rev, tax, staffCost, profit };
  msg(G, { kind: 'board', from: 'board', subj: 'Finanzas de la temporada', body: `Ingresos: ${money(rev)} · Impuesto de lujo: ${money(tax)} · Cuerpo técnico: ${money(staffCost)}\nResultado: ${profit >= 0 ? '+' : ''}${money(profit)}. Caja del club: ${money(G.fin.cash)}.` });
  if (G.board.conf < 14) { G.fired = true; msg(G, { kind: 'board', from: 'board', subj: 'Estás despedido', body: `La directiva decidió terminar tu ciclo. Podés elegir otro equipo para seguir tu carrera.` }); }
  for (const p of Object.values(G.P)) if (p.st && p.tm) { p.hist.push({ y: G.Y, tm: p.tm, gp: p.st.gp, pts: +(p.st.pts / Math.max(1, p.st.gp)).toFixed(1), reb: +(p.st.reb / Math.max(1, p.st.gp)).toFixed(1), ast: +(p.st.ast / Math.max(1, p.st.gp)).toFixed(1), ovr: baseOvr(p), perf: +(p.perf || 0).toFixed(2) }); if (p.hist.length > 14) p.hist.shift(); }
}
function checkFired(G) {
  if (G.board.conf < 6 && !G.fired && G.phase === 'rs') { G.fired = true; msg(G, { kind: 'board', from: 'board', subj: 'Estás despedido', body: 'Los malos resultados terminaron con tu ciclo en medio de la temporada.' }); }
}

/* ---------- agencia libre, Summer League, verano ---------- */
function openFreeAgency(G, rng) {
  G.phase = 'fa';
  const exp = [];
  for (const p of Object.values(G.P)) {
    if (p.lg === 'NBA' && p.tm && p.con) {
      p.con.yrs--;
      if (p.con.yrs <= 0) { if (p.tm === G.user) { exp.push(p); place(G, p, 'FA', 'FA'); p.fa = { ask: M.askFor(p) * (0.95 + rng() * 0.1), yrs: rint(rng, 2, 4), ex: G.user }; p.con = null; p.gl = false; } else M.aiExpiring(G, rng, p); }
    } else if (p.tm && G.clubs[p.tm] && p.con) { p.con.yrs--; if (p.con.yrs <= 0) setContract(p, p.con.sal, rint(rng, 1, 3), 'std', { clause: 0 }); }
  }
  G.dead = G.deadYrs ? Object.fromEntries(Object.entries(G.dead).filter(([k]) => false)) : {}; G.deadYrs = null;
  if (exp.length) msg(G, { kind: 'info', from: 'gm', subj: 'Agencia libre abierta', body: `Se fueron a la agencia libre: ${exp.map(p => `${p.n} (${ovrNow(p)})`).join(', ')}. Todavía podés intentar firmarlos desde el Mercado, pero ahora compiten con los demás equipos.` });
  news(G, 'Se abre la agencia libre: los equipos empiezan a moverse.', 'fichaje');
  M.aiIntlMoves(G, rng); M.aiFreeAgency(G, rng, 1);
  addGames(G, buildSummerLeague(rng, G.D));
  for (let i = 0; i < 12; i++) { const p = genPlayer(rng, { ovr: clamp(Math.round(gauss(rng, 57, 4)), 46, 68), age: rint(rng, 24, 35), league: 'FA' }); p.lg = 'FA'; p.fa = { ask: M.askFor(p) * 0.9, yrs: rint(rng, 1, 2) }; G.P[p.id] = p; place(G, p, 'FA', 'FA'); }
  indexRosters(G);
}
function endSummerLeague(G, rng) {
  const sl = G.sched.filter(g => g.ty === 'sl' && g.done), rec = {};
  for (const g of sl) { for (const [ab, w] of [[g.h, g.hs > g.as], [g.a, g.as > g.hs]]) { rec[ab] ||= [0, 0]; rec[ab][w ? 0 : 1]++; } }
  const champ = Object.entries(rec).sort((a, b) => b[1][0] - a[1][0] || Math.random() - 0.5)[0];
  G.sl = { y: G.Y, champ: champ?.[0], rec };
  const mvp = Object.values(G.P).filter(p => p.sl && p.sl.gp >= 3).map(p => ({ p, s: p.sl.pts / p.sl.gp + p.sl.perf * 3 })).sort((a, b) => b.s - a.s)[0];
  news(G, `Summer League: ${G.teams[champ[0]].name} se llevan el título${mvp ? `. MVP: ${mvp.p.n}` : ''}.`, 'liga');
  for (const p of Object.values(G.P)) if (p.sl && p.sl.gp >= 2) {
    const pf = p.sl.perf / p.sl.gp; if (pf > 0.55 && p.age <= 24 && P.bump(rng, p, 1)) { if (p.tm === G.user) msg(G, { kind: 'info', from: 'gm', pid: p.id, subj: `${p.n} brilló en la Summer League`, body: `${p.n} promedió ${(p.sl.pts / p.sl.gp).toFixed(1)} puntos y mostró progreso. Overall: ${baseOvr(p)}.` }); }
    p.sl = null;
  }
  G.phase = 'summer';
}
function devTick(G, rng) {
  G.phase = 'summer'; const mine = [], retired = [];
  for (const p of Object.values(G.P)) {
    p.age++; const before = baseOvr(p);
    const coach = p.tm === G.user ? G.staff.coach : 2;
    if (!p.prospect || true) P.offseason(rng, p, { coachLvl: coach });
    p.ovrY = baseOvr(p); p.dY = 0; p.flag40 = null; p.upd = 0; p.st = null; p.stp = null; p.inj = p.inj && p.inj.d > 60 ? { ...p.inj, d: p.inj.d - 40 } : null;
    if (p.tm === G.user && p.lg === 'NBA') mine.push({ p, b: before, a: baseOvr(p) });
    if (!p.prospect && p.lg !== 'HS') {
      const o = baseOvr(p), pr = clamp((p.age - 34) * 0.2 + (66 - o) * 0.02 + (p.age >= 39 ? 0.3 : 0), 0, 0.95);
      if (p.age >= 33 && rng() < pr && !(p.tm === G.user && false)) retired.push(p);
    }
  }
  for (const p of retired) { if (p.tm === G.user) msg(G, { kind: 'info', from: 'press', subj: `${p.n} se retira`, body: `${p.n} (${p.age} años) anunció su retiro. Gracias por todo.` }); else if (baseOvr(p) >= 72) news(G, `${p.n} se retira del básquet a los ${p.age} años.`, 'liga'); removePlayer(G, p); }
  for (const x of [...mine].sort((a, b) => (b.a - b.b) - (a.a - a.b))) { /* resumen abajo */ }
  const ups = mine.filter(x => x.a > x.b).sort((a, b) => (b.a - b.b) - (a.a - a.b)), downs = mine.filter(x => x.a < x.b).sort((a, b) => (a.a - a.b) - (b.a - b.b));
  msg(G, { kind: 'ratings', from: 'gm', subj: 'Evolución de verano', body: `Así evolucionó tu plantel este verano:\n\n${mine.sort((a, b) => b.a - a.a).map(x => `${x.a > x.b ? '▲' : x.a < x.b ? '▼' : '•'} ${x.p.n}: ${x.b} → ${x.a}${x.p.age >= 33 ? ' (veterano)' : ''}`).join('\n')}`, pids: mine.map(x => x.p.id) });
  /* reponer ligas y libres */
  for (const c of Object.values(G.clubs)) { while (ros(G, c.key).length < 11) { const L = GEN.genPlayer(rng, { league: c.lg, ovr: clamp(Math.round(gauss(rng, ({ EUR: 62, ARG: 52, AUS: 55, CHN: 54, BRA: 51 }[c.lg]) + (c.prestige - 0.6) * 10, 5)), 40, 76), age: rint(rng, 19, 25) }); L.tm = c.key; L.lg = c.lg; setContract(L, 0.6, rint(rng, 1, 3), 'std', { clause: 0 }); G.P[L.id] = L; (G.R[c.key] ||= []).push(L.id); } }
  while (ros(G, 'GLFA').length < 60) { const p = genPlayer(rng, { league: 'GL', ovr: clamp(Math.round(gauss(rng, 50, 4)), 40, 62), age: rint(rng, 20, 27), potBonus: rint(rng, 0, 6) }); p.lg = 'GL'; p.fa = { ask: 0.6, yrs: 2 }; G.P[p.id] = p; place(G, p, 'GLFA', 'GL'); }
  M.aiFreeAgency(G, rng, 1);
}
function newSeason(G, rng) {
  G.Y++; G.D = seasonDates(G.Y); G.today = G.D.camp; G.phase = 'camp'; G.po = null; G.pi = null; G.cup = { groups: {}, ko: null, champ: null }; G.dr = null; G.lott = null; G.sl = null; G.stats.userCupQ = false; G.stats.userPO = false; G.flags.cutOk = false; G.awards = null;
  const prev = standingsOf(G);
  for (const t of Object.values(G.teams)) { Object.assign(t, { w: 0, l: 0, pf: 0, pa: 0, cw: 0, cl: 0, cpd: 0, streak: 0, l10: [], po: false, seed: 0 }); }
  const ranked = { E: [], W: [] }; for (const t of prev) ranked[t.conf].push(t.ab);
  G.cup.groups = cupDraw(rng, ranked); resetGid(G.gid);
  G.sched = [...buildPreseason(rng, G.D), ...buildSchedule(rng, G.D, G.cup.groups)].sort((a, b) => a.d - b.d || a.id - b.id); G.gid = getGid(); G._bdN = -1;
  /* nueva clase de prospectos (3 años adelante) y picks */
  newProspectClass(G, rng, G.Y + 3, 100, G.Y);
  for (const rd of [1, 2]) for (const ab of NBA_TEAMS) G.picks.push({ y: G.Y + 4, rd, orig: ab, own: ab });
  G.picks = G.picks.filter(k => k.y >= G.Y + 1);
  for (const p of Object.values(G.P)) { p.perf = 0; p.frm = 0; if (p.lg === 'NBA') p.hist = p.hist.slice(-12); }
  G.dead = {}; G.board.goals = []; G.log = [];
  for (const p of ros(G, G.user)) { const arr = ros(G, G.user).sort((a, b) => ovrNow(b) - ovrNow(a)); p.role = 'rotación'; }
  roles(G);
  for (const t of Object.values(G.teams)) { t.strat = teamStrength(G, t.ab) > 70 ? 'contender' : teamStrength(G, t.ab) > 66 ? 'mid' : 'rebuild'; }
  msg(G, { kind: 'info', from: 'gm', subj: `Temporada ${G.Y}-${String((G.Y + 1) % 100)}: empieza la pretemporada`, body: `Hay que dejar el plantel en 15 jugadores antes del ${fmtDay(G.D.cuts)}. Tenés ${rosterCount(G, G.user)}.` });
  E.setBoardGoals(G);
}
export function roles(G) {
  for (const ab of NBA_TEAMS) { const ps = ros(G, ab).filter(p => p.lg === 'NBA' && !p.gl).sort((a, b) => ovrNow(b) - ovrNow(a)); ps.forEach((p, i) => P.setRole(p, i, ps.length)); for (const p of ros(G, ab)) if (p.gl) p.role = 'prospecto'; }
}
export const isFired = G => !!G.fired;
/** Después de ser despedido: ofertas de 4 equipos con distinta ambición. */
export function jobOffers(G) {
  const rk = NBA_TEAMS.slice().sort((a, b) => teamStrength(G, a) - teamStrength(G, b)).filter(t => t !== G.user);
  return [rk[0], rk[5], rk[11], rk[16]].map(ab => ({ ab, str: teamStrength(G, ab) }));
}
export function takeJob(G, ab) {
  G.user = ab; G.fired = false; G.board.conf = 55; G.lineup = []; G.plan = {}; G.tac = { pace: 'normal', shot: 'balanced', pass: 'balanced', def: 'normal' }; G.stats.coachW = G.stats.coachL = 0;
  msg(G, { kind: 'board', from: 'board', subj: `Bienvenido a ${G.teams[ab].name}`, body: 'Nueva etapa. La directiva espera resultados.' }); E.setBoardGoals(G); roles(G);
}
