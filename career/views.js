import { esc, ovrChip, posTag, logo, clubDot, tname, bar, delta, mood, fm, pct, tbl, msgIcon, seasonTxt, ovrNow, baseOvr, money } from './h.js';
import { fmtDay, fmtShort, ymd, MESES, DIAS, day, sum, avg, dow, onOrAfter } from './util.js';
import { AGROUP, GROUPS, ATTR_LABEL, PROFILES, POS_NAME, CAP, TRAITS } from './gen.js';
import { LEAGUES, CLUBS, DIV_NAME, CONF_NAME, NAT_NAME, CITY } from './data.js';
import { ros, payroll, rosterCount, standingsOf, rankIn, unread, teamStrength, winPct } from './state.js';
import * as SE from './season.js';
import * as M from './market.js';
import * as P from './prog.js';
import * as E from './events.js';
import { keyEvents } from './cal.js';
import { avatarSVG, ARCH, PHIL, SUITS } from './coach.js';
import { DIFFS } from './world.js';
import { NBA_TEAMS } from './cal.js';

/* ============================================================================
   Pantallas del modo carrera (cada una devuelve HTML). Las acciones van en atributos data-a / data-id y las maneja ui.js.
   ========================================================================== */
const B = (a, label, o = {}) => `<button class="btn ${o.cls || ''}" data-a="${a}" ${o.id != null ? `data-id="${esc(o.id)}"` : ''} ${o.v != null ? `data-v="${esc(o.v)}"` : ''} ${o.dis ? 'disabled' : ''}>${label}</button>`;
const subtabs = (V, key, items) => `<div class="subtabs">${items.map(([id, l]) => `<button data-a="sub" data-id="${key}" data-v="${id}" class="${(V.sub[key] || items[0][0]) === id ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const sub = (V, key, def) => V.sub[key] || def;
const pRow = (G, p, cols) => `<tr class="cl ${p.tm === G.user ? 'me' : ''}" data-a="player" data-id="${p.id}">${cols}</tr>`;
const injTag = p => (p.inj ? `<span class="tag red" title="${esc(p.inj.t)}">🩹 ${p.inj.d}d</span>` : '');
const roleTag = p => (p.gl ? '<span class="tag">G League</span>' : p.con?.type === 'two' ? '<span class="tag">Two-way</span>' : '');
const awTag = p => (p.aw?.length ? `<span class="tag gld" title="${esc(p.aw.slice(-3).join(' · '))}">★${p.aw.length}</span>` : '');
const ovrChange = p => (p.dY ? delta(p.dY) : '');
const stline = (p, f) => (p.st && p.st.gp ? (p.st[f] / p.st.gp).toFixed(1) : '–');

/* ---------------------------------------------------------- INICIO */
export function home(G, V) {
  const t = G.teams[G.user], ng = SE.nextUserGame(G), lg = SE.lastUserGame(G), rk = rankIn(G, G.user);
  const opp = ng ? (ng.h === G.user ? ng.a : ng.h) : null, today = ng && ng.d === G.today;
  const tyName = { rs: 'Temporada regular', cup: 'NBA Cup · Fase de grupos', cupQ: 'NBA Cup · Cuartos', cupS: 'NBA Cup · Semifinal', cupF: 'NBA Cup · FINAL', pre: 'Pretemporada', po: 'Playoffs', pi: 'Play-in', sl: 'Summer League' };
  const nextHTML = ng ? `<div class="next"><div class="tm">${logo(G, ng.h, 86).replace(/width="26"/, '')}<b>${esc(G.teams[ng.h].name)}</b><small>${rankIn(G, ng.h)}º · ${G.teams[ng.h].w}-${G.teams[ng.h].l}</small></div><div class="vs">VS<small>${tyName[ng.ty] || ''}${ng.ser ? ` · Partido ${ng.gm}` : ''}<br>${fmtDay(ng.d, true)}<br>${ng.h === G.user ? 'Local' : 'Visitante'}</small></div><div class="tm">${logo(G, ng.a, 86)}<b>${esc(G.teams[ng.a].name)}</b><small>${rankIn(G, ng.a)}º · ${G.teams[ng.a].w}-${G.teams[ng.a].l}</small></div></div>
    <div class="row" style="margin:10px 0 18px">${today ? B('previa', '🏀 Ir al partido', { cls: 'gold' }) : B('cont', 'Continuar ▸', { cls: 'gold' })}<span class="mute">${today ? 'Hoy jugás: elegí si lo jugás en 3D o lo simulás.' : `Faltan ${ng.d - G.today} día${ng.d - G.today === 1 ? '' : 's'} para tu próximo partido.`}</span></div>` : `<div class="card" style="margin-bottom:16px"><h3>${phaseName(G)}</h3><p class="mute">No tenés partidos programados por ahora.</p>${B('cont', 'Continuar ▸', { cls: 'gold' })}</div>`;
  const inj = ros(G, G.user).filter(p => p.inj && p.lg === 'NBA').sort((a, b) => b.inj.d - a.inj.d);
  const un = G.inbox.filter(m => !m.read && !m.done).slice(0, 4);
  const goals = G.board.goals;
  const stand = standingsOf(G, t.conf).slice(0, 8);
  const ev = upcomingEvents(G).slice(0, 6);
  return `<h2>${esc(t.name)}</h2><p class="mute" style="margin:2px 0 14px">${phaseName(G)} · Récord ${t.w}-${t.l} · ${rk}º del ${CONF_NAME[t.conf]} · Racha ${t.streak > 0 ? 'G' + t.streak : t.streak < 0 ? 'P' + -t.streak : '–'}</p>${nextHTML}
  <div class="grid g2">
    <div class="card"><h3>Último partido</h3>${lg ? lastGameCard(G, lg) : '<p class="mute">Todavía no jugaste.</p>'}</div>
    <div class="card"><h3>Objetivos de la directiva <small>Confianza ${Math.round(G.board.conf)}%</small></h3>${bar(G.board.conf, G.board.conf < 30 ? '' : 'gl')}<div style="height:8px"></div>${goals.length ? goals.map(g => `<div class="row sp" style="padding:3px 0"><span>${g.done == null ? '◻' : g.done ? '✅' : '❌'} ${esc(g.t)}</span><small>+${g.w}%</small></div>`).join('') : '<p class="mute">Los objetivos se fijan al arrancar la temporada.</p>'}</div>
    <div class="card"><h3>Buzón <small>${unread(G)} sin leer</small></h3>${un.length ? un.map(m => `<div class="msg un" data-a="msg" data-id="${m.id}"><div class="ic">${msgIcon(m)}</div><div><b>${esc(m.subj)}</b><span>${esc(E.fromOf(m.from).name !== m.from ? E.fromOf(m.from).name : G.P[m.from]?.n || '')} · ${fmtShort(m.d)}</span></div></div>`).join('') : '<p class="mute">Sin mensajes nuevos.</p>'}</div>
    <div class="card"><h3>Próximos eventos</h3>${ev.map(e => `<div class="row sp" style="padding:3px 0"><span>${e[2]}</span><small>${fmtDay(e[1])}</small></div>`).join('')}</div>
    <div class="card"><h3>Tabla · ${CONF_NAME[t.conf]}</h3>${tbl(['#', 'Equipo', ['G', 'n'], ['P', 'n'], ['%', 'n']], stand.map((x, i) => `<tr class="${x.ab === G.user ? 'me' : ''}"><td>${i + 1}</td><td>${logo(G, x.ab, 20)} ${esc(x.name)}</td><td class="n">${x.w}</td><td class="n">${x.l}</td><td class="n">${pct(x.w, x.l)}</td></tr>`), 'free')}</div>
    <div class="card"><h3>Lesionados <small>${inj.length}</small></h3>${inj.length ? inj.map(p => `<div class="row sp" style="padding:3px 0;cursor:pointer" data-a="player" data-id="${p.id}"><span>${posTag(p.pos)} ${esc(p.n)}</span><small>${esc(p.inj.t)} · ${p.inj.d} d</small></div>`).join('') : '<p class="mute">Plantel sano. 💪</p>'}</div>
    <div class="card"><h3>Noticias de la liga</h3>${G.news.slice(0, 6).map(n => `<div style="padding:4px 0;border-bottom:1px solid #ffffff0d"><small>${fmtShort(n.d)}</small> ${esc(n.t)}</div>`).join('') || '<p class="mute">Nada por ahora.</p>'}</div>
  </div>`;
}
export const phaseName = G => ({ camp: 'Campus de entrenamiento', pre: 'Pretemporada', rs: `Temporada regular ${seasonTxt(G.Y)}`, pi: 'Play-in', po: 'Playoffs', post: 'Postemporada', draft: 'Draft', fa: 'Agencia libre', sl: 'Summer League', summer: 'Verano' }[G.phase] || '');
function lastGameCard(G, g) {
  const mine = g.h === G.user, us = mine ? g.hs : g.as, th = mine ? g.as : g.hs, opp = mine ? g.a : g.h, w = us > th;
  const box = (mine ? g.box?.h : g.box?.a) || [];
  const top = box.slice().sort((a, b) => b.pts - a.pts)[0], p = top && G.P[top.id];
  return `<div class="row sp"><span>${fmtShort(g.d)} · ${mine ? 'vs' : '@'} ${logo(G, opp, 22)} ${esc(G.teams[opp].name)}</span><b class="${w ? 'up' : 'dn'}" style="font:800 22px 'Barlow Condensed'">${w ? 'G' : 'P'} ${us}-${th}${g.ot ? ' (TE)' : ''}</b></div>${p ? `<p class="mute">Figura: ${esc(p.n)} · ${top.pts} pts, ${top.reb} reb, ${top.ast} ast</p>` : ''}${B('boxlast', 'Ver estadísticas', { cls: 'sm' })}`;
}
export function upcomingEvents(G) {
  const D = G.D, ev = keyEvents(D).filter(e => e[1] >= G.today);
  const next = keyEvents(require_next(G)).filter(e => e[1] >= G.today && e[1] > D.nextCamp - 2);
  return [...ev, ...next].sort((a, b) => a[1] - b[1]);
}
import { seasonDates } from './cal.js';
const require_next = G => seasonDates(G.Y + 1);

