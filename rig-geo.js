/* ============================================================================
   Geometría del cuerpo humano (sin three.js, para poder probarla en Node).
   Todo se arma "loftando" anillos elípticos a lo largo del eje Y: cada anillo tiene
   un ancho (rx), un fondo (rz) y un desplazamiento (cx, cz). Así los músculos
   (cuádriceps, gemelos, bíceps, deltoides, pecho, trapecios) salen de las curvas
   de los perfiles y no de cápsulas rectas.
   Unidades: metros. El modelo mira hacia +z; su mano izquierda está en +x.
   ========================================================================== */

export const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-0.5 * (((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));

/* ---------- Perfiles (y de arriba hacia abajo) ---------- */
export const PROF = {
  // Muslo: pivote en la cadera, rodilla a y = -0.47. Cuádriceps marcado adelante (cz > 0).
  thigh: [
    { y: 0.02, rx: 0.095, rz: 0.100, cz: 0.005 }, { y: -0.08, rx: 0.093, rz: 0.104, cz: 0.008 },
    { y: -0.20, rx: 0.082, rz: 0.094, cz: 0.008 }, { y: -0.30, rx: 0.070, rz: 0.080, cz: 0.004 },
    { y: -0.40, rx: 0.058, rz: 0.066 }, { y: -0.47, rx: 0.054, rz: 0.060 }],
  // Pantorrilla: el gemelo sobresale hacia atrás (cz < 0) y se afina hacia el tobillo.
  shank: [
    { y: 0.0, rx: 0.056, rz: 0.058 }, { y: -0.08, rx: 0.058, rz: 0.066, cz: -0.004 },
    { y: -0.17, rx: 0.059, rz: 0.072, cz: -0.012 }, { y: -0.28, rx: 0.047, rz: 0.052, cz: -0.006 },
    { y: -0.40, rx: 0.037, rz: 0.040 }, { y: -0.47, rx: 0.038, rz: 0.042 }],
  sock: [
    { y: -0.29, rx: 0.052, rz: 0.058, cz: -0.008 }, { y: -0.36, rx: 0.044, rz: 0.049, cz: -0.003 },
    { y: -0.43, rx: 0.041, rz: 0.045 }, { y: -0.47, rx: 0.042, rz: 0.046 }],
  // Pierna del short (cuelga del muslo, así acompaña cada paso).
  shortLeg: [
    { y: 0.04, rx: 0.108, rz: 0.118, cz: 0.004 }, { y: -0.10, rx: 0.104, rz: 0.114 },
    { y: -0.22, rx: 0.109, rz: 0.113 }, { y: -0.30, rx: 0.115, rz: 0.113 }],
  // Cintura del short (en la pelvis).
  belt: [
    { y: 0.075, rx: 0.176, rz: 0.112 }, { y: 0.03, rx: 0.186, rz: 0.118 },
    { y: -0.04, rx: 0.190, rz: 0.120 }, { y: -0.11, rx: 0.170, rz: 0.110 }],
  // Camiseta sin mangas: cintura marcada, pecho ancho, hombros en V.
  jersey: [
    { y: -0.03, rx: 0.168, rz: 0.106 }, { y: 0.075, rx: 0.170, rz: 0.106 }, { y: 0.16, rx: 0.158, rz: 0.098 },
    { y: 0.27, rx: 0.180, rz: 0.108 }, { y: 0.38, rx: 0.212, rz: 0.118 }, { y: 0.46, rx: 0.228, rz: 0.114 },
    { y: 0.50, rx: 0.226, rz: 0.106 }, { y: 0.60, rx: 0.140, rz: 0.086 }],
  // Torso de piel: pecho, hombros y trapecios (se ve por el escote y los sobacos).
  skinTorso: [
    { y: 0.30, rx: 0.150, rz: 0.090 }, { y: 0.45, rx: 0.198, rz: 0.100 }, { y: 0.55, rx: 0.170, rz: 0.090 },
    { y: 0.61, rx: 0.125, rz: 0.080 }, { y: 0.66, rx: 0.078, rz: 0.068 }],
  neck: [
    { y: 0.76, rx: 0.060, rz: 0.062, cz: 0.004 }, { y: 0.68, rx: 0.062, rz: 0.064, cz: 0.003 },
    { y: 0.60, rx: 0.074, rz: 0.072 }, { y: 0.54, rx: 0.085, rz: 0.080 }],
  // Brazo: deltoides arriba, bíceps/tríceps, codo fino. Antebrazo grueso arriba y fino en la muñeca.
  upperArm: [
    { y: 0.0, rx: 0.058, rz: 0.060 }, { y: -0.07, rx: 0.063, rz: 0.064 }, { y: -0.15, rx: 0.057, rz: 0.058, cz: 0.002 },
    { y: -0.23, rx: 0.047, rz: 0.050 }, { y: -0.30, rx: 0.041, rz: 0.043 }],
  foreArm: [
    { y: 0.0, rx: 0.041, rz: 0.043 }, { y: -0.05, rx: 0.047, rz: 0.047 }, { y: -0.13, rx: 0.043, rz: 0.043 },
    { y: -0.22, rx: 0.032, rz: 0.030 }, { y: -0.28, rx: 0.029, rz: 0.026 }],
  sleeve: [
    { y: 0.02, rx: 0.068, rz: 0.070 }, { y: -0.07, rx: 0.073, rz: 0.075 }, { y: -0.15, rx: 0.068, rz: 0.070 },
    { y: -0.20, rx: 0.066, rz: 0.068 }],
  palm: [
    { y: 0.0, rx: 0.027, rz: 0.017 }, { y: -0.03, rx: 0.041, rz: 0.018 }, { y: -0.07, rx: 0.044, rz: 0.017 },
    { y: -0.095, rx: 0.040, rz: 0.013 }],
};

/* ---------- Perfil interpolado ---------- */
export function profAt(P, y) {
  const n = P.length, asc = P[n - 1].y > P[0].y;
  const lo = asc ? P[0].y : P[n - 1].y, hi = asc ? P[n - 1].y : P[0].y;
  y = clamp(y, lo, hi);
  for (let i = 0; i < n - 1; i++) {
    const a = P[i], b = P[i + 1];
    if ((y - a.y) * (y - b.y) <= 0) {
      const t = a.y === b.y ? 0 : (y - a.y) / (b.y - a.y);
      return { rx: lerp(a.rx, b.rx, t), rz: lerp(a.rz, b.rz, t), cx: lerp(a.cx || 0, b.cx || 0, t), cz: lerp(a.cz || 0, b.cz || 0, t) };
    }
  }
  const l = P[n - 1]; return { rx: l.rx, rz: l.rz, cx: l.cx || 0, cz: l.cz || 0 };
}

/* ---------- Normales suaves (ponderadas por área) ---------- */
export function computeNormals(pos, idx) {
  const nrm = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { nrm[k] += nx; nrm[k + 1] += ny; nrm[k + 2] += nz; }
  }
  return nrm;
}
function weldSeam(nrm, rows, cols) {            // une las normales de la costura (primera y última columna)
  for (let r = 0; r < rows; r++) {
    const a = (r * (cols + 1)) * 3, b = (r * (cols + 1) + cols) * 3;
    const x = nrm[a] + nrm[b], y = nrm[a + 1] + nrm[b + 1], z = nrm[a + 2] + nrm[b + 2];
    nrm[a] = nrm[b] = x; nrm[a + 1] = nrm[b + 1] = y; nrm[a + 2] = nrm[b + 2] = z;
  }
}
function normalize(nrm) {
  for (let i = 0; i < nrm.length; i += 3) {
    const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1; nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l;
  }
  return nrm;
}

