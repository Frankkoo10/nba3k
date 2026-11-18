/* ============================================================================
   Tabla de puntos (box score) del partido.
   Se ve mientras mantenés apretada la tecla (Tab) o el botón del joystick (← de la cruceta), y se va al soltar.
   Sirve en todos los modos: partido casual, online (anfitrión e invitado) y partidos de la carrera.

   Estadísticas por jugador: minutos, puntos, rebotes, asistencias, robos, tapones, pérdidas, faltas, tiros de campo, triples y libres.
   Las suma main.js (el anfitrión / el partido local simula todo). En online, el anfitrión manda el resumen dentro de los snapshots (pack / unpack).
   ========================================================================== */
export const FIELDS = ['sec', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta'];
const IX = Object.fromEntries(FIELDS.map((f, i) => [f, i]));

let meta = [null, null];                       // por equipo: { ab, name, logo, c1, c2, order: [keys], players: Map(key → { name, number, pos }) }
let rows = [new Map(), new Map()];             // por equipo: key → [valores en el orden de FIELDS]
let qpts = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]; // puntos por cuarto (el último casillero junta los suplementarios)
let dirty = true;

const blank = () => FIELDS.map(() => 0);
const rowOf = (t, key) => { let r = rows[t].get(key); if (!r) { r = blank(); rows[t].set(key, r); } return r; };

/** Arranca un partido: los dos planteles en el orden en que se muestran (titulares primero) */
export function reset(teamA, teamB, playersA, playersB) {
  rows = [new Map(), new Map()]; qpts = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
  meta = [[teamA, playersA], [teamB, playersB]].map(([t, list]) => ({
    ab: t.ab, name: t.name, logo: t.logo, c1: t.c1 || '#1d428a', c2: t.c2 || '#ffc72c',
    order: list.map(p => String(p.id ?? p.name)),
    players: new Map(list.map(p => [String(p.id ?? p.name), { name: p.name || '', number: p.number ?? '', pos: p.pos || '' }])),
  }));
  dirty = true;
}
/** Suma n a una estadística de un jugador (team: 0 / 1, key: id del jugador) */
export function add(team, key, field, n = 1) {
  if (!meta[team] || !(field in IX)) return;
  const r = rowOf(team, key); r[IX[field]] = Math.max(0, r[IX[field]] + n);
  if (r[IX.fgm] > r[IX.fga]) r[IX.fga] = r[IX.fgm];           // nunca más aciertos que intentos
  if (r[IX.tpm] > r[IX.tpa]) r[IX.tpa] = r[IX.tpm];
  if (r[IX.ftm] > r[IX.fta]) r[IX.fta] = r[IX.ftm];
  if (r[IX.tpa] > r[IX.fga]) r[IX.fga] = r[IX.tpa];
  if (field !== 'sec') dirty = true;
}
export function addQ(team, quarter, pts) { const q = Math.min(Math.max(1, quarter), 5) - 1; if (qpts[team]) { qpts[team][q] += pts; dirty = true; } }
export const get = (team, key, field) => rows[team]?.get(key)?.[IX[field]] || 0;

/* ---- online: el anfitrión empaqueta, el invitado desempaqueta ---- */
export function pack() {
  return { r: [0, 1].map(t => [...rows[t]].map(([k, v]) => [k, ...v.map(x => Math.round(x * 10) / 10)])), q: qpts.map(a => [...a]) };
}
export function unpack(m) {
  if (!m || !Array.isArray(m.r)) return;
  [0, 1].forEach(t => { rows[t] = new Map((m.r[t] || []).map(row => [String(row[0]), FIELDS.map((_, i) => +row[i + 1] || 0)])); });
  if (Array.isArray(m.q)) qpts = m.q.map(a => FIELDS.slice(0, 5).map((_, i) => +a[i] || 0));
  dirty = true;
}

/* ---- pantalla ---- */
let el = null, held = { kb: false, pad: false }, allowed = true, shown = false, lastHtml = '', lastT = 0, ctxFn = null;
const $el = () => {
  if (el) return el;
  el = document.getElementById('boxscore');
  if (!el) { el = document.createElement('section'); el.id = 'boxscore'; el.hidden = true; document.body.appendChild(el); }
  return el;
};
export const isShown = () => shown;
/** de dónde viene "mantener apretado": 'kb' (teclado / mouse) o 'pad' (joystick) */
export function setHeld(src, v) { if (held[src] !== !!v) { held[src] = !!v; apply(); } }
/** ¿se puede mostrar ahora? (no con menús o la pausa abiertos) */
export function setAllowed(v) { if (allowed !== !!v) { allowed = !!v; apply(); } }
export function releaseAll() { held = { kb: false, pad: false }; apply(); }
/** quién arma lo que no guarda este módulo (marcador, cuarto, reloj, quién está en cancha): main.js */
export function setContext(fn) { ctxFn = fn; }
function apply() {
  const want = allowed && (held.kb || held.pad);
  if (want === shown) return;
  shown = want; const e = $el(); e.hidden = !want; document.body.classList.toggle('bx-open', want);
  if (want) { dirty = true; lastHtml = ''; render(true); }
}
/** se llama en cada cuadro: refresca el panel unas 5 veces por segundo mientras está abierto */
export function tick() { if (shown) render(false); }

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = sec => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
const pct = (m, a) => (a ? `${Math.round(m / a * 100)}%` : '–');
const short = n => { const p = String(n).trim().split(/\s+/); return p.length < 2 ? p[0] || '' : `${p[0][0]}. ${p.slice(1).join(' ')}`; };
const QL = ['1', '2', '3', '4', 'TE'];