/* ---------------------------------------------------------- CALENDARIO */
export function calendar(G, V) {
  const base = ymd(G.today), mo = (base.m - 1) + (V.calM || 0), y = base.y + Math.floor(mo / 12), m = ((mo % 12) + 12) % 12;
  const first = day(y, m + 1, 1), start = first - dow(first), cells = [], evs = {};
  for (const e of [...keyEvents(G.D), ...keyEvents(seasonDates(G.Y + 1)), ...keyEvents(seasonDates(G.Y - 1))]) (evs[e[1]] ||= []).push(e[2]);
  for (let i = 0; i < 42; i++) {
    const d = start + i, t = ymd(d), g = SE.gamesOn(G, d).find(x => x.h === G.user || x.a === G.user);
    let gh = '';
    if (g) { const mine = g.h === G.user, opp = mine ? g.a : g.h, res = g.done ? ((mine ? g.hs > g.as : g.as > g.hs) ? 'w' : 'l') : ''; gh = `<div class="g ${res}" data-a="${g.done ? 'boxgame' : 'previa'}" data-id="${g.id}">${logo(G, opp, 18)} ${mine ? 'vs' : '@'} ${opp}${g.done ? ` ${mine ? g.hs : g.as}-${mine ? g.as : g.hs}` : ''}${g.ty !== 'rs' ? ` <small>${{ cup: 'Cup', cupQ: 'Cup', cupS: 'Cup', cupF: 'Cup', po: 'PO', pi: 'PI', pre: 'Pre', sl: 'SL' }[g.ty]}</small>` : ''}</div>`; }
    cells.push(`<div class="d ${t.m !== m + 1 ? 'out' : ''} ${d === G.today ? 'today' : ''}"><b>${t.d}</b>${gh}${(evs[d] || []).map(e => `<div class="ev">★ ${e}</div>`).join('')}</div>`);
  }
  const next = G.sched.filter(g => !g.done && g.d >= G.today && (g.h === G.user || g.a === G.user)).slice(0, 8);
  return `<div class="row sp wrap"><h2>${MESES[m]} ${y}</h2><div class="row">${B('calm', '◀', { v: -1, cls: 'sm' })}${B('calm', 'Hoy', { v: 0, cls: 'sm' })}${B('calm', '▶', { v: 1, cls: 'sm' })}</div></div><div class="cal" style="margin:10px 0 18px">${['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(d => `<div class="h">${d}</div>`).join('')}${cells.join('')}</div>
  <div class="card"><h3>Mis próximos partidos</h3>${tbl(['Fecha', 'Rival', 'Condición', 'Torneo'], next.map(g => { const mine = g.h === G.user, opp = mine ? g.a : g.h; return `<tr class="cl" data-a="previa" data-id="${g.id}"><td>${fmtDay(g.d)}</td><td>${logo(G, opp, 20)} ${esc(G.teams[opp].name)}</td><td>${mine ? 'Local' : 'Visitante'}</td><td>${{ rs: 'Temporada', cup: 'NBA Cup (grupo)', cupQ: 'NBA Cup (cuartos)', cupS: 'NBA Cup (semis)', cupF: 'NBA Cup (final)', po: 'Playoffs', pi: 'Play-in', pre: 'Amistoso', sl: 'Summer League' }[g.ty]}</td></tr>`; }), 'free')}</div>`;
}

