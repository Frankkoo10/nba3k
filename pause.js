/* Menú de pausa (estilo Rocket League): Reanudar · Configuración · Controles · Salir.
   Se abre con Esc / P / Start del joystick, o solo si soltás el mouse en cámara libre. */
import * as Pad from './gamepad.js';
import * as Controls from './controls.js';
import * as UI from './ui.js';

const $ = id => document.getElementById(id);
let H = {}, items = [], sel = 0, open_ = false, confirmT = 0, confirming = false;
export const isOpen = () => open_;

function list() {
  const training = H.isTraining?.();
  return [
    { id: 'resume', label: 'Reanudar juego', run: () => resume() },
    ...(training ? [{ id: 'restart', label: 'Reiniciar jugada', run: () => { resume(); H.onRestart?.(); } }, { id: 'change', label: 'Cambiar cancha / jugador', run: () => { close(); H.onChange?.(); } }] : []),
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
  open_ = true; sel = 0; confirming = false;
  H.onOpen?.();
  $('pzMode').textContent = H.isTraining?.() ? 'ENTRENAMIENTO' : 'PARTIDO CASUAL';
  $('pzInfo').innerHTML = H.info?.() || '';
  $('pzHint').innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd> mover</span><span><kbd>Enter</kbd> elegir</span><span><kbd>Esc</kbd> reanudar</span>'
    + (Pad.state.connected ? `<span><kbd>${Pad.label(0)}</kbd> elegir</span><span><kbd>${Pad.label(1)}</kbd> reanudar</span>` : '');
  render(); $('pause').hidden = false;
}
function close() { open_ = false; confirming = false; clearTimeout(confirmT); $('pause').hidden = true; document.activeElement?.blur?.(); }
export function resume() { if (!open_) return; close(); H.onResume?.(); }
export function onPad(P) {
  if (open_ && P.nav?.start && !Controls.isOpen() && $('settings').hidden) resume();
}

document.addEventListener('keydown', e => {
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (Pad.isListening()) return;
  if (!open_) {
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat && H.canOpen?.()) { open(); e.preventDefault(); e.stopImmediatePropagation(); }
    return;
  }
  if (Controls.isOpen() || !$('settings').hidden) return;      // esas pantallas manejan sus propias teclas
  const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };       // el mismo Enter no debe llegar al menú principal que se abre al salir
  if (e.code === 'Escape' || e.code === 'KeyP') { eat(); if (!e.repeat) resume(); return; }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { sel = (sel + 1) % items.length; mark(); eat(); }
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') { sel = (sel - 1 + items.length) % items.length; mark(); eat(); }
  else if (e.code === 'Enter' || e.code === 'NumpadEnter') { eat(); if (!e.repeat) items[sel].run(); }
});
