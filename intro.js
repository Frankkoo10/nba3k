/* ============================================================================
   Cinemática de inicio (v51)
   Sobre la pantalla de carga: la cancha se va ampliando (cámara que se acerca al aro), un jugador-sombra con una corona entra corriendo,
   salta y la clava; en el impacto hay flash, temblor de cámara y aparece MORENO GAMES en grande con la corona cayendo sobre el título.
   Todo es 2D (canvas + CSS), no usa Three.js ni descarga nada: arranca en el primer cuadro.
   Cualquier tecla / clic durante la cinemática salta directo al título (lo maneja boot.js).
   Los tiempos están todos arriba: T_* (en segundos desde que arranca la cinemática).
   ========================================================================== */
const W0 = 1536, H0 = 864;                    // tamaño de assets/loading.jpg: todo se dibuja en estas coordenadas y se escala con la imagen
const RIM = { x: 563, y: 354 };               // centro del aro en la imagen
const S = 108;                                // píxeles por metro del jugador (más grande que el de la imagen: está más cerca de la cámara)
const FLOOR = RIM.y + 3.05 * S;               // altura del piso para el jugador: el aro queda a 3,05 m
const BALL_FLOOR = 534;                       // donde pica la pelota (pie del soporte)
const T_RUN = 1.0;                            // el jugador entra
const T_IMPACT = T_RUN + 2.55;                // la clava
const T_TITLE = T_IMPACT + 0.22;              // entra MORENO GAMES
const T_CROWN = T_IMPACT + 0.72;              // cae la corona sobre el título
const T_DONE = T_IMPACT + 1.45;               // el título quedó: ya se puede entrar
const T_FIG_FADE = [T_RUN + 3.85, T_RUN + 4.4];   // la sombra se disuelve
const Z_END = 1.32;                           // zoom final de la cámara

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const easeOut = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const dirDown = a => { const r = a * Math.PI / 180; return [Math.sin(r), Math.cos(r)]; };   // ángulo medido desde "abajo", positivo hacia adelante (+x)

/* ---- pose del jugador: [x, altura de la cadera (m), inclinación del torso, muslo A, pierna A, muslo B, pierna B, brazo1 (el de la pelota): alto, antebrazo, brazo2: alto, antebrazo] ---- */
const KEYS = [
  [1.35, [300, 0.74, 30, 62, 8, -18, -40, 20, 70, -50, -20]],                 // frenada
  [1.62, [318, 0.66, 36, 70, 5, -24, -48, -15, 20, -60, -30]],                // se agacha, brazos atrás
  [1.80, [345, 1.02, 14, 12, 5, 22, 0, 100, 120, 90, 100]],                   // despega
  [2.05, [440, 1.55, 4, 45, -10, 15, -35, 140, 150, 100, 80]],                // sube
  [2.38, [535, 1.98, -4, 20, -25, -15, -50, 168, 176, 95, 60]],               // brazo estirado sobre el aro
  [2.52, [538, 2.0, -6, 5, -35, -25, -55, 160, 138, 110, 70]],                // la clava
  [2.70, [548, 1.85, 0, 0, -20, -20, -45, 150, 110, 120, 90]],                // suelta el aro
  [3.30, [580, 0.70, 22, 40, 5, 25, -5, 60, 70, 70, 60]],                     // cae
  [3.70, [585, 0.92, 5, 8, 0, -6, 0, 10, 20, 12, 20]],                        // se para
];
const hermite = (v) => {                      // spline suave entre las poses clave
  if (v <= KEYS[0][0]) return KEYS[0][1].slice();
  const n = KEYS.length; if (v >= KEYS[n - 1][0]) return KEYS[n - 1][1].slice();
  let i = 0; while (v > KEYS[i + 1][0]) i++;
  const [t0, p0] = KEYS[i], [t1, p1] = KEYS[i + 1], h = t1 - t0, s = (v - t0) / h;
  const a = KEYS[Math.max(0, i - 1)], b = KEYS[Math.min(n - 1, i + 2)];
  const s2 = s * s, s3 = s2 * s, h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  return p0.map((_, j) => {
    const m0 = (p1[j] - a[1][j]) / (t1 - a[0]), m1 = (b[1][j] - p0[j]) / (b[0] - t0);
    return h00 * p0[j] + h10 * h * m0 + h01 * p1[j] + h11 * h * m1;
  });
};
const runPose = v => {                        // carrera con la pelota en la mano
  const ph = 2 * Math.PI * (2.2 * v + 0.5 * v * v), q = clamp(v / 1.35, 0, 1);
  const th = o => 40 * Math.sin(ph + o), knee = o => 25 + 55 * (0.5 + 0.5 * Math.cos(ph + o - 0.8));
  const tA = th(0), tB = th(Math.PI);
  return [-150 + 450 * Math.pow(q, 1.5), 0.93 + 0.045 * Math.cos(2 * ph), 14 + 8 * q, tA, tA - knee(0), tB, tB - knee(Math.PI), 28 + 6 * Math.sin(2 * ph), 88, 40 * Math.sin(ph), 40 * Math.sin(ph) + 70];
};
const poseAt = v => {
  const k = smooth((v - 1.1) / 0.25);
  if (k >= 1) return hermite(v);
  const r = runPose(Math.max(v, 0)), h = hermite(v);
  return r.map((x, i) => lerp(x, h[i], k));
};

