import { TEAMS } from '../teams.js';
import { loadRoster, fallbackRoster, buildRoster } from '../roster.js';
import { kitsFor, autoKit } from '../kits.js';
import { settings as GAME_SETTINGS } from '../ui.js';
import { esc, ovrChip, posTag, logo, tname, bar, delta, mood, fm, tbl, seasonTxt, ovrNow, baseOvr, money } from './h.js';
import { fmtDay, fmtShort, ymd, day, sum, clamp } from './util.js';
import { AGROUP, GROUPS, ATTR_LABEL, PROFILES, POS_NAME, CAP, toRow, ovrNow as _o } from './gen.js';
import { NAT_NAME, LEAGUES } from './data.js';
import { createWorld, DIFFS, DEFAULT_COACH } from './world.js';
import { ros, payroll, rosterCount, unread, teamStrength, rankIn, msg, news, place, standingsOf } from './state.js';
import * as SE from './season.js';
import * as M from './market.js';
import * as P from './prog.js';
import * as E from './events.js';
import * as SV from './save.js';
import * as V_ from './views.js';
import { avatarSVG, SKIN_HEX, HAIR_NAMES, HAIR_COLORS, SUITS, SUIT_COLORS, ARCH, PHIL, NATS } from './coach.js';
import { seasonDates, keyEvents, NBA_TEAMS } from './cal.js';

/* ============================================================================
   Modo carrera DT — pantalla principal. Maneja: menú de partidas, creación (DT → equipo → dificultad), el "hub" con todas las
   pestañas, las ventanas (jugador, negociación, previa y resultado del partido) y el puente con el partido 3D (hooks.play).
   ========================================================================== */
const $ = id => document.getElementById(id);
let root = null, hooks = {}, G = null, screen = 'menu', open_ = false, NC = null, rosters = null, loadN = 0, toastT = 0;
const V = { tab: 'home', sub: {}, modal: null, calM: 0, msgSel: null, draftCls: null, f: { fa: { pos: '', min: 0, q: '' }, gl: { pos: '', min: 0, q: '' }, intl: { pos: '', min: 0, q: '', lg: 'EUR' } }, trade: { team: 'BOS', give: [], get: [] }, contOpen: false, neg: null };
export const isHidden = () => !open_ || !root || root.hidden;
export const isOpen = () => open_;

export function open(h) {
  hooks = h || {}; root = $('cr'); open_ = true; root.hidden = false; screen = 'menu'; G = null; render();
  if (!root._bound) { root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('input', onInput); root._bound = true; }
  preloadRosters();
}
function close() { open_ = false; root.hidden = true; G = null; hooks.onExit?.(); }
/* Joystick: LB / RB cambian de pestaña del hub (el resto —moverse, elegir, volver— lo hace la navegación general de gamepad.js) */
export function onPad(P) {
  if (!open_ || !root || root.hidden || !P?.connected || !G || screen === 'menu' || screen === 'new' || V.modal) return;
  const d = P.nav?.lb ? -1 : P.nav?.rb ? 1 : 0; if (!d) return;
  const i = TABS.findIndex(t => t[0] === V.tab); V.tab = TABS[(i + d + TABS.length) % TABS.length][0]; render();
}
export function saveNow() { try { if (open_ && G) SV.save(G, G.slot || 1); } catch (e) { console.warn('No se pudo guardar la carrera', e); } }

/* ---------- planteles de la base ---------- */
async function preloadRosters() {
  if (rosters || preloadRosters.p) return preloadRosters.p;
  loadN = 0; rosters = {};
  preloadRosters.p = Promise.all(TEAMS.map(t => loadRoster(t).catch(() => fallbackRoster(t)).then(r => { rosters[t.ab] = r; loadN++; if (screen === 'new' && NC?.step === 1) renderSoft(); }))).then(() => { preloadRosters.p = null; });
  return preloadRosters.p;
}

/* ---------- utilidades de pantalla ---------- */
function toast(t) { let el = root.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; root.appendChild(el); } el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3800); }
const busyOn = t => { let el = root.querySelector('.busy'); if (!el) { el = document.createElement('div'); el.className = 'busy'; root.appendChild(el); } el.textContent = t || 'Simulando…'; el.hidden = false; };
const busyOff = () => { const el = root.querySelector('.busy'); if (el) el.hidden = true; };
const later = fn => new Promise(res => setTimeout(() => { res(fn()); }, 40));
function renderSoft() { const y = root.querySelector('.main, .wiz')?.scrollTop; render(); const el = root.querySelector('.main, .wiz'); if (el && y) el.scrollTop = y; }

/* ============================ RENDER ============================ */
function render() {
  if (!root) return;
  const y = root.querySelector('.main, .wiz')?.scrollTop || 0;
  if (screen === 'menu') root.innerHTML = menuHTML();
  else if (screen === 'new') root.innerHTML = wizardHTML();
  else root.innerHTML = hubHTML() + (V.modal ? modalHTML() : '');
  const el = root.querySelector('.main, .wiz'); if (el) el.scrollTop = y;
}
const TABS = [['home', 'Inicio', '🏠'], ['calendar', 'Calendario', '📅'], ['squad', 'Plantel', '👥'], ['lineup', 'Alineación', '📋'], ['training', 'Entrenamiento', '💪'], ['market', 'Mercado', '🔁'], ['draft', 'Draft y scouting', '🎓'], ['league', 'Liga', '🏆'], ['inbox', 'Buzón', '✉️'], ['club', 'Club', '🏛️']];
function hubHTML() {
  const t = G.teams[G.user], un = unread(G), pend = G.inbox.filter(m => !m.done && m.acts?.length && !m.read).length;
  const nav = TABS.map(([id, l, ic]) => `<button data-a="nav" data-id="${id}" data-ic="${ic}" class="${V.tab === id ? 'on' : ''}"><span>${l}</span>${id === 'inbox' && un ? `<i>${un}</i>` : ''}</button>`).join('') + `<div class="sp"></div><button data-a="save" data-ic="💾"><span>Guardar</span></button><button data-a="exit" data-ic="🚪"><span>Salir</span></button>`;
  const D = ymd(G.today), ng = SE.nextUserGame(G), today = ng && ng.d === G.today;
  const top = `<div class="top"><img class="tlogo" src="${t.logo}" alt=""><div class="tname"><b>${esc(t.name)}</b><span>${esc(G.coach.first)} ${esc(G.coach.last)} · ${V_.phaseName(G)}</span></div>
    <div class="date"><b>${fmtDay(G.today, true)}</b><span>${t.w}-${t.l} · Caja ${money(G.fin.cash)} · Confianza ${Math.round(G.board.conf)}%</span></div>
    <div class="cont ${V.contOpen ? 'open' : ''}">${today ? `<button class="btn gold" data-a="previa">🏀 Jugar hoy</button>` : `<button class="btn gold" data-a="cont">Continuar ▸</button>`}<button class="btn" data-a="contmenu" title="Saltear fechas" style="margin-left:4px">▾</button>${contMenu()}</div></div>`;
  return `${top}<div class="body"><nav class="nav">${nav}</nav><div class="main">${V_[V.tab](G, V)}</div></div>`;
}
function contMenu() {
  const it = (k, l, s = '') => `<button data-a="skip" data-v="${k}">${l}${s ? `<small class="mute">${s}</small>` : ''}</button>`;
  return `<div class="menu"><div style="padding:8px 14px"><b class="gold" style="font:800 14px 'Barlow Condensed';letter-spacing:.1em">AVANZAR (SE DETIENE EN TUS PARTIDOS)</b></div>${it('game', 'Hasta mi próximo partido')}${it('day', '1 día')}${it('week', '1 semana')}<div style="padding:8px 14px"><b class="gold" style="font:800 14px 'Barlow Condensed';letter-spacing:.1em">SALTEAR (SIMULA TAMBIÉN TUS PARTIDOS)</b></div>${it('s_week', '1 semana', 'Los resultados quedan en el calendario')}${it('s_month', '1 mes')}${it('s_deadline', 'Hasta el límite de cambios')}${it('s_endrs', 'Hasta el fin de la temporada regular')}${it('s_po', 'Hasta los playoffs')}${it('s_draft', 'Hasta el Draft')}${it('s_fa', 'Hasta la agencia libre')}${it('s_sl', 'Hasta la Summer League')}${it('s_next', 'Hasta la próxima temporada')}</div>`;
}

