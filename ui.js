import * as Auth from './auth.js';
import * as Pad from './gamepad.js';
import * as KB from './keyboard.js';
import * as Controls from './controls.js';

const $ = id => document.getElementById(id);
const ICON = {
  ball: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24"><path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>',
  clip: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12l3 3m0-3l-3 3m5-1h2"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>',
};
const ITEMS = [
  { id: 'casual', label: 'Partido casual', icon: 'ball' },
  { id: 'online', label: 'Casual online', icon: 'globe' },
  { id: 'training', label: 'Entrenamiento', icon: 'dumbbell' },
  { id: 'career-player', label: 'Modo carrera — Jugador', icon: 'crown', soon: true },
  { id: 'career-coach', label: 'Modo carrera — DT', icon: 'clip', soon: true },
  { id: 'settings', label: 'Configuración', icon: 'gear' },
];

/* ---- configuración guardada en el navegador ---- */
const SKEY = 'basket3d_settings';
export const settings = (() => { try { return { sens: 1, diff: 'hard', ...JSON.parse(localStorage.getItem(SKEY) || '{}') }; } catch { return { sens: 1, diff: 'hard' }; } })();
export const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch { /* sin storage */ } };
Pad.init(settings, saveSettings);
KB.init(settings, saveSettings);

let H = {}, sel = 0, mainOpen = false, toastT = 0;
export const isMainOpen = () => mainOpen;

