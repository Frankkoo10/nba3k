import { clamp, gauss, rint, sum, avg } from './util.js';
import { ovrNow, POS } from './gen.js';

/* ============================================================================
   Simulación de partidos (los que no jugás en 3D, y también la parte "box score" de los que sí jugás).
   Un partido sale de: nivel de cada plantel (minutos × estrellas), localía, ataque/defensa y suerte.
   Después se reparte en estadísticas por jugador (minutos, puntos, rebotes, asistencias…), que son las que
   hacen subir o bajar la forma y el overall de cada uno (prog.js).
   ========================================================================== */
export const MINS = [34, 32, 31, 30, 29, 22, 19, 15, 12, 8, 4, 2];
const FIELDS = ['gp', 'gs', 'min', 'pts', 'reb', 'orb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'pm', 'perf'];
export const newStats = () => Object.fromEntries(FIELDS.map(f => [f, 0]));
export const isOut = p => !!p.inj && p.inj.d > 0;
export const isPro = p => p.tm && p.lg === 'NBA';

/** Quinteto automático (uno por posición si se puede) y banco por overall. Devuelve ids en orden. */
export function autoLineup(players) {
  const ps = players.slice().sort((a, b) => ovrNow(b) - ovrNow(a)), used = new Set(), st = [];
  for (const pos of POS) { const p = ps.find(x => !used.has(x) && x.pos === pos && ovrNow(x) >= ovrNow(ps[Math.min(ps.length - 1, 7)]) - 1); if (p) { used.add(p); st.push(p); } }
  for (const p of ps) { if (st.length >= 5) break; if (!used.has(p)) { used.add(p); st.push(p); } }
  st.sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos));
  const bench = ps.filter(p => !used.has(p));
  return [...st, ...bench];
}
/** Respeta el orden que armó el usuario (titulares + banco) pero saca lesionados / G League y completa con los mejores. */
export function applyLineup(order, players) {
  const ok = new Map(players.map(p => [p.id, p])), res = [], seen = new Set();
  for (const id of order || []) { const p = ok.get(id); if (p && !seen.has(id)) { res.push(p); seen.add(id); } }
  for (const p of autoLineup(players.filter(x => !seen.has(x.id)))) res.push(p);
  return res;
}
/** Peso de cada jugador en el nivel del equipo: minutos × estrella. */
const star = o => Math.pow(Math.max(o - 38, 1), 1.35);
export function teamLevel(lineup) {
  let wt = 0, r = 0, off = 0, def = 0;
  lineup.slice(0, 12).forEach((p, i) => {
    const o = ovrNow(p), w = MINS[i] * star(o), a = p.at;
    const of = (a.three * 0.2 + a.mid * 0.12 + a.close * 0.12 + a.layup * 0.12 + a.handle * 0.1 + a.passAcc * 0.1 + a.dunkD * 0.06 + a.ft * 0.04 + a.speedBall * 0.06 + a.post * 0.04 + (a.oreb || 50) * 0.04);
    const df = (a.intD * 0.25 + a.perD * 0.3 + a.steal * 0.12 + a.block * 0.1 + a.dreb * 0.13 + a.speed * 0.05 + a.stamina * 0.05);
    wt += w; r += w * o; off += w * of; def += w * df;
  });
  return wt ? { r: r / wt, off: off / wt, def: def / wt } : { r: 40, off: 40, def: 40 };
}

/** Marcador de un partido entre dos planteles. home = {lineup, tl}. Devuelve { hs, as, ot }. */
export function simScore(rng, H, A, o = {}) {
  const hca = o.neutral ? 0 : 2.3, base = 112 + gauss(rng, 0, 2.2), pace = o.pace ?? 1;
  const dr = (H.tl.r - A.tl.r) * 1.28 + (H.tl.off - A.tl.def - (A.tl.off - H.tl.def)) * 0.05 + hca;
  const tot = (222 + (H.tl.off + A.tl.off - 140) * 0.22 + gauss(rng, 0, 7)) * pace;
  const margin = dr + gauss(rng, 0, 11.2);
  let hs = Math.round((tot + margin) / 2), as = Math.round((tot - margin) / 2);
  hs = clamp(hs, 62, 175); as = clamp(as, 62, 175);
  let ot = 0;
  while (hs === as) { ot++; hs += rint(rng, 5, 16); as += rint(rng, 5, 16); }
  if (!o.noOT && Math.abs(hs - as) <= 6 && rng() < 0.05 && ot === 0) { ot = 1; const e = rint(rng, 6, 14); hs += e + (rng() < 0.5 ? 1 : 0); as += e + (rng() < 0.5 ? 0 : 1); if (hs === as) hs++; }
  return { hs, as, ot };
}

