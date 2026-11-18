import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

/* ============================================================================
   Jugadores 3D (desactivados en v53)

   Para priorizar la jugabilidad y que el juego cargue rápido se sacaron TODOS los modelos 3D de jugadores: todos usan el cuerpo que genera el juego (rig.js)
   y los uniformes se dibujan por código (kits.js). Este archivo sigue siendo el que carga la pelota y las canchas 3D (loadGLTF).

   Si más adelante querés volver a usar modelos: copiá el GLB a assets/jugadores/<equipo>/<nombre_apellido>/<nombre_apellido>_<1..4>.glb
   (1 Icon · 2 Association · 3 Statement · 4 City) y agregá al jugador en STARS (sigla → nombre_apellido). Nadie consulta al servidor mientras STARS esté vacío.
   ========================================================================== */

export const ROOT = 'assets/jugadores';
export const MODEL_HEIGHT = 1.98;          // todos los modelos se escalan (uniformemente) para medir 1,98 m; después el juego aplica la altura real del jugador
export const MAX_TEX = 2048;               // las texturas más grandes se muestran a este tamaño (con 10 jugadores en cancha, texturas de 4096 px saturan la memoria de video). 0 = no tocar
export const KIT_NUM = { icon: 1, association: 2, statement: 3, city: 4 };

export const slug = name => String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[’'`.,]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
export const kitNum = kitId => KIT_NUM[kitId] || 0;
/** La estrella de cada equipo (sigla → nombre_apellido). Solo ellos buscan modelo 3D: el resto de los jugadores ni se consulta (cero pedidos al servidor). Cambiá el nombre si querés otra estrella. */
export const STARS = {};   // v53: vacío = ningún jugador tiene modelo 3D (todos usan el cuerpo del juego). Para volver a sumar una estrella: gsw: 'stephen_curry', etc.
const base = (ab, name) => { const t = String(ab || '').toLowerCase(), s = slug(name); return t && s && STARS[t] === s ? `${ROOT}/${t}/${s}/${s}` : null; };
/** Rutas posibles del modelo, de la más específica a la comodín. */
export const candidates = (ab, name, kitId) => { const b = base(ab, name), n = kitNum(kitId); return b ? [...(n ? [`${b}_${n}.glb`] : []), `${b}.glb`] : []; };

/* ---- librerías de Three (se cargan la primera vez que hacen falta) ---- */
let libP = null, cloneFn = null;
const lib = () => (libP ||= Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/utils/SkeletonUtils.js')])
  .then(([g, s]) => { cloneFn = s.clone; return { GLTFLoader: g.GLTFLoader }; })
  .catch(e => { libP = null; throw e; }));
export const skelClone = () => cloneFn;
export const ensureLib = () => lib().then(() => cloneFn);

/* ---- ¿existe el archivo? (se pregunta una sola vez por ruta) ---- */
const seen = new Map();                    // ruta → true | false | Promise
function probe(url, onChange) {
  const v = seen.get(url);
  if (v === true || v === false) return v;
  if (!v) {
    const p = fetch(url, { method: 'HEAD' })
      .then(r => r.ok && !/text\/html/i.test(r.headers.get('content-type') || ''))
      .catch(() => false)
      .then(ok => { seen.set(url, ok); return ok; });
    seen.set(url, p);
  }
  if (onChange) seen.get(url).then(ok => { if (ok) onChange(); });
  return null;                             // todavía no se sabe
}
/** Modelo del jugador, SIN esperar: devuelve la ruta si ya se sabe que existe, o null (todavía no se sabe / no hay). `onChange` se llama cuando aparece uno. */
export function keyFor(info, ab, kitId, onChange) {
  for (const url of candidates(ab, info?.name, kitId)) {
    const s = probe(url, onChange);
    if (s === true) return url;
    if (s === null) return null;           // se está preguntando por este: no probar el siguiente todavía
  }
  return null;
}
/** ¿Todavía se está preguntando si el jugador tiene modelo 3D? (hasta que se sepa, el cuerpo del juego NO se muestra, así no se ve un cuerpo y después el otro) */
export function checking(info, ab, kitId) {
  for (const url of candidates(ab, info?.name, kitId)) {
    const v = seen.get(url);
    if (v === true) return false;           // tiene modelo: ya no hay nada que preguntar
    if (v !== false) return true;            // sin respuesta todavía
  }
  return false;
}
/** Igual pero esperando la respuesta del servidor. */
export async function find(info, ab, kitId) {
  for (const url of candidates(ab, info?.name, kitId)) {
    probe(url);
    if (await seen.get(url)) return url;
  }
  return null;
}

/* ---- pantalla de carga (v50): archivos bajados por adelantado ----
   boot.js baja los GLB al arrancar (con barra de progreso) y los deja acá como bytes. Cuando el juego pide un modelo, se arma desde esos bytes
   sin volver a bajarlo (también si se libera de memoria y se vuelve a pedir). Si un archivo no se bajó antes, se carga como siempre. */
const raw = new Map();                      // ruta → ArrayBuffer
export async function warm(url, onBytes) {
  if (raw.has(url)) return;
  const r = await fetch(url);
  if (!r.ok || /text\/html/i.test(r.headers.get('content-type') || '')) throw new Error(`${url}: ${r.status}`);
  const rd = r.body?.getReader();
  if (!rd) { const b = await r.arrayBuffer(); onBytes?.(b.byteLength); raw.set(url, b); seen.set(url, true); return; }
  const parts = []; let n = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); n += value.length; onBytes?.(value.length); }
  const all = new Uint8Array(n); let o = 0; for (const c of parts) { all.set(c, o); o += c.length; }
  raw.set(url, all.buffer); seen.set(url, true);
}
const parseOrLoad = (GLTFLoader, url) => { const b = raw.get(url); return b ? new GLTFLoader().parseAsync(b, url.slice(0, url.lastIndexOf('/') + 1)) : new GLTFLoader().loadAsync(url); };
/** GLB cualquiera (pelota, canchas): usa los bytes ya bajados si están. */
export const loadGLTF = async url => { const { GLTFLoader } = await lib(); return parseOrLoad(GLTFLoader, url); };

