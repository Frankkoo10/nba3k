/* ============================================================================
   ÍCONOS (v65) · los 30 de las cartas ICON_*.webp (ultimate/cards.zip)
   Una sola fuente de datos para tres cosas:
     1) Partido casual: los 30 se reparten en dos equipos de 15, "All-Star Rojo" (ASR) y "All-Star Azul" (ASB).
     2) Ultimate Team: cada carta se enlaza con su jugador (ultimate/ut-data.js) aunque no haya Supabase.
     3) supabase/009_all_star_iconos.sql (se genera con tools/gen_iconos_sql.mjs a partir de este archivo).
   Cada ícono trae: la carta (id, equipo de la carta, media, posición), el reparto (side, titular/suplente),
   medidas reales (pulgadas / libras), aspecto y las 6 estadísticas IMPRESAS en la carta
   [TIR, PAS, REG, DEF, REB, VEL] (escala de carta, llegan hasta 110). De ahí salen los 21 atributos estilo 2K26
   (escala 25–99): primero un cálculo por posición (derive) y después los ajustes propios de cada jugador (ov).
   ========================================================================== */

const K = '#15120f', DB = '#2b1d14', BR = '#4a3222', BK = '#111111';

/* id · name · pos · ovr (media de la carta) · team (equipo de la carta) · num (número de la carta) · gnum (número en el partido si repetía dentro del equipo)
   side: ASR | ASB · st: titular · o: orden en el banco · h: pulgadas · w: libras · look: [piel, peinado, color, barba, vincha, manga, color manga, rodillera]
   s: [TIR, PAS, REG, DEF, REB, VEL] de la carta · ov: ajustes propios (escala 2K, 25–99) */
