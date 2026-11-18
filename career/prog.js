import { clamp, gauss, pick, avg } from './util.js';
import { AK, AGROUP, GROUPS, PROFILES, baseOvr, ovrNow, wavg } from './gen.js';

/* ============================================================================
   Evolución de los jugadores.
   · FORMA (en la temporada): cada partido compara lo que rindió con lo esperado para su overall. Esa forma (−6 a +6) se suma al overall
     que ves y al que usa el partido 3D. También cuenta la moral.
   · ACTUALIZACIONES (cada ~15 partidos): si rinde de más (y es joven) suben de verdad atributos; si rinde de menos o es veterano, bajan.
   · ENTRENAMIENTO (cada semana): le asignás un foco y acumula XP; con XP completa sube un atributo de ese grupo.
   · EVOLUCIÓN DE VERANO (15 de agosto): el salto grande del año, según edad, potencial y perfil de crecimiento.
   El overall nunca pasa de 100 (los atributos, de 99).
   ========================================================================== */
export const ATH = new Set(['speed', 'vertical', 'speedBall', 'stamina']);          // físicos: caen antes
export const OVR_CAP = 100;

export function setForm(p, perf, mins) {
  const w = clamp(mins / 30, 0.15, 1.2);
  p.perf = (p.perf || 0) * (1 - 0.11 * w) + perf * 0.11 * w;
  refreshForm(p);
}
/** forma = rendimiento reciente + moral. Sin partido tiende a 0. */
export function refreshForm(p) {
  const tgt = (p.perf || 0) * 3.6 + ((p.mor ?? 65) - 62) / 14;
  p.frm = clamp(Math.round(tgt * 10) / 10, -6, 6);
  const b = baseOvr(p); if (b + p.frm > OVR_CAP) p.frm = OVR_CAP - b;
}
export function restForm(p) { p.perf = (p.perf || 0) * 0.97; refreshForm(p); }

/** Sube/baja un atributo del jugador (1 punto). Devuelve el nombre o null. */
export function bump(rng, p, dir, group = null, pos = true) {
  const keys = group ? AGROUP[group] : AK;
  const cand = keys.filter(k => (dir > 0 ? p.at[k] < 99 : p.at[k] > 25) && !(dir < 0 && !ATH.has(k) && rng() < 0.45));
  if (!cand.length) return null;
  const k = cand.reduce((best, c) => { const sc = (dir > 0 ? -p.at[c] : p.at[c]) + gauss(rng, 0, 7) + (ATH.has(c) && dir < 0 ? 8 : 0) + (wavg({ [c]: 100 }, p.pos) > 8 ? 6 : 0); return !best || sc > best[0] ? [sc, c] : best; }, null)[1];
  if (dir > 0 && baseOvr(p) >= Math.max(p.pot + 1, 40) && rng() > 0.15) return null;                // ya llegó a su techo
  p.at[k] = clamp(p.at[k] + dir, 25, 99);
  return k;
}

/** Actualización de mitad de temporada (cada ~15 partidos con minutos). Devuelve { d, attrs: [...] } con el cambio de overall. */
export function rateUpdate(rng, p, mpOver = null) {
  const before = baseOvr(p), gap = p.pot - before, ch = [];
  const perf = p.perf || 0, mp = mpOver ?? (p.st && p.st.gp ? p.st.min / p.st.gp : 0);
  let steps = 0;
  if (perf > 0.55 && mp >= 12 && gap > 0 && p.age <= 29) steps = perf > 1.1 ? 2 : 1;
  else if (perf < -0.6 && mp >= 12 && p.age >= 26) steps = perf < -1.2 ? -2 : -1;
  else if (p.age >= 33 && rng() < 0.25) steps = -1;
  else if (p.age <= 22 && gap > 5 && mp >= 14 && rng() < 0.35) steps = 1;
  const grp = p.tr?.focus && p.tr.focus !== 'auto' && steps > 0 ? p.tr.focus : null;
  for (let i = 0; i < Math.abs(steps); i++) { const k = bump(rng, p, Math.sign(steps), grp && rng() < 0.6 ? grp : null); if (k) ch.push(k); }
  return { d: baseOvr(p) - before, attrs: ch };
}

