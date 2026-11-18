/* Teclado + mouse remapeables. Cada acción tiene 2 casillas (principal / secundaria), como en Rocket League.
   Un "código" es un KeyboardEvent.code ('KeyW', 'Space'…) o un botón del mouse ('Mouse0' izq., 'Mouse1' central, 'Mouse2' der.…). */
export const ACTIONS = [
  { id: 'up',      label: 'Moverse adelante',                          def: ['KeyW', 'ArrowUp'] },
  { id: 'down',    label: 'Moverse atrás',                             def: ['KeyS', 'ArrowDown'] },
  { id: 'left',    label: 'Moverse a la izquierda',                    def: ['KeyA', 'ArrowLeft'] },
  { id: 'right',   label: 'Moverse a la derecha',                      def: ['KeyD', 'ArrowRight'] },
  { id: 'sprint',  label: 'Correr',                                    def: ['ShiftLeft', null] },
  { id: 'shoot',   label: 'Tirar (mantené y soltá)',                   def: ['Mouse0', null] },
  { id: 'jump',    label: 'Saltar · mate · bandeja · taponar',         def: ['Space', null] },
  { id: 'pass',    label: 'Pasar',                                     def: ['KeyE', 'Mouse2'] },
  { id: 'dribble', label: 'Driblear / cruce (mantener = dribleo veloz)', def: ['ControlLeft', 'KeyV'] },
  { id: 'steal',   label: 'Robar',                                     def: ['KeyF', null] },
  { id: 'switch',  label: 'Cambiar de jugador',                        def: ['KeyQ', null] },
  { id: 'camera',  label: 'Cambiar cámara',                            def: ['KeyC', null] },
  { id: 'mod',     label: 'Lujo (mantener): mates, bandejas y pases especiales', def: ['KeyZ', null] },
  { id: 'stats',   label: 'Tabla de puntos (mantener)',                def: ['Tab', null] },
  { id: 'reset',   label: 'Reiniciar jugada (solo entrenamiento)',     def: ['KeyR', null] },
];
export const PAUSE_KEYS = ['Escape', 'KeyP'];                          // fijas: no se pueden reasignar

const norm = c => (c === 'ShiftRight' ? 'ShiftLeft' : c === 'ControlRight' ? 'ControlLeft' : c === 'AltRight' ? 'AltLeft' : c);   // izq./der. cuentan igual
const NAMES = { Space: 'Espacio', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Backspace: '⌫', Tab: 'Tab', CapsLock: 'Bloq Mayús',
  Mouse0: 'Clic izq.', Mouse1: 'Clic central', Mouse2: 'Clic der.', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5', Backquote: '`', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\' };
export function label(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
  return code;
}

export const state = { held: {} };                                     // código → apretado ahora
let S = { keys: {} }, save = () => {}, listenCb = null, byCode = new Map();
const defaults = () => Object.fromEntries(ACTIONS.map(a => [a.id, [...a.def]]));
function rebuild() {
  byCode = new Map();
  for (const a of ACTIONS) for (const c of S.keys[a.id]) if (c) { if (!byCode.has(c)) byCode.set(c, []); byCode.get(c).push(a.id); }
}
export function init(settings, saveFn) {
  S = settings; save = saveFn || save;
  const d = defaults(), cur = S.keys && typeof S.keys === 'object' ? S.keys : {};
  S.keys = Object.fromEntries(ACTIONS.map(a => [a.id, Array.isArray(cur[a.id]) && cur[a.id].length === 2 ? cur[a.id].map(c => (typeof c === 'string' ? norm(c) : null)) : d[a.id]]));
  rebuild();
}
export const bindings = () => S.keys;
export const actionsOf = code => byCode.get(norm(code)) || [];         // qué acciones dispara ese código
export const isBound = code => byCode.has(norm(code));
export const down = id => (S.keys[id] || []).some(c => c && state.held[c]);
export function set(code, down) { state.held[norm(code)] = down; }
export function releaseAll() { state.held = {}; }

/* Asigna un código a una casilla. Si ya lo usaba otra acción, esa casilla recibe lo que tenía la casilla que estás cambiando (intercambio). */
export function setBinding(action, slot, code) {
  code = norm(code);
  const old = S.keys[action][slot];
  for (const a of ACTIONS) for (const s of [0, 1]) if (S.keys[a.id][s] === code && !(a.id === action && s === slot)) S.keys[a.id][s] = old;
  S.keys[action][slot] = code; rebuild(); save();
}
export function clearBinding(action, slot) {
  const ks = S.keys[action]; if (ks[0] == null && ks[1] == null) return;
  ks[slot] = null; if (ks[0] == null && ks[1] != null) { ks[0] = ks[1]; ks[1] = null; }   // si queda una sola tecla, pasa a ser la principal
  rebuild(); save();
}
export function resetBindings() { S.keys = defaults(); rebuild(); save(); }
export function hasNoPrimary(action) { return !S.keys[action][0]; }

/* ---- modo "apretá la tecla nueva" ---- */
export const isListening = () => !!listenCb;
export function listen(cb) { listenCb = cb; return () => { listenCb = null; }; }
export function stopListening() { listenCb = null; }
export const reserved = code => PAUSE_KEYS.includes(code) || /^F\d+$/.test(code) || code === 'MetaLeft' || code === 'MetaRight' || code === 'ContextMenu';
/* devuelve true si se "comió" el evento (el juego no debe reaccionar). cb recibe (code) o (null) si cancelaste o (false, motivo) si no se puede */
export function captureKey(e) {
  if (!listenCb) return false;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.repeat) return true;
  const cb = listenCb;
  if (e.code === 'Escape') { listenCb = null; cb(null); return true; }
  if (e.code === 'Backspace' || e.code === 'Delete') { listenCb = null; cb('clear'); return true; }
  if (reserved(e.code)) { cb(false, e.code === 'KeyP' ? 'La P es de la pausa, elegí otra.' : 'Esa tecla no se puede usar.'); return true; }
  listenCb = null; cb(norm(e.code)); return true;
}
export function captureMouse(e, onSlot) {                               // clic izq. sobre la casilla = botón izquierdo; clic izq. en otro lado = cancelar
  if (!listenCb) return false;
  const cb = listenCb;
  if (e.button === 0) { if (onSlot) { listenCb = null; e.preventDefault(); e.stopPropagation(); cb('Mouse0'); return true; } listenCb = null; cb(null); return false; }
  e.preventDefault(); e.stopPropagation(); listenCb = null; cb('Mouse' + e.button); return true;
}

const prim = id => label(S.keys[id][0]);
export const hint = () => `Movete con ${prim('up')} ${prim('left')} ${prim('down')} ${prim('right')} · ${prim('shoot')} = tirar · ${prim('pass')} = pasar · ${prim('dribble')} = driblear · ${prim('steal')} = robar · ${prim('jump')} = saltar/taponar · ${prim('switch')} = cambiar jugador · ${prim('camera')} = cámara · ${prim('stats')} (mantener) = tabla de puntos · Esc = pausa`;
export const trainHint = () => `Entrenamiento libre: mantené ${prim('shoot')} para tirar y soltá en la línea blanca. Cerca del aro, ${prim('jump')} = mate o bandeja. Esc = pausa.`;