const RAW = [
  // ----------------------------- ALL-STAR ROJO -----------------------------
  { id: 'ICON_MAGIC', name: 'Magic Johnson', pos: 'PG', ovr: 106, team: 'LAL', num: 32, side: 'ASR', st: 1, h: 81, w: 230, look: [3, 1, K, 0], s: [92, 110, 104, 92, 98, 96],
    ov: { three: 72, mid: 78, close: 88, ft: 85, layup: 92, dunkD: 80, dunkS: 60, post: 85, intD: 70, perD: 85, steal: 88, block: 55, oreb: 55, dreb: 80, strength: 78 } },
  { id: 'ICON_KOBE', name: 'Kobe Bryant', pos: 'SG', ovr: 103, team: 'LAL', num: 24, side: 'ASR', st: 1, h: 78, w: 212, look: [3, 1, K, 0, null, 'R', BK], s: [106, 92, 102, 100, 78, 102],
    ov: { three: 90, mid: 98, close: 96, ft: 90, layup: 97, dunkD: 95, dunkS: 70, post: 88, steal: 88, block: 55, intD: 55, perD: 94, strength: 66, stamina: 95 } },
  { id: 'ICON_DRJ', name: 'Julius Erving', pos: 'SF', ovr: 99, team: 'PHI', num: 6, side: 'ASR', st: 1, h: 78, w: 210, look: [4, 3, K, 1], s: [92, 90, 98, 92, 88, 106],
    ov: { three: 55, mid: 85, close: 90, ft: 78, layup: 99, dunkD: 99, dunkS: 90, post: 72, steal: 80, block: 80, perD: 80, intD: 72, strength: 74, vertical: 99, speed: 92, handle: 88, oreb: 78, dreb: 76 } },
  { id: 'ICON_DUNCAN', name: 'Tim Duncan', pos: 'PF', ovr: 102, team: 'SAS', num: 21, side: 'ASR', st: 1, h: 83, w: 250, look: [3, 0, K, 0], s: [100, 90, 82, 104, 106, 88],
    ov: { three: 45, mid: 90, close: 97, ft: 72, post: 97, dunkS: 92, dunkD: 78, intD: 98, perD: 70, block: 94, steal: 62, strength: 90, handle: 66, vertical: 74, speed: 70 } },
  { id: 'ICON_KAREEM', name: 'Kareem Abdul-Jabbar', pos: 'C', ovr: 107, team: 'LAL', num: 33, side: 'ASR', st: 1, h: 86, w: 225, look: [3, 1, K, 0, null, null, null], s: [108, 92, 84, 104, 110, 90],
    ov: { three: 30, mid: 80, close: 99, ft: 76, post: 99, dunkS: 86, dunkD: 80, layup: 90, handle: 62, speedBall: 55, intD: 96, block: 97, perD: 50, steal: 58, oreb: 80, dreb: 95, speed: 78, stamina: 92 } },
  { id: 'ICON_STOCKTON', name: 'John Stockton', pos: 'PG', ovr: 95, team: 'UTA', num: 12, side: 'ASR', o: 1, h: 73, w: 175, look: [0, 1, BR, 0], s: [86, 106, 92, 92, 64, 88],
    ov: { three: 82, mid: 90, close: 78, ft: 90, layup: 85, dunkD: 35, dunkS: 25, post: 40, steal: 99, block: 35, perD: 90, intD: 40, strength: 55, oreb: 28, dreb: 50, passAcc: 99, handle: 88, vertical: 50, stamina: 99 } },
  { id: 'ICON_NASH', name: 'Steve Nash', pos: 'PG', ovr: 93, team: 'PHX', num: 13, side: 'ASR', o: 8, h: 75, w: 178, look: [0, 10, BR, 1], s: [104, 108, 100, 64, 60, 86],
    ov: { three: 99, mid: 95, close: 80, ft: 99, layup: 88, dunkD: 28, dunkS: 25, post: 45, steal: 55, block: 25, perD: 50, intD: 30, passAcc: 99, handle: 98, speedBall: 90, strength: 40, oreb: 25, dreb: 40, speed: 80 } },
  { id: 'ICON_WADE', name: 'Dwyane Wade', pos: 'SG', ovr: 96, team: 'MIA', num: 3, side: 'ASB', o: 10, h: 76, w: 220, look: [3, 0, K, 1], s: [92, 92, 100, 96, 78, 100],
    ov: { three: 70, mid: 88, close: 92, ft: 78, layup: 99, dunkD: 94, dunkS: 55, post: 62, steal: 90, block: 85, perD: 92, intD: 55, strength: 70 } },
  { id: 'ICON_WEST', name: 'Jerry West', pos: 'SG', ovr: 99, team: 'LAL', num: 44, side: 'ASB', o: 7, h: 74, w: 175, look: [0, 1, BR, 0], s: [104, 92, 96, 96, 72, 94],
    ov: { three: 88, mid: 99, close: 90, ft: 88, layup: 94, dunkD: 60, dunkS: 25, steal: 88, perD: 94, block: 50, strength: 52, oreb: 35, dreb: 52 } },
  { id: 'ICON_MILLER', name: 'Reggie Miller', pos: 'SG', ovr: 92, team: 'IND', num: 31, side: 'ASR', o: 9, h: 79, w: 195, look: [3, 1, K, 0], s: [106, 80, 82, 82, 58, 84],
    ov: { three: 99, mid: 97, close: 85, ft: 98, layup: 80, dunkD: 45, dunkS: 25, post: 40, steal: 72, block: 35, perD: 78, intD: 40, strength: 48, speed: 78, handle: 75, vertical: 60 } },
  { id: 'ICON_BAYLOR', name: 'Elgin Baylor', pos: 'SF', ovr: 94, team: 'LAL', num: 22, side: 'ASR', o: 4, h: 77, w: 225, look: [4, 2, K, 0], s: [92, 86, 90, 82, 96, 96],
    ov: { three: 62, mid: 90, close: 94, ft: 78, layup: 96, dunkD: 90, dunkS: 80, post: 85, steal: 70, block: 55, perD: 76, intD: 70, oreb: 86, dreb: 88, strength: 78 } },
  { id: 'ICON_DIRK', name: 'Dirk Nowitzki', pos: 'PF', ovr: 98, team: 'DAL', num: 41, side: 'ASR', o: 5, h: 84, w: 245, look: [0, 9, '#d8c27a', 0], s: [106, 86, 84, 84, 94, 80],
    ov: { three: 93, mid: 99, close: 92, ft: 95, layup: 78, dunkD: 55, dunkS: 58, post: 88, intD: 70, perD: 55, steal: 48, block: 60, oreb: 55, dreb: 88, speed: 58, vertical: 50, handle: 62, speedBall: 50, strength: 70 } },
  { id: 'ICON_SHAQ', name: "Shaquille O'Neal", pos: 'C', ovr: 104, team: 'LAL', num: 34, side: 'ASR', o: 6, h: 85, w: 325, look: [4, 0, K, 1], s: [102, 84, 74, 104, 110, 94],
    ov: { three: 25, mid: 40, close: 99, ft: 45, post: 99, dunkS: 99, dunkD: 96, block: 90, intD: 96, strength: 99, speed: 72, vertical: 80, handle: 48, speedBall: 45, perD: 30, steal: 50, passAcc: 74, oreb: 92, dreb: 96, stamina: 78 } },
  { id: 'ICON_HAKEEM', name: 'Hakeem Olajuwon', pos: 'C', ovr: 102, team: 'HOU', num: 34, gnum: 4, side: 'ASR', o: 7, h: 84, w: 255, look: [3, 1, K, 1], s: [98, 84, 88, 104, 106, 92],
    ov: { three: 40, mid: 82, close: 96, ft: 78, post: 99, dunkS: 90, dunkD: 88, block: 97, intD: 96, steal: 82, perD: 60, handle: 70, speedBall: 62, speed: 82, strength: 85 } },
  { id: 'ICON_ROBINSON', name: 'David Robinson', pos: 'C', ovr: 95, team: 'SAS', num: 50, side: 'ASR', o: 10, h: 85, w: 250, look: [3, 1, K, 0], s: [88, 78, 76, 102, 104, 96],
    ov: { three: 30, mid: 74, close: 90, ft: 78, post: 88, dunkD: 92, dunkS: 92, intD: 96, perD: 62, steal: 78, block: 95, handle: 58, speedBall: 62, oreb: 88, dreb: 95, strength: 85, speed: 90 } },
  { id: 'ICON_IVERSON', name: 'Allen Iverson', pos: 'SG', ovr: 95, team: 'PHI', num: 3, side: 'ASR', o: 11, h: 72, w: 165, look: [4, 5, K, 1, null, 'R', BK], s: [90, 92, 108, 88, 56, 106],
    ov: { three: 78, mid: 90, close: 88, ft: 80, layup: 96, dunkD: 55, dunkS: 25, post: 40, steal: 90, block: 30, perD: 86, intD: 40, speed: 99, handle: 99, speedBall: 99, strength: 40, passAcc: 88, oreb: 28, dreb: 40, stamina: 99 } },
  // ----------------------------- ALL-STAR AZUL -----------------------------
  { id: 'ICON_OSCAR', name: 'Oscar Robertson', pos: 'PG', ovr: 100, team: 'MIL', num: 1, side: 'ASB', st: 1, h: 77, w: 220, look: [4, 2, K, 0], s: [96, 106, 98, 90, 92, 92],
    ov: { three: 62, mid: 92, close: 92, ft: 90, layup: 92, dunkD: 70, post: 84, steal: 70, block: 40, perD: 80, intD: 55, strength: 70, oreb: 50, dreb: 75 } },
  { id: 'ICON_JORDAN', name: 'Michael Jordan', pos: 'SG', ovr: 110, team: 'CHI', num: 23, side: 'ASB', st: 1, h: 78, w: 216, look: [4, 0, K, 0], s: [110, 94, 104, 108, 86, 108],
    ov: { three: 84, ft: 88, mid: 97, dunkS: 88, post: 85, block: 60 } },
  { id: 'ICON_BIRD', name: 'Larry Bird', pos: 'SF', ovr: 105, team: 'BOS', num: 33, side: 'ASB', st: 1, h: 81, w: 220, look: [0, 9, '#c9a85a', 0], s: [109, 106, 94, 92, 102, 86],
    ov: { three: 98, mid: 98, close: 90, ft: 98, layup: 85, dunkD: 55, dunkS: 45, post: 88, steal: 84, block: 52, speed: 70, vertical: 55, strength: 72, oreb: 70, dreb: 90, handle: 82 } },
  { id: 'ICON_GARNETT', name: 'Kevin Garnett', pos: 'PF', ovr: 97, team: 'MIN', num: 21, side: 'ASB', st: 1, h: 83, w: 253, look: [4, 2, K, 1], s: [92, 86, 84, 102, 104, 92],
    ov: { three: 72, mid: 92, close: 88, ft: 82, post: 88, dunkD: 85, dunkS: 80, intD: 95, perD: 88, block: 92, steal: 84, oreb: 85, dreb: 96, handle: 62, speedBall: 55, strength: 75, stamina: 99 } },
  { id: 'ICON_WILT', name: 'Wilt Chamberlain', pos: 'C', ovr: 105, team: 'PHI', num: 13, side: 'ASB', st: 1, h: 85, w: 275, look: [4, 2, K, 1], s: [100, 88, 76, 106, 110, 100],
    ov: { three: 25, ft: 50, mid: 62, close: 93, post: 96, dunkS: 99, dunkD: 92, block: 96, intD: 98, vertical: 96, speed: 85, strength: 96, stamina: 99, steal: 55, perD: 40, oreb: 90, dreb: 99 } },
  { id: 'ICON_ISIAH', name: 'Isiah Thomas', pos: 'PG', ovr: 94, team: 'DET', num: 11, side: 'ASB', o: 1, h: 73, w: 185, look: [3, 1, K, 0], s: [88, 102, 104, 90, 60, 98],
    ov: { three: 82, mid: 88, close: 80, ft: 82, layup: 93, dunkD: 55, dunkS: 25, post: 40, steal: 90, block: 30, perD: 90, intD: 42, handle: 97, passAcc: 96, speed: 95, strength: 50, oreb: 28, dreb: 45 } },
  { id: 'ICON_DREXLER', name: 'Clyde Drexler', pos: 'SG', ovr: 93, team: 'POR', num: 22, side: 'ASB', o: 2, h: 79, w: 222, look: [3, 1, K, 1], s: [90, 88, 92, 90, 84, 102],
    ov: { three: 72, mid: 84, close: 90, ft: 78, layup: 97, dunkD: 96, dunkS: 70, post: 62, steal: 86, block: 62, perD: 86, intD: 60, oreb: 60, dreb: 80, strength: 72, handle: 85 } },
  { id: 'ICON_GERVIN', name: 'George Gervin', pos: 'SG', ovr: 92, team: 'SAS', num: 44, side: 'ASR', o: 12, h: 79, w: 185, look: [3, 1, K, 1], s: [102, 78, 92, 70, 62, 92],
    ov: { three: 78, mid: 98, close: 94, ft: 86, layup: 96, dunkD: 70, dunkS: 40, post: 55, steal: 62, block: 55, perD: 60, intD: 40, strength: 45, handle: 85, speedBall: 80, oreb: 35, dreb: 55 } },
  { id: 'ICON_RUSSELL', name: 'Bill Russell', pos: 'C', ovr: 104, team: 'BOS', num: 6, side: 'ASB', o: 3, h: 82, w: 215, look: [4, 2, K, 0], s: [90, 86, 72, 110, 110, 96],
    ov: { three: 25, mid: 50, close: 70, ft: 55, post: 60, dunkS: 80, dunkD: 85, layup: 78, block: 99, intD: 99, perD: 60, steal: 75, oreb: 90, dreb: 99, strength: 78, vertical: 92, speed: 88, stamina: 99 } },
  { id: 'ICON_PIPPEN', name: 'Scottie Pippen', pos: 'SF', ovr: 95, team: 'CHI', num: 33, gnum: 8, side: 'ASB', o: 4, h: 79, w: 228, look: [4, 1, K, 1], s: [84, 94, 94, 100, 86, 96],
    ov: { three: 78, mid: 80, close: 82, ft: 70, layup: 92, dunkD: 94, dunkS: 75, post: 62, steal: 96, block: 76, perD: 98, intD: 80, passAcc: 90, strength: 72, oreb: 55, dreb: 80 } },
  { id: 'ICON_BARKLEY', name: 'Charles Barkley', pos: 'PF', ovr: 96, team: 'PHX', num: 34, side: 'ASB', o: 5, h: 78, w: 252, look: [4, 0, K, 0], s: [88, 84, 84, 86, 104, 90],
    ov: { three: 60, mid: 74, close: 90, ft: 74, post: 90, dunkD: 88, dunkS: 85, intD: 78, perD: 60, steal: 72, block: 48, oreb: 92, dreb: 97, strength: 92, handle: 70 } },
  { id: 'ICON_MALONE', name: 'Karl Malone', pos: 'PF', ovr: 96, team: 'UTA', num: 32, side: 'ASB', o: 6, h: 81, w: 250, look: [4, 0, K, 1], s: [94, 82, 72, 94, 100, 88],
    ov: { three: 35, mid: 92, close: 92, ft: 78, post: 92, dunkD: 86, dunkS: 90, intD: 92, perD: 65, steal: 78, block: 70, oreb: 88, dreb: 96, strength: 96, stamina: 99 } },
  { id: 'ICON_MOSES', name: 'Moses Malone', pos: 'C', ovr: 94, team: 'HOU', num: 24, side: 'ASB', o: 8, h: 82, w: 215, look: [4, 2, K, 1], s: [88, 74, 72, 94, 108, 84],
    ov: { three: 25, mid: 50, close: 90, ft: 76, post: 92, dunkS: 90, dunkD: 80, block: 70, intD: 88, steal: 62, perD: 40, oreb: 99, dreb: 96, strength: 92, handle: 48, speed: 72 } },
  { id: 'ICON_EWING', name: 'Patrick Ewing', pos: 'C', ovr: 93, team: 'NYK', num: 33, gnum: 5, side: 'ASB', o: 9, h: 84, w: 240, look: [4, 1, K, 0, null, null, null, 'L'], s: [92, 72, 66, 96, 102, 78],
    ov: { three: 30, mid: 90, close: 92, ft: 78, post: 92, dunkS: 88, dunkD: 70, block: 88, intD: 94, perD: 50, steal: 55, oreb: 82, dreb: 93, strength: 90, handle: 50, speed: 62 } },
];

