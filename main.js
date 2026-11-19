import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { TEAMS } from './teams.js';
import { buildArena, ARENA } from './arena.js';
import { courtFor, courtById } from './courts.js';
import * as TS from './trainsetup.js';
import * as UI from './ui.js';
import { queueXp, flushXp, signOut } from './auth.js';
import { makeRig, mkJ, applyPose } from './rig.js';
import { attachModel } from './rig-glb.js';
import * as P3D from './players3d.js';
import * as Boot from './boot.js';
import { fallbackRoster, loadRoster, SKIN_TONES } from './roster.js';
import { buildFor, scaleFor } from './looks.js';
import * as PM from './prematch.js';
import * as Online from './online.js';
import { SnapBuffer, STATES, MODES, SNAP_HZ, r2, r3, lerpAngle } from './netsync.js';
import { nickname, lum, kitById } from './kits.js';
import * as Pad from './gamepad.js';
import * as KB from './keyboard.js';
import * as Pause from './pause.js';
import * as Career from './career/ui.js';
import * as UT from './ultimate/ut.js';
import * as Box from './boxscore.js';
import * as Crowd from './crowd.js';
import { solveBank, solveRoll, solveBounce } from './shotsim.js';
import { speedMul, accelMul, drainMul, recoverMul, jumpMul, canDunk, releaseSkill, reboundScore, zoneRating } from './skill.js';
import { PROFILES, aiPrepare, aiThink, newAIState, shotQuality, bestPass, styledProfile } from './ai.js';

/* ============ Partido online: quién soy ============ */
let netRole = null;                    // null (partido normal) · 'host' (simula todo y manda snapshots) · 'guest' (manda sus controles y dibuja lo que recibe)
let fadeV = 0;

/* ============ Utilidades y constantes (medidas reales NBA) ============ */
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const HCOL_N = [0xffd34d, 0x4dc3ff, 0xff6b6b, 0x4dffb0];     // colores de J1..J4
const _ik = new THREE.Vector3();
const { clamp, lerp } = THREE.MathUtils;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const $ = id => document.getElementById(id);
const UP = V3(0, 1, 0);
const G9 = 9.81, BR = 0.12, KD = 0.0206, CM = 0.004;
const RIM_Y = 3.05, RIM_IN = 0.2286, RIM_TUBE = 0.0095, RIM_C = RIM_IN + RIM_TUBE;
const COURT_X = 7.62, COURT_Z = 14.325, HOOP_Z = 12.75;
const PERFECT = 0.70, CHARGE_SPEED = 0.78;
const T_LAUNCH = 0.14, T_REL = 0.45, T_END = 1.05, JUMP_SHOT = 3.2, TW = 0.10;
const SKIN = 0xb97a50;
const CAM_NAMES = ['Cámara 2K', 'Cámara de TV', 'Cámara libre'];

/* ============ Escena ============ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f1d);
scene.fog = new THREE.Fog(0x0a0f1d, 45, 170);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 300);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a4658, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004;
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
scene.add(sun, sun.target);
const mat = (color, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness });

/* ============ Cancha ============ */
function woodTexture(f = { h: 34, s: 58, l: 60, jitter: 8 }) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `hsl(${f.h},${f.s}%,${f.l + Math.random() * f.jitter}%)`; g.fillRect(i * 32, 0, 32, 512);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(i * 32, 0, 1.5, 512);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set((COURT_X * 2 + 8) / 2, (COURT_Z * 2 + 8) / 2);
  return t;
}
const floorMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.45 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(COURT_X * 2 + 8, COURT_Z * 2 + 8), floorMat);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(0x131a2b, 1));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);

const courtGfx = [];                                   // líneas y pinturas de la cancha genérica (se ocultan cuando hay cancha 3D)
const lineMats = [], edgeMats = [];                     // líneas internas y líneas del borde de la cancha (cada cancha define sus colores)
function line(pts, r = 0.025, edge = false) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => V3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(2, pts.length * 3), r, 6, false), mat(0xffffff, 0.6));
  (edge ? edgeMats : lineMats).push(m.material);
  m.position.y = 0.015; scene.add(m); courtGfx.push(m);
}
const seg = (x1, z1, x2, z2, edge = false) => line([[x1, 0, z1], [x2, 0, z2]], 0.025, edge);
function arc(cx, cz, r, a0, a1, n = 48) {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r]); }
  line(p);
}
const keyMats = [];
seg(-COURT_X, -COURT_Z, COURT_X, -COURT_Z, true); seg(-COURT_X, COURT_Z, COURT_X, COURT_Z, true);
seg(-COURT_X, -COURT_Z, -COURT_X, COURT_Z, true); seg(COURT_X, -COURT_Z, COURT_X, COURT_Z, true);
seg(-COURT_X, 0, COURT_X, 0); arc(0, 0, 1.83, 0, Math.PI * 2, 64);
for (const s of [-1, 1]) {
  const key = new THREE.Mesh(new THREE.PlaneGeometry(4.88, 5.79), mat(0xa63f2a, 0.5)); keyMats.push(key.material);
  key.rotation.x = -Math.PI / 2; key.position.set(0, 0.004, s * (COURT_Z - 5.79 / 2)); scene.add(key); courtGfx.push(key);
  const ft = s * (COURT_Z - 5.79);
  seg(-2.44, s * COURT_Z, -2.44, ft); seg(2.44, s * COURT_Z, 2.44, ft); seg(-2.44, ft, 2.44, ft);
  arc(0, ft, 1.83, 0, Math.PI * 2, 40);
  const phi = Math.asin(6.7 / 7.24), zc = s * (HOOP_Z - 7.24 * Math.cos(phi));
  seg(-6.7, s * COURT_Z, -6.7, zc); seg(6.7, s * COURT_Z, 6.7, zc);
  const p = [];
  for (let i = 0; i <= 48; i++) { const f = -phi + 2 * phi * i / 48; p.push([7.24 * Math.sin(f), 0, s * HOOP_Z - s * 7.24 * Math.cos(f)]); }
  line(p);
}

/* ============ Aros con red dinámica ============ */
function makeNet(cz) {
  const N = 12, L = 6, nodes = [], segs = [], idx = (k, i) => k * N + (i % N);
  for (let k = 0; k <= L; k++) for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, r = lerp(RIM_C, 0.14, k / L);
    const b = V3(Math.cos(a) * r, RIM_Y - 0.42 * k / L, cz + Math.sin(a) * r);
    nodes.push({ b, p: b.clone(), v: V3() });
  }
  for (let k = 0; k <= L; k++) for (let i = 0; i < N; i++) {
    if (k < L) segs.push(idx(k, i), idx(k + 1, i));
    if (k > 0) segs.push(idx(k, i), idx(k, i + 1));
  }
  const arr = new Float32Array(segs.length * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff }));
  mesh.frustumCulled = false; scene.add(mesh);
  const t = V3();
  return dt => {
    for (let k = 1; k <= L; k++) for (let i = 0; i < N; i++) {
      const n = nodes[idx(k, i)];
      n.v.add(t.copy(n.b).sub(n.p).multiplyScalar(500 * dt)).multiplyScalar(Math.exp(-10 * dt));
      n.p.addScaledVector(n.v, dt);
      t.copy(n.p).sub(BP); const d = t.length(), m = BR + 0.012;
      if (d < m && d > 1e-5) n.p.copy(BP).addScaledVector(t, m / d);
    }
    segs.forEach((s, j) => { arr[j * 3] = nodes[s].p.x; arr[j * 3 + 1] = nodes[s].p.y; arr[j * 3 + 2] = nodes[s].p.z; });
    geo.attributes.position.needsUpdate = true;
  };
}
function buildHoop(s) {
  const hz = s * HOOP_Z, bz = hz + s * 0.38, front = bz - s * 0.02, metal = mat(0x555b64, 0.5);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.6, 16), metal);
  pole.position.set(0, 1.8, s * (COURT_Z + 1.2)); pole.castShadow = true; scene.add(pole);
  const armLen = Math.abs(s * (COURT_Z + 1.2) - bz);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, armLen), metal);
  arm.position.set(0, 3.4, (s * (COURT_Z + 1.2) + bz) / 2); scene.add(arm);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.83, 1.07, 0.04), new THREE.MeshPhysicalMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.38, roughness: 0.1 }));
  glass.position.set(0, 3.43, bz); scene.add(glass);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.83, 1.07, 0.04)), new THREE.LineBasicMaterial({ color: 0xffffff }));
  frame.position.copy(glass.position); scene.add(frame);
  const sq = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.59, 0.45, 0.01)), new THREE.LineBasicMaterial({ color: 0xff5a1f }));
  sq.position.set(0, 3.275, front - s * 0.006); scene.add(sq);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_C, RIM_TUBE * 1.3, 10, 48), mat(0xff5a1f, 0.35));
  rim.rotation.x = Math.PI / 2; rim.position.set(0, RIM_Y, hz); rim.castShadow = true; scene.add(rim);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.16), mat(0xff5a1f));
  bracket.position.set(0, RIM_Y, bz - s * 0.1); scene.add(bracket);
  return { s, hz, bz, front, done: false, net: makeNet(hz), parts: [pole, arm, glass, frame, sq] };
}
const hoops = [buildHoop(-1), buildHoop(1)];
const hoopFor = sign => hoops[sign < 0 ? 0 : 1];
/* ---- cancha / estadio: cada equipo tiene la suya (courts.js). setCourt cambia parquet, pintura, logo, tribuna, banners y pantallas ---- */
let arena = null, curCourt = '';
let courtObj = null, curDef = null;                     // courtObj: cancha 3D del equipo activo (assets/<ab>_court.glb), si ya cargó
const courtCache = new Map(), courtLoading = new Set();   // ruta del GLB -> escena ya cargada · rutas que se están bajando
function applyCourtLook() {                              // con cancha 3D se ocultan las líneas, la pintura, los soportes, el tablero y lo pintado sobre el parquet (logo, textos, contorno)
  const on = !!(curDef?.model && courtObj);
  courtGfx.forEach(m => { m.visible = !on; });
  hoops.forEach(h => h.parts.forEach(p => { p.visible = !on; }));
  for (const sc of courtCache.values()) sc.visible = on && sc === courtObj;
  (arena?.floorGfx || (arena?.floorLogo ? [arena.floorLogo] : [])).forEach(m => { m.visible = !on; });
}
function setCourt(def) {
  if (!def || curCourt === def.id) return;
  curDef = def;
  courtObj = def.model ? (courtCache.get(def.model) || null) : null;
  const m3d = !!courtObj;
  floorMat.map?.dispose(); floorMat.map = m3d ? null : woodTexture(def.floor); floorMat.color.set(m3d ? (def.apron || '#ffc324') : 0xffffff); floorMat.needsUpdate = true;
  keyMats.forEach(m => { m.color.set(def.paint); m.roughness = def.paintRough ?? 0.5; });
  lineMats.forEach(m => m.color.set(def.lineColor || '#ffffff')); edgeMats.forEach(m => m.color.set(def.edgeColor || def.lineColor || '#ffffff'));
  arena?.dispose(); arena = buildArena(scene, def); curCourt = def.id;
  applyCourtLook();
  if (def.model && !courtObj) loadCourtModel(def);
}
setCourt(courtFor('GSW'));                              // arranca en el Chase Center; cada partido / entrenamiento pone la que corresponde
/* Canchas 3D (assets/<ab>_court.glb: las 30 canchas de equipo + asg_court.glb del All-Star): piso con líneas, logos y publicidad + soportes y tableros de los aros.
   Están calibradas al juego: las líneas de fondo y banda caen en ±14,325 y ±7,62, y los aros en ±12,75 (la física no cambia).
   El aro y la red con física siguen siendo los del juego. Se baja solo la del equipo que se usa (y se libera la anterior: cada una pesa ~20 MB en la GPU).
   Si el archivo no carga, queda la cancha de siempre. */
function disposeScene(o) {
  const seen = new Set();
  o.traverse(n => { n.geometry?.dispose?.(); for (const m of [].concat(n.material || [])) { if (seen.has(m)) continue; seen.add(m); m.map?.dispose?.(); m.dispose?.(); } });
}
async function loadCourtModel(def) {
  const path = def.model; if (courtCache.has(path) || courtLoading.has(path)) return;
  courtLoading.add(path);
  try {
    const gltf = await P3D.loadGLTF(path);
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material; o.receiveShadow = true; o.castShadow = o.name !== 'piso';
      if (o.name === 'piso') { m.roughness = 0.45; m.metalness = 0; } else if (m.metalness > 0.2) m.metalness = 0.1;
      if (m.map) m.map.anisotropy = aniso;
    });
    gltf.scene.visible = false; scene.add(gltf.scene); courtCache.set(path, gltf.scene);
    for (const [p, sc] of [...courtCache]) if (p !== path && p !== curDef?.model) { scene.remove(sc); disposeScene(sc); courtCache.delete(p); }   // libera la cancha que ya no se usa
    if (curDef?.model === path) { const d = curDef; curCourt = ''; setCourt(d); }      // si la cancha que se pidió es esta, se rehace con el modelo
  } catch (e) { console.warn(`No se pudo cargar ${path}; sigo con la cancha de siempre.`, e); }
  finally { courtLoading.delete(path); }
}

/* ============ Pelota ============ */
function ballTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d9701f'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(0,0,0,.09)'; for (let i = 0; i < 1800; i++) g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
  g.strokeStyle = '#1d1814'; g.lineWidth = 5;
  const L = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  L(0, 128, 512, 128); L(2, 0, 2, 256); L(256, 0, 256, 256); L(510, 0, 510, 256);
  for (const x of [128, 384]) for (const d of [-1, 1]) { g.beginPath(); g.moveTo(x + d * 40, 0); g.quadraticCurveTo(x - d * 30, 128, x + d * 40, 256); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 32, 24), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.75 }));
ball.castShadow = true; scene.add(ball);
/* Pelota con modelo 3D (assets/ball.glb: NBA Wilson, 768 triángulos, texturas 1024). Mientras carga (o si falla) queda la esfera básica de arriba.
   El modelo ya viene centrado y con radio BR, así que la física, el giro y las manos siguen igual: solo cambia el aspecto. */
(async () => {
  try {
    const gltf = await P3D.loadGLTF('assets/ball.glb');
    let src = null; gltf.scene.traverse(o => { if (o.isMesh && !src) src = o; });
    if (!src) throw new Error('el GLB no tiene malla');
    const mat = src.material, aniso = renderer.capabilities.getMaxAnisotropy();
    mat.metalness = 0;
    for (const k of ['map', 'normalMap', 'roughnessMap']) if (mat[k]) mat[k].anisotropy = Math.min(8, aniso);
    const oldG = ball.geometry, oldM = ball.material;
    ball.geometry = src.geometry; ball.material = mat;
    oldG.dispose(); if (oldM.map) oldM.map.dispose(); oldM.dispose();
  } catch (e) { console.warn('No se pudo cargar assets/ball.glb; sigo con la pelota básica.', e); }
})();
const BP = ball.position, BV = V3(), BW = V3();
/* Estado de la pelota: quién la tiene y en qué fase está.
   mode: 'held' (en manos de B.holder) · 'shot' (tiro en el aire) · 'pass' (pase en el aire) · 'loose' (suelta / rebote) · 'dead' (pelota muerta, árbitro) */
const B = { holder: null, mode: 'loose', possTeam: 0, lastTeam: 0, lastTouch: null, shooter: null, shotHoop: null, shotId: 0, shotDist: 0, shotThree: false, passer: null, target: null, rolled: new Set(), noPick: { a: null, t: 0 }, passT: 0, bn: 0, bp: BP, bv: BV };

/* ============ Personajes ============ */
const R3 = makeRig(scene), J3 = mkJ();             // árbitro: camiseta a rayas
(() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#15171c' : '#f2f2f2'; g.fillRect(i * 8, 0, 8, 8); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  R3.jm.map = t; R3.jm.color.set(0xffffff); R3.jm.needsUpdate = true; R3.sm.color.set(0x15171c); R3.shoeM.color.set(0x15171c);
})();
R3.setSleeves(true); R3.setLook('arbitro', { hair: 2, beard: 0 }); R3.hairM.color.set(0x8c8c90); R3.setBuild(1.02);
R3.root.position.set(8.2, 0, -4); R3.root.rotation.y = -Math.PI / 2;

/* ---- los 10 jugadores (5 por equipo). team 0 = vos, team 1 = rival ---- */
const agents = [];
const T = [{ court: [], bench: [], ab: 'LAL' }, { court: [], bench: [], ab: 'BOS' }];
const userTeam = 0;
let attSign = [-1, 1];                                // hacia qué lado (signo de z) ataca cada equipo; se invierte en el entretiempo
const attackHoop = team => hoopFor(attSign[team]);
const ownHoop = team => hoopFor(-attSign[team]);
function makeAgent(team, slot) {
  const R = makeRig(scene, SKIN);
  const a = {
    team, slot, R, J: mkJ(), pos: V3(), vel: V3(), acc: V3(), y: 0, vy: 0, h: team === 0 ? Math.PI : 0, grounded: true, jumpWind: 0, landC: 0, phase: Math.random() * 6,
    state: 'free', charge: 0, chargeDir: 1, shootT: 0, launched: false, released: false, aimHoop: hoops[0], shotId: 0,
    D: { mode: 'dunk2', t: 0, H: hoops[0], pw: V3(), corr: V3(), p0: V3(), TF: 0.84, JH: 1.2, rel: 0.52, rd: false, cap: false, scored: false, miss: false, def: null, lay: null, bl: false, hand: 'R', s0: 0.40, sd: 1, off: 0, t0: 0, tt: 1, fin: 'R' },
    passQ: null, passStyle: null, passSd: 1, blockKind: null, blockHand: 'R', blkHit: 0, xLean: 0, zLean: 0, yTw: 0, hOver: null,
    act: null, actT: 0, stealDone: false, reachT: 0, reachCount: 0, fouls: 0, stunT: 0, stam: 1, tired: false, side: 1, crossT: 0, moveCd: 0, autoCross: 0, dribMode: false, def: false,
    intent: { x: 0, z: 0, mag: 0, sprint: false, sprintAmt: 0, jump: false, move: false, dribHold: false, face: null, mod: false },
    ai: newAIState(), info: null, active: true, mark: null, scale: 1, spdMul: 1, hum: null,
  };
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  a.labelCanvas = c; a.labelTex = new THREE.CanvasTexture(c); a.labelTex.colorSpace = THREE.SRGBColorSpace;
  a.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: a.labelTex, depthTest: false, transparent: true }));
  a.label.scale.set(1.5, 0.375, 1); a.label.position.y = 2.42; a.label.renderOrder = 20; R.root.add(a.label);
  agents.push(a); T[team].court[slot] = a; return a;
}
for (const team of [0, 1]) for (let s = 0; s < 5; s++) makeAgent(team, s);
for (const a of agents) a.mark = T[1 - a.team].court[a.slot];

function drawLabel(a) {
  const g = a.labelCanvas.getContext('2d'), n = a.info;
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(8,12,20,.78)'; g.beginPath(); g.roundRect ? g.roundRect(4, 8, 248, 48, 10) : g.rect(4, 8, 248, 48); g.fill();
  g.fillStyle = a.team === 0 ? '#ffd34d' : '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 30px "Barlow Condensed", Arial Narrow, Arial';
  const last = n.name.split(' ').slice(-1)[0].toUpperCase().slice(0, 12);
  if (a.hum && humans.length > 1) {                    // insignia del jugador humano (J1..J4) con su color
    g.fillStyle = a.hum.color; g.beginPath(); g.roundRect ? g.roundRect(8, 12, 46, 40, 8) : g.rect(8, 12, 46, 40); g.fill();
    g.fillStyle = '#10131c'; g.fillText(a.hum.name, 31, 33);
    g.fillStyle = a.team === 0 ? '#ffd34d' : '#ffffff'; g.fillText(`#${n.number} ${last}`.slice(0, 13), 152, 33);
  } else g.fillText(`#${n.number}  ${last}`, 128, 33);
  a.labelTex.needsUpdate = true;
}
/* ---- Personajes 3D con esqueleto (v48): carpetas por equipo y jugador ----
   assets/jugadores/<equipo>/<nombre_apellido>/<nombre_apellido>_<1..4>.glb  (1 Icon · 2 Association · 3 Statement · 4 City; ver players3d.js).
   Solo la estrella de cada equipo (STARS en players3d.js) puede tener modelo: si su archivo y su camiseta existe, se usa ese modelo (copia las poses del cuerpo procedural, ver rig-glb.js). Si no existe, queda el cuerpo que arma el juego.
   Los modelos pueden pesar bastante: no se bajan al arrancar, solo los de los 10 que juegan (antes de empezar) y los suplentes cuando entran; lo que nadie usa se libera.
   Para probar un modelo en los 10 jugadores: ?modelo3d=lebron, curry, haliburton, o la ruta  equipo/jugador/archivo (sin .glb). */
const MODEL3D = new URLSearchParams(location.search).get('modelo3d');
const FORCE = {};
const FORCED = MODEL3D ? `${P3D.ROOT}/${FORCE[MODEL3D] || MODEL3D}.glb` : null;
const m3Fail = new Set(), m3Pending = new Set();
let m3Timer = 0;
/** Modelo 3D que le toca a este jugador (ruta del GLB) o null si no tiene: entonces queda el cuerpo del juego. */
const which3D = a => (FORCED || (a.info && a.m3k ? P3D.keyFor(a.info, a.m3k.ab, a.m3k.kit, () => refreshModel(a)) : null));
function refreshModel(a) {
  const key = a.info ? which3D(a) : null; a.m3want = key;
  if (a.R.m3d && a.R.m3dKey !== key) { a.R.m3d.setVisible(false); a.R.root.remove(a.R.m3d.model); a.R.m3d = null; a.R.m3dKey = null; }   // cambió el jugador (banco) o su camiseta: otro modelo
  let gltf = key ? P3D.loaded(key) : null;
  if (key && !gltf && !m3Fail.has(key) && !m3Pending.has(key)) {
    m3Pending.add(key);
    P3D.load(key, Math.min(8, renderer.capabilities.getMaxAnisotropy()))
      .then(() => agents.forEach(refreshModel))
      .catch(e => { m3Fail.add(key); console.warn(`No se pudo cargar ${key}; sigo con el cuerpo de siempre.`, e); })
      .finally(() => m3Pending.delete(key));
  }
  const clone = P3D.skelClone();
  if (gltf && clone && !a.R.m3d) { if (attachModel(a.R, gltf, clone)) a.R.m3dKey = key; }
  a.R.m3d?.setVisible(!!gltf);
  /* Si tiene modelo 3D (o todavía se está viendo si lo tiene / se está bajando), el cuerpo del juego queda oculto: nunca se ven los dos. */
  if (!a.R.m3d) a.R.hips.visible = !(a.info && a.m3k && (key ? !gltf && !m3Fail.has(key) : P3D.checking(a.info, a.m3k.ab, a.m3k.kit)));
  clearTimeout(m3Timer); m3Timer = setTimeout(() => P3D.setUsers('game', agents.map(x => x.m3want)), 400);      // libera de memoria los modelos que ya nadie usa
}
function setInfo(a, info) {
  a.info = info; a.R.setSkin(SKIN_TONES[info.skin] ?? SKIN); a.R.setLook(info.name || info.id, info.look); a.R.setBuild(buildFor(info)); a.R.setUniformInfo?.(info);
  a.scale = scaleFor(info); a.R.root.scale.setScalar(a.scale);
  a.spdMul = speedMul(info); a.accMul = accelMul(info); a.drainM = drainMul(info); a.recM = recoverMul(info); a.jumpM = jumpMul(info);   // físico según los atributos (skill.js)
  drawLabel(a); refreshModel(a);
}
function applyRosters(rA, rB) {
  [rA, rB].forEach((r, t) => { r.starters.forEach((p, s) => { const a = T[t].court[s]; setInfo(a, p); a.stam = 1; }); T[t].bench = r.bench.map(p => ({ ...p, rest: 1 })); });
}
{ const fa = fallbackRoster(TEAMS[13]), fb = fallbackRoster(TEAMS[1]); applyRosters(fa, fb); }

