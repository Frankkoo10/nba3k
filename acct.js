/* ============================================================================
   v71 · Datos por cuenta
   Todo lo que el juego guarda en este navegador (ajustes y controles, armado del partido, entrenamiento, sala online, carreras DT) se guarda
   POR CUENTA: cada cuenta tiene sus propias claves ("clave@id"). Antes eran las mismas para todos y, al cambiar de cuenta, se veía lo de la anterior.
   · El invitado (sin cuenta) sigue usando las claves de siempre, así que nada de lo que ya tenías se pierde.
   · La primera cuenta que entra en este navegador hereda lo que ya había guardado (copia, no mueve).
   · Ultimate Team ya se guardaba por cuenta (ut-state.js) y en la nube.
   · Al cambiar de cuenta la página se recarga sola para que todos los módulos lean los datos de la cuenta nueva.
   ========================================================================== */
const LAST = 'b3d_last_uid', CLAIM = 'b3d_legacy_claimed';
const BASE = ['basket3d_settings', 'basket3d_setup', 'basket3d_online', 'basket3d_train', 'b3d_career_meta', 'b3d_career_0', 'b3d_career_1', 'b3d_career_2'];
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin storage */ } } };

export const curUid = () => ls.get(LAST) || 'guest';
/** Clave de almacenamiento de la cuenta que está activa (el invitado usa la clave de siempre). */
export const scoped = key => { const u = curUid(); return u === 'guest' ? key : `${key}@${u}`; };

function claimLegacy(uid) {
  if (ls.get(CLAIM)) return;
  for (const k of BASE) { const v = ls.get(k); if (v != null && ls.get(`${k}@${uid}`) == null) ls.set(`${k}@${uid}`, v); }
  ls.set(CLAIM, uid);
}
/** Se llama cuando el login / logout cambia de cuenta. Devuelve true si cambió (y la página se va a recargar). */
export function switchTo(uid) {
  const to = uid || 'guest';
  if (to === curUid()) return false;
  if (to !== 'guest') claimLegacy(to);
  ls.set(LAST, to);
  setTimeout(() => location.reload(), 60);
  return true;
}
