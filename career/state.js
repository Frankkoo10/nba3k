import { makeRng, fmtDay } from './util.js';
import { baseOvr, ovrNow } from './gen.js';

/* ============================================================================
   Estado de la partida (G) y operaciones básicas. G es un objeto JSON puro (se guarda tal cual en el navegador),
   salvo G.rng (generador al azar con semilla) y G.R (índice de planteles, se reconstruye al cargar).
   ========================================================================== */
export const NEWS_MAX = 160, INBOX_MAX = 220;

export function indexRosters(G) {
  G.R = {};
  for (const p of Object.values(G.P)) { const k = p.tm || (p.lg === 'FA' ? 'FA' : p.lg === 'GL' ? 'GLFA' : null); if (k) (G.R[k] ||= []).push(p.id); }
}
export const ros = (G, k) => (G.R[k] || []).map(id => G.P[id]).filter(Boolean);
export const nbaRoster = (G, ab) => ros(G, ab);
export const userRoster = G => ros(G, G.user);
/** Mueve a un jugador de lugar. tm = abreviatura NBA / 'EUR:RMA' / 'FA' / 'GLFA' / null (desaparece de las listas). */
export function place(G, p, tm, lg) {
  const old = p.tm || (p.lg === 'FA' ? 'FA' : p.lg === 'GL' ? 'GLFA' : null);
  if (old && G.R[old]) G.R[old] = G.R[old].filter(id => id !== p.id);
  p.tm = tm && tm !== 'FA' && tm !== 'GLFA' ? tm : null; p.lg = lg;
  if (lg === 'NBA' || lg === 'FA' || lg === 'GL' || lg === 'GLFA' || tm) {
    const k = p.tm || (lg === 'FA' ? 'FA' : lg === 'GL' ? 'GLFA' : null);
    if (k) (G.R[k] ||= []).push(p.id);
  }
  p.gl = false;
}
export const removePlayer = (G, p) => { const old = p.tm || (p.lg === 'FA' ? 'FA' : p.lg === 'GL' ? 'GLFA' : null); if (old && G.R[old]) G.R[old] = G.R[old].filter(id => id !== p.id); delete G.P[p.id]; };

export const isUser = (G, ab) => ab === G.user;
export const teamName = (G, ab) => (G.teams[ab] ? G.teams[ab].name : G.clubs[ab]?.name || ab);
export const payroll = (G, ab) => ros(G, ab).reduce((t, p) => t + (p.con ? p.con.sal : 0), 0) + (G.dead?.[ab] || 0);
export const rosterCount = (G, ab) => ros(G, ab).length;

export function news(G, text, kind = 'liga', extra = {}) {
  G.news.unshift({ d: G.today, t: text, k: kind, ...extra });
  if (G.news.length > NEWS_MAX) G.news.length = NEWS_MAX;
}
let mid = 0;
/** Mensaje al buzón del DT. `acts` = botones: [{ id, label }]; el motor los resuelve en events.js */
export function msg(G, m) {
  G.inbox.unshift({ id: ++G.mid, d: G.today, read: false, ...m });
  if (G.inbox.length > INBOX_MAX) G.inbox.length = INBOX_MAX;
  return G.inbox[0];
}
export const unread = G => G.inbox.filter(m => !m.read && !m.done).length;
export const logLine = (G, t) => { (G.log ||= []).unshift(`${fmtDay(G.today)}: ${t}`); if (G.log.length > 60) G.log.length = 60; };

/** Nivel del plantel de un equipo (ranking de fuerza): promedio ponderado de los 10 mejores overall. */
export function teamStrength(G, ab) {
  const o = ros(G, ab).filter(p => p.lg === 'NBA' && !p.gl).map(ovrNow).sort((a, b) => b - a), w = [1.3, 1.2, 1.1, 1, 0.9, 0.75, 0.6, 0.45, 0.35, 0.25];
  let t = 0, s = 0; w.forEach((x, i) => { t += (o[i] ?? 45) * x; s += x; }); return t / s;
}
export const standingsOf = (G, conf = null) => Object.values(G.teams).filter(t => !conf || t.conf === conf).sort((a, b) => (b.w / Math.max(1, b.w + b.l)) - (a.w / Math.max(1, a.w + a.l)) || (b.pf - b.pa) - (a.pf - a.pa) || a.ab.localeCompare(b.ab));
export const winPct = t => (t.w + t.l ? t.w / (t.w + t.l) : 0);
export const rankIn = (G, ab) => { const t = G.teams[ab], l = standingsOf(G, t.conf); return l.findIndex(x => x.ab === ab) + 1; };
