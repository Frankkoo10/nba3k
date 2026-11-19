/* Menú de pausa (estilo Rocket League): Reanudar · Configuración · Controles · Salir.
   Se abre con Esc / P / Start del joystick, o solo si soltás el mouse en cámara libre. */
import * as Pad from './gamepad.js';
import * as Controls from './controls.js';
import * as UI from './ui.js';

const $ = id => document.getElementById(id);
let H = {}, items = [], sel = 0, open_ = false, confirmT = 0, confirming = false;
let view = 'menu', sCol = 0, sIdx = [0, 0], pick = null, sMsg = '';            // v65: pantalla de cambios (view = 'subs')
export const isOpen = () => open_;

function list() {
  const training = H.isTraining?.();
  return [
    { id: 'resume', label: 'Reanudar juego', run: () => resume() },
    ...(training ? [{ id: 'restart', label: 'Reiniciar jugada', run: () => { resume(); H.onRestart?.(); } }, { id: 'change', label: 'Cambiar cancha / jugador', run: () => { close(); H.onChange?.(); } }] : []),
    ...(H.canSubs?.() ? [{ id: 'subs', label: 'Cambios', run: () => openSubs() }] : []),
    { id: 'settings', label: 'Configuración', run: () => UI.openSettings() },
    { id: 'controls', label: 'Controles', run: () => Controls.open() },
    { id: 'exit', label: training ? 'Salir al menú principal' : 'Abandonar partido', danger: true, run: () => {
      if (!confirming) { confirming = true; render(); clearTimeout(confirmT); confirmT = setTimeout(() => { confirming = false; render(); }, 3500); return; }
      confirming = false; clearTimeout(confirmT); close(); H.onExit?.();
    } },
  ];
}
function render() {
  items = list(); sel = Math.min(sel, items.length - 1);
  const nav = $('pzList'); nav.innerHTML = '';
  items.forEach((it, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pz-item' + (it.danger ? ' danger' : '') + (i === sel ? ' on' : '') + (it.id === 'exit' && confirming ? ' confirm' : '');
    b.style.setProperty('--i', i);
    b.innerHTML = `<span>${it.id === 'exit' && confirming ? '¿Seguro? Tocá de nuevo para salir' : it.label}</span>`;
    if (it.id === 'resume') b.dataset.act = 'back';          // el botón "atrás" del joystick (○ / B) reanuda
    b.onmouseenter = () => { sel = i; mark(); };
    b.onclick = () => { sel = i; mark(); it.run(); };
    nav.appendChild(b);
  });
}
function mark() { [...$('pzList').children].forEach((b, k) => b.classList.toggle('on', k === sel)); }

export function init(handlers) { H = handlers; }
export function open() {
  if (open_) return;
  open_ = true; sel = 0; confirming = false; view = 'menu'; pick = null; sMsg = ''; subsEl().hidden = true;
  H.onOpen?.();
  $('pzMode').textContent = H.isTraining?.() ? 'ENTRENAMIENTO' : 'PARTIDO CASUAL';
  $('pzInfo').innerHTML = H.info?.() || '';
  $('pzHint').innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd> mover</span><span><kbd>Enter</kbd> elegir</span><span><kbd>Esc</kbd> reanudar</span>'
    + (Pad.state.connected ? `<span><kbd>${Pad.label(0)}</kbd> elegir</span><span><kbd>${Pad.label(1)}</kbd> reanudar</span>` : '');
  render(); $('pause').hidden = false;
}
function close() { open_ = false; view = 'menu'; subsEl().hidden = true; confirming = false; clearTimeout(confirmT); $('pause').hidden = true; document.activeElement?.blur?.(); }
export function resume() { if (!open_) return; close(); H.onResume?.(); }

document.addEventListener('keydown', e => {
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (Pad.isListening()) return;
  if (!open_) {
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat && H.canOpen?.()) { open(); e.preventDefault(); e.stopImmediatePropagation(); }
    return;
  }
  if (Controls.isOpen() || !$('settings').hidden) return;      // esas pantallas manejan sus propias teclas
  if (view === 'subs') {
    const eatS = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (e.code === 'Escape' || e.code === 'KeyP') { eatS(); if (!e.repeat) closeSubs(); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { eatS(); moveSubs(0, 1); } else if (e.code === 'ArrowUp' || e.code === 'KeyW') { eatS(); moveSubs(0, -1); }
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD') { eatS(); moveSubs(1, 0); }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { eatS(); if (!e.repeat) chooseSub(); }
    return;
  }
  const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };       // el mismo Enter no debe llegar al menú principal que se abre al salir
  if (e.code === 'Escape' || e.code === 'KeyP') { eat(); if (!e.repeat) resume(); return; }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { sel = (sel + 1) % items.length; mark(); eat(); }
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') { sel = (sel - 1 + items.length) % items.length; mark(); eat(); }
  else if (e.code === 'Enter' || e.code === 'NumpadEnter') { eat(); if (!e.repeat) items[sel].run(); }
});

/* ============ v65 · Cambios desde la pausa + joystick ============
   Pantalla "Cambios": a la izquierda los 5 de la cancha con su energía, a la derecha el banco con la suya.
   Elegí uno de la cancha y uno del banco y se cambian (infinitos). Los del banco se recuperan mientras tanto.
   Mouse: clic en los dos · Teclado: ↑ ↓ ← → y Enter · Joystick: cruceta / stick izquierdo y el botón de aceptar (✕ / A); ○ / B vuelve. */
