import { clamp, gauss, pick, rint, shuffle, weighted, sum, avg } from './util.js';
import { CAP, ovrNow, baseOvr, salaryFor, rookieSalary, setContract, potRange, POS } from './gen.js';
import { LEAGUES } from './data.js';
import { place, ros, payroll, news, msg, teamStrength, standingsOf, removePlayer, rosterCount } from './state.js';
import { NBA_TEAMS } from './cal.js';

/* ============================================================================
   Mercado: valor de jugadores y picks, contratos, agencia libre, cambios con la IA, fichajes de otras ligas,
   lotería y Draft, y scouting de prospectos. Todo lo que cuesta plata está en millones de dólares.
   ========================================================================== */
export const ROSTER_MAX = 15;
export const rosterLimit = G => (['rs', 'pi', 'po', 'pre'].includes(G.phase) ? ROSTER_MAX : 18);
export const TWO_WAY_MAX = 3;

/* ---------- valores ---------- */
export const marketSalary = (o, age = 27) => salaryFor(o, age);
export function playerValue(p, team = null) {
  const o = ovrNow(p), age = p.age, sal = p.con ? p.con.sal : marketSalary(o, age), yrs = p.con ? Math.max(1, p.con.yrs) : 2;
  let v = Math.pow(Math.max(o - 50, 0), 2.2) * 0.12;
  if (age >= 30) v *= Math.max(0.22, 1 - (age - 29) * 0.1);
  if (age <= 25) v += Math.max(0, p.pot - o) * Math.max(0, 26 - age) * 0.9 * (o > 55 ? 1 : 0.5);
  v += clamp((marketSalary(o, age) - sal) * Math.min(yrs, 3) * 1.1, -50, 70);
  if (team) { if (team.strat === 'rebuild') v *= age <= 24 ? 1.2 : age >= 29 ? 0.72 : 1; else if (team.strat === 'contender') v *= o >= 70 ? 1.1 : 0.9; }
  return Math.max(0.5, v);
}
export function pickValue(G, pk) {
  const t = G.teams[pk.orig], rk = t ? NBA_TEAMS.slice().sort((a, b) => teamStrength(G, b) - teamStrength(G, a)).indexOf(pk.orig) : 15;       // 0 = mejor equipo
  const slot = clamp(30 - rk + (pk.y > G.Y + 1 ? 7 - Math.min(14, (pk.y - G.Y) * 5) * Math.sign(15 - rk) : 0), 1, 30);
  const base = pk.rd === 1 ? 14 + slot * slot * 0.23 + (slot > 26 ? 40 : 0) : 5 + slot * 0.25;
  return base * (1 - 0.1 * (pk.y - (G.Y + 1)));
}
export const pickName = (G, pk) => `${pk.y} · ${pk.rd}ª ronda${pk.orig !== pk.own ? ` (de ${pk.orig})` : ''}`;

/* ---------- reglas de plantel / salario ---------- */
export const capSpace = (G, ab) => CAP.cap - payroll(G, ab);
export const overTax = (G, ab) => Math.max(0, payroll(G, ab) - CAP.tax);
export const twoWayCount = (G, ab) => ros(G, ab).filter(p => p.con?.type === 'two').length;
export const canSignCap = (G, ab, sal, type = 'std') => type === 'two' || sal <= CAP.min + 0.01 || payroll(G, ab) + sal <= CAP.cap;
export const maxSalary = o => Math.min(CAP.cap * CAP.maxPct, 70);

