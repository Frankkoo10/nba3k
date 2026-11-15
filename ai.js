/* ============================================================================
   Inteligencia artificial de los bots (tus compañeros y el rival).
   Cada bot decide cada pocas décimas de segundo qué hacer según la situación:
   - con la pelota: tira si está bien ubicado, pasa al compañero más libre, penetra, hace cruces o se acerca al aro;
   - sin la pelota (ataque): busca su lugar en la cancha, hace cortes al aro y se abre para recibir;
   - en defensa: marca a su hombre del lado del aro, presiona al que tiene la pelota, intenta robar, salta a taponar
     y ayuda cuando un rival penetra;
   - en rebotes: bloquea y salta a buscar la pelota.
   La dificultad (fácil / difícil / extremo) cambia velocidad, tiempo de reacción, puntería, agresividad defensiva, etc.
   ========================================================================== */

const hyp = Math.hypot, rnd = Math.random;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const COURT_X = 7.62, COURT_Z = 14.325;

/* ---- Perfiles de dificultad ----
   opp  = el rival.  ally = tus compañeros de equipo (siempre juegan "decente", en cualquier dificultad).
   spd: velocidad · think: segundos entre decisiones · shotThr: calidad mínima para tirar (menor = tira más)
   acc: puntería · stealAtt/stealSucc/blockAtt: robos y tapones · tight: presión defensiva (0 suelto … 1 pegado)
   help: ayuda defensiva · passErr: error en los pases · moveRate: cruces por segundo · react: anticipación
   protect: cuánto cuida la pelota (más alto = se la sacan menos) · intercept: intercepta pases · stamina: ritmo de cansancio */
const BASE = {
  easy:    { spd: 0.82, think: 0.55, shotThr: 0.47, acc: 0.62, stealAtt: 0.18, stealSucc: -0.12, blockAtt: 0.12, tight: 0.15, help: 0.15, passErr: 1.7, moveRate: 0.2, react: 0.2, protect: 0.72, intercept: 0.05, stamina: 1.2, passBias: 0.10, cut: 0.5 },
  hard:    { spd: 0.96, think: 0.30, shotThr: 0.40, acc: 0.88, stealAtt: 0.40, stealSucc: 0.0, blockAtt: 0.32, tight: 0.60, help: 0.55, passErr: 1.0, moveRate: 0.55, react: 0.55, protect: 1.0, intercept: 0.12, stamina: 1.0, passBias: 0.07, cut: 0.9 },
  extreme: { spd: 1.06, think: 0.14, shotThr: 0.35, acc: 1.12, stealAtt: 0.65, stealSucc: 0.12, blockAtt: 0.60, tight: 1.0, help: 1.0, passErr: 0.55, moveRate: 1.0, react: 1.0, protect: 1.35, intercept: 0.25, stamina: 0.85, passBias: 0.05, cut: 1.2 },
};
const ALLY = { ...BASE.hard, spd: 0.97, acc: 0.85, stealAtt: 0.35, blockAtt: 0.25, tight: 0.55, protect: 1.0, intercept: 0.12 };
export const PROFILES = Object.fromEntries(Object.entries(BASE).map(([k, opp]) => [k, { opp, ally: ALLY }]));

/* ---- Estilo de juego de TU equipo (menú previo al partido, paso "Tu equipo") ----
   pace: ritmo (lento / normal / rápido) · shot: dónde busca tirar (equilibrado / triples / cerca del aro)
   pass: juego colectivo (individual / equilibrado / colectivo) · def: presión defensiva (suelta / normal / presión) */
export const STYLE_DEFAULT = { pace: 'normal', shot: 'balanced', pass: 'balanced', def: 'normal' };
export function styledProfile(base, style) {
  if (!style) return { ...base, pace: 1, threeBias: 0, insideBias: 0 };
  const st = { ...STYLE_DEFAULT, ...style };
  const pace = { slow: 0.72, normal: 1, fast: 1.4 }[st.pace] ?? 1;
  const [threeBias, insideBias] = { balanced: [0, 0], threes: [-0.06, 0.04], inside: [0.07, -0.04] }[st.shot] ?? [0, 0];
  const passD = { solo: -0.05, balanced: 0, team: 0.06 }[st.pass] ?? 0;
  const defD = { loose: -0.22, normal: 0, pressure: 0.22 }[st.def] ?? 0;
  return {
    ...base, pace, threeBias, insideBias,
    passBias: Math.max(0.0, base.passBias - passD),                                  // menor passBias = pasa más
    cut: base.cut * (st.pass === 'team' ? 1.3 : st.pass === 'solo' ? 0.7 : 1) * (0.85 + pace * 0.15),
    tight: clamp(base.tight + defD, 0, 1), help: clamp(base.help + defD * 0.7, 0, 1),
    stealAtt: base.stealAtt * (1 + defD * 1.2), stamina: base.stamina * (1 + (pace - 1) * 0.35 + defD * 0.2),
  };
}