/* ---------------------------------------------------------- PLANTEL */
export function squad(G, V) {
  const s = sub(V, 'squad', 'ros'), all = ros(G, G.user);
  const nba = all.filter(p => p.lg === 'NBA' && !p.gl).sort((a, b) => ovrNow(b) - ovrNow(a)), gl = all.filter(p => p.gl);
  const pay = payroll(G, G.user);
  const head = `<div class="row sp wrap"><h2>Plantel</h2><div class="row wrap"><span class="tag ${nba.length + gl.length > 15 ? 'red' : ''}">${all.length}/15 jugadores</span><span class="tag">Salarios ${money(pay)}</span><span class="tag ${pay > CAP.cap ? 'gld' : 'grn'}">${pay > CAP.cap ? 'Sobre el tope' : 'Espacio ' + money(CAP.cap - pay)}</span></div></div>`;
  const tabs = subtabs(V, 'squad', [['ros', 'Plantel'], ['gl', `G League (${gl.length})`], ['con', 'Contratos']]);
  if (s === 'con') {
    const rows = all.slice().sort((a, b) => (b.con?.sal || 0) - (a.con?.sal || 0)).map(p => pRow(G, p, `<td>${posTag(p.pos)} ${esc(p.n)}</td><td class="n">${p.age}</td><td class="c">${ovrChip(ovrNow(p))}</td><td class="n">${money(p.con?.sal || 0)}</td><td class="n">${G.Y + (p.con?.yrs || 1)}</td><td>${p.con?.type === 'rookie' ? 'Rookie' : p.con?.type === 'two' ? 'Two-way' : 'Estándar'}</td><td class="n">${money(M.askFor(p))}</td><td>${p.con?.yrs <= 1 ? '<span class="tag red">Vence</span>' : ''}</td>`));
    return head + tabs + `<div class="grid g2"><div class="card"><h3>Tope salarial</h3><div class="row sp"><span>Salarios</span><b>${money(pay)}</b></div><div class="row sp"><span>Tope (cap)</span><b>${money(CAP.cap)}</b></div><div class="row sp"><span>Impuesto de lujo</span><b>${money(CAP.tax)}</b></div><div class="row sp"><span>Dinero muerto (cortes)</span><b>${money(G.dead?.[G.user] || 0)}</b></div>${bar(pay / CAP.tax * 100, pay > CAP.tax ? '' : 'gl')}<p class="mute" style="margin-top:8px">Si pasás el impuesto, pagás $1,5 por cada $1 de exceso y la directiva se enoja.</p></div><div class="card"><h3>Reglas</h3><p class="mute" style="line-height:1.5">• Máximo 15 jugadores (18 en el verano) + two-way (hasta 3).<br>• Con el plantel sobre el tope solo se firma con contrato mínimo.<br>• Cambios: salarios entrantes ≤ 125% de los salientes + $0,1M.<br>• Los cambios cierran después del límite (11 de febrero) hasta que terminan las Finales.</p></div></div><div style="height:14px"></div>` + tbl(['Jugador', ['Edad', 'n'], ['OVR', 'c'], ['Salario', 'n'], ['Hasta', 'n'], 'Tipo', ['Pide', 'n'], ''], rows);
  }
  const list = s === 'gl' ? gl : nba;
  const rows = list.map(p => pRow(G, p, `<td>${posTag(p.pos)} ${esc(p.n)} ${injTag(p)}${roleTag(p)}${awTag(p)}</td><td class="n">${p.age}</td><td class="c">${ovrChip(ovrNow(p))} ${ovrChange(p)}</td><td class="c" title="Potencial">${p.pot}</td><td class="c" title="${P.moodLabel(p.mor)}">${mood(p.mor)}</td><td class="n ${p.frm > 0.4 ? 'up' : p.frm < -0.4 ? 'dn' : ''}">${p.frm > 0 ? '+' : ''}${fm(p.frm)}</td><td class="n">${stline(p, 'min')}</td><td class="n">${stline(p, 'pts')}</td><td class="n">${stline(p, 'reb')}</td><td class="n">${stline(p, 'ast')}</td><td>${p.role}</td><td class="n">${money(p.con?.sal || 0)} <small>${G.Y + (p.con?.yrs || 1)}</small></td>`));
  return head + tabs + tbl(['Jugador', ['Edad', 'n'], ['OVR', 'c'], ['POT', 'c'], ['Moral', 'c'], ['Forma', 'n'], ['MIN', 'n'], ['PTS', 'n'], ['REB', 'n'], ['AST', 'n'], 'Rol', ['Contrato', 'n']], rows) + `<p class="mute" style="margin-top:8px">OVR = overall actual (incluye la forma). ▲▼ = cambio en la temporada. Tocá un jugador para ver sus atributos, contrato y acciones.</p>`;
}

/* ---------------------------------------------------------- ALINEACIÓN */
export function lineup(G, V) {
  const h = SE.healthy(G, G.user), order = SE.lineupFor(G, G.user, h), all = ros(G, G.user).filter(p => p.lg === 'NBA');
  const outs = all.filter(p => SIM_isOut(p));
  const TAC = [['pace', 'Ritmo', [['slow', 'Lento'], ['normal', 'Normal'], ['fast', 'Rápido']]], ['shot', 'Tiro', [['balanced', 'Equilibrado'], ['threes', 'Triples'], ['inside', 'Cerca del aro']]], ['pass', 'Juego', [['solo', 'Individual'], ['balanced', 'Equilibrado'], ['team', 'Colectivo']]], ['def', 'Defensa', [['loose', 'Suelta'], ['normal', 'Normal'], ['pressure', 'Presión']]]];
  const rows = order.map((p, i) => `<tr class="${i < 5 ? 'me' : ''}"><td class="c"><b>${i < 5 ? '★' : i + 1}</b></td><td class="cl" data-a="player" data-id="${p.id}">${posTag(p.pos)} ${esc(p.n)} ${injTag(p)}</td><td class="c">${ovrChip(ovrNow(p))}</td><td class="n">${stline(p, 'min')}</td><td class="n">${P.roleMin(p.role)} esp.</td><td class="c">${B('lmove', '▲', { id: p.id, v: -1, cls: 'sm', dis: i === 0 })}${B('lmove', '▼', { id: p.id, v: 1, cls: 'sm', dis: i === order.length - 1 })}</td></tr>`).join('');
  return `<div class="row sp wrap"><h2>Alineación y táctica</h2><div class="row">${B('lauto', 'Automática (mejor quinteto)', { cls: 'sm' })}</div></div><div class="grid g2" style="margin-top:12px"><div><p class="mute">Los primeros 5 son titulares; el resto es la rotación en orden. Los lesionados no entran. Se usa en los partidos que jugás y en los que simulás.</p>${tbl([['', 'c'], 'Jugador', ['OVR', 'c'], ['MIN', 'n'], ['Rol', 'n'], ['Orden', 'c']], [rows], 'free')}${outs.length ? `<p class="mute">Fuera: ${outs.map(p => `${esc(p.n)} (${p.inj.d} d)`).join(', ')}</p>` : ''}</div>
  <div><div class="card"><h3>Táctica de equipo</h3>${TAC.map(([k, l, opts]) => `<div class="field"><span>${l}</span><div class="chips">${opts.map(([v, n]) => `<button class="chip ${G.tac[k] === v ? 'on' : ''}" data-a="tac" data-id="${k}" data-v="${v}">${n}</button>`).join('')}</div></div>`).join('')}<p class="mute">En el partido 3D estas opciones cambian cómo juegan tus compañeros bots. En la simulación pesan un poco en el nivel del equipo.</p></div>
  <div class="card" style="margin-top:14px"><h3>Quinteto: ${order.slice(0, 5).every((p, i) => true) ? '' : ''}análisis</h3>${lineupNotes(G, order.slice(0, 5))}</div></div></div>`;
}
const SIM_isOut = p => !!p.inj && p.inj.d > 0;
function lineupNotes(G, five) {
  const pos = five.map(p => p.pos), n = a => pos.filter(x => a.includes(x)).length, notes = [];
  if (n(['PG', 'SG']) < 2) notes.push('⚠️ Pocos jugadores de perímetro: te va a faltar manejo y triples.'); if (n(['PF', 'C']) < 1) notes.push('⚠️ No tenés pívot ni ala-pívot: vas a sufrir en el rebote y el juego interior.');
  const three = avg(five, p => p.at.three), def = avg(five, p => (p.at.perD + p.at.intD) / 2), reb = avg(five, p => (p.at.oreb + p.at.dreb) / 2);
  return `<div class="attr"><span>Triple</span><b>${Math.round(three)}</b>${bar(three)}<span>Defensa</span><b>${Math.round(def)}</b>${bar(def)}<span>Rebote</span><b>${Math.round(reb)}</b>${bar(reb)}</div>${notes.map(n => `<p>${n}</p>`).join('') || '<p class="up">✔ Quinteto equilibrado.</p>'}`;
}