/** ¿Acepta el jugador? Devuelve { ok, need, interest, why } (need = salario mínimo anual que acepta con esos años). */
export function willingness(G, p, ab, sal, yrs, ctx = {}) {
  const o = ovrNow(p), market = marketSalary(o, p.age), t = G.teams[ab];
  const rk = NBA_TEAMS.slice().sort((a, b) => teamStrength(G, b) - teamStrength(G, a)).indexOf(ab);       // 0 = mejor
  const rosterRank = ros(G, ab).filter(x => x !== p && ovrNow(x) > o).length;                                 // cuántos tiene arriba
  let f = 1;
  f -= (15 - rk) / 15 * (p.trait === 'Ambicioso' || p.trait === 'Competitivo' ? 0.16 : 0.08);                // equipos ganadores atraen
  f += (rosterRank >= 6 ? 0.07 : rosterRank <= 2 ? -0.07 : 0);                                              // minutos: si tiene a 6 mejores adelante pide más
  if (p.trait === 'Mercenario') f += 0.06; if (p.trait === 'Leal' && p.tm === ab) f -= 0.1;
  if (ctx.own) f -= 0.04 + (p.mor - 60) / 600;                                                               // renovar: la moral cuenta
  if (ctx.intl) f += 0.05 * (LEAGUES[p.lg]?.lvl > 60 ? 1 : 0) - 0.06;                                        // pasar a la NBA suele ser un sueño
  f += yrs > 3 ? (p.age >= 30 ? -0.04 : 0.03) : yrs === 1 && p.age <= 27 ? 0.04 : 0;
  const ask = (p.fa?.ask ?? market) * clamp(f, 0.75, 1.3), need = Math.max(CAP.min, Math.round(ask * 10) / 10);
  const ratio = sal / need, interest = ratio >= 1.12 ? 'Muy alto' : ratio >= 1 ? 'Alto' : ratio >= 0.9 ? 'Medio' : ratio >= 0.8 ? 'Bajo' : 'Nulo';
  return { ok: sal + 1e-6 >= need, need, interest, ratio };
}

/* ---------- agencia libre ---------- */
export function signPlayer(G, p, ab, sal, yrs, type = 'std', o = {}) {
  const was = p.tm || p.lg;
  place(G, p, ab, 'NBA');
  setContract(p, sal, yrs, type); p.fa = null; p.mor = Math.min(95, (p.mor || 60) + 8);
  if (type === 'two') p.gl = true;
  p.tr = p.tr || { focus: null, xp: 0 };
  p.st = p.st && p.st.gp ? p.st : null;
  return p;
}
export function releasePlayer(G, p, o = {}) {
  const ab = p.tm; if (!ab) return;
  if (p.con && p.con.sal > CAP.min && !o.noDead) { G.dead[ab] = (G.dead[ab] || 0) + Math.round(p.con.sal * Math.min(p.con.yrs, 2) * 0.4 * 10) / 10; (G.deadYrs ||= {})[ab] = 1; }
  place(G, p, 'FA', 'FA'); p.fa = { ask: marketSalary(ovrNow(p), p.age) * 0.85, yrs: 1 }; p.con = null; p.gl = false;
}
/** Sueldo "justo" para renovar o pagar en agencia libre. */
export const askFor = p => Math.round(Math.min(maxSalary(), marketSalary(ovrNow(p), p.age)) * 10) / 10;

/* ---------- cambios ---------- */
export function assetValue(G, a, toAb) { const team = G.teams[toAb]; return a.k === 'p' ? playerValue(G.P[a.id], team) : pickValue(G, a.pk) * (team?.strat === 'rebuild' ? 1.25 : team?.strat === 'contender' ? 0.75 : 1); }
export const dealIsOpen = G => !(G.today > G.D.deadline && G.today < G.D.draft - 25 && ['rs', 'pi', 'po'].includes(G.phase)) && !(G.phase === 'po' || G.phase === 'pi');