/* ---- dibujo de la silueta ---- */
function capsule(g, a, b, wa, wb) {             // segmento redondeado de ancho wa (en a) a wb (en b)
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  g.beginPath();
  g.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2); g.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2);
  g.arc(b[0], b[1], wb / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);   // casquete en b
  g.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2);
  g.arc(a[0], a[1], wa / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
  g.closePath(); g.fill();
}
function skeleton(p) {
  const [px, py, L, aT, aS, bT, bS, u1, f1, u2, f2] = p, pel = [px, FLOOR - py * S];
  const up = a => { const r = a * Math.PI / 180; return [Math.sin(r), -Math.cos(r)]; };
  const add = (o, d, m) => [o[0] + d[0] * m * S, o[1] + d[1] * m * S];
  const tu = up(L), sh = add(pel, tu, 0.56), hu = up(L * 0.55), head = add(sh, hu, 0.23);
  const leg = (t, s) => { const knee = add(pel, dirDown(t), 0.46), ank = add(knee, dirDown(s), 0.45); return { knee, ank, toe: add(ank, dirDown(s + 85), 0.23) }; };
  const arm = (u, f) => { const el = add(sh, dirDown(u), 0.33), wr = add(el, dirDown(f), 0.28), hand = add(wr, dirDown(f), 0.08); return { el, wr, hand }; };
  return { pel, sh, head, legA: leg(aT, aS), legB: leg(bT, bS), arm1: arm(u1, f1), arm2: arm(u2, f2), f1 };
}
function body(g, k) {                           // todo el cuerpo en una sola mancha (se rellena con el color que tenga g.fillStyle)
  const m = x => x * S;
  const drawLeg = l => { capsule(g, k.pel, l.knee, m(0.25), m(0.17)); capsule(g, l.knee, l.ank, m(0.17), m(0.105)); capsule(g, l.ank, l.toe, m(0.11), m(0.09)); };
  const drawArm = a => { capsule(g, k.sh, a.el, m(0.15), m(0.11)); capsule(g, a.el, a.wr, m(0.11), m(0.08)); g.beginPath(); g.arc(a.hand[0], a.hand[1], m(0.07), 0, 7); g.fill(); };
  drawArm(k.arm2); drawLeg(k.legB);
  capsule(g, k.pel, k.sh, m(0.34), m(0.46));                                    // torso
  capsule(g, k.sh, k.head, m(0.12), m(0.10));                                   // cuello
  g.beginPath(); g.ellipse(k.head[0], k.head[1], m(0.12), m(0.135), 0, 0, 7); g.fill();
  drawLeg(k.legA); drawArm(k.arm1);
}
function crown(g, k, L) {                       // la corona dorada (lo único con color en la silueta)
  const w = 0.29 * S, h = 0.19 * S, c = [k.head[0], k.head[1] - 0.12 * S];
  g.save(); g.translate(c[0], c[1]); g.rotate(L * 0.012);
  const pts = [[-w / 2, 0], [-w / 2 - 1, -h], [-w / 4, -h * 0.45], [0, -h * 1.15], [w / 4, -h * 0.45], [w / 2 + 1, -h], [w / 2, 0]];
  const gr = g.createLinearGradient(0, -h * 1.2, 0, 0); gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.5, '#ffc73a'); gr.addColorStop(1, '#c98410');
  g.shadowColor = 'rgba(255,190,50,.95)'; g.shadowBlur = 16; g.fillStyle = gr;
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
  g.shadowBlur = 0; g.fillStyle = '#fffbe0'; for (const i of [1, 3, 5]) { g.beginPath(); g.arc(pts[i][0], pts[i][1], 1.8, 0, 7); g.fill(); }
  g.restore();
}
function ballDraw(g, x, y, r, rot) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); gr.addColorStop(0, '#ffa04a'); gr.addColorStop(1, '#b4460e');
  g.save(); g.shadowColor = 'rgba(255,140,40,.55)'; g.shadowBlur = 10; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
  g.save(); g.translate(x, y); g.rotate(rot); g.strokeStyle = '#2a1206'; g.lineWidth = Math.max(1, r * 0.1);
  g.beginPath(); g.arc(0, 0, r, 0, 7); g.moveTo(-r, 0); g.lineTo(r, 0); g.moveTo(0, -r); g.lineTo(0, r); g.stroke();
  g.beginPath(); g.arc(-r * 1.25, 0, r * 0.95, -0.9, 0.9); g.moveTo(0, 0); g.stroke(); g.beginPath(); g.arc(r * 1.25, 0, r * 0.95, Math.PI - 0.9, Math.PI + 0.9); g.stroke(); g.restore();
}
function ballAt(t) {                            // desde que pasa por el aro: cae, pica y rebota
  let y = RIM.y, vy = 90, x = RIM.x, vx = 26, tt = 0, bounces = 0; const dt = 1 / 120;
  while (tt < t) { vy += 1500 * dt; y += vy * dt; x += vx * dt; tt += dt; if (y > BALL_FLOOR && vy > 0) { y = BALL_FLOOR; vy *= -0.5; vx *= 0.8; if (++bounces > 4) vy = 0; } }
  return [x, y];
}