/* ---------------------------------------------------------- ENTRENAMIENTO */
export function training(G, V) {
  const all = ros(G, G.user).filter(p => p.lg === 'NBA').sort((a, b) => ovrNow(b) - ovrNow(a)), I = P.INTENSITY;
  const rows = all.map(p => { const f = G.plan[p.id] || 'auto'; return `<tr><td class="cl" data-a="player" data-id="${p.id}">${posTag(p.pos)} ${esc(p.n)}</td><td class="c">${ovrChip(ovrNow(p))}</td><td class="c">${p.pot}</td><td class="n">${p.age}</td><td><select data-i="focus" data-id="${p.id}"><option value="auto" ${f === 'auto' ? 'selected' : ''}>Automático (${P.autoFocus(p)})</option>${GROUPS.map(g => `<option ${f === g ? 'selected' : ''}>${g}</option>`).join('')}</select></td><td style="width:140px">${bar(p.tr?.xp || 0, 'bl')}</td><td class="n">${p.upd || 0}/15</td></tr>`; }).join('');
  return `<h2>Entrenamiento</h2><div class="grid g2" style="margin:12px 0"><div class="card"><h3>Plan del equipo</h3><div class="field"><span>Entrenamiento automático (saltear)</span><div class="chips"><button class="chip ${G.settings.autoTrain ? 'on' : ''}" data-a="autotrain" data-v="1">Sí: lo hace el cuerpo técnico</button><button class="chip ${!G.settings.autoTrain ? 'on' : ''}" data-a="autotrain" data-v="0">No: lo elijo yo</button></div></div><div class="field"><span>Intensidad</span><div class="chips">${Object.entries(I).map(([k, v]) => `<button class="chip ${G.settings.intensity === k ? 'on' : ''}" data-a="intensity" data-v="${k}">${v.name}</button>`).join('')}</div></div><p class="mute">Cada semana (los lunes) tus jugadores suman XP en su foco; con 100 XP sube un atributo de ese grupo. Jóvenes con margen aprenden más rápido. Intensa = más XP pero más riesgo de lesión y menos moral. Si el entrenamiento automático está activo, nada te interrumpe y podés saltear fechas tranquilo.</p></div>
  <div class="card"><h3>Cuerpo técnico</h3><div class="row sp"><span>Entrenadores</span><b>Nivel ${G.staff.coach}/5</b></div><p class="mute">Más nivel = más XP y mejor evolución en verano. Se mejora en Club → Staff.</p>${G.coach.arch === 'formador' ? '<p class="gold">Tu arquetipo «Formador» suma +20% de XP a los jóvenes.</p>' : ''}</div></div>` + tbl(['Jugador', ['OVR', 'c'], ['POT', 'c'], ['Edad', 'n'], 'Foco', 'XP semanal', ['Act.', 'n']], [rows]) + `<p class="mute" style="margin-top:8px">«Act.» cuenta partidos hacia la próxima actualización de valoración (cada ~15 partidos con minutos, según el rendimiento).</p>`;
}

