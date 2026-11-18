/* ============================================================================
   Utilidades del modo carrera: números al azar con semilla, fechas (en días enteros) y formatos.
   Todo el motor del modo carrera es "puro" (no toca la pantalla), así que se puede probar en Node.
   ========================================================================== */

/** Generador al azar con semilla (mulberry32). La partida guarda la semilla para que sea reproducible. */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.state = () => a; r.set = s => { a = s >>> 0; };
  return r;
}
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const round = Math.round;
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const gauss = (rng, mu = 0, sd = 1) => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
export const shuffle = (rng, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function weighted(rng, items, w) { let t = 0; const ws = items.map((x, i) => (t += w(x, i))); const r = rng() * t; const k = ws.findIndex(v => r < v); return items[k < 0 ? items.length - 1 : k]; }
export const sum = (a, f = x => x) => a.reduce((t, x) => t + f(x), 0);
export const avg = (a, f = x => x) => (a.length ? sum(a, f) / a.length : 0);
export const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---- fechas: un día = un entero (días desde 1970-01-01, en UTC) ---- */
const MS = 86400000;
export const day = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / MS);
export const ymd = n => { const t = new Date(n * MS); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() }; };   // dow: 0 domingo … 6 sábado
export const dow = n => ymd(n).dow;
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = MES, DIAS = DIA;
export const fmtDay = (n, long = false) => { const t = ymd(n); return long ? `${DIA[t.dow]} ${t.d} de ${MES[t.m - 1]} de ${t.y}` : `${DIA[t.dow].slice(0, 3)} ${t.d} ${MES[t.m - 1].slice(0, 3)}`; };
export const fmtShort = n => { const t = ymd(n); return `${t.d} ${MES[t.m - 1].slice(0, 3)}`; };
/** Primer día de la semana `w` (0 dom … 6 sáb) que cae en o después de la fecha `n`. */
export const onOrAfter = (n, w) => n + ((w - dow(n) + 7) % 7);
export const money = m => (m >= 100 ? `$${Math.round(m)}M` : m >= 10 ? `$${m.toFixed(1)}M` : `$${m.toFixed(2)}M`);
export const signed = v => (v > 0 ? `+${v}` : `${v}`);
export const ordinal = n => `${n}º`;
export const uid = (() => { let k = 0; return () => ++k; })();
