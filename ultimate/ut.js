import { TEAMS } from '../teams.js';
import * as Auth from '../auth.js';
import { CARDS, BY_ID, TIERS, tierOf, tierOfCard, isIcon, valueOf, quickSellOf, cardImg, cardsReady, fmt, POS, POS_NAME, posOf, posPenalty, teamOf, nick, logoOf, attrGroups, ensureLinked, linkInfo, linkedOf, teamRating, value, quickSell } from './ut-data.js';
import * as U from './ut-state.js';
import { playPack, packImg, warmPack } from './packs3d.js';
import { buildSetup, collectStats } from './ut-match.js';

/* ============================================================================
   Ultimate Team · pantallas. Mismo lenguaje visual que el resto del juego (azul noche + dorado, Barlow Condensed)
   y la estructura de las maquetas: INICIO · OBJETIVOS · JUGAR · TIENDA · MERCADO · PLANTILLA · MI CUENTA.
   Se abre desde el menú principal → "Ultimate Team". Los partidos se juegan en 3D (hooks.play) y devuelven el resultado.
   ========================================================================== */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TABS = [['inicio', 'INICIO'], ['objetivos', 'OBJETIVOS'], ['jugar', 'JUGAR'], ['tienda', 'TIENDA'], ['mercado', 'MERCADO'], ['plantilla', 'PLANTILLA'], ['cuenta', 'MI CUENTA']];
const QLENS = [[60, '1:00'], [120, '2:00'], [180, '3:00'], [300, '5:00']];
const POS_XY = { SF: [18, 26], C: [50, 26], PF: [82, 26], SG: [31, 74], PG: [69, 74] };      // fila de adelante (SF · C · PF) y fila de atrás (SG · PG): sin cartas superpuestas
let root = null, hooks = {}, open_ = false, tab = 'inicio', modal = null, sel = null, toastT = 0, tickT = 0, loading = false, unsub = null;
const V = { play: 'rookie', stage: 1, mk: 'buy', mkf: { q: '', pos: '', team: '', min: '', sort: 'ovr' }, mkLimit: 36, mkRows: null, mkErr: '', mkLoading: false, col: { pos: '', sort: 'ovr', q: '' } };
export const isHidden = () => !open_ || !root || root.hidden;
export const isOpen = () => open_;

/* ------------------------------ piezas ------------------------------ */
const coin = '<i class="u-coin"></i>', gem = '<i class="u-gem"></i>';
const tierK = c => tierOfCard(c).k;
const cardEl = (c, o = {}) => `<figure class="uc t-${tierK(c)}${o.cls ? ' ' + o.cls : ''}"${o.act ? ` data-act="${o.act}" data-v="${c.id}"${o.w != null ? ` data-w="${o.w}"` : ''}` : ''}><img src="${cardImg(c.id)}" alt="${esc(c.n)} ${c.o}" loading="lazy" draggable="false">${o.badge || ''}</figure>`;
const logo = (ab, c = '') => `<img class="u-logo ${c}" src="${logoOf(ab)}" alt="${ab}">`;
const bar = (p, cls = '') => `<div class="u-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, p * 100))}%"></i></div>`;
const rewardChips = r => { const o = []; if (r.coins) o.push(`<b>${fmt(r.coins)}</b>${coin}`); for (const k of r.packs || []) o.push(`<em class="pk-chip pk-${k}">${U.PACKS[k].name}</em>`); return `<span class="u-rw">${o.join('')}</span>`; };
const foil = (k, small = false) => { const p = U.PACKS[k]; warmPack(k).catch(() => {}); return `<img class="u-pkimg${small ? ' sm' : ''} pk-${k}" src="${packImg(k)}" alt="${esc(p.name)}" draggable="false" style="--a:${p.a}">`; };
function toast(t) { if (!root) return; let el = root.querySelector('.ut-toast'); if (!el) { el = document.createElement('div'); el.className = 'ut-toast'; root.appendChild(el); } el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 3200); }
const initials = s => String(s || '?').trim().slice(0, 2).toUpperCase();

/** Cada 15 s: vence/vende lo simulado (invitados) y, con cuenta, cobra / recupera lo del mercado online. */
function tickFn() {
  const m = U.settleMarket(); U.tick();
  if (m.length) { toast(m[0] + (m.length > 1 ? ` (+${m.length - 1} más)` : '')); if (root && !root.hidden) softRender(); }
  U.syncMarket().then(mm => { if (mm.length && open_) { toast(mm[0] + (mm.length > 1 ? ` (+${mm.length - 1} más)` : '')); if (!root.hidden) softRender(); } });
}

/* ------------------------------ abrir / cerrar ------------------------------ */
export async function open(h) {
  hooks = h || {}; root = $('ut'); open_ = true; root.hidden = false; loading = true; modal = null; sel = null; tab = 'inicio'; render();
  if (!root._bound) { root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('input', onInput); root._bound = true; }
  try { await Promise.all([U.init(), cardsReady]); } catch (e) { console.error(e); }
  loading = false; unsub?.(); unsub = U.subscribe(() => paintWallet());
  ensureLinked().then(() => { if (open_) paintLink(); }).catch(() => {});
  clearInterval(tickT); tickT = setInterval(tickFn, 15000);
  U.syncMarket().then(m => { if (m.length && open_) { toast(m[0] + (m.length > 1 ? ` (+${m.length - 1} más)` : '')); render(); } });
  const dn = U.takeDone(); if (dn.length) toast('Objetivo completado: ' + dn[0]);
  render();
}
export function close() { if (!open_) return; open_ = false; root.hidden = true; clearInterval(tickT); unsub?.(); unsub = null; U.flush(); hooks.onExit?.(); }
document.addEventListener('keydown', e => {
  if (!open_ || !root || root.hidden) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) { if (e.code === 'Escape') t.blur(); return; }
  if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); if (modal) { modal = null; render(); } else close(); }
  else if (e.code === 'BracketLeft' || e.code === 'KeyQ') stepTab(-1); else if (e.code === 'BracketRight' || e.code === 'KeyE') stepTab(1);
}, true);
const stepTab = d => { if (modal) return; const i = TABS.findIndex(t => t[0] === tab); tab = TABS[(i + d + TABS.length) % TABS.length][0]; render(); };
/** El main.js le pasa el joystick mientras esta pantalla está abierta: LB / RB cambian de pestaña. */
export function saveNow() { try { U.flush(); } catch (e) { console.warn('No se pudo guardar Ultimate', e); } }
export function onPad(P) { if (!open_ || root.hidden || !P?.connected) return; if (P.nav?.lb) stepTab(-1); else if (P.nav?.rb) stepTab(1); }

/* ------------------------------ render ------------------------------ */
function render() {
  if (!root) return;
  const y = root.querySelector('.ut-main')?.scrollTop || 0, ys = root.querySelector('.ut-side')?.scrollTop || 0;
  if (loading || !U.get()) { root.innerHTML = '<div class="ut-load"><b>ULTIMATE TEAM</b><span>Cargando tu club…</span></div>'; return; }
  root.innerHTML = topHTML() + `<main class="ut-main ut-${tab}">${({ inicio, objetivos, jugar, tienda, mercado, plantilla, cuenta }[tab])()}</main>` + footHTML() + (modal ? modalHTML() : '');
  const m = root.querySelector('.ut-main'); if (m) m.scrollTop = y; const sd = root.querySelector('.ut-side'); if (sd) sd.scrollTop = ys;
  if (tab === 'mercado' && V.mk === 'buy' && U.marketOnline() && V.mkRows === null && !V.mkLoading) loadRows();
}
async function loadRows() {
  V.mkLoading = true; V.mkErr = '';
  try { V.mkRows = await U.marketRows(); } catch (e) { V.mkRows = []; V.mkErr = e.message; }
  V.mkLoading = false;
  if (open_ && tab === 'mercado' && V.mk === 'buy') { const g = $('mkGrid'); if (g) g.innerHTML = mkGrid(); else render(); }
}
const softRender = render;
function paintWallet() { const el = root?.querySelector('.ut-wallet'); if (el && U.get()) el.outerHTML = walletHTML(); }
function paintLink() { const el = root?.querySelector('[data-link]'); if (el) el.textContent = linkText(); }
const linkText = () => { const l = linkInfo(); return l.db ? `${l.linked} de ${l.total} cartas conectadas con jugadores de la base` : 'Sin conexión con la base: se usan atributos estimados desde la media de cada carta'; };

