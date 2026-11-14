/* Pantalla de CONTROLES: cómo se juega con teclado/mouse y con joystick, y cambiar cada botón.
   Se abre desde el menú de pausa y desde Configuración. */
import * as KB from './keyboard.js';
import * as Pad from './gamepad.js';

const $ = id => document.getElementById(id);
let built = false, tab = 'kb', onClose = null, slotEls = [], listenEl = null;
export const isOpen = () => { const e = $('controls'); return !!e && !e.hidden; };

const kbL = id => { const [a, b] = KB.bindings()[id]; return [a, b].filter(Boolean).map(KB.label).join(' / ') || '—'; };
const padL = id => Pad.label(Pad.bindings()[id]);

const tips = () => tab === 'kb' ? [
  `Movete con <b>${kbL('up')}</b> <b>${kbL('left')}</b> <b>${kbL('down')}</b> <b>${kbL('right')}</b> y mantené <b>${kbL('sprint')}</b> para correr (gasta energía).`,
  `<b>Tirar:</b> mantené <b>${kbL('shoot')}</b> para cargar el tiro y soltá cuando la barra toque la línea blanca (tiro perfecto).`,
  `<b>Pasar:</b> <b>${kbL('pass')}</b> le pasa a la flecha verde. <b>${kbL('dribble')}</b> = cruce; mantenelo para dribleo veloz.`,
  `<b>Cerca del aro,</b> <b>${kbL('jump')}</b> = bandeja (lento) o mate (corriendo). Sin la pelota sirve para saltar, taponar y pelear rebotes.`,
  `<b>Defensa:</b> <b>${kbL('steal')}</b> roba (si insistís, te cobran falta) · <b>${kbL('switch')}</b> cambia de jugador.`,
  `<b>${kbL('camera')}</b> cambia la cámara (2K / TV / libre). En cámara libre el mouse mueve la vista; la rueda hace zoom.`,
  `<b>Esc</b> o <b>P</b> = pausa.`,
  `<b>De a 2, 3 o 4 en la misma PC:</b> vos (J1) jugás con teclado y mouse; los demás, cada uno con su joystick (ver la pestaña Joystick).`,
] : [
  `<b>Stick izquierdo:</b> moverte. Cuanto más lo inclinás, más rápido vas.`,
  `<b>${padL('sprint')}:</b> correr. Apretalo a medias = trote, a fondo = sprint.`,
  `<b>Con la pelota:</b> <b>${padL('shoot')}</b> mantené y soltá en la línea blanca · <b>${padL('pass')}</b> pasar · <b>${padL('steal')}</b> cruce · <b>${padL('dribble')}</b> dribleo veloz. <b>Stick derecho:</b> un empujón rápido = cruce.`,
  `<b>Sin la pelota</b> (los botones cambian solos y se ven en pantalla): <b>${padL('shoot')}</b> tapona / rebota · <b>${padL('pass')}</b> cambia de jugador · <b>${padL('steal')}</b> roba.`,
  `<b>${padL('jump')}:</b> saltar. Cerca del aro = bandeja o mate.`,
  `<b>De a 2, 3 o 4:</b> cada joystick maneja a su propio jugador con estos mismos botones. Se suman en <b>Partido casual → Jugadores</b> apretando un botón; ◀ ▶ elige el equipo y ○ sale. <b>${padL('pass')}</b> sin la pelota cambia a un compañero libre.`,
  `<b>Cruceta ↑ ↓:</b> zoom · <b>${padL('camera')}:</b> cámara · <b>${padL('menu')}:</b> pausa. En cámara libre, el stick derecho mueve la vista.`,
];
const fixedRows = () => tab === 'kb' ? [['Pausa', 'Esc / P'], ['Zoom de cámara', 'Rueda del mouse'], ['Mirar (cámara libre)', 'Mouse']]
  : [['Moverte', 'Stick izquierdo'], ['Cruce rápido / mirar (cámara libre)', 'Stick derecho'], ['Zoom de cámara', 'Cruceta ↑ ↓']];