/* anillo bajo el jugador que controlás y flecha del compañero al que le vas a pasar */
const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.64, 40), new THREE.MeshBasicMaterial({ color: 0xffd34d, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.035; ring.renderOrder = 5; scene.add(ring);
const passMark = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), new THREE.MeshBasicMaterial({ color: 0x4dffb0, depthTest: false, transparent: true }));
passMark.rotation.x = Math.PI; passMark.renderOrder = 21; passMark.visible = false; scene.add(passMark);
/* con varios humanos: un anillo y una flecha de pase de cada color por jugador */
const rings = [ring], passMarks = [passMark];
for (let i = 1; i < 4; i++) {
  const r = new THREE.Mesh(ring.geometry, new THREE.MeshBasicMaterial({ color: HCOL_N[i], side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
  r.rotation.x = -Math.PI / 2; r.position.y = 0.035; r.renderOrder = 5; r.visible = false; scene.add(r); rings.push(r);
  const m = new THREE.Mesh(passMark.geometry, new THREE.MeshBasicMaterial({ color: HCOL_N[i], depthTest: false, transparent: true }));
  m.rotation.x = Math.PI; m.renderOrder = 21; m.visible = false; scene.add(m); passMarks.push(m);
}
rings.forEach((r, i) => { r.material.color.setHex(HCOL_N[i]); });
passMarks.forEach((m, i) => { m.material.color.setHex(i === 0 ? 0x4dffb0 : HCOL_N[i]); });

/* ============ Estado de juego ============ */
const keys = {};
let yaw = 0, pitch = 0.12, hasPointer = false, camDist = 4.4, camMode = 0;
let ctrl = agents[0], ctrlLock = 0, autoUser = false;
/* ---- jugadores humanos (hasta 4 en la misma PC): J1 = teclado y mouse, J2-J4 = joystick ---- */
const HCOL = ['#ffd34d', '#4dc3ff', '#ff6b6b', '#4dffb0'];
const humans = [];                                    // { i, dev:'kb'|'pad', pad, team, agent, lock, name, color, in:{...} }
const isHum = a => !!a.hum && !autoUser;
const humansOn = team => humans.filter(h => h.team === team);
const multi = () => mode === 'match' && humans.length > 1;
const teamsWithHumans = () => new Set(humans.map(h => h.team)).size;
const freeMates = (team, except) => T[team].court.filter(a => a.active && (!a.hum || a === except));
let careerCtx = null; const gpts = {};                  // modo carrera: { done(resultado) } mientras se juega un partido de la carrera · puntos reales de cada jugador
const bx = (a, f, n = 1) => { if (a?.info && mode === 'match' && netRole !== 'guest') Box.add(a.team, infoKey(a.info), f, n); };   // suma a la tabla de puntos (boxscore.js)
const trackPts = (pts, who, ft) => {
  const a = who || B.shooter || B.holder || B.lastTouch; if (!a?.info) return;
  gpts[a.info.id] = (gpts[a.info.id] || 0) + pts;
  if (mode !== 'match' || netRole === 'guest') return;
  bx(a, 'pts', pts); Box.addQ(a.team, quarter, pts);
  if (ft) { bx(a, 'ftm'); return; }
  bx(a, 'fgm'); if (pts === 3) bx(a, 'tpm');
  const q = B.ast; if (q && q.to === a && q.from.team === a.team && gameTime - q.t < 3.2) bx(q.from, 'ast');     // asistencia: pase al que anota hace menos de ~3 s
  B.ast = null; B.reboundOf = null;
};
let paused = true, scoreA = 0, scoreB = 0, quarter = 1, qLen = 180, clockT = 180, shotClock = 24, gameTime = 0;
let teamA = TEAMS[13], teamB = TEAMS[1];
let mode = 'match';                                   // 'match' (partido casual) | 'training'
let diff = UI.settings.diff || 'hard';
let camHeight = 0;
const teamFouls = [0, 0];
let kitA = null, kitB = null;                         // camisetas elegidas en el menú previo (kits.js)
const opts = { shotClock: true, fatigue: true, autoSubs: true, style: null, styleB: null };   // reglas y estilo de juego elegidos en el menú previo
let styleKey = '', styleKeyB = '';
const profCache = new Map();
const stats = { shots: 0, makes: 0, streak: 0, best: 0, xp: 0 };
let pendingShot = false, shotCounter = 0;
let dead = null, inbound = false, ballOut = false, audioCtx = null;   // dead = pelota muerta (punto, afuera, violación) con secuencia del árbitro
const tvc = { x: 0, z: 0 };
const outsideLines = (x, z, m = 0) => Math.abs(x) > COURT_X + m || Math.abs(z) > COURT_Z + m;
const fadeEl = $('fade'), setFade = v => { fadeV = v; fadeEl.style.opacity = v; };
const say = t => { $('message').textContent = t; if (netRole === 'host') Online.sendGame({ t: 'E', k: 'say', v: t }, true); };
const updatePowerUI = () => { const c = humans[0]?.agent || ctrl; $('powerFill').style.width = `${c.charge * 100}%`; $('powerPercent').textContent = `${Math.round(c.charge * 100)}%`; };
const activeAgents = () => agents.filter(a => a.active);
const prof = a => {                                   // perfil de IA: dificultad (+ estilo de juego en tu equipo)
  const side = (a.team === userTeam || humansOn(a.team).length) ? 'ally' : 'opp', mine = a.team === userTeam;
  const sty = mine ? opts.style : (netRole && opts.styleB ? opts.styleB : null), sk = mine ? styleKey : (sty ? styleKeyB : ''), key = `${diff}|${side}|${sk}`;   // online: cada equipo con el estilo que armó su dueño
  let p = profCache.get(key);
  if (!p) { p = styledProfile(PROFILES[diff][side], side === 'ally' && sty ? sty : null); profCache.set(key, p); }
  return p;
};
function takeAgent(h, a) {                            // el humano h pasa a controlar al jugador a (el anterior queda en manos de la IA)
  if (!h || !a || a === h.agent || (a.hum && a.hum !== h)) return;
  const o = h.agent;
  if (o) { if (o.state === 'charge') { o.state = B.holder === o ? 'dribble' : 'free'; o.charge = 0; } o.hum = null; drawLabel(o); }
  h.agent = a; a.hum = h; drawLabel(a);
  if (h === humans[0]) ctrl = a;
  updatePowerUI();
}
const setCtrl = a => {                                // compatibilidad: "que el humano de ese equipo tome a este jugador" (si hay uno solo)
  const hs = humansOn(a.team);
  if (hs.length === 1) takeAgent(hs[0], a);
};
const autoFollow = team => humansOn(team).length === 1;     // con un solo humano en el equipo, el control sigue a la pelota; con varios, cada uno tiene su jugador

const oppTeam = t => t !== userTeam && !humansOn(t).length;      // equipo 100% bots que no es el tuyo: ahí valen los ajustes de dificultad
function rumbleH(h, ms, mag) { if (h.dev === 'pad') Pad.rumble(ms, mag, h.pad); else if (humans.length === 1) Pad.rumble(ms, mag); }
/* arma la lista de jugadores humanos a partir de lo elegido en el menú previo (o uno solo en el entrenamiento) */
function setupHumans(S, solo) {
  humans.length = 0; for (const a of agents) a.hum = null;
  const list = solo ? [{ dev: 'kb', team: 0 }] : (S.humans?.length ? S.humans : [{ dev: 'kb', team: 0 }]);   // cada casilla trae su dispositivo: 'kb' (teclado y mouse, solo uno) o 'pad' (un joystick)
  list.slice(0, 4).forEach((d, i) => humans.push({ i, dev: d.dev === 'pad' ? 'pad' : d.dev === 'net' ? 'net' : 'kb', pad: d.pad ?? null, team: d.team ? 1 : 0, agent: null, lock: 0, name: 'J' + (i + 1), color: HCOL[i], P: null, connected: true, net: d.dev === 'net' ? mkNetIn() : null }));
  humans[0].team = 0;                                   // el primer jugador siempre es del equipo Local (con el joystick que sea, o con el teclado)
  for (const h of humans) {
    const court = T[h.team].court;
    let a;
    if (solo) a = solo;
    else if (h.i === 0) a = court[S.ctrlSlot] || court[0];
    else if (h.i === 1 && S.online && S.ctrlSlotB != null) a = court[S.ctrlSlotB] || court[0];      // online: el invitado arranca con el jugador que eligió
    else a = court.filter(x => !x.hum).sort((x, y) => (y.info?.ovr ?? 0) - (x.info?.ovr ?? 0) || x.slot - y.slot)[0] || court.find(x => !x.hum);
    h.agent = a; a.hum = h;
  }
  ctrl = humans[0].agent; ctrlLock = 0;
  for (const a of agents) if (a.info) drawLabel(a);
  buildMpHud();
}
function resetTraining() {
  const a = agents[0]; dead = null; inbound = false; ballOut = false; setFade(0);
  a.pos.set(0, 0, -6); a.vel.set(0, 0, 0); a.y = 0; a.vy = 0; a.grounded = true; a.h = Math.PI; a.act = null; a.stunT = 0;
  yaw = camMode === 0 ? 0 : camMode === 1 ? -Math.PI / 2 : 0;
  hoops.forEach(h => h.done = false);
  BP.set(0.26, 0.9, -6.4); BV.set(0, 0, 0); BW.set(0, 0, 0);
  giveBall(a); updatePowerUI();
}
/** Festejo del estadio: anima la tribuna (arena.js) y suena el público (crowd.js). mine = lo hizo tu equipo; si fue del rival, solo suspira cuando fue algo grande. */
function cheerAt(sec, mine = true) { arena.cheer(sec); if (mine) Crowd.cheer(sec); else if (sec >= 1) Crowd.groan(sec); }
function crowdCtx() {
  const ut = netRole === 'guest' ? 1 : userTeam, sa = ut === 0 ? scoreA : scoreB, sb = ut === 0 ? scoreB : scoreA;
  return { on: mode === 'match' && !paused && !Pause.isOpen(), lead: sa - sb, q: quarter, ball: B.holder ? (B.holder.team === ut ? 'me' : 'opp') : null, dead: !!dead, ft: !!(dead && dead.ftStage) };
}
function scoreFor(H, pts) {
  if (dead) { if (dead.ftLive && dead.ftStage === 'flight' && !dead.ftScored) ftMade(H); return; }
  if (mode === 'training') { trainScore(H, pts); return; }
  const team = attSign[0] === H.s ? 0 : 1, ab = (team === 0 ? teamA : teamB).ab;
  H.done = true; if (team === 0) scoreA += pts; else scoreB += pts; trackPts(pts);
  cheerAt(team === 0 ? 3.2 : 1.6, team === 0); for (const h of humansOn(team)) rumbleH(h, 160, 0.5);
  const fp = B.foulPending;
  if (fp && fp.shooter.team === team) { resolvePending(true); return; }       // canasta + falta = y uno
  say(`${ab}: ${pts === 3 ? '¡TRIPLE!' : '¡DOBLE!'}`);
  const dk = B.holder;
  if (dk && dk.state === 'dunk' && Math.random() < 0.05) {                    // se cuelga del aro: técnica, y después saque de fondo del rival
    commitFoul({ type: 'technical', fouler: dk, why: 'Se colgó del aro.', inTeam: 1 - team, spot: restartSpot('score', H.s, 0), x: H.s * COURT_Z, z: 0 }); return;
  }
  startDead('score', H.s, 0, null, 1 - team);
}

/* ============ Modos: entrenamiento / partido casual ============ */
function attempt() {                                   // cada tiro, bandeja o mate del jugador cuenta como intento (solo entrenamiento)
  if (mode !== 'training') return;
  if (pendingShot) stats.streak = 0;                   // el intento anterior no entró
  pendingShot = true; stats.shots++; updateTrainHUD();
}
function trainScore(H, pts) {
  if (!pendingShot) return;                            // pelota que cae por el aro sin tiro del jugador: no cuenta
  H.done = true; pendingShot = false;
  stats.makes++; stats.streak++; stats.best = Math.max(stats.best, stats.streak);
  const xp = pts * 5 + (stats.streak >= 3 ? 2 : 0); stats.xp += xp; queueXp(xp);
  say(pts === 3 ? '¡TRIPLE!' : '¡DOBLE!'); arena.cheer(1.6); updateTrainHUD();
}
function updateTrainHUD() {
  $('tsMakes').textContent = stats.makes; $('tsShots').textContent = stats.shots;
  $('tsPct').textContent = stats.shots ? `${Math.round(stats.makes / stats.shots * 100)}%` : '0%';
  $('tsStreak').textContent = stats.streak; $('tsBest').textContent = stats.best; $('tsXp').textContent = `+${stats.xp}`;
}
function recallBall() {                                // entrenamiento: si la pelota se va afuera, vuelve a las manos del jugador
  const a = agents[0]; a.charge = 0; a.released = false; a.launched = false; updatePowerUI();
  BV.set(0, 0, 0); BW.set(0, 0, 0); hoops.forEach(h => h.done = false); giveBall(a);
  BP.set(a.pos.x + Math.sin(a.h) * 0.4 - Math.cos(a.h) * 0.26, 0.9, a.pos.z + Math.cos(a.h) * 0.4 + Math.sin(a.h) * 0.26); say('Pelota recuperada');
}
function setMode(m) {
  mode = m; const tr = m === 'training';
  document.body.classList.toggle('training', tr);
  $('scorebug').style.display = tr ? 'none' : ''; $('trainHud').hidden = !tr; $('pStat').hidden = false;
  agents.forEach((a, i) => { a.active = tr ? i === 0 : true; a.R.root.visible = a.active; a.label.visible = !tr; });
  R3.root.visible = !tr;                               // sin árbitro en el entrenamiento
  $('modeLabel').textContent = tr ? 'ENTRENAMIENTO' : 'PARTIDO CASUAL';
  camMode = tr ? 1 : 0; showCamName();
}
function applyTrainingLook() {                         // remera blanca, short oscuro, zapatillas blancas
  const a = agents[0]; a.R.setUniformStyle?.({ jersey: '#ffffff', shorts: '#15181f', accent: '#ffffff', trim: '#ffffff', details: false, decals: false }); a.R.shoeM.color.set(0xffffff);
}
/* Entrenamiento: la cancha y el jugador salen de la pantalla de configuración (trainsetup.js) */
async function startTraining(cfg) {
  cfg = cfg || TS.getCfg();
  TS.close(); paused = true;
  const team = TEAMS.find(t => t.ab === cfg.team) || teamA;
  let ros; try { ros = await loadRoster(team); } catch { ros = fallbackRoster(team); }
  const p = [...ros.starters, ...ros.bench].find(x => String(x.id) === String(cfg.player)) || ros.starters[0];
  /* Modelo 3D del jugador (players3d.js): con la camiseta del equipo usa la 1 (Icon); con la remera blanca de práctica, la 2 (Association, blanca) */
  const trainKit = cfg.kit === 'team' ? 'icon' : 'association';
  await P3D.prepare([{ info: p, ab: team.ab, kit: trainKit }]);
  setMode('training'); setCourt(courtById(cfg.court));
  const a = agents[0];
  if (cfg.kit === 'team') {                              // con la camiseta de su equipo (nombre y número del jugador)
    const k = kitById(team, 'icon');
    a.R.setUniformStyle?.({ jersey: k.jersey, shorts: k.shorts, accent: k.accent, trim: k.trim, details: k.details, word: nickname(team), ink: inkOf(k), decals: true }); a.R.shoeM.color.set(k.shoes);
  } else applyTrainingLook();                            // remera blanca lisa
  a.m3k = { ab: team.ab, kit: trainKit };
  for (const x of agents) if (x !== a) { x.m3k = null; refreshModel(x); }      // los demás no juegan: sin modelo
  setInfo(a, { ...p }); a.stam = 1; a.tired = false;
  setupHumans(null, a); B.holder = null; B.mode = 'loose';
  Object.assign(stats, { shots: 0, makes: 0, streak: 0, best: 0, xp: 0 }); pendingShot = false; updateTrainHUD();
  resetTraining(); tvc.x = a.pos.x; tvc.z = a.pos.z; PM.closeWizard(); paused = false;
  say(KB.trainHint());
}
function openTrainSetup(fromPause = false) {            // desde el menú principal o desde la pausa (Cambiar cancha / jugador)
  paused = true; PM.closeWizard();
  TS.open({ onStart: startTraining, onBack: () => { if (fromPause) Pause.open(); else UI.showMain(); } });
}
function openCasual() { paused = true; PM.openWizard({ step: 0 }); }
function openOnline() { paused = true; Online.open(); }                          // Casual online: lobby de salas → mismo menú previo, con las reglas del anfitrión          // Partido casual: abre el menú previo (jugadores → equipos → camisetas → tu equipo → partido)
/* ---- pausa ---- */
function openPause() { if (!paused) Pause.open(); }
function pauseInfo() {
  if (mode === 'training') return `<div class="pz-card"><small>ESTA SESIÓN</small><div class="pz-stats"><div><b>${stats.makes}</b><span>ANOTADOS</span></div><div><b>${stats.shots}</b><span>TIROS</span></div><div><b>${stats.shots ? Math.round(stats.makes / stats.shots * 100) : 0}%</b><span>EFECTIVIDAD</span></div><div><b>${stats.best}</b><span>MEJOR RACHA</span></div></div></div>`;
  return `<div class="pz-card"><small>${QN[quarter - 1]} · ${fmt(clockT)}</small><div class="pz-score"><div><img src="${teamA.logo}" alt=""><b>${teamA.ab}</b><strong>${scoreA}</strong></div><em>–</em><div><strong>${scoreB}</strong><b>${teamB.ab}</b><img src="${teamB.logo}" alt=""></div></div><small>${scoreA === scoreB ? 'EMPATE' : `${scoreA > scoreB ? teamA.ab : teamB.ab} LIDERA POR ${Math.abs(scoreA - scoreB)}`}</small></div>${humans.length > 1 ? `<div class="pz-card pz-players"><small>JUGADORES</small>${humans.map(h => `<div style="--c:${h.color}"><i>${h.name}</i><span>${h.dev === 'kb' ? 'Teclado y mouse' : humanActive(h) ? 'Joystick' : '¡Joystick desconectado!'}</span><b>${h.team === 0 ? teamA.ab : teamB.ab}</b></div>`).join('')}</div>` : ''}`;
}
Pause.init({
  canOpen: () => !paused && !PM.isOpen() && !UI.isMainOpen() && !Online.isOpen() && Career.isHidden() && UT.isHidden(),
  isTraining: () => mode === 'training', info: pauseInfo,
  canSubs: () => mode === 'match' && !netRole && humans.some(h => h.agent), subsData, subSwap,
  onOpen: () => {
    if (!netRole) paused = true;                                      // online el partido NO se frena: el rival sigue jugando
    KB.releaseAll(); net.lc = null;
    if (!netRole) for (const a of [ctrl, ...humans.map(h => h.agent)]) if (a && a.state === 'charge') { a.state = 'dribble'; a.charge = 0; }     // un tiro a medio cargar se cancela
    updatePowerUI();
    document.exitPointerLock?.();
  },
  onResume: () => { paused = false; clock.getDelta(); },
  onRestart: () => resetTraining(), onChange: () => openTrainSetup(true), onExit: () => exitToMain(),
});
function exitToMain() {
  if (netRole) { Online.quitMatch(); return; }                          // online: abandonar avisa al rival y vuelve al lobby
  paused = true; dead = null; setFade(0); document.exitPointerLock?.(); flushXp();
  if (careerCtx) { const c = careerCtx; careerCtx = null; c.done({ abandoned: true }); return; }
  PM.closeWizard(); TS.close(); UI.showMain();
}

/* ============ Botones del HUD y camisetas (el menú previo al partido está en prematch.js) ============ */
function bindButtons() {
  $('pauseButton').onclick = e => { e.stopPropagation(); openPause(); };
}
const inkOf = k => ({ wordFill: k.wordFill, wordStroke: k.wordStroke, numFill: k.numFill, numStroke: k.numStroke, nameFill: k.nameFill, nameStroke: k.nameStroke });
const stripe = k => (lum(k.jersey) > 0.8 ? k.accent : k.jersey);            // franja de color del marcador
function applyTeams() {
  T[0].ab = teamA.ab; T[1].ab = teamB.ab;
  for (const [t, k, tm] of [[0, kitA, teamA], [1, kitB, teamB]]) for (const a of T[t].court) {
    a.R.setUniformStyle?.({ jersey: k.jersey, shorts: k.shorts, accent: k.accent, trim: k.trim, details: k.details, word: nickname(tm), ink: inkOf(k), decals: true });
    a.R.shoeM.color.set(k.shoes);
    a.m3k = { ab: tm.ab, kit: k.id };                            // equipo y camiseta: de ahí sale la carpeta/archivo del modelo 3D (players3d.js)
  }
  $('sbA').style.boxShadow = `inset 7px 0 0 ${stripe(kitA)}`; $('sbB').style.boxShadow = `inset -7px 0 0 ${stripe(kitB)}`;
  $('abA').textContent = teamA.ab; $('abB').textContent = teamB.ab;
  $('lgA').src = teamA.logo; $('lgB').src = teamB.logo;
}
function loadSetup(S) {                               // copia al juego lo que se eligió en el menú previo
  teamA = S.teamA; teamB = S.teamB; kitA = S.kitA; kitB = S.kitB; qLen = S.qLen; diff = S.diff;
  Object.assign(opts, { shotClock: S.shotClock, fatigue: S.fatigue, autoSubs: S.autoSubs, style: S.style });
  camHeight = S.camHeight || 0;
  styleKey = JSON.stringify(S.style);
}
const QN = ['1ST', '2ND', '3RD', '4TH', 'OT'];
let m3Loading = false;
async function startGame(S0 = null, role = null) {        // role: null = partido normal · 'host' / 'guest' = partido online
  try { await PM.ready(); } catch { /* planteles genéricos */ }
  const S = S0 || PM.getSetup();
  /* Modelos 3D (v48): los de los 10 titulares tienen que estar cargados ANTES de arrancar (así no aparece el cuerpo de siempre un rato). Sin archivo en su carpeta, no se espera nada. */
  const m3List = [[S.teamA, S.kitA, S.lineupA], [S.teamB, S.kitB, S.lineupB]].flatMap(([t, k, l]) => (t && k && l ? l.starters.map(info => ({ info, ab: t.ab, kit: k.id })) : []));
  if (m3List.length) {
    if (m3Loading) return;                                         // ya se está cargando (doble clic en Jugar)
    m3Loading = true;
    try { await P3D.prepare(m3List); } finally { m3Loading = false; }
  }
  careerCtx = S.career || null; for (const k in gpts) delete gpts[k];
  netRole = role; resetNet();
  if (role) net.pool = new Map([...S.lineupA.starters, ...S.lineupA.bench, ...S.lineupB.starters, ...S.lineupB.bench].map(p => [infoKey(p), p]));
  loadSetup(S);
  if (role === 'guest') { const L = PM.getSetup(); camHeight = L.camHeight || 0; S.cam = L.cam; }      // la cámara es de cada uno, no del anfitrión
  opts.styleB = role ? (S.styleB || null) : null; styleKeyB = JSON.stringify(S.styleB || '');
  setCourt(courtFor(S.courtTeam));                      // cancha del local o del visitante, según el menú del partido
  setMode('match'); applyTeams(); applyRosters(S.lineupA, S.lineupB);
  Box.reset(teamA, teamB, [...S.lineupA.starters, ...S.lineupA.bench], [...S.lineupB.starters, ...S.lineupB.bench]); B.ast = null; B.reboundOf = null;
  scoreA = scoreB = 0; quarter = 1; teamFouls[0] = teamFouls[1] = 0; B.foulPending = null; for (const t of [0, 1]) [...T[t].court.map(a => a.info), ...T[t].bench].forEach(i => { i.pf = 0; }); clockT = qLen; attSign = [-1, 1]; shotClock = 24; B.possTeam = 0; B.lastTeam = 0;
  for (const a of agents) { a.stam = 1; a.tired = false; a.act = null; a.stunT = 0; a.state = 'free'; a.ai = newAIState(); a.pos.set((a.slot - 2) * 2, 0, a.team === 0 ? -4 : 4); }
  B.holder = null; B.mode = 'dead'; autoUser = false; dead = null;
  if (role === 'guest') setupGuestHumans(S);
  else {
    if (role === 'host') S.humans = [{ dev: S.humans[0].dev, pad: S.humans[0].pad, team: 0 }, { dev: 'net', team: 1 }];     // el invitado es el segundo humano: sus controles llegan por la red
    setupHumans(S);
  }
  if (role) PM.hideForMatch(); else PM.closeWizard();
  paused = false; shotCounter = 0; Crowd.setVolume(UI.settings.crowd ?? 0.8); Crowd.start();
  camMode = S.cam; cam2k.snap = true;
  if (role) { if (camMode === 2) camMode = 0; }                                  // online no hay cámara libre
  else if (multi()) { if (camMode === 2) camMode = 0; if (teamsWithHumans() > 1 && camMode === 0) camMode = 1; }     // varios jugadores: sin cámara libre; si juegan en equipos contrarios, cámara de TV (se ve parejo para los dos lados)
  if (camMode === 2) yaw = ctrl.h + Math.PI; showCamName();
  if (role === 'guest') { say('Conectando con el anfitrión…'); return; }         // el invitado no simula: espera los snapshots
  startDead('quarter', 0, 0, null, 0, { instant: true });
  if (role) say(`${teamA.ab} vs ${teamB.ab} · ¡Partido online!`);
  else if (multi()) say(humans.map(h => `${h.name} ${h.dev === 'kb' ? 'teclado' : 'joystick'}`).join(' · ') + (teamsWithHumans() > 1 ? ' · ¡Versus!' : ' · ¡Cooperativo!'));
  else { say(KB.hint()); if (Pad.state.connected) say(Pad.hint()); }
}
Box.setContext(() => ({
  score: [scoreA, scoreB], quarter, qLabel: QN[quarter - 1], clock: fmt(clockT),
  onCourt: [0, 1].map(t => T[t].court.map(a => (a.info ? infoKey(a.info) : ''))),
  training: mode === 'training' ? stats : null, player: mode === 'training' ? agents[0]?.info?.name : '',
  hint: `Soltá ${KB.label(KB.bindings().stats?.[0])}${Pad.state.connected ? ` o ${Pad.label(Pad.bindings().stats)}` : ''} para volver al partido`,
}));
const cache = {};
const setText = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } };
const fmt = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function updateScoreboard() {
  setText('scA', scoreA); setText('scB', scoreB); setText('sbQ', QN[quarter - 1]);
  setText('sbT', fmt(clockT)); setText('sbShot', opts.shotClock ? Math.max(0, Math.ceil(shotClock)) : '--');
  setText('sbInfo', scoreA === scoreB ? 'EMPATE' : `${scoreA > scoreB ? teamA.ab : teamB.ab} LIDERA POR ${Math.abs(scoreA - scoreB)}`);
  $('sbShot').classList.toggle('low', opts.shotClock && shotClock < 5);
  arena.drawBoard({ a: teamA, b: teamB, sa: String(scoreA), sb: String(scoreB), q: QN[quarter - 1], clk: fmt(clockT), info: cache.sbInfo });
}
function tickGame(dt) {
  pollFoul(dt);
  if (dead) return;
  clockT -= dt;
  if (netRole !== 'guest') for (const t of [0, 1]) for (const a of T[t].court) if (a.active) bx(a, 'sec', dt);
  if (!opts.shotClock) shotClock = 24;                              // reloj de 24 s apagado: nunca vence
  if (B.holder || B.mode === 'pass') shotClock -= dt;                // el reloj de 24 s se frena con la pelota en el aire / en rebote
  if (shotClock <= 0 && B.holder) { bx(B.holder, 'tov'); say('Violación de 24 segundos'); if (B.holder.team === userTeam) Crowd.boo(0.6); startDead('violation', B.holder.pos.x, B.holder.pos.z, null, 1 - B.holder.team); return; }
  if (clockT <= 0) {
    Crowd.horn();
    if (quarter >= 4 && scoreA !== scoreB) { clockT = 0; updateScoreboard(); finishGame(); return; }
    quarter++; teamFouls[0] = teamFouls[1] = 0; clockT = quarter > 4 ? 90 : qLen;
    const inT = quarter === 2 ? 1 : quarter === 3 ? 1 : quarter === 4 ? 0 : 0;
    say(quarter > 4 ? '¡Empate! Tiempo suplementario' : `Comienza el cuarto ${quarter}`);
    startDead('quarter', 0, 0, null, inT, { flip: quarter === 3 });
  }
}
function finishGame() {
  const w = scoreA > scoreB;
  paused = true; document.exitPointerLock?.();
  if (careerCtx) { const c = careerCtx; careerCtx = null; setFade(0); c.done({ scoreA, scoreB, gpts: { ...gpts }, ot: Math.max(0, quarter - 4) }); return; }      // modo carrera: el resultado vuelve a la carrera
  if (netRole === 'host') {                                                       // online: resultado para los dos (la XP se da en onMatchEnded)
    const tm = t => ({ ab: t.ab, name: t.name, logo: t.logo });
    Online.matchOver({ sa: scoreA, sb: scoreB, ta: tm(teamA), tb: tm(teamB) }); return;
  }
  PM.openWizard({ step: 4, banner: `Final: ${teamA.ab} ${scoreA} - ${scoreB} ${teamB.ab} · ${scoreA === scoreB ? 'Empate' : w ? '¡Ganaste!' : 'Perdiste'}` });
  if (w) queueXp(25); queueXp(10); flushXp();
}

/* ============ Input ============ */
const typing = e => { const t = e.target; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
renderer.domElement.addEventListener('click', () => { if (!paused && !hasPointer && camMode === 2) renderer.domElement.requestPointerLock?.(); });
let unlockT = 0;                                      // para distinguir "solté el mouse yo (cambié de cámara)" de "apretaron Esc"
document.addEventListener('pointerlockchange', () => {
  const had = hasPointer; hasPointer = document.pointerLockElement === renderer.domElement;
  if (had && !hasPointer && !paused && performance.now() - unlockT > 400) openPause();   // Esc con el mouse capturado: el navegador se come la tecla, así que pausamos acá
});
document.addEventListener('visibilitychange', () => { if (document.hidden && !paused && mode === 'match' && !netRole) openPause(); });
document.addEventListener('mousemove', e => {
  if (!hasPointer || paused || camMode !== 2) return;
  yaw -= e.movementX * 0.0022 * UI.settings.sens;
  pitch = clamp(pitch - e.movementY * 0.0022 * UI.settings.sens, -1.2, 0.6);          // mouse abajo = mirar hacia abajo (no invertido)
});
addEventListener('wheel', e => { if (!paused) camDist = clamp(camDist + e.deltaY * 0.003, 2.2, 9); }, { passive: true });
function cycleCamera() {
  const n = multi() ? 2 : 3;                                    // con varios jugadores no hay cámara libre (es del mouse del J1)
  camMode = (camMode + 1) % n; if (camMode === 2) { yaw = ctrl.h + Math.PI; } else { unlockT = performance.now(); document.exitPointerLock?.(); }
  if (camMode === 1) { tvc.x = ctrl.pos.x; tvc.z = ctrl.pos.z; } showCamName();
}
function showCamName() { const el = $('camName'); el.textContent = `${CAM_NAMES[camMode]} (${KB.label(KB.bindings().camera[0])})`; el.classList.add('on'); clearTimeout(showCamName.t); showCamName.t = setTimeout(() => el.classList.remove('on'), 1600); }
/* Todas las entradas (teclado, mouse y, abajo, joystick) terminan en las mismas acciones: así se pueden reasignar sin tocar el juego */
const kbHuman = () => (humans.length === 1 ? humans[0] : humans.find(x => x.dev === 'kb'));   // quién juega con teclado y mouse: el único humano, o el que eligió teclado (puede ser cualquier casilla, no solo J1)
function pressAction(act, h = kbHuman()) {                       // teclado y mouse (los joysticks entran por padGame)
  if (netRole === 'guest') { guestAct(act, h); return; }
  if (act === 'stats') { Box.setHeld('kb', true); return; }               // tabla de puntos: se ve mientras la mantenés
  if (act === 'reset') { if (mode === 'training') resetTraining(); return; }
  if (act === 'camera') { cycleCamera(); return; }
  const c = h?.agent; if (!c) return;
  if (act === 'shoot') { startCharge(c); return; }
  if (act === 'pass') humanPass(h);
  else if (act === 'steal') { if (!startSteal(c) && c.state === 'dribble') startCrossover(c); }
  else if (act === 'switch') switchPlayer(h);
  else if (act === 'dribble') humanCrossover(h);
}
function releaseAction(act, h = kbHuman()) { if (act === 'stats') { Box.setHeld('kb', false); return; } if (netRole === 'guest') { guestRelease(act, h); return; } const c = h?.agent; if (act === 'shoot' && c?.state === 'charge') releaseCharge(c); }
document.addEventListener('keydown', e => {
  if (KB.captureKey(e)) return;                       // ← en Controles esperando una tecla nueva
  if (typing(e)) return;                              // ← escribiendo en un campo (email, contraseña…): el juego no toca ninguna tecla
  if (paused || (netRole && menuLock())) return;
  const acts = KB.actionsOf(e.code);
  if (!acts.length) return;
  e.preventDefault();
  KB.set(e.code, true);
  if (e.repeat) return;
  for (const act of acts) pressAction(act);
});
document.addEventListener('keyup', e => {
  const acts = KB.actionsOf(e.code); KB.set(e.code, false);
  if (acts.includes('stats')) Box.setHeld('kb', false);              // soltar Tab siempre cierra la tabla, aunque se haya abierto la pausa en el medio
  if (!paused) for (const act of acts) releaseAction(act);
});
addEventListener('blur', () => { KB.releaseAll(); Box.releaseAll(); });
addEventListener('gamepaddisconnected', e => {            // se desconectó el joystick de un jugador: se pausa y su jugador lo maneja la IA hasta que vuelva
  const h = humans.find(x => x.dev === 'pad' && x.pad === e.gamepad.index);
  if (h && multi()) { h.connected = false; say(`Se desconectó el joystick de ${h.name}. Volvé a conectarlo y apretá un botón.`); if (!paused) openPause(); }
});
addEventListener('gamepadconnected', e => {               // si vuelve (con otro número), lo reasignamos al jugador que se quedó sin joystick
  if (humans.some(x => x.dev === 'pad' && x.pad === e.gamepad.index)) return;
  const h = humans.find(x => x.dev === 'pad' && !(navigator.getGamepads?.()[x.pad]?.connected));
  if (h && multi()) { h.pad = e.gamepad.index; h.connected = true; say(`Joystick de ${h.name} reconectado.`); }
});
/* ---- guardado: todo se guarda solo (al cerrar, al ocultar la pestaña y cada 30 s) + aviso al cerrar jugando ---- */
function saveAll() { try { flushXp(); } catch { /* sin red */ } UT.saveNow(); Career.saveNow(); }
const playing = () => (!paused && mode === 'match') || !UT.isHidden() || !Career.isHidden();
let saveNote = null, saveNoteT = 0;
function showSaveNote() {                                          // si te quedás en la página después del aviso del navegador
  if (!saveNote) {
    saveNote = document.createElement('div'); saveNote.id = 'saveNote';
    saveNote.innerHTML = '<b>Guardá tu progreso antes de cerrar</b><span id="saveNoteMsg">Se guarda solo, pero podés guardarlo ahora.</span><button type="button" id="saveNoteBtn">GUARDAR</button><button type="button" id="saveNoteX" aria-label="Cerrar">✕</button>';
    document.body.appendChild(saveNote);
    saveNote.querySelector('#saveNoteBtn').onclick = () => { saveAll(); saveNote.querySelector('#saveNoteMsg').textContent = '✓ Progreso guardado'; clearTimeout(saveNoteT); saveNoteT = setTimeout(() => { saveNote.hidden = true; }, 1600); };
    saveNote.querySelector('#saveNoteX').onclick = () => { saveNote.hidden = true; };
  }
  saveNote.querySelector('#saveNoteMsg').textContent = 'Se guarda solo, pero podés guardarlo ahora.'; saveNote.hidden = false;
}
addEventListener('beforeunload', e => {                            // el texto del aviso lo fija el navegador; antes de que aparezca, ya se guardó todo
  saveAll();
  if (playing()) { e.preventDefault(); e.returnValue = ''; setTimeout(showSaveNote, 400); }   // si el aviso se cancela (te quedás), este timer sí corre
});
addEventListener('pagehide', saveAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveAll(); });
setInterval(() => { if (playing()) saveAll(); }, 30000);
const onUI = e => !!e.target.closest?.('button, input, select, label, #pm, #main, #auth, #settings, #pause, #controls');
document.addEventListener('contextmenu', e => { if (!paused) e.preventDefault(); });
document.addEventListener('mousedown', e => {
  if (paused || onUI(e) || (camMode === 2 && !hasPointer)) return;
  const code = 'Mouse' + e.button, acts = KB.actionsOf(code);
  if (!acts.length) return;
  KB.set(code, true);
  for (const act of acts) pressAction(act);
});
document.addEventListener('mouseup', e => {
  const code = 'Mouse' + e.button, acts = KB.actionsOf(code), was = KB.state.held[code]; KB.set(code, false);
  if (was && !paused) for (const act of acts) releaseAction(act);
});

/* ---- acciones del jugador humano ---- */
/* De dónde lee cada humano: solo = teclado y mouse + cualquier joystick; varios = cada uno con su dispositivo (un joystick propio, o el teclado y mouse para uno solo) */
const menuLock = () => Pause.isOpen() || !$('settings').hidden || !$('controls').hidden;       // online el partido sigue con el menú abierto: sin tocar los controles mientras tanto
function inputOf(h) {
  if (netRole && h.dev !== 'net' && menuLock()) return { kb: false, P: null };
  if (h.dev === 'net') return { kb: false, P: h.net ? h.net.P : null };       // el invitado: sus controles llegan por la red
  if (humans.length === 1) return { kb: true, P: h.dev === 'pad' && h.P && h.P.connected ? h.P : Pad.state };          // jugando solo: sirve el teclado y SU joystick (si se anotó con uno, los demás mandos conectados no cuentan); si se anotó con teclado, cualquier joystick que toques
  if (h.dev === 'kb') return { kb: true, P: null };
  return { kb: false, P: h.P && h.P.connected ? h.P : null };
}
const humanActive = h => humans.length === 1 || h.dev === 'kb' || h.dev === 'net' || !!(h.P && h.P.connected);
function humanDir(h = humans[0]) {
  if (h?.dev === 'net') { const n = h.net; if (!n || !n.m) return null; const l = Math.hypot(n.wx, n.wz) || 1; return V3(n.wx / l, 0, n.wz / l); }    // ya viene en ejes del mundo (el invitado lo calculó con su cámara)
  const f = V3(-Math.sin(yaw), 0, -Math.cos(yaw)), r = V3(Math.cos(yaw), 0, -Math.sin(yaw)), w = V3(), inp = inputOf(h);
  if (inp.kb) { if (KB.down('up')) w.add(f); if (KB.down('down')) w.sub(f); if (KB.down('right')) w.add(r); if (KB.down('left')) w.sub(r); }
  if (inp.P && inp.P.mag > 0) w.addScaledVector(f, -inp.P.ly).addScaledVector(r, inp.P.lx);      // stick izquierdo (relativo a la cámara)
  return w.lengthSq() > 0 ? w.normalize() : null;
}
function bestHumanPass(a, h = a?.hum || humans[0]) {   // el compañero que mejor coincide con la dirección en que te movés (o hacia el aro)
  if (!a || B.holder !== a || a.state !== 'dribble') return null;
  const w = humanDir(h) || V3(0, 0, attSign[a.team]), mates = T[a.team].court.filter(t => t !== a && t.active);
  const opps = T[1 - a.team].court;
  let best = null, bs = -9, near = null, nd = 99;
  for (const t of mates) {
    const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1, dot = (dx * w.x + dz * w.z) / d;
    if (d < nd) { nd = d; near = t; }
    if (dot < 0.25 || d < 1.5) continue;
    let risk = 0;
    for (const o of opps) { const l2 = d * d, tt = clamp(((o.pos.x - a.pos.x) * dx + (o.pos.z - a.pos.z) * dz) / l2, 0, 1); const ds = Math.hypot(o.pos.x - (a.pos.x + dx * tt), o.pos.z - (a.pos.z + dz * tt)); if (ds < 0.8) risk = Math.max(risk, 1 - ds / 0.8); }
    const s = dot * 2 - Math.abs(d - 10) * 0.03 - risk * 0.8 + (t.hum ? 0.35 : 0);       // un poquito de preferencia por pasarle a un amigo humano
    if (s > bs) { bs = s; best = t; }
  }
  return best || near;
}
const modHeld = h => { const inp = inputOf(h); return !!(inp.kb && KB.down('mod')) || !!inp.P?.down?.mod; };      // ¿está apretado el botón de lujo (L2 / Z)?
function humanPass(h = humans[0], flash) { if (autoUser || dead || mode !== 'match' || !h) return; const t = bestHumanPass(h.agent, h); if (t) doPass(h.agent, t, (flash ?? modHeld(h)) ? 'flash' : undefined); }
function humanCrossover(h = humans[0], flash) { if (!autoUser && !dead && h) startCrossover(h.agent, (flash ?? modHeld(h)) ? 'flash' : undefined); }
function switchPlayer(h = humans[0]) {
  const c = h?.agent;
  if (!c || mode !== 'match' || dead || c.state === 'charge' || c.state === 'shoot' || c.state === 'dunk') return;
  const hd = B.holder; if (hd && hd.team === h.team && autoFollow(h.team)) return;       // con la pelota en tu equipo el control ya la sigue solo
  const ref = hd ? hd.pos : BP;
  let best = null, bd = 99;
  for (const a of freeMates(h.team, c)) { if (a === c) continue; const d = Math.hypot(a.pos.x - ref.x, a.pos.z - ref.z); if (d < bd) { bd = d; best = a; } }   // solo jugadores que no maneja otro humano
  if (best) { takeAgent(h, best); h.lock = 2.5; ctrlLock = 2.5; }
}
function updateControl(dt) {                            // a quién controlás: con la pelota en tu equipo, al que la tiene; en defensa, al más cercano. Con varios humanos en un equipo, cada uno se queda con su jugador (y puede cambiar con el botón de cambio)
  if (mode === 'training') { ctrl = agents[0]; return; }
  if (!humans.length) return;
  ctrlLock = Math.max(0, ctrlLock - dt);
  for (const hu of humans) {
    hu.lock = Math.max(0, hu.lock - dt);
    if (!autoFollow(hu.team) || !humanActive(hu)) continue;
    const c = hu.agent, h = B.holder;
    if (h && h.team === hu.team) { if (c !== h) takeAgent(hu, h); continue; }
    if (hu.lock > 0 || dead || c.state === 'charge' || c.state === 'shoot' || c.state === 'dunk') continue;
    let ref = null; if (h) ref = h.pos; else if (B.mode === 'loose') ref = BP;
    if (!ref) continue;
    let best = null, bd = 99; const cur = Math.hypot(c.pos.x - ref.x, c.pos.z - ref.z);
    for (const a of T[hu.team].court) { const d = Math.hypot(a.pos.x - ref.x, a.pos.z - ref.z); if (d < bd) { bd = d; best = a; } }
    if (best && best !== c && bd + 1.2 < cur) takeAgent(hu, best);
  }
  ctrl = humans[0].agent;
}
/* Joystick (v35): el rumbo del stick no se aplica de golpe como un mouse. Se pega a 16 direcciones y el jugador GIRA hacia ahí con inercia:
   parado o trotando gira casi al instante; a toda velocidad hace una curva (más o menos cerrada según su aceleración / cambio de dirección). */
function steerStick(a, P, dt) {
  const s = Pad.shapeStick(P.lx, P.ly), f = V3(-Math.sin(yaw), 0, -Math.cos(yaw)), r = V3(Math.cos(yaw), 0, -Math.sin(yaw));
  const w = f.multiplyScalar(-s.y).addScaledVector(r, s.x); if (w.lengthSq() < 1e-6) return null;
  const target = Math.atan2(w.x, w.z), sp = Math.hypot(a.vel.x, a.vel.z); a.stickMag = s.mag;
  if (a.steer === undefined || sp < 1.2 || !a.grounded) a.steer = target;
  else {
    const rate = lerp(Pad.STICK.turnStand, Pad.STICK.turnRun, clamp(sp / 7, 0, 1)) * clamp(a.accMul ?? 1, 0.8, 1.25) ;
    a.steer += clamp(wrap(target - a.steer), -rate * dt, rate * dt);
  }
  return V3(Math.sin(a.steer), 0, Math.cos(a.steer));
}
function humanIntent(a, dt = 1 / 60) {
  const h = a.hum, inp = inputOf(h), I = a.intent;
  let w = dead ? null : humanDir(h);
  const kbMove = !!inp.kb && (KB.down('up') || KB.down('down') || KB.down('left') || KB.down('right'));
  if (w && h.dev !== 'net' && inp.P && inp.P.mag > 0 && !kbMove) w = steerStick(a, inp.P, dt) || w;
  I.x = w ? w.x : 0; I.z = w ? w.z : 0; I.mag = w ? 1 : 0; I.face = null; I.move = false;
  const P = inp.P || NO_PAD, pd = dead ? {} : P.down, kd = dead || !inp.kb ? (() => false) : KB.down;
  const keySprint = kd('sprint'), padSprint = dead ? 0 : P.amt.sprint;           // gatillo analógico: apretado a medias = trote, a fondo = sprint
  I.sprintAmt = keySprint ? 1 : padSprint;
  I.sprint = keySprint || !!pd.sprint;
  I.jump = kd('jump') || !!pd.jump || (!!pd.shoot && B.holder !== a);      // como en NBA 2K: sin la pelota, el botón de tiro salta / tapona / rebota
  I.dribHold = kd('dribble') || !!pd.dribble;
  I.mod = kd('mod') || !!pd.mod;                                            // botón de lujo (L2): mates, bandejas y pases especiales
  const keyMove = kd('up') || kd('down') || kd('left') || kd('right');
  I.analog = (!dead && P.mag > 0 && !keyMove && !I.sprint) ? (h.dev !== 'net' && a.stickMag > 0 ? a.stickMag : P.mag) : 1;   // inclinación del stick = velocidad
  return I;
}
const NO_PAD = { mag: 0, lx: 0, ly: 0, down: {}, amt: { sprint: 0 } };

/* ============ Acciones de jugadores (las usan el humano y los bots) ============ */
const _tv = V3(), _dv = V3(), _hp = V3();
function startCharge(a) {
  if (a.state !== 'dribble' || B.holder !== a || !a.grounded || (dead && !(dead.ftStage === 'aim' && dead.ftShooter === a)) || inbound || a.act) return false;
  a.aimHoop = mode === 'training' ? facingHoop(a) : attackHoop(a.team);
  a.state = 'charge'; a.charge = 0; a.chargeDir = 1; a.chargeMul = chargeTarget(a); a.side = 1; a.shotId = ++shotCounter; return true;
}
function releaseCharge(a) {
  if (a.state !== 'charge') return;
  a.state = 'shoot'; a.shootT = a.grounded ? 0 : T_LAUNCH; a.launched = false; a.released = false;
}
function facingHoop(a) {
  const f = V3(Math.sin(a.h), 0, Math.cos(a.h)), n = h => V3(0, 0, h.hz).sub(a.pos).setY(0).normalize().dot(f);
  return n(hoops[0]) > n(hoops[1]) ? hoops[0] : hoops[1];
}
function contestOf(a) {                                // 0..1 qué tan marcado está el que tira
  const H = a.aimHoop; let best = 0;
  const hx = 0 - a.pos.x, hzz = H.hz - a.pos.z, hl = Math.hypot(hx, hzz) || 1;
  for (const o of agents) {
    if (!o.active || o.team === a.team) continue;
    const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z, d = Math.hypot(dx, dz);
    if (d > 2.4 || d < 0.01) continue;
    const dot = (dx * hx + dz * hzz) / (d * hl); if (dot < 0) continue;
    let c = (1 - (d - 0.5) / 1.9) * (0.5 + 0.5 * dot);
    if (o.act === 'block' || !o.grounded) c *= 1.25; else if (!o.def) c *= 0.6;
    best = Math.max(best, clamp(c, 0, 1));
  }
  return a.sbT > 0 ? best * 0.45 : best;                 // después de un stepback queda más libre
}
/* Velocidad de la barra de tiro (v50): multiplica CHARGE_SPEED. Más alto = la barra corre más rápido = más difícil soltar en la línea blanca.
   · Triple: base más rápida (×1.28) que un tiro normal.
   · Rating de la zona (triple / media distancia / cerca): 99 → ~×0.77 · 70 → ×1 · 40 → ~×1.24. Cuanto mejor tirador, más lenta (más fácil).
   · Gente encima: hasta +45 % con un defensor pegado de frente; libre = sin recargo. Cansado: +10 %.
   · Tiros libres: base ×1.10 y depende del rating de tiro libre (90 → ×0.99 · 50 → ×1.22). */
function chargeTarget(a) {
  const info = a.info || {}, H = a.aimHoop || attackHoop(a.team);
  if (a.ftShot) return clamp(1.1 + (70 - (info.ft ?? 70)) * 0.006, 0.95, 1.4) * (a.tired ? 1.1 : 1) * (1 + 0.12 * tirePen(a));
  const d = Math.hypot(a.pos.x, H.hz - a.pos.z), three = d > 7.24 || Math.abs(a.pos.x) >= 6.7;
  const rating = clamp(1 - (zoneRating(info, three, d) - 70) * 0.008, 0.7, 1.35);
  const open = 1 + (a.aimHoop ? contestOf(a) : 0) * 0.45;
  return clamp((three ? 1.28 : 1) * rating * open * (a.tired ? 1.1 : 1) * (1 + 0.18 * tirePen(a)), 0.6, 2.1);
}
function aiShoot(a) {                                  // el bot decide tirar: la calidad del tiro define si el "disparo" sale perfecto o errado
  if (!startCharge(a)) return false;
  const q = shotQuality(G, a, a.pos.x, a.pos.z), pr = prof(a), cst = contestOf(a);
  const p = clamp(q * pr.acc * (1 - cst * 0.3) * (a.tired ? 0.85 : 1) * (1 - 0.18 * tirePen(a)), 0.03, 0.9);
  a.charge = Math.random() < p ? PERFECT + (Math.random() - 0.5) * 0.05 : PERFECT + (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.14);
  releaseCharge(a); return true;
}
/* ---- catálogo de mates y bandejas (v30) ----
   Mates especiales: turn = giro (1 = media vuelta, 2 = vuelta completa), t0/tt = cuándo empieza y cuánto dura el giro, s0 = cuándo baja la pelota al aro,
   fin = mano con la que termina, leg = pasa la pelota por debajo de la pierna, wind = molino. Se eligen con el botón de lujo (L2) o al azar. */
const DUNKS = {
  back:     { label: 'de espaldas',            TF: 0.92, JH: 1.34, s0: 0.44, fin: 'R', turn: 1, t0: 0.04, tt: 0.26 },
  leg:      { label: 'por debajo de la pierna', TF: 1.04, JH: 1.34, s0: 0.54, fin: 'L', leg: true },
  wind:     { label: 'molino',                 TF: 0.96, JH: 1.28, s0: 0.46, fin: 'R', wind: true },
  spin:     { label: '360',                    TF: 1.00, JH: 1.32, s0: 0.50, fin: 'R', turn: 2, t0: 0.03, tt: 0.42 },
  legBack:  { label: 'pierna + de espaldas',   TF: 1.10, JH: 1.40, s0: 0.58, fin: 'L', leg: true, turn: 1, t0: 0.30, tt: 0.24 },
  windSpin: { label: 'molino + 360',           TF: 1.08, JH: 1.38, s0: 0.56, fin: 'R', wind: true, turn: 2, t0: 0.04, tt: 0.46 },
};
const FLASHY_DUNKS = Object.keys(DUNKS), LEG_P0 = 0.10, LEG_P1 = 0.32;       // la pelota pasa por debajo de la pierna entre LEG_P0 y LEG_P1
/* Bandejas: phys = cómo sale la pelota (norm: normal · bank: pega en el tablero y entra · roll: gira sobre el aro y entra o sale · float: arco alto), pose = animación del cuerpo, off = cuánto se desplaza de costado */
const LAYS = {
  std:     { label: 'bandeja',             TF: 0.66, JH: 0.60, rel: 0.30, phys: 'norm',  pose: 'std' },
  bank:    { label: 'a tablero',           TF: 0.66, JH: 0.60, rel: 0.30, phys: 'bank',  pose: 'std' },
  finger:  { label: 'finger roll',         TF: 0.70, JH: 0.64, rel: 0.32, phys: 'roll',  pose: 'finger', hard: 0.04 },
  scoop:   { label: 'con la palma arriba', TF: 0.70, JH: 0.55, rel: 0.34, phys: 'norm',  pose: 'scoop',  hard: 0.03 },
  reverse: { label: 'reversa',             TF: 0.78, JH: 0.66, rel: 0.40, phys: 'bank',  pose: 'rev',    hard: 0.03, off: 0.9 },
  euro:    { label: 'euro step',           TF: 0.80, JH: 0.62, rel: 0.40, phys: 'norm',  pose: 'euro',   hard: 0.02, off: 0.55 },
  float:   { label: 'floater',             TF: 0.62, JH: 0.50, rel: 0.24, phys: 'float', pose: 'float',  hard: 0.06 },
};
function pickDunk(a, mod) {                                   // con L2 siempre un mate de lujo; sin L2, de vez en cuando (más seguido con buen rating de mate)
  const ex = mod ? 1 : isHum(a) ? 0.15 : clamp(((a.info?.dunkD ?? 70) - 68) / 120, 0, 0.3);
  if (Math.random() >= ex) return Math.random() < 0.5 ? 'dunk2' : 'dunk1';
  const pool = FLASHY_DUNKS.filter(k => k !== a.lastDunk), k = pool[Math.floor(Math.random() * pool.length)];
  a.lastDunk = k; return k;
}
function pickLay(a, mod, d) {
  const pool = [], add = (k, w) => { for (let i = 0; i < w; i++) pool.push(k); };
  if (mod) { add('finger', 3); add('scoop', 3); add('reverse', 3); add('euro', 3); add('bank', 2); if (d > 2.2) add('float', 3); }
  else { add('std', 10); add('bank', Math.abs(a.pos.x) > 1.4 ? 7 : 3); add('finger', 3); add('scoop', 2); add('euro', 2); add('reverse', 2); if (d > 2.3) add('float', 3); }
  let k = pool[Math.floor(Math.random() * pool.length)];
  if (k === a.lastLay && k !== 'std') k = pool[Math.floor(Math.random() * pool.length)];
  a.lastLay = k; return k;
}
function startDunk(a, H, dmode, kind) {
  const L = dmode === 'layup', D = a.D, ds = L ? (LAYS[kind] || LAYS.std) : (DUNKS[kind] || null);
  Object.assign(D, { mode: dmode, H, t: 0, rd: false, cap: false, scored: false, bl: false, hand: 'R', sd: Math.random() < 0.5 ? -1 : 1,
    def: L ? null : ds, lay: L ? ds : null, fin: ds?.fin || 'R', s0: !L && ds ? ds.s0 : 0.40, t0: ds?.t0 || 0, tt: ds?.tt || 1, off: ds?.off || 0,
    TF: ds ? ds.TF : L ? 0.66 : 0.84, JH: ds ? ds.JH : L ? 0.6 : 1.2 });
  D.rel = L ? (ds ? ds.rel : 0.30) : D.s0 + 0.12;
  D.corr.set(0, 0, 0); D.pw.copy(a.pos); a.state = 'dunk'; a.shotId = ++shotCounter; a.side = 1;
  const cst = contestOf({ ...a, aimHoop: H, pos: a.pos, team: a.team }), hard = (L && ds?.hard) || 0;
  D.miss = L && Math.random() < (isHum(a) ? clamp((72 - a.info.layup) * 0.005 + cst * 0.4 * (1.25 - 0.5 * clamp((a.info.strength - 25) / 74, 0, 1)), 0, 0.7) : clamp(0.28 - (a.info.layup - 70) * 0.006 - (prof(a).acc - 1) * 0.2 + cst * 0.4 * (1.25 - 0.5 * clamp((a.info.strength - 25) / 74, 0, 1)), 0.04, 0.7)) + hard;
  hoops.forEach(h => h.done = false); if (a === ctrl) attempt();
  bx(a, 'fga'); B.reboundOf = null;                                   // mates y bandejas cuentan como intento al empezar (aunque los tapen)
  if (!L) rollShootingFoul(a, 'dunk', false, H);
}
function updateDunk(a, dt) {
  const D = a.D; D.t += dt;
  const H = D.H, L = D.mode === 'layup', df = D.def, hoopAng = Math.atan2(-a.pos.x, H.hz - a.pos.z);
  if (df && df.turn && D.t >= TW) a.h = hoopAng + df.turn * Math.PI * smooth((D.t - TW - df.t0) / df.tt);       // mates con giro: el cuerpo da la media vuelta / vuelta completa en el aire
  else a.h += clamp(wrap(hoopAng - a.h), -16 * dt, 16 * dt);
  if (D.t < TW) { a.pos.addScaledVector(a.vel, dt); a.vel.multiplyScalar(Math.exp(-3 * dt)); D.pw.copy(a.pos); return; }
  const tf = D.t - TW, u = Math.min(tf / (D.TF / 2), 1);
  _dv.set(D.pw.x, 0, D.pw.z - H.hz).normalize();                    // hacia dónde está el jugador respecto al aro
  _tv.set(0, 0, H.hz).addScaledVector(_dv, L ? 0.75 : 0.35).add(D.corr);   // mate: la mano queda sobre el aro; bandeja: un poco antes
  if (D.off) { const lat = D.off * D.sd * smooth(u); _tv.x -= _dv.z * lat; _tv.z += _dv.x * lat; }     // reversa / euro step: se corre de costado
  const p = lerp(u, smooth(u), 0.5);
  a.pos.set(lerp(D.pw.x, _tv.x, p), 0, lerp(D.pw.z, _tv.z, p));
  const u2 = tf / D.TF; a.y = D.JH * 4 * u2 * (1 - u2); a.grounded = false;
  if (!L && tf > D.s0 - 0.2 && tf < D.s0 + 0.05) {                  // corrige la posición para que la mano que termina el mate quede justo sobre el aro
    _hp.setFromMatrixPosition(a.R['h' + D.fin].matrixWorld); D.corr.x += (0 - _hp.x) * 0.25; D.corr.z += (H.hz - _hp.z) * 0.25;
  }
  if (tf >= D.TF) { a.y = 0; a.vy = 0; a.grounded = true; a.landC = 0.6; a.vel.set(0, 0, 0); a.state = 'free'; }
}
function tryDunk(a, mod) {
  if (a.state !== 'dribble' || B.holder !== a || !a.grounded || dead) return false;
  const sp = Math.hypot(a.vel.x, a.vel.z); let best = null;
  for (const H of (mode === 'training' ? hoops : [attackHoop(a.team)])) {
    _dv.set(-a.pos.x, 0, H.hz - a.pos.z); const d = _dv.length(); if (d < 0.5) continue;
    _dv.divideScalar(d);
    if (_dv.x * Math.sin(a.h) + _dv.z * Math.cos(a.h) > 0.6 && d <= 4.0 && (!best || d < best.d)) best = { H, d };
  }
  if (!best) return false;
  if (sp >= 4.8 && best.d >= 1.6 && canDunk(a.info)) { const k = pickDunk(a, mod); if (DUNKS[k]) startDunk(a, best.H, 'dunkX', k); else startDunk(a, best.H, k); return true; }
  if (best.d <= 3.0 && (sp >= 1.5 || best.d <= 2.2)) { startDunk(a, best.H, 'layup', pickLay(a, mod, best.d)); return true; }
  return false;
}

/* ---- tapones a mates y bandejas en el aire ---- */
function checkDunkBlocks() {
  if (mode !== 'match' || dead) return;
  for (const s of agents) {
    if (!s.active || s.state !== 'dunk') continue;
    const D = s.D; if (D.rd || D.bl || B.holder !== s) continue;
    const tf = D.t - TW, lim = D.mode === 'layup' ? D.rel : D.s0 + 0.04; if (tf < 0.02 || tf > lim) continue;
    for (const d of agents) {
      if (!d.active || d.team === s.team || d.act !== 'block' || d.grounded || d.stunT > 0) continue;
      const ext = d.blockKind === 'chase' || d.blockKind === 'spike', reach = d.y + (ext ? 2.62 : 2.5) * d.scale;
      if (Math.hypot(BP.x - d.pos.x, BP.z - d.pos.z) > (d.blockKind === 'chase' ? 1.15 : 1.0) || BP.y > reach || BP.y < d.y + 1.2) continue;
      resolveDunkBlock(s, d); break;
    }
  }
}
function resolveDunkBlock(s, d) {                      // el defensor llegó a la pelota del que está mateando / haciendo la bandeja: ¿tapón limpio, tapón con falta, falta sin tapón o nada?
  const D = s.D; D.bl = true;
  const lay = D.mode === 'layup', rb = d.info.block ?? 60, rs = lay ? (s.info.layup ?? 70) : (s.info.dunkD ?? 70);
  const pB = clamp(0.42 + (rb - rs) / 160 + (d.scale - s.scale) * 0.8 + ((d.jumpM ?? 1) - (s.jumpM ?? 1)) * 1.2 - (lay ? 0 : 0.08) + (isHum(d) ? 0.1 : 0), 0.12, 0.85);
  const blocked = Math.random() < pB;
  const foul = !B.foulPending && Math.random() < clamp((blocked ? 0.30 : 0.22) + (rs - rb) / 400, 0.1, 0.5);
  if (foul) { B.foulPending = { type: lay ? 'layup' : 'dunk', shooter: s, fouler: d, three: false, age: 0 }; whistle(); say(blocked ? `¡TAPÓN con falta de ${lastN(d)} sobre ${lastN(s)}!` : `¡Falta de ${lastN(d)} sobre ${lastN(s)}!`); }
  if (!blocked) { d.blkHit = 0.3; return; }                   // lo rozó: el mate sigue (y si entra, es un y-uno)
  if (!foul) bx(d, 'blk');
  D.rd = true;                                                // tapón: la pelota sale despedida hacia afuera del aro
  const away = V3(s.pos.x, 0, s.pos.z - D.H.hz); if (away.lengthSq() < 1e-4) away.set(0, 0, -D.H.s); away.normalize();
  const side = V3(-away.z, 0, away.x).multiplyScalar((Math.random() - 0.5) * 3.2);
  B.holder = null; B.mode = 'loose'; B.shooter = null; B.lastTeam = d.team; B.lastTouch = d; B.noPick = { a: s, t: 0.35 }; B.passT = 0;
  BV.copy(away).multiplyScalar(5.5 + Math.random() * 3).add(side); BV.y = 1.2 + Math.random() * 1.6; BW.set((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14);
  s.state = 'free'; s.act = null; s.stunT = Math.max(s.stunT, 0.5); s.grounded = false;     // el que tiraba cae
  s.vy = D.JH * 4 * (1 - 2 * clamp((D.t - TW) / D.TF, 0, 1)) / D.TF; s.vel.copy(away).multiplyScalar(-1.2);
  d.blkHit = 0.45;
  if (!foul) say(lay ? `¡TAPÓN de ${lastN(d)} a ${lastN(s)}!` : `¡TAPÓN de ${lastN(d)} al mate de ${lastN(s)}!`);
  cheerAt(d.team === userTeam ? 2.4 : 0.9, d.team === userTeam);
}
/* ---- pase ---- */
/* Pases con lujo (L2 + pasar, o al azar con los bots buenos pasadores): wind = lo que tarda el movimiento antes de soltar la pelota, err = cuánto aumenta el error del pase */
const PASS_STYLES = { behind: { wind: 0.16, err: 1.2 }, nolook: { wind: 0.12, err: 1.1 }, wrap: { wind: 0.16, err: 1.25 }, flip: { wind: 0.14, err: 1.1 }, bounce: { wind: 0.12, err: 1.0 } };
const FLASH_KEYS = Object.keys(PASS_STYLES), PASS_DUR = 0.62;
function doPass(a, t, style) {
  if (!a || !t || B.holder !== a || a.state !== 'dribble' || dead || a.act) return false;
  if (style === undefined && !isHum(a) && mode === 'match' && Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z) > 3.5 && Math.random() < 0.10 * clamp(((a.info?.passAcc ?? 70) - 60) / 40, 0, 1)) style = 'flash';
  if (style === 'flash') { const pool = FLASH_KEYS.filter(k => k !== a.lastFlash); style = pool[Math.floor(Math.random() * pool.length)]; a.lastFlash = style; }
  if (!style) return launchPass(a, t, null);
  a.h = Math.atan2(t.pos.x - a.pos.x, t.pos.z - a.pos.z);
  a.act = 'pass'; a.actT = PASS_DUR; a.passStyle = style; a.passSd = Math.random() < 0.5 ? -1 : 1; a.state = 'free';      // arma el movimiento; la pelota sale en ballLogic cuando termina passQ
  a.passQ = { t: PASS_STYLES[style].wind, tgt: t, style };
  return true;
}
function launchPass(a, t, style) {
  const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
  a.h = Math.atan2(dx, dz);
  const from = style ? BP.clone() : V3(a.pos.x + dx / d * 0.45, 1.3, a.pos.z + dz / d * 0.45);      // con lujo, la pelota sale de donde está la mano
  const spd = 13 + Math.min(d, 20) * 0.35, tf = Math.max(0.12, d / spd);
  const aim = V3(t.pos.x + t.vel.x * tf * 0.8, 1.3, t.pos.z + t.vel.z * tf * 0.8);
  const tf2 = Math.max(0.12, Math.hypot(aim.x - from.x, aim.z - from.z) / spd);
  const v = V3((aim.x - from.x) / tf2, (aim.y - from.y) / tf2 + 0.5 * G9 * tf2, (aim.z - from.z) / tf2).multiplyScalar(1);
  v.x *= 1.1; v.z *= 1.1;                                              // compensa el arrastre del aire en pases largos
  const err = (0.012 + (100 - a.info.passAcc) * 0.0006) * prof(a).passErr * (1 + (a.tired ? 0.8 : 0) + 0.5 * tirePen(a)) * (isHum(a) ? 0.7 : 1) * (style ? PASS_STYLES[style].err : 1);
  v.applyAxisAngle(UP, gauss() * err); v.multiplyScalar(1 + gauss() * err * 0.5);
  let bw = null, bn = 0;
  if (style === 'bounce') {                                            // pase de pique: se busca dónde pegar en el piso para que llegue a la cintura del compañero
    const sol = solveBounce([from.x, from.y, from.z], [aim.x, aim.z]);
    if (sol) { v.set(sol.v[0], sol.v[1], sol.v[2]); v.applyAxisAngle(UP, gauss() * err * 0.5); bw = sol.w; bn = 1; }
  }
  if (!style) { a.act = 'pass'; a.actT = 0.32; }
  a.state = 'free';
  B.holder = null; B.mode = 'pass'; B.passer = a; B.target = t; B.rolled = new Set(); B.passT = 0; B.bn = bn; B.noPick = { a, t: 0.2 }; B.lastTeam = a.team; B.lastTouch = a; B.ast = { from: a, to: t, t: gameTime };
  BP.copy(from); BV.copy(v); if (bw) BW.set(bw[0], bw[1], bw[2]); else BW.set(0, 0, 0); inbound = false;
  if (isHum(a) && autoFollow(a.team)) { takeAgent(a.hum, t); a.hum && (a.hum.lock = 0); }   // con un solo humano en el equipo, el control viaja con la pelota
  return true;
}

/* ---- dribleo (Ctrl): cruce de mano, cuesta energía; cansado no se puede ---- */
const MOVES = { legs: { dur: 0.50, label: 'por abajo de las piernas' }, behind: { dur: 0.50, label: 'por la espalda' }, stepback: { dur: 0.55, label: 'stepback' }, spin: { dur: 0.62, label: 'giro' } };
const MOVE_KEYS = Object.keys(MOVES);
function startCrossover(a, style) {
  if (a.state !== 'dribble' || B.holder !== a || !a.grounded || a.moveCd > 0) return false;
  if (a.tired || a.stam < 0.1) { if (isHum(a)) say('¡Cansado! No podés driblear así: frená un poco para recuperar energía.'); return false; }
  if (style === undefined && !isHum(a) && mode === 'match' && Math.random() < 0.12 * clamp(((a.info?.handle ?? 70) - 65) / 35, 0, 1)) style = 'flash';
  if (style === 'flash') { const pool = MOVE_KEYS.filter(k => k !== a.lastMove); style = pool[Math.floor(Math.random() * pool.length)]; a.lastMove = style; }
  const mv = style ? MOVES[style] : null, fx = Math.sin(a.h), fz = Math.cos(a.h);
  if (mv) {                                         // dribleo con lujo: más largo, gasta más energía y confunde más al defensor
    a.moveKind = style; a.moveDur = mv.dur; a.moveT = mv.dur; a.crossT = mv.dur; a.moveCd = mv.dur + 0.1; a.stam = Math.max(0, a.stam - 0.07 * (a.drainM ?? 1)); a.spinH0 = a.h;
    if (style !== 'stepback') a.side *= -1;
    else { a.vel.x -= fx * 3.4; a.vel.z -= fz * 3.4; a.sbT = 0.9; }          // stepback: se despega hacia atrás y queda con espacio para tirar
    if (isHum(a)) say(`¡Dribleo ${mv.label}!`);
  } else { a.moveKind = null; a.moveT = 0; a.side *= -1; a.crossT = 0.35; a.moveCd = 0.4; a.stam = Math.max(0, a.stam - 0.045 * (a.drainM ?? 1)); }
  for (const d of T[1 - a.team].court) {                // un cruce puede dejar sentado al defensor
    if (!d.active || !d.grounded || d.stunT > 0) continue;
    const dx = d.pos.x - a.pos.x, dz = d.pos.z - a.pos.z, dd = Math.hypot(dx, dz);
    if (dd < 1.7 && dd > 0.1 && (dx * fx + dz * fz) / dd > 0.3) {
      const p = clamp((0.28 + (a.info.handle - d.info.perD) / 85 - (oppTeam(d.team) ? (prof(d).tight - 0.5) * 0.2 : 0)) * (mv && style !== 'stepback' ? 1.4 : 1), 0.08, 0.75);
      if (Math.random() < p) { d.stunT = 0.75; if (isHum(a) && !isHum(d)) say('¡Lo dejaste sentado!'); }
    }
  }
  return true;
}

/* ---- robo y tapón ---- */
function startSteal(a) {
  if (a.state !== 'free' || !a.grounded || a.act || a.stunT > 0 || dead || mode !== 'match') return false;
  a.act = 'steal'; a.actT = 0.5; a.stealDone = false;
  a.reachCount = gameTime < a.reachT ? a.reachCount + 1 : 1; a.reachT = gameTime + 2.5;
  return true;
}
function resolveSteal(a) {
  a.stealDone = true;
  const h = B.holder; if (!h || h.team === a.team) { a.stunT = 0.3; return; }
  const dx = h.pos.x - a.pos.x, dz = h.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
  const fwd = (dx * Math.sin(a.h) + dz * Math.cos(a.h)) / d;
  if (d > 1.3 || fwd < 0.3) { a.stunT = 0.5; return; }
  // Como en NBA 2K: insistir con el botón de robo aumenta mucho el riesgo de reach-in.
  const spam = Math.max(0, a.reachCount - 1);
  const foulChance = clamp(0.035 + spam * 0.075 + (65 - a.info.steal) * 0.0012 + (d < 0.95 ? 0.12 : 0), 0.025, 0.58);
  if (Math.random() < foulChance) {
    a.act = 'foul'; a.actT = 0.72; a.stunT = 0.25;
    if (spam >= 3 && Math.random() < 0.3) { commitFoul({ type: 'technical', fouler: a, victim: h, why: 'Insistió demasiado con el robo.', inTeam: h.team, x: h.pos.x, z: h.pos.z }); return; }
    commitFoul({ type: 'reach', fouler: a, victim: h, x: h.pos.x, z: h.pos.z });
    return;
  }
  let p = 0.30 + (a.info.steal - h.info.handle) * 0.0065 + (a.info.speed - h.info.speed) * 0.002 + (oppTeam(a.team) ? prof(a).stealSucc : 0);
  if (h.state === 'dribble') { p += BP.y < 0.75 ? 0.12 : -0.08; if (h.crossT > 0 || h.dribMode) p -= 0.12; } else p *= 0.5;
  if (h.stam < 0.25) p += 0.12; if (a.stam < 0.2) p -= 0.1; if (h.stunT > 0) p += 0.15;
  if (oppTeam(h.team)) p *= prof(h).protect > 1 ? 1 / prof(h).protect : 2 - prof(h).protect;
  p = clamp(p, 0.04, 0.8);
  if (Math.random() < p) {
    bx(a, 'stl'); bx(h, 'tov');
    const clean = Math.random() < 0.55;
    if (clean) { say(`¡Robo de ${a.info.name.split(' ').slice(-1)[0]}!`); B.holder = null; B.mode = 'loose'; giveBall(a, 'steal'); }
    else {
      say('¡Pelota suelta!'); B.holder = null; B.mode = 'loose'; h.state = 'free'; h.act = null; h.stunT = 0.4;
      BV.set(Math.sin(a.h) * 3.2 + (Math.random() - 0.5), 2.2, Math.cos(a.h) * 3.2 + (Math.random() - 0.5)); B.noPick = { a: h, t: 0.35 }; B.lastTeam = h.team;
    }
    cheerAt(a.team === userTeam ? 1.2 : 0.5, a.team === userTeam);
  } else a.stunT = 0.55;                                // robo fallido: queda fuera de posición un instante
}
function startBlock(a, kind) {
  if (!a.grounded || a.act || a.stunT > 0 || (a.state !== 'free' && a.state !== 'dribble')) return false;
  const t = (B.holder && B.holder.team !== a.team ? B.holder : null) || (B.shooter && B.shooter.team !== a.team ? B.shooter : null);
  let k = kind || 'two', hand = 'R';
  if (t) {
    const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
    hand = (dx * -Math.cos(a.h) + dz * Math.sin(a.h)) >= 0 ? 'R' : 'L';                       // salta con el brazo del lado del tirador
    if (!kind) {
      const away = (dx * Math.sin(t.h) + dz * Math.cos(t.h)) / d;                              // >0: el tirador me da la espalda (se va de mí)
      const lat = Math.abs(dx * -Math.cos(a.h) + dz * Math.sin(a.h)) / d;
      if (away > 0.25 && d > 0.9 && t.state !== 'dunk') k = 'chase';                           // viene de atrás: tapón de persecución
      else if (lat > 0.55) k = 'one';                                                          // de costado: manotazo con una mano
      else { const r = Math.random(); k = r < 0.5 ? 'two' : r < 0.78 ? 'spike' : 'one'; }
    }
  }
  a.act = 'block'; a.actT = 0.95; a.vy = (k === 'chase' ? 4.9 : 4.7) * (a.jumpM ?? 1); a.grounded = false; a.jumpWind = 0; a.blockKind = k; a.blockHand = hand; a.blkHit = 0; return true;
}

/* ============ Física del jugador (la misma para vos y para los bots) ============ */
/* v65 · cansancio que se NOTA: por debajo del 60 % de energía el jugador va perdiendo velocidad, puntería y precisión de pase de a poco (hasta ~28 % menos de velocidad y ~18 % de tiro).
   Por eso hay que hacer cambios: el que sale descansa en el banco (ver "los suplentes descansan") y vuelve fresco. */
function fatigue(a) { return a.stam >= 0.6 ? 1 : 0.72 + 0.28 * smooth(a.stam / 0.6); }
const tirePen = a => (opts.fatigue ? clamp(1 - a.stam / 0.6, 0, 1) : 0);      // 0 = fresco · 1 = sin energía
function updateAgent(a, dt, I) {
  a.blkHit = Math.max(0, (a.blkHit || 0) - dt); a.sbT = Math.max(0, (a.sbT || 0) - dt); a.moveT = Math.max(0, (a.moveT || 0) - dt);
  a.actT = Math.max(0, a.actT - dt); a.stunT = Math.max(0, a.stunT - dt); a.moveCd -= dt; a.crossT = Math.max(0, a.crossT - dt);
  if (a.act && a.act !== 'block' && a.actT <= 0) a.act = null;
  if (a.state === 'dunk') { updateDunk(a, dt); return; }
  const human = isHum(a) && humanActive(a.hum);
  const f = V3(), wish = V3(I.x, 0, I.z), hasWish = !dead && I.mag > 0.01 && wish.lengthSq() > 0;
  if (hasWish) wish.normalize();
  const holds = B.holder === a;
  if (a.act === 'steal' && !a.stealDone && a.actT < 0.32) resolveSteal(a);
  // dribleo veloz con Ctrl mantenido: cruces automáticos mientras te movés
  a.dribMode = holds && a.state === 'dribble' && I.dribHold && !a.tired && a.stam > 0.05 && Math.hypot(a.vel.x, a.vel.z) > 1.5;
  if (a.dribMode) { a.autoCross -= dt; if (a.autoCross <= 0) { a.autoCross = 0.55; startCrossover(a); } a.stam = Math.max(0, a.stam - 0.03 * dt * prof(a).stamina * (a.drainM ?? 1)); }
  const sprintSp = a.state === 'dribble' ? 6.6 : 7.0;
  let maxSp = I.sprint && !a.tired ? sprintSp : 4.4;
  if (human && !I.sprint && I.sprintAmt > 0 && !a.tired) maxSp = lerp(4.4, sprintSp, I.sprintAmt * 0.8);       // gatillo a medias = trote
  if (a.tired) maxSp = holds ? 3.2 : 3.8;
  maxSp *= a.spdMul * fatigue(a) * (oppTeam(a.team) ? prof(a).spd : 1) * (a.dribMode ? 1.05 : 1) * (holds ? 0.95 + clamp((a.info.speedBall - 60) * 0.0025, -0.05, 0.08) : 1) * (a.stunT > 0 ? 0.4 : 1);
  if (!human) maxSp *= clamp(I.mag, 0.25, 1); else if (I.analog < 1) maxSp *= clamp(I.analog, 0.3, 1);
  if (a.state === 'charge') maxSp = 1.6; if (a.state === 'shoot') maxSp = 0;
  if (a.act === 'steal') maxSp = Math.min(maxSp, 2.4);

  const prev = a.vel.clone();
  if (hasWish && maxSp > 0) {
    _dv.copy(wish).multiplyScalar(maxSp).sub(a.vel);
    const rate = (a.vel.dot(wish) < -0.5 ? 26 : 14) * (a.accMul ?? 1) * (a.grounded ? 1 : 0.12) * (a.dribMode || a.crossT > 0 ? 1.4 : 1) * (a.stunT > 0 ? 0.5 : 1);
    a.vel.add(_dv.setLength(Math.min(_dv.length(), rate * dt)));
  } else if (a.grounded) {
    const sp = a.vel.length(), d = Math.min(sp, (a.state === 'shoot' ? 9 : 17) * dt);
    if (sp > 1e-4) a.vel.multiplyScalar((sp - d) / sp);
  }
  a.acc.lerp(_tv.copy(a.vel).sub(prev).multiplyScalar(1 / dt), 1 - Math.exp(-10 * dt));
  a.pos.addScaledVector(a.vel, dt);
  if (human) { a.pos.x = clamp(a.pos.x, -COURT_X - 1.5, COURT_X + 1.5); a.pos.z = clamp(a.pos.z, -COURT_Z - 0.675, COURT_Z + 0.675); }   // el humano puede pisar afuera (y entonces es 'fuera de límites')
  else { const mx = holds ? 0.7 : 0.35; a.pos.x = clamp(a.pos.x, -COURT_X + mx, COURT_X - mx); a.pos.z = clamp(a.pos.z, -COURT_Z + mx, COURT_Z - mx); }

  // cansancio
  const sp = Math.hypot(a.vel.x, a.vel.z), sm = prof(a).stamina * (a.drainM ?? 1), rm = a.recM ?? 1;   // resistencia: el que tiene más se cansa más lento y recupera más rápido
  if (!dead) {
    if (sp > 5.2 && I.sprint) a.stam -= 0.09 * dt * sm; else if (sp > 2.0) a.stam -= 0.02 * dt * sm; else if (sp < 1) a.stam += 0.04 * dt * rm;
  } else a.stam += 0.10 * dt * rm;
  a.stam = clamp(a.stam, 0, 1);
  if (!opts.fatigue) { a.stam = 1; a.tired = false; }                // cansancio apagado
  if (!a.tired && a.stam < 0.08) { a.tired = true; if (isHum(a) && a.hum.dev !== 'net') say('¡Estás cansado! Frená un momento para recuperar energía.'); }
  else if (a.tired && a.stam > 0.3) a.tired = false;

  let want = null, rate = 0;
  if (a.state === 'charge' || a.state === 'shoot') { want = Math.atan2(-a.pos.x, a.aimHoop.hz - a.pos.z); rate = 16; }
  else if (I.face != null && a.grounded) { want = I.face; rate = 10; }
  else if (sp > 0.6) { want = Math.atan2(a.vel.x, a.vel.z); rate = Math.max(6, 15 - 1.2 * sp); }
  else if (!human && B.holder && B.holder !== a && !dead) { want = Math.atan2(BP.x - a.pos.x, BP.z - a.pos.z); rate = 6; }
  if (a.moveT > 0 && a.moveKind === 'spin' && a.state === 'dribble') a.h = a.spinH0 + 2 * Math.PI * a.side * smooth(1 - a.moveT / a.moveDur);       // spin move: vuelta completa protegiendo la pelota
  else if (want !== null) a.h += clamp(wrap(want - a.h), -rate * dt, rate * dt);

  if (I.jump && !dead && !(human && inbound) && a.grounded && a.jumpWind <= 0 && !a.act && (a.state === 'dribble' || a.state === 'free')) {
    if (a.state === 'dribble' && tryDunk(a, !!I.mod)) return;
    const h = B.holder;
    if (a.state === 'free' && a.def && h && Math.hypot(h.pos.x - a.pos.x, h.pos.z - a.pos.z) < 3.4) startBlock(a); else a.jumpWind = 0.11;
  }
  if (a.jumpWind > 0) { a.jumpWind -= dt; if (a.jumpWind <= 0) { a.vy = 4.2 * (a.jumpM ?? 1); a.grounded = false; } }
  if (a.state === 'charge') {
    if (isHum(a)) a.chargeMul += (chargeTarget(a) - (a.chargeMul || 1)) * Math.min(1, dt * 4);      // sigue a la situación (un defensor que se acerca acelera la barra) pero sin saltos bruscos
    a.charge += a.chargeDir * CHARGE_SPEED * (a.chargeMul || 1) * dt;
    if (a.charge >= 1) { a.charge = 1; a.chargeDir = -1; } if (a.charge <= 0) { a.charge = 0; a.chargeDir = 1; }
    if (a === ctrl) updatePowerUI();
  }
  if (a.state === 'shoot') {
    a.shootT += dt;
    if (!a.launched && a.shootT >= T_LAUNCH) { a.launched = true; if (a.grounded && !a.ftShot) { a.vy = JUMP_SHOT * (a.jumpM ?? 1); a.grounded = false; } }
    if (a.shootT >= T_END) a.state = B.holder === a ? 'dribble' : 'free';
  }
  if (!a.grounded) {
    a.vy -= G9 * dt; a.y += a.vy * dt;
    if (a.y <= 0 && a.vy < 0) { a.landC = Math.max(a.landC, clamp(-a.vy / 6, 0.1, 0.8)); a.y = 0; a.vy = 0; a.grounded = true; if (a.act === 'block') { a.act = null; a.stunT = Math.max(a.stunT, 0.15); } }
  }
  a.landC *= Math.exp(-8 * dt);
}
function separate() {                                  // los jugadores no se atraviesan
  const L = agents.filter(a => a.active && a.state !== 'dunk');
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const p = L[i], q = L[j], dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz), m = p.team === q.team ? 0.55 : 0.62;
    if (d < m && d > 1e-5) {
      if (mode === 'match' && !dead && B.holder && (p === B.holder || q === B.holder)) tryCharge(p === B.holder ? p : q, p === B.holder ? q : p);
      const nx = dx / d, nz = dz / d, push = (m - d) / 2;
      p.pos.x -= nx * push; p.pos.z -= nz * push; q.pos.x += nx * push; q.pos.z += nz * push;
      const vp = p.vel.x * nx + p.vel.z * nz, vq = q.vel.x * nx + q.vel.z * nz;
      if (vp > 0) { p.vel.x -= nx * vp * 0.6; p.vel.z -= nz * vp * 0.6; } if (vq < 0) { q.vel.x -= nx * vq * 0.6; q.vel.z -= nz * vq * 0.6; }
    } else if (d <= 1e-5) { p.pos.x -= 0.05; q.pos.x += 0.05; }
  }
}