/* ---------------------------------------------------------- MERCADO */
export function market(G, V) {
  const s = sub(V, 'market', 'fa'), f = V.f;
  const tabs = subtabs(V, 'market', [['fa', 'Agencia libre'], ['intl', 'Otras ligas'], ['gl', 'G League'], ['trade', 'Cambios'], ['picks', 'Picks']]);
  const open = M.dealIsOpen(G);
  const head = `<div class="row sp wrap"><h2>Mercado</h2><div class="row wrap"><span class="tag">Caja ${money(G.fin.cash)}</span><span class="tag">${rosterCount(G, G.user)}/${M.rosterLimit(G)} jugadores</span><span class="tag ${payroll(G, G.user) > CAP.cap ? 'gld' : 'grn'}">${payroll(G, G.user) > CAP.cap ? 'Sobre el tope' : 'Espacio ' + money(CAP.cap - payroll(G, G.user))}</span><span class="tag ${open ? 'grn' : 'red'}">Cambios ${open ? 'abiertos' : 'cerrados'}</span></div></div>`;
  const filt = (key) => `<div class="row wrap" style="margin:8px 0"><select data-i="fpos" data-id="${key}" style="width:130px"><option value="">Todas las pos.</option>${['PG', 'SG', 'SF', 'PF', 'C'].map(x => `<option ${f[key].pos === x ? 'selected' : ''}>${x}</option>`).join('')}</select><select data-i="fmin" data-id="${key}" style="width:150px">${[0, 55, 60, 65, 70, 75].map(x => `<option value="${x}" ${+f[key].min === x ? 'selected' : ''}>OVR mín. ${x || '—'}</option>`).join('')}</select><input type="text" data-i="fq" data-id="${key}" value="${esc(f[key].q)}" placeholder="Buscar nombre…" style="width:200px"></div>`;
  const ok = (p, k) => (!f[k].pos || p.pos === f[k].pos) && ovrNow(p) >= +f[k].min && (!f[k].q || p.n.toLowerCase().includes(f[k].q.toLowerCase()));
  if (s === 'fa') {
    const list = ros(G, 'FA').filter(p => ok(p, 'fa')).sort((a, b) => ovrNow(b) - ovrNow(a)).slice(0, 60);
    return head + tabs + filt('fa') + `<p class="mute">Jugadores libres de la NBA. Con el plantel sobre el tope solo podés ofrecer el mínimo (${money(CAP.min)}).</p>` + tbl(['Jugador', ['Edad', 'n'], ['OVR', 'c'], ['POT', 'c'], ['Pide', 'n'], ''], list.map(p => pRow(G, p, `<td>${posTag(p.pos)} ${esc(p.n)}${p.fa?.ex === G.user ? '<span class="tag gld">Tuyo</span>' : ''}</td><td class="n">${p.age}</td><td class="c">${ovrChip(ovrNow(p))}</td><td class="c">${p.pot}</td><td class="n">${money(M.askFor(p))}</td><td class="c">${B('sign', 'Negociar', { id: p.id, cls: 'sm', v: 'fa' })}</td>`)));
  }
  if (s === 'gl') {
    const list = ros(G, 'GLFA').filter(p => ok(p, 'gl')).sort((a, b) => (b.pot + ovrNow(b)) - (a.pot + ovrNow(a))).slice(0, 60);
    return head + tabs + filt('gl') + `<p class="mute">Jugadores libres de la G League. Se pueden firmar con contrato <b>two-way</b> (${M.twoWayCount(G, G.user)}/${M.TWO_WAY_MAX}) o estándar. Los que juegan allá ganan ritmo y desarrollo.</p>` + tbl(['Jugador', ['Edad', 'n'], ['OVR', 'c'], ['POT', 'c'], ''], list.map(p => pRow(G, p, `<td>${posTag(p.pos)} ${esc(p.n)}</td><td class="n">${p.age}</td><td class="c">${ovrChip(ovrNow(p))}</td><td class="c">${p.pot}</td><td class="c">${B('sign', 'Firmar two-way', { id: p.id, v: 'two', cls: 'sm', dis: M.twoWayCount(G, G.user) >= M.TWO_WAY_MAX })} ${B('sign', 'Estándar', { id: p.id, v: 'gl', cls: 'sm' })}</td>`)));
  }
  if (s === 'intl') {
    const lgSel = V.f.intl.lg, list = Object.values(G.P).filter(p => p.lg === lgSel && p.tm && G.clubs[p.tm] && ok(p, 'intl')).sort((a, b) => ovrNow(b) - ovrNow(a)).slice(0, 80);
    const chips = ['EUR', 'ARG', 'AUS', 'CHN', 'BRA'].map(l => `<button class="chip ${lgSel === l ? 'on' : ''}" data-a="intl" data-v="${l}">${LEAGUES[l].name}</button>`).join('');
    return head + tabs + `<div class="chips" style="margin:8px 0">${chips}</div>` + filt('intl') + `<p class="mute">Para traer a un jugador de otra liga pagás una <b>cláusula de salida</b> al club (sale de tu Caja) y le ofrecés contrato. Los más jóvenes y los de clubes grandes cuestan más.</p>` + tbl(['Jugador', 'Club', ['Edad', 'n'], ['OVR', 'c'], ['POT', 'c'], ['Cláusula', 'n'], ''], list.map(p => pRow(G, p, `<td>${posTag(p.pos)} ${esc(p.n)} <small>${NAT_NAME[p.nat] || ''}</small></td><td>${clubDot(G, p.tm, 16)} ${esc(G.clubs[p.tm].name)}</td><td class="n">${p.age}</td><td class="c">${ovrChip(ovrNow(p))}</td><td class="c">${p.pot}</td><td class="n">${money(M.buyoutFee(G, p))}</td><td class="c">${B('sign', 'Fichar', { id: p.id, v: 'intl', cls: 'sm' })}</td>`)));
  }
  if (s === 'picks') {
    const mine = G.picks.filter(k => k.own === G.user).sort((a, b) => a.y - b.y || a.rd - b.rd);
    return head + tabs + `<div class="card"><h3>Tus picks <small>${mine.length}</small></h3>${tbl(['Draft', 'Ronda', 'Original', ['Valor', 'n']], mine.map(k => `<tr><td>${k.y}</td><td>${k.rd}ª</td><td>${logo(G, k.orig, 18)} ${k.orig}${k.orig === G.user ? '' : ' (adquirido)'}</td><td class="n">${Math.round(M.pickValue(G, k))}</td></tr>`), 'free')}</div><p class="mute" style="margin-top:8px">Los picks se usan en el menú de Cambios.</p>`;
  }
  /* trade */
  const T = V.trade, other = T.team, mineList = ros(G, G.user).filter(p => p.lg === 'NBA').sort((a, b) => ovrNow(b) - ovrNow(a)), theirs = ros(G, other).filter(p => p.lg === 'NBA').sort((a, b) => ovrNow(b) - ovrNow(a));
  const give = T.give, get = T.get, ev = M.evalTrade(G, G.user, other, give, get);
  const picksM = G.picks.filter(k => k.own === G.user).sort((a, b) => a.y - b.y || a.rd - b.rd), picksT = G.picks.filter(k => k.own === other).sort((a, b) => a.y - b.y || a.rd - b.rd);
  const has = (list, k, id) => list.some(a => a.k === k && (k === 'p' ? a.id === id : a.pk === id));
  const pl = (p, list, side) => `<tr class="cl ${has(list, 'p', p.id) ? 'me' : ''}" data-a="tsel" data-id="${p.id}" data-v="${side}"><td class="c">${has(list, 'p', p.id) ? '☑' : '☐'}</td><td>${posTag(p.pos)} ${esc(p.n)} ${injTag(p)}</td><td class="n">${p.age}</td><td class="c">${ovrChip(ovrNow(p))}</td><td class="n">${money(p.con?.sal || 0)} <small>${G.Y + (p.con?.yrs || 1)}</small></td></tr>`;
  const pk = (k, list, side, idx) => `<tr class="cl ${has(list, 'k', k) ? 'me' : ''}" data-a="tsel" data-id="k${idx}" data-v="${side}"><td class="c">${has(list, 'k', k) ? '☑' : '☐'}</td><td colspan="4">🎟️ ${M.pickName(G, k)}</td></tr>`;
  return head + tabs + `<div class="row wrap" style="margin:8px 0"><span>Cambio con</span><select data-i="tteam" style="width:260px">${NBA_TEAMS.filter(t => t !== G.user).map(t => `<option value="${t}" ${t === other ? 'selected' : ''}>${esc(G.teams[t].name)}</option>`).join('')}</select><span class="mute">${G.teams[other].strat === 'rebuild' ? 'En reconstrucción: valora jóvenes y picks.' : G.teams[other].strat === 'contender' ? 'Candidato: valora jugadores listos.' : 'Equipo medio.'}</span></div>
  <div class="grid g2"><div><h3>Das (${esc(G.teams[G.user].name)})</h3>${tbl(['', 'Jugador', ['Ed.', 'n'], ['OVR', 'c'], ['Contrato', 'n']], [mineList.map(p => pl(p, give, 'give')).join('') + picksM.map((k, i) => pk(k, give, 'give', G.picks.indexOf(k))).join('')])}</div>
  <div><h3>Recibís (${esc(G.teams[other].name)})</h3>${tbl(['', 'Jugador', ['Ed.', 'n'], ['OVR', 'c'], ['Contrato', 'n']], [theirs.map(p => pl(p, get, 'get')).join('') + picksT.map(k => pk(k, get, 'get', G.picks.indexOf(k))).join('')])}</div></div>
  <div class="card" style="margin-top:12px"><div class="row sp wrap"><div><b style="font:800 22px 'Barlow Condensed'" class="${ev.accept ? 'up' : ev.ok ? 'gold' : 'dn'}">${ev.verdict}</b><div class="mute">Sale ${money(ev.salGive)} · Entra ${money(ev.salGet)}</div>${ev.why.map(w => `<div class="dn">• ${esc(w)}</div>`).join('')}</div><div class="row wrap">${B('tctr', '¿Qué piden por lo que quiero?', { cls: 'sm', dis: !get.length })}${B('tgo', 'Proponer cambio', { cls: 'gold', dis: !ev.accept })}</div></div></div>`;
}

