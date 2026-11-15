import * as UI from './ui.js';
import * as Pad from './gamepad.js';
import { TEAMS } from './teams.js';
import { courtFor } from './courts.js';
import { loadRoster, fallbackRoster, POS, ATTRS, inchesToFtIn } from './roster.js';
import { kitsFor, kitById, kitsClash, autoKit, kitSVG, nickname, lum } from './kits.js';
import { STYLE_DEFAULT } from './ai.js';
import { fitCfg, project } from './stagecam.js';

/* ============================================================================
   Menú previo al partido, estilo FC / 2K. Se abre con "Partido casual" y tiene 5 pasos:
     1 Jugadores · 2 Equipos (local vs visitante) · 3 Camisetas (jugadores 3D) · 4 Tu equipo (quinteto en cancha + táctica) · 5 Partido
   Guarda todo en el navegador. main.js lo usa así:  PM.init({ onPlay, onExit })  ·  PM.openWizard()  ·  PM.getSetup()
   Los jugadores 3D salen de stage.js; si WebGL falla se ve una versión plana y todo sigue funcionando.
   ========================================================================== */

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const SKEY = 'basket3d_setup';
const STEPS = [
  ['Jugadores', 'Cantidad de jugadores', 'Elegí cómo vas a jugar.'],
  ['Equipos', 'Seleccioná tu equipo', 'Elegí los equipos para el partido.'],
  ['Camisetas', 'Elegí tu camiseta', 'Seleccioná el uniforme para cada equipo.'],
  ['Tu equipo', 'Armá tu equipo inicial', 'Elegí tu quinteto y la táctica del equipo.'],
  ['Partido', 'Configurá el partido', 'Ajustá las reglas y empezá a jugar.'],
];
const LAST = STEPS.length - 1;

