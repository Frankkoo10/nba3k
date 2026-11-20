import * as Auth from './auth.js';
import * as Acct from './acct.js';
import * as PM from './prematch.js';
import { createLink } from './net.js';

/* ============================================================================
   Casual online · salas públicas y privadas (Supabase: tabla `rooms` + Realtime)

   Flujo:
     Menú principal → "Casual online" → LOBBY (lista de salas públicas · entrar con código · crear sala)
     → crear/entrar → se abre el MISMO menú previo del partido casual (Equipos → Camisetas → Tu equipo → Partido),
       pero cada uno elige SOLO su equipo/camiseta/alineación y las reglas del partido las puso el anfitrión (🔒).
     → en el último paso cada uno marca "Estoy listo" y el anfitrión toca "Empezar partido".

   Canal en vivo de cada sala (Supabase Realtime, broadcast + presence):
     hello {role,name}   ·   pick {ab,kit,starters,bench,ctrl}   ·   ready {ready}   ·   start   ·   back
   ETAPA 1: salas, lobby y sincronía del menú previo.
   ETAPA 2 (acá): el partido en vivo. El ANFITRIÓN simula todo (jugadores, pelota, reglas, bots) y manda snapshots ~20/s;
   el INVITADO manda sus controles y dibuja lo que recibe (main.js). El transporte es una conexión directa P2P (net.js)
   y, si la red no la deja abrir, el mismo canal de Supabase (más lento pero siempre anda). Todo mensaje del juego pasa por sendGame().
   ========================================================================== */

const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = Acct.scoped('basket3d_online');

/* ---- reglas que define el anfitrión al crear la sala ---- */
const YN = [['true', 'Sí'], ['false', 'No']];
export const RULES = [
  ['court', 'Cancha', [['home', 'La del anfitrión'], ['away', 'La del invitado']]],
  ['qLen', 'Duración del cuarto', [['60', '1 min'], ['120', '2 min'], ['180', '3 min'], ['300', '5 min'], ['480', '8 min']]],
  ['shotClock', 'Reloj de 24 segundos', YN],
  ['fatigue', 'Cansancio', YN],
];
const DEF = { name: '', pub: true, settings: { court: 'home', diff: 'pro', qLen: 180, shotClock: true, fatigue: true, autoSubs: true } };
const form = (() => {
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { ...DEF, ...s, settings: { ...DEF.settings, ...(s.settings || {}) } }; } catch { return { ...DEF, settings: { ...DEF.settings } }; }
})();
const saveForm = () => { try { localStorage.setItem(KEY, JSON.stringify(form)); } catch { /* sin storage */ } };

let hooks = {}, root = null, modal = null, open_ = false, view = 'browse', rooms = [], loading = false, msg = '', msgOk = false;
let listCh = null, listTimer = 0, sess = null;           // sess = sala en la que estoy

export const isOpen = () => open_;
export const inRoom = () => !!sess;

const ERR = {
  sin_sesion: 'Tenés que iniciar sesión.', sin_perfil: 'Tu cuenta no tiene perfil todavía. Probá cerrar sesión y volver a entrar.',
  sala_no_existe: 'Esa sala no existe o ya se cerró.', sala_llena: 'La sala ya está llena.', sala_propia: 'Esa sala es tuya.',
  estado_invalido: 'Estado de sala inválido.',
};
function errText(e) {
  const m = e?.message || String(e);
  for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k];
  if (/does not exist|schema cache|Could not find the function/i.test(m)) return 'Falta correr supabase/004_salas_online.sql en tu proyecto de Supabase.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'No se pudo conectar con Supabase. Revisá tu internet.';
  return m;
}

/* ---------------------------------------------------------------------------
   Montaje
   ------------------------------------------------------------------------- */
export function init(h) {
  hooks = h || {};
  root = $('ol'); modal = $('olModal');
  root.addEventListener('click', onClick);
  modal.addEventListener('click', onClick);
  root.addEventListener('input', e => { if (e.target.id === 'olName') { form.name = e.target.value.slice(0, 40); saveForm(); } if (e.target.id === 'olCode') e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); });
  root.addEventListener('keydown', e => { if (e.target.id === 'olCode' && e.code === 'Enter') { e.preventDefault(); joinByCode(); } });
  document.addEventListener('keydown', e => {
    if (!open_ || (modal && !modal.hidden)) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) { if (e.code === 'Escape') t.blur(); return; }
    if (e.code === 'Escape') { back(); e.preventDefault(); }
  });
  addEventListener('beforeunload', () => { if (sess) { try { Auth.getClient().then(c => c.rpc('leave_room', { p_id: sess.room.id })); } catch { /* nada */ } } });
}