/* ---- de las 6 estadísticas de la carta a los 21 atributos de 2K ---- */
const f = v => Math.round(v <= 90 ? v : 90 + (v - 90) * 0.45);      // 110 → 99 · 100 → 94 · 90 → 90 (las cartas pasan de 99, los atributos no)
const cl = v => Math.max(25, Math.min(99, Math.round(v)));
export function deriveAttrs(pos, [T, P, R, D, B, V], w, ov = {}) {
  const G = pos === 'PG' || pos === 'SG', big = pos === 'C', pf = pos === 'PF', sf = pos === 'SF';
  const t = f(T), p = f(P), r = f(R), d = f(D), b = f(B), v = f(V);
  const x = {
    close: t + (big ? 3 : pf ? 2 : G ? -2 : 0), mid: t + (big ? -12 : pf ? -4 : sf ? -1 : 0), three: t + (big ? -34 : pf ? -14 : sf ? -4 : -3), ft: t + (big ? -14 : pf ? -6 : 0),
    layup: (t + v) / 2 + (G ? 2 : big ? -2 : 0), dunkD: v - (G ? 10 : sf ? 4 : 4), dunkS: big ? (d + v) / 2 : pf ? v - 12 : v - 30, post: big ? (t + b) / 2 - 2 : pf ? (t + b) / 2 - 8 : sf ? t - 20 : t - 30,
    passAcc: p, handle: r, speedBall: (r + v) / 2 - (big ? 6 : 0),
    intD: d + (big ? 0 : pf ? -2 : sf ? -12 : -26), perD: d + (G ? 2 : sf ? 0 : pf ? -12 : -30), steal: d + (G ? -2 : sf ? -6 : pf ? -16 : -22), block: d + (big ? -2 : pf ? -12 : sf ? -22 : -38),
    oreb: b + (G ? -8 : sf ? -4 : 0), dreb: b + (G ? -2 : 0),
    speed: v, strength: 48 + (w - 170) * 0.35, vertical: v - (big ? 14 : pf ? 6 : 0), stamina: 80 + (V - 80) * 0.3,
  };
  const out = {};
  for (const k of Object.keys(x)) out[k] = cl(ov[k] ?? x[k]);
  return out;
}