const DEFAULTS = { players: 1, a: 'LAL', b: 'BOS', kitA: 'icon', kitB: null, qLen: 180, shotClock: true, fatigue: true, autoSubs: true, cam: 0, camHeight: 0, court: 'home', style: { ...STYLE_DEFAULT } };
const saved = (() => { try { return JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch { return {}; } })();
const teamByAb = ab => TEAMS.find(t => t.ab === ab);

const S = {
  step: 0, banner: '', focus: 'A', picker: null, card: null,
  players: 1,
  teamA: teamByAb(saved.a) || teamByAb(DEFAULTS.a), teamB: teamByAb(saved.b) || teamByAb(DEFAULTS.b),
  kitA: saved.kitA || DEFAULTS.kitA, kitB: saved.kitB || DEFAULTS.kitB,
  qLen: [60, 120, 180, 300, 480].includes(saved.qLen) ? saved.qLen : DEFAULTS.qLen,
  shotClock: saved.shotClock ?? DEFAULTS.shotClock, fatigue: saved.fatigue ?? DEFAULTS.fatigue, autoSubs: saved.autoSubs ?? DEFAULTS.autoSubs,
  cam: [0, 1, 2].includes(saved.cam) ? saved.cam : DEFAULTS.cam,
  camHeight: [-2, -1, 0, 1, 2].includes(saved.camHeight) ? saved.camHeight : 0,
  court: ['home', 'away'].includes(saved.court) ? saved.court : DEFAULTS.court,       // en qué estadio se juega: el del local (izquierda) o el del visitante
  style: { ...DEFAULTS.style, ...(saved.style || {}) },
  rosA: null, rosB: null, ctrlSlot: 0, selStarter: null,
  online: null, backup: null,                                  // online = datos de la sala (null = partido casual normal)
};
/* Jugadores en la misma PC (hasta 4). Cada casilla usa el dispositivo que quieras: un joystick (se suma apretando un botón) o el teclado y mouse (solo uno).
   Al principio J1 trae el teclado como valor por defecto (auto): si un joystick aprieta un botón, ocupa el lugar de J1 y el teclado queda libre.
   Las casillas ocupadas siempre son J1, J2… seguidas; el primer jugador es siempre del equipo Local. */
S.slots = [0, 1, 2, 3].map(i => ({ on: i === 0, dev: i === 0 ? 'kb' : 'pad', auto: i === 0, pad: null, team: i === 0 ? 0 : (saved.slotTeams?.[i] === 0 || saved.slotTeams?.[i] === 1 ? saved.slotTeams[i] : i % 2) }));
S.players = 1;
let justJoined = false;
const padConnected = i => i != null && !!navigator.getGamepads?.()[i]?.connected;
function compactSlots() {                                                   // las casillas ocupadas se corren hacia J1 (sin huecos); si no queda nadie, vuelve el teclado por defecto
  const on = S.slots.filter(s => s.on).map(s => ({ dev: s.dev, pad: s.pad, team: s.team, auto: !!s.auto }));
  S.slots.forEach((s, i) => { const o = on[i]; if (o) { s.on = true; s.dev = o.dev; s.pad = o.pad; s.team = o.team; s.auto = o.auto; } else { s.on = false; s.dev = 'pad'; s.pad = null; s.auto = false; } });
  if (!on.length) Object.assign(S.slots[0], { on: true, dev: 'kb', pad: null, auto: true });
  S.slots[0].team = 0;
}
const kbTaken = () => S.slots.some(s => s.on && s.dev === 'kb');
function pruneSlots() { for (const s of S.slots) if (s.dev === 'pad' && s.on && !padConnected(s.pad)) { s.on = false; s.pad = null; } compactSlots(); S.players = S.slots.filter(s => s.on).length; }
const kitObj = side => { const t = side === 'A' ? S.teamA : S.teamB; return kitById(t, side === 'A' ? S.kitA : S.kitB); };
if (!S.kitB) S.kitB = autoKit(S.teamB, kitObj('A')).id;
const fixClash = () => {
  if (!kitsClash(kitObj('A'), kitObj('B'))) return false;
  if (!S.online) { S.kitB = autoKit(S.teamB, kitObj('A')).id; return true; }
  if (S.online.role === 'guest') { S.kitA = autoKit(S.teamA, kitObj('B')).id; return true; }      // online: si chocan, el invitado es el que cambia (así no pelean los dos a la vez)
  return false;
};
fixClash();

let hooks = {}, root = null, open_ = false;
const persist = () => {
  if (S.online) return;                                   // en una sala no se pisan tus preferencias del casual
  try {
    localStorage.setItem(SKEY, JSON.stringify({ a: S.teamA.ab, b: S.teamB.ab, kitA: S.kitA, kitB: S.kitB, qLen: S.qLen, shotClock: S.shotClock, fatigue: S.fatigue, autoSubs: S.autoSubs, cam: S.cam, camHeight: S.camHeight, court: S.court, style: S.style, slotTeams: S.slots.map(s => s.team) }));
  } catch { /* sin storage */ }
};

/* ---------------------------------------------------------------------------
   Planteles (se leen igual que antes; acá se copian para poder cambiar titulares sin tocar el caché)
   ------------------------------------------------------------------------- */
const clone = r => ({ starters: r.starters.map(p => ({ ...p, natural: p.natural ?? p.pos })), bench: r.bench.map(p => ({ ...p, natural: p.natural ?? p.pos })) });
const rReq = { A: 0, B: 0 }, rProm = { A: Promise.resolve(), B: Promise.resolve() };
function loadSide(side) {
  const team = side === 'A' ? S.teamA : S.teamB, req = ++rReq[side];
  S['ros' + side] = null;
  rProm[side] = loadRoster(team).catch(() => fallbackRoster(team)).then(r => {
    if (req !== rReq[side]) return;
    S['ros' + side] = clone(r);
    onRosters(side);
    if (side === 'A') emitPick();
  });
  return rProm[side];
}
export const ready = () => Promise.all([rProm.A, rProm.B]);
const tovr = r => (r ? Math.round(r.starters.reduce((t, p) => t + p.ovr, 0) / r.starters.length) : 0);
/** Las tres notas del equipo (GRL = general, ATA = ataque, DEF = defensa), promedio de los 5 titulares. */
const ATA_KEYS = ['close', 'mid', 'three', 'layup', 'handle', 'passAcc'], DEF_KEYS = ['intD', 'perD', 'steal', 'block', 'dreb'];
const rate = (r, keys) => (r ? Math.round(r.starters.reduce((t, p) => t + keys.reduce((s, k) => s + (Number.isFinite(p[k]) ? p[k] : p.ovr), 0) / keys.length, 0) / r.starters.length) : null);
const ratings = r => ({ grl: r ? tovr(r) : null, ata: rate(r, ATA_KEYS), def: rate(r, DEF_KEYS) });

/** Lo que usa main.js al apretar Jugar (copias nuevas: el partido puede modificarlas sin ensuciar el menú). */
export function getSetup() {
  pruneSlots();
  const rA = S.rosA || fallbackRoster(S.teamA), rB = S.rosB || fallbackRoster(S.teamB);
  const cp = r => ({ starters: r.starters.map(p => ({ ...p })), bench: r.bench.map(p => ({ ...p })) });
  if (S.online) {                                                  // sala: el anfitrión siempre es el Local (A) y el invitado el Visitante (B), lo veas del lado que lo veas
    const O = S.online, host = O.role === 'host';
    const me = { team: S.teamA, kit: kitObj('A'), lineup: cp(rA), ctrl: S.ctrlSlot }, op = { team: S.teamB, kit: kitObj('B'), lineup: cp(rB), ctrl: O.oppCtrl };
    const [h, g] = host ? [me, op] : [op, me], mine = S.slots.find(s => s.on) || S.slots[0];
    return {
      online: { role: O.role, code: O.code, settings: { ...O.settings } },
      players: 2, humans: [{ dev: mine.dev, pad: mine.pad, team: host ? 0 : 1 }], teamA: h.team, teamB: g.team, kitA: h.kit, kitB: g.kit, lineupA: h.lineup, lineupB: g.lineup,
      qLen: O.settings.qLen, diff: O.settings.diff, shotClock: O.settings.shotClock, fatigue: O.settings.fatigue, autoSubs: O.settings.autoSubs, cam: S.cam, camHeight: S.camHeight, style: host ? { ...S.style } : { ...(O.oppStyle || S.style) }, styleB: host ? { ...(O.oppStyle || S.style) } : { ...S.style }, ctrlSlot: h.ctrl, ctrlSlotB: g.ctrl,
      court: O.settings.court, courtTeam: O.settings.court === 'away' ? g.team : h.team,
    };
  }
  return {
    players: S.players, humans: S.slots.filter(s => s.on).map((s, i) => ({ dev: s.dev, pad: s.pad, team: i === 0 ? 0 : s.team })), teamA: S.teamA, teamB: S.teamB, kitA: kitObj('A'), kitB: kitObj('B'), lineupA: cp(rA), lineupB: cp(rB),
    qLen: S.qLen, diff: UI.settings.diff, shotClock: S.shotClock, fatigue: S.fatigue, autoSubs: S.autoSubs, cam: S.cam, camHeight: S.camHeight, style: { ...S.style }, ctrlSlot: S.ctrlSlot,
    court: S.court, courtTeam: S.court === 'away' ? S.teamB : S.teamA,
  };
}

/* ---------------------------------------------------------------------------
   Opciones: filas con ‹ valor ›
   ------------------------------------------------------------------------- */
const YN = [['true', 'Sí'], ['false', 'No']];
const OPT = {
  get court() {
    const nm = t => { const c = courtFor(t); return c.real ? c.arena : nickname(t); };
    if (S.online) { const h = S.online.role === 'host' ? S.teamA : S.teamB, g = S.online.role === 'host' ? S.teamB : S.teamA; return [['home', `Anfitrión · ${nm(h)}`], ['away', `Invitado · ${nm(g)}`]]; }
    return [['home', `Local · ${nm(S.teamA)}`], ['away', `Visitante · ${nm(S.teamB)}`]];
  },
  diff: [['easy', 'Fácil'], ['hard', 'Difícil'], ['extreme', 'Extremo']],
  qLen: [['60', '1 min'], ['120', '2 min'], ['180', '3 min'], ['300', '5 min'], ['480', '8 min']],
  shotClock: YN, fatigue: YN, autoSubs: YN,
  cam: [['0', '2K'], ['1', 'TV'], ['2', 'Libre']],
  camHeight: [['-2', 'Más baja'], ['-1', 'Baja'], ['0', 'Normal'], ['1', 'Alta'], ['2', 'Más alta']],
};
const MATCH_ALL = [
  ['court', 'Cancha', 'Estadio del local o del visitante.'],
  ['diff', 'Dificultad', 'Cómo juega el rival: velocidad, puntería, presión, robos y tapones.'],
  ['qLen', 'Duración del cuarto', 'Cuatro cuartos. Si hay empate, tiempo suplementario.'],
  ['shotClock', 'Reloj de 24 segundos', 'Si lo apagás, no hay violación de 24 s.'],
  ['fatigue', 'Cansancio', 'Correr y driblear gasta energía. Apagado = energía infinita.'],
  ['autoSubs', 'Cambios automáticos', 'En las pausas entran los suplentes por los más cansados.'],
  ['cam', 'Cámara inicial', 'Después la cambiás con la tecla C.'],
  ['camHeight', 'Altura de cámara 2K', 'Ajustá el ángulo vertical: más baja o más alta.'],
];
/** Filas del paso Partido. En una sala se saca el nivel de los bots: los dos equipos tienen un humano y el nivel no cambia nada. */
const matchRows = () => (S.online ? MATCH_ALL.filter(r => r[0] !== 'diff') : MATCH_ALL);
const STYLE_ROWS = [
  ['pace', 'Ritmo', [['slow', 'Lento'], ['normal', 'Normal'], ['fast', 'Rápido']], 'Qué tan rápido atacan tus compañeros.'],
  ['shot', 'Tiro', [['balanced', 'Equilibrado'], ['threes', 'Triples'], ['inside', 'Cerca del aro']], 'Desde dónde buscan tirar.'],
  ['pass', 'Juego', [['solo', 'Individual'], ['balanced', 'Equilibrado'], ['team', 'Colectivo']], 'Cuánto se pasan la pelota y se mueven sin ella.'],
  ['def', 'Defensa', [['loose', 'Suelta'], ['normal', 'Normal'], ['pressure', 'Presión']], 'Presión sobre el rival (cansa más).'],
];
const optsOf = key => key.startsWith('style.') ? STYLE_ROWS.find(r => 'style.' + r[0] === key)[2] : OPT[key];
const curVal = key => key.startsWith('style.') ? S.style[key.slice(6)] : key === 'diff' ? (S.online ? S.online.settings.diff : UI.settings.diff) : S[key];
const LOCKED = new Set(['court', 'diff', 'qLen', 'shotClock', 'fatigue', 'autoSubs']);       // en una sala las define el anfitrión
const labelOf = key => (optsOf(key).find(([v]) => String(curVal(key)) === v) || [0, '-'])[1];

function setOpt(key, val) {
  if (!optsOf(key).some(([v]) => v === val)) return;
  if (S.online && LOCKED.has(key)) { toast('🔒 Esta regla la puso el anfitrión de la sala.'); return; }
  if (key.startsWith('style.')) S.style[key.slice(6)] = val;
  else if (key === 'diff') { UI.settings.diff = val; UI.saveSettings(); }
  else if (key === 'court') S.court = val;
  else if (['shotClock', 'fatigue', 'autoSubs'].includes(key)) S[key] = val === 'true';
  else S[key] = +val;
  persist();
  if (S.step === 3) renderMenu(); else if (S.step === LAST) { renderOpts(); renderSummary(); }
}
function stepOpt(key, d) {
  const o = optsOf(key), i = o.findIndex(([v]) => String(curVal(key)) === v);
  setOpt(key, o[(i + d + o.length) % o.length][0]);
}

/* ---------------------------------------------------------------------------
   Íconos y pequeños helpers de dibujo
   ------------------------------------------------------------------------- */
const LOGO_MARK = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2l15.6 9v18L20 38 4.4 29V11z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="20" cy="20" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 20h16M20 12v16" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>';
const PERSON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="7.5" r="3.4"/><path d="M5 20c.6-4 3.3-6 7-6s6.4 2 7 6"/></svg>';
const PAD_ICON = '<svg viewBox="0 0 24 24"><path d="M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.2 2L14.5 14h-5l-1.3 1A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4zM8 10.5v3M6.5 12h3"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const lastName = p => (p.generic ? String(p.name).replace(/ \(supl\.\)/, '') : String(p.name).split(' ').slice(-1)[0]);
const tint = t => (lum(t.c1) > 0.07 ? t.c1 : lum(t.c2) > 0.07 ? t.c2 : '#5b6cff');
const ringColor = v => (v >= 85 ? '#ffc53d' : v >= 75 ? '#8ee6b0' : v >= 65 ? '#8fb7ff' : '#ff9a7a');
const ring = (v, label) => {
  const c = 2 * Math.PI * 18, pct = v == null ? 0 : clampN((v - 40) / 59, 0, 1), col = v == null ? '#566' : ringColor(v);
  return `<div class="fc-ring"><svg viewBox="0 0 48 48"><circle class="bg" cx="24" cy="24" r="18"/><circle class="fg" cx="24" cy="24" r="18" stroke="${col}" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 24 24)"/></svg><b>${v ?? '…'}</b><i>${label}</i></div>`;
};
const toast = t => { const el = $('pmToast'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); };

/* ---------------------------------------------------------------------------
   Estructura general (fondo de estadio + cabecera + cuerpo + pie)
   ------------------------------------------------------------------------- */
function buildRoot() {
  root = $('pm');
  root.innerHTML = `
  <div class="fc-bg"><div class="fc-crowd" id="pmCrowd"></div><div class="fc-beams"><i></i><i></i><i></i><i></i><i></i></div><div class="fc-glow a"></div><div class="fc-glow b"></div><div class="fc-floor"></div><div class="fc-vig"></div></div>
  <canvas id="pmStage" class="fc-canvas" aria-hidden="true"></canvas>
  <header class="fc-head">
    <div class="fc-brand">${LOGO_MARK}<div><b>BASKET 3D</b><small>COURTSIDE 26 · PARTIDO CASUAL</small></div></div>
    <nav class="fc-steps" id="pmSteps"></nav>
  </header>
  <div class="fc-banner" id="pmBanner" hidden></div>
  <main class="fc-body" id="pmBody"></main>
  <footer class="fc-foot">
    <div class="fc-hints" id="pmHints"></div>
    <div class="fc-nav">
      <button type="button" class="fc-btn ghost" data-act="back" id="pmBack">Volver</button>
      <button type="button" class="fc-btn" data-act="next" id="pmNext">Continuar</button>
    </div>
  </footer>
  <div class="fc-modal" id="pmModal" hidden></div>
  <div class="fc-toast" id="pmToast"></div>`;
  paintCrowd();
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el && root.contains(el)) { e.stopPropagation(); ACT[el.dataset.act]?.(el, e); }
  });
  root.addEventListener('mouseover', e => { const t = e.target.closest?.('.fc-ov .fc-tag'); const i = t ? +t.dataset.i : -1; if (i !== hoverI) { hoverI = i; glowSync(); } });
  root.addEventListener('mouseleave', () => { if (hoverI !== -1) { hoverI = -1; glowSync(); } });
  document.addEventListener('keydown', onKey);
  addEventListener('resize', () => { if (open_) relayout(); });
  addEventListener('gamepadconnected', () => { if (open_ && S.step === 0) renderPad(); });
  addEventListener('gamepaddisconnected', () => { if (open_ && S.step === 0) renderPad(); });
}