/* ---------------------------------------------------------- DRAFT */
export function draft(G, V) {
  const s = sub(V, 'draft', G.dr && !G.dr.done && G.today >= G.D.draft ? 'room' : 'board');
  const tabs = subtabs(V, 'draft', [['board', 'Prospectos'], ['order', 'Orden y lotería'], ['room', 'Sala del Draft'], ['sc', 'Ojeadores']]);
  const cls = V.draftCls || G.Y + 1;
  const nextDraftY = G.phase === 'draft' || (G.dr && !G.dr.done) ? G.dr.y : G.Y + 1;
  const head = `<div class="row sp wrap"><h2>Draft y scouting</h2><div class="row wrap"><span class="tag">Draft ${nextDraftY}: ${fmtDay(G.D.draft)}</span><span class="tag">Ojeadores nivel ${G.staff.scout}/5</span><span class="tag">${G.sc.watch.length} en seguimiento</span></div></div>`;
  if (s === 'board') {
    const classes = [G.Y + 1, G.Y + 2, G.Y + 3].filter(y => G.prospects.some(id => G.P[id]?.prospect?.cls === y));
    const list = M.bigBoard(G, cls).slice(0, V.draftAll ? 150 : 60), cs = `<div class="chips" style="margin:8px 0">${classes.map(y => `<button class="chip ${cls === y ? 'on' : ''}" data-a="dcls" data-v="${y}">Clase ${y}</button>`).join('')}</div>`;
    return head + tabs + cs + `<p class="mute">Prospectos de secundarias (HS), universidades y canteras del exterior. El potencial se ve como un rango: se achica a medida que tus ojeadores los conocen (marcalos con ⭐ para seguirlos de cerca).</p>` + tbl([['#', 'c'], '', 'Jugador', 'Origen', ['Edad', 'n'], ['Alt.', 'n'], ['OVR', 'c'], 'Potencial', ['Conoc.', 'n']], list.map((p, i) => { const [lo, hi] = M.prospectRange(G, p), kn = Math.round(M.scoutKnow(G, p.id)); return `<tr class="cl" data-a="player" data-id="${p.id}"><td class="c">${i + 1}</td><td class="c"><span data-a="watch" data-id="${p.id}" style="cursor:pointer;font-size:16px">${G.sc.watch.includes(p.id) ? '⭐' : '☆'}</span></td><td>${posTag(p.pos)} ${esc(p.n)}</td><td>${p.prospect.src === 'HS' ? '🏫 ' + p.prospect.school : p.prospect.src === 'COL' ? '🎓 ' + p.prospect.school : '🌍 ' + (NAT_NAME[p.nat] || 'Int.')}</td><td class="n">${p.age}</td><td class="n">${p.ht}</td><td class="c">${ovrChip(baseOvr(p))}</td><td>${lo}–${hi}</td><td class="n">${kn}%</td></tr>`; }));
  }
  if (s === 'order') {
    if (!G.dr) return head + tabs + `<div class="card"><h3>Todavía no hay orden</h3><p class="mute">La lotería se hace el ${fmtDay(G.D.lottery, true)}, después de que terminan el play-in y la temporada regular. Mientras tanto mirá tus picks:</p>${tbl(['Pick', 'Original'], G.picks.filter(k => k.own === G.user && k.y === G.Y + 1).map(k => `<tr><td>${k.rd}ª ronda</td><td>${logo(G, k.orig, 18)} ${k.orig}</td></tr>`), 'free')}</div>`;
    return head + tabs + `<div class="grid g2"><div class="card"><h3>Lotería ${G.dr.y}</h3>${G.lott ? `<p>Ganadores de los 4 primeros puestos: ${G.lott.top.map((a, i) => `<b>${i + 1}. ${logo(G, a, 18)} ${a}</b>`).join(' · ')}</p>` : ''}</div></div><div style="height:12px"></div>` + tbl([['#', 'c'], 'Equipo', 'Original', 'Elegido'], G.dr.order.map((o, i) => { const sel = G.dr.sel.find(x => x.n === o.n), p = sel && G.P[sel.id]; return `<tr class="${o.own === G.user ? 'me' : ''}"><td class="c">${o.n}</td><td>${logo(G, o.own, 18)} ${esc(G.teams[o.own].name)}</td><td>${o.orig === o.own ? '' : o.orig}</td><td>${p ? `<span data-a="player" data-id="${p.id}" style="cursor:pointer">${posTag(p.pos)} ${esc(p.n)} ${ovrChip(baseOvr(p))} <small>pot ${p.pot}</small></span>` : i === G.dr.i && !G.dr.done ? '<b class="gold">En el reloj…</b>' : ''}</td></tr>`; }));
  }
  if (s === 'room') {
    if (!G.dr || G.dr.done) return head + tabs + `<div class="card"><h3>${G.dr?.done ? 'El Draft terminó' : 'El Draft todavía no empezó'}</h3><p class="mute">${G.dr?.done ? 'Tus elegidos ya están en el plantel (podés mandarlos a la G League desde Plantel).' : `Es el ${fmtDay(G.D.draft, true)}. Si te toca elegir, el juego se frena para que lo hagas.`}</p></div>`;
    const clock = M.onClock(G), mine = clock && clock.own === G.user;
    const pool = M.bigBoard(G, G.dr.y).slice(0, 40);
    return head + tabs + `<div class="card" style="margin-bottom:12px"><div class="row sp wrap"><div><h3 style="margin:0">${clock ? `Pick #${clock.n} · ${esc(G.teams[clock.own].name)}${mine ? ' — ¡ES TU TURNO!' : ''}` : 'Draft completo'}</h3><span class="mute">Ronda ${clock?.rd || 2}</span></div><div class="row wrap">${B('dsim', mine ? 'Simular hasta mi siguiente pick' : 'Simular hasta mi pick', { cls: 'sm' })}${B('dauto', 'Elegir automático por mí', { cls: 'sm' })}</div></div></div>` + tbl(['', 'Jugador', 'Origen', ['Edad', 'n'], ['OVR', 'c'], 'Potencial', ''], pool.map((p, i) => { const [lo, hi] = M.prospectRange(G, p); return `<tr class="cl" data-a="player" data-id="${p.id}"><td class="c">${i + 1}</td><td>${posTag(p.pos)} ${esc(p.n)}</td><td>${p.prospect.school || 'Int.'}</td><td class="n">${p.age}</td><td class="c">${ovrChip(baseOvr(p))}</td><td>${lo}–${hi}</td><td class="c">${B('dpick', 'Elegir', { id: p.id, cls: 'sm gold', dis: !mine })}</td></tr>`; }));
  }
  const watch = G.sc.watch.map(id => G.P[id]).filter(Boolean);
  return head + tabs + `<div class="grid g2"><div class="card"><h3>Ojeadores</h3><p class="mute">Nivel ${G.staff.scout}/5: cada semana suman conocimiento de los prospectos. Los de tu lista de seguimiento reciben mucho más.</p><p class="mute">Mejorar el nivel: Club → Staff.</p></div><div class="card"><h3>En seguimiento (${watch.length})</h3>${tbl(['Jugador', ['Conoc.', 'n'], 'Potencial'], watch.map(p => { const [lo, hi] = M.prospectRange(G, p); return `<tr class="cl" data-a="player" data-id="${p.id}"><td>${posTag(p.pos)} ${esc(p.n)} <small>(${p.prospect?.cls})</small></td><td class="n">${Math.round(M.scoutKnow(G, p.id))}%</td><td>${lo}–${hi}</td></tr>`; }), 'free')}</div></div>`;
}

