/* ============================================================================
   Simulador de la pelota (v30) — SIN dependencias (se puede probar en Node).
   Repite exactamente la física de stepBall() de main.js (gravedad, arrastre, Magnus, piso, tablero y aro) para poder
   ELEGIR de antemano un tiro que pegue en el tablero y entre, que gire sobre el aro y salga o entre, o un pase de pique
   que llegue a la altura de la cintura. Si en main.js cambian las constantes de la pelota, hay que cambiarlas acá también.
   ========================================================================== */
export const G9 = 9.81, BR = 0.12, KD = 0.0206, CM = 0.004;
export const RIM_Y = 3.05, RIM_IN = 0.2286, RIM_TUBE = 0.0095, RIM_C = RIM_IN + RIM_TUBE;

function contact(S, nx, ny, nz, e, mu) {          // impulso normal con restitución + fricción de Coulomb que genera spin
  const vn = S.vx * nx + S.vy * ny + S.vz * nz; if (vn >= 0) return;
  const jn = -(1 + (-vn < 0.5 ? 0 : e)) * vn;
  const rx = -nx * BR, ry = -ny * BR, rz = -nz * BR;
  const cx = S.wy * rz - S.wz * ry + S.vx, cy = S.wz * rx - S.wx * rz + S.vy, cz = S.wx * ry - S.wy * rx + S.vz;
  const cn = cx * nx + cy * ny + cz * nz;
  let tx = cx - nx * cn, ty = cy - ny * cn, tz = cz - nz * cn;
  const tl = Math.hypot(tx, ty, tz);
  S.vx += nx * jn; S.vy += ny * jn; S.vz += nz * jn;
  if (tl > 1e-5) {
    const k = -Math.min(mu * jn, tl / 2.5) / tl; tx *= k; ty *= k; tz *= k;
    S.vx += tx; S.vy += ty; S.vz += tz;
    const f = 1.5 / (BR * BR);
    S.wx += (ry * tz - rz * ty) * f; S.wy += (rz * tx - rx * tz) * f; S.wz += (rx * ty - ry * tx) * f;
  }
}

/** Simula un tiro. init = { p:[x,y,z], v:[x,y,z], w:[x,y,z] }, H = { s, hz, front }, h = paso de tiempo.
 *  Devuelve { inn, rimHits, boardHits, floorHits, t, minY }. */
export function simShot(init, H, h = 1 / 240, opt = {}) {
  const S = { px: init.p[0], py: init.p[1], pz: init.p[2], vx: init.v[0], vy: init.v[1], vz: init.v[2], wx: init.w[0], wy: init.w[1], wz: init.w[2] };
  const out = { inn: false, rimHits: 0, boardHits: 0, floorHits: 0, t: 0, minY: 99 };
  let onRim = false, onBoard = false;
  const maxT = opt.maxT ?? 4.5;
  for (let t = 0; t < maxT; t += h) {
    const prevY = S.py, sp = Math.hypot(S.vx, S.vy, S.vz);
    const ax = -KD * sp * S.vx + CM * (S.wy * S.vz - S.wz * S.vy);
    const ay = -G9 - KD * sp * S.vy + CM * (S.wz * S.vx - S.wx * S.vz);
    const az = -KD * sp * S.vz + CM * (S.wx * S.vy - S.wy * S.vx);
    S.vx += ax * h; S.vy += ay * h; S.vz += az * h; S.px += S.vx * h; S.py += S.vy * h; S.pz += S.vz * h;
    if (S.py < BR) {
      S.py = BR; contact(S, 0, 1, 0, 0.84, 0.55); out.floorHits++;
      if (Math.abs(S.vy) < 0.3) {
        const s2 = Math.hypot(S.vx, S.vz), d = Math.min(s2, 0.4 * h);
        if (s2 > 1e-4) { S.vx *= (s2 - d) / s2; S.vz *= (s2 - d) / s2; }
        const k = 1 - 0.4 * h; S.wx *= k; S.wy *= k; S.wz *= k;
      }
      if (opt.stopOnFloor) { out.t = t; return out; }
    }
    const dn = (S.pz - H.front) * -H.s;                                            // tablero
    if (dn < BR && dn > -0.15 && Math.abs(S.px) < 0.95 && S.py > 2.85 && S.py < 4.02) {
      S.pz = H.front - H.s * BR; contact(S, 0, 0, -H.s, 0.62, 0.45);
      if (!onBoard) out.boardHits++; onBoard = true;
    } else onBoard = false;
    const dx = S.px, dz = S.pz - H.hz, rad = Math.hypot(dx, dz);
    let touched = false;
    if (rad > 1e-6 && rad < 0.7 && Math.abs(S.py - RIM_Y) < 0.3) {                 // aro
      const cx = dx * RIM_C / rad, cz = H.hz + dz * RIM_C / rad;
      let tx = S.px - cx, ty = S.py - RIM_Y, tz = S.pz - cz;
      const d = Math.hypot(tx, ty, tz), m = BR + RIM_TUBE;
      if (d < m && d > 1e-6) {
        tx /= d; ty /= d; tz /= d;
        S.px = cx + tx * m; S.py = RIM_Y + ty * m; S.pz = cz + tz * m;
        contact(S, tx, ty, tz, 0.6, 0.35); touched = true;
        if (!onRim) out.rimHits++;
      }
    }
    onRim = touched;
    if (!out.inn && prevY > RIM_Y && S.py <= RIM_Y && rad < RIM_IN - 0.005) { out.inn = true; out.tIn = t; if (opt.stopOnIn) { out.t = t; return out; } }
    if (rad < 0.25 && S.py < RIM_Y + 0.02 && S.py > RIM_Y - 0.45) { const k = 1 - 6 * h; S.vx *= k; S.vy *= k; S.vz *= k; }
    out.minY = Math.min(out.minY, S.py);
    if (S.py < RIM_Y - 0.7 && S.vy < 0) { out.t = t; return out; }
    out.t = t;
  }
  return out;
}