/** Público borroso del fondo: puntos de luz (cámaras, pantallas, gente) dibujados una sola vez. */
function paintCrowd() {
  try {
    const c = document.createElement('canvas'); c.width = 960; c.height = 300; const g = c.getContext('2d');
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 520; i++) {
      const x = rnd() * 960, y = 20 + rnd() * 270, r = 1 + rnd() * 3.2, k = rnd();
      g.fillStyle = k < 0.55 ? `rgba(255,${190 + (rnd() * 50 | 0)},90,${0.10 + rnd() * 0.3})` : k < 0.8 ? `rgba(150,180,255,${0.08 + rnd() * 0.25})` : `rgba(255,255,255,${0.08 + rnd() * 0.2})`;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    $('pmCrowd').style.backgroundImage = `url(${c.toDataURL('image/png')})`;
  } catch { /* sin canvas */ }
}

function renderHead() {
  const OL = S.online; root.classList.toggle('online', !!OL);
  $('pmSteps').innerHTML = STEPS.map(([n], i) => (OL && i === 0 ? '' : `<button type="button" data-act="step" data-i="${i}" class="${i === S.step ? 'on' : i < S.step ? 'done' : ''}"><i>${i + 1}</i><span>${n}</span></button>`)).join('');
  root.querySelector('.fc-brand small').textContent = OL ? `COURTSIDE 26 · CASUAL ONLINE · SALA ${OL.code}` : 'COURTSIDE 26 · PARTIDO CASUAL';
  $('pmBack').innerHTML = `<kbd>Esc</kbd>${OL && S.step <= 1 ? 'Salir de la sala' : S.step === 0 ? 'Menú principal' : 'Atrás'}`;
  const nx = $('pmNext'); nx.innerHTML = S.step === LAST ? (OL ? `<span>${OL.meReady ? 'CANCELAR LISTO' : 'ESTOY LISTO'}</span>` : '<span>¡JUGAR!</span>') : '<span>CONTINUAR</span><i>›</i>'; nx.classList.toggle('play', S.step === LAST);
  const bn = $('pmBanner'); bn.hidden = !S.banner || S.step !== LAST; bn.textContent = S.banner;
  const H = [
    ['Enter', 'Seleccionar'],
    ...(S.step === 1 ? [['← →', 'Cambiar equipo'], ['Tab', 'Local / Visitante'], ['R', 'Al azar']] : []),
    ...(S.step === 2 ? [['← →', 'Mi camiseta'], ['↑ ↓', 'Camiseta rival']] : []),
  ];
  if (Pad.state.connected) {                                       // con joystick conectado, los atajos que se muestran son los del joystick
    const a = Pad.label(0), x = Pad.label(2), y = Pad.label(3);
    H.length = 0;
    H.push(...[
      [[`${a}`, 'Continuar'], ['Otro joystick', 'Sumarse al partido'], ['◀ ▶', 'Equipo (J2-J4)']],
      [['◀ ▶', 'Cambiar equipo'], ['▲ ▼', 'Local / Visitante'], [a, 'Aceptar'], [x, 'Lista'], [y, 'Al azar']],
      [['◀ ▶', 'Mi camiseta'], ['▲ ▼', 'Camiseta rival'], [a, 'Continuar']],
      [['◀ ▶ ▲ ▼', 'Moverte'], [a, 'Elegir'], [y, 'Ficha'], [x, 'Titular'], ['Start', 'Continuar']],
      [['▲ ▼', 'Opción'], ['◀ ▶', 'Cambiar'], [a, '¡Jugar!']],
    ][S.step], ['LB RB', 'Paso anterior / siguiente']);
  }
  $('pmHints').innerHTML = H.map(([k, t]) => `<span><kbd>${k}</kbd>${t}</span>`).join('');
  root.dataset.step = S.step;
  root.style.setProperty('--tcA', tint(S.teamA)); root.style.setProperty('--tcB', tint(S.teamB));
}

const STEP_FN = () => [stepPlayers, stepTeams, stepKits, stepLineup, stepMatch][S.step];
function render() {
  renderHead(); closeModal();
  const body = $('pmBody'); body.scrollTop = 0;
  stageDetach();
  body.className = 'fc-body s' + S.step;
  body.innerHTML = STEP_FN()();
  if (S.step !== 2 && S.step !== 3) { stage?.stop?.(); stageEl().hidden = true; }
  [afterPlayers, afterTeams, afterKits, afterLineup, afterMatch][S.step]?.();
  padMark();
}
function onRosters(side) {                                       // llegó un plantel: refresca lo que dependa de él
  if (!open_) return;
  if (S.step === 1) renderSide(side);
  else if (S.step === 2) { renderKitCols(); renderStage(); }
  else if (S.step === 3) { if (side === 'A') { renderBench(); renderStage(); } }
  else if (S.step === LAST) renderSummary();
}

/* ---------------------------------------------------------------------------
   Acciones (clics)
   ------------------------------------------------------------------------- */
const cycleTeam = (cur, d, other) => {                           // siguiente equipo, saltando el que ya eligió el otro lado
  let i = TEAMS.indexOf(cur);
  do { i = (i + d + TEAMS.length) % TEAMS.length; } while (TEAMS[i] === other);
  return TEAMS[i];
};
function setTeam(side, t) {
  if (t === (side === 'A' ? S.teamA : S.teamB)) return;
  if (side === 'A') { S.teamA = t; S.ctrlSlot = 0; S.selStarter = null; } else S.teamB = t;
  fixClash(); persist(); loadSide(side);
  root.style.setProperty('--tcA', tint(S.teamA)); root.style.setProperty('--tcB', tint(S.teamB));
  if (S.step === 1) renderSide(side, true);
}

const ACT = {
  step(el) { if (S.online && +el.dataset.i === 0) return; go(+el.dataset.i); },
  next() { if (S.step === LAST) { if (S.online) hooks.onOnlineReady?.(!S.online.meReady); else play(); } else go(S.step + 1); },
  back() {
    if (S.picker || S.card || S.leaveAsk) { closeModal(); return; }
    if (S.leaveAsk) { closeModal(); return; }
    if (S.online && S.step <= 1) { askLeave(); return; }
    if (S.step === 0) { close(); hooks.onExit?.(); } else go(S.step - 1);
  },
  leaveYes() { closeModal(); hooks.onOnlineLeave?.(); },
  olReady() { hooks.onOnlineReady?.(!S.online.meReady); },
  olStart() { hooks.onOnlineStart?.(); },
  optstep(el) { stepOpt(el.dataset.key, +el.dataset.d); },
  slotteam(el) { const sl = S.slots[+el.dataset.i]; if (!sl || !sl.on || +el.dataset.i === 0) return; sl.team = +el.dataset.t ? 1 : 0; persist(); renderSlots(); },
  slotleave(el) { const sl = S.slots[+el.dataset.i]; if (!sl || !sl.on || S.slots.filter(x => x.on).length < 2) return; sl.on = false; sl.pad = null; sl.auto = false; pruneSlots(); persist(); renderSlots(); },
  slotjoin() { toast('Apretá cualquier botón del joystick que quieras sumar.'); },
  slotkb(el) {                                                              // sumar el teclado y mouse en esta casilla libre (solo puede usarlo uno)
    const sl = S.slots[+el.dataset.i]; if (!sl || sl.on || kbTaken()) return;
    const first = S.slots.findIndex(x => !x.on); const t = S.slots[first];     // siempre en la primera libre, así no quedan huecos
    t.on = true; t.dev = 'kb'; t.pad = null; t.auto = false; pruneSlots(); persist(); renderSlots();
    toast(`${SLOT_NAMES[S.slots.indexOf(t)]} juega con teclado y mouse.`);
  },
  focus(el) { if (S.online && el.dataset.side === 'B') return; S.focus = el.dataset.side; markFocus(); },
  cycle(el) { const side = el.dataset.side; if (S.online && side === 'B') { toast('El rival elige su propio equipo.'); return; } S.focus = side; setTeam(side, cycleTeam(side === 'A' ? S.teamA : S.teamB, +el.dataset.d, side === 'A' ? S.teamB : S.teamA)); markFocus(); },
  random() { randomTeam(S.online ? 'A' : S.focus); },
  swapTeams() { if (S.online) return; [S.teamA, S.teamB] = [S.teamB, S.teamA]; S.ctrlSlot = 0; S.selStarter = null; fixClash(); persist(); loadSide('A'); loadSide('B'); root.style.setProperty('--tcA', tint(S.teamA)); root.style.setProperty('--tcB', tint(S.teamB)); renderSide('A', true); renderSide('B', true); },
  pick(el) { if (S.online && el.dataset.side === 'B') { toast('El rival elige su propio equipo.'); return; } S.focus = el.dataset.side; S.picker = el.dataset.side; renderPicker(); },
  pickTeam(el) { const side = S.picker; closeModal(); if (side) { setTeam(side, teamByAb(el.dataset.ab)); markFocus(); } },
  closeModal() { closeModal(); },
  card(el) { const r = el.dataset.side === 'A' ? S.rosA : S.rosB; const p = r?.[el.dataset.bench ? 'bench' : 'starters'][+el.dataset.i]; if (p) showCard(p); },
  kit(el) {
    const side = el.dataset.side;
    if (S.online && side === 'B') return;                                    // la camiseta del rival la elige el rival
    if (side === 'A') { S.kitA = el.dataset.id; if (fixClash()) toast(S.online ? 'Tu camiseta se parecía a la del rival: la cambiamos.' : 'Cambiamos la camiseta rival para que se distingan.'); } else S.kitB = el.dataset.id;
    persist(); kitsChanged(); emitPick();
  },
  kitAuto() { if (S.online) { if (fixClash()) { kitsChanged(); emitPick(); } return; } S.kitB = autoKit(S.teamB, kitObj('A')).id; persist(); kitsChanged(); },
  starter(el) {
    const i = +el.dataset.i; S.selStarter = S.selStarter === i ? null : i; renderStage(); renderBench();
  },
  bench(el) { const p = S.rosA?.bench[+el.dataset.i]; if (p) showCard(p); },
  swapin(el) {
    const j = +el.dataset.i, s = S.selStarter, r = S.rosA;
    if (s === null || !r) { toast('Primero elegí al titular que querés sacar.'); return; }
    const inP = r.bench[j], outP = r.starters[s];
    r.starters[s] = { ...inP, pos: POS[s] };
    r.bench[j] = { ...outP, pos: outP.natural ?? outP.pos };
    toast(`Entra ${inP.name} por ${outP.name}`);
    S.selStarter = null; renderStage(); renderBench(); emitPick();
  },
  star(el) { S.ctrlSlot = +el.dataset.i; renderStage(); emitPick(); },
  autoLineup() { loadRoster(S.teamA).then(r => { S.rosA = clone(r); S.selStarter = null; S.ctrlSlot = 0; renderStage(); renderBench(); toast('Alineación restablecida.'); emitPick(); }); },
};