/* ---- Puntos de ataque (por posición PG SG SF PF C): [lateral x, distancia al aro hacia la mitad de cancha] ---- */
const SPOTS = [
  [[0, 8.1], [3.0, 8.4], [-3.0, 8.4]],
  [[5.6, 5.4], [4.6, 7.0], [6.4, 1.0]],
  [[-5.6, 5.4], [-4.6, 7.0], [-6.4, 1.0]],
  [[-3.4, 3.0], [3.4, 3.0], [-6.4, 1.0]],
  [[1.4, 2.4], [-1.4, 2.4], [0, 4.4]],
];
export const spotXZ = (hoop, slot, k) => { const [u, v] = SPOTS[slot][k % 3]; return [u, hoop.hz - hoop.s * v]; };

/* ---- utilidades ---- */
function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return hyp(px - (ax + dx * t), pz - (az + dz * t));
}
function nearestOpp(G, a, x = a.pos.x, z = a.pos.z) {
  let best = null, bd = 99;
  for (const o of G.agents) if (o.active && o.team !== a.team) { const d = hyp(o.pos.x - x, o.pos.z - z); if (d < bd) { bd = d; best = o; } }
  return { o: best, d: bd };
}
/** Dirige al bot hacia un punto. Devuelve la distancia que le falta. */
function dirTo(I, a, tx, tz, opt = {}) {
  tx = clamp(tx, -COURT_X + 0.9, COURT_X - 0.9); tz = clamp(tz, -COURT_Z + 0.9, COURT_Z - 0.9);
  const dx = tx - a.pos.x, dz = tz - a.pos.z, d = hyp(dx, dz);
  if (d < (opt.stop ?? 0.25)) { I.x = I.z = 0; I.mag = 0; return d; }
  I.x = dx / d; I.z = dz / d;
  I.mag = opt.full ? 1 : clamp(d / 1.5, 0.3, 1);
  if (opt.sprint && d > (opt.sprintDist ?? 3) && !a.tired) I.sprint = true;
  return d;
}

/** Qué tan buena es una posición para tirar (0..~0.7): distancia al aro, puntería del jugador, marca y cansancio. */
export function shotQuality(G, a, x, z) {
  const hoop = G.attackHoop(a.team), d = hyp(x - 0, hoop.hz - z);
  let q = d < 2.0 ? 0.64 : d < 4.5 ? 0.50 : d < 6.5 ? 0.42 : d < 7.3 ? 0.33 : d < 8.8 ? 0.46 : d < 10.5 ? 0.27 : 0.12;
  const corner = Math.abs(x) >= 6.3 && d < 8 && d > 5.5;                 // triple de esquina
  if (corner) q = 0.46;
  const three = (d >= 7.3 && d < 8.8) || corner;
  if (three && !a.info.detailed) q *= a.slot <= 2 ? 1.08 : 0.82;           // sin atributos 2K: los de afuera tiran de tres; los pivots, menos
  // Con atributos 2K se usa el rating de la zona: cerca del aro (cercano + bandeja), media distancia o triple.
  const zone = three ? a.info.three : d < 2.5 ? (a.info.close + a.info.layup) / 2 : a.info.mid;
  q *= 1 + ((a.info.detailed ? zone : a.info.shooting) - 70) * 0.012 * (d < 2.5 ? 0.4 : 1);
  const open = clamp((nearestOpp(G, a, x, z).d - 0.7) / 2.0, 0, 1);
  q *= 0.75 + 0.25 * open;
  q *= 0.82 + 0.18 * clamp(a.stam / 0.5, 0, 1);
  return q;
}