/* ---- poses de los mates especiales, bandejas y tapones (v30). Solo usan articulaciones que ya existen (mkJ), así el invitado online las ve igual ---- */
function poseDunkX(a, T) {             // mates especiales
  const D = a.D, df = D.def, tf = Math.max(0, D.t - TW), s0 = D.s0;
  const slam = smooth((tf - s0) / 0.12), ft = clamp((tf - s0 - 0.02) / 0.2, 0, 1), ext = smooth((tf - D.TF * 0.62) / 0.2);
  const set = (s, sh, el, sz) => { T['sh' + s] = sh; T['el' + s] = el; T['sz' + s] = sz; };
  T.wR = T.wL = Math.PI; T.cR = T.cL = 0.25; T.sR = T.sL = 0.25;
  const legsStd = () => { T.thL = lerp(-0.9, -0.2, ext); T.knL = lerp(1.0, 0.3, ext); T.thR = lerp(-0.55, -0.2, ext); T.knR = lerp(0.7, 0.3, ext); };
  if (df.leg) {                         // pelota de una mano a la otra por debajo de la pierna derecha, después mate con la izquierda
    const p = clamp((tf - LEG_P0) / (LEG_P1 - LEG_P0), 0, 1), pre = smooth(tf / LEG_P0), ar = smooth((tf - LEG_P1) / 0.2), reach = df.turn ? 2.9 : -2.75;
    const shB = lerp(-0.8, -0.12, pre), elB = lerp(-1.3, -0.1, pre);
    set('L', lerp(shB, reach, ar) + slam * (df.turn ? -0.9 : 0.6), lerp(elB, -0.1, ar) - 0.4 * slam - 0.3 * ft, lerp(lerp(0.9, 0.25, p), -0.12, ar));
    set('R', lerp(shB, reach, ar * 0.9), lerp(elB, -0.1, ar), lerp(lerp(-0.1, 0.55, p), 0.12, ar));
    const up = smooth((tf - 0.02) / 0.1) * (1 - smooth((tf - LEG_P1 - 0.02) / 0.16));        // pierna derecha levantada mientras pasa la pelota
    T.thR = lerp(lerp(-0.55, -1.8, up), -0.2, ext); T.knR = lerp(lerp(0.7, 1.1, up), 0.3, ext);
    T.thL = lerp(-0.45, -0.2, ext); T.knL = lerp(0.8, 0.3, ext);
    if (df.turn) a.xLean = -0.2 * smooth((tf - LEG_P1) / 0.2);
  } else if (df.wind) {                 // molino: el brazo da una vuelta entera hacia atrás y termina arriba
    const u = smooth((tf - 0.04) / (s0 - 0.10));
    T.shR = lerp(-0.8, 3.53, u) + 0.6 * slam; T.elR = lerp(-1.3, -0.1, smooth(u * 2)) - 0.4 * slam - 0.3 * ft; T.szR = lerp(-0.4, -0.12, u);
    set('L', -0.6, -0.4, 1.0);
    legsStd();
  } else {                              // de espaldas (media vuelta) o 360 (vuelta completa), a dos manos
    const half = df.turn === 1, ar = smooth((tf - (half ? 0.10 : 0.14)) / 0.30), reach = half ? 2.9 : -2.75;
    const sh = lerp(-0.8, reach, ar) + slam * (half ? -0.9 : 0.6), el = lerp(-1.3, -0.1, ar) - 0.4 * slam - 0.3 * ft;
    set('R', sh, el, 0.12); set('L', sh, el, -0.12);
    if (half) a.xLean = -0.2 * smooth((tf - 0.08) / 0.3);            // se arquea hacia el aro con la espalda
    legsStd();
  }
}
function poseLayX(a, T) {              // bandejas especiales
  const D = a.D, ly = D.lay, tf = Math.max(0, D.t - TW), sd = D.sd, ft = clamp((tf - D.rel) / 0.2, 0, 1), ext = smooth((tf - D.TF * 0.65) / 0.2);
  let ar;
  T.wR = Math.PI; T.sR = 0.28; T.sL = 0.2; T.cR = lerp(0.35, 0.15, smooth(tf / 0.3)) + 0.5 * ft;
  T.thR = -1.55; T.knR = 1.6; T.thL = lerp(0.1, -0.1, ext); T.knL = 0.2;
  switch (ly.pose) {
    case 'finger': ar = smooth(tf / 0.34); T.shR = lerp(-0.8, -2.15, ar); T.elR = lerp(-1.3, -0.08, ar); T.szR = -0.05; T.cR = lerp(0.3, 0.95, ft); T.shL = -0.9; T.elL = -1.0; T.szL = 0.5; a.xLean = 0.3 * ar; break;
    case 'scoop': ar = smooth(tf / 0.38); T.shR = lerp(0.45, -2.1, ar); T.elR = lerp(-0.25, -0.1, ar); T.szR = -0.1; T.shL = -0.4; T.elL = -0.8; T.szL = 0.9; a.xLean = 0.3; a.yTw = sd * 0.35 * ar; T.thR = -1.3; T.knR = 1.3; break;
    case 'rev': ar = smooth(tf / 0.42); T.shR = lerp(-0.8, -2.55, ar); T.elR = lerp(-1.3, -0.1, ar) - 0.3 * ft; T.szR = lerp(-0.1, 0.3, ar); T.shL = -1.0; T.elL = -1.2; T.szL = 0.4; a.yTw = -sd * 0.75 * smooth(tf / 0.3); break;
    case 'euro': ar = smooth((tf - 0.2) / 0.28); T.shR = lerp(-0.8, -2.7, ar); T.elR = lerp(-1.3, -0.1, ar) - 0.3 * ft; T.szR = 0; T.shL = -1.2; T.elL = -1.3; T.szL = 0.3; a.zLean = sd * 0.32 * Math.cos(Math.PI * smooth(tf / 0.32)); break;
    default: ar = smooth(tf / 0.22); T.shR = lerp(-0.9, -2.45, ar); T.elR = lerp(-1.5, -0.5, ar) - 0.5 * ft; T.szR = 0; T.shL = -1.1; T.elL = -1.0; T.szL = 0.5; T.thR = -1.0; T.knR = 1.2; T.thL = -0.2; T.knL = 0.3; a.xLean = -0.12;     // floater
  }
}
function poseFlashPass(a, T, ps) {     // pases con lujo: devuelve cuánto se agacha de más
  const w = PASS_STYLES[ps].wind / PASS_DUR, p = clamp(1 - a.actT / PASS_DUR, 0, 1), pw = smooth(p / w), u = smooth((p - w) / 0.22), sd = a.passSd || 1;
  const L3 = (a0, a1, a2) => lerp(lerp(a0, a1, pw), a2, u);        // armar el movimiento (a0 → a1) y después soltar (→ a2)
  T.wL = T.wR = Math.PI; T.cL = T.cR = 0.25; T.sL = T.sR = 0.3;
  let crh = 0;
  if (ps === 'behind') {               // por la espalda: el brazo se va para atrás y sale disparado
    T.shR = L3(-0.7, 0.9, -1.5); T.elR = L3(-1.0, -0.7, -0.12); T.szR = L3(-0.2, -0.7, -0.3);
    T.shL = -0.6; T.elL = -1.2; T.szL = 0.5; a.yTw = L3(0, 0.55, -0.3);
  } else if (ps === 'nolook') {        // sin mirar: la cabeza mira para otro lado y la mano empuja la pelota
    T.shR = L3(-0.6, -0.9, -1.5); T.elR = L3(-1.4, -1.3, -0.1); T.szR = L3(-0.2, -0.3, -0.5);
    T.shL = -0.7; T.elL = -1.1; T.szL = 0.5; a.yTw = sd * L3(0, 0.3, 0.35); a.hOver = sd * 1.25;
  } else if (ps === 'wrap') {          // envolviendo: se gira el torso y el brazo da la vuelta por afuera
    T.shR = L3(-0.6, -1.0, -1.4); T.elR = L3(-1.2, -1.0, -0.2); T.szR = L3(-0.2, 0.6, -0.9);
    T.shL = L3(-0.6, -0.9, -0.7); T.elL = -1.0; T.szL = L3(0.2, -0.3, 0.5); a.yTw = L3(0, -0.8, 0.5);
  } else if (ps === 'flip') {          // por arriba de la cabeza, con las dos manos
    T.shR = T.shL = L3(-1.0, -2.9, -1.6); T.elR = T.elL = L3(-1.4, -0.6, -0.1); T.szR = 0.15; T.szL = -0.15; a.xLean = L3(0, -0.15, 0.25);
  } else {                             // de pique, con una mano y el cuerpo agachado
    T.shR = L3(-0.45, -0.15, -0.95); T.elR = L3(-0.9, -0.8, -0.2); T.szR = L3(-0.2, -0.3, -0.35);
    T.shL = -0.5; T.elL = -1.0; T.szL = 0.5; a.xLean = L3(0, 0.25, 0.35); crh = 0.12 + 0.12 * pw;
  }
  return crh;
}
function blockPose(a, T) {             // tapones: a dos manos, a una mano, de persecución (desde atrás) y manotazo hacia abajo (spike)
  const k = a.act === 'block' ? (a.blockKind || 'two') : 'two', hv = a.blkHit > 0 ? smooth(1 - a.blkHit / 0.45) : 0;
  const m = a.blockHand === 'L' ? 'L' : 'R', o = m === 'L' ? 'R' : 'L', out = m === 'L' ? 1 : -1;
  const set = (s, sh, el, sz) => { T['sh' + s] = sh; T['el' + s] = el; T['sz' + s] = sz; };
  T.wL = T.wR = Math.PI; T.cL = T.cR = 0.15; T.sL = T.sR = 0.35;
  if (k === 'two') { const sh = lerp(-2.85, -1.9, hv); set('L', sh, -0.05, 0.14); set('R', sh, -0.05, -0.14); }
  else if (k === 'one') { set(m, lerp(-2.7, -1.7, hv), -0.05, out * 0.5); set(o, -1.0, -0.7, -out * 0.9); a.zLean = out * 0.25; }
  else if (k === 'chase') { set(m, lerp(-2.3, -1.5, hv), -0.05, out * 0.25); set(o, 0.5, -0.3, -out * 0.5); a.xLean = 0.4; }
  else { const p = clamp(1 - a.actT / 0.95, 0, 1), sh = p < 0.45 ? lerp(-2.4, -3.0, smooth(p / 0.45)) : lerp(-3.0, -1.9, smooth((p - 0.45) / 0.15)); set(m, sh, -0.05, out * 0.2); set(o, -1.4, -0.6, -out * 0.7); a.xLean = 0.15; }
}