function randomTeam(side) {
  const cur = side === 'A' ? S.teamA : S.teamB, other = side === 'A' ? S.teamB : S.teamA;
  let t; do { t = TEAMS[Math.floor(Math.random() * TEAMS.length)]; } while (t === cur || t === other);
  setTeam(side, t);
}

function kitStep(side, d) {
  const team = side === 'A' ? S.teamA : S.teamB, ks = kitsFor(team), cur = ks.findIndex(x => x.id === (side === 'A' ? S.kitA : S.kitB));
  ACT.kit({ dataset: { side, id: ks[(cur + d + ks.length) % ks.length].id } });
}

/* ---------------------------------------------------------------------------
   Joystick: navegación propia de cada paso (en vez del foco espacial genérico)
     ◀ ▶ ▲ ▼ mover · ✕/A aceptar · ○/B volver · □/X y △/Y según el paso · LB/RB paso anterior/siguiente · Start continuar
   Con una ventana abierta (lista de equipos, ficha) se usa la navegación espacial de gamepad.js.
   ------------------------------------------------------------------------- */
let padOn = false, padRow = 0, padZone = 0, lastConn = false; const padI = [0, 0];
if (typeof document !== 'undefined') document.addEventListener('mousemove', () => { if (padOn) { padOn = false; padMark(); } }, { passive: true });
const wrapI = (i, d, n) => (n ? (i + d + n) % n : 0);
function padMark() {                                              // marco dorado en lo que el joystick tiene seleccionado
  if (!root) return;
  root.querySelectorAll('.pad-cur').forEach(e => e.classList.remove('pad-cur'));
  if (!padOn || !open_ || S.picker || S.card || S.leaveAsk) { glowSync(); return; }
  let el = null;
  if (S.step === 3) el = padZone === 0 ? root.querySelector(`.fc-tag[data-i="${padI[0]}"]`) : padZone === 1 ? root.querySelector(`.fc-b[data-i="${padI[1]}"]`) : root.querySelectorAll('#pmMenu .fc-mi')[padZone - 1];
  else if (S.step === LAST) el = root.querySelectorAll('#pmOpts .fc-opt')[padRow];
  if (el) { el.classList.add('pad-cur'); keepVisible(el); }
  glowSync();
}
/** Mantiene a la vista el renglón elegido SOLO dentro de su lista (scrollIntoView movía también el menú entero y lo desconfiguraba). */
function keepVisible(el) {
  const list = el.closest('.fc-bl'); if (!list) return;
  const lr = list.getBoundingClientRect(), er = el.getBoundingClientRect();
  if (er.top < lr.top) list.scrollTop -= lr.top - er.top; else if (er.bottom > lr.bottom) list.scrollTop += er.bottom - lr.bottom;
}
/** Brillo del jugador sobre el que estás parado (joystick o mouse): anillo en la cancha + haz de luz en el 3D. */
let hoverI = -1;
function glowSync() {
  if (!root) return;
  const lineup = open_ && S.step === 3 && !S.picker && !S.card;
  const cur = !lineup ? -1 : (padOn && padZone === 0) ? padI[0] : hoverI;
  root.querySelectorAll('.fc-spot.lu').forEach(e => e.classList.toggle('cur', +e.dataset.i === cur));
  try { stage?.setGlow?.(cur, lineup ? S.selStarter : -1); } catch { /* sin 3D */ }
}
/** Un joystick apretó un botón: si estamos en el paso Jugadores, ese joystick entra al partido en la primera casilla libre (J2, J3 o J4). */
export function onJoin(padIndex) {
  if (!open_ || S.step !== 0 || S.picker || S.card || S.leaveAsk) return;
  pruneSlots();
  if (S.slots.some(s => s.on && s.pad === padIndex)) return;                // ya está adentro
  const first = S.slots[0];
  const sl = (first.on && first.dev === 'kb' && first.auto) ? first : S.slots.find(s => !s.on);   // el teclado era solo el valor por defecto: el primer joystick toma su lugar (J1)
  if (!sl) { toast('Ya son 4 jugadores.'); return; }
  sl.on = true; sl.dev = 'pad'; sl.pad = padIndex; sl.auto = false; pruneSlots(); justJoined = true; renderSlots();
  toast(`${SLOT_NAMES[S.slots.indexOf(sl)]} entró con ${padLabel(padIndex)}.`);
}
export function onPad(P) {                                        // devuelve true si el menú previo se encarga (si no, navega gamepad.js)
  if (!open_ || S.picker || S.card || S.leaveAsk) return false;
  if (justJoined) { justJoined = false; return true; }                // el botón que usó para entrar no cuenta como "Continuar"
  if (P.connected !== lastConn) { lastConn = P.connected; renderHead(); }
  const n = P.nav || {};
  if (!(n.up || n.down || n.left || n.right || n.ok || n.back || n.start || n.x || n.y || n.lb || n.rb)) return true;
  padOn = true;
  const h = (n.right ? 1 : n.left ? -1 : 0), v = (n.down ? 1 : n.up ? -1 : 0);
  if (n.lb) { go(S.step - 1); return true; } if (n.rb) { go(S.step + 1); return true; }
  if (n.start) { ACT.next(); return true; }
  const st = S.step;
  if (st === 0) {                                                                         // paso Jugadores: cada joystick maneja su propia casilla
    const mi = S.slots.findIndex(s => s.on && s.dev === 'pad' && s.pad === P.index);
    if (mi >= 0) {
      if (n.back && S.slots.filter(x => x.on).length > 1) { const nm = SLOT_NAMES[mi]; ACT.slotleave({ dataset: { i: mi } }); toast(`${nm} salió del partido.`); return true; }
      if (h && mi > 0) { S.slots[mi].team = h > 0 ? 1 : 0; persist(); renderSlots(); return true; }       // J1 siempre es Local
    }
  }
  if (n.back) {
    if (st === 1 && S.focus === 'B' && !S.online) { S.focus = 'A'; markFocus(); }                      // primero volvés al local, después al paso anterior
    else if (st === 3 && S.selStarter !== null) { S.selStarter = null; renderStage(); renderBench(); }
    else ACT.back();
    return true;
  }
  if (st === 0) { if (n.ok) ACT.next(); }
  else if (st === 1) {
    if (h) setTeam(S.focus, cycleTeam(S.focus === 'A' ? S.teamA : S.teamB, h, S.focus === 'A' ? S.teamB : S.teamA));
    if (v && !S.online) { S.focus = S.focus === 'A' ? 'B' : 'A'; markFocus(); }
    if (n.y) randomTeam(S.online ? 'A' : S.focus);
    if (n.x) ACT.pick({ dataset: { side: S.focus } });
    if (n.ok) { if (S.focus === 'A' && !S.online) { S.focus = 'B'; markFocus(); toast('Ahora elegí el rival (visitante).'); } else ACT.next(); }   // ✕ en el local → pasa al visitante; ✕ en el visitante → sigue
  } else if (st === 2) {
    if (h) kitStep('A', h); if (v) kitStep('B', v);
    if (n.ok) ACT.next();
  } else if (st === 3) {
    const r = S.rosA, zones = 2 + STYLE_ROWS.length;
    if (v) padZone = clampN(padZone + v, 0, zones - 1);
    if (padZone === 1 && r) padI[1] = clampN(padI[1], 0, Math.max(0, r.bench.length - 1));
    if (h) {
      if (padZone === 0) padI[0] = wrapI(padI[0], h, 5);
      else if (padZone === 1) padI[1] = wrapI(padI[1], h, r ? r.bench.length : 0);
      else stepOpt('style.' + STYLE_ROWS[padZone - 2][0], h);
    }
    if (n.ok) {
      if (padZone === 0) { ACT.starter({ dataset: { i: padI[0] } }); if (S.selStarter !== null) { padZone = 1; padI[1] = 0; } }   // elegiste a quién sacar → el cursor salta al banco
      else if (padZone === 1) { if (r?.bench.length) { const had = S.selStarter !== null; if (had) { ACT.swapin({ dataset: { i: padI[1] } }); padZone = 0; } else showCard(r.bench[padI[1]]); } }
      else stepOpt('style.' + STYLE_ROWS[padZone - 2][0], 1);
    }
    if (n.y && r) { if (padZone === 0) showCard(r.starters[padI[0]]); else if (padZone === 1 && r.bench[padI[1]]) showCard(r.bench[padI[1]]); }
    if (n.x && padZone === 0) ACT.star({ dataset: { i: padI[0] } });
  } else {
    padRow = wrapI(padRow, v, matchRows().length);
    if (h) stepOpt(matchRows()[padRow][0], h);
    if (n.ok) ACT.next();                                                                   // ✕ en el último paso = ¡JUGAR!
  }
  padMark();
  return true;
}