/** Evalúa un cambio: give = lo que sale del equipo A, get = lo que llega. Cada ítem: {k:'p', id} o {k:'k', pk}. */
export function evalTrade(G, A, B, give, get) {
  const diff = G.diff ? { rookie: 0.88, pro: 1, allstar: 1.1, legend: 1.22 }[G.diff] || 1 : 1;
  const sum_ = (list, to) => list.reduce((t, a) => t + assetValue(G, a, to), 0);
  const vOut = sum_(give, B), vIn = sum_(get, B);                       // valor para B (el que decide) de lo que recibe (give) y de lo que entrega (get)
  const pls = list => list.filter(a => a.k === 'p').map(a => G.P[a.id]);
  const salGive = sum(pls(give), p => p.con?.sal || 0), salGet = sum(pls(get), p => p.con?.sal || 0);
  const res = { ok: true, why: [], ratio: vIn > 0 ? vOut / (vIn * (B === G.user ? 1 : diff)) : 9, salGive, salGet };
  const rosterA = rosterCount(G, A) - pls(give).length + pls(get).length, rosterB = rosterCount(G, B) - pls(get).length + pls(give).length, lim = rosterLimit(G);
  if (rosterA > lim) { res.ok = false; res.why.push(`${A} quedaría con ${rosterA} jugadores (máx. ${lim}).`); }
  if (rosterB > lim) { res.ok = false; res.why.push(`${B} quedaría con ${rosterB} jugadores (máx. ${lim}).`); }
  const matching = (ab, incoming, outgoing) => { const after = payroll(G, ab) - outgoing + incoming; return after <= CAP.cap || incoming <= outgoing * 1.25 + 0.1; };
  if (!matching(A, salGet, salGive)) { res.ok = false; res.why.push(`${A}: pasa el tope salarial y los salarios no coinciden (hasta 125% + $0,1M).`); }
  if (!matching(B, salGive, salGet)) { res.ok = false; res.why.push(`${B}: pasa el tope salarial y los salarios no coinciden.`); }
  if (!dealIsOpen(G)) { res.ok = false; res.why.push('Los cambios están cerrados (pasó el límite de la temporada).'); }
  if (!give.length && !get.length) { res.ok = false; res.why.push('Elegí al menos un jugador o pick.'); }
  res.accept = res.ok && res.ratio >= 1.02;
  res.verdict = !res.ok ? 'Inválido' : res.ratio >= 1.15 ? 'Les encanta' : res.ratio >= 1.02 ? 'Aceptable' : res.ratio >= 0.88 ? 'Casi: piden algo más' : 'Rechazan';
  return res;
}
export function execTrade(G, A, B, give, get) {
  const names = [];
  for (const a of give) { if (a.k === 'p') { const p = G.P[a.id]; place(G, p, B, 'NBA'); p.mor = Math.max(30, (p.mor || 60) - (A === G.user ? 4 : 0)); names.push(p.n); } else a.pk.own = B; }
  for (const a of get) { if (a.k === 'p') { const p = G.P[a.id]; place(G, p, A, 'NBA'); names.push(p.n); } else a.pk.own = A; }
  for (const ab of [A, B]) { const t = G.teams[ab]; if (t) t.lineup = t.lineup.filter(id => G.P[id]?.tm === ab); }
  if (A === G.user || B === G.user) G.lineup = G.lineup.filter(id => G.P[id]?.tm === G.user);
  return names;
}
/** Preguntar a la IA por un jugador: arma una contraoferta razonable (le pide lo que le falta en valor con sus jugadores/picks). */
export function counterAsk(G, user, ab, get) {
  const need = sum(get, a => assetValue(G, a, ab)) * (G.diff ? { rookie: 0.88, pro: 1, allstar: 1.1, legend: 1.22 }[G.diff] : 1) * 1.04;
  const cand = [...ros(G, user).filter(p => p.lg === 'NBA').map(p => ({ k: 'p', id: p.id, v: assetValue(G, { k: 'p', id: p.id }, ab) })), ...G.picks.filter(k => k.own === user).map(pk => ({ k: 'k', pk, v: assetValue(G, { k: 'k', pk }, ab) }))].sort((a, b) => b.v - a.v);
  const give = []; let tot = 0;
  for (const c of cand) { if (tot >= need) break; if (c.k === 'p' && G.P[c.id].role === 'estrella' && need < c.v * 0.7) continue; if (tot + c.v > need * 1.6 && give.length) continue; give.push(c); tot += c.v; }
  return tot >= need ? give.map(({ v, ...r }) => r) : null;
}