export function open() {
  open_ = true; msg = ''; view = 'browse'; root.hidden = false;
  if (!Auth.configured || Auth.isGuest() || !Auth.getProfile()?.id) { view = 'nologin'; render(); return; }
  render(); refreshList(); watchList();
}
export function close() { open_ = false; root.hidden = true; unwatchList(); }
function back() {
  if (view === 'create') { view = 'browse'; msg = ''; render(); return; }
  close(); hooks.onBack?.();
}

/* ---------------------------------------------------------------------------
   Pantallas del lobby
   ------------------------------------------------------------------------- */
const ruleLabel = (k, v) => (RULES.find(r => r[0] === k)?.[2].find(([x]) => x === String(v)) || [0, String(v)])[1];
const rulesLine = s => `${ruleLabel('qLen', s.qLen)} × 4 · 24 s ${s.shotClock === false || s.shotClock === 'false' ? 'no' : 'sí'}`;

function render() {
  const msgHTML = msg ? `<p class="ol-msg ${msgOk ? 'ok' : 'err'}">${esc(msg)}</p>` : '';
  const head = `<header class="ol-head"><div><small>BASKET 3D</small><h1>CASUAL <span>ONLINE</span></h1></div><button type="button" class="ol-btn ghost" data-ol="back"><kbd>Esc</kbd>${view === 'create' ? 'Atrás' : 'Menú principal'}</button></header>`;
  if (view === 'nologin') {
    root.innerHTML = `${head}<div class="ol-card ol-solo"><h2>Necesitás una cuenta</h2><p>Para jugar online hace falta iniciar sesión (así los demás ven tu nombre y no se mezclan las salas). ${Auth.configured ? '' : 'Además, falta configurar Supabase en <code>config.js</code>.'}</p><button type="button" class="ol-btn" data-ol="logout">Ir a iniciar sesión</button></div>`;
    return;
  }
  if (view === 'create') {
    root.innerHTML = `${head}<div class="ol-card ol-form">
      <h2>Crear partida</h2>
      <label class="ol-field"><span>Nombre de la sala</span><input id="olName" type="text" maxlength="40" placeholder="Sala de ${esc(Auth.getProfile()?.username || 'Jugador')}" value="${esc(form.name)}" autocomplete="off"></label>
      <div class="ol-field"><span>Quién puede entrar</span>
        <div class="ol-seg"><button type="button" class="${form.pub ? 'on' : ''}" data-ol="vis" data-v="1"><b>PÚBLICA</b><small>Aparece en la lista</small></button><button type="button" class="${form.pub ? '' : 'on'}" data-ol="vis" data-v="0"><b>PRIVADA</b><small>Solo con el código</small></button></div></div>
      <div class="ol-rules"><h3>Reglas del partido <small>solo las define el anfitrión</small></h3>
        ${RULES.map(([k, label, opts]) => `<div class="ol-rule"><span>${label}</span><div class="ol-val"><button type="button" data-ol="rule" data-k="${k}" data-d="-1" aria-label="Anterior">‹</button><b>${esc(ruleLabel(k, form.settings[k]))}</b><button type="button" data-ol="rule" data-k="${k}" data-d="1" aria-label="Siguiente">›</button></div></div>`).join('')}
      </div>
      ${msgHTML}
      <button type="button" class="ol-btn play" data-ol="create" ${loading ? 'disabled' : ''}>${loading ? 'Creando…' : 'CREAR Y ENTRAR'}</button>
    </div>`;
    return;
  }
  root.innerHTML = `${head}<div class="ol-grid">
    <aside class="ol-card ol-side">
      <button type="button" class="ol-btn play" data-ol="new">＋ CREAR PARTIDA</button>
      <div class="ol-or"><span>o entrá con un código</span></div>
      <label class="ol-field"><span>Código de sala (privadas y públicas)</span><input id="olCode" type="text" maxlength="5" placeholder="K7QX2" autocomplete="off" spellcheck="false"></label>
      <button type="button" class="ol-btn" data-ol="joincode" ${loading ? 'disabled' : ''}>ENTRAR CON CÓDIGO</button>
      ${msgHTML}
    </aside>
    <section class="ol-card ol-list">
      <div class="ol-list-h"><h2>Partidas públicas</h2><button type="button" class="ol-btn ghost sm" data-ol="refresh">↻ Actualizar</button></div>
      <div class="ol-rooms" id="olRooms"></div>
    </section>
  </div>`;
  renderRooms();
}
function renderRooms() {
  const el = $('olRooms'); if (!el) return;
  if (loading && !rooms.length) { el.innerHTML = '<p class="ol-empty">Buscando partidas…</p>'; return; }
  if (!rooms.length) { el.innerHTML = '<p class="ol-empty">No hay partidas públicas ahora.<br>¡Creá una y esperá a que alguien entre!</p>'; return; }
  el.innerHTML = rooms.map(r => `<div class="ol-room"><div class="ol-r-t"><b>${esc(r.name)}</b><small>Anfitrión: ${esc(r.host_name)} · ${esc(rulesLine(r.settings || {}))}</small></div><button type="button" class="ol-btn sm" data-ol="join" data-id="${esc(r.id)}">ENTRAR</button></div>`).join('');
}