/* ---------- Loft: tubo con sección elíptica variable ---------- */
export function loft(P, o = {}) {
  const R = o.radial || 14, cs = o.capSteps || 3;
  const n = P.length;
  const rings = P.map(p => ({ y: p.y, rx: p.rx, rz: p.rz, cx: p.cx || 0, cz: p.cz || 0 }));
  const dirTop = Math.sign(P[0].y - P[1].y) || 1, dirBot = Math.sign(P[n - 1].y - P[n - 2].y) || -1;
  const pre = [], post = [];
  if (o.capTop !== false) {
    const a = rings[0], h = o.capH ?? Math.min(a.rx, a.rz);
    for (let k = 1; k <= cs; k++) { const ph = (k / cs) * Math.PI / 2, f = Math.max(Math.cos(ph), 0.001); pre.unshift({ ...a, y: a.y + dirTop * h * Math.sin(ph), rx: a.rx * f, rz: a.rz * f }); }
  }
  if (o.capBot !== false) {
    const a = rings[n - 1], h = o.capH ?? Math.min(a.rx, a.rz);
    for (let k = 1; k <= cs; k++) { const ph = (k / cs) * Math.PI / 2, f = Math.max(Math.cos(ph), 0.001); post.push({ ...a, y: a.y + dirBot * h * Math.sin(ph), rx: a.rx * f, rz: a.rz * f }); }
  }
  const all = [...pre, ...rings, ...post], rows = all.length;
  const pos = new Float32Array(rows * (R + 1) * 3), uv = new Float32Array(rows * (R + 1) * 2), idx = [];
  all.forEach((r, j) => {
    for (let i = 0; i <= R; i++) {
      const th = (TAU * i) / R, k = j * (R + 1) + i;
      pos[k * 3] = r.cx + r.rx * Math.cos(th); pos[k * 3 + 1] = r.y; pos[k * 3 + 2] = r.cz + r.rz * Math.sin(th);
      uv[k * 2] = i / R; uv[k * 2 + 1] = 1 - j / (rows - 1);
    }
  });
  const down = all[rows - 1].y < all[0].y;
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < R; i++) {
    const A = j * (R + 1) + i, B = A + 1, C = (j + 1) * (R + 1) + i + 1, D = (j + 1) * (R + 1) + i;
    if (down) idx.push(A, B, C, A, C, D); else idx.push(A, C, B, A, D, C);
  }
  const nrm = computeNormals(pos, idx); weldSeam(nrm, rows, R); normalize(nrm);
  return { pos, nrm, uv, idx, rows, cols: R };
}