/* ---- entrenamiento semanal ---- */
export const INTENSITY = { low: { name: 'Suave', xp: 0.7, inj: 0.8, mor: 1 }, normal: { name: 'Normal', xp: 1, inj: 1, mor: 0 }, high: { name: 'Intensa', xp: 1.35, inj: 1.25, mor: -1 } };
/** Una semana de entrenamiento. Devuelve el atributo mejorado o null. */
export function trainWeek(rng, p, focus, intensity = 'normal', coachLvl = 2, mult = 1) {
  if (!focus || p.lg !== 'NBA' || (p.inj && p.inj.d > 0 && p.inj.d > 20)) return null;
  const I = INTENSITY[intensity] || INTENSITY.normal, young = p.age <= 22 ? 1.5 : p.age <= 25 ? 1.2 : p.age <= 29 ? 0.9 : p.age <= 33 ? 0.6 : 0.35;
  const room = clamp((p.pot - baseOvr(p) + 4) / 14, 0.15, 1.6);
  const gain = (7 + coachLvl * 2.4) * I.xp * young * room * mult * (0.8 + rng() * 0.4);
  p.tr.xp = (p.tr.xp || 0) + gain;
  if (p.tr.xp >= 100) { p.tr.xp -= 100; const k = bump(rng, p, 1, focus); if (k) return k; }
  return null;
}
export const autoFocus = p => {                   // el grupo más flojo de su posición que más pesa en su overall
  const sc = GROUPS.map(g => [g, AGROUP[g].reduce((t, k) => t + p.at[k], 0) / AGROUP[g].length + (g === 'Físico' ? (p.age > 28 ? 12 : 0) : 0)]);
  const w = { PG: { Tiro: 1.2, Creación: 1.15, Defensa: 1, Definición: 0.9, Rebote: 0.7, Físico: 0.9 }, SG: { Tiro: 1.25, Creación: 1.05, Defensa: 1, Definición: 1, Rebote: 0.7, Físico: 0.9 }, SF: { Tiro: 1.1, Creación: 0.95, Defensa: 1.05, Definición: 1, Rebote: 0.9, Físico: 1 }, PF: { Tiro: 0.8, Creación: 0.7, Defensa: 1.15, Definición: 1.1, Rebote: 1.1, Físico: 1 }, C: { Tiro: 0.7, Creación: 0.6, Defensa: 1.2, Definición: 1.1, Rebote: 1.2, Físico: 0.95 } }[p.pos];
  return sc.map(([g, v]) => [g, (100 - v) * w[g]]).sort((a, b) => b[1] - a[1])[0][0];
};

/** Salto de verano: cambia atributos según edad / potencial / perfil. Devuelve { d, attrs } (d = cambio de overall). */
export function offseason(rng, p, o = {}) {
  const prof = PROFILES[p.gp] || PROFILES[1], before = baseOvr(p), age = p.age;     // `age` ya es la del año que viene
  const coach = o.coachLvl ?? 2, perfBonus = clamp((p.hist?.length ? (p.hist[p.hist.length - 1].perf || 0) : 0), -1.2, 1.5);
  let d;
  if (age < prof.decl) {
    const young = age <= 20 ? 0.34 : age <= 22 ? 0.3 : age <= 24 ? 0.26 : age <= 26 ? 0.2 : 0.14;
    const gap = Math.max(0, p.pot - before);
    d = gap * young * prof.rate * (age >= prof.peak ? 0.35 : 1) + gauss(rng, 0.2, p.gp === 5 ? 2.6 : 1.4) + perfBonus * 0.9 + (coach - 2) * 0.35 + (p.gp === 3 && age <= 23 && rng() < 0.18 ? 4 + rng() * 3 : 0);
    if (gap <= 0) d = Math.min(d, 1.2) + gauss(rng, 0, 0.6) * 0.6;
  } else {
    const yrs = age - prof.decl + 1;
    d = -(0.33 * yrs + 0.15 + rng() * 0.8) - (age >= 37 ? 1.2 : 0) + (coach - 2) * 0.25;
  }
  d = clamp(d, -7, 9);
  const attrs = [];
  let tot = 0;
  for (const k of AK) {
    let dk = d * (0.75 + (wavg({ [k]: 100 }, p.pos) > 6 ? 0.5 : 0) ) + gauss(rng, 0, 1.3);
    if (ATH.has(k)) dk += age >= 28 ? -(age - 27) * 0.14 : age <= 23 ? 0.5 : 0;
    else if (age >= 24 && age <= 31 && !['steal', 'block'].includes(k)) dk += 0.25;
    if (p.tr?.focus && AGROUP[p.tr.focus]?.includes(k) && d > -2) dk += 0.8;
    dk = Math.round(dk); if (!dk) continue;
    const nv = clamp(p.at[k] + dk, 25, 99); if (nv !== p.at[k]) { tot += nv - p.at[k]; if (Math.abs(dk) >= 2) attrs.push([k, nv - p.at[k]]); p.at[k] = nv; }
  }
  p.frm = 0; p.perf = (p.perf || 0) * 0.3;
  const after = baseOvr(p);
  if (after > p.pot) p.pot = after;
  if (age >= 27) p.pot = Math.min(p.pot, Math.max(after, p.pot - 1 - (age >= 29 ? 2 : 0)));
  if (age >= 29) p.pot = after;
  return { d: after - before, attrs, before, after };
}

/** Moral (0-100): se actualiza con minutos, rol, resultados y trato. */
export const moodLabel = m => (m >= 85 ? 'Encantado' : m >= 68 ? 'Contento' : m >= 50 ? 'Conforme' : m >= 33 ? 'Molesto' : 'Muy molesto');
export const roleMin = role => ({ estrella: 31, titular: 26, 'rotación': 16, banco: 7, prospecto: 0 }[role] ?? 10);
export function setRole(p, rank, teamSize = 13) {
  const o = ovrNow(p);
  p.role = p.lg !== 'NBA' ? 'prospecto' : rank <= 1 && o >= 80 ? 'estrella' : rank <= 4 ? 'titular' : rank <= 9 ? 'rotación' : 'banco';
  if (p.gl) p.role = 'prospecto';
}
