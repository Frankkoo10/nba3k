/* ============================================================================
   Público y ambiente de los partidos (crowd.js) — v61
   Todo se sintetiza con Web Audio (no baja nada): funciona en TODOS los partidos
   (casual, online, carrera, Ultimate Team) porque cuelga del mismo motor de main.js.

   · Colchón de estadio: murmullo de gente + rumor grave, más fuerte cuando el partido está parejo y es el 4.º cuarto.
   · Reacciones: festejo (con aplausos y "wooo"), "ooooh" cuando el tiro pega en el aro, "awww" cuando anota el rival,
     abucheo, tiro libre en silencio.
   · "DE-FENSE, DE-FENSE" con aplausos y pisadas cuando el rival tiene la pelota (más seguido en el cierre).
   · Bocina al final de cada cuarto.

   Si querés sonidos REALES: poné los archivos en assets/audio/ y anotalos en assets/audio/lista.json (ver LEEME.txt).
   Nombres que reconoce: crowd_loop (colchón en loop), cheer, cheer_big, ooh, groan, boo, defense, horn.
   Lo que no esté, lo genera el sintetizador.
   ========================================================================== */

let ctx = null, master = null, comp = null, bedGain = null, noiseW = null, noiseP = null;
let vol = 0.8, on = false, level = 0, T = 0, started = false, suspendT = 0, realBed = null;
let oppT = 0, nextChant = 25, nextShout = 6, lastReact = -9, lastRim = -9, chanting = 0, hush = 0, oohAt = 0;
const BUF = {};                                  // archivos reales (opcionales)
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ------------------------------ motor ------------------------------ */
function ensure() {
  if (ctx) return ctx;
  try { ctx = globalThis.__CROWD_CTX || new (globalThis.AudioContext || globalThis.webkitAudioContext)(); } catch { ctx = null; return null; }
  master = ctx.createGain(); master.gain.value = vol * 0.9;
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 16; comp.ratio.value = 5; comp.attack.value = 0.006; comp.release.value = 0.25;
  master.connect(comp); comp.connect(ctx.destination);
  noiseW = noiseBuf(false); noiseP = noiseBuf(true);
  buildBed(); loadFiles();
  return ctx;
}
function noiseBuf(pink) {
  const n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  if (!pink) { for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;                 // ruido rosa (Paul Kellet)
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return b;
}
const src = (buf, loop = true) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; s.loopStart = 0; s.start(0, Math.random() * 3); return s; };
const bp = (f, q, type = 'bandpass') => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
const gn = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
function lfo(rate, depth, param) { const o = ctx.createOscillator(), g = gn(depth); o.frequency.value = rate; o.connect(g); g.connect(param); o.start(); return o; }

/** Colchón de estadio: ruido rosa filtrado + varias "bocas" (ruido con formantes de vocal modulado a ritmo de sílaba). */
function buildBed() {
  bedGain = gn(0); bedGain.connect(master);
  const lowN = src(noiseP), lowF = bp(260, 0.5, 'lowpass'), lowG = gn(0.55); lowN.connect(lowF); lowF.connect(lowG); lowG.connect(bedGain);          // rumor grave de tribuna
  const midN = src(noiseP), midF = bp(650, 0.6), midG = gn(0.9); midN.connect(midF); midF.connect(midG); midG.connect(bedGain); lfo(0.17, 0.25, midG.gain);
  const hiN = src(noiseP), hiF = bp(2100, 0.7), hiG = gn(0.32); hiN.connect(hiF); hiF.connect(hiG); hiG.connect(bedGain); lfo(0.11, 0.12, hiG.gain);
  [[520, 1500, 3.1], [660, 1150, 4.3], [430, 1750, 5.2], [580, 1000, 2.6], [740, 1300, 3.8]].forEach(([f1, f2, r], i) => {    // murmullo hablado
    const n = src(noiseW), a = bp(f1, 6), b = bp(f2, 8), g = gn(0.0), m = gn(0.2); n.connect(a); n.connect(b); a.connect(g); b.connect(g); g.connect(m); m.connect(bedGain);
    g.gain.value = 0.5; lfo(r, 0.45, g.gain); lfo(0.07 + i * 0.03, 40, a.frequency);
  });
}

