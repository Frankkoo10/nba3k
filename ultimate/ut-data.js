import { cardUrl } from './cardzip.js';
import { PLAYERS } from './data/players.js';
import { ICON_BY_ID } from './data/icons.js';
import { TEAMS, ALLSTAR_TEAMS } from '../teams.js';
import * as Auth from '../auth.js';
import { loadRoster, normalizePlayer, fallbackRoster, ATTRS, POS } from '../roster.js';

/* ============================================================================
   Ultimate Team · datos
   - CARDS: las 524 cartas (carpeta ultimate/cards/<id>.webp) con equipo, media, posición y apellido.
   - Cada carta se CONECTA con un jugador de la base (tabla `players` de Supabase):
       1) si existe la tabla `ut_cards` (supabase/007_ultimate_team.sql) y tiene `player_id`, se usa ese enlace;
       2) si no, se busca por equipo + apellido (sin tildes, sin "Jr."), después en cualquier equipo (traspasos)
          y por último con tolerancia a errores de OCR (distancia de edición ≤ 2).
     De ese jugador salen nombre completo, número, altura, peso, piel, pelo, atributos 2K y accesorios.
     La MEDIA y la posición de la carta mandan: los atributos se corren la diferencia entre la media de la carta y la de la base.
   - Si el jugador no está en la base, se arma uno a partir de la media y la posición de la carta (como hace roster.js).
   ========================================================================== */

export { POS };
/** v65 · ÍCONOS: las cartas ICON_* (92–110 de media) tienen su propia rareza, su propio precio y salen muy poco de los sobres. */
export const isIcon = c => !!c && (c.ic === true || String(c.id || c).startsWith('ICON_'));
export const CARDS = PLAYERS.map(p => ({ ...p, ...(String(p.id).startsWith('ICON_') ? { ic: true } : {}) }));
export const BY_ID = new Map(CARDS.map(c => [c.id, c]));
export { cardsReady } from './cardzip.js';
export const cardImg = id => cardUrl(id);
export const teamOf = ab => TEAMS.find(t => t.ab === ab) || ALLSTAR_TEAMS.find(t => t.ab === ab) || TEAMS[0];
export const nick = ab => String(teamOf(ab).name).split(' ').slice(-1)[0];
export const logoOf = ab => `logos/${ab}.png`;

/* ---- rarezas (según la media) ---- */
export const TIERS = [
  { k: 'base', name: 'Base', min: 0, max: 75, col: '#c98a54' },
  { k: 'plata', name: 'Plata', min: 76, max: 79, col: '#c4ccd8' },
  { k: 'oro', name: 'Oro', min: 80, max: 85, col: '#ffc53d' },
  { k: 'elite', name: 'Élite', min: 86, max: 89, col: '#4fc3ff' },
  { k: 'estrella', name: 'Estrella', min: 90, max: 94, col: '#b06bff' },
  { k: 'leyenda', name: 'Leyenda', min: 95, max: 99, col: '#ff5ac8' },
  { k: 'icono', name: 'Ícono', min: 100, max: 110, col: '#f5d27a' },          // solo las cartas ICON_* (no se mide por la media: hay íconos de 92 a 110)
];
export const tierIdx = o => { const i = TIERS.findIndex(t => o >= t.min && o <= t.max); return i < 0 ? 0 : i; };
export const tierOf = o => TIERS[tierIdx(o)];
/** Rareza de una CARTA (los íconos siempre son 'Ícono', tengan la media que tengan). */
export const tierOfCard = c => (isIcon(c) ? TIERS[6] : tierOf(c.o));
export const WALKOUT = 86;

/* ---- precios ---- (curva por tramos: las buenas valen MUCHO; Wembanyama / Jokic 99 ≈ 500.000) ---- */
const VAL_PTS = [[60, 150], [70, 500], [75, 1800], [80, 7000], [85, 25000], [90, 80000], [95, 200000], [97, 300000], [99, 500000]];
export const value = o => {
  if (o <= VAL_PTS[0][0]) return VAL_PTS[0][1];
  for (let i = 1; i < VAL_PTS.length; i++) {
    const [o1, v1] = VAL_PTS[i - 1], [o2, v2] = VAL_PTS[i];
    if (o <= o2) { const v = v1 * Math.pow(v2 / v1, (o - o1) / (o2 - o1)); return Math.max(10, Math.round(v / (v < 1000 ? 10 : 100)) * (v < 1000 ? 10 : 100)); }
  }
  return VAL_PTS[VAL_PTS.length - 1][1];
};                                                                                                   // valor "justo" de mercado
/* Íconos: valen MUCHO más que cualquier otra carta (un 92 ya sale más caro que un 99 común; Jordan 110 ≈ 2.000.000). */
const ICON_PTS = [[92, 350000], [95, 450000], [99, 700000], [104, 1100000], [110, 2000000]];
export const iconValue = o => {
  if (o <= ICON_PTS[0][0]) return ICON_PTS[0][1];
  for (let i = 1; i < ICON_PTS.length; i++) { const [o1, v1] = ICON_PTS[i - 1], [o2, v2] = ICON_PTS[i]; if (o <= o2) return Math.round(v1 * Math.pow(v2 / v1, (o - o1) / (o2 - o1)) / 1000) * 1000; }
  return ICON_PTS[ICON_PTS.length - 1][1];
};
/** Valor justo de una CARTA (usa la curva de íconos si lo es). */
export const valueOf = c => (isIcon(c) ? iconValue(c.o) : value(c.o));
export const QUICK_SELL = 500, ICON_QUICK_SELL = 25000;
export const quickSellOf = c => (isIcon(c) ? ICON_QUICK_SELL : Math.min(QUICK_SELL, value(c.o)));
export const quickSell = o => Math.min(QUICK_SELL, value(o));                                       // descarte: igual para todos (500 monedas, o menos si la carta vale menos); lo que importa es el mercado
export const fmt = n => Math.round(n).toLocaleString('es-AR');

