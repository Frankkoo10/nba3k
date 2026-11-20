import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import * as Acct from './acct.js';

export const configured = !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.startsWith('TU-');
const SB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

let sb = null, profile = null, guest = false, pending = 0, flushTimer = null, flushing = false;
const listeners = new Set();
export const onProfile = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach(fn => fn(profile));
export const getProfile = () => profile;
export const isGuest = () => guest;

async function client() {
  if (sb) return sb;
  if (!configured) throw new Error('Supabase no está configurado (editá config.js).');
  const { createClient } = await import(SB_CDN);
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return sb;
}
export const getClient = client;     // lo usa roster.js para leer equipos y jugadores
const msg = e => {
  const m = e?.message || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Tenés que confirmar tu email (revisá tu casilla).';
  if (/already registered|already been registered/i.test(m)) return 'Ese email ya tiene una cuenta.';
  if (/Password should be/i.test(m)) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (/Failed to fetch|NetworkError|import/i.test(m)) return 'No se pudo conectar con Supabase. Revisá tu internet y config.js.';
  return m;
};

async function fetchProfile(user) {
  const c = await client();
  const { data, error } = await c.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  profile = data || { id: user.id, username: user.user_metadata?.username || 'Jugador', level: 1, xp: 0, coins: 0 };
  guest = false;
  if (Acct.switchTo(user.id)) return new Promise(() => {});          // v71: otra cuenta → se recarga la página para cargar los datos de ESTA cuenta (nunca resuelve: la página se está yendo)
  emit(); return profile;
}

/** Devuelve el perfil si ya hay sesión guardada, o null. */
export async function restoreSession() {
  if (!configured) return null;
  try {
    const c = await client();
    const { data } = await c.auth.getSession();
    return data.session ? await fetchProfile(data.session.user) : null;
  } catch (e) { console.warn('restoreSession', e); return null; }
}
export async function signIn(email, password) {
  try {
    const c = await client();
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { ok: true, profile: await fetchProfile(data.user) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}
export async function signUp(email, password, username) {
  try {
    const c = await client();
    const { data: free, error: e1 } = await c.rpc('username_disponible', { p_username: username });
    if (e1) throw e1;
    if (!free) return { ok: false, error: 'Ese nombre de jugador ya está en uso.' };
    const { data, error } = await c.auth.signUp({ email, password, options: { data: { username } } });
    if (error) throw error;
    if (!data.session) return { ok: true, confirm: true };        // el proyecto exige confirmar el email
    return { ok: true, profile: await fetchProfile(data.user) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}
export async function signOut() {
  await flushXp();
  try { if (sb) await sb.auth.signOut(); } catch (e) { console.warn(e); }
  profile = null; guest = false;
  if (Acct.switchTo('guest')) return;                                  // v71: se recarga y queda lo del invitado
  emit();
}
export function playAsGuest() { guest = true; profile = { username: 'Invitado', level: 1, xp: 0, coins: 0 }; if (Acct.switchTo('guest')) return profile; emit(); return profile; }

/* ---- XP: se junta en el juego y se manda a Supabase cada tanto (función add_xp) ---- */
export function queueXp(n) {
  if (!profile || n <= 0) return;
  if (guest) { profile.xp += n; profile.level = levelForXp(profile.xp); emit(); return; }
  pending += n; clearTimeout(flushTimer); flushTimer = setTimeout(flushXp, 15000);
}
export async function flushXp() {
  clearTimeout(flushTimer);
  if (guest || !sb || !profile || flushing || pending <= 0) return;
  flushing = true;
  try {
    while (pending > 0) {
      const amount = Math.min(pending, 300);
      const { data, error } = await sb.rpc('add_xp', { p_amount: amount });
      if (error) throw error;
      pending -= amount; profile = data; emit();
    }
  } catch (e) { console.warn('No se pudo guardar la XP (se reintenta luego):', e); flushTimer = setTimeout(flushXp, 30000); }
  flushing = false;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushXp(); });

/* nivel = 1 + floor(sqrt(xp/50))  (igual que level_for_xp en el SQL) */
export const levelForXp = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
export const xpForLevel = l => 50 * (l - 1) ** 2;