/* ------------------------------ archivos reales (opcionales) ------------------------------ */
async function loadFiles() {
  try {
    const r = await fetch('assets/audio/lista.json', { cache: 'no-cache' }); if (!r.ok) return;
    const list = (await r.json()).archivos || [];
    for (const f of list) {
      try {
        const rr = await fetch('assets/audio/' + f); if (!rr.ok) continue;
        const buf = await ctx.decodeAudioData(await rr.arrayBuffer()); BUF[f.replace(/\.[^.]+$/, '').toLowerCase()] = buf;
      } catch { /* archivo roto: se ignora */ }
    }
    if (BUF.crowd_loop && !realBed) { realBed = src(BUF.crowd_loop); realBed.connect(bedGain); }
  } catch { /* sin archivos: queda el sintetizador */ }
}
function playFile(names, gain = 1) {
  const k = [].concat(names).find(n => BUF[n]); if (!k) return false;
  const s = ctx.createBufferSource(), g = gn(gain); s.buffer = BUF[k]; s.connect(g); g.connect(master); s.start(); return true;
}

/* ------------------------------ piezas de síntesis ------------------------------ */
const VOW = { e: [550, 1750], o: [420, 820], u: [330, 720], a: [760, 1250] };         // formantes de vocales
/** Coro: n voces de diente de sierra desafinadas por una vocal. Devuelve el nodo de salida. */
function choir(t, dur, { n = 8, f0 = 200, spread = 0.5, vowel = 'e', glide = 1, gain = 0.5, att = 0.05, rel = 0.12, vib = 5.5, jitter = 0.02 }) {
  const out = gn(0), [F1, F2] = VOW[vowel], a = bp(F1, 4), b = bp(F2, 6), mix = gn(1);
  mix.connect(a); mix.connect(b); a.connect(out); b.connect(out); out.connect(master);
  out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(gain, t + att); out.gain.setValueAtTime(gain, t + Math.max(att, dur - rel)); out.gain.linearRampToValueAtTime(0, t + dur);
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator(), t0 = t + rnd(0, jitter), f = f0 * Math.pow(2, rnd(-spread, spread) / 2.4 * (Math.random() < 0.3 ? 2 : 1));
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t0); o.frequency.linearRampToValueAtTime(f * glide, t0 + dur);
    const v = lfo(vib * rnd(0.85, 1.15), f * 0.012, o.frequency), og = gn(1 / n); o.connect(og); og.connect(mix); o.start(t0); o.stop(t + dur + 0.05); v.stop(t + dur + 0.05);
  }
  return out;
}
/** Ráfaga de ruido filtrada con sobre de volumen. */
function noiseBurst(t, dur, { f = 1500, q = 0.8, gain = 0.3, att = 0.01, type = 'bandpass', white = true, f2 }) {
  const s = src(white ? noiseW : noiseP, true), fl = bp(f, q, type), g = gn(0); s.connect(fl);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  fl.connect(g); g.connect(master);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.stop(t + dur + 0.05);
}
const clap = (t, g = 0.2) => { noiseBurst(t, 0.07, { f: 1700, q: 1.1, gain: g, att: 0.002 }); noiseBurst(t, 0.03, { f: 3800, q: 0.8, gain: g * 0.6, att: 0.001, type: 'highpass' }); };
const stomp = (t, g = 0.5) => { const o = ctx.createOscillator(), e = gn(0); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16); o.connect(e); e.connect(master); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.start(t); o.stop(t + 0.25); };
function applause(t, dur, g) { for (let i = 0, n = Math.round(dur * 26); i < n; i++) { const k = t + Math.pow(Math.random(), 0.8) * dur; clap(k, g * rnd(0.3, 1) * (1 - (k - t) / dur * 0.6)); } }