/* ---- escena ---- */
let el = null, g = null, oc = null, og = null, raf = 0, t0 = null, offset = 0, running = false, onTitle = null;
let titleShown = false, titleDone = false, crownShown = false, flashed = false, cw = 0, ch = 0, sw = 0, sh = 0, vw = 0, vh = 0;

function layout() {
  vw = innerWidth; vh = innerHeight; sw = Math.max(vw, vh * W0 / H0); sh = sw * H0 / W0;
  el.stage.style.width = sw + 'px'; el.stage.style.height = sh + 'px';
  el.stage.style.transformOrigin = `${RIM.x / W0 * 100}% ${RIM.y / H0 * 100}%`;
  const k = 1;                                  // v53: canvas fijo de 1536×864 (más liviano; la silueta no necesita más)
  cw = Math.round(W0 * k); ch = Math.round(H0 * k);
  for (const c of [el.cv, oc]) { c.width = cw; c.height = ch; }
  el.cv.style.width = '100%'; el.cv.style.height = '100%';
  g.setTransform(cw / W0, 0, 0, cw / W0, 0, 0); og.setTransform(cw / W0, 0, 0, cw / W0, 0, 0);
}

function fx(g2, v) {                            // flash de luz, anillo y chispas desde el aro
  const dt = v - (T_IMPACT - T_RUN); if (dt < 0 || dt > 1.6) return;
  g2.save(); g2.globalCompositeOperation = 'lighter';
  const rg = g2.createRadialGradient(RIM.x, RIM.y, 0, RIM.x, RIM.y, 320); const a = 0.6 * Math.exp(-dt * 4.2);
  rg.addColorStop(0, `rgba(255,235,170,${a})`); rg.addColorStop(0.35, `rgba(255,170,60,${a * 0.45})`); rg.addColorStop(1, 'rgba(255,150,40,0)');
  g2.fillStyle = rg; g2.fillRect(RIM.x - 330, RIM.y - 330, 660, 660);
  const R = 16 + 560 * (1 - Math.exp(-dt * 4.6)); g2.strokeStyle = `rgba(255,225,150,${0.75 * Math.exp(-dt * 2.8)})`; g2.lineWidth = 4 * Math.exp(-dt * 2);
  g2.beginPath(); g2.ellipse(RIM.x, RIM.y + 10, R, R * 0.42, 0, 0, 7); g2.stroke();
  for (let i = 0; i < 26; i++) {
    const r1 = Math.abs(Math.sin(i * 91.7)), r2 = Math.abs(Math.sin(i * 47.3 + 2)), ang = (i / 26) * 6.283 + r1, sp = 140 + 380 * r2;
    const x = RIM.x + Math.cos(ang) * sp * dt, y = RIM.y + Math.sin(ang) * sp * dt + 620 * dt * dt * (0.4 + r1), al = clamp(1 - dt / (0.7 + r1 * 0.6), 0, 1);
    g2.fillStyle = `rgba(255,${190 + (r2 * 60) | 0},80,${al})`; g2.beginPath(); g2.arc(x, y, 1.4 + 2.2 * r1 * al, 0, 7); g2.fill();
  }
  g2.restore();
}