/* ============ Animación procedural ============ */
function pose(a, dt) {
  const R = a.R, J = a.J;
  a.xLean = 0; a.zLean = 0; a.yTw = 0; a.hOver = null;
  const sp = Math.hypot(a.vel.x, a.vel.z), run = clamp(sp / 7, 0, 1), mv = clamp(sp / 1.2, 0, 1);
  if (a.grounded) a.phase += dt * Math.PI * 2 * (0.8 + 0.17 * sp) * mv;
  const s = Math.sin(a.phase), c = Math.cos(a.phase);
  let strideK = 1;
  if (a.def && sp > 0.3) { const fw = Math.abs(a.vel.x * Math.sin(a.h) + a.vel.z * Math.cos(a.h)) / sp; strideK = 0.55 + 0.45 * fw; }   // desplazamiento lateral: pasos más cortos
  const A = (0.12 + 0.45 * run) * mv * strideK, Aa = (0.15 + 0.5 * run) * mv;
  const T = {};
  let cr = lerp(0.22, 0.08, run) * (1 - mv * 0.4);
  const air = !a.grounded && a.state !== 'shoot' && a.state !== 'dunk';
  const st = a.state;

  T.thL = -s * A; T.thR = s * A;
  T.knL = 0.08 + mv * (0.15 + 0.9 * run) * Math.max(0, c);
  T.knR = 0.08 + mv * (0.15 + 0.9 * run) * Math.max(0, -c);
  T.shL = s * Aa; T.shR = -s * Aa;
  T.elL = T.elR = -0.4 - 0.7 * run;
  T.szL = 0.12; T.szR = -0.12;
  T.wL = T.wR = 0; T.cL = T.cR = 0.3; T.sL = T.sR = 0.06;

  if (a.def && st === 'free' && !a.act && sp < 5.5) {   // postura defensiva: manos afuera, rodillas flexionadas
    T.shL = T.shR = -1.1; T.elL = T.elR = -0.5; T.szL = 0.9; T.szR = -0.9; T.wL = T.wR = Math.PI; T.cL = T.cR = 0.2; T.sL = T.sR = 0.3;
    cr = 0.28 + 0.06 * Math.sin(gameTime * 7 + a.phase);
  }
  if (st === 'dribble') {              // mano abierta empujando la pelota real (derecha o izquierda según el cruce)
    const t = clamp((BP.y - 0.7) / 0.4, 0, 1), sh = -0.45 - 0.2 * t, el = -0.1 - 1.1 * t, hard = a.dribMode ? 1 : 0;
    const sv = a.moveT > 0 && a.moveT > a.moveDur * 0.5 && (a.moveKind === 'legs' || a.moveKind === 'behind') ? -a.side : a.side;      // en la primera mitad del cruce la mano sigue del lado viejo
    if (sv > 0) { T.shR = sh; T.elR = el; T.szR = -0.18; T.wR = Math.PI; T.cR = 0.35; T.sR = 0.25; T.shL = -0.35 + s * Aa * 0.3; T.elL = -1.0; T.szL = 0.2; }
    else { T.shL = sh; T.elL = el; T.szL = 0.18; T.wL = Math.PI; T.cL = 0.35; T.sL = 0.25; T.shR = -0.35 - s * Aa * 0.3; T.elR = -1.0; T.szR = -0.2; }
    cr += 0.1 * hard + (a.crossT > 0 ? 0.12 : 0);
    if (a.moveT > 0) {                                                // posturas de los dribleos con lujo
      const mp = Math.sin(Math.PI * smooth(1 - a.moveT / a.moveDur));
      if (a.moveKind === 'legs') { cr += 0.22 * mp; a.xLean += 0.15 * mp; }
      else if (a.moveKind === 'behind') { cr += 0.12 * mp; a.yTw += 0.35 * mp * a.side; }
      else if (a.moveKind === 'stepback') { cr += 0.18 * mp; a.xLean -= 0.3 * mp; }
      else if (a.moveKind === 'spin') { cr += 0.15 * mp; a.xLean += 0.1 * mp; }
    }
    if (B.holder === a && !a.act) {                                   // IK: hombro y codo apuntan a la pelota real (así nunca se ve "despegada")
      const right = sv > 0, S = right ? R.shR : R.shL;
      _ik.copy(BP); R.torso.worldToLocal(_ik);                        // pelota en el espacio del torso (incluye inclinación y giro)
      const ez = _ik.z - S.position.z, ey = _ik.y - S.position.y, L1 = 0.30, L2 = 0.455;
      const d = clamp(Math.hypot(ez, ey), 0.2, L1 + L2 - 0.01);
      const cd = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
      const th1 = clamp(Math.atan2(ez, -ey) - Math.acos(cd), -0.35, 1.7);          // brazo hacia adelante (codo atrás solo un poco)
      const vz = ez - L1 * Math.sin(th1), vy = ey + L1 * Math.cos(th1);
      const bend = clamp(Math.atan2(vz, -vy) - th1, 0, 2.5);
      if (right) { T.shR = -th1; T.elR = -bend; } else { T.shL = -th1; T.elL = -bend; }
    }
  }
  if (st === 'charge' || st === 'shoot') {
    const u = st === 'charge' ? 0 : smooth((a.shootT - T_LAUNCH) / (T_REL - T_LAUNCH));
    const ft = st === 'shoot' ? clamp((a.shootT - T_REL) / 0.25, 0, 1) : 0;
    T.shR = lerp(-0.95, -2.85, u); T.elR = lerp(-1.7, -0.05, u) - 0.5 * ft; T.szR = lerp(0.3, 0, u);
    T.shL = lerp(-0.95, -1.5, Math.min(u * 1.6, 1)); T.elL = lerp(-1.6, -1.1, u); T.szL = lerp(-0.3, 0.25, smooth((u - 0.5) / 0.5));
    T.wR = T.wL = Math.PI; T.cR = 0.4 - 0.25 * u + 0.7 * ft; T.cL = 0.4; T.sR = T.sL = 0.25;   // dedos abiertos sobre la pelota y chasquido de muñeca
    T.thL = T.thR = 0; T.knL = T.knR = 0.05;
    if (st === 'charge') cr = 0.3 + 0.2 * a.charge;
    else if (a.shootT < T_LAUNCH) cr = lerp(0.3, 0.75, smooth(a.shootT / T_LAUNCH));
    else cr = lerp(0.75, 0, smooth((a.shootT - T_LAUNCH) / 0.1));
    if (!a.grounded && a.shootT > 0.25) { T.thL = T.thR = -0.12; T.knL = T.knR = 0.3; }
  }
  if (st === 'dunk' && a.D.def) {      // mates especiales (v30)
    cr = a.D.t < TW ? lerp(0.2, 0.75, smooth(a.D.t / TW)) : 0; poseDunkX(a, T);
  } else if (st === 'dunk' && a.D.lay && a.D.lay.pose !== 'std') {      // bandejas especiales (v30)
    cr = a.D.t < TW ? lerp(0.2, 0.75, smooth(a.D.t / TW)) : 0; poseLayX(a, T);
  } else if (st === 'dunk') {          // mates (2 variantes) y bandeja
    const D = a.D, tf = Math.max(0, D.t - TW), L = D.mode === 'layup', ar = smooth(tf / (L ? 0.30 : 0.36));
    const slam = L ? 0 : smooth((tf - 0.40) / 0.12), ft = clamp((tf - D.rel) / 0.2, 0, 1), ext = smooth((tf - D.TF * 0.65) / 0.2);
    T.shR = lerp(-0.8, -2.75, ar) + 0.6 * slam; T.elR = lerp(-1.3, -0.1, ar) - 0.4 * slam - 0.3 * ft;
    T.szR = D.mode === 'dunk2' ? 0.15 : 0;
    if (D.mode === 'dunk2') { T.shL = T.shR; T.elL = T.elR; T.szL = -0.15; T.wL = Math.PI; }
    else if (L) { T.shL = -1.3; T.elL = -1.4; T.szL = 0.3; }
    else { T.shL = -0.6; T.elL = -0.4; T.szL = 1.0; }                // mate a una mano: brazo libre abierto para el equilibrio
    T.wR = Math.PI; T.cR = lerp(0.35, 0.15, ar) + 0.5 * ft; T.sR = 0.28; T.sL = 0.2;
    if (D.t < TW) cr = lerp(0.2, 0.75, smooth(D.t / TW));
    else {
      cr = 0;
      if (L) { T.thR = -1.55; T.knR = 1.6; T.thL = lerp(0.1, -0.1, ext); T.knL = 0.2; }         // rodilla derecha arriba, pierna izquierda extendida
      else { T.thL = lerp(-0.9, -0.2, ext); T.knL = lerp(1.0, 0.3, ext); T.thR = lerp(-0.55, -0.2, ext); T.knR = lerp(0.7, 0.3, ext); }
    }
  }
  if (a.act === 'pass') {              // pase de pecho: los dos brazos salen disparados hacia adelante (o un pase con lujo)
    if (a.passStyle) cr += poseFlashPass(a, T, a.passStyle);
    else {
      const u = smooth(1 - a.actT / 0.32);
      T.shL = T.shR = lerp(-0.9, -1.5, u); T.elL = T.elR = lerp(-1.8, -0.12, u); T.szL = 0.12; T.szR = -0.12; T.wL = T.wR = Math.PI; T.cL = T.cR = 0.25; T.sL = T.sR = 0.3;
    }
  }
  if (a.act === 'steal') {             // manotazo para robar
    const u = Math.sin(clamp(1 - a.actT / 0.5, 0, 1) * Math.PI);
    T.shR = lerp(-1.0, -1.6, u); T.elR = lerp(-0.8, -0.1, u); T.szR = -0.3; T.shL = -0.9; T.elL = -0.9; T.szL = 0.7; T.wR = T.wL = Math.PI;
    cr = 0.32; T.cR = T.cL = 0.15; T.sR = T.sL = 0.3;
  }
  if (a.act === 'foul') {              // manotazo que termina en contacto y gesto de freno
    const u = smooth(1 - a.actT / 0.72);
    T.shR = lerp(-1.1, -1.75, u); T.elR = lerp(-0.7, -0.15, u); T.shL = -1.25; T.elL = -0.35;
    T.szR = -0.35; T.szL = 0.35; cr = 0.42; T.cR = T.cL = 0.18;
  }
  if (air) {
    cr = 0; T.thL = T.thR = -0.4; T.knL = T.knR = 0.8;
    T.shL = T.shR = -0.5; T.szL = 0.8; T.szR = -0.8; T.elL = T.elR = -0.5; T.cL = T.cR = 0.2; T.sL = T.sR = 0.3;
    if (a.act === 'block' || a.def) blockPose(a, T);   // tapón: brazos bien arriba (4 variantes)
    else if (B.holder == null && B.bp.y > 2.0) { T.shL = T.shR = -2.6; T.elL = T.elR = -0.1; T.szL = 0.2; T.szR = -0.2; T.wL = T.wR = Math.PI; }   // rebote: manos arriba
  }
  if (a.stunT > 0.05 && !a.act) {      // desequilibrado (cruce, robo fallido)
    cr = Math.max(cr, 0.55); T.shL = -0.4 + Math.sin(gameTime * 18) * 0.4; T.shR = -0.4 - Math.sin(gameTime * 18) * 0.4; T.szL = 0.7; T.szR = -0.7;
  }
  if (a.jumpWind > 0) cr = 0.7;
  cr += a.landC;

  const k0 = cr * 0.95;                // agacharse = muslos adelante y rodillas al doble de ángulo
  T.thL -= k0; T.thR -= k0; T.knL += 2 * k0; T.knR += 2 * k0;
  const fwdV = V3(Math.sin(a.h), 0, Math.cos(a.h)), rgtV = V3(-Math.cos(a.h), 0, Math.sin(a.h));
  T.tx = 0.1 + run * 0.22 + cr * 0.35 + clamp(a.acc.dot(fwdV) * 0.012, -0.15, 0.25) - (st === 'dunk' && a.D.t > TW ? 0.2 : 0) + (a.act === 'steal' ? 0.25 : 0) + a.xLean;
  T.tz = clamp(a.acc.dot(rgtV) * 0.012, -0.2, 0.2) + c * 0.04 * run * mv + a.zLean;   // los hombros compensan la inclinación de la cadera
  T.ty = s * 0.20 * run + a.yTw; T.py = -s * 0.06 * run;                       // hombros y pelvis giran en sentidos opuestos (como al correr de verdad)
  T.pz = -c * 0.04 * run * mv;                                         // la cadera del lado de la pierna que avanza baja un poco
  T.gr = a.grounded ? 1 : 0;                                           // en el aire no se fuerza el contacto de los pies con el piso
  T.hx = -T.tx * 0.8 - (st === 'shoot' || st === 'charge' ? 0.25 : 0);
  {                                                                    // la cabeza mira al aro si tiene la pelota y a la pelota si no
    const tgt = B.holder === a ? attackHoop(a.team) : null, lx = tgt ? 0 : BP.x, lz = tgt ? tgt.hz : BP.z;
    const want = wrap(Math.atan2(lx - a.pos.x, lz - a.pos.z) - a.h);
    T.hyaw = a.hOver != null ? a.hOver : clamp(want, -1.0, 1.0) * 0.7;
  }
  T.hy = 0.06 + 0.94 * Math.cos(k0) - 0.025 * Math.abs(s) * mv;

  const k = 1 - Math.exp(-(st === 'shoot' || st === 'charge' || st === 'dunk' ? 45 : a.act ? 40 : 20) * dt);
  for (const key in T) J[key] += (T[key] - J[key]) * k;
  applyPose(R, J);
  R.root.position.set(a.pos.x, a.y, a.pos.z); R.root.rotation.y = a.h;
  R.root.updateMatrixWorld(true);
}