/* ============================ MENÚ DE PARTIDAS ============================ */
function menuHTML() {
  const meta = SV.readMeta();
  const slots = SV.SLOTS.map(s => { const m = meta[s]; return `<div class="slot"><div style="flex:1">${m ? `<b style="font:800 22px 'Barlow Condensed';text-transform:uppercase">${esc(m.coach)} · ${m.team}</b><div class="mute">Temporada ${seasonTxt(m.y)} · ${fmtDay(m.today)} · ${m.w}-${m.l} · ${new Date(m.at).toLocaleString('es-AR')}</div>` : `<b style="font:800 20px 'Barlow Condensed';text-transform:uppercase" class="mute">Ranura ${s} · vacía</b>`}</div>${m ? `<button class="btn gold" data-a="loadslot" data-id="${s}">Continuar</button><button class="btn danger sm" data-a="delslot" data-id="${s}">Borrar</button>` : `<button class="btn gold" data-a="newslot" data-id="${s}">Nueva carrera</button>`}</div>`; }).join('');
  return `<div class="menu-hero"><div class="menu-card"><small class="gold" style="letter-spacing:.2em;font-weight:800">BASKET 3D</small><h1 style="font-size:46px;margin:2px 0 4px">Modo carrera · Director técnico</h1><p class="mute" style="margin-bottom:18px">Llevá a un equipo de la NBA: ficha, entrená, draftea a las promesas de las secundarias, ganá la NBA Cup y el anillo. Jugás los partidos en 3D o los simulás.</p>${slots}<div class="row wrap" style="margin-top:14px"><button class="btn" data-a="import">Importar partida (archivo)</button><button class="btn" data-a="back" style="margin-left:auto">← Menú principal</button><input id="crFile" type="file" accept=".json,.b3d" hidden></div></div></div>`;
}

