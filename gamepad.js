/* Joystick: mismos botones que NBA 2K (configurables en Configuración) + navegación de menús con el joystick.
   Usa la Gamepad API del navegador: anda con mandos Xbox, PlayStation (DualShock/DualSense), Switch Pro y la mayoría de los genéricos con mapeo "standard". */
export const ACTIONS = [
  { id: 'shoot',   label: 'Tirar (mantené y soltá) · sin pelota: saltar / taponar', def: 2 },
  { id: 'pass',    label: 'Pasar · en defensa: cambiar de jugador',                  def: 0 },
  { id: 'steal',   label: 'Robar · con pelota: cruce',                               def: 1 },
  { id: 'jump',    label: 'Saltar · mate · bandeja',                                 def: 3 },
  { id: 'sprint',  label: 'Correr',                                                  def: 7 },
  { id: 'dribble', label: 'Dribleo veloz (mantener) · cruce',                        def: 5 },
  { id: 'switch',  label: 'Cambiar de jugador',                                      def: 4 },
  { id: 'camera',  label: 'Cambiar cámara',                                          def: 8 },
  { id: 'menu',    label: 'Pausa',                                                    def: 9 },
  { id: 'stats',   label: 'Tabla de puntos (mantener)',                              def: 14 },
  { id: 'mod',     label: 'Lujo (mantener): mates, bandejas y pases especiales',      def: 6 },
];
export const DEFAULTS = Object.fromEntries(ACTIONS.map(a => [a.id, a.def]));
const PS = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS'];
const XB = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', '↑', '↓', '←', '→', 'Guide'];

export const state = { connected: false, id: '', index: -1, style: 'both', lx: 0, ly: 0, rx: 0, ry: 0, mag: 0, rmag: 0, flick: false, down: {}, pressed: {}, released: {}, amt: { sprint: 0 }, raw: [], nav: {}, standard: true };
let S = { pad: { ...DEFAULTS }, dead: 0.22 }, save = () => {}, active = -1, lastIdx = -1, prevRaw = [], listenCb = null, armed = false, flickArmed = true;
const hold = { up: 0, down: 0, left: 0, right: 0 }, listeners = [];

export function init(settings, saveFn) { S = settings; save = saveFn || save; if (S.pad && S.pad.mod === undefined && Object.keys(S.pad).some(k => S.pad[k] === 6)) S.pad = { ...S.pad, mod: -1 };   // si ya usabas L2 para otra cosa, el botón de lujo queda sin asignar
  S.pad = { ...DEFAULTS, ...(S.pad || {}) }; if (typeof S.dead !== 'number') S.dead = 0.22; }
export const bindings = () => S.pad;
export function label(i) {
  if (i == null || i < 0) return '—';
  const p = PS[i], x = XB[i]; if (!p) return `Botón ${i}`;
  return state.style === 'ps' ? p : state.style === 'xbox' ? x : (p === x ? p : `${p} / ${x}`);
}
export function setBinding(action, btn) {                          // si ese botón ya lo usa otra acción, se intercambian
  const old = S.pad[action], other = Object.keys(S.pad).find(k => k !== action && S.pad[k] === btn);
  if (other) S.pad[other] = old;
  S.pad[action] = btn; save();
}
export function resetBindings() { S.pad = { ...DEFAULTS }; save(); }
export function listen(cb) { listenCb = cb; armed = false; return () => { listenCb = null; }; }     // el próximo botón que apretes (después de soltar todos) se manda a cb
export const isListening = () => !!listenCb;
export const onConnect = cb => { listeners.push(cb); };
if (typeof addEventListener === 'function') {
  addEventListener('gamepadconnected', e => { active = e.gamepad.index; listeners.forEach(f => f(true, e.gamepad)); });
  addEventListener('gamepaddisconnected', e => { listeners.forEach(f => f(false, e.gamepad)); });
}
export function hint() {
  const b = S.pad, l = id => label(b[id]);
  return `Joystick: stick izq = moverte · ${l('shoot')} tirar · ${l('pass')} pasar/cambiar · ${l('steal')} robar/cruce · ${l('jump')} saltar · ${l('sprint')} correr (a medias = trote) · stick der = cruce · ${l('stats')} (mantener) tabla de puntos · ${l('menu')} pausa`;
}
export function rumble(ms = 150, mag = 0.5, index = active) {
  if (S.rumble === false) return;
  try { const gp = navigator.getGamepads?.()[index]; Promise.resolve(gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: mag, weakMagnitude: mag * 0.6 })).catch(() => {}); } catch { /* sin vibración */ }
}
function clear() {
  state.lx = state.ly = state.rx = state.ry = state.mag = state.rmag = 0; state.flick = false; state.down = {}; state.pressed = {}; state.released = {}; state.amt = { sprint: 0 }; state.nav = {};
}
/* Forma del stick izquierdo para MOVERSE (v35). Todo ajustable acá:
   curve    : >1 = más fino cerca del centro (inclinar poco = caminar), 1 = lineal
   snap     : las direcciones se "pegan" a 16 rumbos (cada 22,5°) para no caminar torcido; snapTol = qué tan cerca (rad) para pegarse
   turnStand/turnRun : qué tan rápido gira el jugador hacia donde apuntás (rad/s) parado y a toda velocidad. Más bajo = más inercia. */
