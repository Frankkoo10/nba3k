/* ============================================================================
   Estadísticas → juego (v31).
   Todas las curvas que convierten los atributos de la base (escala 25–99, como NBA 2K)
   en cosas que se ven en la cancha. Están en un solo archivo para poder ajustarlas fácil.
   Referencia: 70 = jugador "normal" (no cambia nada); 99 = élite; 40 = muy flojo.
   ========================================================================== */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const R = (v, d = 70) => (Number.isFinite(v) ? v : d);

export const r01 = r => clamp((R(r) - 25) / 74, 0, 1);

/* ---- Tiro ---- */
/** Rating de la zona desde donde se tira: triple · tiro cercano+bandeja (< 2.5 m) · media distancia. Sin atributos 2K usa "shooting". */
export function zoneRating(info, three, d) {
  if (!info.detailed) return R(info.shooting);
  return three ? info.three : d < 2.5 ? (info.close + info.layup) / 2 : info.mid;
}
/** Multiplicador de efectividad. 70 → 1. Sube suave hacia 99 (×1.26) y cae más rápido hacia abajo (40 → ×0.52). */
export function shotMul(r, scale = 1) {
  r = R(r);
  return Math.max(0.3, r >= 70 ? 1 + (r - 70) * 0.009 * scale : 1 - (70 - r) * 0.016 * scale);
}
/** Tiros desde muy lejos (más allá del arco normal): solo los que tienen rango de verdad pueden tirarlos con chances. */
export const deepMul = three => clamp((R(three) - 60) / 35, 0.12, 1.25);
/** Cuánto baja (o sube) el umbral de calidad para animarse a tirar: los buenos tiradores tiran más y desde más lejos; los malos, solo muy solos. */
export function shootBias(info, three, d) {
  const zr = zoneRating(info, three, d);
  return -(zr - 70) * (three && info.detailed ? 0.004 : 0.0025) - (R(info.ovr, 75) - 75) * 0.0012;
}
/** Para el humano: ventana de "tiro perfecto" y ruido del tiro según el rating de la zona. */
export function releaseSkill(info, three, d) {
  const k = r01(zoneRating(info, three, d));
  return { window: 0.012 + 0.040 * k, noise: 1.6 - 0.9 * k };
}

/* ---- Físico ---- */
/** Velocidad máxima: 70 → ×0.965 · 90 → ×1.075 · 99 → ×1.10 · 50 → ×0.855 · 40 → ×0.80 */
export const speedMul = info => clamp(0.965 + (R(info.speed) - 70) * 0.0055, 0.80, 1.10);
/** Aceleración / cambios de dirección. */
export const accelMul = info => clamp(0.90 + (R(info.speed) - 60) * 0.005, 0.75, 1.2);
/** Qué tan rápido se cansa (menor = aguanta más). 99 → ×0.65 · 70 → ×1 · 40 → ×1.36 */
export const drainMul = info => clamp(1 - (R(info.stamina) - 70) * 0.012, 0.55, 1.6);
/** Qué tan rápido recupera energía. 99 → ×1.35 · 70 → ×1 · 40 → ×0.64 */
export const recoverMul = info => clamp(1 + (R(info.stamina) - 70) * 0.012, 0.55, 1.4);
/** Salto (tiros, tapones, rebotes). */
export const jumpMul = info => clamp(0.93 + (R(info.vertical) - 60) * 0.0035, 0.85, 1.12);
/** Tendencia a intentar robos / tapones según el rating (1 = normal). */
export const tend = r => clamp(1 + (R(r) - 65) * 0.016, 0.35, 1.6);
/** ¿Puede meter un mate? (mate en movimiento + salto). Los que no, hacen bandeja. */
export const canDunk = info => R(info.dunkD) * 0.65 + R(info.vertical) * 0.35 >= 50;
/** Puntaje de rebote (se suma a la cercanía a la pelota). */
export const reboundScore = (info, off, scale) =>
  (R(off ? info.oreb : info.dreb) - 70) * 0.02 + (R(info.strength) - 70) * 0.007 + (R(info.vertical) - 70) * 0.006 + (scale - 1) * 4;