function teamHtml(t, c) {
  const m = meta[t]; if (!m) return '';
  const on = new Set((c.onCourt?.[t] || []).map(String)), keys = [...m.order, ...[...rows[t].keys()].filter(k => !m.order.includes(k))];
  const tot = blank(), body = [];
  let top = -1; for (const k of keys) top = Math.max(top, rows[t].get(k)?.[IX.pts] || 0);
  for (const k of keys) {
    const r = rows[t].get(k) || blank(), p = m.players.get(k) || { name: k, number: '', pos: '' }, played = r[IX.sec] > 0 || r.some((v, i) => i && v > 0) || on.has(k);
    r.forEach((v, i) => { tot[i] += v; });
    const g = i => (played ? r[IX[i]] : '–');
    body.push(`<tr class="${on.has(k) ? 'on' : ''}${played ? '' : ' dnp'}${played && top > 0 && r[IX.pts] === top ? ' top' : ''}"><td class="bx-num">${esc(p.number)}</td><td class="bx-nm"><i></i>${esc(short(p.name))}<small>${esc(p.pos)}</small></td>`
      + `<td>${played ? mmss(r[IX.sec]) : '–'}</td><td class="bx-pts">${g('pts')}</td><td>${g('reb')}</td><td>${g('ast')}</td><td>${g('stl')}</td><td>${g('blk')}</td><td>${g('tov')}</td>`
      + `<td>${played ? `${r[IX.fgm]}-${r[IX.fga]}` : '–'}</td><td>${played ? `${r[IX.tpm]}-${r[IX.tpa]}` : '–'}</td><td>${played ? `${r[IX.ftm]}-${r[IX.fta]}` : '–'}</td><td>${g('pf')}</td></tr>`);
  }
  const score = c.score?.[t] ?? tot[IX.pts], ls = qpts[t].map((v, i) => (i < 4 || c.quarter > 4 || v ? `<span><small>${QL[i]}</small>${v}</span>` : '')).join('');
  return `<section class="bx-team" style="--c1:${m.c1};--c2:${m.c2}">
    <div class="bx-head">${m.logo ? `<img src="${esc(m.logo)}" alt="">` : ''}<div class="bx-tn"><small>${t === 0 ? 'LOCAL' : 'VISITANTE'}</small><b>${esc(m.name)}</b></div><div class="bx-ls">${ls}</div><strong>${score}</strong></div>
    <table><thead><tr><th>#</th><th>JUGADOR</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>ROB</th><th>TAP</th><th>PÉR</th><th>TC</th><th>3P</th><th>TL</th><th>PF</th></tr></thead>
    <tbody>${body.join('')}</tbody>
    <tfoot><tr><td></td><td>EQUIPO</td><td></td><td class="bx-pts">${tot[IX.pts]}</td><td>${tot[IX.reb]}</td><td>${tot[IX.ast]}</td><td>${tot[IX.stl]}</td><td>${tot[IX.blk]}</td><td>${tot[IX.tov]}</td><td>${tot[IX.fgm]}-${tot[IX.fga]}</td><td>${tot[IX.tpm]}-${tot[IX.tpa]}</td><td>${tot[IX.ftm]}-${tot[IX.fta]}</td><td>${tot[IX.pf]}</td></tr></tfoot></table>
    <div class="bx-pc"><span>TC <b>${pct(tot[IX.fgm], tot[IX.fga])}</b></span><span>3P <b>${pct(tot[IX.tpm], tot[IX.tpa])}</b></span><span>TL <b>${pct(tot[IX.ftm], tot[IX.fta])}</b></span></div>
  </section>`;
}
function trainHtml(c) {
  const s = c.training; if (!s) return '';
  return `<section class="bx-train"><small>ENTRENAMIENTO${c.player ? ` · ${esc(c.player)}` : ''}</small><div>`
    + [['ANOTADOS', s.makes], ['TIROS', s.shots], ['EFECTIVIDAD', s.shots ? `${Math.round(s.makes / s.shots * 100)}%` : '0%'], ['RACHA', s.streak], ['MEJOR RACHA', s.best], ['XP', `+${s.xp}`]].map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('') + `</div></section>`;
}
function render(force) {
  const now = performance.now(); if (!force && now - lastT < 200) return; lastT = now;
  const c = ctxFn ? ctxFn() : {}, e = $el();
  const title = c.training ? 'TABLA DE PUNTOS' : 'TABLA DE PUNTOS';
  const html = `<div class="bx-wrap"><header class="bx-top"><span>${title}</span>${c.training ? '' : `<b>${esc(c.qLabel || '')} · ${esc(c.clock || '')}</b>`}<small>${esc(c.hint || 'Soltá la tecla para volver al partido')}</small></header>`
    + (c.training ? trainHtml(c) : `<div class="bx-grid">${teamHtml(0, c)}${teamHtml(1, c)}</div>`) + `</div>`;
  if (html !== lastHtml) { lastHtml = html; e.innerHTML = html; }
}