/** Mejor compañero para pasarle. */
export function bestPass(G, a, inbound = false) {
  let best = null; const hoop = G.attackHoop(a.team), opps = G.agents.filter(o => o.active && o.team !== a.team);
  const dSelf = hyp(a.pos.x, hoop.hz - a.pos.z);
  for (const t of G.agents) {
    if (!t.active || t.team !== a.team || t === a) continue;
    const d = hyp(t.pos.x - a.pos.x, t.pos.z - a.pos.z);
    if (d < 2.2 || d > (inbound ? 16 : 22)) continue;
    let risk = 0;
    for (const o of opps) { const dist = distToSeg(o.pos.x, o.pos.z, a.pos.x, a.pos.z, t.pos.x, t.pos.z); if (dist < 0.8) risk = Math.max(risk, 1 - dist / 0.8); }
    const q = shotQuality(G, t, t.pos.x, t.pos.z), prog = (dSelf - hyp(t.pos.x, hoop.hz - t.pos.z)) / 12;
    const score = q + prog * (inbound ? 0.16 : 0.06) - risk * 0.38 - (d > 14 ? 0.05 : 0);
    if (!best || score > best.score) best = { t, score };
  }
  return best;
}

/* ---- Preparación por cuadro: quién presiona a la pelota, quién ayuda, quién va a buscar la pelota suelta ---- */
export function aiPrepare(G) {
  const B = G.B, ctx = G.ctx; ctx.primary = [null, null]; ctx.helper = [null, null]; ctx.chasers.clear();
  const h = B.holder;
  if (h) {
    const dt = 1 - h.team, own = G.ownHoop(dt);
    let bd = 99;
    for (const o of G.agents) if (o.active && o.team === dt) { const d = hyp(o.pos.x - h.pos.x, o.pos.z - h.pos.z); if (d < bd) { bd = d; ctx.primary[dt] = o; } }
    if (hyp(h.pos.x, own.hz - h.pos.z) < 6.5) {                       // penetración: el defensor más cercano al aro (que no marca la pelota) ayuda
      let hd = 99;
      for (const o of G.agents) if (o.active && o.team === dt && o !== ctx.primary[dt]) {
        const d = hyp(o.pos.x, own.hz - o.pos.z); if (d < hd) { hd = d; ctx.helper[dt] = o; }
      }
    }
  } else if (B.mode === 'loose' && !G.dead) {
    const p = G.predictBall(1.3);
    for (const t of [0, 1]) {
      const list = G.agents.filter(o => o.active && o.team === t).map(o => ({ o, d: hyp(o.pos.x - p.x, o.pos.z - p.z) })).sort((u, v) => u.d - v.d);
      list.slice(0, 2).forEach((e, i) => { if (i === 0 || e.d < list[0].d * 1.6 + 1.5) ctx.chasers.add(e.o); });
    }
  }
}

