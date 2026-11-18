import { NAT_NAME } from './data.js';

/* ============================================================================
   Creador de DT (como el "Crear manager" de FC): nombre, nacionalidad, edad, apariencia (piel, peinado, color de pelo, barba, anteojos),
   ropa por categorías (Deportivo · Casual · Clásico · Formal, con colores), arquetipo (da una ventaja) y filosofía de juego inicial.
   El avatar se dibuja en SVG, así no hace falta ninguna imagen.
   ========================================================================== */
export const SKIN_HEX = ['#f1c9a5', '#d9a47a', '#b97a50', '#8a5a3a', '#6b4128', '#4a2c1b'];
export const HAIR_NAMES = ['Pelado', 'Corto', 'Fade', 'Rizado', 'Largo', 'Peinado atrás', 'Canoso'];
export const HAIR_COLORS = ['#15120f', '#2b1d14', '#4a3222', '#7a5a36', '#b89560', '#8c8c8c', '#d9d9d9'];
export const SUITS = {
  sport: { name: 'Deportivo', desc: 'Polo y campera de club', looks: ['Polo', 'Campera'] },
  casual: { name: 'Casual', desc: 'Buzo o suéter', looks: ['Suéter', 'Buzo'] },
  classic: { name: 'Clásico', desc: 'Saco abierto y camisa', looks: ['Saco', 'Chaleco'] },
  formal: { name: 'Formal', desc: 'Traje y corbata', looks: ['Traje'] },
};
export const SUIT_COLORS = ['#1f2a44', '#111111', '#3a3f47', '#6b1d2a', '#0f4c3a', '#7a6a55', '#2f5d9e', '#b8b8b8'];
export const ARCH = {
  tactico: { name: 'Táctico', desc: 'Lee los partidos como nadie: +0,5 al nivel de tu equipo en cada partido.', perk: '+0,5 nivel de equipo' },
  motivador: { name: 'Motivador', desc: 'El vestuario lo sigue: la moral del plantel sube más y baja menos.', perk: 'Moral +' },
  formador: { name: 'Formador', desc: 'Los jóvenes mejoran más rápido con él (entrenamiento +20%).', perk: 'Desarrollo +20%' },
  ofensivo: { name: 'Ofensivo', desc: 'Su sistema potencia el ataque (+0,3 de nivel y más tiros).', perk: 'Ataque +' },
  defensivo: { name: 'Defensivo', desc: 'Sus equipos defienden: +0,3 de nivel y menos puntos en contra.', perk: 'Defensa +' },
};
export const PHIL = {
  equilibrado: { name: 'Equilibrado', tac: { pace: 'normal', shot: 'balanced', pass: 'balanced', def: 'normal' } },
  ritmo: { name: 'Ritmo alto', tac: { pace: 'fast', shot: 'balanced', pass: 'team', def: 'normal' } },
  triples: { name: 'Triples', tac: { pace: 'normal', shot: 'threes', pass: 'team', def: 'normal' } },
  defensa: { name: 'Defensa y presión', tac: { pace: 'slow', shot: 'inside', pass: 'balanced', def: 'pressure' } },
  interior: { name: 'Juego interior', tac: { pace: 'slow', shot: 'inside', pass: 'balanced', def: 'normal' } },
};
export const NATS = Object.entries(NAT_NAME);

