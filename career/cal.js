import { day, ymd, onOrAfter, dow, shuffle, rint } from './util.js';
import { DIVISIONS } from './data.js';

/* ============================================================================
   Calendario NBA de la carrera. Las fechas salen de reglas ("primer martes desde el 18/10") que dan exactamente las de la
   temporada 2026-27 (apertura 20/10, Copa 30/10 → final 11/12, límite de cambios 11/2, All-Star 19-21/2, fin 11/4,
   play-in 13/4, playoffs 17/4) y siguen valiendo para los años que vienen.
   ========================================================================== */
export const seasonLabel = y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;

export function seasonDates(Y) {
  const open = onOrAfter(day(Y, 10, 18), 2);                       // martes
  const cupStart = onOrAfter(open + 8, 5);                          // viernes
  const deadline = onOrAfter(day(Y + 1, 2, 8), 4);                  // jueves
  const asg = deadline + 10;                                        // domingo
  const endRS = onOrAfter(day(Y + 1, 4, 9), 0);                     // domingo
  const piStart = endRS + 2;
  return {
    Y, camp: day(Y, 9, 28), preStart: day(Y, 10, 1), preGames: [day(Y, 10, 5), day(Y, 10, 16)], cuts: open - 1, open,
    cupStart, cupNights: [0, 1, 2, 3, 4].map(k => cupStart + 7 * k), cupQ: [cupStart + 35, cupStart + 36], cupS: cupStart + 40, cupF: cupStart + 42,
    deadline, asg, breakFrom: asg - 3, breakTo: asg + 3, endRS, piStart, pi2: piStart + 2, poStart: piStart + 4,
    lottery: onOrAfter(day(Y + 1, 5, 12), 2),
    draft: onOrAfter(day(Y + 1, 6, 22), 3), faOpen: day(Y + 1, 6, 30), faSign: day(Y + 1, 7, 6), slStart: day(Y + 1, 7, 10), slEnd: day(Y + 1, 7, 20), devTick: day(Y + 1, 8, 15), nextCamp: day(Y + 1, 9, 28),
  };
}

/** Todas las fechas de un partido por temporada que importan, para mostrar en "Próximos eventos". */
export function keyEvents(D) {
  return [
    ['camp', D.camp, 'Campus de entrenamiento'], ['pre', D.preGames[0], 'Pretemporada'], ['cuts', D.cuts, 'Recorte de plantel (15 máx.)'], ['open', D.open, 'Noche de apertura'],
    ['cup', D.cupStart, 'Arranca la NBA Cup'], ['cupf', D.cupF, 'Final de la NBA Cup'], ['deadline', D.deadline, 'Límite de cambios (trade deadline)'], ['asg', D.asg, 'All-Star Weekend'],
    ['endRS', D.endRS, 'Fin de la temporada regular'], ['pi', D.piStart, 'Play-in'], ['po', D.poStart, 'Arrancan los playoffs'], ['lottery', D.lottery, 'Lotería del Draft'],
    ['draft', D.draft, 'Draft de la NBA'], ['fa', D.faOpen, 'Abre la agencia libre'], ['sl', D.slStart, 'Summer League (Las Vegas)'], ['dev', D.devTick, 'Evolución de verano'],
  ].filter(e => e[1]);
}

/* ---------- partidos ---------- */
let gid = 0;
export const resetGid = n => { gid = n || 0; };
export const getGid = () => gid;
export const mkGame = (d, h, a, ty, extra = {}) => ({ id: ++gid, d, h, a, ty, done: false, ...extra });

const confOf = {}, divOf = {};
for (const [dn, { conf, teams }] of Object.entries(DIVISIONS)) for (const t of teams) { confOf[t] = conf; divOf[t] = dn; }
export { confOf, divOf };
export const NBA_TEAMS = Object.values(DIVISIONS).flatMap(d => d.teams);

/** Calendario de 82 partidos por equipo: 4 vs la división (16), 36 vs la conferencia (6 rivales ×4 + 4 rivales ×3), 30 vs la otra conferencia (15 ×2). */
export function pairSeries(Y) {
  const out = [], flip = Y % 2;                         // quién tiene 2 de 3 en casa cambia cada año
  const T = NBA_TEAMS, divs = Object.values(DIVISIONS);
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const a = T[i], b = T[j];
    if (confOf[a] !== confOf[b]) { out.push({ a, b, n: 2, ha: 1 }); continue; }
    if (divOf[a] === divOf[b]) { out.push({ a, b, n: 4, ha: 2 }); continue; }
    const da = divs.find(d => d.teams.includes(a)).teams, db = divs.find(d => d.teams.includes(b)).teams;
    const ia = da.indexOf(a), ib = db.indexOf(b), delta = (((ia - ib + (Y % 5)) % 5) + 5) % 5;
    out.push(delta <= 1 ? { a, b, n: 3, ha: (i + j + flip) % 2 ? 2 : 1 } : { a, b, n: 4, ha: 2 });
  }
  return out;
}

/** Sorteo de la NBA Cup: en cada conferencia, 3 grupos de 5 con un equipo de cada "bombo" (por la tabla de la temporada anterior). */
export function cupDraw(rng, rankedByConf) {
  const groups = {};
  for (const conf of ['E', 'W']) {
    const ranked = rankedByConf[conf], gs = [[], [], []];
    for (let p = 0; p < 5; p++) shuffle(rng, ranked.slice(p * 3, p * 3 + 3)).forEach((t, k) => gs[k].push(t));
    gs.forEach((g, k) => { groups[`${conf}${k + 1}`] = g; });
  }
  return groups;
}