/* ============ Física de la pelota ============ */
const _a = V3(), _c = V3(), _t = V3(), _r = V3(), _q = new THREE.Quaternion(), _p = V3();
function accel(v, w, out) {            // gravedad + arrastre cuadrático + Magnus (backspin)
  out.set(0, -G9, 0).addScaledVector(v, -KD * v.length());
  out.x += CM * (w.y * v.z - w.z * v.y); out.y += CM * (w.z * v.x - w.x * v.z); out.z += CM * (w.x * v.y - w.y * v.x);
}
const _n = V3();
function contact(n0, e, mu) {          // impulso normal con restitución + fricción de Coulomb que genera spin
  const n = _n.copy(n0);               // copia: algunos llamadores pasan _t, que se usa más abajo como auxiliar
  const vn = BV.dot(n); if (vn >= 0) return;
  const jn = -(1 + (-vn < 0.5 ? 0 : e)) * vn;
  _r.copy(n).multiplyScalar(-BR);
  _c.crossVectors(BW, _r).add(BV);
  _t.copy(_c).addScaledVector(n, -_c.dot(n));
  const tl = _t.length();
  BV.addScaledVector(n, jn);
  if (tl > 1e-5) {
    _t.multiplyScalar(-Math.min(mu * jn, tl / 2.5) / tl);       // esfera hueca: I = 2/3 m r²
    BV.add(_t); BW.add(_c.crossVectors(_r, _t).multiplyScalar(1.5 / (BR * BR)));
  }
}
function stepBall(h) {
  const prevY = BP.y;
  accel(BV, BW, _a); BV.addScaledVector(_a, h); BP.addScaledVector(BV, h);
  const wl = BW.length();
  if (wl > 1e-4) { _q.setFromAxisAngle(_t.copy(BW).multiplyScalar(1 / wl), wl * h); ball.quaternion.premultiply(_q); }
  if (BP.y < BR) {
    BP.y = BR; contact(UP, 0.84, 0.55);
    if (outsideLines(BP.x, BP.z, 0.03)) ballOut = true;           // picó afuera de las líneas
    if (B.mode === 'shot' && B.passT > 0.1) B.mode = 'loose';      // tiro que cae sin tocar el aro (aire)
    if (B.mode === 'pass') { if (B.bn > 0) B.bn--; else B.mode = 'loose'; }      // pase malo: bota y queda suelta (el pase de pique rebota una vez a propósito)
    if (Math.abs(BV.y) < 0.3) {
      const sp = Math.hypot(BV.x, BV.z), d = Math.min(sp, 0.4 * h);
      if (sp > 1e-4) { BV.x *= (sp - d) / sp; BV.z *= (sp - d) / sp; } BW.multiplyScalar(1 - 0.4 * h);
    }
  }
  if (B.mode === 'shot') {                                         // tapones: un defensor con los brazos arriba desvía el tiro
    for (const d of agents) {
      if (!d.active || d.team === (B.shooter?.team ?? -1) || d.act !== 'block') continue;     // solo tapa el que salta con los brazos arriba
      const kk = d.blockKind, ex = kk === 'chase' || kk === 'spike', lat = kk === 'one' || ex ? (d.blockHand === 'L' ? -0.3 : 0.3) : 0, top = d.y + (ex ? 2.62 : 2.5) * d.scale, rad = 0.4;
      _c.set(d.pos.x + Math.sin(d.h) * 0.15 - Math.cos(d.h) * lat, clamp(BP.y, d.y + 0.5, top), d.pos.z + Math.cos(d.h) * 0.15 + Math.sin(d.h) * lat); _t.copy(BP).sub(_c);
      const dd = _t.length(), m = BR + rad;
      if (dd < m && dd > 1e-6) {
        _t.multiplyScalar(1 / dd); BP.copy(_c).addScaledVector(_t, m); contact(_t, 0.5, 0.4);
        BV.y = Math.min(BV.y, 1.5); BV.addScaledVector(_t, 3);
        bx(d, 'blk'); B.mode = 'loose'; B.lastTeam = d.team; B.lastTouch = d; d.blkHit = 0.45; say(`¡TAPÓN de ${d.info.name.split(' ').slice(-1)[0]}!`); cheerAt(d.team === userTeam ? 2.2 : 0.8, d.team === userTeam);
        hoops.forEach(hh => hh.done = hh.done && false);
        break;
      }
    }
  }
  for (const H of hoops) {
    const n = _p.set(0, 0, -H.s), dn = (BP.z - H.front) * -H.s;
    if (dn < BR && dn > -0.15 && Math.abs(BP.x) < 0.95 && BP.y > 2.85 && BP.y < 4.02) { BP.z = H.front - H.s * BR; contact(n, 0.62, 0.45); if (B.mode === 'shot') { B.mode = 'loose'; Crowd.rim(); } }
    const dx = BP.x, dz = BP.z - H.hz, rad = Math.hypot(dx, dz);
    if (rad > 1e-6 && rad < 0.7 && Math.abs(BP.y - RIM_Y) < 0.3) {
      _c.set(dx * RIM_C / rad, RIM_Y, H.hz + dz * RIM_C / rad);
      _t.copy(BP).sub(_c); const d = _t.length(), m = BR + RIM_TUBE;
      if (d < m && d > 1e-6) { _t.multiplyScalar(1 / d); BP.copy(_c).addScaledVector(_t, m); contact(_t, 0.6, 0.35); if (B.mode === 'shot') { B.mode = 'loose'; Crowd.rim(); } }
    }
    if (!H.done && prevY > RIM_Y && BP.y <= RIM_Y && rad < RIM_IN - 0.005 && (B.mode === 'shot' || B.mode === 'loose' || mode === 'training')) scoreFor(H, B.shotThree ? 3 : 2);
    if (rad < 0.25 && BP.y < RIM_Y + 0.02 && BP.y > RIM_Y - 0.45) BV.multiplyScalar(1 - 6 * h);
  }
}