function draw(u) {
  const v = u - T_RUN;
  g.clearRect(0, 0, W0, H0);
  if (v < -0.05 || v > 4.5) return;
  const fade = 1 - smooth((v - (T_FIG_FADE[0] - T_RUN)) / (T_FIG_FADE[1] - T_FIG_FADE[0]));
  const pose = poseAt(v), k = skeleton(pose);
  if (fade > 0.01) {
    g.save(); g.globalAlpha = fade;
    if (v > 0.5 && v < 3.0) for (let i = 4; i >= 1; i--) {                    // estela de movimiento
      const kk = skeleton(poseAt(v - i * 0.045)); g.fillStyle = `rgba(80,140,235,${0.06 + (5 - i) * 0.035})`; body(g, kk);
    }
    // v53: la silueta se dibuja en un canvas aparte y solo se copia el recuadro donde está el jugador, con UN solo pase de brillo (antes eran 2 pases sobre toda la imagen)
    const rx = Math.max(0, Math.floor(k.pel[0] - 190)), ry = Math.max(0, Math.floor(Math.min(k.head[1], k.pel[1]) - 190)), rw = Math.min(W0 - rx, 380), rh = Math.min(H0 - ry, Math.ceil(FLOOR - ry + 60));
    og.clearRect(rx, ry, rw, rh); og.fillStyle = '#03050a'; body(og, k);
    g.shadowColor = 'rgba(150,200,255,.95)'; g.shadowBlur = 10; g.drawImage(oc, rx, ry, rw, rh, rx, ry, rw, rh); g.shadowBlur = 0;      // contorno de luz azul para que la sombra se vea contra el fondo oscuro
    crown(g, k, pose[2]);
    g.restore();
  }
  // pelota: en la mano hasta el aro; después cae por la red y rebota
  const tIn = 2.38, tOut = 2.55;
  if (v >= 0.2) {
    let b;
    const hand = [k.arm1.hand[0] + dirDown(pose[8])[0] * 0.07 * S, k.arm1.hand[1] + dirDown(pose[8])[1] * 0.07 * S];
    if (v < tIn) b = hand; else if (v < tOut) { const s = smooth((v - tIn) / (tOut - tIn)); b = [lerp(hand[0], RIM.x, s), lerp(hand[1], RIM.y - 2, s)]; } else b = ballAt(v - tOut);
    const dim = v > tOut ? 1 : fade; g.save(); g.globalAlpha = Math.max(dim, v > tOut ? 1 : 0); ballDraw(g, b[0], b[1], 0.12 * S, v * 9); g.restore();
  }
  fx(g, v);
}