function walletHTML() {
  const S = U.get(), lv = U.LVL(S.xp), a = U.xpFor(lv), b = U.xpFor(lv + 1), p = Auth.getProfile();
  return `<div class="ut-wallet"><div class="ut-user"><span class="av">${esc(initials(S.club.name.replace(/^Club de /, '') || p?.username))}</span><div><b>${esc(S.club.name)}</b><small>Nivel ${lv}</small>${bar((S.xp - a) / (b - a), 'xp')}</div></div><div class="ut-cur">${coin}<b>${fmt(S.coins)}</b></div></div>`;
}
function topHTML() {
  const S = U.get(), cl = U.claimable(), sp = S.packs.length;
  return `<header class="ut-top"><div class="ut-brand"><b>MORENO GAMES</b><span>ULTIMATE TEAM</span></div>
    <nav class="ut-tabs"><kbd>LB</kbd>${TABS.map(([id, n]) => `<button type="button" data-act="tab" data-v="${id}" class="${tab === id ? 'on' : ''}">${n}${id === 'objetivos' && cl ? `<i>${cl}</i>` : ''}${id === 'tienda' && sp ? `<i>${sp}</i>` : ''}</button>`).join('')}<kbd>RB</kbd></nav>${walletHTML()}</header>`;
}
function footHTML() { return `<footer class="ut-foot"><button type="button" data-act="back" class="ut-back"><kbd>ESC</kbd> Volver</button><span><kbd>Q</kbd><kbd>E</kbd> cambiar de pestaña</span><span class="ut-cloud">${{ sync: '☁ Guardado en tu cuenta', local: '💾 Guardado en este navegador', error: '⚠ No se pudo sincronizar (se guarda acá)' }[U.cloudState()] || ''}</span></footer>`; }

/* ============================== INICIO ============================== */
function inicio() {
  const S = U.get(), sq = U.squadCards(), own = U.ownedCards().sort((a, b) => b.o - a.o), top = own.slice(0, 3), ev = U.EVENT, dl = U.activeObjectives().filter(o => o.g === 'daily');
  const fan = top.length ? `${top[1] ? cardEl(top[1], { cls: 'fan l' }) : ''}${cardEl(top[0], { cls: 'fan c', act: 'card' })}${top[2] ? cardEl(top[2], { cls: 'fan r' }) : ''}` : '';
  const evDone = S.ev.pts >= ev.target;
  return `<div class="home">
    <section class="hero"><div class="hero-bg"></div><div class="hero-t"><h1>TU CAMINO<br><span>A LA CIMA</span></h1><p>Construí tu equipo. Competí. Dominá la cancha.</p><button type="button" class="u-btn gold big" data-act="tab" data-v="jugar">JUGAR AHORA <i>›</i></button></div><div class="hero-cards">${fan}</div></section>
    <section class="ev u-card"><h3>EVENTO DE LA SEMANA</h3><div class="ev-trophy"><svg viewBox="0 0 100 114" aria-hidden="true"><defs><linearGradient id="utTg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".5" stop-color="#ffc73a"/><stop offset="1" stop-color="#b9780c"/></linearGradient></defs><path d="M25 8h50v28c0 18-11 30-25 32-14-2-25-14-25-32z" fill="url(#utTg)"/><path d="M25 16H8c0 20 8 30 22 33M75 16h17c0 20-8 30-22 33" fill="none" stroke="url(#utTg)" stroke-width="6"/><rect x="44" y="68" width="12" height="18" fill="url(#utTg)"/><rect x="28" y="86" width="44" height="10" rx="3" fill="url(#utTg)"/><rect x="22" y="96" width="56" height="12" rx="3" fill="#8a5a0a"/></svg></div>
      <b class="ev-n">${ev.name.toUpperCase()}</b><div class="ev-t">⏱ Termina en: ${U.fmtLeft(U.msToWeekEnd())}</div><div class="ev-p">${bar(S.ev.pts / ev.target)}<span>${Math.min(S.ev.pts, ev.target)} / ${fmt(ev.target)} PTOS</span></div>
      ${S.ev.claimed ? '<small class="mute">Premio reclamado</small>' : evDone ? '<button type="button" class="u-btn gold" data-act="claim-ev">RECLAMAR</button>' : `<small class="mute">Premio: ${U.rewardText(ev.reward)}</small>`}</section>
    <section class="u-card sqd"><h3>TU PLANTILLA <button type="button" class="link" data-act="tab" data-v="plantilla">VER TODA ›</button></h3><div class="sqd-row">${sq.s.map(c => c ? cardEl(c, { act: 'card' }) : '<div class="uc empty">+</div>').join('')}</div></section>
    <section class="u-card pks"><h3>SOBRES DESTACADOS <button type="button" class="link" data-act="tab" data-v="tienda">TIENDA ›</button></h3><div class="pks-row">${['oro', 'elite', 'especial'].map(k => `<button type="button" class="pk-i" data-act="tab" data-v="tienda">${foil(k, true)}<span>${U.PACKS[k].name.toUpperCase()}</span></button>`).join('')}</div></section>
    <section class="u-card dly"><h3>OBJETIVOS DIARIOS <button type="button" class="link" data-act="tab" data-v="objetivos">VER TODOS ›</button></h3>${dl.map(o => `<div class="dly-r"><div><span>${esc(o.t)}</span>${bar(U.progOf(o) / o.n)}</div><em>${U.progOf(o)} / ${o.n}</em>${rewardChips(o.r)}</div>`).join('')}</section>
    <section class="modes"><h3>MODOS DE JUEGO</h3>${['rookie', 'dream', 'allstar', 'squad'].map(k => `<button type="button" class="mode-t m-${k}" data-act="gomode" data-v="${k}"><b>${U.MODE_NAME[k].toUpperCase()}</b><i>›</i></button>`).join('')}</section></div>`;
}

/* ============================== OBJETIVOS ============================== */
function objRow(o) {
  const p = U.progOf(o), done = p >= o.n, cl = U.isClaimed(o);
  return `<div class="obj${done ? ' done' : ''}${cl ? ' claimed' : ''}"><div class="obj-t"><b>${esc(o.t)}</b>${bar(p / o.n)}<small>${p} / ${o.n}</small></div>${rewardChips(o.r)}${cl ? '<span class="ok">✓ RECLAMADO</span>' : `<button type="button" class="u-btn${done ? ' gold' : ''}" data-act="claim-obj" data-v="${o.id}" ${done ? '' : 'disabled'}>RECLAMAR</button>`}</div>`;
}
function objetivos() {
  const A = U.activeObjectives();
  const sec = (g, t, sub) => `<section class="u-card"><h3>${t} <small>${sub}</small></h3>${A.filter(o => o.g === g).map(objRow).join('')}</section>`;
  return `<div class="obj-page">${sec('daily', 'OBJETIVOS DIARIOS', `se renuevan en ${U.fmtLeft(U.msToDayEnd())}`)}${sec('weekly', 'OBJETIVOS SEMANALES', `se renuevan en ${U.fmtLeft(U.msToWeekEnd())}`)}${sec('hito', 'HITOS', 'se completan una sola vez')}</div>`;
}