/* ---------- fichajes de otras ligas ---------- */
export function buyoutFee(G, p) {
  const L = LEAGUES[p.lg] || LEAGUES.EUR, club = G.clubs[p.tm], base = Math.max(0.2, marketSalary(ovrNow(p), p.age) * 0.5 * (1 + (club ? club.prestige : 0.5)) * (L.buyout || 0.5));
  return Math.round(base * (p.age <= 23 ? 1.5 : 1) * 10) / 10;
}
export function signIntl(G, p, ab, sal, yrs) {
  const fee = buyoutFee(G, p), club = p.tm;
  place(G, p, ab, 'NBA'); setContract(p, sal, yrs, 'std'); p.mor = 78;
  if (ab === G.user) G.fin.cash -= fee;
  return fee;
}

/* ---------- agencia libre de las IA ---------- */
export function aiFreeAgency(G, rng, intensity = 1) {
  const fas = ros(G, 'FA').filter(p => p.fa).sort((a, b) => ovrNow(b) - ovrNow(a));
  if (!fas.length) return;
  const teams = shuffle(rng, NBA_TEAMS.filter(t => t !== G.user));
  for (const ab of teams) {
    const n = rosterCount(G, ab); if (n >= 15) continue;
    const space = capSpace(G, ab), needMin = n < 13;
    if (rng() > intensity * (needMin ? 0.9 : 0.35)) continue;
    const cand = fas.filter(p => p.tm === null && p.lg === 'FA');
    const pickP = cand.find(p => { const ask = p.fa.ask; return (ask <= space + 0.001 || ask <= CAP.min + 0.01) && (!needMin || true) && (ovrNow(p) >= (needMin ? 0 : 66) || rng() < 0.2); });
    if (!pickP) continue;
    const sal = Math.min(pickP.fa.ask, Math.max(CAP.min, space)), type = sal <= CAP.min + 0.05 && rng() < 0.4 ? 'two' : 'std';
    signPlayer(G, pickP, ab, Math.max(CAP.min * (type === 'two' ? 0.5 : 1), sal), pickP.fa.yrs || 1, type);
    if (ovrNow(pickP) >= 72) news(G, `${G.teams[ab].name} ficha a ${pickP.n} (${ovrNow(pickP)}) por ${pickP.con.yrs} año${pickP.con.yrs > 1 ? 's' : ''}.`, 'fichaje');
  }
}
/** Al terminar el contrato: la IA renueva o suelta. */
export function aiExpiring(G, rng, p) {
  const ab = p.tm, t = G.teams[ab], o = ovrNow(p), keep = o >= 74 ? 0.85 : o >= 66 ? 0.6 : o >= 58 ? 0.35 : 0.15;
  const young = p.age <= 24 && p.pot - o >= 4 ? 0.2 : 0;
  if (rng() < keep + young && (payroll(G, ab) < CAP.tax + 5 || o >= 80)) { setContract(p, Math.max(CAP.min, askFor(p) * (0.9 + rng() * 0.2)), rint(rng, 1, o >= 75 ? 4 : 2), 'std'); return true; }
  place(G, p, 'FA', 'FA'); p.fa = { ask: askFor(p) * (0.9 + rng() * 0.25), yrs: rint(rng, 1, 3) }; p.con = null; p.gl = false;
  if (o >= 76) news(G, `${p.n} (${o}) queda libre y sale a la agencia libre.`, 'fichaje');
  return false;
}
/** Algunas estrellas de otras ligas saltan a la NBA cada verano (el resto de las IA mueve piezas). */
export function aiIntlMoves(G, rng) {
  const cand = Object.values(G.P).filter(p => p.lg !== 'NBA' && p.tm && G.clubs[p.tm] && ovrNow(p) >= 66 && p.age <= 29).sort((a, b) => ovrNow(b) - ovrNow(a)).slice(0, 14);
  for (const p of cand) {
    if (rng() > 0.5) continue;
    const ab = pick(rng, NBA_TEAMS.filter(t => t !== G.user && rosterCount(G, t) < 15)); if (!ab) continue;
    const from = G.clubs[p.tm].name; signIntl(G, p, ab, Math.max(CAP.min, askFor(p) * 0.8), rint(rng, 2, 3));
    news(G, `${p.n} (${ovrNow(p)}) deja ${from} y firma con ${G.teams[ab].name}.`, 'intl');
  }
}
export function aiTrades(G, rng, n = 2) {
  if (!dealIsOpen(G)) return;
  for (let k = 0; k < n; k++) {
    const [A, B] = shuffle(rng, NBA_TEAMS.filter(t => t !== G.user)).slice(0, 2); if (!A || !B) continue;
    const pa = pick(rng, ros(G, A).filter(p => p.lg === 'NBA' && !p.gl)), pb = pick(rng, ros(G, B).filter(p => p.lg === 'NBA' && !p.gl)); if (!pa || !pb) continue;
    const r = evalTrade(G, A, B, [{ k: 'p', id: pa.id }], [{ k: 'p', id: pb.id }]);
    if (r.ok && r.ratio >= 0.95 && r.ratio <= 1.12 && rng() < 0.35) { execTrade(G, A, B, [{ k: 'p', id: pa.id }], [{ k: 'p', id: pb.id }]); if (Math.max(ovrNow(pa), ovrNow(pb)) >= 72) news(G, `Cambio: ${G.teams[A].name} envía a ${pa.n} a ${G.teams[B].name} por ${pb.n}.`, 'cambio'); }
  }
}