let subsNode = null;
function subsEl() {
  if (subsNode) return subsNode;
  subsNode = document.createElement('div'); subsNode.id = 'pzSubs'; subsNode.hidden = true;
  $('pause').appendChild(subsNode); return subsNode;
}
const col = e => (e >= 60 ? '#4fe08a' : e >= 30 ? '#ffc53d' : '#ff5a4a');
function row(c, p, i) {
  const on = sCol === c && sIdx[c] === i, pk = pick && pick.c === c && pick.i === i;
  return `<button type="button" class="sb-row${on ? ' on' : ''}${pk ? ' pick' : ''}${p.ctl ? ' ctl' : ''}" data-c="${c}" data-i="${i}"><b>#${p.num}</b><span>${p.name}${p.ctl ? ' <em>(vos)</em>' : ''}</span><i>${p.pos} · ${p.ovr}</i><u class="bar"><s style="width:${p.e}%;background:${col(p.e)}"></s></u><q>${p.e}%</q></button>`;
}
function renderSubs() {
  const D = H.subsData(), el = subsEl();
  sIdx[0] = Math.min(sIdx[0], D.court.length - 1); sIdx[1] = Math.min(sIdx[1], Math.max(0, D.bench.length - 1));
  el.innerHTML = `<div class="sb-wrap"><small>PAUSA</small><h2>CAMBIOS · ${D.team}</h2>
    <p class="sb-help">${pick ? (pick.c === 0 ? 'Ahora elegí a quién del <b>banco</b> metés.' : 'Ahora elegí a quién de la <b>cancha</b> sacás.') : 'Elegí un jugador de la cancha y uno del banco para cambiarlos. Los del banco se recuperan mientras descansan.'}${sMsg ? `<span class="sb-ok">${sMsg}</span>` : ''}</p>
    <div class="sb-cols"><div class="sb-col"><h4>EN CANCHA</h4>${D.court.map((p, i) => row(0, p, i)).join('')}</div>
    <div class="sb-col"><h4>BANCO</h4>${D.bench.map((p, i) => row(1, p, i)).join('') || '<p class="mute">No hay suplentes.</p>'}</div></div>
    <div class="pz-hints"><span><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> mover</span><span><kbd>Enter</kbd> elegir / cambiar</span><span><kbd>Esc</kbd> volver</span>${Pad.state.connected ? `<span><kbd>${Pad.label(0)}</kbd> elegir</span><span><kbd>${Pad.label(1)}</kbd> volver</span>` : ''}</div></div>`;
  el.querySelectorAll('.sb-row').forEach(b => { b.onclick = () => { sCol = +b.dataset.c; sIdx[sCol] = +b.dataset.i; chooseSub(); }; });
}
function openSubs() { view = 'subs'; pick = null; sMsg = ''; sCol = 0; sIdx = [0, 0]; $('pause').querySelector('.pz-left').style.visibility = 'hidden'; $('pzInfo').style.visibility = 'hidden'; subsEl().hidden = false; renderSubs(); }
function closeSubs() { view = 'menu'; pick = null; subsEl().hidden = true; $('pause').querySelector('.pz-left').style.visibility = ''; $('pzInfo').style.visibility = ''; render(); }
function chooseSub() {
  const i = sIdx[sCol];
  if (!pick) { pick = { c: sCol, i }; sMsg = ''; }
  else if (pick.c === sCol) { pick = pick.i === i ? null : { c: sCol, i }; }                  // mismo lado: cambia la elección (o la saca si tocás el mismo)
  else {
    const ci = pick.c === 0 ? pick.i : i, bi = pick.c === 1 ? pick.i : i, D = H.subsData();
    const out = D.court[ci]?.name, inn = D.bench[bi]?.name;
    if (H.subSwap(ci, bi)) sMsg = `Entra ${inn} por ${out}`;
    pick = null; if (sCol === 1) sCol = 0;
  }
  renderSubs();
}
function moveSubs(dx, dy) {
  const D = H.subsData(); if (dx) { const n = sCol === 0 ? 1 : 0; if ((n === 1 ? D.bench.length : D.court.length)) sCol = n; }
  if (dy) { const len = (sCol === 0 ? D.court : D.bench).length; if (len) sIdx[sCol] = (sIdx[sCol] + dy + len) % len; }
  renderSubs();
}
/** ¿Maneja el joystick esta pantalla por su cuenta? (si hay Configuración o Controles abiertos, los maneja el menú general) */
export const ownsPad = () => open_ && !Controls.isOpen() && $('settings').hidden;
/** Joystick en la pausa: cruceta / stick para moverse, aceptar para elegir, atrás para volver, Start para reanudar. */
export function onPad(P) {
  if (!open_ || !ownsPad()) { return false; }
  const n = P.nav || {};
  if (view === 'subs') {
    if (n.back || n.start) closeSubs();
    else if (n.up) moveSubs(0, -1); else if (n.down) moveSubs(0, 1); else if (n.left || n.right) moveSubs(1, 0);
    else if (n.ok) chooseSub();
    return true;
  }
  if (n.start || n.back) { resume(); return true; }
  if (n.up) { sel = (sel - 1 + items.length) % items.length; mark(); }
  else if (n.down) { sel = (sel + 1) % items.length; mark(); }
  else if (n.ok) items[sel]?.run();
  return true;
}