/* Escote de la camiseta: el frente baja bastante y la espalda un poco (se corta el anillo superior). */
export function cutNeckline(g, P, yTop, front = 0.075, back = 0.02) {
  const { pos } = g;
  for (let k = 0; k < pos.length; k += 3) {
    if (pos[k + 1] < yTop - 1e-4) continue;
    const q0 = profAt(P, yTop), zf = (pos[k + 2] - q0.cz) / q0.rz;       // -1 espalda … +1 frente
    const drop = zf > 0 ? front * Math.pow(zf, 1.4) : back * -zf;
    const y = yTop - drop, q = profAt(P, y);
    const th = Math.atan2(zf, (pos[k] - q0.cx) / q0.rx);
    pos[k + 1] = y; pos[k] = q.cx + q.rx * Math.cos(th); pos[k + 2] = q.cz + q.rz * Math.sin(th);
  }
  const nrm = computeNormals(pos, g.idx); weldSeam(nrm, g.rows, g.cols); g.nrm = normalize(nrm);
  return g;
}

/* ---------- Franja que sigue la superficie de un perfil (vivos, laterales, dobladillo) ---------- */
export function strip(P, ac, hw, off, y0, y1, ny = 8, na = 4) {
  const pos = new Float32Array((ny + 1) * (na + 1) * 3), idx = [];
  for (let j = 0; j <= ny; j++) {
    const y = lerp(y0, y1, j / ny), q = profAt(P, y);
    for (let k = 0; k <= na; k++) {
      const a = ac + lerp(-hw, hw, k / na), m = (j * (na + 1) + k) * 3;
      pos[m] = q.cx + (q.rx + off) * Math.cos(a); pos[m + 1] = y; pos[m + 2] = q.cz + (q.rz + off) * Math.sin(a);
    }
  }
  const down = y1 < y0;
  for (let j = 0; j < ny; j++) for (let k = 0; k < na; k++) {
    const A = j * (na + 1) + k, B = A + 1, C = (j + 1) * (na + 1) + k + 1, D = (j + 1) * (na + 1) + k;
    if (down) idx.push(A, B, C, A, C, D); else idx.push(A, C, B, A, D, C);
  }
  const nrm = normalize(computeNormals(pos, idx));
  return { pos, nrm, uv: new Float32Array((ny + 1) * (na + 1) * 2), idx };
}