/* ---- Con la pelota ---- */
function handler(G, a, dt, I) {
  const ai = a.ai, prof = G.prof(a), hoop = G.attackHoop(a.team);
  const px = a.pos.x, pz = a.pos.z, s = hoop.s, hz = hoop.hz, dh = hyp(px, hz - pz);
  ai.holdT += dt; ai.think -= dt; ai.moveCd -= dt;
  if (a.state !== 'dribble') return;
  if (ai.inb) {                                              // saque: espera un momento y pasa
    ai.inbT -= dt;
    if (ai.inbT <= 0) { ai.inb = false; const bp = bestPass(G, a, true); if (bp) G.doPass(a, bp.t); }
    return;
  }
  const nd = nearestOpp(G, a), sc = G.shotClock;
  if (ai.think <= 0) {                                        // ---- decidir ----
    ai.think = prof.think * (0.7 + rnd() * 0.6);
    const q = shotQuality(G, a, px, pz), bp = bestPass(G, a);
    const pace = prof.pace ?? 1, three = (dh >= 7.0 && dh < 9.0) || (Math.abs(px) >= 6.3 && dh > 5.5 && dh < 8);
    let thr = prof.shotThr - (a.info.shooting - 70) * 0.002 + (ai.style - 0.5) * 0.06 - Math.min(0.1, ai.holdT * 0.012 * pace)
      + (three ? (prof.threeBias ?? 0) : dh < 6.5 ? (prof.insideBias ?? 0) : 0);          // estilo del equipo: triples / cerca del aro
    let plan = 'drive';
    if (sc < 3.0 && dh < 14) plan = 'shoot';
    else if (dh > 3.8 && ai.holdT > 0.45 / pace && q >= thr && !(nd.d < 1.0 && dh > 6.5)) plan = 'shoot';
    if (plan === 'drive' && three && ai.holdT > 0.3 && nd.d > 1.1 && q >= thr - 0.08) plan = 'shoot';      // triple tras recibir (catch & shoot)
    if (plan !== 'shoot' && bp && ai.holdT > 0.35 / pace && (bp.score > q + prof.passBias || (nd.d < 1.0 && rnd() < 0.5) || (ai.holdT > 3.2 && rnd() < 0.5))) plan = 'pass';
    ai.plan = plan; ai.passTo = bp ? bp.t : null;
  }
  if (ai.plan === 'shoot' && dh > 3.0) { G.aiShoot(a); ai.plan = 'drive'; ai.think = 0.4; return; }
  if (ai.plan === 'pass' && ai.passTo) { const ok = G.doPass(a, ai.passTo); ai.plan = 'drive'; if (ok) return; }
  // ---- penetrar hacia el aro esquivando defensores ----
  let tx = 0.6 * clamp(px, -1, 1), tz = hz - s * 0.2;
  let dx = tx - px, dz = tz - pz; const dd = hyp(dx, dz) || 1; dx /= dd; dz /= dd;
  const bx = dx, bz = dz;
  for (const o of G.agents) {
    if (!o.active || o.team === a.team) continue;
    const ox = o.pos.x - px, oz = o.pos.z - pz, od = hyp(ox, oz);
    if (od < 2.4 && od > 0.01) {
      const dot = (ox * bx + oz * bz) / od;
      if (dot > 0.15) { const sg = (bx * oz - bz * ox) > 0 ? -1 : 1, w = 1.4 * (2.4 - od) / 2.4 * dot; dx += -bz * sg * w; dz += bx * sg * w; }
    }
  }
  if (px > COURT_X - 1.6 && dx > 0) dx *= 0.15; if (px < -COURT_X + 1.6 && dx < 0) dx *= 0.15;
  if (pz > COURT_Z - 1.6 && dz > 0 && dh > 2) dz *= 0.15; if (pz < -COURT_Z + 1.6 && dz < 0 && dh > 2) dz *= 0.15;
  const l = hyp(dx, dz) || 1; I.x = dx / l; I.z = dz / l; I.mag = 1;
  const transition = pz * s < -1.5;                           // todavía en su propia mitad de cancha
  if (!a.tired && (transition ? nd.d > 1.4 : dh > 5.5 && nd.d > 1.6)) I.sprint = true;
  if (nd.d < 2.3 && a.stam > 0.35 && !a.tired) I.dribHold = true;
  if (nd.d < 1.8 && ai.moveCd <= 0 && a.stam > 0.2 && !a.tired && rnd() < prof.moveRate * dt * 2) { ai.moveCd = 0.9; I.move = true; }
  if (dh < 3.5 && G.tryDunk(a)) return;                       // bandeja o mate
}

/* ---- Ataque sin pelota ---- */
function offBall(G, a, dt, I) {
  const ai = a.ai, prof = G.prof(a), hoop = G.attackHoop(a.team), B = G.B;
  ai.t -= dt;
  if (ai.t <= 0) {
    ai.t = (1.8 + rnd() * 2.6) / (prof.pace ?? 1); ai.k = rnd() < 0.5 ? ai.k : Math.floor(rnd() * 3);
    if (B.holder && B.holder.team === a.team && rnd() < 0.3 * prof.cut) { ai.cutT = 1.3; ai.cutX = (rnd() - 0.5) * 2.6; }
  }
  let [tx, tz] = spotXZ(hoop, a.slot, ai.k);
  if (ai.cutT > 0) { ai.cutT -= dt; tx = ai.cutX; tz = hoop.hz - hoop.s * 1.5; }
  const h = B.holder;
  if (h && h !== a && hyp(tx - h.pos.x, tz - h.pos.z) < 2.6) {            // no amontonarse con el que tiene la pelota
    const ax = tx - h.pos.x, az = tz - h.pos.z, al = hyp(ax, az) || 1; tx = h.pos.x + ax / al * 3; tz = h.pos.z + az / al * 3;
  }
  dirTo(I, a, tx, tz, { sprint: true, sprintDist: 5 });
  I.face = null;
}