/* ------------------------------ reacciones ------------------------------ */
function cheerSynth(a) {
  const t = ctx.currentTime + 0.02, d = 1.3 + a * 2.0;
  noiseBurst(t, d, { f: 900, q: 0.7, gain: 0.32 * a, att: 0.16, white: false, f2: 1600 });
  noiseBurst(t, d * 0.8, { f: 2400, q: 0.6, gain: 0.14 * a, att: 0.2 });
  choir(t, 0.9 + a * 0.9, { n: 7, f0: 300, vowel: 'a', glide: 1.22, gain: 0.30 * a, att: 0.14, rel: 0.5 });           // "¡waaa!"
  if (a > 0.55) choir(t + 0.12, 0.8 + a * 0.6, { n: 5, f0: 440, vowel: 'o', glide: 1.3, gain: 0.16 * a, att: 0.12, rel: 0.4 });
  applause(t + 0.2, 1.1 + a * 1.9, 0.2 * a);
  if (a > 0.8) for (let i = 0; i < 3; i++) stomp(t + 0.1 + i * 0.22, 0.28);
}
function oohSynth(a) {
  const t = ctx.currentTime + 0.02;
  choir(t, 0.55, { n: 8, f0: 270, vowel: 'o', glide: 1.12, gain: 0.30 * a, att: 0.08, rel: 0.2 });                  // "oooo..."
  choir(t + 0.5, 0.9, { n: 8, f0: 300, vowel: 'o', glide: 0.7, gain: 0.30 * a, att: 0.05, rel: 0.5 });              // "...ooh" que cae
  noiseBurst(t, 1.3, { f: 700, q: 0.6, gain: 0.12 * a, att: 0.1, white: false });
}
function groanSynth(a) {
  const t = ctx.currentTime + 0.02;
  choir(t, 1.3, { n: 9, f0: 170, vowel: 'u', glide: 0.78, gain: 0.34 * a, att: 0.12, rel: 0.6, spread: 0.8 });                // "uuuuh" grave
  noiseBurst(t, 1.4, { f: 480, q: 0.6, gain: 0.14 * a, att: 0.12, white: false });
}
function booSynth(a) {
  const t = ctx.currentTime + 0.02;
  choir(t, 1.8, { n: 10, f0: 140, vowel: 'u', glide: 0.95, gain: 0.38 * a, att: 0.2, rel: 0.7, spread: 0.9, vib: 3 });
  noiseBurst(t, 1.9, { f: 420, q: 0.6, gain: 0.14 * a, att: 0.2, white: false });
}
/** Un hincha suelto que grita algo. */
function shoutSynth() {
  const t = ctx.currentTime + 0.02, f = rnd(110, 210);
  choir(t, rnd(0.35, 0.7), { n: 2, f0: f, vowel: Math.random() < 0.5 ? 'a' : 'e', glide: rnd(0.8, 1.25), gain: rnd(0.12, 0.2), att: 0.04, rel: 0.2, spread: 0.2 });
}
/** "DE-FENSE, DE-FENSE": dos sílabas por vuelta, aplauso en cada una y pisada fuerte en "DE". */
function chantSynth(reps = 4, strength = 1) {
  const P = 0.92, t0 = ctx.currentTime + 0.08;
  for (let r = 0; r < reps; r++) {
    const t = t0 + r * P, g = (0.55 + 0.45 * Math.min(1, (r + 1) / 3)) * strength, base = rnd(150, 175);
    choir(t, 0.3, { n: 11, f0: base * 1.12, vowel: 'e', glide: 1.04, gain: 0.34 * g, att: 0.025, rel: 0.07, spread: 1.0, vib: 0, jitter: 0.045 });             // "DE"
    stomp(t, 0.42 * g); clap(t, 0.22 * g);
    const t2 = t + 0.42;
    choir(t2, 0.34, { n: 11, f0: base * 0.92, vowel: 'e', glide: 0.9, gain: 0.30 * g, att: 0.02, rel: 0.1, spread: 1.0, vib: 0, jitter: 0.045 });                 // "FEN-"
    noiseBurst(t2 + 0.2, 0.2, { f: 6200, q: 0.6, gain: 0.12 * g, att: 0.03, type: 'highpass' });                                                            // "-SE"
    clap(t2, 0.22 * g); stomp(t2, 0.22 * g);
  }
  chanting = reps * P;
}
function hornSynth(g = 0.32) {
  const t = ctx.currentTime + 0.02, out = gn(0), lp = bp(2300, 0.7, 'lowpass'); lp.connect(out); out.connect(master);
  out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(g, t + 0.02); out.gain.setValueAtTime(g, t + 0.85); out.gain.linearRampToValueAtTime(0, t + 1.0);
  for (const [f, w, v] of [[196, 'sawtooth', 1], [198.5, 'sawtooth', 0.8], [392, 'square', 0.35], [98, 'square', 0.4]]) { const o = ctx.createOscillator(), og = gn(v * 0.5); o.type = w; o.frequency.value = f; o.connect(og); og.connect(lp); o.start(t); o.stop(t + 1.05); }
}

