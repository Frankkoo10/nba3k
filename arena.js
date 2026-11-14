import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { TEAMS } from './teams.js';

/* Estadio. Se arma a partir de una cancha de courts.js (colores, logo, banners, pantallas LED, público…):
   bowl cerrado y empinado en tres niveles (bowl inferior, suites, bowl superior), pantallas LED en la banda y alrededor
   del bowl, tablero gigante colgado del techo, banners y logo en el centro de la cancha.
   buildArena(scene, court) devuelve { cheer, drawBoard, update, dispose }: para cambiar de cancha se llama a dispose() y se arma otra. */

export const ARENA = { BX: 11.52, BZ: 18.225 };      // línea de las pantallas LED de la banda (límite de la pelota)
const { BX, BZ } = ARENA;
const WALL_X = 25.25, WALL_Z = 31.95;                // paredes entre el bowl inferior y el superior

const IMG = {}, onLogo = new Set();
let boardDirty = true;
TEAMS.forEach(t => {
  const i = new Image();
  i.onload = () => { boardDirty = true; onLogo.forEach(f => f(t.ab)); };
  i.src = t.logo; IMG[t.ab] = i;
});
['CLE_C', 'SAS_SPUR'].forEach(k => {                    // recortes de logos (la "C" de los Cavs, la espuela de los Spurs)
  const i = new Image(); i.onload = () => onLogo.forEach(f => f(k)); i.src = `logos/${k}.png`; IMG[k] = i;
});
const loaded = ab => IMG[ab] && IMG[ab].complete && IMG[ab].naturalWidth;

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const toTex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const std = (color, roughness = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pickFrom = list => { let r = rnd(), a = 0; for (const [v, w] of list) { a += w; if (r < a) return v; } return list[list.length - 1][0]; };
const FONT = '800 34px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
const SKINS = ['#f1c9a5', '#d9a679', '#b97a50', '#8d5a3a', '#6b4129', '#f6d8bf'];

/* ---- logo del centro de la cancha. 'ind' = la "P" de los Pacers pintada en el parquet: P amarilla, pelota negra, borde gastado ---- */
function paintFloorLogo(g, S, court) {
  g.clearRect(0, 0, S, S);
  const L = court.logo, key = L.img || L.team, im = IMG[key]; if (!loaded(key)) return;
  if (L.recolor !== 'ind') { g.drawImage(im, 0, 0, S, S); return; }
  const [tc, tg] = mk(S, S);
  tg.drawImage(im, 180, 131, 940, 940, 0, 0, S, S);                    // recorte cuadrado alrededor de la P
  try {
    const d = tg.getImageData(0, 0, S, S), px = d.data;
    const PAL = [[0, 45, 98, [253, 187, 48]], [251, 191, 21, [22, 23, 27]], [190, 192, 194, null]];      // azul → amarillo · amarillo → negro · gris del borde → nada
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 8) continue;
      let best = 0, bd = 1e9;
      PAL.forEach((p, k) => { const dd = (px[i] - p[0]) ** 2 + (px[i + 1] - p[1]) ** 2 + (px[i + 2] - p[2]) ** 2; if (dd < bd) { bd = dd; best = k; } });
      const to = PAL[best][3];
      if (!to) { px[i + 3] = 0; continue; }
      px[i] = to[0]; px[i + 1] = to[1]; px[i + 2] = to[2];
    }
    tg.putImageData(d, 0, 0);
    if (L.distress) {                                                  // pintura gastada: manchitas que dejan ver el parquet
      tg.globalCompositeOperation = 'destination-out';
      let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 1500; i++) { tg.globalAlpha = 0.35 + r() * 0.65; tg.beginPath(); tg.arc(r() * S, r() * S, 0.5 + r() * r() * 3.2, 0, 7); tg.fill(); }
      tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over';
    }
    g.drawImage(tc, 0, 0);
  } catch { g.drawImage(im, 0, 0, S, S); }                              // si el navegador no deja leer píxeles (file://), se ve el escudo común
}

