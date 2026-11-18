import { AK } from './gen.js';
import { indexRosters, ros } from './state.js';
import { makeRng } from './util.js';
import { resetGid } from './cal.js';

/* ============================================================================
   Guardado: 3 ranuras en el navegador (localStorage) + exportar/importar archivo.
   Los atributos se guardan como arreglos para que pese menos (~1 MB por carrera).
   ========================================================================== */
const KEY = s => `b3d_career_${s}`, META = 'b3d_career_meta';
export const SLOTS = [1, 2, 3];
function pack(G) {
  G.rs = G.rng.state();
  const P = {};
  for (const [id, p] of Object.entries(G.P)) { const { at, ...rest } = p; P[id] = { ...rest, at: AK.map(k => at[k]) }; }
  const { rng, R, _bd, _bdN, ...rest } = G;
  return JSON.stringify({ ...rest, P });
}
function unpack(txt) {
  const G = JSON.parse(txt);
  for (const p of Object.values(G.P)) { const o = {}; AK.forEach((k, i) => { o[k] = p.at[i]; }); p.at = o; }
  G.rng = makeRng(0); G.rng.set(G.rs ?? 1); resetGid(G.gid || 0); indexRosters(G);
  return G;
}
export function save(G, slot) {
  try {
    localStorage.setItem(KEY(slot), pack(G));
    const meta = readMeta(); const t = G.teams[G.user];
    meta[slot] = { coach: `${G.coach.first} ${G.coach.last}`, team: G.user, y: G.Y, today: G.today, w: t.w, l: t.l, phase: G.phase, at: Date.now() };
    localStorage.setItem(META, JSON.stringify(meta)); return { ok: true };
  } catch (e) { return { ok: false, error: String(e?.name === 'QuotaExceededError' ? 'No hay espacio en el navegador. Exportá la partida a un archivo.' : e) }; }
}
export const readMeta = () => { try { return JSON.parse(localStorage.getItem(META) || '{}'); } catch { return {}; } };
export function load(slot) { try { const t = localStorage.getItem(KEY(slot)); return t ? unpack(t) : null; } catch (e) { console.warn('No se pudo cargar la carrera', e); return null; } }
export function remove(slot) { try { localStorage.removeItem(KEY(slot)); const m = readMeta(); delete m[slot]; localStorage.setItem(META, JSON.stringify(m)); } catch { /* sin storage */ } }
export const exportText = G => pack(G);
export const importText = txt => unpack(txt);