export const STICK = { curve: 1.35, snap: Math.PI / 8, snapTol: 0.13, turnStand: 18, turnRun: 5.2 };
export function shapeStick(lx, ly) {
  const m = Math.hypot(lx, ly); if (m < 1e-4) return { x: 0, y: 0, mag: 0 };
  let ang = Math.atan2(ly, lx); const q = Math.round(ang / STICK.snap) * STICK.snap;
  if (Math.abs(ang - q) < STICK.snapTol) ang = q;
  const mag = Math.pow(Math.min(1, m), STICK.curve);
  return { x: Math.cos(ang) * mag, y: Math.sin(ang) * mag, mag };
}
function radial(x, y, dz) {                                         // zona muerta radial, la inclinación se reescala a 0..1
  const m = Math.hypot(x, y); if (m <= dz) return [0, 0, 0];
  const k = Math.min(1, (m - dz) / (1 - dz)); return [x / m * k, y / m * k, k];
}
export function update(dt) {
  const pads = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(Boolean);
  const busy = p => p.buttons.some(b => b.pressed) || p.axes.some(v => Math.abs(v) > 0.6);
  let gp = pads.find(p => p.index === active && p.connected);
  if (!gp || !busy(gp)) for (const p of pads) if (p.connected && busy(p)) { gp = p; active = p.index; break; }   // el mando que tocás es el que manda, pero NO se lo roban mientras lo estás usando (con 2 mandos antes saltaba de uno a otro cada cuadro)
  gp ||= pads.find(p => p.connected);
  if (!gp) { state.connected = false; state.id = ''; clear(); prevRaw = []; lastIdx = -1; return state; }
  if (gp.index !== lastIdx) { prevRaw = []; lastIdx = gp.index; }     // cambió el mando activo: los "apretó / soltó" se calculan desde cero (no mezclar botones de dos mandos)
  state.connected = true; state.id = gp.id; state.index = gp.index; state.standard = gp.mapping === 'standard';
  state.style = /054c|playstation|dualshock|dualsense|wireless controller/i.test(gp.id) ? 'ps' : /xbox|045e|xinput|057e|pro controller/i.test(gp.id) ? 'xbox' : 'both';
  const raw = gp.buttons.map(b => !!(b.pressed || b.value > 0.5)), ax = i => gp.axes[i] || 0;
  const [lx, ly, lm] = radial(ax(0), ax(1), S.dead), [rx, ry] = radial(ax(2), ax(3), Math.max(S.dead, 0.15));
  state.lx = lx; state.ly = ly; state.mag = lm; state.rx = rx; state.ry = ry; state.raw = raw;
  const rm = Math.hypot(rx, ry); state.rmag = rm;                   // "flick" del stick derecho: lo empujás rápido hasta el borde y vuelve al centro = un gesto
  state.flick = flickArmed && rm > 0.8; if (state.flick) flickArmed = false; else if (rm < 0.35) flickArmed = true;
  if (listenCb) {                                                   // modo "apretá el botón nuevo"
    clear();
    if (!armed) { if (!raw.some(Boolean)) armed = true; }
    else { const i = raw.findIndex((v, k) => v && !prevRaw[k]); if (i >= 0) { const cb = listenCb; listenCb = null; cb(i); } }
    prevRaw = raw; return state;
  }
  const down = {}, pressed = {}, released = {};
  for (const a of ACTIONS) { const k = S.pad[a.id], d = !!raw[k], was = !!prevRaw[k]; down[a.id] = d; pressed[a.id] = d && !was; released[a.id] = !d && was; }
  state.down = down; state.pressed = pressed; state.released = released;
  const av = i => { const b = gp.buttons[i]; if (!b) return 0; const v = b.value > 0 || !b.pressed ? b.value : 1; return Math.max(0, Math.min(1, (v - 0.08) / 0.62)); };   // gatillos analógicos: 0 (suelto) … 1 (a fondo)
  state.amt = { sprint: av(S.pad.sprint) };
  const sx = ay(gp, 0), sy = ay(gp, 1), horiz = Math.abs(sx) > Math.abs(sy), dirs = { up: raw[12] || (!horiz && sy < -0.6), down: raw[13] || (!horiz && sy > 0.6), left: raw[14] || (horiz && sx < -0.6), right: raw[15] || (horiz && sx > 0.6) }, nav = {};
  for (const k in dirs) {                                           // flechas de menú con repetición al mantener
    if (dirs[k]) { hold[k] += dt; nav[k] = hold[k] === dt || (hold[k] > 0.4 && Math.floor((hold[k] - 0.4) / 0.14) !== Math.floor((hold[k] - dt - 0.4) / 0.14)); } else hold[k] = 0;
  }
  nav.ok = !!raw[0] && !prevRaw[0]; nav.back = !!raw[1] && !prevRaw[1]; nav.start = !!raw[9] && !prevRaw[9];
  nav.x = !!raw[2] && !prevRaw[2]; nav.y = !!raw[3] && !prevRaw[3]; nav.lb = !!raw[4] && !prevRaw[4]; nav.rb = !!raw[5] && !prevRaw[5];
  state.nav = nav; prevRaw = raw; return state;
}
const ay = (gp, i) => gp.axes[i] || 0;