/* ---------- Decal curvo (número / nombre) pegado a la camiseta ---------- */
export function decal(P, w, h, y0, nx = 14, ny = 10) {
  const pos = new Float32Array((nx + 1) * (ny + 1) * 3), uv = new Float32Array((nx + 1) * (ny + 1) * 2), idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const vy = h / 2 - (h * j) / ny, vx = -w / 2 + (w * i) / nx, q = profAt(P, y0 + vy);
    const s = Math.max(0.0001, 1 - ((vx - q.cx) / q.rx) ** 2), m = j * (nx + 1) + i;
    pos[m * 3] = vx; pos[m * 3 + 1] = vy; pos[m * 3 + 2] = q.cz + q.rz * Math.sqrt(s) + 0.0025;
    uv[m * 2] = i / nx; uv[m * 2 + 1] = 1 - j / ny;
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const A = j * (nx + 1) + i, B = A + 1, C = (j + 1) * (nx + 1) + i + 1, D = (j + 1) * (nx + 1) + i;
    idx.push(A, C, B, A, D, C);
  }
  return { pos, nrm: normalize(computeNormals(pos, idx)), uv, idx };
}

/* ============================== CABEZA ==============================
   Elipsoide deformado: mandíbula, mentón, frente, arco de las cejas, nariz, pómulos,
   cuencas de los ojos y labios. La cara se pinta con colores por vértice a baja
   resolución, así que sale "borrosa" como en los juegos de PS2. */
export const HEAD = { cy: 0.10, rx: 0.081, ry: 0.116, rz: 0.097 };