/* ---------------------------------------------------------- LIGA */
export function league(G, V) {
  const s = sub(V, 'league', 'stand'), tabs = subtabs(V, 'league', [['stand', 'Posiciones'], ['cup', 'NBA Cup'], ['po', 'Playoffs'], ['lead', 'Líderes'], ['awards', 'Premios'], ['world', 'Otras ligas'], ['news', 'Noticias']]);
  const head = `<h2>Liga</h2>`;
  if (s === 'stand') {
    const mk = conf => tbl([['#', 'c'], 'Equipo', ['G', 'n'], ['P', 'n'], ['%', 'n'], ['Dif.', 'n'], ['Racha', 'c'], ['Últ.10', 'c']], standingsOf(G, conf).map((t, i) => `<tr class="${t.ab === G.user ? 'me' : ''}"><td class="c">${i + 1}${i === 5 ? '' : ''}</td><td>${logo(G, t.ab, 20)} ${esc(t.name)}</td><td class="n">${t.w}</td><td class="n">${t.l}</td><td class="n">${pct(t.w, t.l)}</td><td class="n ${t.pf - t.pa > 0 ? 'up' : 'dn'}">${t.w + t.l ? ((t.pf - t.pa) / (t.w + t.l)).toFixed(1) : '0.0'}</td><td class="c">${t.streak > 0 ? 'G' + t.streak : t.streak < 0 ? 'P' + -t.streak : '–'}</td><td class="c">${t.l10.filter(x => x).length}-${t.l10.filter(x => !x).length}</td></tr>`), '');
    return head + tabs + `<div class="grid g2"><div><h3>Este</h3>${mk('E')}</div><div><h3>Oeste</h3>${mk('W')}</div></div><p class="mute" style="margin-top:8px">Top 6 = playoffs directo · 7-10 = Play-in.</p>`;
  }
  if (s === 'cup') {
    const gs = Object.entries(G.cup.groups);
    const grp = ([k, ts]) => `<div class="card"><h3>Grupo ${k[0] === 'E' ? 'Este' : 'Oeste'} ${k[1]}</h3>${tbl(['Equipo', ['G', 'n'], ['P', 'n'], ['Dif.', 'n']], ts.slice().sort((a, b) => G.teams[b].cw - G.teams[a].cw || G.teams[b].cpd - G.teams[a].cpd).map(a => `<tr class="${a === G.user ? 'me' : ''}"><td>${logo(G, a, 18)} ${esc(G.teams[a].name)}</td><td class="n">${G.teams[a].cw}</td><td class="n">${G.teams[a].cl}</td><td class="n">${G.teams[a].cpd > 0 ? '+' : ''}${G.teams[a].cpd}</td></tr>`), 'free')}</div>`;
    const ko = G.sched.filter(g => ['cupQ', 'cupS', 'cupF'].includes(g.ty));
    const kt = ko.length ? `<div class="card" style="margin-bottom:14px"><h3>Fase final${G.cup.champ ? ` · Campeón: ${esc(G.teams[G.cup.champ].name)}` : ''}</h3>${tbl(['Fecha', 'Ronda', 'Local', 'Resultado', 'Visitante'], ko.map(g => `<tr><td>${fmtDay(g.d)}</td><td>${{ cupQ: 'Cuartos', cupS: 'Semis', cupF: 'Final' }[g.ty]}</td><td>${logo(G, g.h, 18)} ${g.h}</td><td class="c">${g.done ? `${g.hs}-${g.as}` : 'vs'}</td><td>${logo(G, g.a, 18)} ${g.a}</td></tr>`), 'free')}</div>` : `<p class="mute">Fase de grupos: del ${fmtDay(G.D.cupStart)} al ${fmtDay(G.D.cupNights[4])}. Los 6 ganadores de grupo + 2 comodines (el mejor segundo de cada conferencia) juegan los cuartos desde el ${fmtDay(G.D.cupQ[0])}. Final: ${fmtDay(G.D.cupF)}.</p>`;
    return head + tabs + kt + `<div class="grid g3">${gs.map(grp).join('')}</div>`;
  }
  if (s === 'po') {
    if (!G.po) return head + tabs + `<div class="card"><h3>Los playoffs todavía no empezaron</h3><p class="mute">Arrancan el ${fmtDay(G.D.poStart, true)}. Antes se juega el Play-in (${fmtDay(G.D.piStart)}).</p></div>`;
    const col = rd => G.po.all.filter(x => x.rd === rd).map(x => `<div class="ser">${[[x.hi, x.wh, x.sh], [x.lo, x.wl, x.sl]].map(([a, w, sd]) => `<div class="${x.win === a ? 'w' : ''}"><span>${a ? `${logo(G, a, 16)} ${sd ? `(${sd}) ` : ''}${a}` : '—'}</span><b>${a ? w : ''}</b></div>`).join('')}</div>`).join('');
    return head + tabs + (G.po.champ ? `<h3>Campeón: ${logo(G, G.po.champ, 24)} ${esc(G.teams[G.po.champ].name)}</h3>` : '') + `<div class="bracket"><div><h3>Primera ronda</h3>${col(1)}</div><div><h3>Semifinales de conf.</h3>${col(2)}</div><div><h3>Finales de conf.</h3>${col(3)}</div><div><h3>Finales NBA</h3>${col(4)}</div></div>`;
  }
  if (s === 'lead') {
    const all = Object.values(G.P).filter(p => p.lg === 'NBA' && p.st && p.st.gp >= 5), top = (f, n = 10) => all.filter(p => p.st.gp >= Math.max(5, (G.teams[p.tm]?.w + G.teams[p.tm]?.l) * 0.3 || 5)).sort((a, b) => b.st[f] / b.st.gp - a.st[f] / a.st.gp).slice(0, n);
    const box = (t, f) => `<div class="card"><h3>${t}</h3>${tbl(['Jugador', ['Prom.', 'n']], top(f).map(p => `<tr class="cl" data-a="player" data-id="${p.id}"><td>${logo(G, p.tm, 16)} ${esc(p.n)}</td><td class="n"><b>${(p.st[f] / p.st.gp).toFixed(1)}</b></td></tr>`), 'free')}</div>`;
    return head + tabs + `<div class="grid g3">${box('Puntos', 'pts')}${box('Rebotes', 'reb')}${box('Asistencias', 'ast')}${box('Robos', 'stl')}${box('Tapones', 'blk')}</div>`;
  }
  if (s === 'awards') {
    return head + tabs + `<div class="grid g2"><div class="card"><h3>Campeones</h3>${tbl(['Temp.', 'Campeón', 'Serie'], G.hist.champs.slice().reverse().map(c => `<tr><td>${seasonTxt(c.y)}</td><td>${logo(G, c.ab, 18)} ${esc(G.teams[c.ab].name)}</td><td>${c.sc.join('-')} vs ${c.fin.find(x => x !== c.ab)}</td></tr>`), 'free') || '<p class="mute">Todavía no hay campeones.</p>'}</div><div class="card"><h3>Premios</h3>${tbl(['Temp.', 'Premio', 'Jugador'], (G.hist.awards || []).slice().reverse().slice(0, 40).map(a => `<tr><td>${seasonTxt(a.y)}</td><td>${a.a}</td><td>${esc(a.n)} <small>${a.tm || ''}</small></td></tr>`), 'free')}</div></div>`;
  }
  if (s === 'world') {
    const lgs = ['EUR', 'ARG', 'AUS', 'CHN', 'BRA'];
    return head + tabs + `<div class="grid g2">${lgs.map(l => { const top = Object.values(G.P).filter(p => p.lg === l && p.tm).sort((a, b) => ovrNow(b) - ovrNow(a)).slice(0, 6); const fo = G.foreign?.[l]; return `<div class="card"><h3>${LEAGUES[l].name}${fo ? ` <small>Campeón ${seasonTxt(fo.y)}: ${esc(G.clubs[fo.champ].name)}</small>` : ''}</h3>${tbl(['Jugador', 'Club', ['OVR', 'c']], top.map(p => `<tr class="cl" data-a="player" data-id="${p.id}"><td>${esc(p.n)}</td><td>${esc(G.clubs[p.tm].name)}</td><td class="c">${ovrChip(ovrNow(p))}</td></tr>`), 'free')}</div>`; }).join('')}</div>`;
  }
  return head + tabs + `<div class="card">${G.news.map(n => `<div style="padding:5px 0;border-bottom:1px solid #ffffff0d"><small>${fmtDay(n.d)}</small> ${esc(n.t)}</div>`).join('') || '<p class="mute">Sin noticias.</p>'}</div>`;
}

