/* ============================================================================
   Sincronización del partido online (sin dependencias: se puede probar en Node).

   El anfitrión simula todo y manda "snapshots" ~20 veces por segundo. El invitado los guarda en un buffer y dibuja el
   partido ~100 ms en el pasado, interpolando entre los dos snapshots que rodean ese instante (así se ve fluido aunque
   lleguen con jitter). Reloj: se estima el desfase entre relojes con el mínimo de (llegada − envío), que descarta los snapshots demorados.
   ========================================================================== */

export const SNAP_HZ = 20;         // por Supabase (relay)
export const SNAP_HZ_P2P = 30;     // v71: con conexión directa (WebRTC) se manda más seguido: menos demora y más fluido
export const STATES = ['free', 'dribble', 'charge', 'shoot', 'dunk'];
export const MODES = ['loose', 'held', 'shot', 'pass', 'dead'];
export const r2 = v => Math.round(v * 100) / 100;
export const r3 = v => Math.round(v * 1000) / 1000;

export const lerp = (a, b, k) => a + (b - a) * k;
export const lerpAngle = (a, b, k) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

export class SnapBuffer {
  constructor(max = 24) { this.list = []; this.off = null; this.max = max; this.lastRecv = 0; this.count = 0; }
  push(s, recv) {
    this.count++; this.lastRecv = recv;
    const o = recv - s.T;
    this.off = this.off === null ? o : Math.min(o, this.off + 0.4);          // sube muy de a poco (deriva de relojes) y baja al instante con un snapshot rápido
    const L = this.list;
    if (L.length && s.n <= L[L.length - 1].n) return false;                 // llegó desordenado o repetido: se descarta
    L.push(s); if (L.length > this.max) L.shift();
    return true;
  }
  /** Dónde estamos en el tiempo del anfitrión, `delay` ms antes del último snapshot. */
  at(now, delay) { return now - (this.off ?? 0) - delay; }
  /** Devuelve { a, b, k } para el instante `t` (tiempo del anfitrión). Antes del primero o después del último se queda quieto en ese. */
  sample(t) {
    const L = this.list; if (!L.length) return null;
    if (t <= L[0].T) return { a: L[0], b: L[0], k: 0 };
    const last = L[L.length - 1];
    if (t >= last.T) return { a: last, b: last, k: 0 };
    let i = L.length - 1; while (i > 0 && L[i - 1].T > t) i--;
    const a = L[i - 1], b = L[i], span = b.T - a.T;
    return { a, b, k: span > 0 ? (t - a.T) / span : 0 };
  }
  get latest() { return this.list[this.list.length - 1] || null; }
  reset() { this.list.length = 0; this.off = null; this.count = 0; }
}

/** Interpola dos filas numéricas desde `from` (los extremos como el ángulo se tratan aparte). */
export function lerpRow(ra, rb, k, from, out) {
  for (let i = from; i < ra.length; i++) out[i] = lerp(ra[i], rb[i], k);
  return out;
}