/* Velocidad inicial (sin arrastre) para llegar a una altura dada a una distancia horizontal dada con el ángulo th. */
function seedSpeed(dist, hd, th) {
  const den = 2 * Math.cos(th) ** 2 * (dist * Math.tan(th) - hd);
  return den > 0.05 ? Math.sqrt(G9 * dist * dist / den) : 0;
}
const HSET = [1 / 240, 1 / 300, 1 / 360, 1 / 480];          // el juego usa pasos de 1/240 a 1/480 s según los cuadros por segundo
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

/** Bandeja a tablero: busca un tiro que pegue en el vidrio y entre (con varios pasos de tiempo). Devuelve { v, w } o null. */
export function solveBank(p0, H, opt = {}) {
  const zb = H.front - H.s * BR, spin = opt.spin ?? 8, found = [];
  const bxs = [-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45], bys = [3.25, 3.45, 3.65], ths = [0.95, 1.1, 1.25, 1.4], scs = [0.94, 0.97, 1.0, 1.03, 1.06];
  for (const bx of bxs) for (const by of bys) for (const th of ths) {
    const dx = bx - p0[0], dz = zb - p0[2], dist = Math.hypot(dx, dz); if (dist < 0.4) continue;
    const sp0 = seedSpeed(dist, by - p0[1], th); if (!sp0) continue;
    const ux = dx / dist, uz = dz / dist;
    for (const sc of scs) {
      const sp = sp0 * sc, init = { p: p0, v: [ux * Math.cos(th) * sp, Math.sin(th) * sp, uz * Math.cos(th) * sp], w: [uz * spin, 0, -ux * spin] };
      const r = simShot(init, H, HSET[0], { stopOnIn: true }); if (!r.inn || r.boardHits < 1) continue;
      let ok = true; for (let i = 1; i < HSET.length; i++) { const q = simShot(init, H, HSET[i], { stopOnIn: true }); if (!q.inn) { ok = false; break; } }
      if (ok) found.push({ v: init.v, w: init.w, bx, by, th, rim: r.rimHits, t: r.tIn });
    }
  }
  if (!found.length) return null;
  found.sort((a, b) => a.rim - b.rim || a.t - b.t);
  return pick(found.slice(0, Math.min(6, found.length)));
}