/* ---------------------------------------------------------------------------
   Acciones del lobby
   ------------------------------------------------------------------------- */
async function onClick(e) {
  const el = e.target.closest('[data-ol]'); if (!el) return;
  e.stopPropagation();
  const a = el.dataset.ol;
  if (a === 'back') back();
  else if (a === 'logout') { close(); hooks.onNeedLogin?.(); }
  else if (a === 'new') { view = 'create'; msg = ''; render(); }
  else if (a === 'refresh') refreshList();
  else if (a === 'vis') { form.pub = el.dataset.v === '1'; saveForm(); render(); }
  else if (a === 'rule') {
    const [k, , opts] = RULES.find(r => r[0] === el.dataset.k), vals = opts.map(o => o[0]);
    const i = vals.indexOf(String(form.settings[k])), nv = vals[(i + +el.dataset.d + vals.length) % vals.length];
    form.settings[k] = nv === 'true' ? true : nv === 'false' ? false : (k === 'qLen' ? +nv : nv); saveForm(); render();
  }
  else if (a === 'create') createRoom();
  else if (a === 'joincode') joinByCode();
  else if (a === 'join') joinRoom({ id: el.dataset.id });
  else if (a === 'ready') toggleReady();
  else if (a === 'start') hostStart();
  else if (a === 'backroom') backToRoom();
}
function note(t, ok = false) { msg = t; msgOk = ok; if (open_) render(); }

async function refreshList() {
  if (view !== 'browse' || !open_) return;
  loading = true; if (!rooms.length) renderRooms();
  try {
    const c = await Auth.getClient();
    const since = new Date(Date.now() - 90000).toISOString();
    const { data, error } = await c.from('rooms').select('*').eq('is_public', true).eq('status', 'waiting').is('guest_id', null).gt('updated_at', since).order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    rooms = data || []; if (msg && !msgOk) msg = '';
  } catch (e) { note(errText(e)); }
  loading = false; if (view === 'browse') renderRooms();
}
async function watchList() {
  unwatchList();
  try {
    const c = await Auth.getClient();
    listCh = c.channel('lista-salas').on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => { clearTimeout(listTimer); listTimer = setTimeout(refreshList, 350); }).subscribe();
  } catch { /* sin realtime: queda el refresco manual y el automático */ }
  listTimer = setTimeout(function tick() { if (!open_) return; refreshList(); listTimer = setTimeout(tick, 6000); }, 6000);
}
function unwatchList() { clearTimeout(listTimer); if (listCh) { try { listCh.unsubscribe(); } catch { /* nada */ } listCh = null; } }

async function createRoom() {
  if (loading) return; loading = true; render();
  try {
    const c = await Auth.getClient();
    const s = { ...form.settings, qLen: +form.settings.qLen };
    const { data, error } = await c.rpc('create_room', { p_name: form.name.trim(), p_public: form.pub, p_settings: s });
    if (error) throw error;
    loading = false; msg = '';
    enter(data, 'host');
  } catch (e) { loading = false; note(errText(e)); }
}
async function joinByCode() {
  const code = ($('olCode')?.value || '').trim().toUpperCase();
  if (code.length < 4) return note('Escribí el código de la sala (5 letras/números).');
  joinRoom({ code });
}
async function joinRoom({ id = null, code = null }) {
  if (loading) return; loading = true; msg = ''; render();
  try {
    const c = await Auth.getClient();
    const { data, error } = await c.rpc('join_room', { p_code: code, p_id: id });
    if (error) throw error;
    loading = false; enter(data, 'guest');
  } catch (e) { loading = false; await refreshList(); note(errText(e)); }
}