/* ---- Defensa ---- */
function defend(G, a, dt, I) {
  const B = G.B, h = B.holder, prof = G.prof(a), ai = a.ai, own = G.ownHoop(a.team), ctx = G.ctx;
  ai.stealT -= dt;
  if (h && h.team !== a.team && ctx.primary[a.team] === a) {       // ---- marca a la pelota
    const hx = h.pos.x, hzz = h.pos.z, dxh = 0 - hx, dzh = own.hz - hzz, dd = hyp(dxh, dzh) || 1;
    const gap = 0.95 + (1 - prof.tight) * 1.1 - (h.state === 'charge' ? 0.25 : 0);
    const k = 0.22 * prof.react;
    dirTo(I, a, hx + dxh / dd * gap + h.vel.x * k, hzz + dzh / dd * gap + h.vel.z * k, { full: true, sprint: true, stop: 0.12 });
    I.face = Math.atan2(hx - a.pos.x, hzz - a.pos.z);
    const dist = hyp(hx - a.pos.x, hzz - a.pos.z);
    if (dist < 1.3 && ai.stealT <= 0 && h.state === 'dribble' && a.grounded && !a.act && a.stunT <= 0 && !a.tired) {
      ai.stealT = 0.6 + rnd() * 0.9; if (rnd() < prof.stealAtt) G.startSteal(a);
    }
    if (h.state === 'charge' || h.state === 'shoot' || h.state === 'dunk') {          // taponar: se decide una vez por tiro, con reacción
      if (ai.seenShot !== h.shotId) { ai.seenShot = h.shotId; ai.blockPlan = dist < 2.1 && rnd() < prof.blockAtt * (h.state === 'dunk' ? 0.7 : 1); ai.blockDelay = 0.03 + (1 - prof.react) * 0.14 + rnd() * 0.06; }
      if (ai.blockPlan && a.grounded && !a.act && a.stunT <= 0 && (h.state === 'shoot' ? h.shootT >= ai.blockDelay : h.state === 'dunk' && h.D.t >= 0.06 + ai.blockDelay)) { ai.blockPlan = false; G.startBlock(a); }
    }
    return;
  }
  const m = a.mark; if (!m) return;
  let tx, tz;
  const mx = m.pos.x, mz = m.pos.z, dxo = 0 - mx, dzo = own.hz - mz, dd = hyp(dxo, dzo) || 1;
  const ballD = hyp(B.bp.x - mx, B.bp.z - mz);
  let dm = ballD < 8 ? 1.1 : 2.0 + prof.help * 0.8;
  dm += (1 - prof.tight) * 1.2;
  tx = mx + dxo / dd * Math.min(dm, dd); tz = mz + dzo / dd * Math.min(dm, dd);
  if (ballD >= 8) { const bx = B.bp.x - tx, bz = B.bp.z - tz, bl = hyp(bx, bz) || 1; tx += bx / bl * 0.8 * prof.help; tz += bz / bl * 0.8 * prof.help; }   // ayuda: se cierra hacia la pelota
  if (h && h.team !== a.team && ctx.helper[a.team] === a) {                 // ayuda de aro cuando hay penetración
    if (ai.helpRoll !== h.shotId + '|' + Math.floor(G.time / 1.2)) { ai.helpRoll = h.shotId + '|' + Math.floor(G.time / 1.2); ai.helping = rnd() < prof.help; }
    if (ai.helping) { const ex = h.pos.x - 0, ez = h.pos.z - own.hz, el = hyp(ex, ez) || 1; tx = ex / el * 1.7; tz = own.hz + ez / el * 1.7; }
  }
  dirTo(I, a, tx, tz, { sprint: true, sprintDist: 4 });
  const toMark = hyp(mx - a.pos.x, mz - a.pos.z);
  I.face = toMark < 3.2 ? Math.atan2(mx - a.pos.x, mz - a.pos.z) : Math.atan2(B.bp.x - a.pos.x, B.bp.z - a.pos.z);
  // si el que tiene la pelota va a tirar o a entrar, el ayudante también salta a taponar
  if (h && h.team !== a.team && ctx.helper[a.team] === a && ai.helping && (h.state === 'shoot' || h.state === 'dunk')) {
    if (ai.seenShot !== h.shotId) { ai.seenShot = h.shotId; ai.blockPlan = hyp(h.pos.x - a.pos.x, h.pos.z - a.pos.z) < 2.4 && rnd() < prof.blockAtt * 0.8; ai.blockDelay = 0.05 + (1 - prof.react) * 0.14 + rnd() * 0.06; }
    if (ai.blockPlan && a.grounded && !a.act && (h.state === 'shoot' ? h.shootT >= ai.blockDelay : h.state === 'dunk' && h.D.t >= 0.06 + ai.blockDelay)) { ai.blockPlan = false; G.startBlock(a); }
  }
}