/* ---------------------------------------------------------- BUZÓN */
export function inbox(G, V) {
  const sel = G.inbox.find(m => m.id === V.msgSel) || G.inbox[0], from = m => (E.fromOf(m.from).name !== m.from ? E.fromOf(m.from).name : G.P[m.from]?.n || m.from);
  const list = G.inbox.slice(0, 60).map(m => `<div class="msg ${!m.read ? 'un' : ''}" style="${sel && sel.id === m.id ? 'background:#ffffff14' : ''}" data-a="msg" data-id="${m.id}"><div class="ic">${msgIcon(m)}</div><div><b>${esc(m.subj)}</b><span>${esc(from(m))}${m.acts?.length && !m.done ? ' · <b class="gold">requiere respuesta</b>' : ''}</span></div><span>${fmtShort(m.d)}</span></div>`).join('');
  const det = sel ? `<div class="card"><h3>${esc(sel.subj)} <small>${esc(from(sel))} · ${fmtDay(sel.d)}</small></h3><div class="mbody">${esc(sel.body)}</div>${sel.pid && G.P[sel.pid] ? `<div style="margin-top:10px">${B('player', `Ver a ${esc(G.P[sel.pid].n)}`, { id: sel.pid, cls: 'sm' })}</div>` : ''}${sel.acts?.length && !sel.done ? `<div class="acts">${sel.acts.map(a => B('mact', esc(a.label), { id: sel.id, v: a.id })).join('')}</div>${sel.expire ? `<small>Responder antes del ${fmtDay(sel.expire)}</small>` : ''}` : sel.result ? `<p class="gold" style="margin-top:12px">➜ ${esc(sel.result)}</p>` : ''}</div>` : '';
  return `<div class="row sp wrap"><h2>Buzón</h2>${B('readall', 'Marcar todo como leído', { cls: 'sm' })}</div><div class="grid g2" style="grid-template-columns:minmax(300px,1fr) minmax(300px,1.3fr);margin-top:10px"><div class="card" style="padding:0;max-height:calc(100vh - 190px);overflow-y:auto">${list || '<p class="mute" style="padding:14px">Vacío.</p>'}</div>${det}</div>`;
}

/* ---------------------------------------------------------- CLUB */
export function club(G, V) {
  const s = sub(V, 'club', 'dt'), tabs = subtabs(V, 'club', [['dt', 'Tu DT'], ['board', 'Directiva'], ['fin', 'Finanzas y staff'], ['hist', 'Historial']]), c = G.coach;
  if (s === 'dt') {
    const ident = G.coach.ident || { disc: 0, star: 0, youth: 0 };
    return `<h2>Club</h2>${tabs}<div class="grid g2"><div class="card"><div class="row" style="gap:18px;align-items:flex-start"><div class="avatar">${avatarSVG(c, 130)}</div><div><h2 style="margin:0">${esc(c.first)} ${esc(c.last)}</h2><div class="mute">${NAT_NAME[c.nat] || c.nat} · ${c.age + (G.Y - (G.flags.startY || G.Y))} años</div><div style="margin:8px 0"><span class="tag gld">${ARCH[c.arch].name}</span><span class="tag">${PHIL[c.philosophy]?.name || ''}</span>${E.identLabel(G).map(i => `<span class="tag grn">${i}</span>`).join('')}</div><p class="mute">${ARCH[c.arch].desc}</p>${B('editcoach', 'Cambiar apariencia', { cls: 'sm' })}</div></div></div>
    <div class="card"><h3>Identidad de DT</h3>${Object.entries(E.IDENT).map(([k, [a, b]]) => `<div style="margin:8px 0"><div class="row sp"><small>${a}</small><small>${b}</small></div><div class="bar" style="height:9px"><i style="width:${(ident[k] + 100) / 2}%;background:var(--gold)"></i></div></div>`).join('')}<p class="mute">Tus respuestas en las conferencias de prensa mueven estas barras y cambian cómo te ve el vestuario.</p></div>
    <div class="card"><h3>Marca como DT</h3><div class="row sp"><span>Partidos</span><b>${G.stats.coachW}G – ${G.stats.coachL}P</b></div><div class="row sp"><span>Títulos NBA</span><b>${G.stats.titles}</b></div><div class="row sp"><span>NBA Cups</span><b>${G.stats.cups}</b></div><div class="row sp"><span>Playoffs jugados</span><b>${G.stats.playoffs}</b></div></div></div>`;
  }
  if (s === 'board') {
    return `<h2>Club</h2>${tabs}<div class="grid g2"><div class="card"><h3>Confianza de la directiva</h3><div style="font:800 46px 'Barlow Condensed'" class="${G.board.conf < 30 ? 'dn' : 'gold'}">${Math.round(G.board.conf)}%</div>${bar(G.board.conf, 'gl')}<p class="mute" style="margin-top:8px">Sube con victorias, objetivos cumplidos y títulos. Si cae por debajo del 14% al terminar la temporada (o del 6% en medio) te despiden. Dificultad: <b>${DIFFS[G.diff].name}</b>.</p></div><div class="card"><h3>Objetivos de ${seasonTxt(G.Y)}</h3>${G.board.goals.map(g => `<div class="row sp" style="padding:4px 0"><span>${g.done == null ? '◻' : g.done ? '✅' : '❌'} ${esc(g.t)}</span><small>±${g.w}%</small></div>`).join('') || '<p class="mute">Todavía sin objetivos.</p>'}</div></div>`;
  }
  if (s === 'fin') {
    const lv = (k, name, desc) => `<div class="card"><h3>${name} <small>Nivel ${G.staff[k]}/5</small></h3>${bar(G.staff[k] * 20, 'gl')}<p class="mute" style="margin:8px 0">${desc}</p>${B('upgrade', G.staff[k] >= 5 ? 'Máximo' : `Mejorar · ${money(staffCost(G, k))}`, { id: k, cls: 'sm', dis: G.staff[k] >= 5 || G.fin.cash < staffCost(G, k) })}</div>`;
    const f = G.fin.last;
    return `<h2>Club</h2>${tabs}<div class="grid g2"><div class="card"><h3>Caja del club</h3><div style="font:800 40px 'Barlow Condensed'" class="${G.fin.cash < 0 ? 'dn' : 'gold'}">${money(G.fin.cash)}</div><p class="mute">Se usa para cláusulas de salida (fichajes de otras ligas) y mejorar el staff. Se llena con el resultado de cada temporada.</p>${f ? `<div class="row sp"><span>Último balance</span><b>${f.profit >= 0 ? '+' : ''}${money(f.profit)}</b></div>` : ''}</div>${lv('coach', 'Entrenadores', 'Más XP de entrenamiento y mejor evolución en verano.')}${lv('scout', 'Ojeadores', 'Reducen la incertidumbre del potencial de los prospectos.')}${lv('med', 'Cuerpo médico', 'Menos lesiones y recuperaciones más rápidas.')}</div>`;
  }
  return `<h2>Club</h2>${tabs}<div class="card"><h3>Temporadas</h3>${tbl(['Temp.', 'Equipo', 'Récord', 'Resultado'], G.hist.seasons.slice().reverse().map(x => `<tr><td>${seasonTxt(x.y)}</td><td>${x.tm}</td><td>${x.w}-${x.l}</td><td>${x.champ ? '🏆 Campeón NBA' : x.rounds ? 'Playoffs (ronda ' + x.rounds + ')' : 'Sin playoffs'}${x.cup ? ' · 🏆 NBA Cup' : ''}</td></tr>`), 'free') || '<p class="mute">Todavía no terminaste una temporada.</p>'}</div>`;
}
export const staffCost = (G, k) => Math.round((3 + G.staff[k] * 2.5) * 10) / 10;