/* ============================== JUGAR ============================== */
const MODE_INFO = {
  rookie: ['ROOKIE BATTLES', 'Diez etapas contra rivales cada vez más duros. Superá cada una para desbloquear la siguiente y ganar premios.'],
  dream: ['DREAM LIVE', 'Escalá de la División 10 a la 1. Cada victoria suma puntos y las rachas los multiplican (2 seguidas ×2, 4 seguidas ×3); con 15 ascendés. Si perdés y bajás de 0 puntos, descendés. Premios por victorias de la semana.'],
  allstar: ['ALL-STAR LIVE', 'Pagás la entrada y jugás una clasificatoria de 5 partidos en Difícil: con 2 victorias pasás a la fase final de 10 partidos en Extremo, con premio por cada victoria.'],
  squad: ['SQUAD BATTLES', 'Elegí el nivel del rival y jugá cuando quieras. Sumá puntos semanales para premios.'],
};
function jugar() {
  const k = V.play, S = U.get();
  const sel_ = ['rookie', 'dream', 'allstar', 'squad'].map(m => `<button type="button" class="mode-c m-${m}${k === m ? ' on' : ''}" data-act="mode" data-v="${m}"><b>${MODE_INFO[m][0]}</b><small>${{ rookie: `Etapa ${S.modes.rookie.stage} de 10`, dream: `División ${S.modes.dream.div}`, allstar: S.modes.allstar.run ? (S.modes.allstar.run.phase === 'qual' ? `Clasificatoria · ${S.modes.allstar.run.qw}/${U.ALLSTAR.qual.need}` : `Fase final · ${S.modes.allstar.run.w} victorias`) : `Mejor: ${S.modes.allstar.best} victorias`, squad: `${S.modes.squad.pts} pts esta semana` }[m]}</small></button>`).join('');
  const q = U.squadCards(), ok = U.squadReady();
  const head = `<div class="mode-head"><div><h2>${MODE_INFO[k][0]}</h2><p>${MODE_INFO[k][1]}</p></div><div class="mh-sq">${bar(0)}<span>Tu media</span><b>${U.rating()}</b></div></div>${ok ? '' : '<div class="warn">Te faltan jugadores titulares. Completá tu equipo en <button type="button" class="link" data-act="tab" data-v="plantilla">PLANTILLA</button> (o usá “Autoarmar”).</div>'}`;
  return `<div class="play"><div class="mode-row">${sel_}</div><section class="u-card mode-body">${head}${modeBody(k)}</section></div>`;
}
function modeBody(k) {
  const S = U.get(), M = S.modes;
  if (k === 'rookie') {
    return `<div class="stages">${U.ROOKIE.map(s => { const st = M.rookie.stars[s.n] || 0, lock = s.n > M.rookie.stage, on = V.stage === s.n; return `<button type="button" class="stage${st ? ' done' : ''}${lock ? ' lock' : ''}${on ? ' on' : ''}" data-act="stage" data-v="${s.n}" ${lock ? 'disabled' : ''}><b>${s.n}</b><span>${lock ? '🔒' : '★'.repeat(st) + '☆'.repeat(3 - st)}</span><small>Rival ${s.rating}</small></button>`; }).join('')}</div>
      ${(() => { const s = U.ROOKIE[V.stage - 1], first = !(M.rookie.stars[V.stage] > 0); return `<div class="stage-info"><div><h3>ETAPA ${s.n}</h3><p>Rival: media ${s.rating} · Dificultad ${s.diff === 'easy' ? 'Fácil' : 'Difícil'}</p><p class="mute">${first ? 'Premio por superarla la primera vez:' : 'Ya la superaste (repetirla paga solo las monedas del partido):'} ${first ? rewardChips({ coins: s.coins, packs: s.packs }) : ''}</p></div><button type="button" class="u-btn gold big" data-act="play-rookie" ${U.squadReady() ? '' : 'disabled'}>JUGAR ETAPA ${s.n}</button></div>`; })()}`;
  }
  if (k === 'dream') {
    const d = M.dream, w = U.DREAM.weekly, D = U.DREAM, P = U.MATCH_PAY, st = d.streak || 0, nx = D.mult(st + 1);
    const afterW = d.pts + D.win * nx, afterL = d.pts - D.loss;
    const winTxt = afterW >= D.perDiv ? (d.div > 1 ? `¡Ascendés a la División ${d.div - 1}!` : 'Te quedás en la División 1') : `Quedás en ${afterW} / ${D.perDiv}`;
    const lossTxt = afterL < 0 ? (d.div < D.lowest ? `Descendés a la División ${d.div + 1}` : 'Quedás en 0 (la 10 no baja)') : `Quedás en ${afterL} / ${D.perDiv}`;
    const ladder = Array.from({ length: 10 }, (_, i) => { const n = 10 - i; return `<i class="${n === d.div ? 'cur' : n > d.div ? 'past' : ''}">${n}</i>`; }).join('');
    const slots = [1, 2, 2, 3].map((m, i) => `<i class="${st > i ? 'on' : ''}${st === i ? ' nx' : ''}">×${m}</i>`).join('');
    return `<div class="dl">
      <section class="dl-top">
        <div class="div-badge"><small>DIVISIÓN</small><b>${d.div}</b></div>
        <div class="dl-pts"><div class="row"><b class="dl-t">PUNTOS DE LA DIVISIÓN</b><span class="dl-n">${d.pts} <small>/ ${D.perDiv}</small></span></div>
          <div class="dl-bar"><i style="width:${Math.min(100, d.pts / D.perDiv * 100)}%"></i></div>
          <div class="dl-ends"><span class="dn">0 = zona de descenso</span><span class="up">${D.perDiv} = ascenso</span></div>
          <div class="dl-lad">${ladder}</div>
          <p class="mute">Rival de media ${D.ratingOf(d.div)} · esta semana ${d.w} victorias y ${d.l} derrotas</p></div>
        <div class="dl-play"><div class="dl-if win"><small>SI GANÁS</small><b>+${D.win * nx} pts${nx > 1 ? ` (×${nx})` : ''}</b><span>${winTxt}</span></div><div class="dl-if loss"><small>SI PERDÉS</small><b>−${D.loss} pts</b><span>${lossTxt}</span></div>
          <button type="button" class="u-btn gold big" data-act="play-dream" ${U.squadReady() ? '' : 'disabled'}>JUGAR PARTIDO</button></div>
      </section>
      <h3 class="sub">CÓMO FUNCIONA</h3>
      <div class="how">
        <div class="how-c"><b>1 · SUMÁS PUNTOS</b><p>Cada victoria da <em class="g">+${D.win} pts</em>. Cada derrota resta <em class="r">−${D.loss} pts</em>.</p></div>
        <div class="how-c"><b>2 · RACHAS</b><p>2 victorias seguidas = puntos <em class="g">×2</em>. 4 seguidas = <em class="g">×3</em>. Perder corta la racha.</p><div class="slots">${slots}</div><small>Racha actual: <b>${st}</b></small></div>
        <div class="how-c"><b>3 · ASCENSO</b><p>Con <em class="g">${D.perDiv} puntos</em> subís de división: rival más duro, sobre y ${fmt(1000)} monedas de premio.</p></div>
        <div class="how-c"><b>4 · DESCENSO</b><p>Si bajás de <em class="r">0 puntos</em> descendés a la división de abajo (empezás con ${D.relegPts}). La División ${D.lowest} no baja.</p></div>
        <div class="how-c"><b>5 · POR CADA PARTIDO</b><p>Terminarlo paga <em class="g">${fmt(P.play)}</em> ${coin} y ganarlo <em class="g">${fmt(P.win)}</em> ${coin}.</p></div>
      </div>
      <h3 class="sub">PREMIOS DE LA SEMANA <small>por victorias · se renuevan en ${U.fmtLeft(U.msToWeekEnd())}</small></h3><div class="track">${w.map(([n, r], i) => weeklyTile('dream', i, n, r, d.w, d.claimed.includes(i), 'victorias')).join('')}</div></div>`;
  }
  if (k === 'allstar') {
    const a = M.allstar, run = a.run, A = U.ALLSTAR, P = U.MATCH_PAY, inQ = run?.phase === 'qual', inM = run?.phase === 'main', won = inM ? run.w : 0;
    const pips = (h, total) => Array.from({ length: total }, (_, i) => `<i class="${h[i] === 'w' ? 'w' : h[i] === 'l' ? 'l' : i === h.length ? 'nx' : ''}">${h[i] === 'w' ? '✓' : h[i] === 'l' ? '✕' : i + 1}</i>`).join('');
    const qh = run?.qh || [], mh = run?.mh || [], ok = U.squadReady() ? '' : 'disabled';
    const cta = !run
      ? `<div><h3>ENTRAR AL ALL-STAR · ${fmt(A.fee)} MONEDAS</h3><p class="mute">Pagás la entrada una vez y jugás las dos etapas. <b>Entradas de hoy: ${U.allstarLeft()} de ${A.perDay}</b> (máximo ${A.perDay} por día). Cada partido, además, paga ${fmt(P.play)} ${coin} por terminarlo y ${fmt(P.win)} ${coin} si lo ganás.</p></div><button type="button" class="u-btn gold big" data-act="as-enter" ${S.coins >= A.fee && U.squadReady() && U.allstarLeft() > 0 ? '' : 'disabled'}>ENTRAR · ${fmt(A.fee)} ${coin}</button>`
      : inQ ? `<div><h3>ESTÁS EN LA CLASIFICATORIA</h3><p class="mute">Llevás <b>${run.qw} de ${A.qual.need}</b> victorias necesarias · ${run.ql} derrota${run.ql === 1 ? '' : 's'} · quedan ${A.qual.games - run.qg} partidos.</p></div><button type="button" class="u-btn gold big" data-act="play-allstar" ${ok}>JUGAR CLASIFICATORIA ${run.qg + 1} DE ${A.qual.games}</button>`
        : `<div><h3>ESTÁS EN LA FASE FINAL</h3><p class="mute">${run.w} victoria${run.w === 1 ? '' : 's'} · ${run.l} derrota${run.l === 1 ? '' : 's'} · quedan ${A.main.games - run.g} partidos. Cada victoria cobra su premio al instante.</p></div><button type="button" class="u-btn gold big" data-act="play-allstar" ${ok}>JUGAR PARTIDO ${run.g + 1} DE ${A.main.games}</button>`;
    const ladder = A.rewards.map((r, i) => `<div class="as-tile${won > i ? ' claimed' : ''}${inM && won === i ? ' now' : ''}"><small>VICTORIA</small><b>${i + 1}</b>${rewardChips(r)}${won > i ? '<span class="tick">✓</span>' : ''}</div>`).join('');
    return `<div class="as">
      <section class="as-cta${run ? ' live' : ''}">${cta}</section>
      <div class="as-flow">
        <section class="as-stage${inQ ? ' act' : ''}${inM ? ' done' : ''}">
          <div class="as-sh"><span class="as-n">1</span><div><h4>CLASIFICATORIA</h4><small>${A.qual.games} partidos · dificultad <b>DIFÍCIL</b></small></div>${inM ? '<em class="as-badge">✓ CLASIFICADO</em>' : ''}</div>
          <div class="pips">${pips(qh, A.qual.games)}</div>
          <p class="as-rule">Ganá <b>${A.qual.need}</b> de los ${A.qual.games} partidos para pasar a la fase final. Apenas llegás a ${A.qual.need} victorias ya clasificás.</p>
          <div class="as-line"><span>Si clasificás</span>${rewardChips(A.qual.reward)}</div>
          <div class="as-line bad"><span>Si no clasificás</span>${rewardChips(A.qual.consolation)}<small>(perdés la entrada)</small></div>
        </section>
        <div class="as-arrow">›</div>
        <section class="as-stage${inM ? ' act' : ''}${inQ ? ' lock' : ''}">
          <div class="as-sh"><span class="as-n">2</span><div><h4>FASE FINAL</h4><small>${A.main.games} partidos · dificultad <b class="xt">EXTREMO</b></small></div></div>
          <div class="pips">${pips(mh, A.main.games)}</div>
          <p class="as-rule">Se juegan los ${A.main.games} partidos, ganes o pierdas. <b>Cada victoria te da un premio</b>, cada vez mejor.</p>
        </section>
      </div>
      <h3 class="sub">PREMIO POR CADA VICTORIA DE LA FASE FINAL <small>${inQ || !run ? 'se desbloquea al clasificar' : `${won} de ${A.main.games} cobradas`}</small></h3>
      <div class="as-ladder${inQ || !run ? ' lock' : ''}">${ladder}</div></div>`;
  }
  const q = M.squad;
  return `<div class="sb-grid">${U.SQUADB.levels.map(l => `<div class="sb-l"><h3>${l.name.toUpperCase()}</h3><b>${l.rating}</b><small>media del rival</small>${rewardChips({ coins: l.coins })}<small class="mute">+${l.pts} pts semanales</small><button type="button" class="u-btn gold" data-act="play-squad" data-v="${l.id}" ${U.squadReady() ? '' : 'disabled'}>JUGAR</button></div>`).join('')}</div>
    <h3 class="sub">PREMIOS DE LA SEMANA <small>${q.pts} puntos · ${q.played} partidos · se renuevan en ${U.fmtLeft(U.msToWeekEnd())}</small></h3><div class="track">${U.SQUADB.weekly.map(([n, r], i) => weeklyTile('squad', i, n, r, q.pts, q.claimed.includes(i), 'puntos')).join('')}</div>`;
}
const weeklyTile = (kind, i, n, r, have, claimed, unit) => `<div class="wk${have >= n ? ' ok' : ''}${claimed ? ' cl' : ''}"><b>${n}</b><small>${unit}</small>${rewardChips(r)}${claimed ? '<span class="ok">✓</span>' : `<button type="button" class="u-btn sm${have >= n ? ' gold' : ''}" data-act="claim-wk" data-v="${kind}" data-w="${i}" ${have >= n ? '' : 'disabled'}>RECLAMAR</button>`}</div>`;

