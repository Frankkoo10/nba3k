import { TEAMS } from './teams.js';
import { REAL_COURTS } from './courts.js';
import { loadRoster, fallbackRoster, inchesToFtIn } from './roster.js';

/* ============================================================================
   Configuración del entrenamiento: elegís la CANCHA (estadio) y con qué JUGADOR entrenás
   (primero el equipo, después el jugador de su plantel) y si usás la camiseta de su equipo o la remera blanca de práctica.
   Se guarda en el navegador. main.js lo usa así:  TS.open({ onStart(cfg), onBack })  ·  TS.close()  ·  TS.getCfg()
   ========================================================================== */

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'basket3d_train';
const DEF = { court: 'GSW', team: 'LAL', player: null, kit: 'team' };
const cfg = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEF }; } })();
if (!REAL_COURTS.some(c => c.id === cfg.court)) cfg.court = DEF.court;
if (!TEAMS.some(t => t.ab === cfg.team)) cfg.team = DEF.team;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* sin storage */ } };

let hooks = {}, root = null, open_ = false, roster = null, rReq = 0, teamTouched = false;
export const isOpen = () => open_;
export const getCfg = () => ({ ...cfg });

const teamOf = ab => TEAMS.find(t => t.ab === ab);
const allPlayers = () => (roster ? [...roster.starters, ...roster.bench] : []);
const hsl = f => `hsl(${f.h} ${f.s}% ${f.l + f.jitter / 2}%)`;

function loadTeam() {
  const req = ++rReq, team = teamOf(cfg.team);
  roster = null; renderPlayers();
  loadRoster(team).catch(() => fallbackRoster(team)).then(r => {
    if (req !== rReq) return;
    roster = r;
    if (!allPlayers().some(p => p.id === cfg.player)) cfg.player = r.starters[0]?.id ?? null;     // el jugador guardado ya no está en este equipo
    save(); renderPlayers();
  });
}

function build() {
  root = $('ts');
  root.innerHTML = `<div class="ts-bg"></div>
    <header class="ts-head"><div><small>ENTRENAMIENTO</small><h2>Configurá tu entrenamiento</h2></div></header>
    <div class="ts-body">
      <section class="ts-col"><h3><i>1</i> Cancha</h3><div class="ts-courts" id="tsCourts"></div><p class="ts-note">Las canchas de los demás equipos se van sumando de a poco.</p></section>
      <section class="ts-col ts-col-p"><h3><i>2</i> Jugador</h3>
        <div class="ts-teams" id="tsTeams"></div>
        <div class="ts-players" id="tsPlayers"></div>
        <div class="ts-kit"><span>Uniforme</span><div id="tsKit"></div></div>
      </section>
    </div>
    <footer class="ts-foot"><button type="button" class="ts-btn ghost" data-act="back" id="tsBack"><kbd>Esc</kbd>Volver</button><button type="button" class="ts-btn" id="tsGo">¡Entrenar! <i>›</i></button></footer>`;
  root.onclick = e => {
    const b = e.target.closest('[data-do]'); if (!b) return;
    const v = b.dataset.v;
    if (b.dataset.do === 'court') {
      cfg.court = v; save();
      const c = REAL_COURTS.find(x => x.id === v);
      if (c && !teamTouched && cfg.team !== c.team) { cfg.team = c.team; cfg.player = null; loadTeam(); renderTeams(); }      // por defecto entrenás con un jugador del equipo local de esa cancha
      renderCourts();
    } else if (b.dataset.do === 'team') { teamTouched = true; if (cfg.team !== v) { cfg.team = v; cfg.player = null; save(); renderTeams(); loadTeam(); } }
    else if (b.dataset.do === 'player') { teamTouched = true; cfg.player = v; save(); renderPlayers(); }
    else if (b.dataset.do === 'kit') { cfg.kit = v; save(); renderKit(); }
  };
  $('tsBack').onclick = back; $('tsGo').onclick = go;
}