/* ---------- varios joysticks a la vez (partido de 2 a 4 jugadores en la misma PC) ----------
   Cada jugador usa SU joystick. Los botones configurados en Controles valen para todos los joysticks.
   readPad(i) devuelve lo mismo que `state` pero solo del joystick i (con sus propios "apretó / soltó"). */
const styleOf = id => (/054c|playstation|dualshock|dualsense|wireless controller/i.test(id) ? 'ps' : /xbox|045e|xinput|057e|pro controller/i.test(id) ? 'xbox' : 'both');
const readers = new Map();
const rdr = i => { let r = readers.get(i); if (!r) { r = { prev: [], flickArmed: true, join: [] }; readers.set(i, r); } return r; };
const rawPads = () => (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(p => p && p.connected);
export function connectedPads() { return rawPads().map(p => ({ index: p.index, id: p.id, style: styleOf(p.id) })); }
export const padName = i => { const p = navigator.getGamepads?.()[i]; return p && p.connected ? p.id.replace(/\(.*?\)/g, '').trim().slice(0, 38) : ''; };
const emptyPad = i => ({ index: i, connected: false, id: '', style: 'both', lx: 0, ly: 0, rx: 0, ry: 0, mag: 0, rmag: 0, flick: false, down: {}, pressed: {}, released: {}, amt: { sprint: 0 }, raw: [] });
export function readPad(index) {
  const gp = navigator.getGamepads?.()[index], R = rdr(index), out = emptyPad(index);
  if (!gp || !gp.connected) { R.prev = []; R.flickArmed = true; return out; }
  const raw = gp.buttons.map(b => !!(b.pressed || b.value > 0.5)), ax = k => gp.axes[k] || 0;
  const [lx, ly, lm] = radial(ax(0), ax(1), S.dead), [rx, ry] = radial(ax(2), ax(3), Math.max(S.dead, 0.15));
  Object.assign(out, { connected: true, id: gp.id, style: styleOf(gp.id), lx, ly, mag: lm, rx, ry, raw });
  const rm = Math.hypot(rx, ry); out.rmag = rm;
  out.flick = R.flickArmed && rm > 0.8; if (out.flick) R.flickArmed = false; else if (rm < 0.35) R.flickArmed = true;
  for (const a of ACTIONS) { const k = S.pad[a.id], d = !!raw[k], was = !!R.prev[k]; out.down[a.id] = d; out.pressed[a.id] = d && !was; out.released[a.id] = !d && was; }
  const av = k => { const b = gp.buttons[k]; if (!b) return 0; const v = b.value > 0 || !b.pressed ? b.value : 1; return Math.max(0, Math.min(1, (v - 0.08) / 0.62)); };
  out.amt = { sprint: av(S.pad.sprint) };
  R.prev = raw; return out;
}
/* ¿qué joystick acaba de apretar un botón? (para "apretá un botón para entrar al partido"). Devuelve el índice o -1 */
export function joinPoll() {
  let found = -1;
  for (const p of rawPads()) {
    const R = rdr(p.index), raw = p.buttons.map(b => !!(b.pressed || b.value > 0.5));
    if (found < 0 && raw.some((v, k) => v && !R.join[k])) found = p.index;
    R.join = raw;
  }
  return found;
}
/* igual que joinPoll pero devuelve TODOS los joysticks que acaban de apretar un botón (si dos aprietan en el mismo cuadro, no se pierde ninguno) */
export function joinPollAll() {
  const out = [];
  for (const p of rawPads()) {
    const R = rdr(p.index), raw = p.buttons.map(b => !!(b.pressed || b.value > 0.5));
    if (raw.some((v, k) => v && !R.join[k])) out.push(p.index);
    R.join = raw;
  }
  return out;
}
export const resetJoin = () => { for (const p of rawPads()) rdr(p.index).join = p.buttons.map(b => !!(b.pressed || b.value > 0.5)); };


/* ---------- navegación de menús con el joystick (spatial focus sobre botones/tarjetas) ---------- */
let cur = null, curSig = '';
const sigOf = el => el ? [el.tagName, el.dataset?.a || el.dataset?.act || '', el.dataset?.id || '', el.dataset?.v || '', (el.textContent || '').trim().slice(0, 24)].join('|') : '';
const isCr = r => r.id === 'cr' || !!r.closest?.('#cr');
const SEL = r => isCr(r) ? 'button, [data-act], [data-a], input, select, textarea, a[href]' : 'button, [data-act], input, select, textarea, a[href]';   // en carrera también son botones los elementos con data-a (filas, equipos, colores)
const itemsOf = r => { const l = [...r.querySelectorAll(SEL(r))].filter(vis); return isCr(r) ? l.filter(e => !l.some(o => o !== e && e.contains(o))) : l; };      // en carrera, si uno contiene a otro vale el de adentro
const $ = id => document.getElementById(id);
const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 6 || r.height < 6 || el.disabled) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
function activeRoot() {
  const c = $('controls'); if (c && !c.hidden) return c;
  const s = $('settings'); if (s && !s.hidden) return s;
  const pz = $('pause'); if (pz && !pz.hidden) return pz;
  const om = $('olModal'); if (om && !om.hidden) return om;
  const pm = $('pm'), m = $('pmModal'); if (pm && !pm.hidden && m && !m.hidden) return m;
  const ut = $('ut'); if (ut && !ut.hidden) return ut.querySelector('.ut-modal') || ut;
  const cr = $('cr'); if (cr && !cr.hidden) { const b = cr.querySelector('.busy'); if (b && !b.hidden) return null; return cr.querySelector('.modal') || cr; }       // modo carrera: con una ventana abierta, el joystick se mueve solo dentro de ella
  for (const id of ['auth', 'main', 'ts', 'ol', 'pm']) { const e = $(id); if (e && !e.hidden) return e; }
  return null;
}
function setFocus(el) {
  cur?.classList.remove('pad-focus'); cur = el; curSig = sigOf(el);
  if (el) { el.classList.add('pad-focus'); el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }
}
if (typeof document !== 'undefined') document.addEventListener('mousemove', () => { cur?.classList.remove('pad-focus'); }, { passive: true });
export function menuNav(P) {
  if (!P.connected || isListening()) return;
  if (cur && !cur.isConnected && curSig && $('cr') && !$('cr').hidden) {                          // la pantalla se redibujó (carrera): el foco vuelve al mismo botón
    const r = activeRoot(), same = r && itemsOf(r).find(e => sigOf(e) === curSig); if (same) setFocus(same); else cur = null;
  }
  const n = P.nav, any = n.up || n.down || n.left || n.right || n.ok || n.back;   // (x / y / lb / rb / start los usan pantallas con navegación propia, como el menú previo)
  if (!any) return;
  const root = activeRoot(); if (!root) return;
  const items = itemsOf(root);
  if (!items.length) return;
  if (!cur || !items.includes(cur)) { setFocus(items.find(e => e.classList.contains('on')) || items[0]); if (n.ok || n.back) { /* sigue: actúa sobre ese elemento */ } else if (!(n.up || n.down || n.left || n.right)) return; }
  cur.classList.add('pad-focus');
  if (n.back) {
    const back = root.querySelector('#setClose, #pmBack, [data-act="back"], [data-act="close"], [data-act="cancel"], [data-a="back"], [data-a="close"], [data-a="cancel"]');
    if (back && vis(back)) back.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
    return;
  }
  if (n.ok) { if (cur.tagName === 'INPUT' && cur.type === 'range') return; if (cur.tagName === 'INPUT' && cur.type === 'checkbox') cur.click(); else if (cur.tagName === 'INPUT' || cur.tagName === 'TEXTAREA') cur.focus(); else cur.click(); return; }
  if (cur.tagName === 'INPUT' && cur.type === 'checkbox' && (n.left || n.right)) { if (cur.checked !== !!n.right) cur.click(); return; }       // checkbox: derecha = sí, izquierda = no
  if (cur.tagName === 'INPUT' && cur.type === 'range' && (n.left || n.right)) {          // sliders: izquierda/derecha cambian el valor
    const st = +cur.step || 1, v = +cur.value + (n.right ? st : -st); cur.value = Math.min(+cur.max, Math.max(+cur.min, v)); cur.dispatchEvent(new Event('input', { bubbles: true })); return;
  }
  /* Navegación por filas (v35): ← → solo se mueven dentro de la misma fila (sin saltar a otra); ↑ ↓ pasan a la fila de arriba / abajo
     y caen en el elemento que quede más alineado. Nada de saltos en diagonal ni a cualquier lado como un mouse. */
  const rect = el => { const r = el.getBoundingClientRect(); return { el, cx: r.left + r.width / 2, cy: r.top + r.height / 2, tol: Math.max(10, r.height * 0.55) }; };
  const cells = items.map(rect).sort((a, b) => a.cy - b.cy || a.cx - b.cx), rows = [];
  for (const c of cells) { const row = rows.find(r => Math.abs(r.cy - c.cy) <= Math.max(r.tol, c.tol)); if (row) { row.items.push(c); row.cy = (row.cy * (row.items.length - 1) + c.cy) / row.items.length; } else rows.push({ cy: c.cy, tol: c.tol, items: [c] }); }
  rows.sort((a, b) => a.cy - b.cy); rows.forEach(r => r.items.sort((a, b) => a.cx - b.cx));
  const ri = rows.findIndex(r => r.items.some(c => c.el === cur)); if (ri < 0) return;
  const me = rows[ri].items.find(c => c.el === cur);
  if (n.left || n.right) {
    const k = rows[ri].items.indexOf(me) + (n.right ? 1 : -1), t = rows[ri].items[k];
    if (t) setFocus(t.el);
  } else {
    const row = rows[ri + (n.down ? 1 : -1)];
    if (row) setFocus(row.items.reduce((b, c) => Math.abs(c.cx - me.cx) < Math.abs(b.cx - me.cx) ? c : b).el);
  }
}
