import { clamp, pick, rint, shuffle, fmtDay, money, sum } from './util.js';
import { ovrNow, baseOvr, CAP, ATTR_LABEL, POS_NAME } from './gen.js';
import { ros, msg, news, standingsOf, rankIn, payroll, teamStrength, place } from './state.js';
import { playerValue, assetValue, evalTrade, askFor, ROSTER_MAX } from './market.js';
import { roleMin, moodLabel } from './prog.js';
import { NBA_TEAMS } from './cal.js';
import { DIFFS } from './world.js';

/* ============================================================================
   Buzón del DT: jugadores que te escriben (minutos, contrato, pedido de cambio), conferencias de prensa con dos respuestas
   (cada una tira de tu "identidad" como DT), ofertas de cambio de otros equipos, informes de ojeadores, resumen de
   valoraciones y la directiva (objetivos y confianza). Todo se puede ignorar: avanzar fechas nunca se traba por un mensaje.
   ========================================================================== */
const STAFF = { board: { name: 'La directiva', role: 'Presidente' }, press: { name: 'Prensa', role: 'Comunicación' }, scout: { name: 'Jefe de ojeadores', role: 'Scouting' }, gm: { name: 'Gerente general', role: 'GM' }, med: { name: 'Cuerpo médico', role: 'Médico' }, agent: { name: 'Agente', role: 'Representante' } };
export const fromOf = k => STAFF[k] || { name: k, role: '' };
const last = G => G.coach.last;
const pName = p => p.n;

/* ---------- objetivos de la directiva ---------- */
export function setBoardGoals(G) {
  const ab = G.user, rk = NBA_TEAMS.slice().sort((a, b) => teamStrength(G, b) - teamStrength(G, a)).indexOf(ab) + 1, dm = DIFFS[G.diff].board;
  const g = [];
  if (rk <= 4) g.push({ id: 'title', t: 'Ser finalista de la NBA', w: 26 }, { id: 'seed', t: 'Terminar entre los 3 mejores de la conferencia', w: 12 });
  else if (rk <= 10) g.push({ id: 'semis', t: 'Llegar a semifinales de conferencia', w: 22 }, { id: 'po', t: 'Clasificar a playoffs (top 6)', w: 12 });
  else if (rk <= 20) g.push({ id: 'po', t: 'Clasificar a los playoffs (play-in incluido)', w: 20 }, { id: 'wins', t: `Ganar ${Math.round(38 * dm + (24 - rk) * 0.4)} partidos o más`, w: 10, n: Math.round(38 * dm + (24 - rk) * 0.4) });
  else g.push({ id: 'wins', t: `Ganar ${Math.round(28 * dm + (30 - rk) * 0.3)} partidos o más`, w: 16, n: Math.round(28 * dm + (30 - rk) * 0.3) }, { id: 'dev', t: 'Que un jugador joven suba 4+ de overall', w: 10 });
  g.push({ id: 'tax', t: 'No pasar el impuesto de lujo', w: 8 }, { id: 'cup', t: 'Llegar a cuartos de final de la NBA Cup', w: 6 });
  G.board.goals = g.map(x => ({ ...x, done: null }));
  msg(G, { kind: 'board', from: 'board', subj: `Objetivos de la temporada`, body: `Bienvenido, ${G.coach.first} ${last(G)}. Para esta temporada la directiva espera:\n\n${g.map(x => `• ${x.t}`).join('\n')}\n\nLa confianza de la directiva hoy es ${Math.round(G.board.conf)}%. Si cae demasiado, no seguirás en el cargo.` });
}
export function evalBoard(G, ctx) {
  const t = G.teams[G.user], results = [];
  for (const g of G.board.goals) {
    let ok = false;
    if (g.id === 'title') ok = ctx.finals; else if (g.id === 'semis') ok = ctx.round >= 2; else if (g.id === 'po') ok = ctx.po; else if (g.id === 'seed') ok = ctx.seed <= 3;
    else if (g.id === 'wins') ok = t.w >= g.n; else if (g.id === 'tax') ok = payroll(G, G.user) <= CAP.tax; else if (g.id === 'cup') ok = ctx.cupQ; else if (g.id === 'dev') ok = ros(G, G.user).some(p => (p.dY || 0) >= 4);
    g.done = ok; results.push([g, ok]);
    G.board.conf = clamp(G.board.conf + (ok ? g.w * 0.6 : -g.w * 0.8 * DIFFS[G.diff].board), 0, 100);
  }
  return results;
}