/* ---- carga de los GLB ---- */
const eachTexture = (scene, fn) => scene.traverse(o => {
  if (!o.isMesh) return;
  for (const m of [].concat(o.material)) for (const k in m) if (m[k]?.isTexture) fn(m[k]);
});
function shrink(tex) {
  const img = tex.image; if (!MAX_TEX || !img || !img.width || Math.max(img.width, img.height) <= MAX_TEX) return;
  const k = MAX_TEX / Math.max(img.width, img.height), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
  img.close?.(); tex.image = c; tex.needsUpdate = true;
}
function disposeScene(scene) {
  scene.traverse(o => { if (o.isMesh) o.geometry?.dispose(); });
  eachTexture(scene, t => { t.dispose(); t.image?.close?.(); });
  scene.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => m.dispose()); });
}
const models = new Map();                  // ruta → { promise, gltf }
export function load(url, aniso = 8) {
  let e = models.get(url);
  if (!e) {
    e = { gltf: null };
    e.promise = lib().then(async ({ GLTFLoader }) => {
      const gltf = await parseOrLoad(GLTFLoader, url);
      let h = 0;
      gltf.scene.traverse(o => {
        if (!o.isMesh) return;
        if (o.material?.map) o.material.map.anisotropy = aniso;
        if (o.geometry) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; h = Math.max(h, b.max.y - b.min.y); }
      });
      eachTexture(gltf.scene, shrink);
      gltf.fitScale = h > 0.5 && Math.abs(h - MODEL_HEIGHT) / MODEL_HEIGHT > 0.03 ? MODEL_HEIGHT / h : 1;     // si ya mide ~1,98 m no se toca
      e.gltf = gltf;
      return gltf;
    }).catch(err => { models.delete(url); throw err; });
    models.set(url, e);
  }
  return e.promise;
}
export const loaded = url => models.get(url)?.gltf || null;

/* Quién usa cada modelo (la cancha): lo que nadie usa se libera de la memoria. */
const owners = new Map();
export function setUsers(owner, urls) {
  owners.set(owner, new Set(urls.filter(Boolean)));
  const keep = new Set(); owners.forEach(s => s.forEach(u => keep.add(u)));
  for (const [u, e] of models) if (e.gltf && !keep.has(u)) { disposeScene(e.gltf.scene); models.delete(u); }
}

/** Antes de arrancar: busca y baja los modelos de estos jugadores ({ info, ab, kit }), esperando como máximo `ms` (después arranca igual y los modelos entran al llegar). */
export async function prepare(list, ms = 30000) {
  const run = Promise.all(list.map(async ({ info, ab, kit }) => {
    try { const k = await find(info, ab, kit); if (k) await load(k); } catch (e) { console.warn('No se pudo cargar el modelo 3D de', info?.name, e); }
  }));
  await Promise.race([run, new Promise(r => setTimeout(r, ms))]);
}
