import * as P3D from './players3d.js';

/* ============================================================================
   Pantalla de carga (v50)
   Al abrir el juego se ve la pantalla de carga (el HTML está en index.html, así aparece al instante) y se baja por adelantado lo pesado:
   pelota, canchas 3D, escudos e imagen del menú (lista en assets/manifest.json, la arma tools/crear_manifiesto.py).
   La barra avanza por MB bajados. v69: sin cinemática ni "presioná una tecla": cuando termina de cargar y el menú ya está armado, la pantalla se desvanece sola y entrás directo al juego.
   · Boot.task(promesa, 'texto', peso) → suma algo más a esperar (main.js lo usa con los planteles).
   · Boot.finish()                      → main.js avisa que terminó de armar el juego.
   ========================================================================== */
const CONCURRENCY = 4;            // descargas en paralelo
const MIN_SHOW_MS = 700;          // la pantalla no parpadea si todo ya estaba cargado
const SKIP_AFTER_MS = 25000;      // si tarda mucho aparece "Entrar igual"
const MB = 1048576;
const $ = id => document.getElementById(id);
const el = { root: $('boot'), fill: $('bootFill'), pct: $('bootPct'), txt: $('bootTxt'), skip: $('bootSkip'), enter: $('bootEnter') };
const t0 = performance.now();

const items = [];                 // { label, size, got, done }
let extraTotal = 0, extraDone = 0, gameReady = false, finished = false, listReady = false, dlDone = false, ready = false;
const resolvers = [];

const total = () => items.reduce((t, i) => t + i.size, 0) + extraTotal;
const loaded = () => items.reduce((t, i) => t + (i.done ? i.size : Math.min(i.got, i.size)), 0) + extraDone;
let paintQ = 0, paintLabel = null;
function paint(label) {                       // v53: se agrupa en un solo repintado por cuadro (antes se tocaba el DOM por cada pedazo bajado)
  if (label) paintLabel = label;
  if (paintQ) return;
  paintQ = requestAnimationFrame(() => { paintQ = 0; const l = paintLabel; paintLabel = null; paintNow(l); });
}
function paintNow(label) {
  if (!el.root) return;
  const T = total(), p = T > 0 ? Math.min(1, loaded() / T) : 0;
  const shown = ready ? 1 : Math.min(p, 0.99);
  el.fill.style.width = `${(shown * 100).toFixed(1)}%`;
  el.pct.textContent = `${Math.floor(shown * 100)}%`;
  if (label) el.txt.textContent = label;
}
const nice = u => {
  const n = u.split('/').pop().replace(/\.[a-z]+$/i, '').replace(/_\d$/, '').replace(/_/g, ' ');
  return n.replace(/\b\w/g, c => c.toUpperCase());
};
const labelOf = i => (/_court\./.test(i.u) ? 'Cargando canchas…' : /ball\./.test(i.u) ? 'Cargando la pelota…' : /^logos\//.test(i.u) ? 'Cargando escudos…' : /jugadores\//.test(i.u) ? `Cargando a ${nice(i.u)}…` : 'Cargando…');

/** Suma una tarea extra a esperar (peso en "MB" equivalentes para la barra). */
export function task(promise, label = 'Cargando…', weightMB = 2) {
  const w = weightMB * MB; extraTotal += w; paint(label);
  const end = () => { extraDone += w; paint(); };
  Promise.resolve(promise).then(end, end);
  resolvers.push(Promise.resolve(promise).catch(() => {}));
}
export function finish() { gameReady = true; tryClose(); }

let closeP = null;
async function tryClose() {                  // todo bajado + juego armado (menú listo) → la pantalla se va sola
  if (finished || closeP || !gameReady || !listReady || !dlDone) return;
  closeP = (async () => {
    await Promise.all(resolvers);
    const wait = MIN_SHOW_MS - (performance.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    ready = true; paint('¡Listo!');
    await new Promise(r => setTimeout(r, 250));                         // un instante con la barra al 100 %
    close();
  })();
}
function close() {
  if (finished) return; finished = true; ready = true; paintNow('¡Listo!');
  removeEventListener('keydown', onKey, true); removeEventListener('pointerdown', onPointer, true); removeEventListener('click', onPointer, true);
  if (!el.root) return;
  el.root.classList.add('out'); setTimeout(() => el.root.remove(), 750);
}
/* Entradas: mientras la pantalla está, ninguna tecla ni clic llega al juego. */
function onKey(e) {
  if (finished) return;
  if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key) || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;   // F5, Ctrl+R, etc. siguen funcionando
  e.stopImmediatePropagation();
}
function onPointer(e) { if (finished || e.target === el.skip) return; e.stopImmediatePropagation(); }
addEventListener('keydown', onKey, true); addEventListener('pointerdown', onPointer, true); addEventListener('click', onPointer, true);
if (el.skip) el.skip.onclick = () => { gameReady = true; listReady = true; dlDone = true; close(); };
setTimeout(() => { if (!finished && el.skip) el.skip.hidden = false; }, SKIP_AFTER_MS);

/* v69: no hay cinemática: el motor 3D y el juego se arman apenas arranca la carga (los módulos ya se bajaron con modulepreload) y la barra cuenta todo. */
let gameStarted = false;
function startGame() {
  if (gameStarted) return; gameStarted = true;
  paint('Armando el juego…');
  task(P3D.ensureLib().catch(() => {}), 'Cargando motor 3D…', 1.5);     // GLTFLoader y SkeletonUtils
  import('./main.js').catch(e => { console.error('No se pudo iniciar el juego', e); gameReady = true; tryClose(); });
}
startGame();

const warmImg = url => new Promise(res => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = url; });

(async () => {
  paint('Preparando…');
  let list = [];
  try {
    const r = await fetch('assets/manifest.json', { cache: 'no-cache' });
    if (r.ok) list = (await r.json()).files || [];
  } catch { /* sin manifest: se carga todo bajo demanda, como antes */ }
  if (!list.length) list = [{ u: 'assets/ball.glb', s: 2.2 * MB, k: 'glb' }];
  list = list.slice().sort((a, b) => a.s - b.s);                         // lo chico primero: la barra arranca moviéndose
  for (const f of list) items.push({ u: f.u, k: f.k, size: Math.max(1, f.s), got: 0, done: false });
  listReady = true; paint('Cargando…');

  let next = 0;
  const work = async () => {
    while (next < items.length) {
      const it = items[next++];
      paint(labelOf(it));
      try {
        if (it.k === 'img') await warmImg(it.u);
        else await P3D.warm(it.u, n => { it.got += n; paint(); });
      } catch (e) { console.warn('Carga previa: no se pudo bajar', it.u, e); }
      it.done = true; paint();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, work));
  dlDone = true; tryClose();
})();