function onKey(e) {
  if (!open_) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.code;
  if (k === 'Escape') { ACT.back(); e.preventDefault(); return; }
  if (S.picker || S.card || S.leaveAsk) return;
  if (k === 'Enter' && !(t && t.tagName === 'BUTTON')) { ACT.next(); e.preventDefault(); return; }
  if (S.step === 1) {
    if (k === 'ArrowLeft' || k === 'ArrowRight') { setTeam(S.focus, cycleTeam(S.focus === 'A' ? S.teamA : S.teamB, k === 'ArrowLeft' ? -1 : 1, S.focus === 'A' ? S.teamB : S.teamA)); e.preventDefault(); }
    else if (k === 'Tab' || k === 'ArrowUp' || k === 'ArrowDown') { if (!S.online) { S.focus = S.focus === 'A' ? 'B' : 'A'; markFocus(); } e.preventDefault(); }
    else if (k === 'KeyR') { randomTeam(S.focus); e.preventDefault(); }
  } else if (S.step === 2) {
    const side = k === 'ArrowLeft' || k === 'ArrowRight' ? 'A' : k === 'ArrowUp' || k === 'ArrowDown' ? 'B' : null;
    if (side) { kitStep(side, k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 1); e.preventDefault(); }
  }
}

function go(i) {
  if (i < 0 || i > LAST) return;
  if (S.online && i === 0) i = 1;
  if (S.online?.meReady && i < LAST) hooks.onOnlineReady?.(false);
  hoverI = -1; S.step = i; clearTimeout(toast.t); $('pmToast').classList.remove('on'); render();
}
async function play() {
  const nx = $('pmNext');
  nx.disabled = true; nx.textContent = 'Cargando planteles…';
  try { await ready(); } catch { /* usa genéricos */ }
  nx.disabled = false; renderHead();
  hooks.onPlay?.();
}

/* ---------------------------------------------------------------------------
   Ventanas (selector de equipo y ficha de jugador)
   ------------------------------------------------------------------------- */
function closeModal() { S.picker = null; S.card = null; S.leaveAsk = false; const m = $('pmModal'); if (m) { m.hidden = true; m.innerHTML = ''; } }
function renderPicker() {
  const side = S.picker, cur = side === 'A' ? S.teamA : S.teamB, other = side === 'A' ? S.teamB : S.teamA, m = $('pmModal');
  m.innerHTML = `<div class="fc-sheet wide"><div class="fc-sheet-h"><h3>${side === 'A' ? 'Equipo local' : 'Equipo visitante'}</h3><button type="button" class="fc-x" data-act="closeModal" aria-label="Cerrar">✕</button></div>
    <div class="fc-tgrid">${TEAMS.map(t => `<button type="button" class="fc-tt${t === cur ? ' on' : ''}${t === other ? ' used' : ''}" style="--tc:${tint(t)}" data-act="pickTeam" data-ab="${t.ab}"><img src="${t.logo}" alt=""><b>${t.ab}</b><span>${t.name}</span></button>`).join('')}</div></div>`;
  m.hidden = false;
  const on = m.querySelector('.fc-tt.on'), sh = m.querySelector('.fc-sheet');
  if (on && sh) sh.scrollTop = Math.max(0, on.offsetTop - sh.clientHeight / 2);
}
/** Ficha estilo 2K de un jugador (todas las barras de atributos). */
function showCard(p) {
  S.card = p;
  const groups = [...new Set(ATTRS.map(x => x[3]))];
  const body = groups.map(g => `<div class="grp"><b>${g}</b>${ATTRS.filter(x => x[3] === g).map(([k, , label]) =>
    `<div class="row"><span>${label}</span><u>${p[k]}</u><div><i style="width:${Math.max(0, (p[k] - 25) / 74 * 100)}%"></i></div></div>`).join('')}</div>`).join('');
  const sub = [p.pos, `#${p.number}`, inchesToFtIn(p.heightIn) + ` (${p.height} cm)`, p.weightLb ? `${p.weightLb} lb` : null, p.wingspanIn ? `envergadura ${inchesToFtIn(p.wingspanIn)}` : null].filter(Boolean).join(' · ');
  const note = p.detailed ? '' : '<div class="sub">Atributos estimados desde el OVR y la posición (cargá los atributos en Supabase para ajustarlos).</div>';
  const m = $('pmModal');
  m.innerHTML = `<div class="fc-sheet"><div class="fc-sheet-h"><div class="fc-ovr"><b>${p.ovr}</b><i>OVR</i></div><div class="fc-sheet-t"><h3>${esc(p.name)}${p.generic ? '*' : ''}</h3><div class="sub">${esc(sub)}</div></div><button type="button" class="fc-x" data-act="closeModal" aria-label="Cerrar">✕</button></div>${note}<div class="pcard-cols">${body}</div></div>`;
  m.hidden = false;
}

/* ---------------------------------------------------------------------------
   Paso 1 · Jugadores
   ------------------------------------------------------------------------- */
function titleHTML(extra = '') {
  const [, h, p] = STEPS[S.step], w = h.split(' ');
  const cut = w.length === 4 ? 2 : 1;
  return `<div class="fc-title"><h2>${w.slice(0, cut).join(' ')}<br>${w.slice(cut).join(' ')}</h2><p>${p}</p>${extra}</div>`;
}
const SLOT_NAMES = ['J1', 'J2', 'J3', 'J4'], SLOT_COL = ['#ffd34d', '#4dc3ff', '#ff6b6b', '#4dffb0'];
const KB_ICON = '<svg viewBox="0 0 24 24"><rect x="2.5" y="6.5" width="19" height="11" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10"/></svg>';
const padLabel = i => { const p = navigator.getGamepads?.()[i]; return p && p.connected ? p.id.replace(/\(.*?\)/g, '').trim().slice(0, 34) || 'Joystick' : 'Joystick'; };
function stepPlayers() {
  pruneSlots();
  return `${titleHTML()}<div class="fc-slots" id="pmSlots"></div><div class="fc-pad" id="pmPad"></div>`;
}
function afterPlayers() { renderPad(); }
function modeText() {
  const hs = S.slots.filter(s => s.on), a = hs.filter(s => s.team === 0).length, b = hs.length - a;
  if (hs.length === 1) return '1 jugador · vos contra el rival (bots)';
  if (!b) return `${a} jugadores · cooperativo: ${a} contra los bots`;
  return `${a} vs ${b} · versus entre jugadores${a < 5 || b < 5 ? ' (el resto del equipo son bots)' : ''}`;
}
function renderSlots() {
  const el = $('pmSlots'); if (!el) return;
  pruneSlots();
  const nA = esc(S.teamA.ab), nB = esc(S.teamB.ab), many = S.slots.filter(s => s.on).length > 1, kbFree = !kbTaken();
  el.innerHTML = S.slots.map((s, i) => {
    const col = SLOT_COL[i], head = `<header><i style="background:${col}">${SLOT_NAMES[i]}</i><span>${s.on ? (s.dev === 'kb' ? 'TECLADO Y MOUSE' : 'JOYSTICK') : 'LIBRE'}</span>${s.on && many ? `<button type="button" class="x" data-act="slotleave" data-i="${i}" aria-label="Sacar a ${SLOT_NAMES[i]}">✕</button>` : ''}</header>`;
    if (!s.on) return `<div class="fc-slot empty" style="--c:${col}" data-act="slotjoin" data-i="${i}">${head}<div class="ic">${PAD_ICON}</div><b>Apretá un botón</b><small>de un joystick para sumarte</small>${kbFree ? `<button type="button" class="kbadd" data-act="slotkb" data-i="${i}">⌨ Usar teclado y mouse</button>` : ''}</div>`;
    const tb = (t, lab, ab) => `<button type="button" class="${s.team === t ? 'on' : ''}" data-act="slotteam" data-i="${i}" data-t="${t}"${i === 0 ? ' disabled' : ''}><b>${lab}</b><small>${ab}</small></button>`;
    const note = i === 0 ? 'El primer jugador siempre es del equipo local' : s.dev === 'kb' ? 'Elegí el equipo con los botones' : 'Cambiá de equipo con ◀ ▶';
    return `<div class="fc-slot on" style="--c:${col}">${head}<div class="ic">${s.dev === 'kb' ? KB_ICON : PAD_ICON}</div><b>${s.dev === 'kb' ? 'Teclado y mouse' : esc(padLabel(s.pad))}</b><small>${note}</small><div class="tm">${tb(0, 'LOCAL', nA)}${tb(1, 'VISITANTE', nB)}</div></div>`;
  }).join('');
  const m = $('pmMode'); if (m) m.textContent = modeText();
  const sum = $('pmPad'); if (sum) renderPad(true);
}
function renderPad(noSlots) {
  if (S.step === 0 && !noSlots) { renderSlots(); return; }
  const el = $('pmPad'); if (!el) return;
  const pads = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(p => p && p.connected);
  const extra = S.slots.filter(s => s.on && s.dev === 'pad').length;
  el.innerHTML = `${PAD_ICON}<span><b id="pmMode">${modeText()}</b><br>${pads.length
    ? `Joysticks conectados: ${pads.length}. ${extra ? '' : 'Apretá un botón del joystick para jugar con él (toma el lugar de J1); para jugar de a 2, 3 o 4 apretá un botón en cada uno.'}`
    : 'No hay joysticks conectados: por ahora se juega con teclado y mouse. Para usar un joystick, conectalo (USB o Bluetooth) y apretale un botón; cada jugador suma el suyo.'}</span>`;
}

/* ---------------------------------------------------------------------------
   Paso 2 · Equipos (local vs visitante)
   ------------------------------------------------------------------------- */
