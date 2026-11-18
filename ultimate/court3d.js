import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { buildArena } from '../arena.js';
import { courtFor } from '../courts.js';

/* Arma un mundo 3D con la cancha REAL del equipo (courts.js + arena.js, los mismos de tu juego):
   parquet, pintura, líneas, estadio con público/pantallas LED/banners y un aro NBA.
   El aro está en el fondo -z, a 12.75 m del centro (medidas reales). */
export const COURT_X = 7.62, COURT_Z = 14.325, HOOP_Z = 12.75, RIM_Y = 3.05;
const RIM_R = 0.2286 + 0.0095;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

function woodTexture(f) {
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

function buildHoop(def, ledColor) {
  const g = new THREE.Group(), hz = -HOOP_Z, bz = hz - 0.38, poleZ = -(COURT_Z + 1.2);
  const metal = mat(0x2a2e36, 0.45), pad = mat(0x14161b, 0.9);
  /* base acolchada con el escudo del equipo, poste y brazo */
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.8), pad); base.position.set(0, 1.05, poleZ); g.add(base);
  const lg = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ transparent: true }));
  lg.position.set(0, 1.2, poleZ + 0.405);
  new THREE.TextureLoader().load(`logos/${def.team}.png`, t => { t.colorSpace = THREE.SRGBColorSpace; lg.material.map = t; lg.material.needsUpdate = true; });
  g.add(lg);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 3.2, 14), metal); pole.position.set(0, 3.2, poleZ); g.add(pole);
  const armLen = Math.abs(poleZ - bz);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, armLen), metal); arm.position.set(0, 3.43, (poleZ + bz) / 2); g.add(arm);
  /* tablero de vidrio + marco LED (cambia de color al convertir) + cuadrado blanco */
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.83, 1.07, 0.04), new THREE.MeshPhysicalMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.3, roughness: 0.08 }));
  glass.position.set(0, 3.43, bz); g.add(glass);
  const led = new THREE.MeshBasicMaterial({ color: ledColor, toneMapped: false });
  const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), led); m.position.set(x, 3.43 + y, bz + 0.02); g.add(m); };
  bar(1.93, 0.06, 0, 0.55); bar(1.93, 0.06, 0, -0.55); bar(0.06, 1.12, -0.935, 0); bar(0.06, 1.12, 0.935, 0);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sq = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.01), white); m.position.set(x, 3.275 + y, bz + 0.03); g.add(m); };
  sq(0.59, 0.025, 0, 0.225); sq(0.59, 0.025, 0, -0.225); sq(0.025, 0.45, -0.295, 0); sq(0.025, 0.45, 0.295, 0);
  /* aro naranja, soporte y red */
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.0125, 10, 48), mat(0xff5a1f, 0.35)); rim.rotation.x = Math.PI / 2; rim.position.set(0, RIM_Y, hz); g.add(rim);
  const br = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.16), mat(0xff5a1f)); br.position.set(0, RIM_Y, bz + 0.1); g.add(br);
  const net = new THREE.Group(); net.position.set(0, RIM_Y, hz); g.add(net);
  const L = 6, N = 14, top = RIM_R - 0.01, bot = 0.13, h = 0.42, P = [];
  const pt = (k, i) => { const a = (i + (k % 2) * 0.5) / N * Math.PI * 2, r = top + (bot - top) * k / L; return [Math.cos(a) * r, -k / L * h, Math.sin(a) * r]; };
  for (let k = 0; k < L; k++) for (let i = 0; i < N; i++) P.push(...pt(k, i), ...pt(k + 1, i), ...pt(k, i), ...pt(k + 1, (i + (k % 2 ? 1 : N - 1)) % N));
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  net.add(new THREE.LineSegments(ng, new THREE.LineBasicMaterial({ color: 0xffffff })));
  const cone = new THREE.CylinderGeometry(top, bot, h, N, 1, true); cone.translate(0, -h / 2, 0);
  net.add(new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })));
  return { group: g, net, glass, led, rim: V(0, RIM_Y, hz), board: V(0, 3.43, bz) };
}