/* ============================ ASISTENTE: DT → EQUIPO → DIFICULTAD ============================ */
function wizardHTML() {
  const st = ['Tu DT', 'Equipo', 'Dificultad y arranque'], c = NC.coach;
  const steps = `<div class="steps">${st.map((s, i) => `<span class="${NC.step === i ? 'on' : i < NC.step ? 'done' : ''}">${i + 1}. ${s}</span>`).join('')}</div>`;
  let body = '';
  if (NC.step === 0) body = coachForm(c);
  else if (NC.step === 1) {
    const ready = loadN >= 30, str = ab => { const r = rosters?.[ab]; if (!r) return 0; const o = [...r.starters, ...r.bench].map(p => p.ovr).sort((a, b) => b - a).slice(0, 8); return o.length ? Math.round(sum(o) / o.length) : 0; };
    const arr = TEAMS.map(t => ({ t, s: str(t.ab) })), rank = arr.slice().sort((a, b) => b.s - a.s).map(x => x.t.ab);
    body = `<h2>Elegí tu equipo</h2><p class="mute" style="margin:4px 0 12px">${ready ? 'Los planteles se leen de tu base de datos (Supabase). La directiva fija objetivos según el nivel del equipo: los candidatos exigen títulos; los de abajo, mejorar.' : `Cargando planteles… ${loadN}/30`}</p><div class="teams">${arr.map(({ t, s }) => `<button class="tcard ${NC.team === t.ab ? 'on' : ''}" data-a="wteam" data-id="${t.ab}"><img src="${t.logo}" alt=""><div><b>${t.name.split(' ').slice(-1)[0]}</b><span>${t.ab} · ${ready ? `Nivel ${s} · #${rank.indexOf(t.ab) + 1}` : '…'}</span></div></button>`).join('')}</div>`;
  } else {
    const t = TEAMS.find(x => x.ab === NC.team);
    body = `<h2>Dificultad</h2><div class="chips" style="margin:10px 0">${Object.entries(DIFFS).map(([k, d]) => `<button class="chip ${NC.diff === k ? 'on' : ''}" data-a="wdiff" data-id="${k}">${d.name}</button>`).join('')}</div><p class="mute">${DIFFS[NC.diff].desc}</p>
    <div class="field" style="margin-top:14px"><span>Duración de los cuartos en los partidos que jugás</span><div class="chips">${[60, 120, 180, 300, 480].map(q => `<button class="chip ${NC.qLen === q ? 'on' : ''}" data-a="wq" data-id="${q}">${q / 60} min</button>`).join('')}</div></div>
    <div class="card" style="margin-top:16px"><div class="row" style="gap:18px"><div class="avatar">${avatarSVG(c, 100)}</div><div><h3 style="margin:0">${esc(c.first)} ${esc(c.last)} · ${ARCH[c.arch].name}</h3><div class="row" style="margin:6px 0"><img src="${t.logo}" width="44" height="44" alt=""><b style="font:800 24px 'Barlow Condensed';text-transform:uppercase">${t.name}</b></div><p class="mute">Empezás en el campus de entrenamiento de la temporada 2026-27 (apertura el 20 de octubre). Fechas reales: NBA Cup del 30/10 al 11/12, límite de cambios el 11/2, All-Star 19-21/2, fin de la temporada regular el 11/4.</p></div></div></div>`;
  }
  const last = NC.step === 2;
  return `<div class="wiz">${steps}${body}<div class="row" style="margin-top:22px">${NC.step ? B2('wprev', '← Atrás') : B2('wcancel', '← Cancelar')}<span style="flex:1"></span>${last ? B2('wstart', 'Empezar carrera ▸', 'gold', loadN < 30 && !NC.force) : B2('wnext', 'Siguiente ▸', 'gold')}</div></div>`;
}
const B2 = (a, l, cls = '', dis = false) => `<button class="btn ${cls}" data-a="${a}" ${dis ? 'disabled' : ''}>${l}</button>`;
function coachForm(c) {
  const sw = (key, list, cur) => list.map((h, i) => `<span class="sw ${cur === (key === 'skin' ? i : h) ? 'on' : ''}" style="background:${h}" data-a="cf" data-id="${key}" data-v="${key === 'skin' ? i : h}"></span>`).join('');
  const ch = (key, items, cur) => `<div class="chips">${items.map(([v, l]) => `<button class="chip ${cur === v ? 'on' : ''}" data-a="cf" data-id="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<div class="grid" style="grid-template-columns:minmax(180px,230px) 1fr;gap:22px"><div><div class="avatar" style="padding:18px">${avatarSVG(c, 180)}</div><div class="row" style="margin-top:10px"><button class="btn sm" data-a="cfrand">🎲 Aleatorio</button></div></div><div>
  <h2>Creá a tu DT</h2><div class="grid g3" style="margin:12px 0"><label class="field"><span>Nombre</span><input type="text" maxlength="16" data-i="cfi" data-id="first" value="${esc(c.first)}"></label><label class="field"><span>Apellido</span><input type="text" maxlength="18" data-i="cfi" data-id="last" value="${esc(c.last)}"></label><label class="field"><span>Nacionalidad</span><select data-i="cfi" data-id="nat">${NATS.map(([k, n]) => `<option value="${k}" ${c.nat === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label class="field"><span>Edad: ${c.age}</span><input type="range" min="30" max="70" value="${c.age}" data-i="cfi" data-id="age"></label></div>
  <div class="grid g2"><div><div class="field"><span>Piel</span><div class="row">${sw('skin', SKIN_HEX, c.skin)}</div></div><div class="field"><span>Peinado</span>${ch('hair', HAIR_NAMES.map((n, i) => [i, n]), c.hair)}</div><div class="field"><span>Color de pelo</span><div class="row">${sw('hairColor', HAIR_COLORS, c.hairColor)}</div></div><div class="field"><span>Barba</span>${ch('beard', [[0, 'Sin barba'], [1, 'Candado'], [2, 'Completa']], c.beard)}</div><div class="field"><span>Anteojos</span>${ch('glasses', [[0, 'Sin'], [1, 'Redondos'], [2, 'Cuadrados']], c.glasses)}</div></div>
  <div><div class="field"><span>Ropa</span>${ch('suit', Object.entries(SUITS).map(([k, s]) => [k, s.name]), c.suit)}<small class="mute">${SUITS[c.suit].desc}</small></div><div class="field"><span>Color de la prenda</span><div class="row">${sw('suitColor', SUIT_COLORS, c.suitColor)}</div></div><div class="field"><span>Arquetipo (tu ventaja)</span>${ch('arch', Object.entries(ARCH).map(([k, a]) => [k, a.name]), c.arch)}<small class="gold">${ARCH[c.arch].desc}</small></div><div class="field"><span>Filosofía de juego inicial</span>${ch('philosophy', Object.entries(PHIL).map(([k, a]) => [k, a.name]), c.philosophy)}</div></div></div></div></div>`;
}

/* ============================ MODALES ============================ */
function modalHTML() {
  const m = V.modal, body = ({ player: playerModal, previa: previaModal, result: resultModal, neg: negModal, confirm: confirmModal, roster: rosterModal, fired: firedModal, box: boxModal, coach: coachModal, skiprep: skipModal }[m.type] || (() => ''))(m);
  return `<div class="modal" data-a="mbg"><div class="mbox ${m.sm ? 'sm' : ''}">${body}</div></div>`;
}
const closeBtn = '<button class="btn sm x" data-a="close">✕ Cerrar</button>';
function playerModal(m) {
  const p = G.P[m.id]; if (!p) return closeBtn;
  const mine = p.tm === G.user, nba = p.lg === 'NBA', pro = p.prospect, prof = PROFILES[p.gp] || PROFILES[1];
  const attrs = GROUPS.map(g => `<div><h3 style="font-size:15px;margin:8px 0 4px">${g}</h3><div class="attr">${AGROUP[g].map(k => `<span>${ATTR_LABEL[k]}</span><b>${pro && !G.sc.watch.includes(p.id) && M.scoutKnow(G, p.id) < 25 ? '?' : Math.round(p.at[k])}</b>${bar(p.at[k])}`).join('')}</div></div>`).join('');
  const rng = pro ? M.prospectRange(G, p) : null;
  const hist = p.hist.length ? tbl(['Temp.', 'Equipo', ['PJ', 'n'], ['PTS', 'n'], ['REB', 'n'], ['AST', 'n'], ['OVR', 'n']], p.hist.slice().reverse().map(h => `<tr><td>${seasonTxt(h.y)}</td><td>${h.tm}</td><td class="n">${h.gp}</td><td class="n">${h.pts}</td><td class="n">${h.reb}</td><td class="n">${h.ast}</td><td class="n">${h.ovr}</td></tr>`), 'free') : '<p class="mute">Sin historial en la carrera.</p>';
  const st = p.st && p.st.gp ? `<div class="row wrap" style="gap:18px;margin:6px 0">${[['PJ', p.st.gp], ['MIN', fm(p.st.min / p.st.gp)], ['PTS', fm(p.st.pts / p.st.gp)], ['REB', fm(p.st.reb / p.st.gp)], ['AST', fm(p.st.ast / p.st.gp)], ['ROB', fm(p.st.stl / p.st.gp)], ['TAP', fm(p.st.blk / p.st.gp)], ['TC%', p.st.fga ? Math.round(p.st.fgm / p.st.fga * 100) + '%' : '–'], ['3P%', p.st.tpa ? Math.round(p.st.tpm / p.st.tpa * 100) + '%' : '–']].map(([a, b]) => `<div style="text-align:center"><b style="font:800 22px 'Barlow Condensed'">${b}</b><br><small>${a}</small></div>`).join('')}</div>` : '<p class="mute">Sin estadísticas esta temporada.</p>';
  const place_ = p.tm ? (G.teams[p.tm] ? G.teams[p.tm].name : G.clubs[p.tm]?.name) : p.lg === 'FA' ? 'Agente libre' : p.lg === 'GL' ? 'Libre (G League)' : pro ? `Prospecto · Draft ${pro.cls}` : '';
  const acts = [];
  if (mine && nba) acts.push(`<button class="btn sm" data-a="p_ext" data-id="${p.id}">Renegociar contrato</button>`, `<button class="btn sm" data-a="p_gl" data-id="${p.id}">${p.gl ? 'Subir al plantel' : 'Mandar a la G League'}</button>`, `<button class="btn sm danger" data-a="p_rel" data-id="${p.id}">Liberar</button>`, `<button class="btn sm" data-a="p_trade" data-id="${p.id}">Ofrecer en cambio</button>`);
  else if (p.lg === 'FA') acts.push(`<button class="btn sm gold" data-a="sign" data-id="${p.id}" data-v="fa">Negociar</button>`);
  else if (p.lg === 'GL' && !p.tm) acts.push(`<button class="btn sm gold" data-a="sign" data-id="${p.id}" data-v="two">Firmar two-way</button>`);
  else if (nba && p.tm && G.teams[p.tm]) acts.push(`<button class="btn sm gold" data-a="p_get" data-id="${p.id}">Pedir en cambio</button>`);
  else if (p.tm && G.clubs[p.tm]) acts.push(`<button class="btn sm gold" data-a="sign" data-id="${p.id}" data-v="intl">Fichar (cláusula ${money(M.buyoutFee(G, p))})</button>`);
  if (pro) acts.push(`<button class="btn sm" data-a="watch" data-id="${p.id}">${G.sc.watch.includes(p.id) ? '⭐ Dejar de seguir' : '☆ Seguir de cerca'}</button>`);
  const focus = mine && nba ? `<div class="field" style="max-width:260px"><span>Foco de entrenamiento</span><select data-i="focus" data-id="${p.id}"><option value="auto">Automático (${P.autoFocus(p)})</option>${GROUPS.map(g => `<option ${G.plan[p.id] === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>` : '';
  return `${closeBtn}<div class="row" style="gap:18px;align-items:flex-start;flex-wrap:wrap"><div style="min-width:240px"><h2 style="margin:0">${esc(p.n)} ${p.num != null && nba ? `<small class="mute">#${p.num}</small>` : ''}</h2><div class="mute">${posTag(p.pos)} ${POS_NAME[p.pos]} · ${p.age} años · ${p.ht} cm · ${Math.round(p.wt * 0.4536)} kg · ${NAT_NAME[p.nat] || ''}</div><div class="mute">${esc(place_ || '')}</div><div style="margin:8px 0"><span class="tag gld">${P.moodLabel(p.mor)} ${mood(p.mor)}</span><span class="tag">${p.trait}</span><span class="tag">Perfil ${prof.name}</span>${injTag2(p)}${(p.aw || []).slice(-4).map(a => `<span class="tag gld">★ ${esc(a)}</span>`).join('')}</div></div>
  <div class="row" style="gap:22px;margin-left:auto"><div style="text-align:center"><div style="font:800 54px 'Barlow Condensed';line-height:1" class="${ovrNow(p) >= 80 ? 'gold' : ''}">${ovrNow(p)}</div><small>OVR${p.frm ? ` (${p.frm > 0 ? '+' : ''}${fm(p.frm)} forma)` : ''}</small></div><div style="text-align:center"><div style="font:800 54px 'Barlow Condensed';line-height:1" class="mute">${rng ? `${rng[0]}-${rng[1]}` : p.age >= 29 ? ovrNow(p) : p.pot}</div><small>POTENCIAL</small></div></div></div>
  ${p.con ? `<p style="margin:8px 0">Contrato: <b>${money(p.con.sal)}</b> hasta ${G.Y + p.con.yrs} · ${p.con.type === 'rookie' ? 'Rookie' : p.con.type === 'two' ? 'Two-way' : 'Estándar'} ${p.gl ? ' · en G League' : ''}</p>` : ''}${prof ? `<small class="mute">${prof.desc}</small>` : ''}
  <div class="row wrap" style="margin:12px 0">${acts.join('')}</div>${focus}<h3>Temporada</h3>${st}<div class="grid g3" style="margin-top:8px">${attrs}</div><h3 style="margin-top:14px">Historial</h3>${hist}`;
}
const injTag2 = p => (p.inj ? `<span class="tag red">🩹 ${p.inj.t} · ${p.inj.d} d</span>` : '');
function previaModal(m) {
  const g = m.game || SE.nextUserGame(G); if (!g) return closeBtn;
  const mine = g.h === G.user, opp = mine ? g.a : g.h, today = g.d === G.today;
  const key = ab => SE.lineupFor(G, ab).slice(0, 5), side = ab => `<div class="card"><h3>${logo(G, ab, 24)} ${esc(G.teams[ab].name)} <small>${G.teams[ab].w}-${G.teams[ab].l} · Nivel ${teamStrength(G, ab).toFixed(1)}</small></h3>${tbl(['Quinteto', ['OVR', 'c']], key(ab).map(p => `<tr><td>${posTag(p.pos)} ${esc(p.n)} ${p.inj ? '🩹' : ''}</td><td class="c">${ovrChip(ovrNow(p))}</td></tr>`), 'free')}</div>`;
  const ty = { rs: 'Temporada regular', cup: 'NBA Cup · Fase de grupos', cupQ: 'NBA Cup · Cuartos de final', cupS: 'NBA Cup · Semifinal', cupF: 'NBA Cup · FINAL', pre: 'Pretemporada', po: 'Playoffs', pi: 'Play-in', sl: 'Summer League' }[g.ty];
  const blocked = g.done || !today;
  return `${closeBtn}<h2>Previa · ${fmtDay(g.d, true)}</h2><p class="mute">${ty}${g.ser ? ` · Partido ${g.gm} de la serie` : ''} · ${mine ? 'Local' : 'Visitante'}</p><div class="grid g2" style="margin:12px 0">${side(G.user)}${side(opp)}</div>
  <div class="row wrap"><label class="row"><span class="mute">Cuartos:</span><select id="crQ" style="width:100px" data-i="qlen">${[60, 120, 180, 300, 480].map(q => `<option value="${q}" ${(G.settings.qLen || 180) === q ? 'selected' : ''}>${q / 60} min</option>`).join('')}</select></label><span style="flex:1"></span>${blocked ? `<span class="mute">${g.done ? 'Ya se jugó.' : 'Todavía no es el día del partido.'}</span>` : `<button class="btn" data-a="simgame" data-id="${g.id}">⚡ Simular</button><button class="btn gold" data-a="playgame" data-id="${g.id}">🏀 Jugar en 3D</button>`}</div><p class="mute" style="margin-top:8px">Alineación y táctica: pestaña «Alineación». Si lo jugás en 3D, controlás a un jugador y el resultado cuenta para la temporada.</p>`;
}
function boxTable(g, ab) {
  const lines = (g.h === ab ? g.box?.h : g.box?.a) || [];
  return tbl(['Jugador', ['MIN', 'n'], ['PTS', 'n'], ['REB', 'n'], ['AST', 'n'], ['ROB', 'n'], ['TAP', 'n'], ['TC', 'n'], ['3P', 'n'], ['+/-', 'n']], lines.map(l => { const p = G.P[l.id]; return `<tr class="cl" data-a="player" data-id="${l.id}"><td>${p ? posTag(p.pos) + ' ' + esc(p.n) : '—'}</td><td class="n">${l.min}</td><td class="n"><b>${l.pts}</b></td><td class="n">${l.reb}</td><td class="n">${l.ast}</td><td class="n">${l.stl}</td><td class="n">${l.blk}</td><td class="n">${l.fgm}/${l.fga}</td><td class="n">${l.tpm}/${l.tpa}</td><td class="n ${l.pm > 0 ? 'up' : l.pm < 0 ? 'dn' : ''}">${l.pm}</td></tr>`; }), 'free');
}
function scoreHead(g) { const us = g.h === G.user ? g.hs : g.as, th = g.h === G.user ? g.as : g.hs; return `<div class="scorebox"><div class="tt">${logo(G, g.h, 64)}<br><b>${g.h}</b></div><strong class="${g.hs > g.as ? 'w' : ''}">${g.hs}</strong><span class="mute">${g.ot ? 'TE' : '–'}</span><strong class="${g.as > g.hs ? 'w' : ''}">${g.as}</strong><div class="tt">${logo(G, g.a, 64)}<br><b>${g.a}</b></div></div><p style="text-align:center;font:800 24px 'Barlow Condensed';text-transform:uppercase" class="${us > th ? 'up' : 'dn'}">${us > th ? '¡Victoria!' : 'Derrota'}</p>`; }
function resultModal(m) { const g = m.game; return `${closeBtn}<h2>Final · ${fmtDay(g.d)}</h2>${scoreHead(g)}<h3>${esc(G.teams[G.user].name)}</h3>${boxTable(g, G.user)}${m.extra ? `<p class="gold" style="margin-top:10px">${esc(m.extra)}</p>` : ''}<div class="row" style="margin-top:14px"><button class="btn" data-a="boxopp" data-id="${g.id}">Ver rival</button><span style="flex:1"></span><button class="btn gold" data-a="close">Continuar ▸</button></div>`; }
function boxModal(m) { const g = G.sched.find(x => x.id === m.id) || m.game; if (!g?.done) return closeBtn; const ab = m.opp ? (g.h === G.user ? g.a : g.h) : G.user; return `${closeBtn}<h2>${fmtDay(g.d)}</h2>${scoreHead(g)}<h3>${esc(G.teams[ab].name)}</h3>${g.box ? boxTable(g, ab) : '<p class="mute">Sin detalle de este partido.</p>'}<div class="row" style="margin-top:10px"><button class="btn sm" data-a="boxopp" data-id="${g.id}">${m.opp ? 'Ver mi equipo' : 'Ver rival'}</button></div>`; }
function confirmModal(m) { return `<h2>${esc(m.title)}</h2><p style="line-height:1.5">${esc(m.text)}</p><div class="row" style="margin-top:14px"><button class="btn" data-a="close">Cancelar</button><span style="flex:1"></span><button class="btn gold" data-a="${m.go}" data-id="${m.id ?? ''}" data-v="${m.v ?? ''}">${esc(m.label || 'Confirmar')}</button></div>`; }
function rosterModal() { const n = rosterCount(G, G.user); return `<h2>Recorte de plantel</h2><p>Tenés <b>${n}</b> jugadores y el máximo para arrancar la temporada es <b>15</b>. Liberá a ${n - 15} desde «Plantel», o dejá que el cuerpo técnico corte a los menos útiles.</p><div class="row" style="margin-top:14px"><button class="btn" data-a="goto" data-id="squad">Ir al plantel</button><span style="flex:1"></span><button class="btn gold" data-a="autocut">Cortar automáticamente</button></div>`; }
function firedModal() {
  const offers = SE.jobOffers(G);
  return `<h2>Te despidieron</h2><p>La directiva de ${esc(G.teams[G.user].name)} puso fin a tu ciclo. Tu carrera sigue: elegí una oferta.</p><div class="teams" style="margin-top:10px">${offers.map(o => `<button class="tcard" data-a="takejob" data-id="${o.ab}"><img src="${G.teams[o.ab].logo}" alt=""><div><b>${G.teams[o.ab].name.split(' ').slice(-1)[0]}</b><span>Nivel ${o.str.toFixed(1)}</span></div></button>`).join('')}</div>`;
}
function skipModal(m) { return `${closeBtn}<h2>${esc(m.title)}</h2><div class="mbody">${esc(m.text)}</div><div class="row" style="margin-top:14px"><span style="flex:1"></span><button class="btn gold" data-a="close">Continuar ▸</button></div>`; }
function coachModal() { return `${closeBtn}${coachForm(G.coach)}<div class="row" style="margin-top:14px"><span style="flex:1"></span><button class="btn gold" data-a="close">Listo</button></div>`; }

/* negociación (agencia libre, G League, otras ligas, renovación) */
function negModal(m) {
  const p = G.P[m.pid], N = V.neg; if (!p) return closeBtn;
  const two = N.kind === 'two', ext = N.kind === 'ext', intl = N.kind === 'intl';
  const minS = two ? 0.6 : CAP.min, maxS = M.maxSalary(), w = M.willingness(G, p, G.user, N.sal, N.yrs, { own: ext, intl });
  const fee = intl ? M.buyoutFee(G, p) : 0, pay = payroll(G, G.user) - (ext ? p.con?.sal || 0 : 0), capOk = two || M.canSignCap(G, G.user, N.sal) || ext;
  const issues = [];
  if (!ext && rosterCount(G, G.user) >= M.rosterLimit(G)) issues.push(`Plantel completo (${M.rosterLimit(G)}).`);
  if (!capOk) issues.push(`No entra en el tope: con ${money(pay)} de salarios solo podés ofrecer el mínimo (${money(CAP.min)}).`);
  if (two && M.twoWayCount(G, G.user) >= M.TWO_WAY_MAX) issues.push('Ya tenés 3 contratos two-way.');
  if (intl && G.fin.cash < fee) issues.push(`La cláusula de salida (${money(fee)}) supera tu caja (${money(G.fin.cash)}).`);
  const ok = w.ok && !issues.length;
  return `${closeBtn}<h2>${ext ? 'Renovación' : intl ? 'Fichaje desde ' + esc(G.clubs[p.tm]?.name || '') : two ? 'Contrato two-way' : 'Oferta de contrato'}</h2><div class="row" style="gap:14px;margin-bottom:10px"><div>${ovrChip(ovrNow(p))}</div><div><b>${posTag(p.pos)} ${esc(p.n)}</b><div class="mute">${p.age} años · pot ${p.pot} · ${p.trait} · ${P.moodLabel(p.mor)}</div></div></div>
  <div class="field"><span>Salario anual: <b class="gold">${money(N.sal)}</b></span><input type="range" min="${minS}" max="${Math.max(maxS, minS + 1)}" step="0.1" value="${N.sal}" data-i="negsal"></div>
  <div class="field"><span>Años</span><div class="chips">${(two ? [1, 2] : [1, 2, 3, 4, 5]).map(y => `<button class="chip ${N.yrs === y ? 'on' : ''}" data-a="negyrs" data-v="${y}">${y}</button>`).join('')}</div></div>
  <div class="card"><div class="row sp"><span>Pide como mínimo</span><b>${money(w.need)}</b></div><div class="row sp"><span>Interés</span><b class="${w.ok ? 'up' : 'dn'}">${w.interest}</b></div>${intl ? `<div class="row sp"><span>Cláusula de salida (a su club)</span><b>${money(fee)}</b></div>` : ''}${issues.map(i => `<div class="dn">• ${esc(i)}</div>`).join('')}</div>
  <div class="row" style="margin-top:14px"><button class="btn" data-a="negask">Ofrecer lo que pide</button><span style="flex:1"></span><button class="btn gold" data-a="negok" ${ok ? '' : 'disabled'}>${ext ? 'Renovar' : 'Firmar'}</button></div>`;
}
function openNeg(pid, kind) {
  const p = G.P[pid]; if (!p) return;
  const ask = kind === 'two' ? 0.6 : Math.min(M.maxSalary(), Math.max(CAP.min, (p.fa?.ask ?? M.askFor(p)))), yrs = kind === 'two' ? 2 : p.fa?.yrs || (kind === 'ext' ? 3 : 2);
  V.neg = { pid, kind, sal: Math.round(ask * 10) / 10, yrs }; V.modal = { type: 'neg', pid }; render();
}

/* ============================ EVENTOS ============================ */
function onInput(e) {
  const t = e.target, i = t.dataset.i; if (!i) return;
  if (i === 'negsal') { V.neg.sal = Math.round(+t.value * 10) / 10; const s = root.querySelector('.mbox'); const y = s.scrollTop; render(); root.querySelector('.mbox').scrollTop = y; }
  else if (i === 'cfi' && t.dataset.id === 'age') { (NC?.coach || G.coach).age = +t.value; refreshCoach(); }
  else if (i === 'cfi' && (t.dataset.id === 'first' || t.dataset.id === 'last')) { (NC?.coach || G.coach)[t.dataset.id] = t.value; }
  else if (i === 'fq') { V.f[t.dataset.id].q = t.value; clearTimeout(onInput.t); onInput.t = setTimeout(() => { renderSoft(); const el = root.querySelector('input[data-i="fq"]'); el?.focus(); el?.setSelectionRange(99, 99); }, 250); }
}
function refreshCoach() { const m = root.querySelector('.avatar'); if (m) { const big = m.parentElement.querySelector('.avatar'); render(); } }
function onChange(e) {
  const t = e.target, i = t.dataset.i; if (!i) return;
  if (i === 'cfi') { (NC?.coach || G.coach)[t.dataset.id] = t.dataset.id === 'age' ? +t.value : t.value; render(); }
  else if (i === 'focus') { if (t.value === 'auto') delete G.plan[t.dataset.id]; else G.plan[t.dataset.id] = t.value; render(); }
  else if (i === 'fpos') { V.f[t.dataset.id].pos = t.value; render(); } else if (i === 'fmin') { V.f[t.dataset.id].min = +t.value; render(); }
  else if (i === 'tteam') { V.trade = { team: t.value, give: V.trade.give, get: [] }; render(); }
  else if (i === 'qlen') { G.settings.qLen = +t.value; }
}
function parseItem(G, id) { return id[0] === 'k' ? { k: 'k', pk: G.picks[+id.slice(1)] } : { k: 'p', id }; }
async function onClick(e) {
  const el = e.target.closest('[data-a]'); if (!el) { if (V.contOpen) { V.contOpen = false; render(); } return; }
  const a = el.dataset.a, id = el.dataset.id, v = el.dataset.v;
  if (a === 'mbg') { if (e.target === el) { V.modal = null; render(); } return; }
  if (V.contOpen && a !== 'skip' && a !== 'contmenu') V.contOpen = false;
  /* ---- menú / asistente ---- */
  if (a === 'back') return close();
  if (a === 'newslot') { NC = { step: 0, slot: +id, coach: { ...DEFAULT_COACH }, team: 'LAL', diff: 'pro', qLen: 180 }; screen = 'new'; preloadRosters(); return render(); }
  if (a === 'loadslot') { busyOn('Cargando…'); await later(() => { G = SV.load(+id); }); busyOff(); if (!G) return toast('No se pudo cargar esa partida.'); G.slot = +id; enterHub(); return; }
  if (a === 'delslot') { V.modal = null; if (confirm('¿Borrar esta carrera?')) { SV.remove(+id); render(); } return; }
  if (a === 'import') { const f = $('crFile'); f.onchange = async () => { const file = f.files[0]; if (!file) return; try { G = SV.importText(await file.text()); G.slot = G.slot || 1; SV.save(G, G.slot); enterHub(); } catch (err) { toast('Archivo inválido.'); } }; f.click(); return; }
  if (a === 'cf') { (NC?.coach || G.coach)[id] = isNaN(+v) || id === 'hairColor' || id === 'suitColor' || id === 'suit' || id === 'arch' || id === 'philosophy' ? v : +v; return render(); }
  if (a === 'cfrand') { const r = x => x[Math.floor(Math.random() * x.length)], c = NC?.coach || G.coach; Object.assign(c, { skin: Math.floor(Math.random() * 6), hair: Math.floor(Math.random() * 7), hairColor: r(HAIR_COLORS), beard: Math.floor(Math.random() * 3), glasses: Math.floor(Math.random() * 3), suit: r(Object.keys(SUITS)), suitColor: r(SUIT_COLORS) }); return render(); }
  if (a === 'wcancel') { screen = 'menu'; return render(); }
  if (a === 'wprev') { NC.step--; return render(); }
  if (a === 'wnext') { if (NC.step === 0 && (!NC.coach.first.trim() || !NC.coach.last.trim())) return toast('Poné nombre y apellido a tu DT.'); NC.step++; return render(); }
  if (a === 'wteam') { NC.team = id; return render(); }
  if (a === 'wdiff') { NC.diff = id; return render(); }
  if (a === 'wq') { NC.qLen = +id; return render(); }
  if (a === 'wstart') return startCareer();
  if (!G) return;
  /* ---- hub ---- */
  if (a === 'nav') { V.tab = id; V.modal = null; return render(); }
  if (a === 'sub') { V.sub[id] = v; return render(); }
  if (a === 'contmenu') { V.contOpen = !V.contOpen; return render(); }
  if (a === 'cont') return doAdvance({ until: 'game' });
  if (a === 'skip') { V.contOpen = false; return skip(v); }
  if (a === 'close') { V.modal = null; return render(); }
  if (a === 'goto') { V.tab = id; V.modal = null; return render(); }
  if (a === 'player') { V.modal = { type: 'player', id }; return render(); }
  if (a === 'previa') { const g = id ? G.sched.find(x => x.id === +id) : SE.nextUserGame(G); if (!g) return; V.modal = { type: 'previa', game: g }; return render(); }
  if (a === 'simgame') { const g = G.sched.find(x => x.id === +id); return simOne(g); }
  if (a === 'playgame') { const g = G.sched.find(x => x.id === +id); return playOne(g); }
  if (a === 'boxlast') { const g = SE.lastUserGame(G); if (g) { V.modal = { type: 'box', id: g.id }; render(); } return; }
  if (a === 'boxgame') { V.modal = { type: 'box', id: +id }; return render(); }
  if (a === 'boxopp') { const m = V.modal; V.modal = { type: 'box', id: +id, opp: m.type === 'box' ? !m.opp : true }; return render(); }
  if (a === 'calm') { V.calM = +v === 0 ? 0 : (V.calM || 0) + +v; return render(); }
  if (a === 'save') { const r = SV.save(G, G.slot || 1); return toast(r.ok ? 'Partida guardada.' : r.error); }
  if (a === 'exit') { SV.save(G, G.slot || 1); G = null; screen = 'menu'; V.modal = null; return render(); }
  if (a === 'autocut') { SE.autoCut(G, G.user); V.modal = null; render(); return doAdvance({ until: 'game' }); }
  if (a === 'takejob') { SE.takeJob(G, id); V.modal = null; SV.save(G, G.slot || 1); return render(); }
  /* ---- buzón ---- */
  if (a === 'msg') { const m = G.inbox.find(x => x.id === +id); if (m) { m.read = true; V.msgSel = m.id; V.tab = 'inbox'; V.modal = null; } return render(); }
  if (a === 'readall') { G.inbox.forEach(m => { m.read = true; }); return render(); }
  if (a === 'mact') {
    const m = G.inbox.find(x => x.id === +id), r = E.answerMsg(G, m, v, G.rng);
    if (r && typeof r === 'object') {
      if (r.open === 'negotiate') { render(); return openNeg(r.pid, 'ext'); }
      if (r.open === 'player') { V.modal = { type: 'player', id: r.pid }; return render(); }
      if (r.trade) { const t = r.trade; M.execTrade(G, G.user, t.B, t.give, t.get); m.result = 'Cambio concretado.'; toast('Cambio concretado.'); SE.roles(G); return render(); }
    } else { m.result = r || m.result; if (r) toast(r); }
    return render();
  }
  /* ---- plantel / jugador ---- */
  if (a === 'p_ext') return openNeg(id, 'ext');
  if (a === 'p_gl') { const p = G.P[id]; if (!p.gl && ros(G, G.user).filter(x => !x.gl && x.lg === 'NBA').length <= 8) return toast('Necesitás al menos 8 jugadores en el plantel principal.'); p.gl = !p.gl; toast(p.gl ? `${p.n} fue a la G League: juega y se desarrolla allá.` : `${p.n} volvió al plantel.`); return render(); }
  if (a === 'p_rel') { const p = G.P[id], dead = p.con && p.con.sal > CAP.min ? Math.round(p.con.sal * Math.min(p.con.yrs, 2) * 0.4 * 10) / 10 : 0; V.modal = { type: 'confirm', sm: true, title: `Liberar a ${p.n}`, text: `${dead ? `Te quedan ${money(dead)} de dinero muerto en el tope. ` : ''}El jugador queda libre y otro equipo puede firmarlo.`, go: 'p_rel_ok', id, label: 'Liberar' }; return render(); }
  if (a === 'p_rel_ok') { const p = G.P[id]; M.releasePlayer(G, p); G.lineup = G.lineup.filter(x => x !== id); V.modal = null; toast(`${p.n} fue liberado.`); return render(); }
  if (a === 'p_trade' || a === 'p_get') {
    const p = G.P[id]; V.tab = 'market'; V.sub.market = 'trade'; V.modal = null;
    if (a === 'p_trade') V.trade.give = [{ k: 'p', id }]; else { V.trade = { team: p.tm, give: [], get: [{ k: 'p', id }] }; }
    return render();
  }
  if (a === 'tac') { G.tac[id] = v; return render(); }
  if (a === 'lauto') { G.lineup = []; return render(); }
  if (a === 'lmove') { const order = SE.lineupFor(G, G.user).map(p => p.id), i = order.indexOf(id), j = i + +v; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; G.lineup = order; return render(); }
  if (a === 'autotrain') { G.settings.autoTrain = v === '1'; return render(); }
  if (a === 'intensity') { G.settings.intensity = v; return render(); }
  /* ---- mercado ---- */
  if (a === 'sign') return openNeg(id, v === 'fa' ? 'fa' : v === 'two' ? 'two' : v === 'gl' ? 'gl' : v === 'intl' ? 'intl' : 'fa');
  if (a === 'intl') { V.f.intl.lg = v; return render(); }
  if (a === 'negyrs') { V.neg.yrs = +v; return render(); }
  if (a === 'negask') { const p = G.P[V.neg.pid], w = M.willingness(G, p, G.user, V.neg.sal, V.neg.yrs, { own: V.neg.kind === 'ext', intl: V.neg.kind === 'intl' }); V.neg.sal = Math.min(M.maxSalary(), Math.ceil(w.need * 10) / 10); return render(); }
  if (a === 'negok') return finishNeg();
  if (a === 'tsel') { const T = V.trade, list = v === 'give' ? T.give : T.get, it = parseItem(G, id), idx = list.findIndex(x => x.k === it.k && (it.k === 'p' ? x.id === it.id : x.pk === it.pk)); if (idx >= 0) list.splice(idx, 1); else list.push(it); return render(); }
  if (a === 'tctr') { const T = V.trade, r = M.counterAsk(G, G.user, T.team, T.get); if (!r) return toast('No tenés con qué pagar eso.'); T.give = r; toast('Esto es lo que piden. Podés tocarlo y ajustarlo.'); return render(); }
  if (a === 'tgo') { const T = V.trade, r = M.evalTrade(G, G.user, T.team, T.give, T.get); if (!r.accept) return; const names = M.execTrade(G, G.user, T.team, T.give, T.get); toast(`Cambio hecho con ${G.teams[T.team].name}.`); news(G, `Cambio: ${G.teams[G.user].name} y ${G.teams[T.team].name} (${names.join(', ')}).`, 'cambio'); V.trade.give = []; V.trade.get = []; SE.roles(G); return render(); }
  /* ---- draft ---- */
  if (a === 'dcls') { V.draftCls = +v; return render(); }
  if (a === 'watch') { const i = G.sc.watch.indexOf(id); if (i >= 0) G.sc.watch.splice(i, 1); else if (G.sc.watch.length >= 8 + G.staff.scout * 2) return toast('Tu lista de seguimiento está llena. Mejorá los ojeadores o sacá a alguien.'); else G.sc.watch.push(id); return render(); }
  if (a === 'dsim') { M.draftRun(G, G.rng, false); return render(); }
  if (a === 'dauto') { M.draftRun(G, G.rng, true); SE.roles(G); toast('Draft completo.'); return render(); }
  if (a === 'dpick') { M.draftUserPick(G, G.rng, id); SE.roles(G); const p = G.P[id]; toast(`Elegiste a ${p.n}.`); return render(); }
  /* ---- club ---- */
  if (a === 'upgrade') { const c = V_.staffCost(G, id); if (G.fin.cash < c || G.staff[id] >= 5) return; G.fin.cash -= c; G.staff[id]++; return render(); }
  if (a === 'editcoach') { V.modal = { type: 'coach' }; return render(); }
}
function enterHub() { screen = 'hub'; V.tab = 'home'; V.modal = null; V.msgSel = null; V.trade = { team: NBA_TEAMS.find(t => t !== G.user) || 'BOS', give: [], get: [] }; SE.roles(G); render(); if (G.fired) { V.modal = { type: 'fired' }; render(); } }
async function startCareer() {
  busyOn('Armando el mundo de la liga…');
  await preloadRosters();
  await later(() => {
    G = createWorld({ user: NC.team, coach: NC.coach, diff: NC.diff, teams: TEAMS, rosters });
    G.slot = NC.slot; G.settings.qLen = NC.qLen; G.tac = { ...PHIL[NC.coach.philosophy].tac }; G.flags.startY = G.Y;
    G.coach.perk = 0; SE.roles(G); E.setBoardGoals(G);
    msg(G, { kind: 'info', from: 'gm', subj: 'Tu primer día como DT', body: `Bienvenido a ${G.teams[G.user].name}. Arrancó el campus de entrenamiento. Revisá el plantel, ajustá tu quinteto y la táctica, y mirá las pestañas Mercado (otras ligas, G League, agencia libre) y Draft y scouting (secundarias).\n\nUsá «Continuar ▸» para avanzar; el menú ▾ deja saltear semanas, meses o hasta el Draft. Tus partidos podés jugarlos en 3D o simularlos.` });
    SV.save(G, G.slot);
  });
  busyOff(); NC = null; enterHub();
}
async function finishNeg() {
  const N = V.neg, p = G.P[N.pid];
  if (N.kind === 'ext') { const old = p.con; GEN_set(p, N.sal, N.yrs, 'std'); p.mor = clamp(p.mor + 6, 5, 99); toast(`${p.n} renovó hasta ${G.Y + N.yrs}.`); }
  else if (N.kind === 'intl') { const fee = M.signIntl(G, p, G.user, N.sal, N.yrs); toast(`${p.n} firmó con ${G.teams[G.user].name}. Cláusula pagada: ${money(fee)}.`); news(G, `${G.teams[G.user].name} ficha a ${p.n} (${ovrNow(p)}).`, 'intl'); }
  else { M.signPlayer(G, p, G.user, N.sal, N.yrs, N.kind === 'two' ? 'two' : 'std'); toast(`${p.n} firmó con ${G.teams[G.user].name}.`); }
  V.modal = null; V.neg = null; SE.roles(G); render();
}
import { setContract as GEN_set } from './gen.js';

/* ============================ AVANZAR EL TIEMPO ============================ */
function targetDate(kind) {
  const D = G.D, N = seasonDates(G.Y + 1), t = G.today, pick = (...ds) => ds.filter(d => d > t).sort((a, b) => a - b)[0];
  return ({ week: t + 7, month: (() => { const y = ymd(t); return day(y.m === 12 ? y.y + 1 : y.y, (y.m % 12) + 1, 1); })(), deadline: pick(D.deadline + 1, N.deadline + 1), endrs: pick(D.endRS + 1, N.endRS + 1), po: pick(D.poStart, N.poStart), draft: pick(D.draft + 2, N.draft + 2), fa: pick(D.faOpen + 1, N.faOpen + 1), sl: pick(D.slStart, N.slStart), next: pick(D.nextCamp + 1, N.nextCamp + 1) })[kind];
}
async function skip(kind) {
  if (kind === 'game') return doAdvance({ until: 'game' });
  if (kind === 'day') return doAdvance({ until: 'days', n: 1 });
  if (kind === 'week') return doAdvance({ until: 'date', date: G.today + 7 });
  const k = kind.slice(2), d = targetDate(k === 'week' ? 'week' : k);
  return doAdvance({ until: 'date', date: d, simUser: true, ignoreMsgs: true, limit: 520 }, true);
}
async function doAdvance(mode, summary = false) {
  const before = { w: G.stats.coachW, l: G.stats.coachL, d: G.today, y: G.Y };
  busyOn('Simulando…');
  const r = await later(() => SE.advance(G, mode));
  busyOff(); SV.save(G, G.slot || 1); V.modal = null;
  if (r.stop === 'game' && r.days === 0 && !mode.simUser) { V.modal = { type: 'previa', game: SE.userGameOn(G) }; return render(); }
  if (r.stop === 'game') V.modal = { type: 'previa', game: SE.userGameOn(G) };
  else if (r.stop === 'draft') { V.tab = 'draft'; V.sub.draft = 'room'; toast('¡Te toca elegir en el Draft!'); }
  else if (r.stop === 'roster') V.modal = { type: 'roster' };
  else if (r.stop === 'fired') V.modal = { type: 'fired' };
  else if (r.stop === 'msg') toast('Te llegó un mensaje que pide respuesta (Buzón).');
  if (summary && !V.modal) { const w = G.stats.coachW - before.w, l = G.stats.coachL - before.l; V.modal = { type: 'skiprep', sm: true, title: 'Fechas salteadas', text: `Pasaron ${r.days} días (hasta el ${fmtDay(G.today, true)}).${w + l ? `\nTus partidos simulados: ${w} victorias y ${l} derrotas.` : ''}\nRécord: ${G.teams[G.user].w}-${G.teams[G.user].l}.${unread(G) ? `\nTenés ${unread(G)} mensajes sin leer.` : ''}` }; }
  render();
}
async function simOne(g) {
  V.modal = null; busyOn('Simulando partido…');
  await later(() => SE.simUserGame(G, g)); busyOff(); afterGame(g); 
}
async function playOne(g) {
  const S = buildSetup(g); V.modal = null; root.hidden = true;
  let res; try { res = await hooks.play(S); } catch (e) { console.error(e); res = { abandoned: true }; }
  root.hidden = false;
  if (!res || res.abandoned) { toast('Abandonaste el partido. Podés jugarlo de nuevo o simularlo.'); V.modal = { type: 'previa', game: g }; return render(); }
  const mineH = g.h === G.user, ids = new Set(SE.lineupFor(G, G.user).map(p => p.id)), pu = {}, po = {};
  for (const [k, v] of Object.entries(res.gpts || {})) (ids.has(k) ? pu : po)[k] = v;
  const hs = mineH ? res.scoreA : res.scoreB, as = mineH ? res.scoreB : res.scoreA;
  SE.applyPlayed(G, g, { hs, as, ot: res.ot, ptsUser: pu, ptsOpp: po });
  afterGame(g);
}
function afterGame(g) {
  SV.save(G, G.slot || 1);
  V.modal = { type: 'result', game: g };
  const nm = G.inbox.filter(m => !m.read && m.kind === 'press' && !m.done).length; if (nm) V.modal.extra = 'Hay una conferencia de prensa esperándote en el Buzón.';
  render();
}
/** Arma el objeto que entiende main.js / startGame (igual que el menú previo del partido casual). */
function buildSetup(g) {
  const user = G.user, home = g.h === user, opp = home ? g.a : g.h, tU = TEAMS.find(t => t.ab === user), tO = TEAMS.find(t => t.ab === opp);
  const mk = (ab, team) => { const lu = SE.lineupFor(G, ab).slice(0, 13); return buildRoster(team, lu.map((p, i) => toRow(p, i < 5))); };
  const homeTeam = home ? tU : tO, awayTeam = home ? tO : tU, homeKit = kitsFor(homeTeam)[0], awayKit = autoKit(awayTeam, homeKit);
  return { players: 1, humans: [{ dev: 'kb', pad: null, team: 0 }], teamA: tU, teamB: tO, kitA: home ? homeKit : awayKit, kitB: home ? awayKit : homeKit, lineupA: mk(user, tU), lineupB: mk(opp, tO),
    qLen: G.settings.qLen || 180, diff: GAME_SETTINGS.diff || 'hard', shotClock: true, fatigue: true, autoSubs: true, cam: 1, camHeight: 0, style: { ...G.tac }, ctrlSlot: 0, court: 'home', courtTeam: homeTeam };
}