/* ---------- identidad del DT ---------- */
export const IDENT = { disc: ['Disciplina', 'Armonía'], star: ['Estrellas', 'Colectivo'], youth: ['Veteranos', 'Juventud'] };
export const identLabel = G => { const i = G.coach.ident || { disc: 0, star: 0, youth: 0 }; return Object.entries(IDENT).map(([k, [a, b]]) => i[k] > 15 ? b : i[k] < -15 ? a : null).filter(Boolean); };
function ident(G, k, d) { const i = (G.coach.ident ||= { disc: 0, star: 0, youth: 0 }); i[k] = clamp(i[k] + d, -100, 100); }
function teamMood(G, d, onlyRole = null) { for (const p of ros(G, G.user)) if (p.lg === 'NBA' && (!onlyRole || p.role === onlyRole)) p.mor = clamp((p.mor || 60) + d, 5, 99); }

/* ---------- generadores ---------- */
const PRESS = [
  { id: 'loss', when: c => c.lost, q: c => `Perdieron ${c.score} ante ${c.opp}. ¿Qué pasó?`, a: [
    { t: 'Fue falta de intensidad. Vamos a exigir más desde mañana.', fx: { mood: -2, board: 1, ident: ['disc', -14] }, r: 'Los jugadores escucharon la crítica en público. La directiva la aprobó.' },
    { t: 'Asumo la responsabilidad: el plan no fue el correcto.', fx: { mood: 3, board: -1, ident: ['disc', 14] }, r: 'El vestuario valoró que le diste la cara a la prensa.' } ] },
  { id: 'win', when: c => c.won && c.diff >= 15, q: c => `Paliza a ${c.opp} por ${c.diff}. ¿Qué destacás?`, a: [
    { t: 'La defensa, como siempre. Ahí se ganan los partidos.', fx: { mood: 1, board: 1, ident: ['star', 6] }, r: 'Se reforzó la idea de equipo defensivo.' },
    { t: 'Todos aportaron. Hoy ganó el grupo entero.', fx: { mood: 4, board: 0, ident: ['star', 12] }, r: 'El banco se sintió parte y subió la moral.' } ] },
  { id: 'star', when: c => c.starLine, q: c => `${c.starLine.n} tuvo una gran noche. ¿Es el líder del equipo?`, a: [
    { t: 'Sí. Es nuestra estrella y el equipo gira a su alrededor.', fx: { mood: 0, board: 1, ident: ['star', -14], who: 8 }, r: `${'La estrella'} se sintió respaldada, el resto lo anotó.` },
    { t: 'Es parte de un grupo. Nadie es más importante que el equipo.', fx: { mood: 2, board: 0, ident: ['star', 14], who: -3 }, r: 'Gesto colectivo, aunque la estrella arqueó una ceja.' } ] },
  { id: 'young', when: c => c.rookie, q: c => `Le diste minutos a ${c.rookie.n}. ¿Apuesta a futuro?`, a: [
    { t: 'Sí. Quiero que los jóvenes crezcan jugando.', fx: { mood: 1, board: 0, ident: ['youth', 14], who: 8 }, r: 'El joven respiró; los veteranos tomaron nota.' },
    { t: 'Los minutos se ganan. Si rinde, juega.', fx: { mood: 0, board: 1, ident: ['youth', -10], who: -2 }, r: 'Mensaje de meritocracia para todos.' } ] },
  { id: 'streak', when: c => c.streakL >= 3, q: c => `Van ${c.streakL} derrotas seguidas. ¿Te preocupa tu puesto?`, a: [
    { t: 'No pienso en eso. Pienso en el próximo partido.', fx: { mood: 1, board: -1, ident: ['disc', -4] }, r: 'Respuesta de manual. La directiva te miró con recelo.' },
    { t: 'Entiendo la presión y voy a revertirlo. Confío en este grupo.', fx: { mood: 3, board: 1, ident: ['disc', 8] }, r: 'Mostraste convicción y respaldo al plantel.' } ] },
  { id: 'trade', when: c => c.deadline, q: () => `Se acerca el límite de cambios. ¿Van a mover el plantel?`, a: [
    { t: 'Estamos abiertos a todo si mejora al equipo.', fx: { mood: -3, board: 1, ident: ['disc', -8] }, r: 'Algunos jugadores quedaron inquietos por los rumores.' },
    { t: 'Confío en este grupo. No hay urgencias.', fx: { mood: 3, board: 0, ident: ['disc', 10] }, r: 'Los jugadores agradecieron la confianza.' } ] },
];
export function pressConference(G, rng, ctx) {
  const ok = PRESS.filter(q => q.when(ctx)); if (!ok.length || rng() > (ctx.force ? 1 : 0.45)) return;
  const q = pick(rng, ok);
  msg(G, { kind: 'press', from: 'press', subj: 'Conferencia de prensa', body: q.q(ctx), press: q.id, acts: q.a.map((a, i) => ({ id: 'p' + i, label: a.t })), pid: ctx.starLine?.id || ctx.rookie?.id || null, expire: G.today + 3 });
}
export function answerPress(G, m, actId) {
  const q = PRESS.find(x => x.id === m.press), a = q?.a[+actId.slice(1)]; if (!a) return '';
  const fx = a.fx; teamMood(G, fx.mood); G.board.conf = clamp(G.board.conf + fx.board, 0, 100); ident(G, fx.ident[0], fx.ident[1]);
  if (fx.who && m.pid && G.P[m.pid]) G.P[m.pid].mor = clamp((G.P[m.pid].mor || 60) + fx.who, 5, 99);
  m.done = true; m.result = a.r; return a.r;
}