/* ============================== TIENDA ============================== */
function tienda() {
  const S = U.get(), K = ['rookie', 'oro', 'elite', 'especial'];
  const mine = S.packs.length ? `<section class="u-card"><h3>MIS SOBRES <small>${S.packs.length} sin abrir</small></h3><div class="mypk">${S.packs.map(p => `<div class="mypk-i">${foil(p.kind, true)}<small>${p.tr ? 'Transferible' : 'Intransferible'}</small><button type="button" class="u-btn gold sm" data-act="open-stored" data-v="${p.id}">ABRIR</button></div>`).join('')}</div></section>` : '';
  return `<div class="shop">${mine}<section class="u-card"><h3>SOBRES <small>las cartas salen de las ${CARDS.length} del juego</small></h3><div class="shelf">${K.map(k => { const p = U.PACKS[k], can = (S[p.cur] || 0) >= p.cost; return `<article class="pk">${foil(k).replace('u-pkimg', 'u-pkimg big')}<b class="pk-nm">${esc(p.name.replace('Pack ', ''))}</b><small class="pk-meta">${p.n} cartas${p.min ? ` · ${p.min}+ asegurada` : ''} · ${p.tr ? 'Transferible' : 'Intransferible'}</small><div class="odds">Walkout (86+): <b>${U.packChance(p, 3)}%</b> por sobre<br>Leyenda (95+): <b>${U.packChance(p, 5)}%</b><br>Ícono: <b class="ico">${p.pr[6] ? (U.iconChance(p) < 1 ? 'menos del 1%' : U.iconChance(p) + '%') : 'no sale'}</b></div><button type="button" class="u-btn gold" data-act="buy-pack" data-v="${k}" ${can ? '' : 'disabled'}>COMPRAR · ${fmt(p.cost)} ${coin}</button></article>`; }).join('')}</div></section></div>`;
}