/* ---- pintura del piso (canchas con contorno de color, panal, rombos, flechas del área, trofeo, logos chicos y textos): se dibuja en un solo canvas del tamaño del piso ----
   Mapeo: x del canvas = (X + FW/2)·PPM · y del canvas = (Z + FL/2)·PPM. rot: 0 = el texto se lee hacia +X con las letras hacia −Z; π/2 = se lee hacia +Z con las letras hacia +X (como lo ve la cámara). */
const CX = 7.62, CZ = 14.325, FW = CX * 2 + 8, FL = CZ * 2 + 8, PPM = 48, KEY_W = 2.44, KEY_L = 5.79;
function paintSurface(g, court) {
  const sf = court.surface, W = Math.ceil(FW * PPM), Lh = Math.ceil(FL * PPM);
  const X = x => (x + FW / 2) * PPM, Y = z => (z + FL / 2) * PPM;
  g.clearRect(0, 0, W, Lh);
  const rectCourt = () => g.rect(X(-CX), Y(-CZ), CX * 2 * PPM, CZ * 2 * PPM);
  const rectKeys = () => { for (const s of [-1, 1]) { const z0 = s < 0 ? -CZ : CZ - KEY_L; g.rect(X(-KEY_W), Y(z0), KEY_W * 2 * PPM, KEY_L * PPM); } };
  const hexes = (r, fn) => {                                          // panal de hexágonos (punta arriba) sobre todo el piso
    const w = Math.sqrt(3) * r, dy = r * 1.5;
    for (let row = -1, y = 0; y < FL + r * 2; row++, y += dy) for (let x = (row & 1 ? w / 2 : 0) - w; x < FW + w; x += w) fn(x - FW / 2, y - FL / 2, r);
  };
  const hexPath = (cx, cz, r) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 180 * (60 * k - 90); const px = X(cx + Math.cos(a) * r), py = Y(cz + Math.sin(a) * r); k ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); };
  const vtx = (cx, cz, r, deg) => { const a = Math.PI / 180 * deg; return [X(cx + Math.cos(a) * r), Y(cz + Math.sin(a) * r)]; };

  /* 0) madera oscura adentro del arco de tres (arcFill): círculo de 7.24 m desde cada aro, solo hasta las líneas de las esquinas (6.7 m) y dentro de la cancha */
  if (sf.arcFill) {
    g.save(); g.beginPath(); g.rect(X(-6.7), Y(-CZ), 13.4 * PPM, CZ * 2 * PPM); g.clip(); g.fillStyle = sf.arcFill;
    for (const s of [-1, 1]) { g.beginPath(); g.arc(X(0), Y(s * (CZ - 1.575)), 7.24 * PPM, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); rectKeys(); g.fill(); g.restore();
  }
  /* 1) parquet: rombos (cubos) suaves, solo dentro de la cancha y fuera de las zonas */
  if (sf.diamonds) {
    g.save(); g.beginPath(); rectCourt(); rectKeys(); g.clip('evenodd');
    hexes(sf.diamonds.r, (cx, cz, r) => {
      const c = [X(cx), Y(cz)], v = d => vtx(cx, cz, r, d);
      const face = (pts, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(...c); pts.forEach(p => g.lineTo(...p)); g.closePath(); g.fill(); };
      face([v(210), v(270), v(330)], sf.diamonds.light);              // cara de arriba, clara
      face([v(30), v(90), v(330)], sf.diamonds.dark);                 // cara derecha, oscura
    });
    g.restore();
  }
  /* 2) contorno de color (con panal si la cancha lo tiene), afuera de la cancha */
  g.save(); g.beginPath(); g.rect(0, 0, W, Lh); rectCourt(); g.clip('evenodd');
  g.fillStyle = sf.color; g.fillRect(0, 0, W, Lh);
  if (sf.color2) { g.fillStyle = sf.color2; g.fillRect(X(0), 0, W - X(0), Lh); }          // contorno de otro color del lado +X (Blazers: rojo / negro)
  if (sf.hex) { g.strokeStyle = sf.hex; g.lineWidth = 1.6; hexes(0.66, (cx, cz, r) => { hexPath(cx, cz, r); g.stroke(); }); }
  g.restore();
  /* 3) panal sobre las zonas pintadas (el color de fondo lo da el material de la zona) */
  if (sf.keyHex) {
    g.save(); g.beginPath(); rectKeys(); g.clip();
    g.strokeStyle = sf.keyHex; g.lineWidth = 1.6; hexes(0.5, (cx, cz, r) => { hexPath(cx, cz, r); g.stroke(); });
    g.restore();
  }
  /* 3b) arcos de colores adentro de la zona (círculo de tiros libres: uno sólido y otro a rayas, del lado del aro) */
  if (sf.keyArcs) {
    g.save(); g.beginPath(); rectKeys(); g.clip(); g.strokeStyle = sf.keyArcs.color; g.lineCap = 'butt';
    for (const s of [-1, 1]) {
      const cz = s * (CZ - KEY_L), a0 = s > 0 ? 0 : Math.PI, a1 = a0 + Math.PI;
      g.lineWidth = 0.075 * PPM; g.setLineDash([]); g.beginPath(); g.arc(X(0), Y(cz), 1.2 * PPM, a0, a1); g.stroke();
      g.lineWidth = 0.065 * PPM; g.setLineDash([0.3 * PPM, 0.24 * PPM]); g.beginPath(); g.arc(X(0), Y(cz), 1.66 * PPM, a0, a1); g.stroke();
    }
    g.restore();
  }
  /* 4) adornos (trofeo dorado) */
  for (const d of sf.decor || []) {
    if (d.type !== 'trophy') continue;
    const s = d.size * PPM; g.save(); g.translate(X(d.x), Y(d.z)); g.rotate(d.rot || 0);
    const gr = g.createLinearGradient(-s * 0.2, 0, s * 0.2, 0); gr.addColorStop(0, '#9c7415'); gr.addColorStop(0.45, '#f1cf62'); gr.addColorStop(1, '#a87e1a');
    g.fillStyle = gr; g.strokeStyle = 'rgba(90,60,5,.55)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(0, -s * 0.36, s * 0.15, 0, Math.PI * 2); g.fill(); g.stroke();                         // pelota de arriba
    g.beginPath(); g.moveTo(-s * 0.05, -s * 0.22); g.bezierCurveTo(-s * 0.03, -s * 0.02, -s * 0.12, s * 0.2, -s * 0.2, s * 0.4);
    g.lineTo(s * 0.2, s * 0.4); g.bezierCurveTo(s * 0.12, s * 0.2, s * 0.03, -s * 0.02, s * 0.05, -s * 0.22); g.closePath(); g.fill(); g.stroke(); // tallo que se ensancha
    g.fillRect(-s * 0.26, s * 0.4, s * 0.52, s * 0.07); g.strokeRect(-s * 0.26, s * 0.4, s * 0.52, s * 0.07);    // base
    g.restore();
  }
  /* 5) logos chicos */
  for (const m of sf.minis || []) {
    const im = IMG[m.team]; if (!loaded(m.team)) continue;
    const ar = im.naturalWidth / im.naturalHeight, w = m.size * PPM * (ar > 1 ? 1 : ar), h = w / ar;
    g.save(); g.translate(X(m.x), Y(m.z)); g.rotate(m.rot || 0); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore();
  }
  /* 6) textos pintados */
  for (const t of sf.texts || []) {
    g.save(); g.translate(X(t.x), Y(t.z)); g.rotate(t.rot || 0); if (t.italic) g.transform(1, 0, -0.22, 1, 0, 0);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let px = t.h * PPM; const fam = '\"Barlow Condensed\", \"Arial Narrow\", Arial, sans-serif', setF = s => { g.font = `${t.weight || 800} ${s}px ${fam}`; };
    const label = t.text.split('').join(String.fromCharCode(8202)); setF(px);
    const wm = g.measureText(label).width, maxPx = (t.maxW || 12) * PPM; if (wm > maxPx) { px *= maxPx / wm; setF(px); }
    if (t.stroke) { g.lineJoin = 'round'; g.lineWidth = px * 0.14; g.strokeStyle = t.stroke; g.strokeText(label, 0, 0); }
    g.fillStyle = t.color; g.fillText(label, 0, t.sub ? -px * 0.12 : 0);
    if (t.sub) { setF(px * 0.42); g.fillText(t.sub.split('').join(String.fromCharCode(8202)), 0, px * 0.46); }
    g.restore();
  }
}