/* ---- utilidades ---- */
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const rng = seed => { let a = (typeof seed === 'number' ? seed : hash(seed)) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, ' ').replace(/\s+/g, ' ').trim();
const title = s => String(s || '').toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\bJr\b\.?/g, 'Jr.').replace(/\bIi+\b/g, x => x.toUpperCase());
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}

/* ---- posiciones ---- */
export const POS_NAME = { PG: 'Armador', SG: 'Escolta', SF: 'Alero', PF: 'Ala-pívot', C: 'Pívot' };
export const posDist = (a, b) => Math.abs(POS.indexOf(a) - POS.indexOf(b));
/** Penalización de media por jugar fuera de posición (en el partido). */
export const posPenalty = (cardPos, slotPos) => { const d = posDist(cardPos, slotPos); return d === 0 ? 0 : d === 1 ? 2 : d === 2 ? 5 : 8; };

/* ============================== enlace carta ↔ jugador ============================== */
const LINK = new Map();            // cardId → info normalizada de la base
const EXPLICIT = new Map();        // cardId → player_id (tabla ut_cards)
let linking = null, linkStats = { total: CARDS.length, linked: 0, db: false };
export const linkInfo = () => ({ ...linkStats });
export const linkedOf = id => LINK.get(id) || null;

/** Posición efectiva de la carta (si el OCR no la leyó, sale de la base o de la media). */
export const posOf = c => (POS.includes(c.pos) ? c.pos : LINK.get(c.id)?.pos || 'SF');

export function ensureLinked() { return linking || (linking = doLink()); }
async function doLink() {
  const all = [];
  await Promise.all(TEAMS.map(t => loadRoster(t).then(r => { for (const p of [...r.starters, ...r.bench]) if (!p.generic) all.push(p); }).catch(() => {})));
  linkStats.db = all.length > 0;
  if (Auth.configured) {
    try {
      const cl = await Auth.getClient();
      const { data, error } = await cl.from('ut_cards').select('card_id,player_id');
      if (!error) for (const r of data || []) if (r.player_id != null) EXPLICIT.set(r.card_id, String(r.player_id));
    } catch { /* la tabla ut_cards todavía no existe: se enlaza por nombre */ }
  }
  const byId = new Map(all.map(p => [String(p.id), p]));
  const prepared = all.map(p => ({ p, n: norm(p.name), toks: norm(p.name).split(' ') }));
  const used = new Set();
  const finder = (c, pool, fuzzy) => {
    const s = norm(c.n); if (!s) return null;
    const st = s.split(' ');
    let best = null, bs = 1e9;
    for (const q of pool) {
      let score = 1e9;
      if (q.n === s) score = 0;
      else if (q.n.endsWith(' ' + s) || q.n.startsWith(s + ' ')) score = 1;
      else if (st.every(t => q.toks.includes(t))) score = 2;
      else if (fuzzy) { const d = Math.min(lev(q.toks[q.toks.length - 1], st[st.length - 1]), lev(q.n, s)); if (d <= 2 && (st.length === 1 || d <= 2)) score = 5 + d; }
      if (score >= 1e9) continue;
      score = score * 100 + Math.abs(q.p.ovr - c.o) + (used.has(q.p.id) ? 40 : 0);
      if (score < bs) { bs = score; best = q; }
    }
    return best?.p || null;
  };
  const order = [...CARDS].sort((a, b) => b.o - a.o);
  /* v65 · íconos: su jugador está en los planteles All-Star (tabla `players`, equipos ASR / ASB, 009_all_star_iconos.sql) o, si no hay base, en ultimate/data/icons.js.
     Se enlazan por id (nunca por apellido: hay dos Malone, Magic Johnson no es Johnson de ATL, etc.). */
  const asPool = [];
  await Promise.all(ALLSTAR_TEAMS.map(t => loadRoster(t).then(r => { for (const p of [...r.starters, ...r.bench]) if (!p.generic) asPool.push(p); }).catch(() => {})));
  for (const c of CARDS) {
    if (!isIcon(c)) continue;
    const ic = ICON_BY_ID.get(c.id); if (!ic) continue;
    const hit = asPool.find(p => norm(p.name) === norm(ic.name));
    LINK.set(c.id, hit || normalizePlayer(ic.row, teamOf(ic.side), 0));
  }
  for (const c of order) {                                         // 1) enlace explícito
    const id = EXPLICIT.get(c.id);
    if (id && byId.has(id)) { LINK.set(c.id, byId.get(id)); used.add(byId.get(id).id); }
  }
  for (const [pass, fuzzy, sameTeam] of [[1, false, true], [2, false, false], [3, true, true]]) {
    for (const c of order) {
      if (LINK.has(c.id)) continue;
      const pool = sameTeam ? prepared.filter(q => q.p.team === c.t) : prepared;
      const hit = finder(c, pool, fuzzy);
      if (hit && !(pass === 2 && used.has(hit.id))) { LINK.set(c.id, hit); used.add(hit.id); }
    }
  }
  linkStats.linked = LINK.size;
  return linkStats;
}