/** Arma los partidos de la temporada regular + fase de grupos de la Copa. `groups` sale de cupDraw. */
export function buildSchedule(rng, D, groups) {
  const games = [], Y = D.Y, series = pairSeries(Y), grp = {};
  for (const [g, ts] of Object.entries(groups)) ts.forEach((t, i) => { grp[t] = { g, i }; });
  const pool = [];
  for (const s of series) {
    const list = [];
    for (let k = 0; k < s.n; k++) list.push(k < s.ha ? [s.a, s.b] : [s.b, s.a]);      // [local, visitante]
    let cupIdx = -1;
    const ga = grp[s.a], gb = grp[s.b];
    if (ga && gb && ga.g === gb.g) cupIdx = rint(rng, 0, list.length - 1);            // uno de los partidos de la serie cuenta como partido de grupo
    list.forEach((hg, k) => {
      if (k === cupIdx) {
        const night = (ga.i + gb.i) % 5;
        games.push(mkGame(D.cupNights[night], hg[0], hg[1], 'cup', { grp: ga.g, night }));
      } else pool.push(hg);
    });
  }
  /* repartir el resto por días */
  const reserved = new Set([...D.cupQ, D.cupS, D.cupF]);
  const busy = new Map();                                   // día → set de equipos que ya juegan
  for (const g of games) { if (!busy.has(g.d)) busy.set(g.d, new Set()); busy.get(g.d).add(g.h).add(g.a); }
  const rem = {}; for (const t of NBA_TEAMS) rem[t] = 0; for (const [h, a] of pool) { rem[h]++; rem[a]++; }
  let left = shuffle(rng, pool);
  const lastPlayed = {}; for (const t of NBA_TEAMS) lastPlayed[t] = -9;
  const days = []; for (let d = D.open; d <= D.endRS; d++) if (!(d >= D.breakFrom && d <= D.breakTo) && !reserved.has(d)) days.push(d);
  days.forEach((d, di) => {
    if (!left.length) return;
    const daysLeft = days.length - di, need = Math.ceil(left.length / daysLeft), wk = dow(d);
    const target = Math.min(15, Math.max(need - 1, Math.round(need * (0.65 + rng() * 0.7) * (wk === 0 || wk === 6 ? 1.2 : wk === 2 || wk === 4 ? 0.9 : 1))));
    const today = busy.get(d) || new Set(); busy.set(d, today);
    const scored = left.map((g, i) => ({ g, i, s: (rem[g[0]] + rem[g[1]]) * 1 + rng() * 6 - (lastPlayed[g[0]] === d - 1 ? 5 : 0) - (lastPlayed[g[1]] === d - 1 ? 5 : 0) }));
    scored.sort((x, y) => y.s - x.s);
    const take = new Set(); let n = 0;
    for (const { g, i } of scored) {
      if (n >= target) break;
      if (today.has(g[0]) || today.has(g[1])) continue;
      const b2b = lastPlayed[g[0]] === d - 1 || lastPlayed[g[1]] === d - 1;
      if (b2b && daysLeft > 12 && rng() < 0.55) continue;
      today.add(g[0]).add(g[1]); take.add(i); n++; rem[g[0]]--; rem[g[1]]--; lastPlayed[g[0]] = lastPlayed[g[1]] = d;
      games.push(mkGame(d, g[0], g[1], 'rs'));
    }
    left = left.filter((_, i) => !take.has(i));
  });
  if (left.length) {                                         // sobrantes (muy raro): se amontonan en los últimos días
    let k = 0; for (const g of left) { const d = days[days.length - 1 - (k++ % 6)]; games.push(mkGame(d, g[0], g[1], 'rs')); }
  }
  games.sort((a, b) => a.d - b.d || a.id - b.id);
  return games;
}

/** 4 amistosos de pretemporada por equipo (entre el 5 y el 16 de octubre). */
export function buildPreseason(rng, D) {
  const out = [], days = []; for (let d = D.preGames[0]; d <= D.preGames[1]; d += 3) days.push(d);
  for (const d of days) {
    const order = shuffle(rng, NBA_TEAMS);
    for (let i = 0; i < 30; i += 2) out.push(mkGame(d, order[i], order[i + 1], 'pre'));
  }
  return out;
}

/** Summer League: 5 jornadas (cada una con los 30 equipos). */
export function buildSummerLeague(rng, D) {
  const out = []; const days = [0, 2, 4, 6, 8].map(k => D.slStart + k);
  days.forEach(d => { const order = shuffle(rng, NBA_TEAMS); for (let i = 0; i < 30; i += 2) out.push(mkGame(d, order[i], order[i + 1], 'sl')); });
  return out;
}

/** Fechas de una serie al mejor de 7 (local-visitante 2-2-1-1-1; un partido cada 2 días). */
export function seriesGames(hi, lo, start, ty, ser, bestOf = 7) {
  const pattern = bestOf === 7 ? [0, 0, 1, 1, 0, 1, 0] : [0];
  return pattern.map((p, k) => mkGame(start + 2 * k, p ? lo : hi, p ? hi : lo, ty, { ser, gm: k + 1 }));
}