export function avatarSVG(c, size = 120) {
  const skin = SKIN_HEX[c.skin ?? 2] || SKIN_HEX[2], dark = shade(skin, -0.18), hair = c.hairColor || '#15120f', suit = c.suitColor || '#1f2a44', shirt = c.shirtColor || '#ffffff', tie = c.tieColor || '#b3202a';
  const k = c.suit || 'formal', st = c.hair ?? 1;
  let body = '';
  if (k === 'formal') body = `<path d="M8 120 Q10 86 40 80 L60 80 Q90 86 92 120Z" fill="${suit}"/><path d="M42 80 L50 100 L58 80Z" fill="${shirt}"/><path d="M48 90 L52 90 L54 112 L50 116 L46 112Z" fill="${tie}"/><path d="M38 80 L50 100 L40 120 L30 100Z" fill="${shade(suit, 0.08)}"/><path d="M62 80 L50 100 L60 120 L70 100Z" fill="${shade(suit, 0.08)}"/>`;
  else if (k === 'classic') body = `<path d="M8 120 Q10 86 40 80 L60 80 Q90 86 92 120Z" fill="${suit}"/><path d="M40 80 L50 104 L60 80Z" fill="${shirt}"/><path d="M38 80 L48 120 L30 120 L28 96Z" fill="${shade(suit, 0.1)}"/><path d="M62 80 L52 120 L70 120 L72 96Z" fill="${shade(suit, 0.1)}"/>`;
  else if (k === 'casual') body = `<path d="M6 120 Q8 84 38 80 L62 80 Q92 84 94 120Z" fill="${suit}"/><path d="M38 80 Q50 92 62 80" fill="none" stroke="${shade(suit, -0.15)}" stroke-width="5"/><path d="M26 108 H74" stroke="${shade(suit, -0.12)}" stroke-width="2"/>`;
  else body = `<path d="M8 120 Q10 86 40 80 L60 80 Q90 86 92 120Z" fill="${suit}"/><path d="M40 80 L50 90 L60 80 L56 76 L44 76Z" fill="${shirt}"/><rect x="47" y="90" width="6" height="30" fill="${shade(suit, 0.15)}"/><path d="M18 100 H34 M66 100 H82" stroke="${shirt}" stroke-width="2.5"/>`;
  const hairBack = st === 4 ? `<path d="M26 44 Q22 80 32 86 L34 58Z M74 44 Q78 80 68 86 L66 58Z" fill="${hair}"/>` : '';
  const hairTop = [
    '', `<path d="M27 46 Q27 22 50 22 Q73 22 73 46 Q70 34 50 34 Q30 34 27 46Z" fill="${hair}"/>`,
    `<path d="M29 44 Q30 25 50 25 Q70 25 71 44 Q68 33 50 33 Q32 33 29 44Z" fill="${hair}"/>`,
    `<g fill="${hair}"><circle cx="34" cy="34" r="8"/><circle cx="46" cy="27" r="9"/><circle cx="58" cy="27" r="9"/><circle cx="68" cy="35" r="8"/><circle cx="30" cy="44" r="5"/><circle cx="71" cy="44" r="5"/></g>`,
    `<path d="M26 50 Q24 20 50 20 Q76 20 74 50 Q72 32 50 30 Q28 32 26 50Z" fill="${hair}"/>`,
    `<path d="M28 44 Q28 20 54 22 Q74 24 73 44 Q66 28 48 30 Q34 32 28 44Z" fill="${hair}"/>`,
    `<path d="M27 46 Q27 22 50 22 Q73 22 73 46 Q70 34 50 34 Q30 34 27 46Z" fill="${hair}"/>`,
  ][st] || '';
  const beard = c.beard === 2 ? `<path d="M30 56 Q32 82 50 84 Q68 82 70 56 Q62 68 50 66 Q38 68 30 56Z" fill="${hair}" opacity=".92"/>` : c.beard === 1 ? `<path d="M31 58 Q34 78 50 80 Q66 78 69 58 Q62 70 50 68 Q38 70 31 58Z" fill="${hair}" opacity=".35"/>` : '';
  const glasses = c.glasses === 1 ? `<g fill="none" stroke="#111" stroke-width="1.6"><circle cx="41" cy="51" r="6.5"/><circle cx="59" cy="51" r="6.5"/><path d="M47.5 51 H52.5"/></g>` : c.glasses === 2 ? `<g fill="none" stroke="#111" stroke-width="1.8"><rect x="33" y="45" width="15" height="11" rx="2"/><rect x="52" y="45" width="15" height="11" rx="2"/><path d="M48 50 H52"/></g>` : '';
  return `<svg viewBox="0 0 100 120" width="${size}" height="${size * 1.2}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${hairBack}${body}<rect x="43" y="68" width="14" height="14" fill="${dark}"/><ellipse cx="50" cy="52" rx="22" ry="26" fill="${skin}"/><ellipse cx="28" cy="54" rx="3.5" ry="6" fill="${dark}"/><ellipse cx="72" cy="54" rx="3.5" ry="6" fill="${dark}"/>${hairTop}${beard}<g fill="#1a1410"><ellipse cx="41" cy="51" rx="2.1" ry="2.5"/><ellipse cx="59" cy="51" rx="2.1" ry="2.5"/></g><path d="M35 45 Q41 42 46 45 M54 45 Q59 42 65 45" stroke="${hair}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M50 53 L48 62 Q50 64 53 62" stroke="${dark}" stroke-width="1.6" fill="none"/><path d="M43 69 Q50 73 57 69" stroke="${c.beard === 2 ? skin : '#7a3b34'}" stroke-width="2" fill="none" stroke-linecap="round"/>${glasses}</svg>`;
}
function shade(hex, a) {
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(a > 0 ? v + (255 - v) * a : v * (1 + a))));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}