export function createCourtWorld(team) {
  const def = courtFor(team), scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1d); scene.fog = new THREE.Fog(0x0a0f1d, 45, 170);
  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a4658, 1.5), sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(6, 30, 10); scene.add(hemi, sun);
  const spot = new THREE.SpotLight(0xffffff, 0, 0, 0.32, 0.6, 2); spot.position.set(0, 24, -2); spot.target.position.set(0, 3, -HOOP_Z); scene.add(spot, spot.target);
  const floorMat = new THREE.MeshStandardMaterial({ map: woodTexture(def.floor), roughness: 0.45 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(COURT_X * 2 + 8, COURT_Z * 2 + 8), floorMat); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(0x131a2b, 1)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
  /* líneas y pintura (mismas medidas que main.js del juego) */
  const lineC = def.lineColor || '#ffffff', edgeC = def.edgeColor || lineC;
  const line = (pts, edge = false, r = 0.025) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), Math.max(2, pts.length * 3), r, 6, false), mat(edge ? edgeC : lineC, 0.6));
    m.position.y = 0.015; scene.add(m);
  };
  const seg = (x1, z1, x2, z2, edge = false) => line([[x1, 0, z1], [x2, 0, z2]], edge);
  const arc = (cx, cz, r, a0, a1, n = 48) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r]); } line(p); };
  seg(-COURT_X, -COURT_Z, COURT_X, -COURT_Z, true); seg(-COURT_X, COURT_Z, COURT_X, COURT_Z, true);
  seg(-COURT_X, -COURT_Z, -COURT_X, COURT_Z, true); seg(COURT_X, -COURT_Z, COURT_X, COURT_Z, true);
  seg(-COURT_X, 0, COURT_X, 0); arc(0, 0, 1.83, 0, Math.PI * 2, 64);
  for (const s of [-1, 1]) {
    const key = new THREE.Mesh(new THREE.PlaneGeometry(4.88, 5.79), mat(def.paint, def.paintRough ?? 0.5));
    key.rotation.x = -Math.PI / 2; key.position.set(0, 0.004, s * (COURT_Z - 5.79 / 2)); scene.add(key);
    const ft = s * (COURT_Z - 5.79);
    seg(-2.44, s * COURT_Z, -2.44, ft); seg(2.44, s * COURT_Z, 2.44, ft); seg(-2.44, ft, 2.44, ft); arc(0, ft, 1.83, 0, Math.PI * 2, 40);
    const phi = Math.asin(6.7 / 7.24), zc = s * (HOOP_Z - 7.24 * Math.cos(phi));
    seg(-6.7, s * COURT_Z, -6.7, zc); seg(6.7, s * COURT_Z, 6.7, zc);
    const p = []; for (let i = 0; i <= 48; i++) { const f = -phi + 2 * phi * i / 48; p.push([7.24 * Math.sin(f), 0, s * HOOP_Z - s * 7.24 * Math.cos(f)]); } line(p);
  }
  const arena = buildArena(scene, def);
  const hoop = buildHoop(def, def.led?.accent || '#ff5a1f'); scene.add(hoop.group);
  const base = new THREE.Color(def.led?.accent || '#ff5a1f');
  return {
    scene, arena, def, hoop,
    /* k = 0 estadio a pleno · k = 1 casi a oscuras con un reflector sobre el aro */
    setDim(k) { hemi.intensity = 1.5 * (1 - 0.85 * k); sun.intensity = 2.4 * (1 - 0.88 * k); spot.intensity = 1100 * k; },
    ledFlash(on) { hoop.led.color.set(on ? '#ffffff' : base); },
    dispose() {
      arena.dispose(); const seen = new Set();
      scene.traverse(o => { o.geometry?.dispose?.(); for (const m of [].concat(o.material || [])) { if (seen.has(m)) continue; seen.add(m); m.map?.dispose?.(); m.dispose?.(); } });
    },
  };
}