/** Mensajes diarios: se llama una vez por día durante la temporada (probabilidades bajas). */
export function dailyMessages(G, rng) {
  const me = ros(G, G.user).filter(p => p.lg === 'NBA' && !p.gl);
  if (G.phase === 'rs' || G.phase === 'pre' || G.phase === 'po') {
    /* minutos */
    for (const p of me) {
      if (p.role === 'banco' || p.role === 'prospecto') continue;
      const g = p.st ? p.st.gp : 0, mpg = g ? p.st.min / g : 0;
      if (g >= 10 && mpg < roleMin(p.role) * 0.62 && p.mor < 52 && !p.flagMin && rng() < 0.12) {
        p.flagMin = G.today;
        msg(G, { kind: 'player', from: p.id, pid: p.id, subj: `${p.n}: "Quiero jugar más"`, body: `Entrenador, estoy promediando ${mpg.toFixed(0)} minutos y me siento ${p.role === 'estrella' ? 'una estrella' : 'titular'} en este equipo. Necesito que me des el lugar que merezco.`, acts: [{ id: 'promise', label: 'Prometer más minutos' }, { id: 'explain', label: 'Explicarle su rol' }, { id: 'ignore', label: 'No responder' }], expire: G.today + 10 });
        break;
      }
    }
    /* contratos */
    for (const p of me) if (p.con && p.con.yrs === 1 && p.con.type !== 'two' && ovrNow(p) >= 60 && !p.flagCon && G.today > G.D.open + 30 && rng() < 0.01) {
      p.flagCon = G.Y; msg(G, { kind: 'player', from: p.id, pid: p.id, subj: `${p.n} quiere renovar`, body: `Me gustaría quedarme. Mi contrato vence este año. ¿Podemos hablar de una extensión? Mi agente pide alrededor de ${money(askFor(p))} por temporada.`, acts: [{ id: 'negotiate', label: 'Negociar contrato' }, { id: 'later', label: 'Más adelante' }], expire: G.today + 30 });
      break;
    }
    /* pedido de cambio */
    for (const p of me) if (p.mor < 26 && ovrNow(p) >= 62 && !p.flagTrade && rng() < 0.05) {
      p.flagTrade = G.today; msg(G, { kind: 'player', from: p.id, pid: p.id, subj: `${p.n} pide ser cambiado`, body: `Esto no funciona para mí. Quiero que me busques otro equipo. Mi agente ya habló con la prensa.`, acts: [{ id: 'listen', label: 'Escuchar ofertas' }, { id: 'convince', label: 'Intentar convencerlo' }, { id: 'refuse', label: 'Negarme: sigue acá' }], expire: G.today + 12 });
      break;
    }
    /* ofertas de otros equipos por tus jugadores */
    if (G.phase !== 'po' && G.today <= G.D.deadline && rng() < 0.045) tradeOffer(G, rng, me);
    /* mercado / agente */
    if (rng() < 0.012) agentMsg(G, rng);
  }
  if (rng() < 0.02 && G.inbox.filter(m => m.kind === 'fan').length < 4) fanMsg(G, rng);
}
function tradeOffer(G, rng, me) {
  const A = G.user, tgt = pick(rng, me.filter(p => ovrNow(p) >= 64 && p.role !== 'prospecto')); if (!tgt) return;
  const B = pick(rng, NBA_TEAMS.filter(t => t !== A)), theirs = ros(G, B).filter(p => p.lg === 'NBA' && !p.gl && playerValue(p) >= 6);
  const sw = pick(rng, theirs); if (!sw) return;
  const give = [{ k: 'p', id: tgt.id }], get = [{ k: 'p', id: sw.id }];
  const r = evalTrade(G, A, B, give, get); if (!r.ok || r.ratio < 1.04) return;
  msg(G, { kind: 'offer', from: 'gm', subj: `Oferta de ${G.teams[B].name}`, body: `${G.teams[B].name} ofrece a ${sw.n} (${ovrNow(sw)}, ${sw.pos}, ${money(sw.con.sal)} hasta ${G.Y + sw.con.yrs}) por ${tgt.n} (${ovrNow(tgt)}, ${tgt.pos}, ${money(tgt.con.sal)}).`, acts: [{ id: 'accept', label: 'Aceptar el cambio' }, { id: 'reject', label: 'Rechazar' }], data: { B, give, get }, expire: G.today + 7 });
}
function agentMsg(G, rng) {
  const fa = ros(G, 'FA').filter(p => ovrNow(p) >= 58).sort((a, b) => ovrNow(b) - ovrNow(a)).slice(0, 8); const p = fa.length ? pick(rng, fa) : null;
  if (!p) return;
  msg(G, { kind: 'agent', from: 'agent', pid: p.id, subj: `${p.n} está disponible`, body: `Represento a ${p.n}, ${POS_NAME[p.pos].toLowerCase()} de ${p.age} años (${ovrNow(p)} de overall). Está libre y le interesaría sumarse a su proyecto.`, acts: [{ id: 'view', label: 'Ver jugador' }], expire: G.today + 14 });
}
function fanMsg(G, rng) {
  const t = G.teams[G.user], r = rankIn(G, G.user), good = t.w > t.l;
  const texts = good ? ['La hinchada está feliz: el estadio se llena cada noche y la prensa te elogia.', 'Los fanáticos piden un campeonato. ¡Seguí así, profe!'] : ['La hinchada pide cambios y el humor en las redes es hostil.', 'Los fanáticos están impacientes con los resultados.'];
  msg(G, { kind: 'fan', from: 'press', subj: good ? 'La gente te quiere' : 'Presión de los fanáticos', body: pick(rng, texts) });
  G.board.conf = clamp(G.board.conf + (good ? 0.5 : -0.5), 0, 100);
}
export function ratingDigest(G, ups, downs) {
  if (!ups.length && !downs.length) return;
  const f = x => `${x.p.n} (${x.p.tm}) ${x.b} → ${x.a}`;
  msg(G, { kind: 'ratings', from: 'gm', subj: 'Actualización de valoraciones', body: `${ups.length ? 'Suben:\n' + ups.map(x => `▲ ${f(x)}`).join('\n') : ''}${downs.length ? '\n\nBajan:\n' + downs.map(x => `▼ ${f(x)}`).join('\n') : ''}`, pids: [...ups, ...downs].map(x => x.p.id) });
}