function solveShot(p0, target, dir, dist, thOver, spin = 18) {   // resuelve la velocidad inicial simulando la misma física
  const hd = target.y - p0.y;
  let th = thOver || (dist < 3.2 ? 1.15 : dist < 6.5 ? 0.95 : 0.85);
  while (dist * Math.tan(th) - hd <= 0.05) th += 0.05;
  let sp = Math.sqrt(G9 * dist * dist / (2 * Math.cos(th) ** 2 * (dist * Math.tan(th) - hd)));
  const w = dir.clone().cross(UP).multiplyScalar(spin), p = V3(), v = V3(), a = V3();
  for (let it = 0; it < 5; it++) {
    p.copy(p0); v.set(dir.x * Math.cos(th) * sp, Math.sin(th) * sp, dir.z * Math.cos(th) * sp);
    let hit = dist;
    for (let g = 0; g < 600; g++) {
      accel(v, w, a); v.addScaledVector(a, 0.005); p.addScaledVector(v, 0.005);
      if (v.y < 0 && p.y <= target.y) { hit = Math.max(Math.hypot(p.x - p0.x, p.z - p0.z), 0.05); break; }
    }
    sp *= Math.sqrt(dist / hit);
  }
  return V3(dir.x * Math.cos(th) * sp, Math.sin(th) * sp, dir.z * Math.cos(th) * sp);
}
function launchFromHolder(a, H, dist, three = false) {  // la pelota deja la mano: pasa a "tiro en el aire"
  B.shotThree = three; B.holder = null; B.mode = 'shot'; B.shooter = a; B.shotHoop = H; B.shotDist = dist; B.shotId++; B.passT = 0; B.noPick = { a, t: 0.5 };
  B.lastTeam = a.team; B.lastTouch = a; B.possTeam = a.team;
  if (a.ftShot) bx(a, 'fta'); else if (a.state !== 'dunk') { bx(a, 'fga'); if (three) bx(a, 'tpa'); B.reboundOf = a; }      // bandejas y mates ya se contaron al empezar (startDunk)
}
function releaseBall(a) {
  a.released = true; hoops.forEach(h => h.done = false); if (a === ctrl) attempt();
  const H = a.aimHoop, target = V3(0, RIM_Y, H.hz), dir = V3(target.x - BP.x, 0, target.z - BP.z);
  const dist = dir.length(); dir.normalize();
  const v = solveShot(BP, target, dir, dist);
  const three0 = Math.hypot(a.pos.x, H.hz - a.pos.z) > 7.24 || Math.abs(a.pos.x) >= 6.7, rs = releaseSkill(a.info, three0, dist);   // el rating de la zona agranda o achica la ventana del tiro perfecto
  const ch = a.charge, q = Math.abs(ch - PERFECT), perfect = q <= (a.ftShot ? 0.035 : rs.window);
  if (!perfect) v.multiplyScalar(1 + (ch - PERFECT) * 0.28);
  const human = isHum(a), cst = human && !a.ftShot ? contestOf(a) * (a.tired ? 1.3 : 1) : 0;   // al humano lo marcan de verdad; el bot ya lo tiene en su probabilidad
  v.applyAxisAngle(UP, gauss() * (perfect ? 0.0012 : 0.004 + q * 0.1) * (a.ftShot ? 1 : rs.noise) + gauss() * dist * 0.0002 * (a.ftShot ? 1 : rs.noise) + gauss() * cst * 0.012);
  if (cst > 0) v.multiplyScalar(1 + gauss() * cst * 0.03);
  if (a.ftShot) v.applyAxisAngle(UP, gauss() * (0.9 - clamp((a.info.ft ?? 70) / 100, 0, 0.9)) * 0.006);   // en los libres el rating de tiro libre pesa un poco
  BV.copy(v); BW.copy(dir.cross(UP).multiplyScalar(18));
  launchFromHolder(a, H, dist, Math.hypot(a.pos.x, H.hz - a.pos.z) > 7.24 || Math.abs(a.pos.x) >= 6.7);      // triple: con los pies detrás del arco o en la esquina
  if (!a.ftShot) rollShootingFoul(a, 'jump', B.shotThree, H);
  if (human) say(perfect ? '¡Liberación perfecta!' : ch < PERFECT ? 'Soltaste temprano: tiro corto.' : 'Soltaste tarde: tiro largo.');
}
function releaseLayup(a) {             // bandeja: arco alto y casi siempre buena (si no te marcan). Según el tipo: normal, a tablero, giro sobre el aro o floater
  const D = a.D, c = V3(0, RIM_Y, D.H.hz), dir = V3(c.x - BP.x, 0, c.z - BP.z), dist = Math.max(dir.length(), 0.3);
  dir.normalize();
  const phys = D.lay ? D.lay.phys : 'norm', p0 = [BP.x, BP.y, BP.z];
  let v = null, w = null;
  if (phys === 'bank') {                                                      // pega en el vidrio y cae al aro (se busca con el mismo simulador de la pelota)
    const s = solveBank(p0, D.H, { spin: 7 });
    if (s) { v = V3(s.v[0], s.v[1], s.v[2]); w = V3(s.w[0], s.w[1], s.w[2]); }
  } else if (phys === 'roll') {                                               // da vueltas sobre el aro: si la bandeja es buena, se va para adentro; si no, para afuera
    const s = solveRoll(p0, D.H, !D.miss);
    if (s) { v = V3(s.v[0], s.v[1], s.v[2]); w = V3(s.w[0], s.w[1], s.w[2]); D.rolled = true; }
  }
  if (v && !D.rolled && D.miss) { v.applyAxisAngle(UP, gauss() * 0.07); v.multiplyScalar(1 + (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.07)); }
  if (!v) {
    v = solveShot(BP, c, dir, dist, phys === 'float' ? 1.5 : 1.25, 10);      // se resuelve con el mismo efecto (10) con el que sale la pelota
    v.applyAxisAngle(UP, gauss() * 0.01).multiplyScalar(1 + gauss() * 0.012);
    if (D.miss) { v.applyAxisAngle(UP, gauss() * 0.07); v.multiplyScalar(1 + (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.07)); }
    w = dir.clone().cross(UP).multiplyScalar(10);
  }
  D.rolled = false;
  BV.copy(v); BW.copy(w); D.rd = true;
  launchFromHolder(a, D.H, dist);
  rollShootingFoul(a, 'layup', false, D.H);
}

const _hl = V3(), _he = V3(), _lp1 = V3(), _lp2 = V3();
function holdBall(a, dt) {             // la pelota se apoya en la palma de la mano (cinemática)
  const right = a.state === 'dunk' && a.D.hand ? a.D.hand === 'R' : (a.side > 0 || a.state !== 'dribble');
  const hand = right ? a.R.hR : a.R.hL, el = right ? a.R.elR : a.R.elL;
  _hl.setFromMatrixPosition(hand.matrixWorld); _he.setFromMatrixPosition(el.matrixWorld);
  _hl.addScaledVector(_he.sub(_hl).normalize(), -0.175);
  if (dt) BP.lerp(_hl, 1 - Math.exp(-30 * dt)); else BP.copy(_hl);
  BV.set(0, 0, 0); BW.set(0, 0, 0);
}
function legPassBall(a, dt, tf) {      // mate por debajo de la pierna: la pelota viaja de una mano a la otra pasando por debajo del muslo
  const D = a.D;
  if (tf < LEG_P0) { D.hand = 'R'; holdBall(a, dt); return; }
  if (tf >= LEG_P1) { D.hand = 'L'; holdBall(a, dt); return; }
  const k = smooth((tf - LEG_P0) / (LEG_P1 - LEG_P0));
  D.hand = 'R'; holdBall(a); _lp1.copy(BP);
  D.hand = 'L'; holdBall(a); _lp2.copy(BP);
  BP.lerpVectors(_lp1, _lp2, k); BP.y -= 0.16 * Math.sin(Math.PI * k);
  D.hand = k < 0.5 ? 'R' : 'L';
}
function dunkBall(a, dt) {
  const D = a.D, tf = D.t - TW;
  if (D.rd) return;
  if (D.mode === 'layup') { holdBall(a, dt); if (tf >= D.rel) releaseLayup(a); return; }
  const s0 = D.s0, df = D.def;
  if (tf < s0) { if (df && df.leg) legPassBall(a, dt, tf); else { D.hand = df ? df.fin : 'R'; holdBall(a, dt); } return; }
  if (!D.cap) { D.cap = true; D.p0.copy(BP); }
  const k = smooth((tf - s0) / 0.12), kx = smooth((tf - s0) / 0.06);   // la pelota baja por el centro del aro
  BP.set(lerp(D.p0.x, 0, kx), lerp(D.p0.y, 2.78, k), lerp(D.p0.z, D.H.hz, kx));
  if (!D.scored && BP.y <= RIM_Y) { D.scored = true; B.shotDist = 1; B.shotThree = false; scoreFor(D.H, 2); say(df ? `¡MATE ${df.label.toUpperCase()}!` : '¡MATE!'); }
  if (tf >= s0 + 0.12) { D.rd = true; BV.set(0, -5, 0); BW.set(0, 0, 0); launchFromHolder(a, D.H, 1); }
}
function dribbleControl(a) {
  // La pelota rebota a una distancia que el brazo SIEMPRE alcanza: crece un poco con la velocidad pero con tope.
  // (Antes se sumaba vel*0.16 al objetivo: a 6.6 m/s la pelota quedaba a ~1.5 m del cuerpo, fuera del alcance de la mano.)
  const sc = a.scale, fx = Math.sin(a.h), fz = Math.cos(a.h), rx = -Math.cos(a.h), rz = Math.sin(a.h);
  const sp = Math.hypot(a.vel.x, a.vel.z), hard = a.dribMode, lat = (0.24 + 0.04 * Math.min(1, sp / 6)) * a.side;
  const fwd = Math.min(0.34 + 0.05 * sp + (hard ? 0.03 : 0), 0.62);
  let fw2 = fwd, lt2 = lat;
  if (a.moveT > 0 && (a.moveKind === 'legs' || a.moveKind === 'behind')) {      // la pelota cruza de una mano a la otra: por entre las piernas o por detrás de la espalda
    const p = smooth(1 - a.moveT / a.moveDur), sd = 0.24 + 0.04 * Math.min(1, sp / 6), mid = Math.sin(Math.PI * p);
    lt2 = lerp(-a.side, a.side, p) * sd;                                         // del lado viejo al nuevo
    fw2 = fwd + (a.moveKind === 'legs' ? (0.10 - fwd) * mid : (-0.28 - fwd) * mid);
  }
  const tx = a.pos.x + fx * fw2 * sc + rx * lt2 * sc, tz = a.pos.z + fz * fw2 * sc + rz * lt2 * sc;
  const g = a.crossT > 0 ? 22 : 18; let ex = (tx - BP.x) * g, ez = (tz - BP.z) * g; const el = Math.hypot(ex, ez);
  if (el > 9) { ex *= 9 / el; ez *= 9 / el; }                          // la corrección hacia la mano tiene tope (si no, la pelota sale disparada)
  BV.x = a.vel.x + ex; BV.z = a.vel.z + ez;
  if (BP.y > 1.08 && BV.y > -0.5) BV.y = hard ? -4.4 : -3.3;
  else if (BP.y < 0.3 && Math.abs(BV.y) < 0.8) BV.y = hard ? 5.6 : 4.6;
}
function giveBall(a, how) {            // alguien agarra la pelota
  const was = B.mode;
  if (how === 'rebound' && B.reboundOf) bx(a, 'reb'); B.reboundOf = null;
  B.holder = a; B.mode = 'held'; B.lastTeam = a.team; B.lastTouch = a; B.passer = null; B.target = null; B.shooter = null;
  a.state = 'dribble'; a.charge = 0; a.released = false; a.launched = false; a.act = null; a.passQ = null; a.ai.holdT = 0; a.ai.plan = 'drive'; a.ai.think = 0.15; a.ai.inb = false;
  BV.set(a.vel.x, Math.min(BV.y * 0.3, 0), a.vel.z); if (a === ctrl) updatePowerUI();       // al agarrarla pierde la velocidad del pase
  if (mode === 'match') {
    if (a.team !== B.possTeam) { B.possTeam = a.team; shotClock = 24; }
    else if (was === 'loose') shotClock = Math.max(shotClock, 14);    // rebote ofensivo
    else if (how === 'steal') shotClock = 24;
    if (autoFollow(a.team)) setCtrl(a);
  }
}
function predictBall(y) {              // dónde va a estar la pelota (en el piso) cuando baje a la altura y
  const disc = BV.y * BV.y + 2 * G9 * (BP.y - y), t = disc < 0 ? 0 : clamp((BV.y + Math.sqrt(disc)) / G9, 0, 2.5);
  return { x: clamp(BP.x + BV.x * t * 0.9, -COURT_X, COURT_X), z: clamp(BP.z + BV.z * t * 0.9, -COURT_Z, COURT_Z), t };
}
function pickups() {                   // quién agarra la pelota (rebotes, pases, pelotas sueltas, intercepciones)
  if (dead || B.holder || B.mode === 'shot' || B.mode === 'dead') return;
  let best = null, bs = -1;
  for (const a of agents) {
    if (!a.active || a.state === 'dunk') continue;
    if (B.noPick.a === a && B.noPick.t > 0) continue;
    if (a.stunT > 0.35 && B.mode === 'loose') continue;
    const dx = BP.x - a.pos.x, dz = BP.z - a.pos.z, d = Math.hypot(dx, dz);
    const R = B.mode === 'pass' ? (a === B.target ? 1.0 : 0.8) : a.grounded ? 0.72 : 0.9, top = a.y + (a.grounded ? 2.25 : 2.6) * a.scale;
    if (d > R || BP.y > top || BP.y < a.y + 0.1) continue;
    let sc;
    if (B.mode === 'pass') {
      if (a === B.target) sc = 10;
      else if (B.passer && a.team !== B.passer.team) {
        if (B.rolled.has(a)) continue; B.rolled.add(a);
        const p = isHum(a) ? 0.55 : prof(a).intercept * (a.info.defense / 75);
        if (Math.random() < clamp(p, 0, 0.8)) { sc = 5; say('¡Pase interceptado!'); } else continue;
      } else continue;
    } else sc = 1 / (d + 0.15) + Math.random() * 0.6 + (a.info.detailed ? reboundScore(a.info, a.team === B.possTeam, a.scale) : (a.info.rebound - 70) * 0.01);
    if (sc > bs) { bs = sc; best = a; }
  }
  if (best) { if (B.mode === 'pass' && best !== B.target) { bx(best, 'stl'); bx(B.passer, 'tov'); } giveBall(best, B.mode === 'pass' ? (best === B.target ? 'pass' : 'steal') : 'rebound'); }
}
function ballLogic(dt) {
  if (dead && dead.phase >= 1 && !dead.ftLive) return;                 // el árbitro tiene la pelota
  B.noPick.t = Math.max(0, B.noPick.t - dt); B.passT += dt;
  const hd = B.holder;
  if (hd) {
    if (hd.passQ) {                                    // pase con lujo: la pelota sigue en la mano mientras se arma el movimiento
      if (dead) { hd.passQ = null; hd.act = null; }
      else { hd.passQ.t -= dt; holdBall(hd, dt); if (hd.passQ.t > 0) return; const q = hd.passQ; hd.passQ = null; launchPass(hd, q.tgt, q.style); }
    } else if (hd.state === 'dunk') { dunkBall(hd, dt); if (!hd.D.rd) return; }
    else if (hd.state === 'shoot' && !hd.released && hd.shootT >= T_REL) { holdBall(hd); releaseBall(hd); }
    else if (hd.state === 'charge' || (hd.state === 'shoot' && !hd.released)) { holdBall(hd, dt); return; }
    else dribbleControl(hd);
  }
  if (B.mode === 'pass' && B.passT > 3) B.mode = 'loose';
  const n = Math.ceil(dt / (1 / 240)), h = dt / n;
  for (let i = 0; i < n; i++) stepBall(h);
  if (B.mode === 'shot' && B.passT > 0.3 && BP.y < 2.6 && BV.y < 0 && !B.holder) B.mode = 'loose';
  pickups();
  if (!dead && !B.holder && (ballOut || Math.abs(BP.x) > ARENA.BX - 0.2 || Math.abs(BP.z) > ARENA.BZ - 0.2 || BP.y > 24)) {
    if (mode === 'training') recallBall();
    else if (!resolvePending(false)) { if (!B.reboundOf && B.mode !== 'shot' && B.lastTouch && B.lastTouch.team === B.lastTeam) bx(B.lastTouch, 'tov'); startDead('out', BP.x, BP.z, 'Pelota afuera', 1 - B.lastTeam); }
  }
  ballOut = false;
}

/* ============ Reinicios realistas: silbato, pausa, corte a negro y el árbitro entrega la pelota ============ */
const _hp0 = V3(), _hp1 = V3(), _hb = V3();
function restartSpot(kind, a, b) {
  const M = 0.55;                                                        // el saque se hace apenas afuera de la línea
  if (kind === 'score') return { x: 0, z: a * (COURT_Z + M), ix: 0, iz: -a };       // después de un doble/triple: saque de fondo desde la línea de fondo del aro que acaba de recibir el punto
  if (kind === 'quarter') return { x: COURT_X + M, z: 0, ix: -1, iz: 0 };           // inicio de cuarto: saque en la mitad de cancha, junto a la mesa
  let x = a, z = b;
  if (Math.abs(x) - COURT_X >= Math.abs(z) - COURT_Z) { const sx = Math.sign(x) || 1; return { x: sx * (COURT_X + M), z: clamp(z, -COURT_Z + 3.5, COURT_Z - 3.5), ix: -sx, iz: 0 }; }
  const sz = Math.sign(z) || 1; return { x: clamp(x, -5.5, 5.5), z: sz * (COURT_Z + M), ix: 0, iz: -sz };
}
function whistle() {
  if (netRole === 'host') Online.sendGame({ t: 'E', k: 'w' }, true);
  try {
    audioCtx ??= new AudioContext(); const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), l = audioCtx.createOscillator(), lg = audioCtx.createGain(), g = audioCtx.createGain();
    o.type = 'square'; o.frequency.value = 2900; l.frequency.value = 38; lg.gain.value = 170;
    l.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(0.04, t); g.gain.setTargetAtTime(0, t + 0.35, 0.03);
    o.connect(g); g.connect(audioCtx.destination); o.start(t); l.start(t); o.stop(t + 0.6); l.stop(t + 0.6);
  } catch (e) { /* sin audio */ }
}
function startDead(kind, a = 0, b = 0, msg, inTeam = 0, opts = {}) {
  if (dead) return;
  B.foulPending = null; B.reboundOf = null;
  if (B.holder) { B.holder.state = 'free'; B.holder.released = true; B.holder.charge = 0; B.holder = null; }
  for (const p of agents) if (p.state === 'charge' || p.state === 'shoot') { p.state = 'free'; p.released = true; p.charge = 0; }
  updatePowerUI();
  B.mode = 'dead';
  const fts = opts.fts || [];
  dead = { kind, t: 0, phase: 0, u: 0, T1: kind === 'score' ? 1.6 : 1.0, spot: opts.spot || restartSpot(kind, a, b), inTeam, inb: null, flip: !!opts.flip, fts, fadeless: fts.length > 0, ftSet: 0, techIn: inTeam };
  dead.techSpot = dead.spot;
  if (opts.instant) { dead.T1 = 0; dead.t = 0.3; }
  if (msg) say(msg);
  if (kind !== 'score' && !opts.instant && !opts.quiet) whistle();
}
function checkPlayerOut() {
  const h = B.holder; if (!h) return;
  if (inbound) { if (!outsideLines(h.pos.x, h.pos.z, -0.2)) inbound = false; return; }     // hasta que entra a la cancha no cuenta como "afuera"
  const holds = h.state === 'dribble' || h.state === 'charge' || (h.state === 'shoot' && !h.released);
  if (holds && h.grounded && outsideLines(h.pos.x, h.pos.z, 0.1)) bx(h, 'tov');
  if (holds && h.grounded && outsideLines(h.pos.x, h.pos.z, 0.1)) startDead('out', h.pos.x, h.pos.z, '¡Saliste de la cancha con la pelota!', 1 - h.team);
}
function handTarget(a, out) {
  const p = _hp0.setFromMatrixPosition(a.R.hR.matrixWorld), e = _hp1.setFromMatrixPosition(a.R.elR.matrixWorld);
  return out.copy(p).addScaledVector(e.sub(p).normalize(), -0.175);
}
/* ---- v65 · Cambios manuales desde la pausa (infinitos, como en el básquet): sale uno de la cancha, entra uno del banco; el que sale se recupera en el banco ---- */
const subTeam = () => humans.find(h => h.agent)?.agent.team ?? 0;
function subsData() {
  const t = subTeam(), mk = (i, x, rest) => ({ i, name: x.name, num: x.number, pos: x.pos, ovr: x.ovr, e: Math.round(Math.max(0, Math.min(1, rest)) * 100) });
  return { team: (t === 0 ? teamA : teamB).name, court: T[t].court.map((a, i) => ({ ...mk(i, a.info, a.stam), ctl: !!a.hum })), bench: T[t].bench.map((b, i) => mk(i, b, b.rest ?? 1)) };
}
function subSwap(ci, bi) {
  const t = subTeam(), a = T[t].court[ci], cand = T[t].bench[bi]; if (!a || !cand) return false;
  const out = a.info; out.rest = a.stam; T[t].bench.splice(bi, 1, out);
  setInfo(a, cand); a.stam = cand.rest ?? 1; a.tired = false;
  say(`Cambio en ${T[t].ab}: entra ${cand.name} por ${out.name}`);
  return true;
}
function doSubstitutions(force) {                       // en las pausas entran los suplentes por los jugadores cansados
  if (mode !== 'match') return;
  for (const t of [0, 1]) {
    if (humansOn(t).length && !opts.autoSubs) continue;                // cambios automáticos apagados en tu equipo
    const bench = T[t].bench;
    for (const a of T[t].court) {
      if (a.hum && a.stam > 0.15) continue;
      if (a.stam > (force ? 0.5 : 0.3)) continue;
      const cand = bench.filter(b => (b.rest ?? 1) > a.stam + 0.25).sort((x, y) => (y.pos === a.info.pos) - (x.pos === a.info.pos) || y.ovr - x.ovr)[0];
      if (!cand) continue;
      const out = a.info; out.rest = a.stam; bench.splice(bench.indexOf(cand), 1, out);
      setInfo(a, cand); a.stam = cand.rest ?? 1; a.tired = false;
      if (humansOn(t).length) say(`Cambio en ${T[t].ab}: entra ${cand.name} por ${out.name}`);
    }
  }
}
function placeFormation(d) {                            // pone a los 10 jugadores en su lugar para el saque
  const sp = d.spot, inT = d.inTeam, defT = 1 - inT, inH = attackHoop(inT), oh = ownHoop(defT);
  const clampC = (x, z) => [clamp(x, -COURT_X + 1.0, COURT_X - 1.0), clamp(z, -COURT_Z + 1.2, COURT_Z - 1.2)];
  const inb = (mode === 'match' && humansOn(inT).length) ? humansOn(inT)[0].agent : T[inT].court[0];
  d.inb = inb;
  const put = (a, x, z, h) => { a.pos.set(x, 0, z); a.vel.set(0, 0, 0); a.acc.set(0, 0, 0); a.y = 0; a.vy = 0; a.grounded = true; a.jumpWind = 0; a.landC = 0; a.state = 'free'; a.act = null; a.stunT = 0; a.h = h; a.charge = 0; a.released = false; a.ai.cutT = 0; a.ai.holdT = 0; };
  put(inb, sp.x, sp.z, Math.atan2(sp.ix, sp.iz));
  const dx0 = 0 - sp.x, dz0 = inH.hz - sp.z, dl = Math.hypot(dx0, dz0) || 1, ux = dx0 / dl, uz = dz0 / dl;
  const spread = [[4.5, -3.4], [6.5, 3.2], [8.5, -0.8], [10.5, 2.4]];
  T[inT].court.filter(a => a !== inb).forEach((a, k) => { const [f, l] = spread[k]; const [x, z] = clampC(sp.x + ux * f - uz * l, sp.z + uz * f + ux * l); put(a, x, z, Math.atan2(ux, uz)); });
  for (const a of T[defT].court) {
    const m = a.mark, mx = m.pos.x, mz = m.pos.z, ex = 0 - mx, ez = oh.hz - mz, el = Math.hypot(ex, ez) || 1;
    const [x, z] = clampC(mx + ex / el * 1.4, mz + ez / el * 1.4); put(a, x, z, Math.atan2(mx - x, mz - z));
  }
  separate(); separate();
}
/* ============ Faltas: cada una tiene su consecuencia ============ */
const lastN = a => a.info.name.split(' ').slice(-1)[0];
const bestFT = team => T[team].court.reduce((b, a) => (a.info.ft ?? 70) > (b.info.ft ?? 70) ? a : b);
function commitFoul(f) {
  if (dead || mode !== 'match') return;
  const fl = f.fouler, vc = f.victim, x = f.x ?? BP.x, z = f.z ?? BP.z;
  fl.info.pf = (fl.info.pf || 0) + 1;
  if (f.type !== 'technical') bx(fl, 'pf'); if (f.type === 'offensive') bx(fl, 'tov');
  if (f.type === 'shooting' && !f.made && vc) { bx(vc, 'fga', -1); if (f.three) bx(vc, 'tpa', -1); }      // falta sobre el que tira y no entra: no cuenta como intento
  const counts = f.type === 'shooting' || f.type === 'reach';          // técnicas y faltas en ataque no suman faltas de equipo
  if (counts) teamFouls[fl.team]++;
  const bonus = counts && teamFouls[fl.team] > (quarter > 4 ? 3 : 4);
  const sets = []; let msg, inTeam = vc ? vc.team : 1 - fl.team;
  if (f.type === 'shooting') {                                          // falta sobre el que tira: 2 libres, 3 si era triple, 1 si la metió (y uno)
    const n = f.made ? 1 : f.three ? 3 : 2;
    sets.push({ shooter: vc, n });
    msg = f.made ? `¡Y UNO! Canasta válida de ${lastN(vc)} y un tiro libre.` : `¡Falta de ${lastN(fl)} sobre ${lastN(vc)}! ${n === 3 ? 'Tres' : 'Dos'} tiros libres.`;
  } else if (f.type === 'technical') {                                  // técnica: 1 libre del rival y la pelota sigue siendo de quien la tenía
    sets.push({ shooter: bestFT(1 - fl.team), n: 1, tech: true });
    inTeam = f.inTeam ?? B.possTeam;
    msg = `¡FALTA TÉCNICA a ${lastN(fl)}! ${f.why || ''} Un tiro libre para ${T[1 - fl.team].ab}.`;
  } else if (f.type === 'offensive') {                                  // falta en ataque: pérdida y saque de banda del rival
    inTeam = 1 - fl.team;
    msg = `¡Falta en ataque de ${lastN(fl)}! Saque de banda para ${T[inTeam].ab}.`;
  } else if (bonus) {                                                   // falta normal con el equipo en bonus: 2 libres
    sets.push({ shooter: vc, n: 2 });
    msg = `¡Falta de ${lastN(fl)}! Bonus: dos tiros libres para ${lastN(vc)}.`;
  } else msg = `¡Falta de ${lastN(fl)}! Saque de banda para ${T[inTeam].ab} (faltas del equipo: ${teamFouls[fl.team]}).`;
  if (counts && fl.info.pf >= 5 && Math.random() < 0.12) {              // el que ya tiene muchas faltas protesta y se come una técnica
    sets.unshift({ shooter: bestFT(1 - fl.team), n: 1, tech: true });
    msg += ' ¡Y protestó: falta técnica!';
  }
  startDead('foul', x, z, msg, inTeam, { fts: sets, quiet: !!f.quiet, spot: f.spot });
}
function rollShootingFoul(a, type, three, H) {                          // ¿el defensor que está encima lo toca al tirar?
  if (mode !== 'match' || dead || B.foulPending || a.ftShot) return;
  let o = null, bd = 9;
  for (const q of agents) { if (!q.active || q.team === a.team) continue; const d = Math.hypot(q.pos.x - a.pos.x, q.pos.z - a.pos.z); if (d < bd) { bd = d; o = q; } }
  if (!o || bd > 1.7) return;
  const cst = contestOf({ ...a, aimHoop: H || a.aimHoop, pos: a.pos, team: a.team });
  let p = cst * (type === 'layup' ? 0.30 : 0.20) * (1.25 - clamp((o.info.defense - 55) / 100, 0, 0.5));
  if (o.act === 'block' || !o.grounded) p += 0.07;
  if (Math.random() >= clamp(p, 0, 0.45)) return;
  B.foulPending = { type, shooter: a, fouler: o, three: !!three, age: 0 };
  whistle(); say(`¡Falta de ${lastN(o)} sobre ${lastN(a)}!`);
}
function resolvePending(made) {
  const fp = B.foulPending; if (!fp) return false;
  B.foulPending = null;
  commitFoul({ type: 'shooting', fouler: fp.fouler, victim: fp.shooter, three: fp.three, made, x: fp.shooter.pos.x, z: fp.shooter.pos.z, quiet: true });
  return true;
}
function pollFoul(dt) {
  const fp = B.foulPending; if (!fp) return;
  fp.age += dt;
  if (fp.type === 'dunk' && fp.shooter.state === 'dunk') return;
  if ((B.mode !== 'shot' && B.passT > 0.3 && (BP.y < 2.4 || B.holder)) || fp.age > 6) resolvePending(false);
}
function tryCharge(h, o) {                                              // el que lleva la pelota se lleva puesto a un defensor parado
  if (gameTime < (tryCharge.cd || 0) || h.state !== 'dribble' || !h.grounded || !o.grounded || o.stunT > 0) return;
  const hs = Math.hypot(h.vel.x, h.vel.z), os = Math.hypot(o.vel.x, o.vel.z);
  if (hs < 4.2 || os > 1.8) return;
  const dx = o.pos.x - h.pos.x, dz = o.pos.z - h.pos.z, d = Math.hypot(dx, dz) || 1;
  if ((h.vel.x * dx + h.vel.z * dz) / (d * hs) < 0.6 || -(dx * Math.sin(o.h) + dz * Math.cos(o.h)) / d < 0.2) return;
  tryCharge.cd = gameTime + 2;
  if (Math.random() < 0.3) commitFoul({ type: 'offensive', fouler: h, victim: o, x: h.pos.x, z: h.pos.z });
}