/* ============================== MERCADO ============================== */
function mercado() {
  const S = U.get(), t = V.mk;
  const tabs = `<div class="subtabs">${[['buy', 'COMPRAR'], ['mine', `MIS VENTAS (${S.mkt.length}/${U.mktSlots()})`], ['sell', 'VENDER']].map(([id, n]) => `<button type="button" data-act="mk" data-v="${id}" class="${t === id ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  if (t === 'buy') {
    const f = V.mkf, on = U.marketOnline();
    return `${tabs}<div class="filters"><input type="search" data-f="q" placeholder="Buscar jugador o equipo…" value="${esc(f.q)}"><select data-f="pos"><option value="">Todas las posiciones</option>${POS.map(p => `<option ${f.pos === p ? 'selected' : ''}>${p}</option>`).join('')}</select><select data-f="team"><option value="">Todos los equipos</option>${TEAMS.map(x => `<option value="${x.ab}" ${f.team === x.ab ? 'selected' : ''}>${x.name}</option>`).join('')}</select><select data-f="min"><option value="">Media mínima</option>${[70, 76, 80, 86, 90, 95].map(n => `<option ${String(f.min) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select><select data-f="sort">${[['ovr', 'Mayor media'], ['pa', 'Precio ↑'], ['pd', 'Precio ↓']].map(([v, n]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${n}</option>`).join('')}</select>${on ? '<button type="button" class="u-btn sm" data-act="mk-refresh">↻ ACTUALIZAR</button>' : ''}</div>${on ? '<p class="mute">Mercado online: las cartas las publican otros jugadores. Al vender se cobra 5%.</p>' : ''}<div id="mkGrid">${mkGrid()}</div>`;
  }
  if (t === 'mine') {
    return `${tabs}<section class="u-card"><h3>CARTAS EN VENTA <small>se cobra ${Math.round(U.MKT_TAX * 100)}% al venderse · duran ${U.mktHours()} h</small></h3>${S.mkt.length ? S.mkt.map(l => { const c = BY_ID.get(l.id), left = l.online ? l.exp - Date.now() : U.MKT_HOURS * 3600000 - (Date.now() - l.t0), est = l.online ? 0 : U.sellMinutes(c, l.price, l.r) * 60000 - (Date.now() - l.t0); return `<div class="lst">${cardEl(c, { cls: 'sm' })}<div class="lst-t"><b>${esc(c.n)}</b><small>${c.o} · ${posOf(c)} · ${nick(c.t)}</small></div><div class="lst-p">${fmt(l.price)} ${coin}<small>Cobrás ${fmt(Math.round(l.price * (1 - U.MKT_TAX)))}</small></div><div class="lst-e"><small>Vence en ${U.fmtLeft(left)}</small><small>${l.online ? 'Esperando comprador' : est <= 0 ? 'Está por venderse' : `Venta estimada: ${fmtMin(est / 60000)}`}</small></div><button type="button" class="u-btn sm" data-act="mk-cancel" data-v="${l.uid}">RETIRAR</button></div>`; }).join('') : '<p class="mute">No tenés cartas en venta. Elegí una en la pestaña VENDER.</p>'}</section>`;
  }
  const own = U.ownedCards().filter(c => U.listable(c.id) > 0).sort((a, b) => b.o - a.o);
  const others = U.ownedCards().filter(c => U.sellable(c.id) > 0 && U.listable(c.id) < 1).length;
  return `${tabs}<section class="u-card"><h3>TUS CARTAS TRANSFERIBLES <small>tocá una para venderla</small></h3>${own.length ? `<div class="cgrid">${own.map(c => cardEl(c, { act: 'sell', badge: U.qty(c.id) > 1 ? `<span class="q">x${U.qty(c.id)}</span>` : '' })).join('')}</div>` : '<p class="mute">No tenés cartas para vender: las del equipo y las que vinieron de sobres intransferibles no se pueden mandar al mercado (sí se pueden vender rápido desde la ficha).</p>'}${others ? `<small class="mute">${others} carta(s) más solo admiten venta rápida.</small>` : ''}</section>`;
}
const cheapest = id => { const l = (V.mkRows || []).filter(r => r.card_id === id).map(r => r.price); return l.length ? Math.min(...l) : 0; };
const sellInfo = (c, p) => `Cobrás ${fmt(Math.round(p * (1 - U.MKT_TAX)))} (${Math.round(U.MKT_TAX * 100)}% de comisión) · ` + (U.marketOnline()
  ? (cheapest(c.id) ? `la más barata publicada hoy está a ${fmt(cheapest(c.id))}` : 'la compra otro jugador (abrí COMPRAR para ver precios de otras publicaciones)') : fmtMin(U.sellMinutes(c, p)));
const fmtMin = m => (m < 1 ? 'menos de 1 min' : m < 90 ? `~${Math.round(m)} min` : m < 60 * 36 ? `~${Math.round(m / 60)} h` : 'más de un día (no se va a vender)');
function mkList() {
  const f = V.mkf, q = f.q.trim().toLowerCase();
  let L = CARDS.filter(c => U.onSale(c) && (!f.pos || posOf(c) === f.pos) && (!f.team || c.t === f.team) && (!f.min || c.o >= +f.min) && (!q || c.n.toLowerCase().includes(q) || teamOf(c.t).name.toLowerCase().includes(q)));
  L = L.map(c => ({ c, p: U.mktPrice(c) })); L.sort(f.sort === 'pa' ? (a, b) => a.p - b.p : f.sort === 'pd' ? (a, b) => b.p - a.p : (a, b) => b.c.o - a.c.o || a.p - b.p);
  return L;
}
function mkGridOnline() {
  if (V.mkErr) return `<p class="mute pad">${esc(V.mkErr)}</p>`;
  if (!V.mkRows) return '<p class="mute pad">Cargando mercado…</p>';
  const f = V.mkf, q = f.q.trim().toLowerCase(), me = Auth.getProfile()?.id, S = U.get();
  let L = V.mkRows.map(r => ({ r, c: BY_ID.get(r.card_id) })).filter(({ r, c }) => c && (!f.pos || posOf(c) === f.pos) && (!f.team || c.t === f.team) && (!f.min || c.o >= +f.min)
    && (!q || c.n.toLowerCase().includes(q) || teamOf(c.t).name.toLowerCase().includes(q) || String(r.seller_name || '').toLowerCase().includes(q)));
  L.sort(f.sort === 'pa' ? (a, b) => a.r.price - b.r.price : f.sort === 'pd' ? (a, b) => b.r.price - a.r.price : (a, b) => b.c.o - a.c.o || a.r.price - b.r.price);
  if (!L.length) return '<p class="mute pad">No hay cartas publicadas con esos filtros. Cuando otros jugadores publiquen, aparecen acá.</p>';
  const show = L.slice(0, V.mkLimit);
  return `<div class="cgrid mk">${show.map(({ r, c }) => { const own = me && r.seller === me; return `<div class="mk-i">${cardEl(c, { act: 'card', badge: U.qty(c.id) ? `<span class="q">x${U.qty(c.id)}</span>` : '' })}<small class="mk-s">${esc(r.seller_name || '—')} · ${U.fmtLeft(Date.parse(r.expires_at) - Date.now())}</small><button type="button" class="u-btn sm gold" data-act="mk-buy-on" data-v="${r.id}" ${own || S.coins < r.price ? 'disabled' : ''}>${own ? 'TUYA' : `${fmt(r.price)} ${coin}`}</button></div>`; }).join('')}</div>${L.length > show.length ? `<div class="more"><button type="button" class="u-btn" data-act="mk-more">VER MÁS (${L.length - show.length})</button></div>` : ''}<small class="mute">${L.length} cartas publicadas por jugadores · tocá ↻ para actualizar</small>`;
}
function mkGrid() {
  if (U.marketOnline()) return mkGridOnline();
  const L = mkList(), S = U.get(), show = L.slice(0, V.mkLimit);
  if (!L.length) return '<p class="mute pad">No hay cartas con esos filtros ahora. El mercado cambia todos los días.</p>';
  return `<div class="cgrid mk">${show.map(({ c, p }) => `<div class="mk-i">${cardEl(c, { act: 'card', badge: U.qty(c.id) ? `<span class="q">x${U.qty(c.id)}</span>` : '' })}<button type="button" class="u-btn sm gold" data-act="mk-buy" data-v="${c.id}" ${S.coins >= p ? '' : 'disabled'}>${fmt(p)} ${coin}</button></div>`).join('')}</div>${L.length > show.length ? `<div class="more"><button type="button" class="u-btn" data-act="mk-more">VER MÁS (${L.length - show.length})</button></div>` : ''}<small class="mute">${L.length} cartas a la venta hoy · precios del ${esc(U.marketDay())}</small>`;
}

/* ============================== PLANTILLA ============================== */
function slotHTML(g, i, c, label, pos) {
  const on = sel && sel.g === g && sel.i === i, pen = c && g === 's' ? posPenalty(posOf(c), pos) : 0;
  return `<div class="slot ${g}${on ? ' on' : ''}${c ? '' : ' empty'}" data-act="slot" data-v="${g}" data-w="${i}" style="${g === 's' ? `left:${POS_XY[pos][0]}%;top:${POS_XY[pos][1]}%` : ''}">${c ? cardEl(c) + (pen ? `<span class="pen">−${pen}</span>` : '') : '<span class="plus">+</span>'}<em>${label}${c ? ` · ${c.o - pen}` : ''}</em></div>`;
}
function plantilla() {
  const q = U.squadCards(), S = U.get(), r = U.rating(), f = V.col;
  const court = `<div class="court"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="1.5" y="1.5" width="97" height="97" rx="2" fill="none"/><path d="M40 1.5v-0M42 4.5h16" fill="none"/><rect x="35" y="1.5" width="30" height="36" fill="none"/><path d="M35 37.5a15 15 0 0 0 30 0" fill="none"/><path d="M13 1.5v24C13 76 87 76 87 25V1.5" fill="none"/><path d="M38 98.5a12 12 0 0 1 24 0" fill="none"/><circle cx="50" cy="8" r="1.8" fill="none"/></svg></svg>${POS.map((p, i) => slotHTML('s', i, q.s[i], p, p)).join('')}</div>`;
  const bench = `<div class="bench"><h4>BANCO</h4><div class="bench-row">${q.b.map((c, i) => slotHTML('b', i, c, `S${i + 1}`, c ? posOf(c) : '')).join('')}</div></div>`;
  let cards = U.ownedCards();
  const qq = f.q.trim().toLowerCase(); if (qq) cards = cards.filter(c => c.n.toLowerCase().includes(qq) || teamOf(c.t).name.toLowerCase().includes(qq));
  if (f.pos) cards = cards.filter(c => posOf(c) === f.pos);
  const need = sel && sel.g === 's' ? POS[sel.i] : null;
  cards.sort(f.sort === 'team' ? (a, b) => a.t.localeCompare(b.t) || b.o - a.o : need ? (a, b) => (b.o - posPenalty(posOf(b), need)) - (a.o - posPenalty(posOf(a), need)) : (a, b) => b.o - a.o);
  const col = `<aside class="ut-side u-card"><h3>COLECCIÓN <small>${cards.length} cartas</small></h3><div class="filters"><input type="search" data-cf="q" placeholder="Buscar…" value="${esc(f.q)}"><select data-cf="pos"><option value="">Todas</option>${POS.map(p => `<option ${f.pos === p ? 'selected' : ''}>${p}</option>`).join('')}</select><select data-cf="sort">${[['ovr', 'Media'], ['team', 'Equipo']].map(([v, n]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>${sel ? `<div class="hint">Elegí una carta para ${sel.g === 's' ? `el casillero ${POS[sel.i]}` : `el banco ${sel.i + 1}`} <button type="button" class="link" data-act="slot-clear">VACIAR</button></div>` : '<div class="hint">Tocá un casillero para cambiarlo, o una carta para ver su ficha.</div>'}<div class="cgrid">${cards.map(c => cardEl(c, { act: 'pick', badge: (U.inSquad(c.id) ? '<span class="in">EN EL EQUIPO</span>' : '') + (U.qty(c.id) > 1 ? `<span class="q">x${U.qty(c.id)}</span>` : '') })).join('')}</div></aside>`;
  return `<div class="squad"><section class="sq-main"><div class="sq-head"><div class="sq-r"><small>MEDIA DEL EQUIPO</small><b>${r}</b></div><div class="sq-club">${logo(S.club.team)}<div><b>${esc(S.club.name)}</b><small>Camiseta y cancha de ${teamOf(S.club.team).name}</small></div></div><button type="button" class="u-btn gold" data-act="auto">AUTOARMAR</button></div>${court}${bench}</section>${col}</div>`;
}

/* ============================== MI CUENTA ============================== */
function cuenta() {
  const S = U.get(), st = S.stats, lv = U.LVL(S.xp), p = Auth.getProfile(), own = Object.keys(S.col).length;
  const tiers = TIERS.map(t => { const all = CARDS.filter(c => tierOfCard(c) === t), have = all.filter(c => S.col[c.id]).length; return `<div class="tr"><span style="color:${t.col}">${t.name}</span>${bar(all.length ? have / all.length : 0, 't-' + t.k)}<em>${have} / ${all.length}</em></div>`; }).join('');
  return `<div class="acct"><section class="u-card"><h3>MI CLUB</h3><label class="fld">Nombre del club<input type="text" maxlength="24" value="${esc(S.club.name)}" data-act-input="club-name"></label><div class="fld"><span>Camiseta y cancha</span><button type="button" class="club-pick" data-act="club-team">${logo(S.club.team)}<b>${esc(teamOf(S.club.team).name)}</b><i>CAMBIAR</i></button></div><label class="fld">Duración de cada cuarto<select data-act-change="qlen">${QLENS.map(([s, n]) => `<option value="${s}" ${S.set.q === s ? 'selected' : ''}>${n} min</option>`).join('')}</select></label><small class="mute">Usuario: ${esc(p?.username || 'Invitado')} · Nivel ${lv} · ${fmt(S.xp)} XP</small></section>
    <section class="u-card"><h3>ESTADÍSTICAS</h3><div class="stat-grid">${[['Partidos', st.p], ['Victorias', st.w], ['Derrotas', st.l], ['Puntos', fmt(st.pts)], ['Sobres abiertos', st.pk], ['Walkouts', st.wo], ['Compras', st.bought], ['Ventas', st.sold]].map(([n, v]) => `<div><b>${v}</b><small>${n}</small></div>`).join('')}</div></section>
    <section class="u-card"><h3>COLECCIÓN <small>${own} de ${CARDS.length} cartas distintas</small></h3>${tiers}<small class="mute" data-link>${linkText()}</small></section>
    <section class="u-card"><h3>DATOS</h3><p class="mute">Tu progreso se guarda en este navegador${Auth.configured && !Auth.isGuest() ? ' y en tu cuenta' : ''}.</p><button type="button" class="u-btn danger" data-act="reset">REINICIAR ULTIMATE TEAM</button></section></div>`;
}

/* ============================== MODALES ============================== */
function modalHTML() {
  const m = modal; let body = '', cls = '';
  if (m.type === 'prematch') {
    const pl = m.pl, S = U.get(), q = U.squadCards(), A = S.club, r = U.rating();
    const side = (name, rating, starters, lg) => `<div class="pm-side">${logo(lg)}<h3>${esc(name)}</h3><div class="pm-r"><small>MEDIA</small><b>${rating}</b></div><div class="pm-cards">${starters.map(c => c ? cardEl(c, { cls: 'sm' }) : '<div class="uc sm empty"></div>').join('')}</div></div>`;
    cls = 'wide'; body = `<h2>${esc(pl.sub)} · ${esc(pl.title)}</h2><div class="pm">${side(A.name, r, q.s, A.team)}<div class="pm-vs">VS</div>${side(pl.opp.name, pl.opp.rating, pl.opp.starters, pl.opp.team)}</div>
      <div class="pm-opt"><span>Cuarto</span>${QLENS.map(([s, n]) => `<button type="button" class="chip${pl.qLen === s ? ' on' : ''}" data-act="qlen" data-v="${s}">${n}</button>`).join('')}<span class="sp"></span><span>Dificultad: <b>${{ easy: 'Fácil', hard: 'Difícil', extreme: 'Extremo' }[pl.diff]}</b></span></div>
      <div class="m-btns"><button type="button" class="u-btn" data-act="close">CANCELAR</button><button type="button" class="u-btn gold big" data-act="kickoff">¡JUGAR!</button></div>`;
  } else if (m.type === 'result') {
    const s = m.sum, pl = m.pl, S = U.get(), aft = pl.meta.after;
    cls = 'result ' + (s.win ? 'win' : 'loss'); body = `<small>${esc(pl.sub)} · ${esc(pl.title)}</small><h1>${m.ab ? 'ABANDONASTE' : s.win ? 'VICTORIA' : 'DERROTA'}</h1>${m.ab ? '' : `<div class="score"><span>${esc(S.club.name)}</span><b>${s.sa}</b><i>-</i><b>${s.sb}</b><span>${esc(pl.opp.name)}</span></div>`}${s.ot ? `<small>${s.ot > 1 ? s.ot + ' tiempos suplementarios' : 'Tiempo suplementario'}</small>` : ''}${pl.mode === 'rookie' && s.win ? `<div class="stars">${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)}</div>` : ''}
      ${pl.mode === 'dream' && aft ? `<p>División ${aft.div} · ${aft.pts} / ${U.DREAM.perDiv} puntos${aft.streak >= 2 ? ` · 🔥 racha de ${aft.streak}` : ''}</p>` : ''}${pl.mode === 'allstar' && aft ? (aft.phase === 'qual' ? `<p>Clasificatoria: ${aft.qw} de ${U.ALLSTAR.qual.need} victorias · partido ${aft.qg} de ${U.ALLSTAR.qual.games}</p>` : `<p>Fase final: ${aft.w} victorias · ${aft.l} derrotas · partido ${aft.g} de ${U.ALLSTAR.main.games}</p>`) : ''}${s.lines.map(l => `<p class="hl">${esc(l)}</p>`).join('')}
      ${m.ab ? '' : `<div class="got">${s.rewards.map(x => `<span>${esc(x)}</span>`).join('')}</div>`}<div class="m-btns"><button type="button" class="u-btn gold" data-act="close">CONTINUAR</button>${pl.mode !== 'allstar' && !m.ab ? '<button type="button" class="u-btn" data-act="again">JUGAR DE NUEVO</button>' : ''}</div>`;
  } else if (m.type === 'pack') {
    cls = 'wide pack'; body = `<small>${esc(m.def.name)}</small><h2>TU SOBRE</h2><div class="pack-grid">${m.cards.map(c => `<div class="pk-c">${cardEl(c, { cls: c.o >= 86 ? 'wo' : '', act: 'card' })}<div class="pk-a"><button type="button" class="u-btn sm" data-act="pk-sell" data-v="${c.id}" ${U.sellable(c.id) > 0 ? '' : 'disabled'}>Vender ${fmt(quickSellOf(c))}</button>${m.tr ? `<button type="button" class="u-btn sm" data-act="sell" data-v="${c.id}" ${U.listable(c.id) > 0 ? '' : 'disabled'}>Mercado</button>` : ''}</div></div>`).join('')}</div><small class="mute">Las cartas ya están en tu colección. Lo que vendas rápido te da monedas al instante.</small><div class="m-btns"><button type="button" class="u-btn gold" data-act="close">GUARDAR TODO</button></div>`;
  } else if (m.type === 'card') {
    const c = BY_ID.get(m.id), { info, groups } = attrGroups(c), L = linkedOf(c.id), t = tierOfCard(c);
    cls = 'card-m'; body = `<div class="cm"><div class="cm-l">${cardEl(c)}<div class="cm-a"><small>Tenés ${U.qty(c.id)}${U.qty(c.id) ? '' : ' (no la tenés)'}</small>${U.qty(c.id) ? `<button type="button" class="u-btn sm" data-act="pk-sell" data-v="${c.id}" ${U.sellable(c.id) > 0 ? '' : 'disabled'}>Vender rápido · ${fmt(quickSellOf(c))}</button><button type="button" class="u-btn sm" data-act="sell" data-v="${c.id}" ${U.listable(c.id) > 0 ? '' : 'disabled'}>Vender en el mercado</button>` : ''}</div></div>
      <div class="cm-r"><h2>${esc(L?.name || c.n)}</h2><div class="cm-meta">${logo(c.t)}<span>${teamOf(c.t).name}</span><span class="chip" style="border-color:${t.col};color:${t.col}">${t.name}</span><span class="chip">${POS_NAME[posOf(c)]} · ${posOf(c)}</span><span class="chip">${c.o} OVR</span></div>
      <p class="mute">${L ? `Conectada con el jugador de la base: #${info.number} · ${Math.floor(info.heightIn / 12)}'${Math.round(info.heightIn % 12)}" · ${info.weightLb ? info.weightLb + ' lb' : 'peso sin cargar'}. Los atributos de abajo son los que se usan en el partido (ajustados a la media de la carta).` : 'Esta carta todavía no está conectada con un jugador de la base: los atributos se estiman desde su media y su posición.'}</p>
      <div class="attrs">${Object.entries(groups).map(([g, a]) => `<div><h5>${g}</h5>${a.map(([n, v]) => `<div class="at"><span>${n}</span>${bar(v / 99)}<b>${v}</b></div>`).join('')}</div>`).join('')}</div></div></div><div class="m-btns"><button type="button" class="u-btn" data-act="close">CERRAR</button></div>`;
  } else if (m.type === 'sell') {
    const c = BY_ID.get(m.id), [lo, hi] = U.priceRange(c), v = valueOf(c), p = m.price ?? v, cheap = U.marketOnline() ? cheapest(c.id) : 0;
    cls = 'sell'; body = `<h2>VENDER EN EL MERCADO</h2><div class="sell-b">${cardEl(c)}<div><b>${esc(c.n)}</b><small>${c.o} · ${posOf(c)} · ${nick(c.t)}</small><label class="fld">Precio<input type="number" data-act-input="sell-price" min="${lo}" max="${hi}" step="10" value="${p}"></label><div class="chips">${(U.marketOnline() ? [['MÍN', lo], ['MÁX', hi], ...(cheap ? [['IGUALAR', Math.min(hi, Math.max(lo, cheap))]] : [])] : [['MÍN', lo], ['JUSTO', v], ['MÁX', hi]]).map(([n, x]) => `<button type="button" class="chip" data-act="sell-set" data-v="${x}">${n} ${fmt(x)}</button>`).join('')}</div><p class="mute" id="sellInfo">${sellInfo(c, p)}</p></div></div><div class="m-btns"><button type="button" class="u-btn" data-act="close">CANCELAR</button><button type="button" class="u-btn gold" data-act="sell-go">PUBLICAR</button></div>`;
  } else if (m.type === 'club') {
    cls = 'wide'; body = `<h2>CAMISETA Y CANCHA DE TU CLUB</h2><div class="tgrid">${TEAMS.map(t => `<button type="button" class="tt${U.get().club.team === t.ab ? ' on' : ''}" data-act="club-set" data-v="${t.ab}">${logo(t.ab)}<span>${t.ab}</span></button>`).join('')}</div><div class="m-btns"><button type="button" class="u-btn" data-act="close">CERRAR</button></div>`;
  } else if (m.type === 'confirm') {
    cls = 'sm'; body = `<h2>${esc(m.title)}</h2><p>${esc(m.text)}</p><div class="m-btns"><button type="button" class="u-btn" data-act="close">CANCELAR</button><button type="button" class="u-btn danger" data-act="${m.act}">${esc(m.ok)}</button></div>`;
  } else if (m.type === 'info') {
    cls = 'sm'; body = `<h2>${esc(m.title)}</h2>${(m.lines || []).map(l => `<p class="hl">${esc(l)}</p>`).join('')}<div class="m-btns"><button type="button" class="u-btn gold" data-act="close">OK</button></div>`;
  }
  return `<div class="ut-modal"><div class="ut-sheet ${cls}">${body}</div></div>`;
}

/* ============================== acciones ============================== */
function onInput(e) {
  const t = e.target;
  if (t.dataset.f === 'q') { V.mkf.q = t.value; V.mkLimit = 36; const g = $('mkGrid'); if (g) g.innerHTML = mkGrid(); }
  else if (t.dataset.cf === 'q') { V.col.q = t.value; const y = root.querySelector('.ut-side')?.scrollTop || 0; const pos = t.selectionStart; render(); const n = root.querySelector('[data-cf="q"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } const sd = root.querySelector('.ut-side'); if (sd) sd.scrollTop = y; }
  else if (t.dataset.actInput === 'sell-price' && modal?.type === 'sell') { modal.price = Math.round(+t.value / 10) * 10 || 0; const c = BY_ID.get(modal.id); const el = $('sellInfo'); if (el) el.textContent = sellInfo(c, modal.price); }
}
function onChange(e) {
  const t = e.target;
  if (t.dataset.f) { V.mkf[t.dataset.f] = t.value; V.mkLimit = 36; if (t.dataset.f !== 'q') render(); }
  else if (t.dataset.cf) { V.col[t.dataset.cf] = t.value; if (t.dataset.cf !== 'q') render(); }
  else if (t.dataset.actInput === 'club-name') { const n = t.value.trim().slice(0, 24) || 'Mi Club'; U.setClub({ name: n }); paintWallet(); }
  else if (t.dataset.actChange === 'qlen') U.setQ(+t.value);
}
function onClick(e) {
  if (e.target.classList?.contains('ut-modal') && modal && !['prematch'].includes(modal.type)) { modal = null; render(); return; }
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const a = el.dataset.act, v = el.dataset.v, w = el.dataset.w, S = U.get();
  const done = () => { const d = U.takeDone(); if (d.length) toast('Objetivo completado: ' + d[0]); };
  switch (a) {
    case 'tab': tab = v; modal = null; render(); break;
    case 'back': close(); break;
    case 'close': modal = null; render(); break;
    case 'mode': V.play = v; render(); break;
    case 'gomode': V.play = v; tab = 'jugar'; render(); break;
    case 'stage': V.stage = +v; render(); break;
    case 'play-rookie': modal = { type: 'prematch', pl: U.planRookie(V.stage) }; render(); break;
    case 'play-dream': modal = { type: 'prematch', pl: U.planDream() }; render(); break;
    case 'play-squad': modal = { type: 'prematch', pl: U.planSquad(v) }; render(); break;
    case 'play-allstar': modal = { type: 'prematch', pl: U.planAllStar() }; render(); break;
    case 'as-enter': { const r = U.enterAllStar(); if (!r.ok) toast(r.err); else toast('¡Entraste! Primero la clasificatoria: 2 victorias en 5 partidos.'); render(); break; }
    case 'qlen': modal.pl.qLen = +v; render(); break;
    case 'kickoff': kickoff(modal.pl); break;
    case 'again': { const p0 = modal.pl, m = p0.mode; modal = null; if (m === 'rookie') modal = { type: 'prematch', pl: U.planRookie(Math.min(Math.max(V.stage, 1), U.get().modes.rookie.stage)) }; else if (m === 'dream') modal = { type: 'prematch', pl: U.planDream() }; else if (m === 'squad') modal = { type: 'prematch', pl: U.planSquad(p0.meta.lvl || 'facil') }; render(); break; }
    case 'claim-obj': { const o = U.claimObjective(v); if (o) toast('Recompensa: ' + o.join(' · ')); render(); break; }
    case 'claim-ev': { const o = U.claimEvent(); if (o) modal = { type: 'info', title: 'PREMIO DEL EVENTO', lines: o }; render(); break; }
    case 'claim-wk': { const o = U.claimWeekly(v, +w); if (o) toast('Recompensa: ' + o.join(' · ')); render(); break; }
    case 'buy-pack': { const p = U.buyPack(v); if (p) openFlow(p); else toast('No te alcanza para ese sobre.'); break; }
    case 'open-stored': { const p = U.takeStoredPack(v); if (p) openFlow(p); break; }
    case 'pk-sell': { const g = U.sellQuick(v); if (g) toast(`Vendida por ${fmt(g)} monedas`); render(); break; }
    case 'card': modal = { type: 'card', id: v }; render(); break;
    case 'sell': modal = { type: 'sell', id: v }; render(); break;
    case 'sell-set': modal.price = +v; render(); break;
    case 'sell-go': {
      const md = modal; if (md.busy) break; md.busy = true; const pr = md.price ?? valueOf(BY_ID.get(md.id));
      (async () => { const r = U.marketOnline() ? await U.listCardOnline(md.id, pr) : U.listCard(md.id, pr); md.busy = false; if (!r.ok) toast(r.err); else { toast('Carta publicada en el mercado'); modal = null; V.mk = 'mine'; tab = 'mercado'; V.mkRows = null; } render(); })();
      break;
    }
    case 'mk-buy-on': {
      const row = (V.mkRows || []).find(x => x.id === v); if (!row || el.disabled) break; el.disabled = true;
      (async () => { const r = await U.buyOnline(row); if (r.ok) { toast(`Compraste a ${BY_ID.get(r.id).n} por ${fmt(r.price)}`); done(); } else toast(r.err); V.mkRows = null; render(); })();
      break;
    }
    case 'mk-refresh': V.mkRows = null; render(); break;
    case 'mk': V.mk = v; if (v === 'buy') V.mkRows = null; render(); break;
    case 'mk-more': V.mkLimit += 36; { const g = $('mkGrid'); if (g) g.innerHTML = mkGrid(); } break;
    case 'mk-buy': { const r = U.buyMarket(v); if (r.ok) { toast(`Compraste a ${BY_ID.get(v).n} por ${fmt(r.price)}`); done(); } else toast(r.err); render(); break; }
    case 'mk-cancel': {
      const l = S.mkt.find(x => x.uid === v);
      if (l?.online) { (async () => { const r = await U.cancelOnline(v); toast(r.ok ? 'Carta retirada del mercado' : (r.msgs?.[0] || r.err)); render(); })(); }
      else { U.cancelListing(v); toast('Carta retirada del mercado'); render(); }
      break;
    }
    case 'slot': sel = sel && sel.g === v && sel.i === +w ? null : { g: v, i: +w }; render(); break;
    case 'slot-clear': if (sel) U.clearSlot(sel.g, sel.i); render(); break;
    case 'pick': if (sel) { U.place(sel.g, sel.i, v); done(); sel = null; render(); } else { modal = { type: 'card', id: v }; render(); } break;
    case 'auto': U.autoSquad(); sel = null; toast('Equipo armado con tus mejores cartas'); done(); render(); break;
    case 'club-team': modal = { type: 'club' }; render(); break;
    case 'club-set': U.setClub({ team: v }); modal = null; render(); break;
    case 'reset': modal = { type: 'confirm', title: '¿REINICIAR?', text: 'Vas a perder tu colección, monedas y progreso de Ultimate Team y empezar un club nuevo. No se puede deshacer.', ok: 'SÍ, REINICIAR', act: 'reset-go' }; render(); break;
    case 'reset-go': U.resetAll(); modal = null; sel = null; render(); break;
  }
}

/* ------------------------------ sobres ------------------------------ */
async function openFlow(pack) {
  const def = U.PACKS[pack.kind];
  const cards = U.openPack(pack).map(c => ({ ...c, pos: posOf(c) }));
  root.classList.add('opening');
  try { await playPack({ kind: pack.kind, name: def.name, n: def.n, a: def.a, b: def.b, col: def.col }, cards); } catch (e) { console.warn('No se pudo mostrar la apertura 3D:', e); }
  root.classList.remove('opening');
  modal = { type: 'pack', cards, def, tr: pack.tr }; render();
  const d = U.takeDone(); if (d.length) toast('Objetivo completado: ' + d[0]);
}

/* ------------------------------ partido ------------------------------ */
async function kickoff(pl) {
  if (!U.squadReady()) { toast('Completá tus 5 titulares en la pestaña PLANTILLA.'); return; }
  V.lastLvl = pl.meta?.lvl || V.lastLvl; modal = null; root.hidden = true; clearInterval(tickT); U.flush();
  let res = null, S0 = null, stats = {};
  try {
    S0 = await buildSetup(pl, hooks.baseSetup());
    res = await hooks.play(S0);
    if (!res?.abandoned) stats = collectStats(S0);
  } catch (e) { console.error(e); res = { error: e }; }
  root.hidden = false;
  tickT = setInterval(tickFn, 15000); tickFn();
  if (res?.error) { toast('No se pudo iniciar el partido.'); render(); return; }
  const ab = !!res?.abandoned, sum = U.finishMatch(pl, ab ? { abandoned: true } : { scoreA: res.scoreA, scoreB: res.scoreB, ot: res.ot, stats });
  modal = { type: 'result', pl, sum, ab }; render();
  const d = U.takeDone(); if (d.length) toast('Objetivo completado: ' + d[0]);
}
