import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { TEAMS } from './teams.js';
import { buildArena, ARENA } from './arena.js';
import { courtFor, courtById } from './courts.js';
import * as TS from './trainsetup.js';
import * as UI from './ui.js';
import { queueXp, flushXp, signOut } from './auth.js';
import { makeRig, mkJ, applyPose } from './rig.js';
import { fallbackRoster, loadRoster, SKIN_TONES } from './roster.js';
import * as PM from './prematch.js';
import * as Online from './online.js';
import { SnapBuffer, STATES, MODES, SNAP_HZ, r2, r3, lerpAngle } from './netsync.js';
import { nickname, lum, kitById } from './kits.js';
import * as Pad from './gamepad.js';
import * as KB from './keyboard.js';
import * as Pause from './pause.js';
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

const lineMats = [], edgeMats = [];                     // líneas internas y líneas del borde de la cancha (cada cancha define sus colores)
function line(pts, r = 0.025, edge = false) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => V3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(2, pts.length * 3), r, 6, false), mat(0xffffff, 0.6));
  (edge ? edgeMats : lineMats).push(m.material);
  m.position.y = 0.015; scene.add(m);
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
  key.rotation.x = -Math.PI / 2; key.position.set(0, 0.004, s * (COURT_Z - 5.79 / 2)); scene.add(key);
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
  return { s, hz, bz, front, done: false, net: makeNet(hz) };
}
const hoops = [buildHoop(-1), buildHoop(1)];
const hoopFor = sign => hoops[sign < 0 ? 0 : 1];
/* ---- cancha / estadio: cada equipo tiene la suya (courts.js). setCourt cambia parquet, pintura, logo, tribuna, banners y pantallas ---- */
let arena = null, curCourt = '';
function setCourt(def) {
  if (!def || curCourt === def.id) return;
  floorMat.map?.dispose(); floorMat.map = woodTexture(def.floor); floorMat.needsUpdate = true;
  keyMats.forEach(m => { m.color.set(def.paint); m.roughness = def.paintRough ?? 0.5; });
  lineMats.forEach(m => m.color.set(def.lineColor || '#ffffff')); edgeMats.forEach(m => m.color.set(def.edgeColor || def.lineColor || '#ffffff'));
  arena?.dispose(); arena = buildArena(scene, def); curCourt = def.id;
}
setCourt(courtFor('GSW'));                              // arranca en el Chase Center; cada partido / entrenamiento pone la que corresponde

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
const BP = ball.position, BV = V3(), BW = V3();
/* Estado de la pelota: quién la tiene y en qué fase está.
   mode: 'held' (en manos de B.holder) · 'shot' (tiro en el aire) · 'pass' (pase en el aire) · 'loose' (suelta / rebote) · 'dead' (pelota muerta, árbitro) */