/* ============ Tiros libres: caminan a su lugar, el árbitro te da la pelota y el tiro lo hacés vos ============ */
const FT_LINE = COURT_Z - 5.79;                                          // z de la línea de libres (medida desde el centro)
const stg = (d, s) => { d.ftStage = s; d.stageT = 0; };
function ftPrepare(d) {
  const set = d.fts[d.ftSet], sh = set.shooter, H = attackHoop(sh.team), s = H.s;
  Object.assign(d, { ftShooter: sh, ftHoop: H, ftN: set.n, ftIdx: 0, ftMade: 0, ftScored: false });
  for (const a of agents) { a.ftShot = false; if (a.active) { a.state = 'free'; a.act = null; a.stunT = 0; a.charge = 0; a.released = false; a.jumpWind = 0; } }
  sh.aimHoop = H; sh.side = 1; sh.ftShot = true;
  const lineZ = s * FT_LINE, face = (x, z) => Math.atan2(-x, H.hz - z);
  const tgt = (a, x, z) => { a._tx = x; a._tz = z; a._th = face(x, z); };
  tgt(sh, 0, lineZ);
  const defs = agents.filter(a => a.active && a !== sh && a.team !== sh.team), offs = agents.filter(a => a.active && a !== sh && a.team === sh.team);
  const sp = (side, r) => [side * 2.0, s * (COURT_Z - [1.9, 3.0, 4.1, 5.2][r])];
  const fill = (list, spots) => {                                        // cada uno va al lugar libre más cercano de la zona
    for (const [x, z] of spots) {
      if (!list.length) break;
      let bi = 0, bd = 1e9; list.forEach((a, i) => { const dd = Math.hypot(a.pos.x - x, a.pos.z - z); if (dd < bd) { bd = dd; bi = i; } });
      tgt(list.splice(bi, 1)[0], x, z);
    }
    list.forEach((a, i) => tgt(a, (i % 2 ? 1 : -1) * 4.4, s * (COURT_Z - 8.6 - Math.floor(i / 2) * 1.2)));
  };
  fill(defs, [sp(-1, 0), sp(1, 0), sp(-1, 2), sp(1, 2)]); fill(offs, [sp(-1, 1), sp(1, 1), sp(-1, 3), sp(1, 3)]);
  const th = face(0, lineZ), rx = -Math.cos(th), rz = Math.sin(th), fx = Math.sin(th), fz = Math.cos(th);
  d.refSx = rx * 1.05 + fx * 0.45; d.refSz = lineZ + rz * 1.05 + fz * 0.45; d.refFace = Math.atan2(-d.refSx, lineZ - d.refSz);
  for (const t of [0, 1]) {                                          // el humano de cada equipo (si hay uno solo) toma al tirador o, si no es de su equipo, al que va a pelear el rebote
    if (!autoFollow(t)) continue;
    if (sh.team === t) setCtrl(sh);
    else { let b = null, bd = 1e9; for (const a of T[t].court) { const dd = Math.hypot(a._tx, a._tz - H.hz); if (dd < bd) { bd = dd; b = a; } } if (b) setCtrl(b); }
  }
  ctrlLock = 0; humans.forEach(h => { h.lock = 0; }); if (camMode === 2) yaw = s > 0 ? Math.PI : 0;
  say(`Tiros libres · ${lastN(sh)}`);
}
function ftWalk(d, dt) {                                                 // todos caminan/trotan a su lugar
  let all = true;
  for (const a of agents) {
    if (!a.active) continue;
    const dx = a._tx - a.pos.x, dz = a._tz - a.pos.z, dist = Math.hypot(dx, dz);
    if (dist > 0.2) { all = false; const sp = Math.min(5.0, 1.2 + dist * 2); a.vel.set(dx / dist * sp, 0, dz / dist * sp); }
    else { a.vel.set(0, 0, 0); a.h += clamp(wrap(a._th - a.h), -8 * dt, 8 * dt); }
  }
  return all;
}
function refBall() {
  const hr = R3.root.rotation.y;
  BP.set(R3.root.position.x + Math.sin(hr) * 0.4, 1.12, R3.root.position.z + Math.cos(hr) * 0.4); BV.set(0, 0, 0); BW.set(0, 0, 0);
}
function aiFreeThrow(a) {                                                // los bots tiran con su rating de libres
  if (!startCharge(a)) return;
  const r = a.info.ft ?? 70, p = clamp((0.70 + (r - 70) * 0.008) * (!oppTeam(a.team) ? 1 : 0.88 + prof(a).acc * 0.12), 0.35, 0.95);
  a.charge = Math.random() < p ? PERFECT + (Math.random() - 0.5) * 0.05 : PERFECT + (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.12);
  releaseCharge(a);
}
function ftMade(H) {
  const d = dead, sh = d.ftShooter;
  d.ftScored = true; d.ftScoredT = d.stageT; H.done = true;
  if (sh.team === 0) scoreA++; else scoreB++; trackPts(1, sh, true);
  cheerAt(sh.team === userTeam ? 1.5 : 0.8, sh.team === userTeam); say('¡TIRO LIBRE CONVERTIDO!');
}
function ftEnd(d, madeLast) {
  const set = d.fts[d.ftSet], sh = set.shooter;
  agents.forEach(a => { a.ftShot = false; });
  if (set.tech) { d.inTeam = d.techIn; d.spot = d.techSpot; }
  else if (madeLast) { d.inTeam = 1 - sh.team; d.spot = restartSpot('score', d.ftHoop.s, 0); }
  else {                                                                 // erró el último libre: pelota viva, ¡rebote!
    dead = null; B.mode = 'loose'; B.holder = null; B.noPick = { a: null, t: 0 }; B.possTeam = sh.team; B.lastTeam = sh.team; B.lastTouch = sh; B.reboundOf = sh;
    hoops.forEach(h => { h.done = false; }); shotClock = 24; setFade(0);
    for (const a of agents) { a.ai = newAIState(); a.state = a.state === 'shoot' ? 'free' : a.state; }
    say('Tiro libre fallado · ¡rebote!'); return;
  }
  Object.assign(d, { fts: [], fadeless: false, ftLive: false, ftStage: null, refMode: null, refHas: undefined, ftShooter: null, ftHoop: null, flip: false, t: 0, phase: 0, T1: 0.55 });
}
function ftNext(d, made) {
  d.ftIdx++; if (made) d.ftMade++;
  const sh = d.ftShooter;
  if (d.ftIdx < d.ftN) { d.nextSet = false; stg(d, 'settle'); return; }
  say(`Tiros libres: ${d.ftMade}/${d.ftN} convertidos`);
  if (d.ftSet + 1 < d.fts.length) { sh.ftShot = false; d.ftSet++; d.nextSet = true; stg(d, 'settle'); return; }
  ftEnd(d, made);
}
function updateFT(d, dt) {
  d.stageT += dt;
  const sh = d.ftShooter, st = d.ftStage;
  if (st === 'init') { d.ftSet = 0; ftPrepare(d); d.refHas = false; d.refMode = 'walk'; d.refTx = R3.root.position.x; d.refTz = R3.root.position.z; stg(d, 'walk'); return; }
  if (st === 'walk') {                                                   // el árbitro agarra la pelota y va a la línea; los jugadores se acomodan
    const rp = R3.root.position;
    if (!d.refHas) {
      d.refTx = clamp(BP.x, -COURT_X - 0.5, COURT_X + 0.5); d.refTz = clamp(BP.z, -COURT_Z - 0.5, COURT_Z + 0.5);
      if (Math.hypot(rp.x - d.refTx, rp.z - d.refTz) < 0.9) d.refHas = true;
    }
    if (d.refHas) { d.refTx = d.refSx; d.refTz = d.refSz; refBall(); }
    const all = ftWalk(d, dt);
    if (d.stageT > 9) {                                                  // por si alguien se traba: se acomodan solos
      for (const a of agents) if (a.active) { a.pos.set(a._tx, 0, a._tz); a.vel.set(0, 0, 0); a.h = a._th; }
      rp.set(d.refSx, 0, d.refSz); d.refHas = true; refBall();
    }
    if ((all && d.refHas && Math.hypot(rp.x - d.refSx, rp.z - d.refSz) < 0.25) || d.stageT > 9) { d.refMode = 'hold'; R3.root.rotation.y = d.refFace; refSpeed = 0; stg(d, 'give'); }
    return;
  }
  if (st === 'settle') {                                                 // la pelota termina de rodar y vuelve al árbitro
    if (d.stageT > 1.3) {
      d.refHas = true; refBall(); d.u = 0;
      if (d.nextSet) { ftPrepare(d); d.refMode = 'walk'; stg(d, 'walk'); } else { d.refMode = 'hold'; stg(d, 'give'); }
    }
    return;
  }
  if (st === 'give') {                                                   // el árbitro estira los brazos y te da la pelota
    const hr = R3.root.rotation.y, ox = R3.root.position.x + Math.sin(hr) * 0.4, oz = R3.root.position.z + Math.cos(hr) * 0.4;
    BV.set(0, 0, 0); BW.set(0, 0, 0);
    if (d.stageT < 0.9) { d.u = 0; BP.set(ox, 1.12, oz); return; }
    d.u = smooth((d.stageT - 0.9) / 0.55); handTarget(sh, _hb);
    BP.set(lerp(ox, _hb.x, d.u), lerp(1.12, _hb.y, d.u), lerp(oz, _hb.z, d.u));
    if (d.stageT >= 1.5) {
      d.refHas = false; d.u = 0; sh.ftShot = true; hoops.forEach(h => { h.done = false; });
      giveBall(sh, 'inbound'); sh.state = 'dribble'; sh.act = null; sh.stunT = 0; d.ftScored = false; stg(d, 'aim');
      const human = isHum(sh);
      say(`TIRO LIBRE ${d.ftIdx + 1} DE ${d.ftN} · ${lastN(sh)}${human ? ' · Mantené el clic y soltá en la línea blanca' : ''}`);
    }
    return;
  }
  if (st === 'aim') {                                                    // el tirador pica la pelota; vos tirás con el clic, los bots solos
    if (B.mode === 'shot' && B.shooter === sh) { stg(d, 'flight'); return; }
    if (!isHum(sh) && d.stageT > 1.5 && sh.state === 'dribble') aiFreeThrow(sh);
    return;
  }
  if (st === 'flight') {
    if (d.ftScored) { if (d.stageT - d.ftScoredT > 0.8) ftNext(d, true); return; }
    if ((d.stageT > 0.5 && B.mode !== 'shot' && BP.y < 2.9 && BV.y < 0) || d.stageT > 5) { if (d.ftIdx + 1 >= d.ftN) say('Tiro libre fallado'); ftNext(d, false); }
  }
}
function updateDead(dt) {
  const d = dead, T1 = d.T1; d.t += dt;
  if (d.fadeless) setFade(0);
  else setFade(d.t < T1 ? 0 : d.t < T1 + 0.3 ? (d.t - T1) / 0.3 : d.t < T1 + 0.55 ? 1 : Math.max(0, 1 - (d.t - T1 - 0.55) / 0.3));
  if (d.phase === 2) { updateFT(d, dt); return; }
  if (d.phase === 0) {                                  // 1) la jugada queda congelada (la pelota termina de caer, el reloj está parado)
    if (d.fadeless) {                                   // faltas con tiros libres: sin corte a negro, todos caminan a su lugar
      if (d.t < T1) return;
      if (d.t < T1 + 2.5 && agents.some(a => a.active && (a.state === 'dunk' || !a.grounded))) return;
      d.phase = 2; d.ftLive = true; stg(d, 'init'); return;
    }
    if (d.t < T1 + 0.3) return;
    d.phase = 1;                                        // 2) en negro: jugadores, árbitro y pelota pasan al lugar del saque
    hoops.forEach(h => h.done = false);
    if (d.flip) { attSign = [-attSign[0], -attSign[1]]; say('Cambio de lado'); }
    doSubstitutions(d.kind === 'quarter');
    B.possTeam = d.inTeam; shotClock = 24;
    placeFormation(d);
    const inb = d.inb, sp = d.spot;
    if (mode === 'match') for (const t of [0, 1]) {
      if (!autoFollow(t)) continue;                       // con varios humanos en el equipo, cada uno mantiene su jugador
      if (d.inTeam === t) setCtrl(inb);
      else { let best = T[t].court[0], bd = 99; for (const a of T[t].court) { const dd = Math.hypot(a.pos.x - sp.x, a.pos.z - sp.z); if (dd < bd) { bd = dd; best = a; } } setCtrl(best); }
    }
    yaw = camMode === 1 ? -Math.PI / 2 : camMode === 0 ? (attSign[0] > 0 ? Math.PI : 0) : Math.atan2(-sp.ix, -sp.iz);
    camT.set(sp.x, 1.5, sp.z); tvc.x = sp.x; tvc.z = sp.z; cam2k.snap = true;
    {                                                   // el árbitro se para adelante y a la DERECHA del jugador: la cámara está detrás, y así no queda tapado por el cuerpo
      const rx = -Math.cos(inb.h), rz = Math.sin(inb.h), ax = sp.x + sp.ix * 1.3 + rx * 0.9, az = sp.z + sp.iz * 1.3 + rz * 0.9;
      R3.root.position.set(ax, 0, az); R3.root.rotation.y = Math.atan2(sp.x - ax, sp.z - az);
      refSpeed = 0; Object.assign(J3, mkJ());
    }
    agents.forEach(a => a.active && pose(a, 0.016));
  }
  const inb = d.inb, give = T1 + 0.3 + 1.1, hr = R3.root.rotation.y;     // 3) el árbitro sostiene la pelota y se la entrega al jugador
  const ox = R3.root.position.x + Math.sin(hr) * 0.4, oz = R3.root.position.z + Math.cos(hr) * 0.4;
  BV.set(0, 0, 0); BW.set(0, 0, 0);
  if (d.t < give) { BP.set(ox, 1.12, oz); return; }
  d.u = smooth((d.t - give) / 0.55); handTarget(inb, _hb);
  BP.set(lerp(ox, _hb.x, d.u), lerp(1.12, _hb.y, d.u), lerp(oz, _hb.z, d.u));
  if (d.t >= give + 0.6) {                              // 4) juego en marcha
    dead = null; B.mode = 'loose'; giveBall(inb, 'inbound'); inb.side = 1;
    inbound = outsideLines(inb.pos.x, inb.pos.z, -0.2); shotClock = 24; setFade(0);
    if (!isHum(inb)) { inb.ai.inb = true; inb.ai.inbT = 0.6 + Math.random() * 0.7; }
  }
}
let refPhase = 0, refSpeed = 0;
function updateRef(dt) {                                 // árbitro: sigue la jugada desde la banda y entrega la pelota en los saques
  const p = R3.root.position, T = mkJ(), rm = dead && dead.phase >= 1 ? (dead.refMode || 'hold') : 'follow', handling = rm !== 'follow', armsBall = rm === 'hold' ? dead.refHas !== false : (rm === 'walk' && dead.refHas === true), pp = ctrl.pos;
  if (!handling) {
    const tz = clamp(lerp(pp.z, BP.z, 0.4) - 2.5, -COURT_Z + 1, COURT_Z - 1);
    _dv.set(8.2 - p.x, 0, tz - p.z); const dist = _dv.length(), sp = Math.min(dist * 2.2, 4.4);
    if (dist > 0.05) p.addScaledVector(_dv, sp * dt / dist);
    refSpeed += (sp - refSpeed) * (1 - Math.exp(-8 * dt));
    const want = sp > 0.6 ? Math.atan2(_dv.x, _dv.z) : Math.atan2(BP.x - p.x, BP.z - p.z);
    R3.root.rotation.y += clamp(wrap(want - R3.root.rotation.y), -8 * dt, 8 * dt);
  } else if (rm === 'walk') {
    _dv.set(dead.refTx - p.x, 0, dead.refTz - p.z); const dist = _dv.length(), sp = Math.min(dist * 2.5, 4.8);
    if (dist > 0.05) p.addScaledVector(_dv, sp * dt / dist);
    refSpeed += (sp - refSpeed) * (1 - Math.exp(-8 * dt));
    const want = sp > 0.6 ? Math.atan2(_dv.x, _dv.z) : (dead.refFace ?? R3.root.rotation.y);
    R3.root.rotation.y += clamp(wrap(want - R3.root.rotation.y), -8 * dt, 8 * dt);
  } else refSpeed = 0;
  const run = clamp(refSpeed / 6, 0, 1), mv = clamp(refSpeed / 1.2, 0, 1);
  refPhase += dt * Math.PI * 2 * (0.8 + 0.17 * refSpeed) * mv;
  const s = Math.sin(refPhase), c = Math.cos(refPhase), A = (0.12 + 0.45 * run) * mv;
  Object.assign(T, { thL: -s * A, thR: s * A, knL: 0.08 + mv * (0.15 + 0.9 * run) * Math.max(0, c), knR: 0.08 + mv * (0.15 + 0.9 * run) * Math.max(0, -c),
    shL: s * A, shR: -s * A, elL: -0.4 - 0.5 * run, elR: -0.4 - 0.5 * run, szL: 0.12, szR: -0.12, tx: 0.08 + run * 0.2, hx: -0.08, hy: 0.99 - 0.02 * Math.abs(s) * mv });
  if (armsBall) {                                        // pelota al pecho y brazos que se extienden al entregarla
    const u = dead.u || 0;
    Object.assign(T, { shL: lerp(-1.0, -1.45, u), shR: lerp(-1.0, -1.45, u), elL: lerp(-1.1, -0.15, u), elR: lerp(-1.1, -0.15, u),
      szL: lerp(0.28, 0.12, u), szR: lerp(-0.28, -0.12, u), wL: Math.PI, wR: Math.PI, cL: 0.4, cR: 0.4, sL: 0.25, sR: 0.25 });
  }
  if (!Number.isFinite(p.x + p.z)) p.set(8.2, 0, 0);   // por las dudas: nunca dejar al árbitro en una posición inválida
  R3.root.visible = mode === 'match';
  const k = 1 - Math.exp(-18 * dt);
  for (const key in T) J3[key] += (T[key] - J3[key]) * k;
  applyPose(R3, J3);
}

/* ============ Cámaras: 2K (la más usada de NBA 2K), TV y libre (C para cambiar) ============ */
const camT = V3(0, 1.5, -6);
const cam2k = { x: 0, z: 0, d: 10, hgt: 7, snap: true, sign: -1 };
const trainSign = { v: -1 };
const _cf = { pos: V3(), y: 0 };
function camSubject() {                                 // con varios humanos la cámara sigue el centro del grupo (más la pelota)
  if (dead?.ftShooter) return dead.ftShooter;
  if (!multi() || netRole) return ctrl;                 // online: cada uno ve la cancha desde su propio jugador
  _cf.pos.set(0, 0, 0); _cf.y = 0;
  for (const h of humans) { _cf.pos.add(h.agent.pos); _cf.y += h.agent.y; }
  _cf.pos.multiplyScalar(1 / humans.length); _cf.y /= humans.length;
  return _cf;
}
function updateCamera(dt) {
  const c = camSubject();
  const k = 1 - Math.exp(-14 * dt);
  camT.x += (c.pos.x - camT.x) * k; camT.z += (c.pos.z - camT.z) * k;
  camT.y += (1.5 + c.y * 0.5 - camT.y) * (1 - Math.exp(-6 * dt));
  const act = activeAgents();
  if (camMode === 1) {                 // cámara principal de TV: fija en lo alto de la grada, con teleobjetivo; el "operador" panea y hace zoom para que entren todos los jugadores
    yaw = -Math.PI / 2;
    let mz = 0, mx = 0; for (const a of act) { mz += a.pos.z; mx += a.pos.x; } mz /= act.length; mx /= act.length;
    const k2 = 1 - Math.exp(-2.4 * dt);                                        // retraso del operador
    tvc.x += (lerp(mx, BP.x, 0.3) - tvc.x) * k2; tvc.z += (lerp(mz, BP.z, 0.45) - tvc.z) * k2;
    let half = 6; for (const a of act) half = Math.max(half, Math.abs(a.pos.z - tvc.z) + 3.2);
    half = Math.max(half, Math.abs(BP.z - tvc.z) + 2.5);
    const fovT = clamp(2 * Math.atan(half / (24 * camera.aspect)) * 180 / Math.PI, 24, 50);
    camera.fov += (fovT - camera.fov) * (1 - Math.exp(-2.5 * dt)); camera.updateProjectionMatrix();
    const hw = Math.tan(camera.fov * Math.PI / 360) * 24 * camera.aspect, lim = Math.max(0, COURT_Z + 1.6 - hw);
    camera.position.set(-22, 11.5, 0); camera.lookAt(tvc.x * 0.6 - 1.2, 0.8, clamp(tvc.z, -lim, lim));
  } else if (camMode === 0) {          // cámara 2K: alta, detrás del jugador, mirando hacia el aro que atacás; se abre para meter a todos los jugadores cercanos
    if (mode === 'training') { if (c.pos.z > 2) trainSign.v = 1; else if (c.pos.z < -2) trainSign.v = -1; }
    const sg = dead?.ftHoop ? dead.ftHoop.s : (mode === 'training' ? trainSign.v : attSign[netRole === 'guest' ? 1 : userTeam]);
    yaw = sg > 0 ? Math.PI : 0;
    const fx = lerp(c.pos.x, BP.x, 0.3), fz = lerp(c.pos.z, BP.z, 0.3);
    let ext = 0;
    for (const a of act) { const rx = Math.abs(a.pos.x - fx), rz = (a.pos.z - fz) * sg; ext = Math.max(ext, rx * 1.15, rz > 0 ? rz * 0.5 : -rz * 0.9); }
    const zoom = camDist / 4.4;
    const dT = clamp((8.4 + ext * 0.62) * clamp(zoom, 0.7, 1.6), 8.5, 21), hT = clamp(5.6 + ext * 0.42, 6, 13) * clamp(zoom, 0.8, 1.4);
    if (cam2k.snap) { cam2k.x = fx; cam2k.z = fz; cam2k.d = dT; cam2k.hgt = hT; cam2k.snap = false; }
    const kc = 1 - Math.exp(-3.4 * dt);
    cam2k.x += (fx - cam2k.x) * kc; cam2k.z += (fz - cam2k.z) * kc; cam2k.d += (dT - cam2k.d) * kc; cam2k.hgt += (hT - cam2k.hgt) * kc;
    if (Math.abs(camera.fov - 58) > 0.05) { camera.fov += (58 - camera.fov) * (1 - Math.exp(-6 * dt)); camera.updateProjectionMatrix(); }
    const back = cam2k.d * 0.82;
    let cx = cam2k.x * 0.92, cz = cam2k.z - sg * back, cy = cam2k.hgt + camHeight * 1.15;
    const lz = clamp(cz, -ARENA.BZ + 1.0, ARENA.BZ - 1.0); cy += Math.abs(cz - lz) * 0.55; cz = lz; cx = clamp(cx, -ARENA.BX + 1.0, ARENA.BX - 1.0);
    camera.position.set(cx, cy, cz);
    camera.lookAt(cam2k.x * 0.85, 0.9 + camHeight * 0.18, cam2k.z + sg * (2.0 + ext * 0.22));
  } else {                             // cámara libre: tercera persona con el mouse
    if (Math.abs(camera.fov - 62) > 0.05) { camera.fov += (62 - camera.fov) * (1 - Math.exp(-6 * dt)); camera.updateProjectionMatrix(); }
    const f = V3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const r = V3(Math.cos(yaw), 0, -Math.sin(yaw));
    camera.position.copy(camT).addScaledVector(f, -camDist).addScaledVector(r, 0.55);
    camera.position.y = Math.max(camera.position.y, 0.35);
    camera.lookAt(_p.copy(camT).addScaledVector(r, 0.55).addScaledVector(f, 3));
  }
  sun.position.set(camT.x - 6, 16, camT.z + 8); sun.target.position.set(camT.x, 0, camT.z);
}

/* ============================================================================
   Partido online
   - ANFITRIÓN: corre el juego completo (los 10 jugadores, la pelota, las reglas, los bots). El invitado es un humano más (dev 'net')
     cuyos controles llegan por la red. Manda un snapshot ~20 veces por segundo.
   - INVITADO: no simula nada. Guarda los snapshots y dibuja el partido ~110 ms en el pasado interpolando. Sus controles se mandan al anfitrión.
   Mensajes (Online.sendGame):  S snapshot (host→guest, rápido) · I controles (guest→host, rápido) · A acción (guest→host, confiable) · E evento (host→guest, confiable)
   ============================================================================ */
const JK = Object.keys(mkJ());                                   // orden fijo de las articulaciones en el snapshot
const net = { acc: 0, n: 0, buf: new SnapBuffer(), delay: 110, pool: null, inAcc: 0, lastIn: '', lastInT: 0, lc: null, lastScore: null, lost: false };
function mkNetIn() { return { wx: 0, wz: 0, m: 0, t: performance.now(), P: { mag: 1, lx: 0, ly: 0, down: {}, amt: { sprint: 0 } } }; }
function resetNet() { net.acc = 0; net.n = 0; net.buf.reset(); net.inAcc = 0; net.lastIn = ''; net.lastInT = 0; net.lc = null; net.lastScore = null; net.lost = false; net.pool = null; for (const a of agents) { a._ik = undefined; a._ss = 'free'; } }
const infoKey = i => (i ? String(i.id ?? i.name) : '');
const idxOf = a => (a ? agents.indexOf(a) : -1);
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