function renderCourts() {
  $('tsCourts').innerHTML = REAL_COURTS.map(c => {
    const t = teamOf(c.team);
    return `<button type="button" class="ts-court${c.id === cfg.court ? ' on' : ''}" data-do="court" data-v="${c.id}" style="--tc:${t?.c1 || '#555'}">
      <span class="ts-floor" style="background:${hsl(c.floor)}"><span class="ts-paint" style="background:${c.paint}"></span><img src="logos/${c.team}.png" alt=""></span>
      <b>${esc(c.arena)}</b><small>${esc(t?.name || c.team)}${c.city ? ' · ' + esc(c.city) : ''}</small></button>`;
  }).join('');
}
function renderTeams() {
  $('tsTeams').innerHTML = TEAMS.map(t => `<button type="button" class="ts-team${t.ab === cfg.team ? ' on' : ''}" data-do="team" data-v="${t.ab}" title="${esc(t.name)}" aria-label="${esc(t.name)}"><img src="${t.logo}" alt=""></button>`).join('');
}
function renderPlayers() {
  const el = $('tsPlayers'); if (!el) return;
  const t = teamOf(cfg.team);
  if (!roster) { el.innerHTML = `<div class="ts-pl-h"><b>${esc(t.name)}</b></div><p class="ts-note">Cargando plantel…</p>`; return; }
  const row = p => `<button type="button" class="ts-pl${p.id === cfg.player ? ' on' : ''}" data-do="player" data-v="${esc(p.id)}">
    <em>${p.number}</em><b>${esc(p.name)}${p.generic ? ' *' : ''}</b><span>${p.pos}</span><span>${inchesToFtIn(p.heightIn)}</span><strong>${Math.round(p.ovr)}</strong></button>`;
  el.innerHTML = `<div class="ts-pl-h"><b>${esc(t.name)}</b><small>TITULARES</small></div>${roster.starters.map(row).join('')}<div class="ts-pl-h"><small>BANCO</small></div>${roster.bench.map(row).join('')}`;
  el.querySelector('.ts-pl.on')?.scrollIntoView?.({ block: 'nearest' });
}
function renderKit() {
  $('tsKit').innerHTML = [['team', 'Camiseta del equipo'], ['plain', 'Remera de práctica']].map(([v, l]) => `<button type="button" class="${cfg.kit === v ? 'on' : ''}" data-do="kit" data-v="${v}">${l}</button>`).join('');
}

function go() { if (!open_) return; save(); hooks.onStart?.(getCfg()); }
function back() { if (!open_) return; close(); hooks.onBack?.(); }
function onKey(e) {
  if (!open_) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.code;
  if (e.repeat && (k === 'Enter' || k === 'Escape')) { e.preventDefault(); e.stopImmediatePropagation(); return; }   // si dejás apretado Enter en el menú, no arranca solo
  if (k === 'Escape') { back(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (k === 'Enter' && !(e.target && e.target.tagName === 'BUTTON' && e.target.dataset.do)) { go(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (k === 'ArrowLeft' || k === 'ArrowRight') {                          // ← → cambian de equipo
    const i = TEAMS.findIndex(t => t.ab === cfg.team), n = TEAMS[(i + (k === 'ArrowLeft' ? -1 : 1) + TEAMS.length) % TEAMS.length];
    teamTouched = true; cfg.team = n.ab; cfg.player = null; save(); renderTeams(); loadTeam(); e.preventDefault();
  } else if ((k === 'ArrowUp' || k === 'ArrowDown') && roster) {            // ↑ ↓ cambian de jugador
    const l = allPlayers(), i = Math.max(0, l.findIndex(p => p.id === cfg.player));
    cfg.player = l[(i + (k === 'ArrowUp' ? -1 : 1) + l.length) % l.length].id; teamTouched = true; save(); renderPlayers(); e.preventDefault();
  }
}
document.addEventListener('keydown', onKey, true);

export function open(h = {}) {
  hooks = h; if (!root) build();
  teamTouched = false; open_ = true; root.hidden = false;
  renderCourts(); renderTeams(); renderKit(); loadTeam();
}
export function close() { open_ = false; if (root) root.hidden = true; }
