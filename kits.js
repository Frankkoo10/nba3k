/* ============================================================================
   Camisetas. Cada equipo tiene 4 (como en 2K / FC): Icon (color principal), Association (blanca),
   Statement (color secundario u oscuro) y City (negra con vivos). Salen de los colores del equipo (teams.js).
   Los Lakers conservan su Icon Edition de siempre (oro con vivos violeta).
   Cada camiseta trae los colores del uniforme y de los textos (frente, número y nombre) que dibuja rig.js.
   ========================================================================== */

const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
export const lum = h => { const [r, g, b] = hex(h).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** Distancia de color 0..~1.7 (misma escala que usaba el juego: 0.35 = muy parecidos). */
export const colorDist = (a, b) => { const x = hex(a), y = hex(b); return Math.hypot(...x.map((v, i) => (v - y[i]) / 255)); };

const WHITE = '#F4F5F7', BLACK = '#14161B';

/** Colores de los textos (nombre, número, frente) para que siempre se lean sobre la camiseta. */
function ink(jersey, accent, trim) {
  const light = lum(jersey) > 0.55;
  const cand = [accent, trim, light ? BLACK : WHITE];
  const fill = cand.find(c => Math.abs(lum(c) - lum(jersey)) > 0.38) || (light ? BLACK : WHITE);
  const edge = Math.abs(lum(fill) - lum(jersey)) > 0.7 ? jersey : (lum(fill) > 0.5 ? BLACK : WHITE);
  return { wordFill: fill, wordStroke: edge, numFill: fill, numStroke: edge, nameFill: fill, nameStroke: edge };
}

function make(id, name, jersey, shorts, accent, trim, shoes, extra = {}) {
  return { id, name, jersey, shorts, accent, trim, shoes, details: true, ...ink(jersey, accent, trim), ...extra };
}

const sat = h => { const v = hex(h); return (Math.max(...v) - Math.min(...v)) / 255; };
const vivid = h => lum(h) < 0.5 || sat(h) > 0.35;                     // color con carácter (no blanco ni gris clarito)
/** Primer candidato que se distingue de todos los colores que ya hay; si ninguno, el último. */
const distinct = (cands, have, min) => cands.find(c => have.every(h => colorDist(c, h) > min)) || cands[cands.length - 1];

export function kitsFor(team) {
  const { c1, c2 } = team;
  const kits = [];
  // Icon: el color principal del equipo
  if (team.ab === 'LAL') {
    kits.push(make('icon', 'Icon', '#FDB927', '#FDB927', '#552583', '#FFFFFF', '#552583',
      { wordFill: '#552583', wordStroke: '#FFFFFF', numFill: '#FFFFFF', numStroke: '#552583', nameFill: '#FDB927', nameStroke: '#552583' }));
  } else {
    kits.push(make('icon', 'Icon', c1, mix(c1, '#000000', 0.2), c2, '#FFFFFF', c2));
  }
  // Association: blanca con vivos del color del equipo
  kits.push(make('association', 'Association', WHITE, WHITE, c1, c2, c1));
  // Statement: el otro color del equipo (si tiene carácter) o una versión oscura; nunca igual a las anteriores
  let have = kits.map(k => k.jersey);
  const st = distinct([vivid(c2) ? c2 : null, c1, mix(c1, '#000000', 0.55), '#7B8089'].filter(Boolean), have, 0.3);
  const stAcc = distinct([c1, c2, WHITE], [st], 0.3);
  kits.push(make('statement', 'Statement', st, mix(st, '#000000', 0.2), stAcc, WHITE, stAcc));
  // City: oscura con vivos; si el equipo ya es oscuro, una alternativa distinta
  have = kits.map(k => k.jersey);
  const ct = distinct([BLACK, mix(c1, '#000000', 0.5), vivid(c2) ? c2 : null, mix(c1, '#FFFFFF', 0.4)].filter(Boolean), have, 0.22);
  const ctAcc = distinct([c1, c2, WHITE], [ct], 0.3);
  kits.push(make('city', 'City', ct, mix(ct, '#000000', 0.15), ctAcc, lum(ct) < 0.3 ? c2 : '#111111', ctAcc));
  /* Indiana Pacers (v45): sus 4 uniformes son los de los modelos 3D de Haliburton (assets/jugadores/ind/tyrese_haliburton/, archivos _1 a _4):
     Icon = azul oscuro · Association = blanca · Statement = amarilla · y el 4.º (id 'city', que es el lugar de la 4.ª camiseta de cada equipo) = Classic, azul claro con línea amarilla.
     Ninguno de los 4 modelos es negro, así que para IND el 4.º reemplaza a la City negra de siempre. Los otros 29 equipos no cambian. */
  if (team.ab === 'IND') kits[3] = make('city', 'Classic', '#093785', '#072C6B', '#FDBB30', '#FFFFFF', '#FDBB30');
  return kits;
}

export const kitById = (team, id) => { const k = kitsFor(team); return k.find(x => x.id === id) || k[0]; };

/** ¿Las dos camisetas se confunden en cancha? (se mira la camiseta y también el short) */
export const kitsClash = (a, b) => colorDist(a.jersey, b.jersey) < 0.42 || (colorDist(a.jersey, b.jersey) < 0.55 && colorDist(a.shorts, b.shorts) < 0.35);

/** Elige para el rival la camiseta que más se distingue de `mine` (prefiere Icon y Association si empatan). */
export function autoKit(team, mine) {
  const ks = kitsFor(team);
  let best = ks[0], bs = -1;
  ks.forEach((k, i) => { const s = colorDist(k.jersey, mine.jersey) + colorDist(k.shorts, mine.shorts) * 0.4 - i * 0.04; if (s > bs) { bs = s; best = k; } });
  return best;
}

export const nickname = team => String(team.name).split(' ').slice(-1)[0].toUpperCase();

/* ---- Uniformes (v52): se dibujan por código (SVG), sin PNG de conjuntos, así el juego pesa menos ---- */
/** Dibujo de la camiseta para el menú (SVG generado por código). */
export function kitArt(team, kit, number = 23, word = '') {
  return `<span class="kitart">${kitSVG(kit, number, word)}</span>`;
}

/** Dibujo (SVG) de la camiseta y el short para la vista previa del menú. */
export function kitSVG(kit, number = 23, word = '') {
  const id = 'k' + Math.random().toString(36).slice(2, 8);
  const j = kit.jersey, a = kit.accent, t = kit.trim;
  const fs = Math.max(7, Math.min(13, 78 / Math.max(6, String(word).length)));   // apodos largos: letra más chica
  return `<svg viewBox="0 0 120 150" class="kit-svg" aria-hidden="true">
  <defs><clipPath id="${id}"><path d="M34 6 L48 6 Q60 22 72 6 L86 6 L104 22 L96 52 L90 50 L92 104 L28 104 L30 50 L24 52 L16 22 Z"/></clipPath>
  <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>
  <g clip-path="url(#${id})">
    <rect x="0" y="0" width="120" height="110" fill="${j}"/>
    <rect x="22" y="0" width="9" height="110" fill="${a}"/><rect x="31" y="0" width="2.4" height="110" fill="${t}"/>
    <rect x="89" y="0" width="9" height="110" fill="${a}"/><rect x="86.6" y="0" width="2.4" height="110" fill="${t}"/>
    <path d="M34 6 L48 6 Q60 22 72 6 L86 6 L86 11 L72 11 Q60 27 48 11 L34 11 Z" fill="${a}"/>
    <rect x="0" y="0" width="120" height="110" fill="url(#${id}g)"/>
  </g>
  <text x="60" y="44" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-style="italic" font-size="${fs.toFixed(1)}" fill="${kit.wordFill}" stroke="${kit.wordStroke}" stroke-width=".6" paint-order="stroke">${word}</text>
  <text x="60" y="84" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="40" fill="${kit.numFill}" stroke="${kit.numStroke}" stroke-width="1.6" paint-order="stroke">${number}</text>
  <path d="M30 108 L90 108 L96 146 L64 146 L60 128 L56 146 L24 146 Z" fill="${kit.shorts}"/>
  <path d="M30 108 L90 108 L90 113 L30 113 Z" fill="${a}"/>
  <path d="M24 146 L30 108 L34 108 L29 146 Z M96 146 L90 108 L86 108 L91 146 Z" fill="${a}"/>
</svg>`;
}