export function buildArena(scene, court) {
  seed = 11;
  const root = new THREE.Group(); scene.add(root);
  const scrollers = [], redraws = [];
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); return m; };
  const H = Math.PI / 2;
  const { led, seats: SEAT, board: BD } = court;

  /* ---- pantallas LED en cinta (texto que se desplaza) ---- */
  function ribbon(len, h) {
    const S = led.text;
    const [m, mg] = mk(1, 1); mg.font = FONT;
    const w = Math.ceil(mg.measureText(S).width) + 10, [c, g] = mk(w, 64);
    g.fillStyle = led.bg; g.fillRect(0, 0, w, 64);
    g.fillStyle = led.accent; g.fillRect(0, 0, w, 4); g.fillRect(0, 60, w, 4);
    g.fillStyle = led.fg; g.font = FONT; g.textBaseline = 'middle'; g.fillText(S, 5, 34);
    const t = toTex(c); t.wrapS = THREE.RepeatWrapping; t.repeat.x = len / (w * h / 64); scrollers.push(t);
    return new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, toneMapped: false });
  }
  const ribbonAt = (len, h, x, y, z, ry) => add(new THREE.PlaneGeometry(len, h), ribbon(len, h), x, y, z, ry);
  ribbonAt(2 * BZ, 0.9, BX, 0.45, 0, -H); ribbonAt(2 * BZ, 0.9, -BX, 0.45, 0, H);          // banda (sidelines)
  ribbonAt(2 * BX, 0.9, 0, 0.45, BZ, Math.PI); ribbonAt(2 * BX, 0.9, 0, 0.45, -BZ, 0);     // banda (fondos)
  for (const y of [8.9, 12.1]) {                                                            // cintas del bowl
    ribbonAt(2 * WALL_Z, 0.8, WALL_X - 0.02, y, 0, -H); ribbonAt(2 * WALL_Z, 0.8, -WALL_X + 0.02, y, 0, H);
    ribbonAt(2 * WALL_X, 0.8, 0, y, WALL_Z - 0.02, Math.PI); ribbonAt(2 * WALL_X, 0.8, 0, y, -WALL_Z + 0.02, 0);
  }

  /* ---- gradas: peldaños de concreto claro + butacas + público ---- */
  const concrete = std(0xe4e1d9, 0.95), SW = 0.52, dummy = new THREE.Object3D();
  const cushionG = new THREE.BoxGeometry(0.46, 0.1, 0.42), backG = new THREE.BoxGeometry(0.46, 0.5, 0.07);
  const torsoG = new THREE.BoxGeometry(0.4, 0.5, 0.26), headG = new THREE.SphereGeometry(0.11, 8, 6);
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const buckets = [[], [], [], []];

  function tier(o) {
    const seats = [];
    for (let r = 0; r < o.rows; r++) {
      const cx = o.ax + (r + 0.5) * o.run, cz = o.az + (r + 0.5) * o.run, y = o.y0 + r * o.rise;
      const put = (x, z, ry) => seats.push({ x, y, z, ry, r });
      for (let z = -cz + SW; z <= cz - SW; z += SW) { put(cx, z, -H); put(-cx, z, H); }
      for (let x = -cx + SW * 1.6; x <= cx - SW * 1.6; x += SW) { put(x, cz, Math.PI); put(x, -cz, 0); }
      const ex = o.ax + r * o.run, ez = o.az + r * o.run, oz = o.az + (r + 1) * o.run;
      for (const s of [-1, 1]) {
        add(new THREE.BoxGeometry(o.run, y, 2 * oz), concrete, s * (ex + o.run / 2), y / 2, 0);
        add(new THREE.BoxGeometry(2 * ex, y, o.run), concrete, 0, y / 2, s * (ez + o.run / 2));
      }
    }
    const n = seats.length, cush = new THREE.InstancedMesh(cushionG, white, n), back = new THREE.InstancedMesh(backG, white, n);
    const col = new THREE.Color();
    seats.forEach((s, i) => {
      const fx = Math.sin(s.ry), fz = Math.cos(s.ry);
      col.set(s.r % 6 === 5 ? SEAT.accent : o.color);
      dummy.rotation.set(0, s.ry, 0);
      dummy.position.set(s.x, s.y + 0.3, s.z); dummy.updateMatrix(); cush.setMatrixAt(i, dummy.matrix); cush.setColorAt(i, col);
      dummy.position.set(s.x - fx * 0.2, s.y + 0.57, s.z - fz * 0.2); dummy.updateMatrix(); back.setMatrixAt(i, dummy.matrix); back.setColorAt(i, col);
      if (rnd() < 0.88) buckets[i % 4].push({ x: s.x - fx * 0.05, y: s.y, z: s.z - fz * 0.05, ry: s.ry, body: pickFrom(court.crowd), skin: SKINS[(rnd() * SKINS.length) | 0] });
    });
    root.add(cush, back);
  }
  tier({ rows: 16, ax: BX + 0.9, az: BZ + 0.9, run: 0.8, rise: 0.5, y0: 0.9, color: SEAT.lower });   // bowl inferior
  tier({ rows: 12, ax: WALL_X + 1.2, az: WALL_Z + 1.2, run: 0.8, rise: 0.6, y0: 12.4, color: SEAT.upper }); // bowl superior

  const groups = buckets.map(list => {
    const g = new THREE.Group(), n = list.length;
    const bodies = new THREE.InstancedMesh(torsoG, white, n), heads = new THREE.InstancedMesh(headG, white, n), c = new THREE.Color();
    list.forEach((f, i) => {
      dummy.rotation.set(0, f.ry, 0);
      dummy.position.set(f.x, f.y + 0.72, f.z); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix); bodies.setColorAt(i, c.set(f.body));
      dummy.position.set(f.x, f.y + 1.1, f.z); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix); heads.setColorAt(i, c.set(f.skin));
    });
    g.add(bodies, heads); root.add(g); return g;
  });

  /* ---- paredes de suites, muro exterior, techo y luces ---- */
  const dark = std(0x1b2233, 0.4, { metalness: 0.2 }), warm = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.3, 4, 2 * WALL_Z + 0.6), dark, s * (WALL_X + 0.15), 10.4, 0);
    add(new THREE.BoxGeometry(2 * WALL_X + 0.6, 4, 0.3), dark, 0, 10.4, s * (WALL_Z + 0.15));
    add(new THREE.BoxGeometry(0.05, 0.12, 2 * WALL_Z), warm, s * (WALL_X - 0.02), 10.4, 0);   // tira de luz cálida de las suites
    add(new THREE.BoxGeometry(2 * WALL_X, 0.12, 0.05), warm, 0, 10.4, s * (WALL_Z - 0.02));
    add(new THREE.BoxGeometry(0.4, 31, 88), std(court.wall), s * 36.6, 15.5, 0);
    add(new THREE.BoxGeometry(74, 31, 0.4), std(court.wall), 0, 15.5, s * 43.3);
  }
  const roof = add(new THREE.PlaneGeometry(74, 88), std(court.roof, 0.9, { side: THREE.DoubleSide }), 0, 30, 0); roof.rotation.x = H;
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff1d6, toneMapped: false });
  for (const s of [-1, 1]) { add(new THREE.BoxGeometry(0.5, 0.2, 50), lamp, s * 16, 28.5, 0); add(new THREE.BoxGeometry(32, 0.2, 0.5), lamp, 0, 28.5, s * 22); }

  /* ---- banners (campeonatos) sobre la grada del lado de la mesa ---- */
  const B = court.banners;
  if (B) B.list.forEach((b, i) => {
    const [c, g] = mk(256, 512);
    g.fillStyle = B.bg; g.fillRect(0, 0, 256, 512); g.strokeStyle = B.trim; g.lineWidth = 10; g.strokeRect(10, 10, 236, 492);
    g.fillStyle = B.fg; g.textAlign = 'center';
    g.font = '800 58px "Barlow Condensed", Arial'; g.fillText(b.l1, 128, 130); g.fillText(b.l2, 128, 190);
    g.font = '800 92px "Barlow Condensed", Arial'; g.fillText(String(b.year), 128, 340); g.font = '60px Arial'; g.fillText('★', 128, 430);
    add(new THREE.PlaneGeometry(1.9, 3.8), new THREE.MeshBasicMaterial({ map: toTex(c), side: THREE.DoubleSide }), 29, 22.3, (i - (B.list.length - 1) / 2) * Math.min(3.4, 56 / B.list.length), -H);
  });

  /* ---- tablero gigante colgado del centro ---- */
  const [bc, bg] = mk(1024, 512), boardTex = toTex(bc);
  const screen = new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false });
  const [lc, lg] = mk(512, 512), logoTex = toTex(lc);
  const [bgc, bgg] = mk(256, 256), bottomTex = toTex(bgc);                // la base del tablero muestra el escudo del equipo
  const drawFloorLogo = () => { paintFloorLogo(lg, 512, court); logoTex.needsUpdate = true; bgg.clearRect(0, 0, 256, 256); if (loaded(court.logo.team)) bgg.drawImage(IMG[court.logo.team], 0, 0, 256, 256); bottomTex.needsUpdate = true; };
  const bottom = new THREE.MeshBasicMaterial({ map: bottomTex, color: 0xffffff });
  const sideDark = std(0x10151f, 0.5);
  add(new THREE.BoxGeometry(6.4, 3.4, 6.4), [screen, screen, sideDark, bottom, screen, screen], 0, 15.2, 0);
  for (const [x, z] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) add(new THREE.CylinderGeometry(0.04, 0.04, 13, 6), sideDark, x, 23.4, z);

  function drawBoard(i) {
    const g = bg, fill = g.createLinearGradient(0, 0, 0, 512);
    fill.addColorStop(0, BD.top); fill.addColorStop(1, BD.bottom); g.fillStyle = fill; g.fillRect(0, 0, 1024, 512);
    g.fillStyle = BD.accent; g.fillRect(0, 0, 1024, 54); g.fillStyle = BD.bar; g.textAlign = 'center'; g.font = '800 44px "Barlow Condensed", Arial';
    g.fillText(BD.title, 512, 40);
    for (const [t, x] of [[i.a, 110], [i.b, 914]]) {
      const im = IMG[t.ab]; if (im.complete && im.naturalWidth) g.drawImage(im, x - 85, 96, 170, 170);
      g.fillStyle = '#fff'; g.font = '800 64px "Barlow Condensed", Arial'; g.fillText(t.ab, x, 340);
    }
    g.font = '800 200px "Barlow Condensed", Arial'; g.fillStyle = '#fff';
    g.fillText(i.sa, 322, 290); g.fillText(i.sb, 702, 290);
    g.font = '800 70px "Barlow Condensed", Arial'; g.fillStyle = BD.accent; g.fillText(i.q, 512, 130);
    g.fillStyle = '#fff'; g.font = '800 96px "Barlow Condensed", Arial'; g.fillText(i.clk, 512, 240);
    g.fillStyle = BD.accent; g.font = '800 54px "Barlow Condensed", Arial'; g.fillText(i.info, 512, 440);
    boardTex.needsUpdate = true;
  }

  /* ---- mesa de anotadores (lado opuesto a la cámara principal), logo del centro y textos pintados en el parquet ---- */
  add(new THREE.BoxGeometry(0.8, 1, 6), std(court.tableCol, 0.5), 9.9, 0.5, 0);
  add(new THREE.BoxGeometry(0.9, 0.06, 6.1), std(0xf2f2f2, 0.4), 9.9, 1.02, 0);
  const LS = court.logo.size;
  const fl = add(new THREE.PlaneGeometry(LS, LS), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.008, 0);
  fl.rotation.set(-H, 0, -H);
  for (const ft of court.floorTexts || []) {
    const [c, g] = mk(1600, 120);
    g.font = '800 96px "Barlow Condensed", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ft.color;
    g.fillText(ft.text.split('').join(String.fromCharCode(8202)), 800, 62);
    const w = ft.size * 1600 / 120, m = new THREE.Mesh(new THREE.PlaneGeometry(w, ft.size), new THREE.MeshBasicMaterial({ map: toTex(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(ft.x, 0.008, ft.z); m.rotation.set(-H, 0, ft.x > 0 ? -H : H); root.add(m);
  }
  let drawSurface = null;
  if (court.surface) {                                                // contorno de color, panal, rombos, textos y avispones chicos
    const [sc, sg] = mk(Math.ceil(FW * PPM), Math.ceil(FL * PPM)), sTex = toTex(sc); sTex.anisotropy = 8;
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(FW, FL), new THREE.MeshStandardMaterial({ map: sTex, transparent: true, roughness: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    sm.rotation.x = -H; sm.position.y = 0.006; sm.receiveShadow = true; root.add(sm);
    drawSurface = () => { paintSurface(sg, court); sTex.needsUpdate = true; };
    drawSurface();
  }
  const needs = new Set([court.logo.team, court.logo.img, ...(court.surface?.minis || []).map(m => m.team)].filter(Boolean));
  const redraw = ab => { if (needs.has(ab)) { drawFloorLogo(); drawSurface?.(); } };
  onLogo.add(redraw); drawFloorLogo();

  /* ---- animación: cintas LED y público que salta cuando hay festejo ---- */
  let cheerT = 0, time = 0, lastKey = '', dead = false;
  return {
    court,
    cheer(sec) { cheerT = Math.max(cheerT, sec); },
    drawBoard(info) {
      const key = JSON.stringify(info);
      if (key !== lastKey || boardDirty) { lastKey = key; boardDirty = false; drawBoard(info); }
    },
    update(dt) {
      time += dt; cheerT = Math.max(0, cheerT - dt);
      const amp = Math.min(1, cheerT);
      scrollers.forEach(t => { t.offset.x = (t.offset.x - dt * 0.03) % 1; });
      groups.forEach((g, i) => { g.position.y = amp * Math.abs(Math.sin(time * 8 + i * 1.7)) * 0.16; });
    },
    dispose() {                                           // saca el estadio de la escena y libera la memoria de la GPU
      if (dead) return; dead = true; onLogo.delete(redraw); scene.remove(root);
      const seen = new Set();
      root.traverse(o => {
        o.geometry?.dispose?.();
        for (const m of [].concat(o.material || [])) { if (seen.has(m)) continue; seen.add(m); m.map?.dispose?.(); m.dispose?.(); }
        o.instanceMatrix && o.dispose?.();
      });
      boardDirty = true;
    },
  };
}