/* ---- jugador listo para el juego (con "ovr" tope 99: la media de la carta, que llega a 110, vive en la carta) ---- */
const COL = { close: 'close_shot', mid: 'mid_range', three: 'three_point', ft: 'free_throw', layup: 'driving_layup', dunkD: 'driving_dunk', dunkS: 'standing_dunk', post: 'post_control',
  passAcc: 'pass_accuracy', handle: 'ball_handle', speedBall: 'speed_with_ball', intD: 'interior_def', perD: 'perimeter_def', steal: 'steal', block: 'block', oreb: 'off_rebound', dreb: 'def_rebound',
  speed: 'speed', strength: 'strength', vertical: 'vertical', stamina: 'stamina' };
export const ICON_COLS = COL;

export const ICON_TEAMS = [
  { ab: 'ASR', name: 'All-Star Rojo', color1: '#D71D3A', color2: '#0B1B3F' },
  { ab: 'ASB', name: 'All-Star Azul', color1: '#1E5BD8', color2: '#FFC72C' },
];

const BYSIDE = { ASR: [], ASB: [] };
export const ICONS = RAW.map(p => {
  const at = deriveAttrs(p.pos, p.s, p.w, p.ov);
  const L = p.look, row = {
    team_ab: p.side, name: p.name, number: p.gnum ?? p.num, position: p.pos, is_starter: !!p.st, sort_order: p.st ? 0 : p.o || 99, ovr: Math.min(99, p.ovr),
    height_in: p.h, weight_lb: p.w, skin_tone: L[0], hair_style: L[1], hair_color: L[2], beard: L[3], headband: L[4] || null, arm_sleeve: L[5] || null, sleeve_color: L[6] || null,
    knee_sleeve: L[7] || null, knee_color: L[7] ? BK : null, active: true,
  };
  for (const k of Object.keys(COL)) row[COL[k]] = at[k];
  const ic = { id: p.id, name: p.name, pos: p.pos, ovr: p.ovr, team: p.team, num: p.num, gnum: p.gnum ?? p.num, side: p.side, st: !!p.st, stats: p.s, row };
  BYSIDE[p.side].push(row);
  return ic;
});
export const ICON_BY_ID = new Map(ICONS.map(i => [i.id, i]));
/** Filas (formato de la tabla `players`) de un All-Star: sirven de plantel si Supabase no está o todavía no corriste el 009. */
export const iconRows = ab => (BYSIDE[ab] || []).map(r => ({ ...r }));