/** Reparte los puntos del equipo y arma el box score. `pts` = puntos reales del equipo. fixedPts = { id: puntos } si el partido 3D ya contó los puntos de cada uno. */
export function boxScore(rng, lineup, pts, oppPts, ot = 0, fixedPts = null, opts = {}) {
  const L = lineup.slice(0, 13), n = L.length, scale = (240 + ot * 25) / 240;
  let mins = L.map((p, i) => (i < MINS.length ? MINS[i] : 0) * scale);
  mins = mins.map((m, i) => (m > 0 ? clamp(m + gauss(rng, 0, 2.6) + (ovrNow(L[i]) - 70) * 0.04, 3, 44 + ot * 5) : 0));
  if (Math.abs(oppPts - pts) > 22) mins = mins.map((m, i) => (i < 5 ? m * 0.86 : i < 10 ? m * 1.18 : m));           // pateó el tablero: se descansan los titulares
  const tm = sum(mins), k = (240 + ot * 25) / (tm || 1); mins = mins.map(m => Math.round(m * k));
  const usage = L.map((p, i) => { const a = p.at; return mins[i] * (Math.pow(Math.max(ovrNow(p) - 40, 1), 1.55)) * (0.5 + (a.three + a.mid + a.layup + a.close) / 400) * Math.exp(gauss(rng, 0, 0.3 + (p.hid || 0) * 0.02)) * (1 + (p.hid || 0) * 0.04); });
  const alloc = (total, wts, floor = 0) => {                       // reparte un entero entre pesos (método del mayor resto)
    const s = sum(wts) || 1, raw = wts.map(w => (w / s) * total), base = raw.map(Math.floor); let rest = total - sum(base);
    const ord = raw.map((r, i) => [r - base[i], i]).sort((a, b) => b[0] - a[0]); for (let j = 0; rest > 0 && j < ord.length; j++, rest--) base[ord[j][1]]++;
    return base;
  };
  let P;
  if (fixedPts) { P = L.map(p => fixedPts[p.id] || 0); const diff = pts - sum(P); if (diff !== 0) { const top = usage.indexOf(Math.max(...usage)); P[top] = Math.max(0, P[top] + diff); } }
  else P = alloc(pts, usage.map((u, i) => (mins[i] ? u : 0)));
  const reb = alloc(Math.max(30, Math.round(gauss(rng, 44, 4.5) + ot * 3)), L.map((p, i) => mins[i] * Math.pow(Math.max(p.at.dreb * 0.55 + p.at.oreb * 0.25 + p.at.strength * 0.1 + (p.ht - 190) * 0.4, 8), 1.7) * Math.exp(gauss(rng, 0, 0.25))));
  const ast = alloc(Math.max(12, Math.round(gauss(rng, 25.5, 3.5) * (pts / 112))), L.map((p, i) => mins[i] * Math.pow(Math.max(p.at.passAcc * 0.5 + p.at.handle * 0.5 - 25, 3), 2.1) * Math.exp(gauss(rng, 0, 0.3))));
  const stl = alloc(Math.max(2, Math.round(gauss(rng, 7.4, 2.2))), L.map((p, i) => mins[i] * Math.pow(Math.max(p.at.steal - 25, 2), 2) * Math.exp(gauss(rng, 0, 0.4))));
  const blk = alloc(Math.max(0, Math.round(gauss(rng, 4.8, 2))), L.map((p, i) => mins[i] * Math.pow(Math.max(p.at.block - 25, 1), 2.6) * Math.exp(gauss(rng, 0, 0.45))));
  const tov = alloc(Math.max(6, Math.round(gauss(rng, 13.6, 3))), L.map((p, i) => mins[i] * (0.4 + P[i] / 14) * (1.3 - p.at.handle / 140) * Math.exp(gauss(rng, 0, 0.3))));
  const pf = alloc(Math.max(10, Math.round(gauss(rng, 19.5, 3.2))), L.map((p, i) => mins[i] * (0.6 + (100 - p.at.perD) / 120) * Math.exp(gauss(rng, 0, 0.35))));
  const orbShare = L.map((p, i) => 0.15 + (p.at.oreb / 400));
  const lines = L.map((p, i) => {
    const a = p.at, m = mins[i], pt = P[i], t3r = clamp((a.three - 40) / 70, 0.04, 0.9) * (p.pos === 'C' || p.pos === 'PF' ? 0.5 : 1);
    let tpm = m ? Math.min(Math.floor(pt / 3), Math.round(pt * 0.3 * t3r * (0.7 + rng() * 0.8) / 3 * 1.8)) : 0;
    const fta = m ? Math.round(clamp(pt * (0.11 + (a.post + a.dunkD) / 1500) * (0.6 + rng() * 0.9), 0, 20)) : 0, ft = clamp(0.45 + a.ft / 190 + gauss(rng, 0, 0.05), 0.3, 0.97);
    let ftm = Math.min(fta, Math.round(fta * ft), pt - tpm * 3);
    if ((pt - tpm - ftm) % 2) { if (ftm > 0) ftm--; else if (tpm > 0) tpm--; }
    const fgm = Math.max(0, Math.round((pt - tpm - ftm) / 2));
    const eff = clamp(0.37 + (ovrNow(p) - 40) / 260 + (a.close + a.layup) / 1100 + gauss(rng, 0, 0.04), 0.3, 0.7), fga = Math.max(fgm, Math.round(fgm / eff)), tpa = Math.max(tpm, Math.round(tpm / clamp(0.3 + a.three / 330 + gauss(rng, 0, 0.05), 0.2, 0.5)));
    const orb = Math.min(reb[i], Math.round(reb[i] * orbShare[i] * (0.8 + rng() * 0.4)));
    return { id: p.id, min: m, pts: pt, reb: reb[i], orb, ast: ast[i], stl: stl[i], blk: blk[i], tov: tov[i], pf: Math.min(6, pf[i]), fgm, fga, tpm, tpa: Math.min(tpa, fga), ftm, fta, gs: i < 5 ? 1 : 0, pm: 0 };
  }).filter(l => l.min > 0);
  const pm = Math.round(pts - oppPts);
  for (const l of lines) l.pm = Math.round(pm * l.min / 240 * (0.8 + Math.random() * 0.4) + gauss(rng, 0, 3));
  return lines;
}
/** "Game Score" por 36 minutos, menos lo esperado para ese overall: > 0 rindió más de lo que se espera. */
export function perfOf(l, ov) {
  if (!l.min) return 0;
  const gm = l.pts + 0.4 * l.fgm - 0.7 * l.fga - 0.4 * (l.fta - l.ftm) + 0.7 * l.orb + 0.3 * (l.reb - l.orb) + l.stl + 0.7 * l.ast + 0.7 * l.blk - 0.4 * l.pf - l.tov;
  const per36 = gm * 36 / Math.max(l.min, 8), exp = 3 + (ov - 40) * 0.37;
  return clamp((per36 - exp) / 7.5, -2.5, 2.5) * Math.min(1, l.min / 18);
}
export function addLine(st, l, perf = 0) { st.gp++; st.gs += l.gs; for (const f of ['min', 'pts', 'reb', 'orb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'pm']) st[f] += l[f] || 0; st.perf += perf; }
export const perGame = (st, f) => (st && st.gp ? st[f] / st.gp : 0);

/** Lesiones: chance por partido según minutos, edad y cuerpo médico (medLvl 1-5). Devuelve { d, t } o null. */
const INJ = [['Esguince de tobillo', 1, 8], ['Molestia en la rodilla', 3, 14], ['Contractura muscular', 2, 12], ['Esguince de rodilla', 10, 35], ['Desgarro en el isquiotibial', 14, 40], ['Fractura de mano', 25, 55], ['Fractura por estrés', 40, 85], ['Rotura de ligamento cruzado', 150, 260], ['Rotura del tendón de Aquiles', 140, 240], ['Lesión de espalda', 5, 30], ['Dedo dislocado', 1, 6], ['Golpe en el ojo', 1, 5]];
export function rollInjury(rng, p, mins, medLvl = 2, risk = 1) {
  const pr = (0.0042 + mins / 36 * 0.0034 + Math.max(0, p.age - 29) * 0.00045 - (p.at.stamina - 70) * 0.00002) * (1.18 - medLvl * 0.07) * risk;
  if (rng() > pr) return null;
  const roll = rng(), pool = roll < 0.62 ? INJ.filter(x => x[2] <= 14) : roll < 0.9 ? INJ.filter(x => x[2] > 8 && x[2] <= 60) : INJ.filter(x => x[2] > 40);
  const [t, a, b] = pool[Math.floor(rng() * pool.length)];
  return { t, d: Math.max(1, Math.round((a + (b - a) * rng() * rng()) * (1.25 - medLvl * 0.07))) };
}