const B = { holder: null, mode: 'loose', possTeam: 0, lastTeam: 0, lastTouch: null, shooter: null, shotHoop: null, shotId: 0, shotDist: 0, shotThree: false, passer: null, target: null, rolled: new Set(), noPick: { a: null, t: 0 }, passT: 0, bp: BP, bv: BV };

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
    D: { mode: 'dunk2', t: 0, H: hoops[0], pw: V3(), corr: V3(), p0: V3(), TF: 0.84, JH: 1.2, rel: 0.52, rd: false, cap: false, scored: false, miss: false },
    act: null, actT: 0, stealDone: false, reachT: 0, reachCount: 0, fouls: 0, stunT: 0, stam: 1, tired: false, side: 1, crossT: 0, moveCd: 0, autoCross: 0, dribMode: false, def: false,
    intent: { x: 0, z: 0, mag: 0, sprint: false, sprintAmt: 0, jump: false, move: false, dribHold: false, face: null },
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
const BUILD = { PG: 0.94, SG: 0.98, SF: 1.0, PF: 1.06, C: 1.11 };   // contextura según la posición
function buildFor(info) {                                  // contextura: con peso real sale del IMC; si no, de la posición
  if (!info.weightLb) return BUILD[info.pos] ?? 1;
  const kg = info.weightLb * 0.4536, m = info.height / 100, bmi = kg / (m * m);
  return clamp(1 + (bmi - 24.5) * 0.04, 0.9, 1.14);
}
function setInfo(a, info) {
  a.info = info; a.R.setSkin(SKIN_TONES[info.skin] ?? SKIN); a.R.setLook(info.name || info.id); a.R.setBuild(buildFor(info)); a.R.setUniformInfo?.(info);
  a.scale = clamp(info.height / 198, 0.93, 1.08); a.R.root.scale.setScalar(a.scale);
  a.spdMul = 0.93 + clamp((info.speed - 60) * 0.0035, -0.05, 0.14);
  drawLabel(a);
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
function scoreFor(H, pts) {
  if (dead) { if (dead.ftLive && dead.ftStage === 'flight' && !dead.ftScored) ftMade(H); return; }
  if (mode === 'training') { trainScore(H, pts); return; }
  const team = attSign[0] === H.s ? 0 : 1, ab = (team === 0 ? teamA : teamB).ab;
  H.done = true; if (team === 0) scoreA += pts; else scoreB += pts;
  arena.cheer(team === 0 ? 3.2 : 1.6); for (const h of humansOn(team)) rumbleH(h, 160, 0.5);
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
  camMode = tr ? 2 : 0; showCamName();
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
  const p = [...ros.starters, ...ros.bench].find(x => x.id === cfg.player) || ros.starters[0];
  setMode('training'); setCourt(courtById(cfg.court));
  const a = agents[0];
  if (cfg.kit === 'team') {                              // con la camiseta de su equipo (nombre y número del jugador)
    const k = kitById(team, 'icon');
    a.R.setUniformStyle?.({ jersey: k.jersey, shorts: k.shorts, accent: k.accent, trim: k.trim, details: k.details, word: nickname(team), ink: inkOf(k), decals: true }); a.R.shoeM.color.set(k.shoes);
  } else applyTrainingLook();                            // remera blanca lisa
  setInfo(a, { ...p }); a.stam = 1; a.tired = false;
  setupHumans(null, a); B.holder = null; B.mode = 'loose';
  Object.assign(stats, { shots: 0, makes: 0, streak: 0, best: 0, xp: 0 }); pendingShot = false; updateTrainHUD();
  resetTraining(); PM.closeWizard(); paused = false;
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
  canOpen: () => !paused && !PM.isOpen() && !UI.isMainOpen() && !Online.isOpen(),
  isTraining: () => mode === 'training', info: pauseInfo,
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
async function startGame(S0 = null, role = null) {        // role: null = partido normal · 'host' / 'guest' = partido online
  try { await PM.ready(); } catch { /* planteles genéricos */ }
  const S = S0 || PM.getSetup();
  netRole = role; resetNet();
  if (role) net.pool = new Map([...S.lineupA.starters, ...S.lineupA.bench, ...S.lineupB.starters, ...S.lineupB.bench].map(p => [infoKey(p), p]));
  loadSetup(S);
  if (role === 'guest') { const L = PM.getSetup(); camHeight = L.camHeight || 0; S.cam = L.cam; }      // la cámara es de cada uno, no del anfitrión
  opts.styleB = role ? (S.styleB || null) : null; styleKeyB = JSON.stringify(S.styleB || '');
  setCourt(courtFor(S.courtTeam));                      // cancha del local o del visitante, según el menú del partido
  setMode('match'); applyTeams(); applyRosters(S.lineupA, S.lineupB);
  scoreA = scoreB = 0; quarter = 1; teamFouls[0] = teamFouls[1] = 0; B.foulPending = null; for (const t of [0, 1]) [...T[t].court.map(a => a.info), ...T[t].bench].forEach(i => { i.pf = 0; }); clockT = qLen; attSign = [-1, 1]; shotClock = 24; B.possTeam = 0; B.lastTeam = 0;
  for (const a of agents) { a.stam = 1; a.tired = false; a.act = null; a.stunT = 0; a.state = 'free'; a.ai = newAIState(); a.pos.set((a.slot - 2) * 2, 0, a.team === 0 ? -4 : 4); }
  B.holder = null; B.mode = 'dead'; autoUser = false; dead = null;
  if (role === 'guest') setupGuestHumans(S);
  else {
    if (role === 'host') S.humans = [{ dev: S.humans[0].dev, pad: S.humans[0].pad, team: 0 }, { dev: 'net', team: 1 }];     // el invitado es el segundo humano: sus controles llegan por la red
    setupHumans(S);
  }
  if (role) PM.hideForMatch(); else PM.closeWizard();
  paused = false; shotCounter = 0;
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
  if (!opts.shotClock) shotClock = 24;                              // reloj de 24 s apagado: nunca vence
  if (B.holder || B.mode === 'pass') shotClock -= dt;                // el reloj de 24 s se frena con la pelota en el aire / en rebote
  if (shotClock <= 0 && B.holder) { say('Violación de 24 segundos'); startDead('violation', B.holder.pos.x, B.holder.pos.z, null, 1 - B.holder.team); return; }
  if (clockT <= 0) {
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
  if (act === 'reset') { if (mode === 'training') resetTraining(); return; }
  if (act === 'camera') { cycleCamera(); return; }
  const c = h?.agent; if (!c) return;
  if (act === 'shoot') { startCharge(c); return; }
  if (act === 'pass') humanPass(h);
  else if (act === 'steal') { if (!startSteal(c) && c.state === 'dribble') startCrossover(c); }
  else if (act === 'switch') switchPlayer(h);
  else if (act === 'dribble') humanCrossover(h);
}
function releaseAction(act, h = kbHuman()) { if (netRole === 'guest') { guestRelease(act, h); return; } const c = h?.agent; if (act === 'shoot' && c?.state === 'charge') releaseCharge(c); }
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
  if (!paused) for (const act of acts) releaseAction(act);
});
addEventListener('blur', () => KB.releaseAll());
addEventListener('gamepaddisconnected', e => {            // se desconectó el joystick de un jugador: se pausa y su jugador lo maneja la IA hasta que vuelva
  const h = humans.find(x => x.dev === 'pad' && x.pad === e.gamepad.index);
  if (h && multi()) { h.connected = false; say(`Se desconectó el joystick de ${h.name}. Volvé a conectarlo y apretá un botón.`); if (!paused) openPause(); }
});
addEventListener('gamepadconnected', e => {               // si vuelve (con otro número), lo reasignamos al jugador que se quedó sin joystick
  if (humans.some(x => x.dev === 'pad' && x.pad === e.gamepad.index)) return;
  const h = humans.find(x => x.dev === 'pad' && !(navigator.getGamepads?.()[x.pad]?.connected));
  if (h && multi()) { h.pad = e.gamepad.index; h.connected = true; say(`Joystick de ${h.name} reconectado.`); }
});
addEventListener('beforeunload', e => { if (!paused && mode === 'match') { e.preventDefault(); e.returnValue = ''; } });   // por si Ctrl+W te cierra la pestaña sin querer
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
  if (humans.length === 1) return { kb: true, P: Pad.state };          // jugando solo: sirve el teclado y también cualquier joystick que toques
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
function humanPass(h = humans[0]) { if (autoUser || dead || mode !== 'match' || !h) return; const t = bestHumanPass(h.agent, h); if (t) doPass(h.agent, t); }
function humanCrossover(h = humans[0]) { if (!autoUser && !dead && h) startCrossover(h.agent); }
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
function humanIntent(a) {
  const h = a.hum, inp = inputOf(h), I = a.intent, w = dead ? null : humanDir(h);
  I.x = w ? w.x : 0; I.z = w ? w.z : 0; I.mag = w ? 1 : 0; I.face = null; I.move = false;
  const P = inp.P || NO_PAD, pd = dead ? {} : P.down, kd = dead || !inp.kb ? (() => false) : KB.down;
  const keySprint = kd('sprint'), padSprint = dead ? 0 : P.amt.sprint;           // gatillo analógico: apretado a medias = trote, a fondo = sprint
  I.sprintAmt = keySprint ? 1 : padSprint;
  I.sprint = keySprint || !!pd.sprint;
  I.jump = kd('jump') || !!pd.jump || (!!pd.shoot && B.holder !== a);      // como en NBA 2K: sin la pelota, el botón de tiro salta / tapona / rebota
  I.dribHold = kd('dribble') || !!pd.dribble;
  const keyMove = kd('up') || kd('down') || kd('left') || kd('right');
  I.analog = (!dead && P.mag > 0 && !keyMove && !I.sprint) ? P.mag : 1;   // inclinación del stick = velocidad
  return I;
}
const NO_PAD = { mag: 0, lx: 0, ly: 0, down: {}, amt: { sprint: 0 } };

/* ============ Acciones de jugadores (las usan el humano y los bots) ============ */
const _tv = V3(), _dv = V3(), _hp = V3();
function startCharge(a) {
  if (a.state !== 'dribble' || B.holder !== a || !a.grounded || (dead && !(dead.ftStage === 'aim' && dead.ftShooter === a)) || inbound || a.act) return false;
  a.aimHoop = mode === 'training' ? facingHoop(a) : attackHoop(a.team);
  a.state = 'charge'; a.charge = 0; a.chargeDir = 1; a.side = 1; a.shotId = ++shotCounter; return true;
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
  return best;
}
function aiShoot(a) {                                  // el bot decide tirar: la calidad del tiro define si el "disparo" sale perfecto o errado
  if (!startCharge(a)) return false;
  const q = shotQuality(G, a, a.pos.x, a.pos.z), pr = prof(a), cst = contestOf(a);
  const p = clamp(q * pr.acc * (1 - cst * 0.3) * (a.tired ? 0.85 : 1), 0.03, 0.9);
  a.charge = Math.random() < p ? PERFECT + (Math.random() - 0.5) * 0.05 : PERFECT + (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.14);
  releaseCharge(a); return true;
}
function startDunk(a, H, dmode) {
  const L = dmode === 'layup', D = a.D;
  Object.assign(D, { mode: dmode, H, t: 0, rd: false, cap: false, scored: false, TF: L ? 0.66 : 0.84, JH: L ? 0.6 : 1.2, rel: L ? 0.30 : 0.52 });
  D.corr.set(0, 0, 0); D.pw.copy(a.pos); a.state = 'dunk'; a.shotId = ++shotCounter; a.side = 1;
  const cst = contestOf({ ...a, aimHoop: H, pos: a.pos, team: a.team });
  D.miss = L && Math.random() < (isHum(a) ? cst * 0.4 : clamp(0.28 - (a.info.layup - 70) * 0.004 - (prof(a).acc - 1) * 0.2 + cst * 0.4, 0.04, 0.7));
  hoops.forEach(h => h.done = false); if (a === ctrl) attempt();
  if (!L) rollShootingFoul(a, 'dunk', false, H);
}
function updateDunk(a, dt) {
  const D = a.D; D.t += dt;
  const H = D.H, L = D.mode === 'layup';
  a.h += clamp(wrap(Math.atan2(-a.pos.x, H.hz - a.pos.z) - a.h), -16 * dt, 16 * dt);
  if (D.t < TW) { a.pos.addScaledVector(a.vel, dt); a.vel.multiplyScalar(Math.exp(-3 * dt)); D.pw.copy(a.pos); return; }
  const tf = D.t - TW, u = Math.min(tf / (D.TF / 2), 1);
  _dv.set(D.pw.x, 0, D.pw.z - H.hz).normalize();                    // hacia dónde está el jugador respecto al aro
  _tv.set(0, 0, H.hz).addScaledVector(_dv, L ? 0.75 : 0.35).add(D.corr);   // mate: la mano queda sobre el aro; bandeja: un poco antes
  const p = lerp(u, smooth(u), 0.5);
  a.pos.set(lerp(D.pw.x, _tv.x, p), 0, lerp(D.pw.z, _tv.z, p));
  const u2 = tf / D.TF; a.y = D.JH * 4 * u2 * (1 - u2); a.grounded = false;
  if (!L && tf > 0.2 && tf < 0.45) {                                // corrige la posición para que la mano quede justo sobre el aro
    _hp.setFromMatrixPosition(a.R.hR.matrixWorld); D.corr.x += (0 - _hp.x) * 0.25; D.corr.z += (H.hz - _hp.z) * 0.25;
  }
  if (tf >= D.TF) { a.y = 0; a.vy = 0; a.grounded = true; a.landC = 0.6; a.vel.set(0, 0, 0); a.state = 'free'; }
}
function tryDunk(a) {
  if (a.state !== 'dribble' || B.holder !== a || !a.grounded || dead) return false;
  const sp = Math.hypot(a.vel.x, a.vel.z); let best = null;
  for (const H of (mode === 'training' ? hoops : [attackHoop(a.team)])) {
    _dv.set(-a.pos.x, 0, H.hz - a.pos.z); const d = _dv.length(); if (d < 0.5) continue;
    _dv.divideScalar(d);
    if (_dv.x * Math.sin(a.h) + _dv.z * Math.cos(a.h) > 0.6 && d <= 4.0 && (!best || d < best.d)) best = { H, d };
  }
  if (!best) return false;
  if (sp >= 4.8 && best.d >= 1.6) { startDunk(a, best.H, Math.random() < 0.5 ? 'dunk2' : 'dunk1'); return true; }
  if (best.d <= 3.0 && (sp >= 1.5 || best.d <= 2.2)) { startDunk(a, best.H, 'layup'); return true; }
  return false;
}

/* ---- pase ---- */
function doPass(a, t) {
  if (!a || !t || B.holder !== a || a.state !== 'dribble' || dead || a.act) return false;
  const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
  a.h = Math.atan2(dx, dz);
  const from = V3(a.pos.x + dx / d * 0.45, 1.3, a.pos.z + dz / d * 0.45);
  const spd = 13 + Math.min(d, 20) * 0.35, tf = Math.max(0.12, d / spd);
  const aim = V3(t.pos.x + t.vel.x * tf * 0.8, 1.3, t.pos.z + t.vel.z * tf * 0.8);
  const tf2 = Math.max(0.12, Math.hypot(aim.x - from.x, aim.z - from.z) / spd);
  const v = V3((aim.x - from.x) / tf2, (aim.y - from.y) / tf2 + 0.5 * G9 * tf2, (aim.z - from.z) / tf2).multiplyScalar(1);
  v.x *= 1.1; v.z *= 1.1;                                              // compensa el arrastre del aire en pases largos
  const err = (0.012 + (100 - a.info.passAcc) * 0.0006) * prof(a).passErr * (1 + (a.tired ? 0.8 : 0)) * (isHum(a) ? 0.7 : 1);
  v.applyAxisAngle(UP, gauss() * err); v.multiplyScalar(1 + gauss() * err * 0.5);
  a.act = 'pass'; a.actT = 0.32; a.state = 'free';
  B.holder = null; B.mode = 'pass'; B.passer = a; B.target = t; B.rolled = new Set(); B.passT = 0; B.noPick = { a, t: 0.2 }; B.lastTeam = a.team; B.lastTouch = a;
  BP.copy(from); BV.copy(v); BW.set(0, 0, 0); inbound = false;
  if (isHum(a) && autoFollow(a.team)) { takeAgent(a.hum, t); a.hum && (a.hum.lock = 0); }   // con un solo humano en el equipo, el control viaja con la pelota
  return true;
}

/* ---- dribleo (Ctrl): cruce de mano, cuesta energía; cansado no se puede ---- */
function startCrossover(a) {
  if (a.state !== 'dribble' || B.holder !== a || !a.grounded || a.moveCd > 0) return false;
  if (a.tired || a.stam < 0.1) { if (isHum(a)) say('¡Cansado! No podés driblear así: frená un poco para recuperar energía.'); return false; }
  a.side *= -1; a.crossT = 0.35; a.moveCd = 0.4; a.stam = Math.max(0, a.stam - 0.045);
  const fx = Math.sin(a.h), fz = Math.cos(a.h);
  for (const d of T[1 - a.team].court) {                // un cruce puede dejar sentado al defensor
    if (!d.active || !d.grounded || d.stunT > 0) continue;
    const dx = d.pos.x - a.pos.x, dz = d.pos.z - a.pos.z, dd = Math.hypot(dx, dz);
    if (dd < 1.7 && dd > 0.1 && (dx * fx + dz * fz) / dd > 0.3) {
      const p = clamp(0.28 + (a.info.handle - d.info.perD) / 120 - (oppTeam(d.team) ? (prof(d).tight - 0.5) * 0.2 : 0), 0.08, 0.6);
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
  let p = 0.30 + (a.info.steal - h.info.handle) * 0.004 + (oppTeam(a.team) ? prof(a).stealSucc : 0);
  if (h.state === 'dribble') { p += BP.y < 0.75 ? 0.12 : -0.08; if (h.crossT > 0 || h.dribMode) p -= 0.12; } else p *= 0.5;
  if (h.stam < 0.25) p += 0.12; if (a.stam < 0.2) p -= 0.1; if (h.stunT > 0) p += 0.15;
  if (oppTeam(h.team)) p *= prof(h).protect > 1 ? 1 / prof(h).protect : 2 - prof(h).protect;
  p = clamp(p, 0.04, 0.8);
  if (Math.random() < p) {
    const clean = Math.random() < 0.55;
    if (clean) { say(`¡Robo de ${a.info.name.split(' ').slice(-1)[0]}!`); B.holder = null; B.mode = 'loose'; giveBall(a, 'steal'); }
    else {
      say('¡Pelota suelta!'); B.holder = null; B.mode = 'loose'; h.state = 'free'; h.act = null; h.stunT = 0.4;
      BV.set(Math.sin(a.h) * 3.2 + (Math.random() - 0.5), 2.2, Math.cos(a.h) * 3.2 + (Math.random() - 0.5)); B.noPick = { a: h, t: 0.35 }; B.lastTeam = h.team;
    }
    arena.cheer(a.team === userTeam ? 1.2 : 0.5);
  } else a.stunT = 0.55;                                // robo fallido: queda fuera de posición un instante
}
function startBlock(a) {
  if (!a.grounded || a.act || a.stunT > 0 || (a.state !== 'free' && a.state !== 'dribble')) return false;
  a.act = 'block'; a.actT = 0.95; a.vy = 4.7; a.grounded = false; a.jumpWind = 0; return true;
}

/* ============ Física del jugador (la misma para vos y para los bots) ============ */
function fatigue(a) { return a.stam >= 0.45 ? 1 : 0.8 + 0.2 * smooth(a.stam / 0.45); }
function updateAgent(a, dt, I) {
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
  if (a.dribMode) { a.autoCross -= dt; if (a.autoCross <= 0) { a.autoCross = 0.55; startCrossover(a); } a.stam = Math.max(0, a.stam - 0.03 * dt * prof(a).stamina); }
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
    const rate = (a.vel.dot(wish) < -0.5 ? 26 : 14) * (a.grounded ? 1 : 0.12) * (a.dribMode || a.crossT > 0 ? 1.4 : 1) * (a.stunT > 0 ? 0.5 : 1);
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
  const sp = Math.hypot(a.vel.x, a.vel.z), sm = prof(a).stamina;
  if (!dead) {
    if (sp > 5.2 && I.sprint) a.stam -= 0.075 * dt * sm; else if (sp > 2.0) a.stam -= 0.014 * dt * sm; else if (sp < 1) a.stam += 0.04 * dt;
  } else a.stam += 0.10 * dt;
  a.stam = clamp(a.stam, 0, 1);
  if (!opts.fatigue) { a.stam = 1; a.tired = false; }                // cansancio apagado
  if (!a.tired && a.stam < 0.08) { a.tired = true; if (isHum(a) && a.hum.dev !== 'net') say('¡Estás cansado! Frená un momento para recuperar energía.'); }
  else if (a.tired && a.stam > 0.3) a.tired = false;

  let want = null, rate = 0;
  if (a.state === 'charge' || a.state === 'shoot') { want = Math.atan2(-a.pos.x, a.aimHoop.hz - a.pos.z); rate = 16; }
  else if (I.face != null && a.grounded) { want = I.face; rate = 10; }
  else if (sp > 0.6) { want = Math.atan2(a.vel.x, a.vel.z); rate = Math.max(6, 15 - 1.2 * sp); }
  else if (!human && B.holder && B.holder !== a && !dead) { want = Math.atan2(BP.x - a.pos.x, BP.z - a.pos.z); rate = 6; }
  if (want !== null) a.h += clamp(wrap(want - a.h), -rate * dt, rate * dt);

  if (I.jump && !dead && !(human && inbound) && a.grounded && a.jumpWind <= 0 && !a.act && (a.state === 'dribble' || a.state === 'free')) {
    if (a.state === 'dribble' && tryDunk(a)) return;
    const h = B.holder;
    if (a.state === 'free' && a.def && h && Math.hypot(h.pos.x - a.pos.x, h.pos.z - a.pos.z) < 3.4) startBlock(a); else a.jumpWind = 0.11;
  }
  if (a.jumpWind > 0) { a.jumpWind -= dt; if (a.jumpWind <= 0) { a.vy = 4.2; a.grounded = false; } }
  if (a.state === 'charge') {
    a.charge += a.chargeDir * CHARGE_SPEED * dt;
    if (a.charge >= 1) { a.charge = 1; a.chargeDir = -1; } if (a.charge <= 0) { a.charge = 0; a.chargeDir = 1; }
    if (a === ctrl) updatePowerUI();
  }
  if (a.state === 'shoot') {
    a.shootT += dt;
    if (!a.launched && a.shootT >= T_LAUNCH) { a.launched = true; if (a.grounded && !a.ftShot) { a.vy = JUMP_SHOT; a.grounded = false; } }
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

/* ============ Animación procedural ============ */
function pose(a, dt) {
  const R = a.R, J = a.J;
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
    if (a.side > 0) { T.shR = sh; T.elR = el; T.szR = -0.18; T.wR = Math.PI; T.cR = 0.35; T.sR = 0.25; T.shL = -0.35 + s * Aa * 0.3; T.elL = -1.0; T.szL = 0.2; }
    else { T.shL = sh; T.elL = el; T.szL = 0.18; T.wL = Math.PI; T.cL = 0.35; T.sL = 0.25; T.shR = -0.35 - s * Aa * 0.3; T.elR = -1.0; T.szR = -0.2; }
    cr += 0.1 * hard + (a.crossT > 0 ? 0.12 : 0);
    if (B.holder === a && !a.act) {                                   // IK: hombro y codo apuntan a la pelota real (así nunca se ve "despegada")
      const right = a.side > 0, S = right ? R.shR : R.shL;
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
  if (st === 'dunk') {                 // mates (2 variantes) y bandeja
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
  if (a.act === 'pass') {              // pase de pecho: los dos brazos salen disparados hacia adelante
    const u = smooth(1 - a.actT / 0.32);
    T.shL = T.shR = lerp(-0.9, -1.5, u); T.elL = T.elR = lerp(-1.8, -0.12, u); T.szL = 0.12; T.szR = -0.12; T.wL = T.wR = Math.PI; T.cL = T.cR = 0.25; T.sL = T.sR = 0.3;
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
    if (a.act === 'block' || a.def) { T.shL = T.shR = -2.85; T.elL = T.elR = -0.05; T.szL = 0.14; T.szR = -0.14; T.wL = T.wR = Math.PI; T.cL = T.cR = 0.15; T.sL = T.sR = 0.35; }   // tapón: brazos bien arriba
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
  T.tx = 0.1 + run * 0.22 + cr * 0.35 + clamp(a.acc.dot(fwdV) * 0.012, -0.15, 0.25) - (st === 'dunk' && a.D.t > TW ? 0.2 : 0) + (a.act === 'steal' ? 0.25 : 0);
  T.tz = clamp(a.acc.dot(rgtV) * 0.012, -0.2, 0.2) + c * 0.04 * run * mv;   // los hombros compensan la inclinación de la cadera
  T.ty = s * 0.20 * run; T.py = -s * 0.06 * run;                       // hombros y pelvis giran en sentidos opuestos (como al correr de verdad)
  T.pz = -c * 0.04 * run * mv;                                         // la cadera del lado de la pierna que avanza baja un poco
  T.gr = a.grounded ? 1 : 0;                                           // en el aire no se fuerza el contacto de los pies con el piso
  T.hx = -T.tx * 0.8 - (st === 'shoot' || st === 'charge' ? 0.25 : 0);
  {                                                                    // la cabeza mira al aro si tiene la pelota y a la pelota si no
    const tgt = B.holder === a ? attackHoop(a.team) : null, lx = tgt ? 0 : BP.x, lz = tgt ? tgt.hz : BP.z;
    const want = wrap(Math.atan2(lx - a.pos.x, lz - a.pos.z) - a.h);
    T.hyaw = clamp(want, -1.0, 1.0) * 0.7;
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
    if (B.mode === 'pass') B.mode = 'loose';                       // pase malo: bota y queda suelta
    if (Math.abs(BV.y) < 0.3) {
      const sp = Math.hypot(BV.x, BV.z), d = Math.min(sp, 0.4 * h);
      if (sp > 1e-4) { BV.x *= (sp - d) / sp; BV.z *= (sp - d) / sp; } BW.multiplyScalar(1 - 0.4 * h);
    }
  }
  if (B.mode === 'shot') {                                         // tapones: un defensor con los brazos arriba desvía el tiro
    for (const d of agents) {
      if (!d.active || d.team === (B.shooter?.team ?? -1) || d.act !== 'block') continue;     // solo tapa el que salta con los brazos arriba
      const top = d.y + 2.5 * d.scale, rad = 0.4;
      _c.set(d.pos.x + Math.sin(d.h) * 0.15, clamp(BP.y, d.y + 0.5, top), d.pos.z + Math.cos(d.h) * 0.15); _t.copy(BP).sub(_c);
      const dd = _t.length(), m = BR + rad;
      if (dd < m && dd > 1e-6) {
        _t.multiplyScalar(1 / dd); BP.copy(_c).addScaledVector(_t, m); contact(_t, 0.5, 0.4);
        BV.y = Math.min(BV.y, 1.5); BV.addScaledVector(_t, 3);
        B.mode = 'loose'; B.lastTeam = d.team; B.lastTouch = d; say(`¡TAPÓN de ${d.info.name.split(' ').slice(-1)[0]}!`); arena.cheer(d.team === userTeam ? 2.2 : 0.8);
        hoops.forEach(hh => hh.done = hh.done && false);
        break;
      }
    }
  }
  for (const H of hoops) {
    const n = _p.set(0, 0, -H.s), dn = (BP.z - H.front) * -H.s;
    if (dn < BR && dn > -0.15 && Math.abs(BP.x) < 0.95 && BP.y > 2.85 && BP.y < 4.02) { BP.z = H.front - H.s * BR; contact(n, 0.62, 0.45); if (B.mode === 'shot') B.mode = 'loose'; }
    const dx = BP.x, dz = BP.z - H.hz, rad = Math.hypot(dx, dz);
    if (rad > 1e-6 && rad < 0.7 && Math.abs(BP.y - RIM_Y) < 0.3) {
      _c.set(dx * RIM_C / rad, RIM_Y, H.hz + dz * RIM_C / rad);
      _t.copy(BP).sub(_c); const d = _t.length(), m = BR + RIM_TUBE;
      if (d < m && d > 1e-6) { _t.multiplyScalar(1 / d); BP.copy(_c).addScaledVector(_t, m); contact(_t, 0.6, 0.35); if (B.mode === 'shot') B.mode = 'loose'; }
    }
    if (!H.done && prevY > RIM_Y && BP.y <= RIM_Y && rad < RIM_IN - 0.005 && (B.mode === 'shot' || B.mode === 'loose' || mode === 'training')) scoreFor(H, B.shotThree ? 3 : 2);
    if (rad < 0.25 && BP.y < RIM_Y + 0.02 && BP.y > RIM_Y - 0.45) BV.multiplyScalar(1 - 6 * h);
  }
}

function solveShot(p0, target, dir, dist, thOver) {   // resuelve la velocidad inicial simulando la misma física
  const hd = target.y - p0.y;
  let th = thOver || (dist < 3.2 ? 1.15 : dist < 6.5 ? 0.95 : 0.85);
  while (dist * Math.tan(th) - hd <= 0.05) th += 0.05;
  let sp = Math.sqrt(G9 * dist * dist / (2 * Math.cos(th) ** 2 * (dist * Math.tan(th) - hd)));
  const w = dir.clone().cross(UP).multiplyScalar(18), p = V3(), v = V3(), a = V3();
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
}
function releaseBall(a) {
  a.released = true; hoops.forEach(h => h.done = false); if (a === ctrl) attempt();
  const H = a.aimHoop, target = V3(0, RIM_Y, H.hz), dir = V3(target.x - BP.x, 0, target.z - BP.z);
  const dist = dir.length(); dir.normalize();
  const v = solveShot(BP, target, dir, dist);
  const ch = a.charge, q = Math.abs(ch - PERFECT), perfect = q <= 0.035;
  if (!perfect) v.multiplyScalar(1 + (ch - PERFECT) * 0.28);
  const human = isHum(a), cst = human && !a.ftShot ? contestOf(a) * (a.tired ? 1.3 : 1) : 0;   // al humano lo marcan de verdad; el bot ya lo tiene en su probabilidad
  v.applyAxisAngle(UP, gauss() * (perfect ? 0.0012 : 0.004 + q * 0.1) + gauss() * dist * 0.0002 + gauss() * cst * 0.012);
  if (cst > 0) v.multiplyScalar(1 + gauss() * cst * 0.03);
  if (a.ftShot) v.applyAxisAngle(UP, gauss() * (0.9 - clamp((a.info.ft ?? 70) / 100, 0, 0.9)) * 0.006);   // en los libres el rating de tiro libre pesa un poco
  BV.copy(v); BW.copy(dir.cross(UP).multiplyScalar(18));
  launchFromHolder(a, H, dist, Math.hypot(a.pos.x, H.hz - a.pos.z) > 7.24 || Math.abs(a.pos.x) >= 6.7);      // triple: con los pies detrás del arco o en la esquina
  if (!a.ftShot) rollShootingFoul(a, 'jump', B.shotThree, H);
  if (human) say(perfect ? '¡Liberación perfecta!' : ch < PERFECT ? 'Soltaste temprano: tiro corto.' : 'Soltaste tarde: tiro largo.');
}
function releaseLayup(a) {             // bandeja suave: arco alto y casi siempre buena (si no te marcan)
  const D = a.D, c = V3(0, RIM_Y, D.H.hz), dir = V3(c.x - BP.x, 0, c.z - BP.z), dist = Math.max(dir.length(), 0.3);
  dir.normalize();
  const v = solveShot(BP, c, dir, dist, 1.25);
  v.applyAxisAngle(UP, gauss() * 0.01).multiplyScalar(1 + gauss() * 0.012);
  if (D.miss) { v.applyAxisAngle(UP, gauss() * 0.07); v.multiplyScalar(1 + (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.07)); }
  BV.copy(v); BW.copy(dir.cross(UP).multiplyScalar(10)); D.rd = true;
  launchFromHolder(a, D.H, dist);
  rollShootingFoul(a, 'layup', false, D.H);
}

const _hl = V3(), _he = V3();
function holdBall(a, dt) {             // la pelota se apoya en la palma de la mano (cinemática)
  const right = a.side > 0 || a.state !== 'dribble';
  const hand = right ? a.R.hR : a.R.hL, el = right ? a.R.elR : a.R.elL;
  _hl.setFromMatrixPosition(hand.matrixWorld); _he.setFromMatrixPosition(el.matrixWorld);
  _hl.addScaledVector(_he.sub(_hl).normalize(), -0.175);
  if (dt) BP.lerp(_hl, 1 - Math.exp(-30 * dt)); else BP.copy(_hl);
  BV.set(0, 0, 0); BW.set(0, 0, 0);
}
function dunkBall(a, dt) {
  const D = a.D, tf = D.t - TW;
  if (D.rd) return;
  if (D.mode === 'layup') { holdBall(a, dt); if (tf >= D.rel) releaseLayup(a); return; }
  if (tf < 0.40) { holdBall(a, dt); return; }
  if (!D.cap) { D.cap = true; D.p0.copy(BP); }
  const k = smooth((tf - 0.40) / 0.12), kx = smooth((tf - 0.40) / 0.06);   // la pelota baja por el centro del aro
  BP.set(lerp(D.p0.x, 0, kx), lerp(D.p0.y, 2.78, k), lerp(D.p0.z, D.H.hz, kx));
  if (!D.scored && BP.y <= RIM_Y) { D.scored = true; B.shotDist = 1; B.shotThree = false; scoreFor(D.H, 2); say('¡MATE!'); }
  if (tf >= 0.52) { D.rd = true; BV.set(0, -5, 0); BW.set(0, 0, 0); launchFromHolder(a, D.H, 1); }
}
function dribbleControl(a) {
  // La pelota rebota a una distancia que el brazo SIEMPRE alcanza: crece un poco con la velocidad pero con tope.
  // (Antes se sumaba vel*0.16 al objetivo: a 6.6 m/s la pelota quedaba a ~1.5 m del cuerpo, fuera del alcance de la mano.)
  const sc = a.scale, fx = Math.sin(a.h), fz = Math.cos(a.h), rx = -Math.cos(a.h), rz = Math.sin(a.h);
  const sp = Math.hypot(a.vel.x, a.vel.z), hard = a.dribMode, lat = (0.24 + 0.04 * Math.min(1, sp / 6)) * a.side;
  const fwd = Math.min(0.34 + 0.05 * sp + (hard ? 0.03 : 0), 0.62);
  const tx = a.pos.x + fx * fwd * sc + rx * lat * sc, tz = a.pos.z + fz * fwd * sc + rz * lat * sc;
  const g = a.crossT > 0 ? 22 : 18; let ex = (tx - BP.x) * g, ez = (tz - BP.z) * g; const el = Math.hypot(ex, ez);
  if (el > 9) { ex *= 9 / el; ez *= 9 / el; }                          // la corrección hacia la mano tiene tope (si no, la pelota sale disparada)
  BV.x = a.vel.x + ex; BV.z = a.vel.z + ez;
  if (BP.y > 1.08 && BV.y > -0.5) BV.y = hard ? -4.4 : -3.3;
  else if (BP.y < 0.3 && Math.abs(BV.y) < 0.8) BV.y = hard ? 5.6 : 4.6;
}
function giveBall(a, how) {            // alguien agarra la pelota
  const was = B.mode;
  B.holder = a; B.mode = 'held'; B.lastTeam = a.team; B.lastTouch = a; B.passer = null; B.target = null; B.shooter = null;
  a.state = 'dribble'; a.charge = 0; a.released = false; a.launched = false; a.act = null; a.ai.holdT = 0; a.ai.plan = 'drive'; a.ai.think = 0.15; a.ai.inb = false;
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
    } else sc = 1 / (d + 0.15) + Math.random() * 0.6 + (a.info.rebound - 70) * 0.01;
    if (sc > bs) { bs = sc; best = a; }
  }
  if (best) giveBall(best, B.mode === 'pass' ? (best === B.target ? 'pass' : 'steal') : 'rebound');
}
function ballLogic(dt) {
  if (dead && dead.phase >= 1 && !dead.ftLive) return;                 // el árbitro tiene la pelota
  B.noPick.t = Math.max(0, B.noPick.t - dt); B.passT += dt;
  const hd = B.holder;
  if (hd) {
    if (hd.state === 'dunk') { dunkBall(hd, dt); if (!hd.D.rd) return; }
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
    else if (!resolvePending(false)) startDead('out', BP.x, BP.z, 'Pelota afuera', 1 - B.lastTeam);
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
  B.foulPending = null;
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
  if (holds && h.grounded && outsideLines(h.pos.x, h.pos.z, 0.1)) startDead('out', h.pos.x, h.pos.z, '¡Saliste de la cancha con la pelota!', 1 - h.team);
}
function handTarget(a, out) {
  const p = _hp0.setFromMatrixPosition(a.R.hR.matrixWorld), e = _hp1.setFromMatrixPosition(a.R.elR.matrixWorld);
  return out.copy(p).addScaledVector(e.sub(p).normalize(), -0.175);
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
  if (sh.team === 0) scoreA++; else scoreB++;
  arena.cheer(1.5); say('¡TIRO LIBRE CONVERTIDO!');
}
function ftEnd(d, madeLast) {
  const set = d.fts[d.ftSet], sh = set.shooter;
  agents.forEach(a => { a.ftShot = false; });
  if (set.tech) { d.inTeam = d.techIn; d.spot = d.techSpot; }
  else if (madeLast) { d.inTeam = 1 - sh.team; d.spot = restartSpot('score', d.ftHoop.s, 0); }
  else {                                                                 // erró el último libre: pelota viva, ¡rebote!
    dead = null; B.mode = 'loose'; B.holder = null; B.noPick = { a: null, t: 0 }; B.possTeam = sh.team; B.lastTeam = sh.team; B.lastTouch = sh;
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
  else if (m.k === 'pass') humanPass(h);
  else if (m.k === 'steal') { if (!startSteal(c) && c.state === 'dribble') startCrossover(c); }
  else if (m.k === 'switch') switchPlayer(h);
  else if (m.k === 'dribble') humanCrossover(h);
}
function onNetGame(m) {
  if (netRole === 'host') {
    const h = humans.find(x => x.dev === 'net'); if (!h) return;
    if (m.t === 'I') {
      const n = h.net; n.wx = +m.wx || 0; n.wz = +m.wz || 0; n.m = m.m ? 1 : 0; n.t = performance.now();
      Object.assign(n.P.down, { sprint: !!m.sp, jump: !!m.jp, dribble: !!m.db, shoot: !!m.sh }); n.P.amt.sprint = +m.spA || 0; n.P.mag = +m.an || 0;
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
  if (net.lastScore && (g[0] !== net.lastScore[0] || g[1] !== net.lastScore[1])) arena.cheer(2.4);
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
    const lc = net.lc; lc.v += lc.dir * CHARGE_SPEED * dt; if (lc.v >= 1) { lc.v = 1; lc.dir = -1; } if (lc.v <= 0) { lc.v = 0; lc.dir = 1; }
    if (me._ss === 'shoot' || me._ss === 'dunk' || (performance.now() - lc.t > 450 && me._ss !== 'charge')) net.lc = null;
    else { me.state = 'charge'; me.charge = lc.v; }
  }
}
function netInputOf(h) {
  const inp = inputOf(h), w = humanDir(h), P = inp.P || NO_PAD, kd = inp.kb ? KB.down : () => false;
  const sprint = kd('sprint') || !!P.down.sprint, keyMove = kd('up') || kd('down') || kd('left') || kd('right');
  return { t: 'I', wx: w ? r2(w.x) : 0, wz: w ? r2(w.z) : 0, m: w ? 1 : 0, sp: sprint ? 1 : 0, spA: r2(kd('sprint') ? 1 : (P.amt.sprint || 0)), jp: (kd('jump') || P.down.jump) ? 1 : 0, db: (kd('dribble') || P.down.dribble) ? 1 : 0, sh: P.down.shoot ? 1 : 0, an: (P.mag > 0 && !keyMove && !sprint) ? r2(P.mag) : 1 };
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
  if (act === 'shoot') { if (B.holder === me && me._ss === 'dribble' && !net.lc) net.lc = { v: 0, dir: 1, t: performance.now() }; guestSend('shoot'); }
  else if (act === 'pass') { if (B.holder === me) guestSend('pass'); else if (h.dev === 'pad') guestSend('switch'); }
  else if (act === 'steal') guestSend('steal');
  else if (act === 'switch') guestSend('switch');
  else if (act === 'dribble') guestSend('dribble');
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
  else if (h === a) rows.push(['shoot', 'Tirar', a.state === 'dribble'], ['pass', 'Pasar', a.state === 'dribble'], ['steal', 'Cruce', a.state === 'dribble'], ['jump', nearRim ? 'Mate / bandeja' : 'Saltar', true], ['sprint', 'Correr', true], ['dribble', 'Dribleo veloz', true]);
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
    if (isHum(a) && humanActive(a.hum)) I = humanIntent(a);
    else if (mode === 'training') { I = a.intent; I.x = I.z = I.mag = 0; I.sprint = I.jump = I.move = I.dribHold = false; I.sprintAmt = 0; I.face = null; }
    else { aiThink(G, a, dt, a.intent); I = a.intent; }
    if (I.move) startCrossover(a);
    updateAgent(a, dt, I);
  }
  if (mode === 'match') separate();
  for (const a of act) pose(a, dt);
  ballLogic(dt);
  for (const t of [0, 1]) for (const b of T[t].bench) b.rest = Math.min(1, (b.rest ?? 1) + dt * 0.03);       // los suplentes descansan
  if (dead) updateDead(dt); else if (mode === 'match') { tickGame(dt); checkPlayerOut(); }
}
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30) || 1 / 60;
  gameTime += dt;
  const PS = Pad.update(dt);
  const sep = humans.length > 1 && mode === 'match';        // varios jugadores: cada joystick lee solo a su dueño
  if (sep) for (const h of humans) if (h.dev === 'pad') { h.P = Pad.readPad(h.pad); h.connected = h.P.connected; }
  if (PM.isOpen()) { const j = Pad.joinPoll(); if (j >= 0) PM.onJoin?.(j); }
  if (paused || Pause.isOpen()) { if (!PM.onPad(PS)) Pad.menuNav(PS); Pause.onPad(PS); }
  else if (!sep) padGame(PS, dt);
  else for (const h of humans) if (h.dev === 'pad' && h.P?.connected && !paused) padGame(h.P, dt, h);
  if (!paused) { if (netRole === 'guest') viewerStep(dt); else stepGame(dt); }
  if (netRole !== 'guest') updateRef(dt);
  arena.update(dt);
  if (netRole === 'host' && !paused) hostNetTick(dt); else if (netRole === 'guest' && !paused) guestNetTick(dt);
  updateCamera(dt); updateScoreboard(); updateHUD();
  hoops.forEach(h => h.net(dt));
  if (!UI.isMainOpen() && !PM.isOpen() && !TS.isOpen() && !Online.isOpen()) renderer.render(scene, camera);   // con el menú previo abierto no hace falta dibujar la cancha de atrás
}
Online.init({ onBack: () => UI.showMain(), onNeedLogin: () => { signOut().then(() => UI.showAuth()); }, onMatchStart: (S, role) => startGame(S, role), onGame: onNetGame, onMatchStop: stopOnlineMatch, onMatchEnded });
PM.init({ onPlay: startGame, onExit: exitToMain, onOnlineChange: p => Online.sendPick(p), onOnlineReady: r => Online.setReady(r), onOnlineStart: () => Online.hostStart(), onOnlineLeave: () => Online.leave() }); bindButtons(); loadSetup(PM.getSetup()); applyTeams(); setMode('match'); agents.forEach(a => a.active && pose(a, 0.016)); frame();
UI.boot({ onTraining: () => openTrainSetup(false), onCasual: openCasual, onOnline: openOnline });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});
/* para depurar desde la consola del navegador: window.__bb */
globalThis.__bb = { agents, B, T, G, hoops, step: stepGame, get scores() { return [scoreA, scoreB]; }, get dead() { return dead; }, get ctrl() { return ctrl; }, humans, camera, get camMode() { return camMode; }, set autoUser(v) { autoUser = v; },
  get clock() { return [quarter, clockT, shotClock]; }, startGame, startTraining, setDiff: d => { diff = d; }, setQLen: s => { qLen = s; }, get mode() { return mode; }, setCourt: id => setCourt(courtById(id)), get paused() { return paused; }, set paused(v) { paused = v; }, keys, pass: humanPass };