function build() {
  built = true;
  $('controls').innerHTML = `
    <div class="ct-box" role="dialog" aria-label="Controles">
      <header><div><small>BASKET 3D</small><h2>CONTROLES</h2></div>
        <div class="ct-tabs"><button type="button" data-tab="kb">TECLADO Y MOUSE</button><button type="button" data-tab="pad">JOYSTICK <em id="ctPadDot"></em></button></div></header>
      <div class="ct-body">
        <div class="ct-table" id="ctTable"></div>
        <aside class="ct-how"><h3>CÓMO SE JUEGA</h3><ul id="ctTips"></ul></aside>
      </div>
      <p class="ct-note" id="ctNote"></p>
      <footer><button type="button" class="ghost" id="ctReset">Restaurar valores</button><button type="button" id="ctBack" data-act="back">Volver</button></footer>
    </div>`;
  $('controls').querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { stopListen(); tab = b.dataset.tab; render(); }; });
  $('ctReset').onclick = () => { stopListen(); (tab === 'kb' ? KB : Pad).resetBindings(); refresh(); };
  $('ctBack').onclick = close;
}
function render() {
  const kb = tab === 'kb';
  $('controls').querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('ctReset').textContent = kb ? 'Restaurar teclado' : 'Restaurar botones de NBA 2K';
  const t = $('ctTable'); t.innerHTML = ''; slotEls = [];
  const head = document.createElement('div'); head.className = 'ct-row ct-head' + (kb ? '' : ' one');
  head.innerHTML = kb ? '<span>ACCIÓN</span><span>PRINCIPAL</span><span>SECUNDARIA</span>' : '<span>ACCIÓN</span><span>BOTÓN</span>'; t.appendChild(head);
  (kb ? KB : Pad).ACTIONS.forEach(a => {
    const row = document.createElement('div'); row.className = 'ct-row' + (kb ? '' : ' one');
    row.innerHTML = `<span>${a.label}</span>`;
    const slots = kb ? [0, 1] : [0];
    slots.forEach(s => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost ct-slot'; b.dataset.action = a.id; b.dataset.slot = s;
      b.onclick = () => startListen(b, a.id, s);
      row.appendChild(b); slotEls.push(b);
    });
    t.appendChild(row);
  });
  fixedRows().forEach(([k, v]) => { const r = document.createElement('div'); r.className = 'ct-row fixed' + (kb ? '' : ' one'); r.innerHTML = `<span>${k}</span><b>${v}</b>`; t.appendChild(r); });
  refresh();
}
function refresh() {                                   // actualiza los textos sin reconstruir (así el foco del joystick no salta)
  const kb = tab === 'kb';
  for (const b of slotEls) {
    if (b === listenEl) continue;
    b.classList.remove('listening');
    b.textContent = kb ? KB.label(KB.bindings()[b.dataset.action][+b.dataset.slot]) : Pad.label(Pad.bindings()[b.dataset.action]);
    b.classList.toggle('empty', b.textContent === '—');
  }
  $('ctTips').innerHTML = tips().map(x => `<li>${x}</li>`).join('');
  $('ctPadDot').className = Pad.state.connected ? 'on' : '';
  $('ctNote').textContent = kb
    ? 'Tocá una casilla y apretá la tecla o el botón del mouse que quieras (clic izq. sobre la misma casilla = botón izquierdo). Esc cancela · Retroceso la borra · si ya se usa en otra acción, se intercambian.'
    : (Pad.state.connected ? 'Tocá un botón de la lista y apretá el botón nuevo en tu joystick. Si ya se usa en otra acción, se intercambian.' : 'No se detecta joystick: conectalo y apretá cualquier botón. Igual podés cambiar la configuración desde ya.');
}
function stopListen() {
  KB.stopListening(); Pad.listen(null);
  if (listenEl) { const e = listenEl; listenEl = null; e.classList.remove('listening'); }
  refresh();
}
function startListen(btn, action, slot) {
  stopListen();
  listenEl = btn; btn.classList.add('listening'); btn.blur();
  if (tab === 'kb') {
    btn.textContent = 'Apretá una tecla…';
    KB.listen((code, why) => {
      if (code === false) { btn.textContent = why; return; }                          // tecla no permitida: sigue esperando
      const e = listenEl; listenEl = null; if (e) e.classList.remove('listening');
      if (code === 'clear') KB.clearBinding(action, slot); else if (code) KB.setBinding(action, slot, code);
      refresh();
    });
  } else {
    btn.textContent = 'Apretá un botón…';
    Pad.listen(i => { listenEl = null; btn.classList.remove('listening'); Pad.setBinding(action, i); refresh(); });
  }
}

export function open(cb) {
  if (!built) build();
  onClose = cb || null; tab = Pad.state.connected && tab === 'pad' ? 'pad' : tab;
  $('controls').hidden = false; render();
}
export function close() {
  if (!isOpen()) return;
  stopListen(); $('controls').hidden = true; document.activeElement?.blur?.();
  const f = onClose; onClose = null; f?.();
}

/* teclas: el captureKey de keyboard.js se llama desde main.js (cuando hay una casilla esperando); acá solo Esc para cerrar */
document.addEventListener('keydown', e => {
  if (!isOpen()) return;
  if (KB.isListening()) { if (!KB.captureKey(e)) return; e.stopImmediatePropagation(); return; }     // la casilla espera una tecla (Esc la cancela)
  if (Pad.isListening()) { if (e.code === 'Escape') { stopListen(); e.preventDefault(); e.stopImmediatePropagation(); } return; }
  if (e.code === 'Escape') { close(); e.preventDefault(); e.stopImmediatePropagation(); }
  else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { const b = [...$('controls').querySelectorAll('[data-tab]')]; if (e.target.closest?.('.ct-tabs')) { tab = e.code === 'ArrowLeft' ? 'kb' : 'pad'; render(); b.find(x => x.dataset.tab === tab)?.focus(); e.preventDefault(); } }
}, true);
document.addEventListener('mousedown', e => {
  if (!isOpen() || !KB.isListening()) return;
  const onSlot = e.target === listenEl;
  if (KB.captureMouse(e, onSlot)) return;                // se asignó un botón del mouse
  if (!onSlot && e.button === 0) stopListen();            // clic izquierdo en otro lado: cancelar
}, true);
Pad.onConnect(() => { if (isOpen()) refresh(); });