function toast(t) { const el = $('mmToast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2200); }

function buildMain() {
  const list = $('mmList');
  list.innerHTML = '';
  ITEMS.forEach((it, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mm-item' + (it.soon ? ' soon' : ''); b.style.setProperty('--i', i);
    b.innerHTML = `<span class="mm-in"><span class="mm-ico">${ICON[it.icon]}</span><span class="mm-label">${it.label}</span>${it.soon ? '<em>PRÓXIMAMENTE</em>' : '<i>›</i>'}</span>`;
    b.onmouseenter = () => select(i);
    b.onclick = () => { select(i); choose(); };
    list.appendChild(b);
  });
  select(ITEMS.findIndex(i => i.id === 'training'));   // arranca parado en Entrenamiento
}
function select(i) {
  sel = (i + ITEMS.length) % ITEMS.length;
  [...$('mmList').children].forEach((b, k) => b.classList.toggle('on', k === sel));
}
function choose() {
  const it = ITEMS[sel];
  if (it.soon) { toast('Este modo todavía no está disponible.'); return; }
  if (it.id === 'settings') { openSettings(); return; }
  hideMain();
  if (it.id === 'training') H.onTraining?.(); else if (it.id === 'casual') H.onCasual?.(); else if (it.id === 'online') H.onOnline?.();
}

export function showMain() {
  hide('auth'); $('settings').hidden = true; $('main').hidden = false; mainOpen = true; renderProfile(Auth.getProfile());
}
function hideMain() { $('main').hidden = true; mainOpen = false; }
function hide(id) { $(id).hidden = true; }

function renderProfile(p) {
  if (!p) return;
  const lv = p.level || 1, a = Auth.xpForLevel(lv), b = Auth.xpForLevel(lv + 1);
  $('mpName').textContent = p.username;
  $('mpLevel').textContent = `NIVEL ${lv}`;
  $('mpXp').textContent = `${p.xp - a} / ${b - a} XP`;
  $('mpBar').style.width = `${Math.min(100, ((p.xp - a) / (b - a)) * 100)}%`;
  $('mpTag').hidden = !Auth.isGuest();
}
Auth.onProfile(renderProfile);

/* ---- configuración ---- */
function renderPadInfo() {
  $('padName').textContent = Pad.state.connected ? Pad.state.id.replace(/\(.*?\)/g, '').trim().slice(0, 34) : 'no detectado (apretá un botón del joystick)';
  $('setDead').value = settings.dead; $('setDeadV').textContent = settings.dead.toFixed(2);
  $('setHints').checked = settings.padHints !== false; $('setRumble').checked = settings.rumble !== false;
}
export function openSettings() {
  renderPadInfo(); $('setLogout').hidden = !$('pause').hidden;          // en plena pausa no tiene sentido cerrar sesión
  $('setSens').value = settings.sens; $('setSensV').textContent = `${settings.sens.toFixed(1)}×`;
  $('settings').hidden = false;
}
function closeSettings() { $('settings').hidden = true; }

/* ---- login / registro ---- */
let tab = 'login';
function setTab(t) {
  tab = t;
  document.querySelectorAll('.au-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('auUserRow').hidden = t !== 'register';
  $('auSubmit').textContent = t === 'login' ? 'Iniciar sesión' : 'Crear cuenta';
  $('auPass').autocomplete = t === 'login' ? 'current-password' : 'new-password';
  $('auMsg').textContent = ''; $('auMsg').className = '';
}
function authMsg(t, ok = false) { $('auMsg').textContent = t; $('auMsg').className = ok ? 'ok' : 'err'; }

async function submitAuth(e) {
  e.preventDefault();
  const email = $('auEmail').value.trim(), pass = $('auPass').value, user = $('auUser').value.trim();
  if (!email || !pass) return authMsg('Completá email y contraseña.');
  if (tab === 'register' && !/^[A-Za-z0-9_]{3,20}$/.test(user)) return authMsg('El nombre de jugador: 3 a 20 letras, números o _ (sin espacios).');
  if (pass.length < 6) return authMsg('La contraseña tiene que tener al menos 6 caracteres.');
  $('auSubmit').disabled = true; authMsg('Conectando…', true);
  const r = tab === 'login' ? await Auth.signIn(email, pass) : await Auth.signUp(email, pass, user);
  $('auSubmit').disabled = false;
  if (!r.ok) return authMsg(r.error);
  if (r.confirm) { setTab('login'); return authMsg('¡Cuenta creada! Te mandamos un mail para confirmarla; después iniciá sesión.', true); }
  $('auPass').value = ''; showMain();
}
export function showAuth() {
  hideMain(); $('auth').hidden = false;
  $('auOffline').hidden = Auth.configured;
  $('auForm').hidden = !Auth.configured;
  setTab('login');
}

export async function boot(handlers) {
  H = handlers; buildMain();
  $('auForm').addEventListener('submit', submitAuth);
  document.querySelectorAll('.au-tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
  $('auGuest').onclick = () => { Auth.playAsGuest(); showMain(); };
  $('mpLogout').onclick = async () => { await Auth.signOut(); showAuth(); };
  $('setClose').onclick = () => { Pad.listen(null); closeSettings(); };
  $('openControls').onclick = () => Controls.open();
  $('setHints').onchange = e => { settings.padHints = e.target.checked; saveSettings(); };
  $('setRumble').onchange = e => { settings.rumble = e.target.checked; saveSettings(); };
  $('setDead').oninput = e => { settings.dead = +e.target.value; $('setDeadV').textContent = settings.dead.toFixed(2); saveSettings(); };
  Pad.onConnect(() => { if (!$('settings').hidden) setTimeout(renderPadInfo, 50); });
  $('setSens').oninput = e => { settings.sens = +e.target.value; $('setSensV').textContent = `${settings.sens.toFixed(1)}×`; saveSettings(); };
  $('setLogout').onclick = async () => { closeSettings(); await Auth.signOut(); showAuth(); };
  $('setFull').onclick = async () => { try { await document.documentElement.requestFullscreen(); await navigator.keyboard?.lock?.(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ControlLeft', 'KeyQ', 'KeyE']); } catch (e) { console.warn(e); } };
  document.addEventListener('keydown', e => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;   // escribiendo (email, contraseña…): no robar las letras
    if (!$('settings').hidden) { if (e.code === 'Escape' && !Controls.isOpen()) closeSettings(); return; }
    if (!mainOpen) return;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { select(sel + 1); e.preventDefault(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { select(sel - 1); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'Space') { choose(); e.preventDefault(); }
  });
  const p = await Auth.restoreSession();
  if (p) showMain(); else showAuth();
}