/* ---------------------------------------------------------------------------
   Dentro de la sala
   ------------------------------------------------------------------------- */
const keyOf = p => String(p.id ?? p.name);
async function enter(room, role) {
  unwatchList(); close();
  const me = Auth.getProfile();
  sess = {
    room, role, myId: me.id, myName: me.username, oppName: role === 'host' ? room.guest_name : room.host_name, oppOnline: false, everOpp: false,
    meReady: false, oppReady: false, ch: null, hb: 0, poll: 0, gone: 0, started: false, lastPick: null, pickT: 0,
    link: null, linkState: 'relay', inMatch: false, init: null, lostT: 0,
  };
  const s = room.settings || {};
  sess.init = { role, code: room.code, name: room.name, pub: room.is_public, settings: { court: s.court || 'home', diff: s.diff || 'pro', qLen: +s.qLen || 180, shotClock: s.shotClock !== false, fatigue: s.fatigue !== false, autoSubs: s.autoSubs !== false }, hostName: role === 'host' ? me.username : room.host_name, guestName: role === 'host' ? room.guest_name : me.username, meReady: false, oppReady: false, oppOnline: false };
  PM.openWizard({ step: 1, online: { ...sess.init } });
  syncState();
  try {
    const c = await Auth.getClient();
    const ch = c.channel(`sala:${room.id}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
    sess.ch = ch;
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => onMsg(payload))
      .on('presence', { event: 'sync' }, onPresence)
      .subscribe(async status => {
        if (!sess || sess.ch !== ch) return;
        if (status === 'SUBSCRIBED') { try { await ch.track({ role, name: me.username }); } catch { /* nada */ } send({ t: 'hello' }); sendPickNow(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') PM.onlineToast?.('Se cortó la conexión en vivo con la sala. Reintentando…');
      });
  } catch (e) { PM.onlineToast?.(errText(e)); }
  if (role === 'host') sess.hb = setInterval(async () => { try { (await Auth.getClient()).rpc('touch_room', { p_id: room.id }); } catch { /* nada */ } }, 30000);
  sess.poll = setInterval(pollRoom, 4000);
}
const send = m => { try { sess?.ch?.send({ type: 'broadcast', event: 'msg', payload: { ...m, role: sess.role } }); } catch { /* nada */ } };

function syncState() {
  if (!sess) return;
  const host = sess.role === 'host';
  PM.onlineUpdate({
    oppName: sess.oppName || null, oppOnline: sess.oppOnline, meReady: sess.meReady, oppReady: sess.oppReady,
    hostName: host ? sess.myName : (sess.oppName || sess.room.host_name), guestName: host ? (sess.oppName || null) : sess.myName,
  });
}

/** Presence: quién está conectado a la sala ahora mismo. */
function onPresence() {
  if (!sess) return;
  const st = sess.ch.presenceState(), want = sess.role === 'host' ? 'guest' : 'host';
  let opp = null;
  for (const k of Object.keys(st)) { if (k === sess.myId) continue; const m = (st[k] || []).find(x => x.role === want); if (m) opp = m; }
  const was = sess.oppOnline;
  sess.oppOnline = !!opp;
  if (opp) { sess.oppName = opp.name || sess.oppName; sess.everOpp = true; clearTimeout(sess.gone); sess.gone = 0; }
  else if (was) {                                                     // se fue (cerró la pestaña, se le cayó internet o salió)
    sess.oppReady = false;
    if (!sess.inMatch) PM.onlineToast?.(sess.role === 'host' ? 'El invitado salió de la sala.' : 'El anfitrión se desconectó…');
    if (sess.role === 'host') sess.oppName = null;
    if (sess.role === 'guest' && !sess.inMatch) { clearTimeout(sess.gone); sess.gone = setTimeout(() => { if (sess && !sess.oppOnline && !sess.inMatch) leave('El anfitrión cerró la sala.'); }, 12000); }
  }
  if (opp && !was) { send({ t: 'hello' }); if (sess.role === 'host') { dropLink(); startLink(); } }      // el que llegó recién necesita mi elección; el anfitrión abre la conexión directa
  if (!opp && was) dropLink();
  if (!opp && was && sess.inMatch) {                                    // se cayó en pleno partido: si no vuelve en 10 s, se corta
    clearTimeout(sess.lostT); sess.lostT = setTimeout(() => { if (sess && sess.inMatch && !sess.oppOnline) opponentLeftMatch(sess.role === 'guest' ? 'Se perdió la conexión con el anfitrión.' : 'Se perdió la conexión con el invitado.'); }, 10000);
  } else if (opp && sess.lostT) { clearTimeout(sess.lostT); sess.lostT = 0; }
  syncState();
}
/** Respaldo por si Realtime falla: mirar la fila de la sala. */
async function pollRoom() {
  if (!sess) return;
  try {
    const c = await Auth.getClient();
    const { data, error } = await c.from('rooms').select('*').eq('id', sess.room.id).maybeSingle();
    if (error) return;
    if (!data || data.status === 'closed') { leave(sess.role === 'guest' ? 'El anfitrión cerró la sala.' : null); return; }
    if (sess.role === 'host') {
      if (!data.guest_id && sess.oppName && !sess.oppOnline) { sess.oppName = null; sess.oppReady = false; syncState(); }
      else if (data.guest_id && !sess.oppName) { sess.oppName = data.guest_name; syncState(); }
    } else if (data.guest_id !== sess.myId) { leave('Saliste de la sala.'); }
  } catch { /* nada */ }
}

function onMsg(m) {
  if (!sess || !m) return;
  if (m.role === sess.role) return;
  if (m.t === 'rtc') { if (!sess.link && sess.role === 'guest') startLink(); sess.link?.signal(m); }
  else if (m.t === 'g') handleGame(m.m);
  else if (m.t === 'hello') { sendPickNow(); send({ t: 'ready', ready: sess.meReady }); }
  else if (m.t === 'pick') { PM.applyOpponent(m.pick); }
  else if (m.t === 'ready') { sess.oppReady = !!m.ready; syncState(); }
}

/* ---------------------------------------------------------------------------
   Transporte del juego: P2P si se pudo abrir, si no Supabase
   ------------------------------------------------------------------------- */
function startLink() {
  if (!sess || sess.link) return;
  const l = createLink({ initiator: sess.role === 'host', signal: m => send(m), onMessage: handleGame, onState: st => { if (sess) { sess.linkState = st; hooks.onLinkState?.(st); } } });
  sess.link = l; if (sess.role === 'host') l.start();
}
function dropLink() { if (!sess?.link) return; sess.link.close(); sess.link = null; sess.linkState = 'relay'; }
export const linkState = () => sess?.linkState || 'relay';
/** Manda un mensaje del juego. `reliable` = ordenado y garantizado (acciones, eventos); si no, puede perderse (snapshots, inputs). */
export function sendGame(msg, reliable = false) {
  if (!sess) return;
  if (sess.link?.send(msg, reliable)) return;
  send({ t: 'g', m: msg });
}
function handleGame(m) {
  if (!sess || !m) return;
  if (m.t === 'start') { if (sess.role === 'guest' && m.setup) { sess.inMatch = true; sess.lostT = 0; hooks.onMatchStart?.(m.setup, 'guest'); } }
  else if (m.t === 'over') { if (sess.inMatch) showResult(m.info); }
  else if (m.t === 'quit') { if (sess.inMatch || !modal.hidden) opponentLeftMatch(sess.role === 'guest' ? 'El anfitrión abandonó la partida.' : 'El invitado abandonó la partida.'); }
  else hooks.onGame?.(m);
}
function opponentLeftMatch(why) {
  if (!sess) return;
  hooks.onMatchStop?.(); hideModal(); sess.inMatch = false; sess.meReady = false; sess.oppReady = false;
  if (sess.role === 'guest') { leave(why); return; }                  // si se va el anfitrión, la sala se cierra
  sess.oppName = null; sess.oppOnline = false; dropLink();
  PM.resumeOnline(why); syncState();
}

/* ---- lo que manda prematch.js ---- */
export function sendPick(p) {
  if (!sess || !p) return;
  sess.lastPick = p;
  clearTimeout(sess.pickT); sess.pickT = setTimeout(sendPickNow, 220);     // junta cambios seguidos (cambios de titulares)
  if (sess.meReady) { sess.meReady = false; send({ t: 'ready', ready: false }); syncState(); }
}
function sendPickNow() { if (sess) { const p = sess.lastPick || PM.getMyPick(); if (p) send({ t: 'pick', pick: p }); } }
export function setReady(v) { if (!sess) return; sess.meReady = !!v; send({ t: 'ready', ready: sess.meReady }); syncState(); }
function toggleReady() { if (!sess) return; if (!sess.oppOnline && !sess.meReady) { /* igual podés marcar listo */ } setReady(!sess.meReady); }

export async function hostStart() {
  if (!sess || sess.role !== 'host' || sess.inMatch) return;
  if (!sess.oppOnline || !sess.meReady || !sess.oppReady) return PM.onlineToast?.('Faltan los dos: tienen que estar presentes y listos.');
  const setup = PM.getSetup();
  try { await (await Auth.getClient()).rpc('set_room_status', { p_id: sess.room.id, p_status: 'playing' }); } catch { /* nada */ }
  if (!sess) return;
  sess.inMatch = true; sess.lostT = 0;
  sendGame({ t: 'start', setup }, true);
  hooks.onMatchStart?.(setup, 'host');
}

/** Final del partido (lo llama main.js en el anfitrión): avisa al invitado y muestra el resultado a los dos. */
export function matchOver(info) { if (!sess || !sess.inMatch) return; sendGame({ t: 'over', info }, true); showResult(info); }
function showResult(info) {
  if (!sess) return;
  hooks.onMatchEnded?.(info);
  const A = info.ta, B = info.tb, mineA = sess.role === 'host', ms = mineA ? info.sa : info.sb, os = mineA ? info.sb : info.sa;
  const res = ms === os ? 'EMPATE' : ms > os ? '¡GANASTE!' : 'PERDISTE';
  modal.innerHTML = `<div class="ol-sheet">
    <small>SALA ${esc(sess.room.code)} · FINAL</small><h2>${res}</h2>
    <div class="ol-vs"><div><img src="${esc(A.logo)}" alt=""><b>${esc(A.name)}</b><em>${esc((sess.role === 'host' ? sess.myName : sess.oppName) || 'Anfitrión')}${mineA ? ' (vos)' : ''}</em></div><strong>${info.sa} – ${info.sb}</strong><div><img src="${esc(B.logo)}" alt=""><b>${esc(B.name)}</b><em>${esc((sess.role === 'guest' ? sess.myName : sess.oppName) || 'Invitado')}${!mineA ? ' (vos)' : ''}</em></div></div>
    <button type="button" class="ol-btn play" data-ol="backroom">VOLVER A LA SALA</button></div>`;
  modal.hidden = false; sess.result = info;
}
function hideModal() { if (modal) { modal.hidden = true; modal.innerHTML = ''; } }
/** Después del partido: los dos vuelven al último paso del menú previo (revancha con los mismos equipos o cambiar lo que quieran). */
async function backToRoom() {
  if (!sess) return;
  const r = sess.result; hideModal(); sess.result = null;
  hooks.onMatchStop?.(); sess.inMatch = false; sess.meReady = false; sess.oppReady = false; send({ t: 'ready', ready: false });
  PM.resumeOnline(r ? `Final: ${r.ta.ab} ${r.sa} – ${r.sb} ${r.tb.ab}` : '');
  syncState();
  if (sess.role === 'host') { try { await (await Auth.getClient()).rpc('set_room_status', { p_id: sess.room.id, p_status: 'waiting' }); } catch { /* nada */ } }
}
/** Abandonar el partido en curso (menú de pausa). */
export function quitMatch() {
  if (!sess) return;
  sendGame({ t: 'quit' }, true); send({ t: 'g', m: { t: 'quit' } });
  leave(null);
}

/** Salir de la sala (el anfitrión la cierra; el invitado la deja libre). `why` = aviso para mostrar en el lobby. */
export async function leave(why = null) {
  const s = sess; if (!s) return;
  if (s.inMatch) hooks.onMatchStop?.();
  sess = null;
  clearInterval(s.hb); clearInterval(s.poll); clearTimeout(s.gone); clearTimeout(s.pickT); clearTimeout(s.lostT);
  try { s.link?.close(); } catch { /* nada */ }
  hideModal();
  try { s.ch?.untrack?.(); s.ch?.unsubscribe(); } catch { /* nada */ }
  try { (await Auth.getClient()).rpc('leave_room', { p_id: s.room.id }); } catch { /* nada */ }
  PM.closeWizard();
  open(); if (why) note(why);
}
