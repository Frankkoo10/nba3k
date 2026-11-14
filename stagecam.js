/* ============================================================================
   Cámaras del menú previo (sin Three.js, para que la versión plana funcione aunque falle el 3D).
   Las usan stage.js (la cámara 3D) y prematch.js (cancha, nombres y anillos), así todo coincide con los pies de cada jugador.
   ========================================================================== */

/* ---- cámaras: posición, punto al que mira y campo de visión vertical ---- */
export const SCENES = {
  kits:   { pos: [0, 1.25, 6.6], target: [0, 0.98, 0], fov: 30, minAspect: 1.3 },
  lineup: { pos: [0, 5.4, 8.6],  target: [0, 0.6, -0.9], fov: 36, minAspect: 1.5 },
};

/** Aleja la cámara si el recuadro es muy angosto, para que entren todos los jugadores. */
export function fitCfg(name, w, h) {
  const c = SCENES[name], asp = w / Math.max(1, h), f = Math.max(1, c.minAspect / Math.max(0.2, asp));
  const [tx, ty, tz] = c.target;
  return { ...c, pos: c.pos.map((v, i) => [tx, ty, tz][i] + (v - [tx, ty, tz][i]) * f) };
}

/** Proyecta un punto del mundo (metros) a píxeles del recuadro w×h. Es la misma matemática de una PerspectiveCamera con lookAt. */
export function project(cfg, w, h, x, y, z) {
  const [px, py, pz] = cfg.pos, [tx, ty, tz] = cfg.target;
  let fx = tx - px, fy = ty - py, fz = tz - pz; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;             // right = f × up
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;                                  // up = right × f
  const vx = x - px, vy = y - py, vz = z - pz;
  const xc = vx * rx + vz * rz, yc = vx * ux + vy * uy + vz * uz, zc = vx * fx + vy * fy + vz * fz;
  const k = (h / 2) / (zc * Math.tan(cfg.fov * Math.PI / 360));                               // píxeles por metro a esa profundidad
  return { x: w / 2 + xc * k, y: h / 2 - yc * k, k, zc };
}