/* ---- anfitrión ---- */
function buildSnap() {
  net.n++;
  const ag = agents.map(a => {
    const k = infoKey(a.info), row = [r3(a.pos.x), r3(a.y), r3(a.pos.z), r3(a.h), Math.max(0, STATES.indexOf(a.state)), Math.round(a.charge * 100), Math.round(a.stam * 100), (a.active ? 1 : 0) | (a.tired ? 2 : 0), 0];
    if (a._ik !== k || net.n % 80 === 1) { a._ik = k; row[8] = k; }                       // quién es cada uno (cambia solo con los cambios de jugadores)
    for (const key of JK) row.push(r3(a.J[key]));
    return row;
  });
  const q = ball.quaternion, d = dead;
  return {
    t: 'S', n: net.n, T: performance.now(), a: ag,
    b: [r3(BP.x), r3(BP.y), r3(BP.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w), idxOf(B.holder), Math.max(0, MODES.indexOf(B.mode))],
    g: [scoreA, scoreB, quarter, r2(clockT), r2(shotClock), attSign[0], B.possTeam | 0, d ? 1 : 0, d?.ftShooter ? idxOf(d.ftShooter) : -1, d?.ftHoop ? d.ftHoop.s : 0, r2(fadeV)],
    r: [r3(R3.root.position.x), r3(R3.root.position.z), r3(R3.root.rotation.y), ...JK.map(k => r3(J3[k]))],
    c: humans.map(h => idxOf(h.agent)),
    ...(net.n % 10 === 1 ? { x: Box.pack() } : {}),             // resumen de la tabla de puntos (2 veces por segundo)
  };
}
function hostNetTick(dt) {
  const now = performance.now();
  for (const h of humans) if (h.dev === 'net' && h.net && now - h.net.t > 1500 && h.net.m) { h.net.m = 0; h.net.P.down = {}; h.net.P.amt.sprint = 0; }      // sin noticias del invitado: se queda quieto
  net.acc += dt; if (net.acc < 1 / SNAP_HZ) return; net.acc = 0;
  Online.sendGame(buildSnap(), false);
}
/** Controles y acciones que llegan del invitado (el anfitrión las valida y las simula con las mismas funciones que el teclado). */
function netAct(h, m) {
  const c = h.agent; if (!c || mode !== 'match') return;
  if (m.k === 'shoot') startCharge(c);
  else if (m.k === 'release') { if (c.state === 'charge') { c.charge = clamp(+m.ch || 0, 0, 1); releaseCharge(c); } }       // el invitado manda su propia carga: así el tiro perfecto no depende de la demora de la red
  else if (m.k === 'pass') humanPass(h, !!m.fl);
  else if (m.k === 'steal') { if (!startSteal(c) && c.state === 'dribble') startCrossover(c); }
  else if (m.k === 'switch') switchPlayer(h);
  else if (m.k === 'dribble') humanCrossover(h, !!m.fl);
}
function onNetGame(m) {
  if (netRole === 'host') {
    const h = humans.find(x => x.dev === 'net'); if (!h) return;
    if (m.t === 'I') {
      const n = h.net; n.wx = +m.wx || 0; n.wz = +m.wz || 0; n.m = m.m ? 1 : 0; n.t = performance.now();
      Object.assign(n.P.down, { sprint: !!m.sp, jump: !!m.jp, dribble: !!m.db, shoot: !!m.sh, mod: !!m.md }); n.P.amt.sprint = +m.spA || 0; n.P.mag = +m.an || 0;
    } else if (m.t === 'A') netAct(h, m);
  } else if (netRole === 'guest') {
    if (m.t === 'S') { if (net.buf.push(m, performance.now())) ingestSnap(m); }
    else if (m.t === 'E') { if (m.k === 'say') say(m.v); else if (m.k === 'w') whistle(); }
  }
}

/* ---- invitado ---- */
function setupGuestHumans(S) {
  humans.length = 0; for (const a of agents) a.hum = null;
  const L = PM.localDevice();
  humans.push({ i: 0, dev: 'net', pad: null, team: 0, agent: T[0].court[S.ctrlSlot] || T[0].court[0], lock: 0, name: 'J1', color: HCOL[0], P: null, connected: true, net: null });
  humans.push({ i: 1, dev: L.dev === 'pad' ? 'pad' : 'kb', pad: L.pad ?? null, team: 1, agent: T[1].court[S.ctrlSlotB ?? 0] || T[1].court[0], lock: 0, name: 'J2', color: HCOL[1], P: null, connected: true });
  for (const h of humans) h.agent.hum = h;
  ctrl = humans[1].agent; ctrlLock = 0;
  for (const a of agents) if (a.info) drawLabel(a);
  buildMpHud();
}
function ingestSnap(sn) {                                // lo que no se interpola: quién es cada jugador (cambios de suplentes)
  if (sn.x) Box.unpack(sn.x);
  sn.a.forEach((row, i) => {
    const key = row[8]; if (typeof key !== 'string' || !key) return;
    const a = agents[i]; if (infoKey(a.info) === key) return;
    const p = net.pool?.get(key); if (p) setInfo(a, { ...p });
  });
}
function viewerStep(dt) {
  const smp = net.buf.sample(net.buf.at(performance.now(), net.delay)); if (!smp) return;
  const { a: A, b: Bk } = smp, k = A === Bk ? 0 : smp.k;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i], ra = A.a[i], rb = Bk.a[i]; if (!ra || !rb) continue;
    a.pos.set(lerp(ra[0], rb[0], k), 0, lerp(ra[2], rb[2], k)); a.y = lerp(ra[1], rb[1], k); a.h = lerpAngle(ra[3], rb[3], k);
    a._ss = STATES[rb[4]] || 'free'; a.state = a._ss; a.charge = rb[5] / 100; a.stam = rb[6] / 100; a.active = !!(rb[7] & 1); a.tired = !!(rb[7] & 2);
    for (let j = 0; j < JK.length; j++) a.J[JK[j]] = lerp(ra[9 + j], rb[9 + j], k);
    applyPose(a.R, a.J); a.R.root.position.set(a.pos.x, a.y, a.pos.z); a.R.root.rotation.y = a.h; a.R.root.updateMatrixWorld(true);
  }
  const ba = A.b, bb = Bk.b;
  BP.set(lerp(ba[0], bb[0], k), lerp(ba[1], bb[1], k), lerp(ba[2], bb[2], k));
  _qa.set(ba[3], ba[4], ba[5], ba[6]); _qb.set(bb[3], bb[4], bb[5], bb[6]); ball.quaternion.copy(_qa).slerp(_qb, k);
  B.holder = bb[7] >= 0 ? agents[bb[7]] : null; B.mode = MODES[bb[8]] || 'loose';
  const g = Bk.g;
  if (net.lastScore && (g[0] !== net.lastScore[0] || g[1] !== net.lastScore[1])) cheerAt(2.4, g[1] !== net.lastScore[1]);
  net.lastScore = [g[0], g[1]];
  scoreA = g[0]; scoreB = g[1]; quarter = g[2]; clockT = g[3]; shotClock = g[4]; attSign = [g[5], -g[5]]; B.possTeam = g[6];
  dead = g[7] ? { phase: 0, ftShooter: g[8] >= 0 ? agents[g[8]] : null, ftHoop: g[9] ? { s: g[9] } : null } : null;
  setFade(g[10]);
  const ra = A.r, rb = Bk.r;                                                           // árbitro
  R3.root.position.set(lerp(ra[0], rb[0], k), 0, lerp(ra[1], rb[1], k)); R3.root.rotation.y = lerpAngle(ra[2], rb[2], k);
  for (let j = 0; j < JK.length; j++) J3[JK[j]] = lerp(ra[3 + j], rb[3 + j], k);
  applyPose(R3, J3); R3.root.visible = true; R3.root.updateMatrixWorld(true);
  humans.forEach((h, i) => { const ai = Bk.c[i]; if (ai >= 0 && agents[ai] && agents[ai] !== h.agent) takeAgent(h, agents[ai]); });       // a quién controla cada uno (lo decide el anfitrión)
  ctrl = humans[1].agent;
  const me = ctrl;
  if (net.lc) {                                                                       // barra de tiro propia: corre acá, sin esperar a la red (se manda la carga al soltar)
    const lc = net.lc; lc.v += lc.dir * CHARGE_SPEED * (lc.mul || 1) * dt; if (lc.v >= 1) { lc.v = 1; lc.dir = -1; } if (lc.v <= 0) { lc.v = 0; lc.dir = 1; }
    if (me._ss === 'shoot' || me._ss === 'dunk' || (performance.now() - lc.t > 450 && me._ss !== 'charge')) net.lc = null;
    else { me.state = 'charge'; me.charge = lc.v; }
  }
}
function guestChargeMul(me) { try { return chargeTarget(me); } catch { return 1; } }       // el invitado calcula la velocidad de su propia barra con la misma regla
function netInputOf(h) {
  const inp = inputOf(h), w = humanDir(h), P = inp.P || NO_PAD, kd = inp.kb ? KB.down : () => false;
  const sprint = kd('sprint') || !!P.down.sprint, keyMove = kd('up') || kd('down') || kd('left') || kd('right');
  return { t: 'I', wx: w ? r2(w.x) : 0, wz: w ? r2(w.z) : 0, m: w ? 1 : 0, sp: sprint ? 1 : 0, spA: r2(kd('sprint') ? 1 : (P.amt.sprint || 0)), jp: (kd('jump') || P.down.jump) ? 1 : 0, db: (kd('dribble') || P.down.dribble) ? 1 : 0, sh: P.down.shoot ? 1 : 0, md: (kd('mod') || P.down.mod) ? 1 : 0, an: (P.mag > 0 && !keyMove && !sprint) ? r2(P.mag) : 1 };
}
function guestNetTick(dt) {
  net.inAcc += dt;
  const now = performance.now();
  if (net.inAcc >= 1 / 30) {
    net.inAcc = 0;
    const i = netInputOf(humans[1]), key = JSON.stringify(i);
    if (key !== net.lastIn || now - net.lastInT > 250) { net.lastIn = key; net.lastInT = now; Online.sendGame(i, false); }
  }
  if (net.buf.count) {                                                                // aviso si el anfitrión deja de mandar
    const stale = now - net.buf.lastRecv > 3500;
    if (stale && !net.lost) { net.lost = true; say('Se cortó la señal del anfitrión… esperando.'); } else if (!stale && net.lost) { net.lost = false; say('¡Volvió la conexión!'); }
  }
}
function guestSend(k, extra) { Online.sendGame({ t: 'A', k, ...extra }, true); }
function guestAct(act, h) {                                                           // botones del invitado: se mandan al anfitrión
  const me = h?.agent; if (!me) return;
  if (act === 'camera') { cycleCamera(); return; }
  if (act === 'shoot') { if (B.holder === me && me._ss === 'dribble' && !net.lc) net.lc = { v: 0, dir: 1, t: performance.now(), mul: guestChargeMul(me) }; guestSend('shoot'); }
  else if (act === 'pass') { if (B.holder === me) guestSend('pass', { fl: modHeld(h) ? 1 : 0 }); else if (h.dev === 'pad') guestSend('switch'); }
  else if (act === 'steal') guestSend('steal');
  else if (act === 'switch') guestSend('switch');
  else if (act === 'dribble') guestSend('dribble', { fl: modHeld(h) ? 1 : 0 });
}
function guestRelease(act, h) {
  if (act !== 'shoot') return;
  const me = h?.agent, ch = net.lc ? net.lc.v : (me?._ss === 'charge' ? me.charge : null);
  net.lc = null; if (ch !== null) guestSend('release', { ch: r3(ch) });
}
function padGameGuest(P, dt, h) {
  const E = P.pressed;
  if (E.menu) { openPause(); return; }
  if (E.camera) cycleCamera();
  if (E.shoot) guestAct('shoot', h);
  if (P.released.shoot) guestRelease('shoot', h);
  if (E.pass) guestAct('pass', h);
  if (E.switch) guestAct('switch', h);
  if (E.steal) guestAct('steal', h);
  if (E.dribble) guestAct('dribble', h);
  if (P.flick && camMode !== 2 && B.holder === h.agent) guestAct('dribble', h);
  if (P.raw[12]) camDist = clamp(camDist - 3 * dt, 2.2, 9); if (P.raw[13]) camDist = clamp(camDist + 3 * dt, 2.2, 9);
}
/** Fin del partido online (o abandono): se apaga todo lo de red y se frena el juego. */
function stopOnlineMatch() { netRole = null; paused = true; dead = null; inbound = false; setFade(0); net.lc = null; net.buf.reset(); document.exitPointerLock?.(); }
function onMatchEnded(info) {                            // llegó el resultado: XP para los dos y se frena la cancha
  paused = true; document.exitPointerLock?.();
  const mineA = netRole === 'host', ms = mineA ? info.sa : info.sb, os = mineA ? info.sb : info.sa;
  queueXp(10 + (ms > os ? 25 : 0)); flushXp();
}

/* ============ Bucle principal ============ */
const G = {                                            // lo que ve la IA
  agents, B, ctx: { primary: [null, null], helper: [null, null], chasers: new Set() },
  get dead() { return !!dead; }, get shotClock() { return shotClock; }, get time() { return gameTime; },
  attackHoop, ownHoop, prof, predictBall, startSteal, startBlock, doPass, aiShoot, tryDunk,
};
const clock = new THREE.Clock();
const hud = { stam: -1, name: '', pad: '' };
/* Ayuda de botones del joystick que cambia según la situación (como en EA FC): el mismo botón hace otra cosa en ataque, en defensa o con la pelota suelta */
const PAD_COL = { ps: ['#6aa6ff', '#ff6b6b', '#ff8fd0', '#4de0a0'], xbox: ['#5fd068', '#ff5b5b', '#5aa8ff', '#ffd23f'] };
function padContext() {
  if (dead || autoUser) return null;
  const a = ctrl, H = mode === 'training' ? facingHoop(a) : attackHoop(a.team), nearRim = Math.hypot(a.pos.x, a.pos.z - H.hz) < 5.2;
  const h = B.holder, rows = [];
  if (mode === 'training') rows.push(['shoot', 'Tirar', a.state === 'dribble'], ['jump', nearRim ? 'Mate / bandeja' : 'Saltar', true], ['sprint', 'Correr', true]);
  else if (h === a) rows.push(['shoot', 'Tirar', a.state === 'dribble'], ['pass', 'Pasar', a.state === 'dribble'], ['steal', 'Cruce', a.state === 'dribble'], ['jump', nearRim ? 'Mate / bandeja' : 'Saltar', true], ['sprint', 'Correr', true], ['dribble', 'Dribleo veloz', true], ['mod', 'Lujo (mantener)', true]);
  else if (h) rows.push(['shoot', 'Taponar', true], ['pass', 'Cambiar jugador', true], ['steal', 'Robar', true], ['jump', 'Saltar', true], ['sprint', 'Correr', true]);
  else rows.push(['shoot', 'Rebote / salto', true], ['pass', 'Cambiar jugador', true], ['steal', 'Manotazo', true], ['jump', 'Saltar', true], ['sprint', 'Correr', true]);
  return { rows, flick: camMode !== 2 && h === a };
}
function updatePadHud() {
  const el = $('padHud'), ctx = Pad.state.connected && UI.settings.padHints !== false && !paused ? padContext() : null;
  const key = ctx ? JSON.stringify([ctx, Pad.state.style, Pad.bindings()]) : '';
  if (key === hud.pad) return;
  hud.pad = key; el.hidden = !ctx; if (!ctx) { el.innerHTML = ''; return; }
  const cols = PAD_COL[Pad.state.style] || PAD_COL.xbox, b = Pad.bindings();
  el.innerHTML = ctx.rows.map(([id, text, on]) => `<div class="ph${on ? '' : ' off'}"><i style="--c:${cols[b[id]] ? cols[b[id]] : '#cfd6e6'}">${Pad.label(b[id])}</i><span>${text}</span></div>`).join('')
    + (ctx.flick ? '<div class="ph"><i class="stk">R</i><span>Cruce (flick)</span></div>' : '');
}
/* HUD de varios jugadores: una tarjeta por humano con su color, nombre, energía y barra de tiro (con la línea blanca del tiro perfecto) */
const mp = { el: null, cards: [], barsEl: null };
function buildMpHud() {
  const el = $('mpHud'); if (!el) return; mp.el = el; mp.cards = [];
  const on = humans.length > 1; document.body.classList.toggle('multi', on);
  el.hidden = !on; el.innerHTML = '';
  mp.barsEl = $('mpBars'); if (mp.barsEl) { mp.barsEl.innerHTML = ''; mp.barsEl.hidden = !on; }
  if (!on) return;
  for (const h of humans) {
    const c = document.createElement('div'); c.className = 'mp-card'; c.style.setProperty('--c', h.color);
    c.innerHTML = `<i>${h.name}</i><div class="mp-info"><b></b><div class="mp-bar"><u></u></div></div><em>${h.dev === 'kb' ? '⌨' : h.dev === 'net' ? '🌐' : '🎮'}</em>`;
    el.appendChild(c);
    /* la barra de tiro de este jugador: flota arriba de su cabeza (se mueve con él en pantalla) */
    const fb = document.createElement('div'); fb.className = 'pbar'; fb.style.setProperty('--c', h.color);
    fb.innerHTML = `<span class="pb-tag">${h.name}</span><div class="pb-track"><u></u><s></s></div>`;
    fb.querySelector('s').style.left = `${PERFECT * 100}%`;
    if (mp.barsEl) mp.barsEl.appendChild(fb);
    mp.cards.push({ h, root: c, name: c.querySelector('b'), bar: c.querySelector('.mp-bar u'), fb, fill: fb.querySelector('u'), last: { n: '', w: -1, p: -1, off: null, tm: -1, x: -1, y: -1 } });
  }
}
const _bp = new THREE.Vector3();
function updateMpHud() {
  const hideAll = UI.isMainOpen() || PM.isOpen() || TS.isOpen() || Online.isOpen();
  if (mp.el) mp.el.style.visibility = hideAll ? 'hidden' : '';
  if (mp.barsEl) mp.barsEl.style.visibility = hideAll ? 'hidden' : '';
  for (const m of mp.cards) {
    const h = m.h, a = h.agent, L = m.last; if (!a || !a.info) continue;
    const nm = `#${a.info.number} ${a.info.name.split(' ').slice(-1)[0]}`, w = Math.round(a.stam * 100), ch = a.state === 'charge' ? Math.round(a.charge * 100) : -1, off = !humanActive(h);
    if (L.n !== nm) { L.n = nm; m.name.textContent = nm; }
    if (L.w !== w) { L.w = w; m.bar.style.width = `${w}%`; m.bar.parentNode.classList.toggle('low', a.stam < 0.3); }
    if (L.p !== ch) { L.p = ch; m.fb.classList.toggle('on', ch >= 0); m.fill.style.width = `${Math.max(0, ch)}%`; }
    if (ch >= 0 && !hideAll) {                         // posición en pantalla: arriba del nombre del jugador
      _bp.set(a.pos.x, a.y + 2.42 * (a.scale || 1) + 0.5, a.pos.z).project(camera);
      const vis = _bp.z < 1 && Math.abs(_bp.x) < 1.15 && Math.abs(_bp.y) < 1.15;
      const x = Math.round((_bp.x * 0.5 + 0.5) * innerWidth), y = Math.round((-_bp.y * 0.5 + 0.5) * innerHeight);
      if (L.x !== x || L.y !== y) { L.x = x; L.y = y; m.fb.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
      m.fb.style.visibility = vis ? '' : 'hidden';
    }
    if (L.off !== off) { L.off = off; m.root.classList.toggle('off', off); }
    if (L.tm !== a.team) { L.tm = a.team; m.root.dataset.team = a.team === 0 ? teamA.ab : teamB.ab; }
  }
}
function updateHUD() {
  const many = multi();
  if (many) {
    updateMpHud();
    $('padHud').hidden = true; hud.pad = '__multi';
  } else updatePadHud();
  const a = ctrl, w = Math.round(a.stam * 100);
  if (hud.stam !== w) { hud.stam = w; $('pStamFill').style.width = `${w}%`; $('pStam').classList.toggle('low', a.stam < 0.3); }
  const nm = mode === 'training' ? 'Entrenamiento' : `#${a.info.number} ${a.info.name}`;
  if (hud.name !== nm) { hud.name = nm; $('pName').textContent = nm; }
  humans.forEach((h, i) => {
    const ag = h.agent, ok = mode === 'match' && !dead && !autoUser && (i === 0 || many);
    const t = ok ? bestHumanPass(ag, h) : null, pm = passMarks[i], rg = rings[i];
    if (t && humanActive(h)) { pm.visible = true; pm.position.set(t.pos.x, t.y + 2.75, t.pos.z); pm.rotation.y += 0.08; } else pm.visible = false;
    rg.visible = mode === 'match' && !dead && (i === 0 || many); rg.position.set(ag.pos.x, 0.035, ag.pos.z);
  });
  for (let i = humans.length; i < 4; i++) { passMarks[i].visible = false; rings[i].visible = false; }
}
function padGame(P, dt, h = humans[0]) {                // acciones del joystick (los mismos botones que NBA 2K, remapeables). h = a qué jugador pertenece este joystick
  if (netRole === 'guest') { padGameGuest(P, dt, h); return; }
  const c = h.agent, E = P.pressed, holds = B.holder === c;
  if (E.menu) { openPause(); return; }
  if (E.camera) cycleCamera();
  if (E.shoot && holds) startCharge(c);
  if (P.released.shoot && c.state === 'charge') releaseCharge(c);
  if (E.pass) { if (holds) humanPass(h); else switchPlayer(h); }
  if (E.switch) switchPlayer(h);
  if (E.steal) { if (!startSteal(c) && c.state === 'dribble') startCrossover(c); }
  if (E.dribble) humanCrossover(h);
  if (P.flick && camMode !== 2 && holds) humanCrossover(h);      // flick del stick derecho = cruce (el stick derecho es de la cámara solo en cámara libre)
  if (camMode === 2 && !multi()) {                                 // cámara libre con el stick derecho
    yaw -= P.rx * 3.0 * dt * UI.settings.sens; pitch = clamp(pitch - P.ry * 2.0 * dt * UI.settings.sens, -1.2, 0.6);
  }
  if (P.raw[12]) camDist = clamp(camDist - 3 * dt, 2.2, 9); if (P.raw[13]) camDist = clamp(camDist + 3 * dt, 2.2, 9);   // cruceta ↑↓ = zoom
}
function stepGame(dt) {
  aiPrepare(G); updateControl(dt);
  const act = activeAgents();
  for (const a of act) {                                // quién "defiende": no tiene la pelota y el rival sí
    a.def = mode === 'match' && !!B.holder && B.holder.team !== a.team;
    let I;
    if (isHum(a) && humanActive(a.hum)) I = humanIntent(a, dt);
    else if (mode === 'training') { I = a.intent; I.x = I.z = I.mag = 0; I.sprint = I.jump = I.move = I.dribHold = false; I.sprintAmt = 0; I.face = null; }
    else { aiThink(G, a, dt, a.intent); I = a.intent; }
    if (I.move) startCrossover(a);
    updateAgent(a, dt, I);
  }
  if (mode === 'match') { checkDunkBlocks(); separate(); }
  for (const a of act) pose(a, dt);
  ballLogic(dt);
  for (const t of [0, 1]) for (const b of T[t].bench) b.rest = Math.min(1, (b.rest ?? 1) + dt * 0.055 * recoverMul(b));       // los suplentes descansan
  if (dead) updateDead(dt); else if (mode === 'match') { tickGame(dt); checkPlayerOut(); }
}
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30) || 1 / 60;
  gameTime += dt;
  const PS = Pad.update(dt);
  const own = mode === 'match' && humans.length === 1 && humans[0].dev === 'pad' && humans[0].pad != null && !!navigator.getGamepads?.()[humans[0].pad]?.connected;   // un solo jugador con SU joystick: los otros mandos no lo tocan
  const sep = mode === 'match' && (humans.length > 1 || own);        // varios jugadores: cada joystick lee solo a su dueño
  if (sep) for (const h of humans) if (h.dev === 'pad') { h.P = Pad.readPad(h.pad); h.connected = h.P.connected; }
  if (PM.isOpen()) for (const j of Pad.joinPollAll()) PM.onJoin?.(j);
  if (paused || Pause.isOpen()) { if (Pause.ownsPad()) Pause.onPad(PS); else { if (!PM.onPad(PS) && !UI.onPad(PS)) Pad.menuNav(PS); Pause.onPad(PS); } UT.onPad(PS); Career.onPad(PS); }
  else if (!sep) padGame(PS, dt);
  else for (const h of humans) if (h.dev === 'pad' && h.P?.connected && !paused) padGame(h.P, dt, h);
  if (!paused) { if (netRole === 'guest') viewerStep(dt); else stepGame(dt); }
  if (netRole !== 'guest') updateRef(dt);
  arena.update(dt); Crowd.tick(dt, crowdCtx());
  if (netRole === 'host' && !paused) hostNetTick(dt); else if (netRole === 'guest' && !paused) guestNetTick(dt);
  updateCamera(dt); updateScoreboard(); updateHUD();
  hoops.forEach(h => h.net(dt));
  const padStats = !!PS.down?.stats || humans.some(h => h.dev === 'pad' && h.P?.down?.stats);      // ← de la cruceta (configurable): tabla de puntos mientras se mantiene
  Box.setAllowed(!paused && !Pause.isOpen() && !PM.isOpen() && !UI.isMainOpen() && !TS.isOpen() && !Online.isOpen() && Career.isHidden() && UT.isHidden());
  Box.setHeld('pad', padStats); Box.tick();
  if (!UI.isMainOpen() && !PM.isOpen() && !TS.isOpen() && !Online.isOpen() && UT.isHidden()) renderer.render(scene, camera);   // con el menú previo abierto no hace falta dibujar la cancha de atrás
}
Online.init({ onBack: () => UI.showMain(), onNeedLogin: () => { signOut().then(() => UI.showAuth()); }, onMatchStart: (S, role) => startGame(S, role), onGame: onNetGame, onMatchStop: stopOnlineMatch, onMatchEnded });
PM.init({ onPlay: startGame, onExit: exitToMain, onOnlineChange: p => Online.sendPick(p), onOnlineReady: r => Online.setReady(r), onOnlineStart: () => Online.hostStart(), onOnlineLeave: () => Online.leave() }); bindButtons(); loadSetup(PM.getSetup()); applyTeams(); setMode('match'); agents.forEach(a => a.active && pose(a, 0.016)); frame();
function openCareer() {                                                              // Modo carrera DT: el menú de carrera ocupa la pantalla; los partidos se juegan en 3D y devuelven el resultado
  paused = true;
  Career.open({
    play: S => new Promise(res => { S.career = { done: r => { res(r); } }; startGame(S); }),
    onExit: () => UI.showMain(),
  });
}
function openUltimate() {                                                            // Ultimate Team: cartas, sobres, mercado y partidos 3D con tu plantilla (ultimate/)
  paused = true;
  UT.open({
    baseSetup: () => PM.getSetup(),                                                // dispositivo de control, cámara y estilo que ya elegiste en el casual
    play: S => new Promise(res => { S.career = { done: r => res(r) }; startGame(S).catch(e => { console.error(e); res({ error: e }); }); }),
    onExit: () => UI.showMain(),
  });
}
UI.boot({ onTraining: () => openTrainSetup(false), onCasual: openCasual, onOnline: openOnline, onCareerCoach: openCareer, onUltimate: openUltimate });
Boot.task(PM.ready().catch(() => {}), 'Cargando planteles…', 2);        // pantalla de carga (boot.js): espera también los planteles
Boot.finish();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});
/* para depurar desde la consola del navegador: window.__bb */
globalThis.__bb = { agents, B, T, G, hoops, step: stepGame, get scores() { return [scoreA, scoreB]; }, get dead() { return dead; }, get ctrl() { return ctrl; }, humans, camera, get camMode() { return camMode; }, set autoUser(v) { autoUser = v; },
  get clock() { return [quarter, clockT, shotClock]; }, startGame, startTraining, setDiff: d => { diff = d; }, setQLen: s => { qLen = s; }, get mode() { return mode; }, setCourt: id => setCourt(courtById(id)), get paused() { return paused; }, set paused(v) { paused = v; }, keys, pass: humanPass };