function camera(u) {
  const base = 1 + 0.16 * smooth(u / 3.6) + (Z_END - 1.16) * easeOut((u - 3.6) / 3.4);
  const dt = u - T_IMPACT, punch = dt > 0 ? 0.065 * Math.exp(-dt * 6) : 0, z = base + punch;
  const amp = dt > 0 ? 16 * Math.exp(-dt * 4.5) : 0, sx = amp * Math.sin(u * 63), sy = amp * Math.cos(u * 51);
  const hx = (vw - sw) / 2 + RIM.x / W0 * sw, hy = (vh - sh) / 2 + RIM.y / H0 * sh, pan = smooth(u / 5);
  const tx = (vw * 0.5 - hx) * 0.55 * pan + sx, ty = (vh * 0.47 - hy) * 0.55 * pan + sy;
  el.stage.style.transform = `translate(-50%, -50%) translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${z.toFixed(4)})`;
}

function render(u) {
  camera(u);
  el.fade.style.opacity = (1 - smooth(u / 1.0)).toFixed(3);
  el.dim.style.opacity = (smooth((u - T_IMPACT) / 0.7) * 0.6).toFixed(3);
  draw(u);
  if (u >= T_IMPACT && !flashed) { flashed = true; el.flash.classList.remove('go'); void el.flash.offsetWidth; el.flash.classList.add('go'); }
  if (u >= T_TITLE && !titleShown) { titleShown = true; el.title.classList.add('show'); }
  if (u >= T_CROWN && !crownShown) { crownShown = true; el.title.classList.add('crown'); }
  if (u >= T_DONE && !titleDone) { titleDone = true; el.title.classList.add('done'); onTitle?.(); }
}

function frame(now) {
  if (!running) return;
  if (t0 == null) t0 = now;
  const u = (now - t0) / 1000 + offset; render(u);
  if (u < 9) raf = requestAnimationFrame(frame); else running = false;           // pasados los 9 s la cámara ya no se mueve
}

export function start(cb = {}) {
  el = { root: $('boot'), stage: $('btStage'), cv: $('btCv'), fade: $('btFade'), dim: $('btDim'), flash: $('btFlash'), title: $('btTitle') };
  if (!el.root || !el.stage || !el.cv) { cb.onTitle?.(); return; }                // sin el HTML de la cinemática: se sigue como antes
  onTitle = cb.onTitle; g = el.cv.getContext('2d'); oc = document.createElement('canvas'); og = oc.getContext('2d');
  layout(); addEventListener('resize', () => { if (el.root.isConnected) { layout(); if (!running) render(Math.max(offset, 9)); } });
  const reduce = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) offset = T_DONE + 0.2;
  const go = () => { if (running) return; running = true; raf = requestAnimationFrame(frame); };
  const img = new Image(); img.src = 'assets/loading.jpg';                       // se espera la imagen (máx. 1,5 s) para que el primer cuadro no salga vacío
  Promise.race([img.decode?.().catch(() => {}) || Promise.resolve(), new Promise(r => setTimeout(r, 1500))]).then(go);
  globalThis.__intro = { seek: u => { running = false; cancelAnimationFrame(raf); render(u); } };
}
/** Salta la cinemática hasta el título. Devuelve true si todavía no había llegado. */
export function skip() {
  if (titleDone) return false;
  if (t0 == null) { offset = T_DONE + 0.3; return true; }
  const u = (performance.now() - t0) / 1000 + offset; if (u >= T_DONE) return false;
  offset += T_DONE + 0.3 - u; return true;
}
export const atTitle = () => titleDone;
export function stop() { running = false; cancelAnimationFrame(raf); }