export function headMesh(wSeg = 56, hSeg = 44) {
  const rows = hSeg + 1, cols = wSeg;
  const pos = new Float32Array(rows * (cols + 1) * 3), uv = new Float32Array(rows * (cols + 1) * 2), idx = [];
  for (let j = 0; j <= hSeg; j++) {
    const th = (Math.PI * j) / hSeg;
    for (let i = 0; i <= wSeg; i++) {
      const a = Math.PI + (TAU * i) / wSeg;                       // la costura queda en la nuca
      const nx = Math.sin(th) * Math.sin(a), ny = Math.cos(th), nz = Math.sin(th) * Math.cos(a);
      let x = HEAD.rx * nx, y = HEAD.ry * ny, z = HEAD.rz * nz;
      if (ny < 0) {                                                // mandíbula: se afina y el mentón sale hacia adelante
        const t = -ny;
        x *= 1 - 0.22 * Math.pow(t, 1.4); z *= 1 - 0.06 * t;
        if (nz > 0) z += 0.016 * Math.pow(t, 3) * nz;
      }
      if (ny > 0.2 && nz > 0) z -= 0.010 * (ny - 0.2) * nz;        // frente algo plana
      if (nz > 0.15) {                                             // rasgos (solo en la cara)
        const w = smoothstep(0.15, 0.55, nz), ax = Math.abs(x), sgn = x < 0 ? -1 : 1;
        let dz = 0;
        dz += 0.007 * gauss(x, y, 0, 0.044, 0.046, 0.009);                          // arcos superciliares
        dz += 0.006 * gauss(x, y, 0, 0.012, 0.008, 0.020);                          // puente de la nariz
        dz += 0.017 * gauss(x, y, 0, -0.012, 0.013, 0.012);                         // punta de la nariz
        dz += 0.005 * (gauss(x, y, 0.015, -0.014, 0.007, 0.007) + gauss(x, y, -0.015, -0.014, 0.007, 0.007)); // alas
        dz -= 0.005 * gauss(ax, y, 0.034, 0.023, 0.014, 0.009);                     // cuencas
        dz += 0.006 * gauss(ax, y, 0.052, -0.010, 0.016, 0.016);                    // pómulos
        dz += 0.005 * gauss(x, y, 0, -0.043, 0.020, 0.006);                         // labio superior
        dz += 0.006 * gauss(x, y, 0, -0.056, 0.018, 0.006);                         // labio inferior
        dz -= 0.004 * gauss(x, y, 0, -0.049, 0.022, 0.0022);                        // comisura
        dz += 0.007 * gauss(x, y, 0, -0.092, 0.020, 0.016);                         // mentón
        z += dz * w; x += sgn * 0.002 * gauss(ax, y, 0.052, -0.010, 0.016, 0.016) * w;
      }
      const k = j * (cols + 1) + i;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      uv[k * 2] = i / wSeg; uv[k * 2 + 1] = 1 - j / hSeg;
    }
  }
  for (let j = 0; j < hSeg; j++) for (let i = 0; i < wSeg; i++) {
    const A = j * (cols + 1) + i, B = A + 1, C = (j + 1) * (cols + 1) + i + 1, D = (j + 1) * (cols + 1) + i;
    idx.push(A, C, B, A, D, C);
  }
  const nrm = computeNormals(pos, idx); weldSeam(nrm, rows, cols); normalize(nrm);
  return { pos, nrm, uv, idx, rows, cols };
}

/* Colores por vértice de la cara: cejas, ojos hundidos, nariz, boca, labios y barba. beard: 0 nada, 1 sombra, 2 barba */
export function faceColors(pos, beard = 0) {
  const n = pos.length / 3, col = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], ax = Math.abs(x);
    let r = 1, g = 1, b = 1;
    if (z > 0.02) {
      const mul = (f) => { r *= f; g *= f; b *= f; };
      mul(1 - 0.62 * Math.max(gauss(ax, y, 0.037, 0.047, 0.020, 0.0055), gauss(ax, y, 0.050, 0.052, 0.012, 0.0045)));  // cejas
      mul(1 - 0.20 * gauss(ax, y, 0.034, 0.026, 0.018, 0.011));                                                           // sombra de los párpados
      mul(1 - 0.55 * gauss(ax, y, 0.008, -0.021, 0.005, 0.004));                                                          // fosas nasales
      mul(1 - 0.12 * gauss(x, y, 0, -0.026, 0.017, 0.006));                                                               // bajo la nariz
      mul(1 - 0.48 * gauss(x, y, 0, -0.049, 0.019, 0.0028));                                                              // línea de la boca
      const lip = Math.max(gauss(x, y, 0, -0.043, 0.018, 0.0055), gauss(x, y, 0, -0.056, 0.015, 0.0065));
      g *= 1 - 0.20 * lip; b *= 1 - 0.18 * lip;                                                                           // labios más rojizos
      if (beard > 0) {
        const jaw = smoothstep(-0.020, -0.050, y) * smoothstep(0.075, 0.048, ax) * smoothstep(0.02, 0.05, z);
        const mouth = Math.max(gauss(x, y, 0, -0.050, 0.020, 0.010), 0);
        const cheek = beard > 1 ? smoothstep(0.075, 0.05, ax) * smoothstep(0.010, -0.020, y) * smoothstep(0.03, 0.05, z) * 0.6 : 0;
        const stache = beard > 1 ? gauss(x, y, 0, -0.034, 0.030, 0.008) * 0.8 : gauss(x, y, 0, -0.034, 0.026, 0.007) * 0.35;
        const m = clamp(Math.max(jaw * (1 - 0.8 * mouth), cheek, stache), 0, 1);
        mul(1 - (beard > 1 ? 0.72 : 0.40) * m);
      }
    }
    col[v * 3] = r; col[v * 3 + 1] = g; col[v * 3 + 2] = b;
  }
  return col;
}