/* ============================== carta → jugador del partido ============================== */
const AGG = ['shooting', 'passing', 'defense', 'speed', 'rebound'];
/**
 * Arma el jugador que usa el partido a partir de una carta.
 * slotPos: posición del casillero donde juega (si no es la suya, pierde media: posPenalty).
 */
export function infoFor(card, slotPos = null) {
  const team = teamOf(card.t), L = LINK.get(card.id), cpos = posOf(card);
  const base = L || normalizePlayer({ name: title(card.n), number: 1 + (hash(card.id) % 98), position: cpos, ovr: card.o }, team, hash(card.id) % 5);
  const pen = slotPos ? posPenalty(cpos, slotPos) : 0;
  const eff = clamp(card.o - pen, 25, 99), d = eff - base.ovr;
  const info = { ...base, id: 'ut:' + card.id, cardId: card.id, team: card.t, pos: slotPos || cpos, ovr: eff, generic: false, starter: false };
  for (const [k] of ATTRS) info[k] = clamp(Math.round(base[k] + d), 25, 99);
  for (const k of AGG) info[k] = clamp(Math.round(base[k] + d), 30, 99);
  return info;
}
export const hasLink = id => LINK.has(id);
/** Atributos para mostrar en la ficha (agrupados como en 2K). */
export function attrGroups(card) {
  const info = infoFor(card), groups = {};
  for (const [k, , label, g] of ATTRS) (groups[g] ||= []).push([label, info[k]]);
  return { info, groups };
}

/* ============================== cartas para sobres / rivales ============================== */
export const TIER_BUCKETS = TIERS.map((t, i) => CARDS.filter(c => (i === 6 ? isIcon(c) : !isIcon(c) && c.o >= t.min && c.o <= t.max)));   // el 7º balde son los íconos

/** Rival armado con cartas reales: 5 titulares por posición cerca de `rating` y 5 suplentes algo más bajos. */
export function makeOpponent(rating, seed = Math.random()) {
  const R = rng(typeof seed === 'number' ? Math.floor(seed * 1e9) : seed), used = new Set();
  const pick = (pos, target, spread) => {
    let pool = CARDS.filter(c => !used.has(c.id) && posOf(c) === pos && Math.abs(c.o - target) <= spread);
    for (let s = spread; pool.length < 3 && s < 30; s += 2) pool = CARDS.filter(c => !used.has(c.id) && posOf(c) === pos && Math.abs(c.o - target) <= s);
    if (!pool.length) pool = CARDS.filter(c => !used.has(c.id));
    const c = pool[Math.floor(R() * pool.length)]; used.add(c.id); return c;
  };
  const starters = POS.map(p => pick(p, rating + (R() * 4 - 2), 3));
  const bench = POS.map(p => pick(p, rating - 8 + (R() * 4 - 2), 4));
  const star = [...starters].sort((a, b) => b.o - a.o)[0];
  return { starters, bench, team: star.t, rating: teamRating(starters, bench), star };
}
export const teamRating = (starters, bench = []) => {
  const a = starters.filter(Boolean), b = bench.filter(Boolean).sort((x, y) => y.o - x.o).slice(0, 5);
  if (!a.length) return 0;
  const s = a.reduce((t, c) => t + c.o, 0) / a.length, bn = b.length ? b.reduce((t, c) => t + c.o, 0) / b.length : s - 10;
  return Math.round(s * 0.82 + bn * 0.18);
};
export { fallbackRoster };