/* ------------------------------ API ------------------------------ */
export function setVolume(v) { vol = clamp(+v || 0, 0, 1); if (master) master.gain.setTargetAtTime(vol * 0.9, ctx.currentTime, 0.05); }
export const getVolume = () => vol;
/** Se llama al empezar cada partido (ya hubo un gesto del usuario, así que el navegador deja sonar). */
export function start() {
  if (!ensure()) return;
  T = 0; oppT = 0; nextChant = rnd(18, 32); nextShout = rnd(4, 9); lastReact = lastRim = -9; chanting = 0; hush = 0; oohAt = 0; started = true;
  ctx.resume?.().catch?.(() => {});
}
const live = () => ctx && on && vol > 0;
/** Festejo del público local. amount ≈ segundos de festejo del motor (0.5 – 3.2). */
export function cheer(sec = 1.5) {
  if (!live() || T - lastReact < 0.3) return; lastReact = T;
  const a = clamp(sec / 3.2, 0.25, 1);
  if (playFile(a > 0.7 ? ['cheer_big', 'cheer'] : ['cheer', 'cheer_big'], 0.5 + a * 0.5)) return;
  cheerSynth(a);
}
/** Anotó el rival: suspiro de la tribuna. */
export function groan(sec = 1.5) { if (!live() || T - lastReact < 0.3) return; lastReact = T; const a = clamp(sec / 2.4, 0.3, 1); if (!playFile(['groan', 'boo'], 0.4 + a * 0.4)) groanSynth(a); }
export function boo(a = 0.8) { if (!live()) return; if (!playFile(['boo', 'groan'], 0.6)) booSynth(a); }
/** El tiro pega en el aro / el tablero: "ooooh". */
/** Se agenda 0.7 s después: si la pelota termina entrando, el festejo lo cancela. */
export function rim() { if (!live() || T - lastRim < 3 || Math.random() > 0.7) return; lastRim = T; oohAt = T + 0.7; }
export function horn() { if (!ctx || !on) return; if (!playFile('horn', 0.7)) hornSynth(); }
export function chant(reps = 4, strength = 1) { if (!live()) return; if (!playFile('defense', 0.8)) chantSynth(reps, strength); else chanting = 4; }
/** Tiro libre: la tribuna se calla un momento. */
export function hushFor(s = 3) { hush = Math.max(hush, s); }

/**
 * Se llama en cada cuadro. c = { on: hay partido jugándose, lead: tus puntos − rival, q: cuarto, ball: 'me' | 'opp' | null, dead: pelota muerta, ft: tiro libre }
 */
export function tick(dt, c) {
  const want = !!c.on && started;
  if (want !== on) { on = want; if (ctx) { if (on) { ctx.resume?.().catch?.(() => {}); suspendT = 0; } } }
  if (!ctx) return;
  if (!on) {                                                              // pausa / menú: se apaga suave y después se congela todo
    if (bedGain) bedGain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    suspendT += dt; if (suspendT > 1.6 && ctx.state === 'running') ctx.suspend?.().catch?.(() => {});
    return;
  }
  T += dt; hush = Math.max(0, hush - dt);
  if (oohAt && T >= oohAt) { const fresh = lastReact < oohAt - 0.7; oohAt = 0; if (fresh && !c.dead && !c.ft) { if (!playFile('ooh', 0.7)) oohSynth(rnd(0.7, 1)); } } chanting = Math.max(0, chanting - dt);
  const close = clamp(1 - Math.abs(c.lead || 0) / 18, 0, 1), late = c.q >= 5 ? 1 : c.q === 4 ? 1 : c.q === 3 ? 0.5 : 0.2, clutch = close * late;
  let lv = 0.5 + 0.2 * close + 0.3 * clutch;
  if (c.dead) lv *= 0.82;
  if (c.ft || hush > 0) lv *= 0.3;
  if (chanting > 0) lv *= 0.75;
  level += (lv - level) * Math.min(1, dt * 2);
  bedGain.gain.setTargetAtTime(level * 0.42, ctx.currentTime, 0.35);
  if (realBed) bedGain.gain.setTargetAtTime(level * 0.6, ctx.currentTime, 0.35);
  if (c.ft) hush = 1.5;
  /* "DE-FENSE": el rival tiene la pelota y ya pasó un rato */
  if (c.ball === 'opp' && !c.dead && !c.ft) oppT += dt; else oppT = Math.max(0, oppT - dt * 2);
  if (oppT > 3.2 && T >= nextChant && chanting <= 0) {
    const p = 0.28 + 0.45 * clutch + ((c.lead || 0) < 0 ? 0.15 : 0);
    if (Math.random() < p) { chant(clutch > 0.55 ? 5 : 3, 0.8 + 0.3 * clutch); nextChant = T + rnd(32, 55); oppT = 0; }
    else nextChant = T + 9;
  }
  /* hinchas sueltos */
  if (T >= nextShout && !c.dead && chanting <= 0) { nextShout = T + rnd(6, 16); if (!c.ft && hush <= 0 && !BUF.crowd_loop) shoutSynth(); }
}