/** Responde a un mensaje. Devuelve texto de resultado (o { open: 'negotiate' | 'player' | 'trade', pid }) para que la pantalla actúe. */
export function answerMsg(G, m, act, rng) {
  const p = m.pid ? G.P[m.pid] : null;
  if (m.kind === 'press') return answerPress(G, m, act);
  if (m.kind === 'player' && p) {
    if (act === 'promise') { p.mor = clamp(p.mor + 12, 5, 99); p.promise = { min: roleMin(p.role) * 0.9, until: G.today + 30 }; m.done = true; return `${p.n} se calma. Le prometiste minutos: si no los cumplís en un mes, la moral va a caer.`; }
    if (act === 'explain') { const gain = p.trait === 'Tranquilo' || p.trait === 'Líder' ? 8 : 3; p.mor = clamp(p.mor + gain, 5, 99); m.done = true; return `${p.n} entiende su rol${gain > 5 ? ' y lo aceptó con buena cara' : ' aunque no está del todo conforme'}.`; }
    if (act === 'ignore') { p.mor = clamp(p.mor - 7, 5, 99); m.done = true; return `${p.n} se siente ignorado.`; }
    if (act === 'later') { p.mor = clamp(p.mor - 2, 5, 99); m.done = true; return `Quedaron en hablar más adelante.`; }
    if (act === 'negotiate') { m.done = true; return { open: 'negotiate', pid: p.id }; }
    if (act === 'listen') { p.tradeReq = true; m.done = true; return `${p.n} queda en la lista de cambios. Las ofertas llegarán a tu buzón.`; }
    if (act === 'convince') { const ok = rng() < (p.trait === 'Leal' ? 0.7 : p.trait === 'Mercenario' ? 0.2 : 0.42) + (G.board.conf > 70 ? 0.1 : 0); if (ok) { p.mor = clamp(p.mor + 24, 5, 99); m.done = true; return `Lo convenciste: ${p.n} se queda y retira el pedido.`; } p.mor = clamp(p.mor - 6, 5, 99); p.tradeReq = true; m.done = true; return `No hubo caso: ${p.n} sigue queriendo irse.`; }
    if (act === 'refuse') { p.mor = clamp(p.mor - 10, 5, 99); m.done = true; return `${p.n} se queda, pero molesto.`; }
  }
  if (m.kind === 'offer') {
    if (act === 'reject') { m.done = true; return 'Rechazaste la oferta.'; }
    if (act === 'accept') {
      const { B, give, get } = m.data, r = evalTrade(G, G.user, B, give, get);
      if (!r.ok || give.some(a => G.P[a.id]?.tm !== G.user) || get.some(a => G.P[a.id]?.tm !== B)) { m.done = true; return 'La oferta ya no es válida.'; }
      m.done = true; return { trade: { B, give, get } };
    }
  }
  if (m.kind === 'agent' && act === 'view') return { open: 'player', pid: m.pid };
  m.done = true; return '';
}
/** Mensajes vencidos pasan a "hecho" para no juntar pendientes. */
export function expireMessages(G) { for (const m of G.inbox) if (!m.done && m.expire && m.expire < G.today && m.acts?.length) { m.done = true; m.result = 'Venció sin respuesta.'; if (m.kind === 'player' && G.P[m.pid]) G.P[m.pid].mor = clamp(G.P[m.pid].mor - 3, 5, 99); } }