/* Posición aproximada de la superficie de la cara en (x, y relativos al centro de la cabeza), para ubicar los ojos. */
export function faceZ(x, y) {
  const s = Math.max(0.0001, 1 - (x / HEAD.rx) ** 2 - (y / HEAD.ry) ** 2);
  return HEAD.rz * Math.sqrt(s) - 0.005 * gauss(Math.abs(x), y, 0.034, 0.023, 0.014, 0.009);
}

/* ---------- Peinados ---------- */
export const HAIR = {
  1: { s: 1.055, sy: 1.04, tm: [[0, 0.27], [0.5, 0.30], [1.0, 0.42], [1.6, 0.48], [2.4, 0.58], [3.1416, 0.62]] },   // corto
  2: { s: 1.025, sy: 1.02, tm: [[0, 0.28], [0.5, 0.31], [1.0, 0.40], [1.6, 0.45], [2.4, 0.56], [3.1416, 0.60]] },   // rapado / fade
  3: { s: 1.26, sy: 1.18, tm: [[0, 0.21], [0.5, 0.25], [1.0, 0.40], [1.6, 0.52], [2.4, 0.60], [3.1416, 0.64]] },    // afro
  4: { s: 1.10, sy: 1.40, tm: [[0, 0.24], [0.5, 0.28], [1.0, 0.42], [1.6, 0.50], [2.4, 0.58], [3.1416, 0.62]] },    // high top
  9: { s: 1.15, sy: 1.10, tm: [[0, 0.23], [0.5, 0.27], [1.0, 0.41], [1.6, 0.50], [2.4, 0.59], [3.1416, 0.63]] },    // base de los rizos largos
};
export function hairMesh(style, aSeg = 40, tSeg = 12) {
  const H = HAIR[style] || HAIR[1];
  const tmAt = a => { a = Math.abs(a); for (let i = 0; i < H.tm.length - 1; i++) { const p = H.tm[i], q = H.tm[i + 1]; if (a <= q[0]) return lerp(p[1], q[1], (a - p[0]) / (q[0] - p[0])) * Math.PI; } return H.tm[H.tm.length - 1][1] * Math.PI; };
  const rows = tSeg + 1, cols = aSeg;
  const pos = new Float32Array(rows * (cols + 1) * 3), idx = [];
  for (let j = 0; j <= tSeg; j++) for (let i = 0; i <= aSeg; i++) {
    const a = Math.PI + (TAU * i) / aSeg, aw = ((a + Math.PI) % TAU) - Math.PI;       // aw: 0 = frente
    const th = (j / tSeg) * tmAt(aw), k = j * (cols + 1) + i;
    pos[k * 3] = HEAD.rx * H.s * Math.sin(th) * Math.sin(a);
    pos[k * 3 + 1] = HEAD.ry * H.sy * Math.cos(th) + (H.sy - 1) * 0.02;
    pos[k * 3 + 2] = HEAD.rz * H.s * Math.sin(th) * Math.cos(a);
  }
  for (let j = 0; j < tSeg; j++) for (let i = 0; i < aSeg; i++) {
    const A = j * (cols + 1) + i, B = A + 1, C = (j + 1) * (cols + 1) + i + 1, D = (j + 1) * (cols + 1) + i;
    idx.push(A, C, B, A, D, C);
  }
  const nrm = computeNormals(pos, idx); weldSeam(nrm, rows, cols); normalize(nrm);
  return { pos, nrm, uv: new Float32Array(rows * (cols + 1) * 2), idx };
}