/* ---------- lotería y draft ---------- */
const LOTTERY = [14, 14, 14, 12.5, 10.5, 9, 7.5, 6, 4.5, 3, 2, 1.5, 1, 0.5];
export function runLottery(G, rng, playoffTeams) {
  const worst = standingsOf(G).filter(t => !playoffTeams.has(t.ab)).reverse().slice(0, 14);            // peor primero
  const pool = worst.map((t, i) => ({ ab: t.ab, w: LOTTERY[i] })), top = [];
  for (let k = 0; k < 4; k++) { const p = weighted(rng, pool.filter(x => !top.includes(x.ab)), x => x.w); top.push(p.ab); }
  const rest = worst.map(t => t.ab).filter(a => !top.includes(a));
  const order1 = [...top, ...rest, ...standingsOf(G).filter(t => playoffTeams.has(t.ab)).reverse().map(t => t.ab)];
  const order2 = standingsOf(G).reverse().map(t => t.ab);
  const y = G.Y + 1, order = [];
  [[1, order1], [2, order2]].forEach(([rd, ord]) => ord.forEach((ab, i) => { const pk = G.picks.find(k => k.y === y && k.rd === rd && k.orig === ab); order.push({ n: (rd - 1) * 30 + i + 1, rd, orig: ab, own: pk ? pk.own : ab }); }));
  G.dr = { y, order, i: 0, done: false, sel: [] };
  G.lott = { top, worst: worst.map(t => t.ab) };
  return G.dr;
}
export const draftPool = (G, y) => G.prospects.map(id => G.P[id]).filter(p => p && p.prospect && p.prospect.cls === y && !p.drafted);
/** Valor de un prospecto a ojos de la IA (potencial ruidoso + overall). */
export const prospectScore = (p, rng) => p.ovr_ ?? (baseOvr(p) * 0.35 + (p.pot + p.prospect.err * 0.4) * 0.65 + (rng ? gauss(rng, 0, 2.2) : 0));
export function draftPickPlayer(G, p, slot) {
  const rd = slot.rd, ab = slot.own, rank = slot.n - 1;
  p.drafted = { y: G.dr.y, n: slot.n, rd, by: ab };
  G.prospects = G.prospects.filter(id => id !== p.id);
  p.lg = 'NBA'; place(G, p, ab, 'NBA'); p.role = 'prospecto'; p.rk = G.dr.y; p.prospect = null;
  if (rd === 1) setContract(p, rookieSalary(rank), 4, 'rookie'); else setContract(p, rd === 2 && rank > 44 ? 0.65 : 1.35, rd === 2 ? 2 : 3, rd === 2 && rank > 44 ? 'two' : 'rookie');
  if (p.con.type === 'two') p.gl = true;
  p.mor = 85; G.dr.sel.push({ n: slot.n, id: p.id, ab });
  return p;
}
export function aiPick(G, rng, slot) {
  const pool = draftPool(G, G.dr.y).map(p => ({ p, s: prospectScore(p, rng) })).sort((a, b) => b.s - a.s).slice(0, 10);
  return draftPickPlayer(G, pool[Math.min(pool.length - 1, Math.floor(rng() * rng() * 3))].p, slot);
}
export const onClock = G => (G.dr && !G.dr.done ? G.dr.order[G.dr.i] : null);
/** Avanza el draft hasta que le toque al usuario (o termina). `all` = también elige por el usuario. */
export function draftRun(G, rng, all = false) {
  const d = G.dr; if (!d) return;
  while (d.i < d.order.length) {
    const s = d.order[d.i];
    if (s.own === G.user && !all) return s;
    const p = aiPick(G, rng, s); d.i++;
    if (s.own === G.user) news(G, `Elegiste a ${p.n} con el pick #${s.n}.`, 'draft');
    else if (s.n <= 5 || (s.n <= 14 && ovrNow(p) >= 58)) news(G, `Pick #${s.n}: ${G.teams[s.own].name} elige a ${p.n} (${p.pos}, ${p.age} años).`, 'draft');
  }
  if (d.i >= d.order.length) draftFinish(G, rng);
  return null;
}
export function draftUserPick(G, rng, pid) {
  const s = onClock(G), p = G.P[pid]; if (!s || s.own !== G.user || !p || p.prospect?.cls !== G.dr.y) return false;
  draftPickPlayer(G, p, s); G.dr.i++; news(G, `Elegiste a ${p.n} con el pick #${s.n}.`, 'draft'); return draftRun(G, rng) || true;
}
export function draftFinish(G, rng) {
  G.dr.done = true;
  const left = draftPool(G, G.dr.y).sort((a, b) => prospectScore(b) - prospectScore(a));
  left.forEach((p, i) => {
    G.prospects = G.prospects.filter(id => id !== p.id);
    if (i < 40) { p.lg = 'GL'; p.fa = { ask: 0.6, yrs: 2 }; p.prospect = null; p.role = 'rotación'; place(G, p, 'GLFA', 'GL'); }
    else if (i < 70) { const club = pick(rng, Object.keys(G.clubs)); p.prospect = null; p.lg = G.clubs[club].lg; place(G, p, club, p.lg); setContract(p, 0.4, 2, 'std', { clause: 0 }); }
    else removePlayer(G, p);
  });
}

/* ---------- scouting ---------- */
export const scoutKnow = (G, pid) => G.sc.know[pid] || 0;
export function scoutTick(G, rng) {
  const L = G.staff.scout, watch = new Set(G.sc.watch);
  for (const id of G.prospects) {
    const p = G.P[id]; if (!p) continue;
    const add = (watch.has(id) ? 5 + L * 2.2 : 0.35 + L * 0.2) * (0.6 + rng() * 0.8);
    G.sc.know[id] = Math.min(100, (G.sc.know[id] || 0) + add);
  }
}
export const prospectRange = (G, p) => potRange(p, scoutKnow(G, p.id), G.staff.scout);
/** Lista de prospectos del próximo draft ordenada como los ojeadores creen (con ruido que baja al conocerlos). */
export function bigBoard(G, cls) {
  return G.prospects.map(id => G.P[id]).filter(p => p && p.prospect.cls === cls)
    .map(p => ({ p, s: baseOvr(p) * 0.35 + (p.pot + p.prospect.err * (1 - scoutKnow(G, p.id) / 100)) * 0.65 })).sort((a, b) => b.s - a.s).map(x => x.p);
}