function stepTeams() {
  return `${titleHTML(`<div class="fc-tact">${S.online ? '' : '<button type="button" class="fc-chip" data-act="swapTeams">⇄ Intercambiar</button>'}<button type="button" class="fc-chip" data-act="random"><kbd>R</kbd> Al azar</button></div>`)}
    <div class="fc-vsrow"><div class="fc-side" id="pmSideA"></div><div class="fc-vs"><span>VS</span></div><div class="fc-side" id="pmSideB"></div></div>`;
}
function afterTeams() { renderSide('A'); renderSide('B'); markFocus(); }
function markFocus() { root.querySelectorAll('.fc-side').forEach(s => s.classList.toggle('focus', s.dataset.side === S.focus)); }
function sideHTML(side) {
  const t = side === 'A' ? S.teamA : S.teamB, r = side === 'A' ? S.rosA : S.rosB, q = ratings(r);
  const lines = r ? r.starters.map((p, i) => `<button type="button" class="fc-line" data-act="card" data-side="${side}" data-i="${i}"><i>${p.pos}</i><b>${esc(lastName(p))}${p.generic ? '*' : ''}</b><em>${inchesToFtIn(p.heightIn)}</em><u>${p.ovr}</u></button>`).join('')
    : '<p class="fc-load">Cargando plantel…</p>';
  const OL = S.online, lock = !!OL && side === 'B';                 // en una sala el rival elige su propio equipo
  const who = OL ? (side === 'A' ? 'VOS' : OL.oppPicked ? `RIVAL${OL.oppName ? ' · ' + esc(OL.oppName) : ''}` : 'ESPERANDO AL RIVAL…') : (side === 'A' ? 'LOCAL' : 'VISITANTE');
  return `<span class="fc-pill ${side === 'A' ? 'loc' : 'vis'}">${who}</span>
    ${lock ? `<div class="fc-logo"><img src="${t.logo}" alt="${esc(t.name)}"></div>` : `<button type="button" class="fc-logo" data-act="pick" data-side="${side}" aria-label="Cambiar equipo"><img src="${t.logo}" alt="${esc(t.name)}"></button>`}
    <div class="fc-rings">${ring(q.grl, 'GRL')}${ring(q.ata, 'ATA')}${ring(q.def, 'DEF')}</div>
    ${lock ? `<div class="fc-sel"><b>${esc(nickname(t))}<small>${esc(t.name)}</small></b></div>` : `<div class="fc-sel"><button type="button" data-act="cycle" data-side="${side}" data-d="-1" aria-label="Anterior">‹</button><b data-act="pick" data-side="${side}">${esc(nickname(t))}<small>${esc(t.name)}</small></b><button type="button" data-act="cycle" data-side="${side}" data-d="1" aria-label="Siguiente">›</button></div>`}
    <div class="fc-lines">${lines}</div>`;
}
function renderSide(side, pop) {
  if (S.step !== 1) return;
  const el = $('pmSide' + side); if (!el) return;
  const t = side === 'A' ? S.teamA : S.teamB;
  el.dataset.side = side; el.style.setProperty('--tc', tint(t)); el.style.setProperty('--tc2', t.c2);
  el.innerHTML = sideHTML(side);
  if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  markFocus();
}

/* ---------------------------------------------------------------------------
   Escenario 3D (stage.js) con vuelta atrás a una versión plana
   ------------------------------------------------------------------------- */
let stage = null, stageState = 'idle', lastKey = '';           // idle · loading · on · off (si falló WebGL o el módulo)
const stageEl = () => $('pmStage');
/** El canvas vive dentro de la caja del paso actual; antes de redibujar el cuerpo lo devolvemos a la raíz para que no se pierda. */
function stageDetach() { const cv = stageEl(); if (cv && cv.parentNode !== root) { stage?.stop?.(); root.insertBefore(cv, $('pmBody')); } }
function ensureStage() {
  if (stageState !== 'idle') return;
  stageState = 'loading';
  import('./stage.js').then(m => {
    try { stage = m.createStage(stageEl()); stageState = 'on'; lastKey = ''; if (open_) renderStage(); }
    catch (e) { stageFailed(e); }
  }).catch(stageFailed);
}
function stageFailed(e) {
  console.warn('Escenario 3D no disponible; se usa la versión plana.', e);
  stageState = 'off'; try { stage?.stop?.(); } catch { /* nada */ }
  stageEl().hidden = true; root?.classList.remove('stage-on'); root?.classList.add('stage-off');
  if (open_) renderStage();
}
/** ¿Qué jugadores y dónde? Cada paso del menú arma su lista. */
const FORM = [[-1.5, 1.6, 0.12], [1.5, 1.6, -0.12], [-3.9, -1.2, 0.3], [3.9, -1.2, -0.3], [0, -3.4, 0]];   // PG SG SF PF C (x, z, giro)
const starOf = r => (r ? r.starters.reduce((a, b) => (b.ovr > a.ovr ? b : a)) : null);
function stageItems() {
  if (S.step === 2) {
    const out = [], pa = starOf(S.rosA), pb = starOf(S.rosB);
    if (pa) out.push({ side: 'A', player: pa, kit: kitObj('A'), team: S.teamA, x: -1.0, z: 0, ry: 0.32 });
    if (pb) out.push({ side: 'B', player: pb, kit: kitObj('B'), team: S.teamB, x: 1.0, z: 0, ry: -0.32 });
    return out;
  }
  if (S.step === 3 && S.rosA) return S.rosA.starters.map((p, i) => ({ side: 'A', player: p, kit: kitObj('A'), team: S.teamA, x: FORM[i][0], z: FORM[i][1], ry: FORM[i][2] }));
  return [];
}
const sceneName = () => (S.step === 2 ? 'kits' : 'lineup');
/** Dibuja (o actualiza) el escenario del paso actual: los jugadores 3D (si hay WebGL) y, encima, nombres y anillos. */
function renderStage() {
  if (S.step !== 2 && S.step !== 3) return;
  const box = $('pmBox'); if (!box) return;
  ensureStage();
  const items = stageItems(), cv = stageEl();
  if (cv.parentNode !== box) box.querySelector('.fc-court').after(cv);
  if (stageState === 'on' && stage) {
    cv.hidden = false; root.classList.add('stage-on'); root.classList.remove('stage-off');
    const key = S.step + '|' + items.map(it => `${it.player.id ?? it.player.name}:${it.kit.id}:${it.team.ab}:${it.player.number}`).join(',');
    try {
      if (key !== lastKey) { stage.show(sceneName(), items); lastKey = key; }
      stage.resize(); stage.start(stageFailed);
    } catch (e) { stageFailed(e); return; }
  } else { cv.hidden = true; root.classList.remove('stage-on'); if (stageState === 'off') root.classList.add('stage-off'); }
  layoutOverlay(items);
}
function relayout() { if (S.step === 2 || S.step === 3) { try { stage?.resize?.(); } catch { /* nada */ } layoutOverlay(stageItems()); } }
function cam() {
  const box = $('pmBox'); if (!box || box.clientWidth < 10 || box.clientHeight < 10) return null;
  const w = box.clientWidth, h = box.clientHeight, cfg = fitCfg(sceneName(), w, h);
  return { w, h, p: (x, y, z) => project(cfg, w, h, x, y, z) };
}