/** Giro sobre el aro: busca un tiro suave que toque el aro varias veces y termine ADENTRO (wantIn) o AFUERA. Devuelve { v, w } o null. */
export function solveRoll(p0, H, wantIn, opt = {}) {
  const spin = opt.spin ?? 5, tries = opt.tries ?? 260, found = [];
  const ax = p0[0], az = p0[2] - H.hz, a0 = Math.atan2(az, ax);               // desde dónde llega el tiro (ángulo respecto del aro)
  for (let i = 0; i < tries; i++) {
    const phi = a0 + rnd(-1.3, 1.3), rr = RIM_C + rnd(-0.04, 0.11), th = rnd(1.2, 1.5);
    const tx = rr * Math.cos(phi), tz = H.hz + rr * Math.sin(phi);
    const dx = tx - p0[0], dz = tz - p0[2], dist = Math.hypot(dx, dz); if (dist < 0.4) continue;
    const sp0 = seedSpeed(dist, RIM_Y + 0.05 - p0[1], th); if (!sp0) continue;
    const sp = sp0 * rnd(0.94, 1.06), ux = dx / dist, uz = dz / dist;
    const init = { p: p0, v: [ux * Math.cos(th) * sp, Math.sin(th) * sp, uz * Math.cos(th) * sp], w: [uz * spin, 0, -ux * spin] };
    const r = simShot(init, H, HSET[0]); if (r.inn !== wantIn || r.rimHits < 2) continue;
    let ok = true, hits = r.rimHits;
    for (let k = 1; k < HSET.length; k++) { const q = simShot(init, H, HSET[k]); if (q.inn !== wantIn || q.rimHits < 1) { ok = false; break; } hits = Math.min(hits, q.rimHits + 1); }
    if (ok) { found.push({ v: init.v, w: init.w, hits, t: r.t }); if (found.length >= 6) break; }
  }
  if (!found.length) return null;
  found.sort((a, b) => b.hits - a.hits);
  return pick(found.slice(0, Math.min(5, found.length)));
}

/** Pase de pique: elige en qué punto del piso pegar para que la pelota llegue a la cintura del compañero.
 *  from = [x,y,z], to = [x,z] (donde estará el receptor). Devuelve { v, w, tf } o null. */
export function solveBounce(from, to, opt = {}) {
  const dx = to[0] - from[0], dz = to[1] - from[1], d = Math.hypot(dx, dz); if (d < 1.2) return null;
  const ux = dx / d, uz = dz / d, want = opt.height ?? 1.15;
  let best = null;
  for (const spd of opt.speed ? [opt.speed] : [10, 12, 14, 16]) {
    for (let f = 0.40; f <= 0.85; f += 0.025) {
      const T1 = f * d / spd, vy = (BR - from[1] + 0.5 * G9 * T1 * T1) / T1;
      const init = { p: from, v: [ux * spd, vy, uz * spd], w: [uz * -3, 0, ux * 3] };
      const r = simBounceHeight(init, d, ux, uz, from);
      if (!r || r.floorHits !== 1) continue;
      const err = Math.abs(r.h - want) + (spd - 12) ** 2 * 0.002;     // prefiere velocidades parecidas a las del pase normal
      if (!best || err < best.err) best = { err, v: init.v, w: init.w, tf: r.t, h: r.h };
    }
  }
  return best && Math.abs(best.h - want) < 0.4 ? best : null;
}
function simBounceHeight(init, d, ux, uz, from) {
  const H = { s: 1, hz: 99, front: 99 };                                   // aro lejos: solo importa el piso
  const h = 1 / 240; let floorHits = 0;
  const S = { px: init.p[0], py: init.p[1], pz: init.p[2], vx: init.v[0], vy: init.v[1], vz: init.v[2], wx: init.w[0], wy: init.w[1], wz: init.w[2] };
  for (let t = 0; t < 3; t += h) {
    const sp = Math.hypot(S.vx, S.vy, S.vz);
    S.vx += (-KD * sp * S.vx + CM * (S.wy * S.vz - S.wz * S.vy)) * h; S.vy += (-G9 - KD * sp * S.vy + CM * (S.wz * S.vx - S.wx * S.vz)) * h; S.vz += (-KD * sp * S.vz + CM * (S.wx * S.vy - S.wy * S.vx)) * h;
    S.px += S.vx * h; S.py += S.vy * h; S.pz += S.vz * h;
    if (S.py < BR) { S.py = BR; contact(S, 0, 1, 0, 0.84, 0.55); floorHits++; }
    if ((S.px - from[0]) * ux + (S.pz - from[2]) * uz >= d * 0.96) return { h: S.py, t, floorHits };
  }
  return null;
}