/* ---- Pelota en el aire / suelta: rebotes y pelotas sueltas ---- */
function loose(G, a, dt, I) {
  const B = G.B, prof = G.prof(a), ctx = G.ctx, ai = a.ai;
  if (B.mode === 'shot' && B.shotHoop) {
    const hoop = B.shotHoop, mine = B.shooter && a.team === B.shooter.team;
    const dRim = hyp(a.pos.x, hoop.hz - a.pos.z), big = a.slot >= 3;
    const crash = big || (dRim < 5.2 && !mine) || (mine && dRim < 4.2 && ai.crash);
    if (crash) {
      if (ai.reboundK !== B.shotId) { ai.reboundK = B.shotId; ai.rjx = (rnd() - 0.5) * 2.0; ai.rjz = 0.9 + rnd() * 1.4; }
      let tx = ai.rjx, tz = hoop.hz - hoop.s * ai.rjz;
      if (!mine && a.mark && hyp(a.mark.pos.x, hoop.hz - a.mark.pos.z) < 4.5) {         // bloqueo: me pongo entre mi hombre y el aro
        tx = a.mark.pos.x * 0.55; tz = a.mark.pos.z + (hoop.hz - a.mark.pos.z) * 0.35;
      }
      dirTo(I, a, tx, tz, { full: true, sprint: true, sprintDist: 2 });
      I.face = null;
      const dBall = hyp(B.bp.x - a.pos.x, B.bp.z - a.pos.z);
      if (dBall < 1.6 && B.bp.y > 2.0 && B.bp.y < 3.7 && a.grounded && a.act == null && B.bv.y < 3) I.jump = true;
      return;
    }
    if (mine) offBall(G, a, dt, I); else defend(G, a, dt, I);
    return;
  }
  if (B.mode === 'pass') {
    if (a === B.target) { dirTo(I, a, B.bp.x + B.bv.x * 0.3, B.bp.z + B.bv.z * 0.3, { full: true, sprint: true, sprintDist: 1.5, stop: 0.1 }); I.face = null; return; }     // sale al encuentro del pase
    if (B.passer && a.team === B.passer.team) offBall(G, a, dt, I); else defend(G, a, dt, I);
    return;
  }
  if (ctx.chasers.has(a)) {                                  // pelota suelta: ir a buscarla
    const p = G.predictBall(1.5);
    dirTo(I, a, p.x, p.z, { full: true, sprint: true, sprintDist: 1.5, stop: 0.1 });
    I.face = null;
    const dBall = hyp(B.bp.x - a.pos.x, B.bp.z - a.pos.z);
    if (dBall < 1.5 && B.bp.y > 1.9 && B.bp.y < 3.4 && a.grounded && a.act == null) I.jump = true;
    return;
  }
  if (B.possTeam === a.team) offBall(G, a, dt, I); else defend(G, a, dt, I);
}

/** Decide qué hace el bot `a` este cuadro y lo escribe en `I` (la "intención": hacia dónde, correr, saltar, cruce...). */
export function aiThink(G, a, dt, I) {
  I.x = I.z = 0; I.mag = 0; I.sprint = false; I.jump = false; I.move = false; I.dribHold = false; I.face = null;
  if (G.dead) return;                                         // pelota muerta: quietos hasta el saque
  const B = G.B;
  if (B.holder === a) handler(G, a, dt, I);
  else if (B.holder) { if (B.holder.team === a.team) offBall(G, a, dt, I); else defend(G, a, dt, I); }
  else loose(G, a, dt, I);
}

export const newAIState = () => ({ think: rnd() * 0.3, t: rnd() * 2, k: 0, cutT: 0, cutX: 0, holdT: 0, moveCd: 0, plan: 'drive', passTo: null, stealT: rnd(), style: rnd(), inb: false, inbT: 0,
  seenShot: -1, blockPlan: false, blockDelay: 0, helping: false, helpRoll: '', reboundK: -1, rjx: 0, rjz: 1, crash: rnd() < 0.5 });