/* Cancha dibujada en SVG con la misma cámara que el 3D (medidas NBA reales; la cesta está al fondo). */
const BASE_Z = -7.2, HOOP_Z = BASE_Z + 1.575;
const COURT = (() => {
  const arc = (cx, cz, r, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
  const zc = HOOP_Z + Math.sqrt(7.24 ** 2 - 6.71 ** 2);                                               // donde el arco de 3 se une con las líneas de las esquinas
  const a0 = Math.atan2(zc - HOOP_Z, -6.71), a1 = Math.atan2(zc - HOOP_Z, 6.71);
  return [
    ['line', [[-7.62, BASE_Z], [7.62, BASE_Z]]],
    ['line', [[-2.44, BASE_Z], [-2.44, -1.41], [2.44, -1.41], [2.44, BASE_Z]]],                        // pintura
    ['line', arc(0, -1.41, 1.83, 0, Math.PI * 2, 36)],                                                  // círculo del tiro libre
    ['line', [[-6.71, BASE_Z], [-6.71, zc], ...arc(0, HOOP_Z, 7.24, a0, a1, 60), [6.71, zc], [6.71, BASE_Z]]],   // línea de 3 puntos
    ['line', [[-0.9, BASE_Z + 1.2], [0.9, BASE_Z + 1.2]]],                                              // tablero
    ['hoop', arc(0, HOOP_Z, 0.23, 0, Math.PI * 2, 20)],                                                 // aro
  ];
})();
function drawCourt(c) {
  const svg = $('pmCourt'); if (!svg) return;
  const pts = l => l.map(([x, z]) => { const q = c.p(x, 0, z); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ');
  const F = [[-7.62, BASE_Z], [7.62, BASE_Z], [7.62, 6.4], [-7.62, 6.4]];
  const draw = ([kind, l]) => (kind === 'hoop' ? `<polyline points="${pts(l)}" fill="none" stroke="#ff8b2c" stroke-width="2.4"/>` : `<polyline points="${pts(l)}" fill="none" stroke="url(#pmLine)" stroke-width="2.2" stroke-linejoin="round"/>`);
  svg.setAttribute('viewBox', `0 0 ${c.w} ${c.h}`);
  svg.innerHTML = `<defs>
    <linearGradient id="pmFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26385f" stop-opacity=".12"/><stop offset=".45" stop-color="#1b2646" stop-opacity=".72"/><stop offset="1" stop-color="#121a33" stop-opacity=".9"/></linearGradient>
    <linearGradient id="pmLine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc53d" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity=".95"/></linearGradient>
    <filter id="pmBlur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <polygon points="${pts(F)}" fill="url(#pmFloor)" stroke="#ffc53d" stroke-opacity=".45" stroke-width="2"/>
    <g filter="url(#pmBlur)" opacity=".75">${COURT.map(draw).join('')}</g><g>${COURT.map(draw).join('')}</g>`;
}

/** Nombres, anillos y (si no hay 3D) figuras planas, todos pegados a los pies de cada jugador. */
function layoutOverlay(items) {
  const ov = $('pmOv'), c = cam(); if (!ov || !c) return; queueMicrotask(padMark);
  if (S.step === 3) drawCourt(c);
  const flat = stageState !== 'on';
  if (S.step === 2) {
    ov.innerHTML = items.map(it => {
      const f = c.p(it.x, 0, it.z), p = it.player, k = it.kit, tc = tint(it.team);
      return `<div class="fc-spot" style="left:${f.x.toFixed(1)}px;top:${f.y.toFixed(1)}px;width:${(f.k * 2.3).toFixed(1)}px;--tc:${tc}"><i></i><i class="b"></i></div>
        ${flat ? `<div class="fc-fig" style="left:${f.x.toFixed(1)}px;top:${f.y.toFixed(1)}px;width:${(f.k * 1.35).toFixed(1)}px">${kitSVG(k, p.number, nickname(it.team))}</div>` : ''}
        <div class="fc-plate ${it.side === 'A' ? 'l' : 'r'}" style="left:${f.x.toFixed(1)}px;top:${f.y.toFixed(1)}px;--tc:${tc}"><span>#${p.number}</span><b>${esc(lastName(p).toUpperCase())}</b><small>${esc(k.name.toUpperCase())} · ${p.pos}</small></div>`;
    }).join('');
  } else if (S.step === 3) {
    ov.innerHTML = items.map((it, i) => {
      const p = it.player, f = c.p(it.x, 0, it.z), sel = S.selStarter === i, star = S.ctrlSlot === i;
      return `<div class="fc-spot lu${sel ? ' sel' : ''}" data-i="${i}" style="left:${f.x.toFixed(1)}px;top:${f.y.toFixed(1)}px;width:${(f.k * 1.5).toFixed(1)}px;--tc:${tint(S.teamA)}"><i></i><i class="b"></i></div>
        ${flat ? `<div class="fc-fig" style="left:${f.x.toFixed(1)}px;top:${f.y.toFixed(1)}px;width:${(f.k * 0.95).toFixed(1)}px">${kitSVG(it.kit, p.number, nickname(it.team))}</div>` : ''}
        <div class="fc-tag${sel ? ' sel' : ''}${star ? ' star' : ''}" style="left:${f.x.toFixed(1)}px;top:${f.y.toFixed(1)}px;--ts:${clampN(f.k / 85, 0.68, 1.15).toFixed(2)}" data-act="starter" data-i="${i}" role="button" tabindex="0">
          <i>${POS[i]}</i><b>${esc(lastName(p))}${p.generic ? '*' : ''}</b><u>${p.ovr}</u>
          <button type="button" class="fc-star${star ? ' on' : ''}" data-act="star" data-i="${i}" title="Con quién arrancás el partido" aria-label="Arrancar con este jugador">★</button>
          <button type="button" class="fc-info" data-act="card" data-side="A" data-i="${i}" title="Ficha" aria-label="Ver ficha">i</button></div>`;
    }).join('');
  }
}

/* ---------------------------------------------------------------------------
   Paso 3 · Camisetas
   ------------------------------------------------------------------------- */
function stepKits() {
  return `${titleHTML()}
    <div class="fc-kitcol l" id="pmKitsA"></div>
    <div class="fc-stagebox kits" id="pmBox"><svg class="fc-court" id="pmCourt" aria-hidden="true"></svg><div class="fc-ov" id="pmOv"></div></div>
    <div class="fc-kitcol r" id="pmKitsB"></div>
    <div class="fc-clash" id="pmClash" hidden></div>`;
}
function afterKits() { renderKitCols(); renderStage(); }
function kitsChanged() { renderKitCols(); renderStage(); }
function renderKitCols() {
  if (S.step !== 2) return;
  for (const side of ['A', 'B']) {
    const team = side === 'A' ? S.teamA : S.teamB, cur = side === 'A' ? S.kitA : S.kitB, ros = side === 'A' ? S.rosA : S.rosB;
    const num = ros ? ros.starters.reduce((a, b) => (b.ovr > a.ovr ? b : a)).number : 23;
    const el = $('pmKits' + side); if (!el) continue;
    const lockK = !!S.online && side === 'B';
    el.innerHTML = `<span class="fc-pill ${side === 'A' ? 'loc' : 'vis'}">${S.online ? (side === 'A' ? 'VOS' : 'RIVAL') : (side === 'A' ? 'LOCAL' : 'VISITANTE')} · ${esc(nickname(team))}</span>
      ${kitsFor(team).map(k => `<button type="button" class="fc-kit${k.id === cur ? ' on' : ''}${lockK ? ' lock' : ''}" ${lockK ? 'tabindex="-1"' : ''} data-act="kit" data-side="${side}" data-id="${k.id}"><span class="svg">${kitSVG(k, num, nickname(team))}</span><b>${k.name}</b><em>${CHECK}</em></button>`).join('')}`;
  }
  const clash = kitsClash(kitObj('A'), kitObj('B')), c = $('pmClash');
  c.hidden = !clash;
  if (clash) c.innerHTML = `<span>⚠ Las camisetas se parecen mucho: en cancha se van a confundir los jugadores.</span><button type="button" class="fc-chip" data-act="kitAuto">${S.online ? 'Elegir otra para mí' : 'Elegir la mejor para el rival'}</button>`;
}

/* ---------------------------------------------------------------------------
   Paso 4 · Tu equipo: quinteto en cancha, banco y táctica
   ------------------------------------------------------------------------- */
function stepLineup() {
  return `<div class="fc-left">${titleHTML()}
      <div class="fc-menu" id="pmMenu"></div>
      <div class="fc-bench" id="pmBench"></div>
    </div>
    <div class="fc-stagebox lineup" id="pmBox"><svg class="fc-court" id="pmCourt" aria-hidden="true"></svg><div class="fc-ov" id="pmOv"></div></div>`;
}
function afterLineup() { renderMenu(); renderBench(); renderStage(); }
function renderMenu() {
  const m = $('pmMenu'); if (!m) return; queueMicrotask(padMark);
  m.innerHTML = `<div class="fc-mi on"><span>Alineación Inicial</span><em>5 + banco</em><i>›</i></div>` +
    STYLE_ROWS.map(([k, label, , desc]) => `<div class="fc-mi" title="${esc(desc)}"><span>${label}</span><div class="v"><button type="button" data-act="optstep" data-key="style.${k}" data-d="-1" aria-label="Anterior">‹</button><b>${labelOf('style.' + k)}</b><button type="button" data-act="optstep" data-key="style.${k}" data-d="1" aria-label="Siguiente">›</button></div></div>`).join('') +
    `<button type="button" class="fc-link" data-act="autoLineup">↺ Restablecer alineación</button>`;
}
function renderBench() {
  const bn = $('pmBench'); if (!bn) return; queueMicrotask(padMark);
  const r = S.rosA;
  if (!r) { bn.innerHTML = '<p class="fc-load">Cargando plantel…</p>'; return; }
  const sel = S.selStarter, selP = sel !== null ? r.starters[sel] : null;
  bn.innerHTML = `<h3>Banco <small>${selP ? `Elegí quién entra por <b>${esc(lastName(selP))}</b>` : 'Tocá a un titular en la cancha para cambiarlo'}</small></h3>
    <div class="fc-bl">${r.bench.length ? r.bench.map((p, j) => `<div class="fc-b${selP ? ' can' : ''}" data-act="${selP ? 'swapin' : 'bench'}" data-i="${j}" role="button" tabindex="0"><i>${p.natural ?? p.pos}</i><b>${esc(lastName(p))}${p.generic ? '*' : ''}</b><u>${p.ovr}</u>${selP ? '<em>ENTRA</em>' : ''}</div>`).join('') : '<p class="fc-load">No hay suplentes cargados.</p>'}</div>`;
}

/* ---------------------------------------------------------------------------
   Paso 5 · Partido + resumen
   ------------------------------------------------------------------------- */
function stepMatch() {
  return `${titleHTML()}<div class="fc-opts" id="pmOpts"></div><div class="fc-sum" id="pmSum"></div>${S.online ? '<div class="fc-ol" id="pmOl"></div>' : ''}`;
}
function afterMatch() { renderOpts(); renderSummary(); renderOnline(); }
/** Panel de la sala (solo online): quién está, quién está listo y el botón de empezar del anfitrión. */
function renderOnline() {
  const el = $('pmOl'), O = S.online; if (!el || !O) return;
  const host = O.role === 'host';
  const card = (role, name, me, on, ready) => `<div class="fc-olp${on ? '' : ' off'}${ready ? ' ready' : ''}"><small>${role}</small><b>${esc(name || (role === 'ANFITRIÓN' ? '—' : 'Esperando jugador…'))}${me ? ' <i>(vos)</i>' : ''}</b><em>${!on ? 'SIN CONECTAR' : ready ? 'LISTO ✓' : 'ELIGIENDO…'}</em></div>`;
  const hostOn = host ? true : O.oppOnline, guestOn = host ? O.oppOnline : true;
  const hostReady = host ? O.meReady : O.oppReady, guestReady = host ? O.oppReady : O.meReady;
  const can = host && O.oppOnline && O.meReady && O.oppReady;
  el.innerHTML = `<div class="fc-olh"><b>SALA ${esc(O.code)}</b><span>${esc(O.name)} · ${O.pub ? 'Pública' : 'Privada'}</span></div>
    <div class="fc-olps">${card('ANFITRIÓN', O.hostName, host, hostOn, hostReady)}${card('INVITADO', O.guestName, !host, guestOn, guestReady)}</div>
    ${host ? `<button type="button" class="fc-btn play fc-olgo" data-act="olStart" ${can ? '' : 'disabled'}><span>EMPEZAR PARTIDO</span></button><p class="fc-olnote">${can ? 'Los dos están listos.' : O.oppOnline ? 'Cuando los dos marquen “Estoy listo” podés empezar.' : 'Pasale el código a tu rival o esperá a que entre desde la lista.'}</p>`
      : `<p class="fc-olnote">${O.oppOnline ? 'Marcá “Estoy listo”. El anfitrión empieza el partido.' : 'Esperando al anfitrión…'}</p>`}`;
}
function renderOpts() {
  const el = $('pmOpts'); if (!el) return; queueMicrotask(padMark);
  el.innerHTML = matchRows().map(([k, label, desc]) => (S.online && LOCKED.has(k)
    ? `<div class="fc-opt locked"><div class="o-t"><b>${label}</b><small>${desc}</small></div><div class="o-v lock"><span class="${k === 'court' ? 'wide' : ''}">${labelOf(k)}</span><em>🔒 ANFITRIÓN</em></div></div>`
    : `<div class="fc-opt"><div class="o-t"><b>${label}</b><small>${desc}</small></div><div class="o-v"><button type="button" data-act="optstep" data-key="${k}" data-d="-1" aria-label="Anterior">‹</button><span class="${k === 'court' ? 'wide' : ''}">${labelOf(k)}</span><button type="button" data-act="optstep" data-key="${k}" data-d="1" aria-label="Siguiente">›</button></div></div>`)).join('');
}
/** Equipo dueño de la cancha: en una sala es el del anfitrión (o el del invitado), sin importar de qué lado lo veas vos. */
function courtTeamNow() {
  if (!S.online) return S.court === 'away' ? S.teamB : S.teamA;
  const hostT = S.online.role === 'host' ? S.teamA : S.teamB, guestT = S.online.role === 'host' ? S.teamB : S.teamA;
  return S.court === 'away' ? guestT : hostT;
}
function renderSummary() {
  const el = $('pmSum'); if (!el) return;
  const side = s => {
    const t = s === 'A' ? S.teamA : S.teamB, r = s === 'A' ? S.rosA : S.rosB, k = kitObj(s);
    return `<div class="fc-sumt" style="--tc:${tint(t)}"><img src="${t.logo}" alt=""><b>${esc(nickname(t))}</b><small>${esc(t.name)}</small><em>OVR ${r ? tovr(r) : '…'}</em><div class="k">${kitSVG(k, r ? r.starters[s === 'A' ? S.ctrlSlot : 0]?.number ?? 23 : 23, nickname(t))}</div><small>${k.name}</small></div>`;
  };
  const style = STYLE_ROWS.map(([k]) => labelOf('style.' + k)).join(' · ');
  el.innerHTML = `<div class="fc-sumvs">${side('A')}<strong>VS</strong>${side('B')}</div>
    <ul><li><span>Cancha</span><b>${courtFor(courtTeamNow()).arena}</b></li>${S.online ? '' : `<li><span>Jugadores</span><b>${S.players}</b></li>`}${S.online ? '' : `<li><span>Dificultad</span><b>${labelOf('diff')}</b></li>`}<li><span>Cuartos</span><b>4 × ${labelOf('qLen')}</b></li><li><span>Cámara</span><b>${labelOf('cam')} · ${labelOf('camHeight')}</b></li>
    <li><span>24 s · Cansancio · Cambios</span><b>${[S.shotClock, S.fatigue, S.autoSubs].map(v => (v ? 'Sí' : 'No')).join(' · ')}</b></li><li><span>Tu estilo</span><b>${style}</b></li></ul>`;
}

/* ---------------------------------------------------------------------------
   API
   ------------------------------------------------------------------------- */
export function init(h) { hooks = h || {}; buildRoot(); }
/** Abre el asistente. `step` = paso inicial (0-4); `banner` = texto arriba del último paso (ej: resultado del partido). */
export function openWizard({ step = 0, banner = '', online = null } = {}) {
  Pad.resetJoin(); justJoined = false;
  if (online) beginOnline(online); else if (S.online) endOnline();
  open_ = true; S.leaveAsk = false; hoverI = -1; S.step = Math.max(S.online ? 1 : 0, Math.min(LAST, step)); S.banner = banner; S.selStarter = null; padZone = 0; padI[0] = padI[1] = 0; padRow = 0; S.focus = 'A';
  root.hidden = false;
  if (!S.rosA) loadSide('A'); if (!S.rosB) loadSide('B');
  render();
}
export function closeWizard() { open_ = false; stage?.stop?.(); if (root) root.hidden = true; if (S.online) endOnline(); }
function close() { closeWizard(); }
export const isOpen = () => open_;

/* ---------------------------------------------------------------------------
   Casual online (la sala la maneja online.js; acá solo se adapta el menú)
   ------------------------------------------------------------------------- */
const FIELDS = ['teamA', 'teamB', 'kitA', 'kitB', 'qLen', 'shotClock', 'fatigue', 'autoSubs', 'court', 'ctrlSlot', 'rosA', 'rosB'];
function beginOnline(o) {
  if (!S.backup) S.backup = Object.fromEntries(FIELDS.map(k => [k, S[k]]));
  S.online = { oppPicked: false, oppCtrl: 0, ...o };
  Object.assign(S, { court: o.settings.court, qLen: o.settings.qLen, shotClock: o.settings.shotClock, fatigue: o.settings.fatigue, autoSubs: o.settings.autoSubs });
  S.players = 1; S.selStarter = null;
  rReq.B++; S.rosB = null;                                         // hasta que el rival elija, no se muestra su plantel
  if (S.teamB === S.teamA) S.teamB = TEAMS.find(t => t !== S.teamA);
  fixClash();
}
function endOnline() {
  if (S.backup) Object.assign(S, S.backup);
  S.backup = null; S.online = null; S.leaveAsk = false;
  rReq.A++; rReq.B++;
  if (!S.rosA) loadSide('A'); if (!S.rosB) loadSide('B');
}
const pkey = p => String(p.id ?? p.name);
/** Lo que el rival necesita saber de mi elección (se manda por el canal de la sala). */
export function getMyPick() {
  const r = S.rosA; if (!S.online || !r) return null;
  return { ab: S.teamA.ab, kit: S.kitA, starters: r.starters.map(pkey), bench: r.bench.map(pkey), ctrl: S.ctrlSlot, style: { ...S.style } };
}
function emitPick() {
  if (!S.online) return;
  clearTimeout(emitPick.t);
  emitPick.t = setTimeout(() => { const p = getMyPick(); if (p) hooks.onOnlineChange?.(p); }, 0);
}
function arrange(c, pk) {                                          // ordena un plantel como lo ordenó su dueño (titulares, banco, posiciones)
  const all = [...c.starters, ...c.bench], by = new Map(all.map(p => [pkey(p), p]));
  if (!pk.starters?.length || pk.starters.some(k => !by.has(k))) return c;
  const used = new Set(pk.starters), bk = (pk.bench || []).filter(k => by.has(k) && !used.has(k));
  const rest = all.filter(p => !used.has(pkey(p)) && !bk.includes(pkey(p)));
  return { starters: pk.starters.map((k, i) => ({ ...by.get(k), pos: POS[i] })), bench: [...bk.map(k => by.get(k)), ...rest].map(p => ({ ...p, pos: p.natural ?? p.pos })) };
}
/** Llegó la elección del rival: equipo, camiseta y alineación. */
export function applyOpponent(pk) {
  if (!S.online || !pk) return;
  const t = teamByAb(pk.ab); if (!t) return;
  const O = S.online; O.oppPicked = true; O.oppCtrl = +pk.ctrl || 0; O.oppStyle = pk.style ? { ...pk.style } : null;
  S.teamB = t; if (pk.kit) S.kitB = pk.kit;
  const changed = fixClash();
  root.style.setProperty('--tcA', tint(S.teamA)); root.style.setProperty('--tcB', tint(S.teamB));
  const req = ++rReq.B; S.rosB = null;
  if (open_) { if (S.step === 1) renderSide('B', true); else if (S.step === 2) { renderKitCols(); renderStage(); } }
  rProm.B = loadRoster(t).catch(() => fallbackRoster(t)).then(r => {
    if (req !== rReq.B || !S.online) return;
    S.rosB = arrange(clone(r), pk);
    onRosters('B');
  });
  if (changed) emitPick();
}
/** online.js avisa cambios de la sala (quién entró, quién está listo…). */
export function onlineUpdate(patch) {
  if (!S.online) return;
  const before = `${S.online.oppName}|${S.online.oppOnline}`;
  Object.assign(S.online, patch);
  if (!open_) return;
  renderHead();
  if (S.step === LAST) renderOnline();
  if (S.step === 1 && before !== `${S.online.oppName}|${S.online.oppOnline}`) renderSide('B');
}
export const onlineToast = t => toast(t);
/** Dispositivo con el que juega este jugador (teclado y mouse o un joystick). */
export function localDevice() { pruneSlots(); const m = S.slots.find(x => x.on) || S.slots[0]; return { dev: m.dev, pad: m.pad }; }
/** Al empezar el partido online se esconde el menú SIN salir de la sala (así después se vuelve al mismo lugar). */
export function hideForMatch() { open_ = false; stage?.stop?.(); closeModal(); if (root) root.hidden = true; }
/** Después del partido: vuelve al último paso de la sala, con el resultado arriba. */
export function resumeOnline(banner = '') {
  if (!S.online) return false;
  Pad.resetJoin(); justJoined = false; open_ = true; S.leaveAsk = false; hoverI = -1;
  S.step = LAST; S.banner = banner; S.selStarter = null; padRow = 0; root.hidden = false; S.online.meReady = false; S.online.oppReady = false;
  render(); return true;
}
function askLeave() {
  S.leaveAsk = true;
  const m = $('pmModal'); if (!m) return;
  m.innerHTML = `<div class="fc-sheet"><div class="fc-sheet-h"><h3>¿Salir de la sala?</h3><button type="button" class="fc-x" data-act="closeModal" aria-label="Cerrar">✕</button></div>
    <p class="fc-leave">${S.online.role === 'host' ? 'Sos el anfitrión: si salís, la sala se cierra para los dos.' : 'Si salís, la sala queda libre para otro jugador.'}</p>
    <div class="fc-leave-b"><button type="button" class="fc-btn ghost" data-act="closeModal">Quedarme</button><button type="button" class="fc-btn" data-act="leaveYes"><span>SALIR</span></button></div></div>`;
  m.hidden = false;
}
