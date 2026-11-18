import { TEAMS } from './teams.js';

/* ============================================================================
   Canchas. Cada equipo va a tener la suya (se agregan de a poco). Una cancha es solo datos:
   los colores del parquet y la pintura, el logo del centro, las pantallas LED, las butacas, el público,
   los banners y el tablero colgante. arena.js (estadio) y main.js (parquet) las dibujan.

   Para agregar una cancha nueva:
     1) copiá el bloque de IND (o GSW) y cambiá los datos;
     2) agregalo al arreglo REAL de abajo.
   Con `model` (GSW, SAS, HOU, CHA, LAL) la cancha usa un GLB calibrado en assets/: el piso 3D reemplaza al parquet, las líneas, la pintura y el logo del centro que dibuja el juego
   (los datos de `surface`, `logo` y `floorTexts` de esos equipos quedan como respaldo por si el GLB no carga). Para sumar otra: python3 tools/calibrar_cancha.py <archivo>.glb <ab> (ver README).
   Los equipos que todavía no tienen cancha propia usan una cancha genérica con sus colores y su escudo.
   ========================================================================== */

const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lumOf = h => { const [r, g, b] = hex(h).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

/* ---- Chase Center · Golden State Warriors (la cancha de siempre) ---- */
const GSW = {
  id: 'GSW', team: 'GSW', arena: 'Chase Center', city: 'San Francisco', real: true,
  floor: { h: 34, s: 58, l: 60, jitter: 8 },            // parquet claro y cálido
  paint: '#1D428A', paintRough: 0.5,
  logo: { team: 'GSW', size: 3.3 },
  floorTexts: [],
  model: 'assets/gsw_court.glb', apron: '#ffc324',      // cancha 3D (piso con líneas y logos + soportes de los aros); apron = color del contorno
  led: { text: 'WARRIORS  ★  CHASE CENTER  ★  GOLDEN STATE  ★  STRENGTH IN NUMBERS  ★  ', bg: '#1D428A', fg: '#FFC72C', accent: '#FFC72C' },
  seats: { lower: '#2457b5', upper: '#17336f', accent: '#FFC72C' },
  crowd: [['#FFC72C', 0.42], ['#1D428A', 0.22], ['#f2f2f2', 0.14], ['#ffd96b', 0.06], ['#15171c', 0.06], ['#8b95a5', 0.10]],
  banners: { bg: '#1D428A', fg: '#FFC72C', trim: '#FFC72C', list: [1947, 1956, 1975, 2015, 2017, 2018, 2022].map(y => ({ l1: 'NBA', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'CHASE CENTER', top: '#102a63', bottom: '#070d1f', accent: '#FFC72C', bar: '#0b1a3a' },
  tableCol: '#1d428a', wall: 0x10141f, roof: 0x3a2f27, sky: 0x0a0f1d,
};

/* ---- Gainbridge Fieldhouse · Indiana Pacers ----
   Parquet gris claro, pintura negra, el logo "P" amarillo gigante con la pelota negra en el centro,
   tribuna llena de camisetas amarillas, butacas azul oscuro y pantallas LED azules. */
const IND = {
  id: 'IND', team: 'IND', arena: 'Gainbridge Fieldhouse', city: 'Indianápolis', real: true,
  floor: { h: 34, s: 9, l: 64, jitter: 5 },
  paint: '#15161a', paintRough: 0.55,
  logo: { team: 'IND', size: 5.4, recolor: 'ind', distress: true },
  floorTexts: [{ text: 'GAINBRIDGE FIELDHOUSE', x: 8.75, z: 0, color: 'rgba(40,42,48,.78)', size: 0.5 }, { text: 'GAINBRIDGE FIELDHOUSE', x: -8.75, z: 0, color: 'rgba(40,42,48,.78)', size: 0.5 }],
  led: { text: 'PACERS  ★  GAINBRIDGE FIELDHOUSE  ★  BOOM BABY  ★  INDIANA PACERS  ★  ', bg: '#0b2a6b', fg: '#ffffff', accent: '#FDBB30' },
  seats: { lower: '#13294f', upper: '#0c1d3d', accent: '#FDBB30' },
  crowd: [['#FDBB30', 0.56], ['#ffd96b', 0.07], ['#0c2340', 0.11], ['#f2f2f2', 0.10], ['#15171c', 0.07], ['#8b95a5', 0.09]],
  banners: {
    bg: '#0c2340', fg: '#FDBB30', trim: '#FDBB30',
    list: [{ l1: 'ABA', l2: 'CHAMPIONS', year: 1970 }, { l1: 'ABA', l2: 'CHAMPIONS', year: 1972 }, { l1: 'ABA', l2: 'CHAMPIONS', year: 1973 },
      { l1: 'EAST', l2: 'CHAMPIONS', year: 2000 }, { l1: 'EAST', l2: 'CHAMPIONS', year: 2025 }],
  },
  board: { title: 'GAINBRIDGE FIELDHOUSE', top: '#0e2a5c', bottom: '#060b18', accent: '#FDBB30', bar: '#0c2340' },
  tableCol: '#0c2340', wall: 0x12161f, roof: 0x242932, sky: 0x0a0f1d,
};

/* ---- Spectrum Center · Charlotte Hornets ----
   Parquet claro con rombos (cubos) tenues, todo el contorno y las zonas pintados de turquesa con panal de abejas,
   el escudo del avispón gigante en el centro, \"CHARLOTTE\" y \"HORNETS\" en las líneas de fondo, \"BUZZ CITY\" en la banda,
   los avispones chicos en las esquinas y el cartel \"Spectrum CENTER\" sobre el parquet. Butacas negras. */
const CHA = {
  id: 'CHA', team: 'CHA', arena: 'Spectrum Center', city: 'Charlotte', real: true,
  model: 'assets/cha_court.glb', apron: '#007f94',     // cancha 3D calibrada (igual que la de los Warriors): piso con líneas y logos + soportes y tableros; apron = color del contorno
  floor: { h: 37, s: 50, l: 70, jitter: 5 },
  paint: '#0f93a6', paintRough: 0.5,
  logo: { team: 'CHA', size: 5.4 },
  floorTexts: [],
  surface: {                                                  // pintura que va por encima del parquet (ver paintSurface en arena.js)
    color: '#0f93a6', hex: 'rgba(255,255,255,.16)', keyHex: 'rgba(255,255,255,.22)',
    diamonds: { light: 'rgba(255,255,255,.17)', dark: 'rgba(110,70,30,.13)', r: 0.62 },
    texts: [
      { text: 'CHARLOTTE', x: 0, z: -16.3, h: 1.35, rot: 0, color: '#ffffff', stroke: '#1D1160', maxW: 14 },
      { text: 'HORNETS', x: 0, z: 16.3, h: 1.35, rot: Math.PI, color: '#ffffff', stroke: '#1D1160', maxW: 14 },
      { text: 'BUZZ CITY', x: -8.95, z: 0, h: 1.05, rot: Math.PI / 2, color: '#1D1160', maxW: 9 },
      { text: '@hornets', x: 8.95, z: -5.2, h: 0.5, rot: Math.PI / 2, color: '#ffffff', maxW: 4 },
      { text: 'hornets.com', x: 8.95, z: 5.2, h: 0.5, rot: Math.PI / 2, color: '#ffffff', maxW: 5 },
      { text: 'Spectrum', sub: 'CENTER', x: 4.3, z: -3.6, h: 0.62, rot: Math.PI / 2, color: '#0b0b0f', maxW: 3.2 },
      { text: 'Spectrum', sub: 'CENTER', x: -4.3, z: 3.6, h: 0.62, rot: Math.PI / 2, color: '#0b0b0f', maxW: 3.2 },
    ],
    minis: [{ team: 'CHA', x: 5.4, z: 9.6, size: 1.7, rot: Math.PI / 2 }, { team: 'CHA', x: -5.4, z: -9.6, size: 1.7, rot: Math.PI / 2 }],
  },
  led: { text: 'HORNETS  ★  SPECTRUM CENTER  ★  BUZZ CITY  ★  CHARLOTTE  ★  ', bg: '#1D1160', fg: '#2fc7d6', accent: '#00788C' },
  seats: { lower: '#2b2e35', upper: '#1b1d23', accent: '#00788C' },
  crowd: [['#00A3B4', 0.30], ['#ffffff', 0.18], ['#1D1160', 0.20], ['#15171c', 0.12], ['#6a4bc4', 0.08], ['#8b95a5', 0.12]],
  banners: null,
  board: { title: 'SPECTRUM CENTER', top: '#241570', bottom: '#070b16', accent: '#2fc7d6', bar: '#1D1160' },
  tableCol: '#1D1160', wall: 0x10141f, roof: 0x24262d, sky: 0x0a0f1d,
};

/* ---- Delta Center · Utah Jazz ----
   Parquet claro, líneas negras (el borde en blanco), zonas azul oscuro con arcos amarillos, contorno negro con \"UTAH JAZZ\" amarillo
   inclinado en las líneas de fondo, la nota del Jazz con la pelota en negro en el centro y \"Delta Center\" sobre el parquet. */
const UTA = {
  id: 'UTA', team: 'UTA', arena: 'Delta Center', city: 'Salt Lake City', real: true,
  floor: { h: 35, s: 48, l: 69, jitter: 5 },
  paint: '#101e2b', paintRough: 0.5, lineColor: '#0b0d10', edgeColor: '#e9e9e9',
  logo: { team: 'UTA', size: 5.2 },
  floorTexts: [],
  surface: {
    color: '#0b0e12',
    keyArcs: { color: '#F9A01B' },
    texts: [
      { text: 'UTAH JAZZ', x: 0, z: -16.3, h: 1.5, rot: 0, color: '#F9A01B', italic: true, maxW: 13 },
      { text: 'UTAH JAZZ', x: 0, z: 16.3, h: 1.5, rot: Math.PI, color: '#F9A01B', italic: true, maxW: 13 },
      { text: 'Delta', sub: 'CENTER', x: 4.4, z: -4.6, h: 0.5, rot: Math.PI / 2, color: '#3a2a22', maxW: 2.8 },
      { text: 'Delta', sub: 'CENTER', x: -4.4, z: 4.6, h: 0.5, rot: Math.PI / 2, color: '#3a2a22', maxW: 2.8 },
      { text: 'PACS', x: 8.95, z: -8, h: 0.55, rot: Math.PI / 2, color: '#ffffff', maxW: 3 },
      { text: 'HEALTH', x: 8.95, z: 8, h: 0.55, rot: Math.PI / 2, color: '#ffffff', maxW: 3.6 },
      { text: 'HEALTH', x: -8.95, z: 0, h: 0.8, rot: Math.PI / 2, color: '#ffffff', maxW: 5 },
    ],
  },
  led: { text: 'UTAH JAZZ  ★  DELTA CENTER  ★  SALT LAKE CITY  ★  JAZZ  ★  ', bg: '#0b1a33', fg: '#F9A01B', accent: '#F9A01B' },
  seats: { lower: '#1e2536', upper: '#121722', accent: '#F9A01B' },
  crowd: [['#2c3a55', 0.18], ['#15171c', 0.22], ['#f2f2f2', 0.13], ['#F9A01B', 0.13], ['#8b95a5', 0.18], ['#6b7fa0', 0.16]],
  banners: { bg: '#0b1a33', fg: '#F9A01B', trim: '#F9A01B', list: [1997, 1998].map(y => ({ l1: 'WEST', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'DELTA CENTER', top: '#0e2142', bottom: '#060a14', accent: '#F9A01B', bar: '#0b1a33' },
  tableCol: '#0b1a33', wall: 0x10141f, roof: 0x20232b, sky: 0x0a0f1d,
};

/* ---- Frost Bank Center · San Antonio Spurs (cancha de Finales) ----
   Parquet casi blanco, zonas negras con arcos grises, contorno negro con \"SPURS\" blanco en el fondo, la espuela negra sobre el
   trofeo dorado en el centro y \"Frost Bank CENTER\" sobre el parquet. Tribuna oscura de plateados y negros. */
const SAS = {
  id: 'SAS', team: 'SAS', arena: 'Frost Bank Center', city: 'San Antonio', real: true,
  model: 'assets/sas_court.glb', apron: '#111113',     // cancha 3D calibrada (igual que la de los Warriors): piso con líneas y logos + soportes y tableros; apron = color del contorno
  floor: { h: 38, s: 40, l: 80, jitter: 4 },
  paint: '#0b0b0d', paintRough: 0.5, lineColor: '#121214', edgeColor: '#f2f2f2',
  logo: { team: 'SAS', img: 'SAS_SPUR', size: 2.9 },
  floorTexts: [],
  surface: {
    color: '#0c0c0e',
    keyArcs: { color: '#aab2b9' },
    decor: [{ type: 'trophy', x: 0, z: 0, size: 5.4, rot: Math.PI / 2 }],
    texts: [
      { text: 'SPURS', x: 0, z: -16.3, h: 1.6, rot: 0, color: '#ffffff', maxW: 11 },
      { text: 'SPURS', x: 0, z: 16.3, h: 1.6, rot: Math.PI, color: '#ffffff', maxW: 11 },
      { text: 'Frost Bank', sub: 'CENTER', x: 4.3, z: -4.2, h: 0.5, rot: Math.PI / 2, color: '#2b2b30', weight: 700, maxW: 3.4 },
      { text: 'Frost Bank', sub: 'CENTER', x: -4.3, z: 4.2, h: 0.5, rot: Math.PI / 2, color: '#2b2b30', weight: 700, maxW: 3.4 },
      { text: 'SAN ANTONIO', x: -8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#c4ced4', maxW: 6 },
    ],
  },
  led: { text: 'SPURS  ★  FROST BANK CENTER  ★  GO SPURS GO  ★  SAN ANTONIO  ★  ', bg: '#0a0a0c', fg: '#C4CED4', accent: '#C4CED4' },
  seats: { lower: '#23252a', upper: '#15161a', accent: '#C4CED4' },
  crowd: [['#15171c', 0.34], ['#f2f2f2', 0.22], ['#C4CED4', 0.2], ['#8b95a5', 0.12], ['#3a3d45', 0.12]],
  banners: { bg: '#0c0c0e', fg: '#C4CED4', trim: '#C4CED4', list: [1999, 2003, 2005, 2007, 2014].map(y => ({ l1: 'NBA', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'FROST BANK CENTER', top: '#1b1c20', bottom: '#060709', accent: '#C4CED4', bar: '#0c0c0e' },
  tableCol: '#15161a', wall: 0x0f1115, roof: 0x1f2126, sky: 0x08090d,
};

/* ---- Staples Center · Los Angeles Lakers ----
   Contorno amarillo, zonas violetas, parquet claro, el escudo del Lakers en el centro, \"STAPLES CENTER\" en naranja sobre el
   parquet, logos dorados chicos y \"LAKERS\" violeta en las líneas de fondo. Tribuna violeta y dorada. */
const LAL = {
  id: 'LAL', team: 'LAL', arena: 'Staples Center', city: 'Los Ángeles', real: true,
  model: 'assets/lal_court.glb', apron: '#f8b422',     // cancha 3D calibrada (igual que la de los Warriors): piso con líneas y logos + soportes y tableros; apron = color del contorno
  floor: { h: 44, s: 50, l: 81, jitter: 4 },
  paint: '#5b2a91', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'LAL', size: 4.6 },
  floorTexts: [],
  surface: {
    color: '#FDB927',
    texts: [
      { text: 'LAKERS', x: 0, z: -16.3, h: 1.5, rot: 0, color: '#552583', maxW: 10 },
      { text: 'LAKERS', x: 0, z: 16.3, h: 1.5, rot: Math.PI, color: '#552583', maxW: 10 },
      { text: 'STAPLES', sub: 'CENTER', x: 4.7, z: -4.4, h: 0.5, rot: Math.PI / 2, color: '#c9531c', maxW: 3.2 },
      { text: 'STAPLES', sub: 'CENTER', x: -4.7, z: 4.4, h: 0.5, rot: Math.PI / 2, color: '#c9531c', maxW: 3.2 },
    ],
    minis: [{ team: 'LAL', x: 5.8, z: -0.4, size: 1.3, rot: Math.PI / 2 }, { team: 'LAL', x: -5.8, z: 0.4, size: 1.3, rot: Math.PI / 2 }],
  },
  led: { text: 'LAKERS  ★  STAPLES CENTER  ★  LOS ANGELES  ★  GO LAKERS  ★  ', bg: '#2b1250', fg: '#FDB927', accent: '#FDB927' },
  seats: { lower: '#552583', upper: '#3b1a5c', accent: '#FDB927' },
  crowd: [['#FDB927', 0.4], ['#552583', 0.24], ['#f2f2f2', 0.14], ['#ffd96b', 0.06], ['#15171c', 0.06], ['#8b95a5', 0.1]],
  banners: { bg: '#552583', fg: '#FDB927', trim: '#FDB927', list: [1972, 1980, 1982, 1985, 1987, 1988, 2000, 2001, 2002, 2009, 2010, 2020].map(y => ({ l1: 'NBA', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'STAPLES CENTER', top: '#33165a', bottom: '#0a0613', accent: '#FDB927', bar: '#2b1250' },
  tableCol: '#552583', wall: 0x12111c, roof: 0x2a2433, sky: 0x0a0a16,
};

/* ---- Rocket Mortgage FieldHouse · Cleveland Cavaliers ----
   Contorno y zonas vino, parquet crema, la \"C\" vino con borde dorado en el centro, \"CLEVELAND\" y \"CAVALIERS\" dorados en el
   fondo, butacas grises y público vino y dorado. */
const CLE = {
  id: 'CLE', team: 'CLE', arena: 'Rocket Mortgage FieldHouse', city: 'Cleveland', real: true,
  floor: { h: 38, s: 50, l: 76, jitter: 4 },
  paint: '#7d1d3b', paintRough: 0.5, lineColor: '#f4ead6', edgeColor: '#f4ead6',
  logo: { team: 'CLE', img: 'CLE_C', size: 4.0 },
  floorTexts: [],
  surface: {
    color: '#6f1f38',
    texts: [
      { text: 'CLEVELAND', x: 0, z: -16.3, h: 1.35, rot: 0, color: '#FDBB30', maxW: 13 },
      { text: 'CAVALIERS', x: 0, z: 16.3, h: 1.35, rot: Math.PI, color: '#FDBB30', maxW: 13 },
      { text: 'ROCKET MORTGAGE FIELDHOUSE', x: -8.95, z: 0, h: 0.6, rot: Math.PI / 2, color: '#FDBB30', maxW: 11 },
    ],
    minis: [{ team: 'CLE_C', x: 5.4, z: 9.6, size: 1.5, rot: Math.PI / 2 }, { team: 'CLE_C', x: -5.4, z: -9.6, size: 1.5, rot: Math.PI / 2 }],
  },
  led: { text: 'CAVALIERS  ★  ROCKET MORTGAGE FIELDHOUSE  ★  CLEVELAND  ★  LET EM KNOW  ★  ', bg: '#3a0a1c', fg: '#FDBB30', accent: '#FDBB30' },
  seats: { lower: '#8e96a3', upper: '#5a616e', accent: '#FDBB30' },
  crowd: [['#860038', 0.3], ['#FDBB30', 0.2], ['#f2f2f2', 0.16], ['#15171c', 0.1], ['#041E42', 0.1], ['#8b95a5', 0.14]],
  banners: {
    bg: '#6f1f38', fg: '#FDBB30', trim: '#FDBB30',
    list: [{ l1: 'EAST', l2: 'CHAMPIONS', year: 2007 }, { l1: 'EAST', l2: 'CHAMPIONS', year: 2015 }, { l1: 'NBA', l2: 'CHAMPIONS', year: 2016 },
      { l1: 'EAST', l2: 'CHAMPIONS', year: 2017 }, { l1: 'EAST', l2: 'CHAMPIONS', year: 2018 }],
  },
  board: { title: 'ROCKET MORTGAGE FIELDHOUSE', top: '#4a0f26', bottom: '#0b0508', accent: '#FDBB30', bar: '#3a0a1c' },
  tableCol: '#6f1f38', wall: 0x14101a, roof: 0x2a2630, sky: 0x0a0a12,
};

/* ---- Toyota Center · Houston Rockets ----
   Parquet dorado cálido, contorno y zonas rojas, el escudo de los Rockets en el centro, \"ROCKETS\" blanco en las líneas de
   fondo, tribuna roja y público de rojo. */
const HOU = {
  id: 'HOU', team: 'HOU', arena: 'Toyota Center', city: 'Houston', real: true,
  model: 'assets/hou_court.glb', apron: '#ce1040',     // cancha 3D calibrada (igual que la de los Warriors): piso con líneas y logos + soportes y tableros; apron = color del contorno
  floor: { h: 40, s: 62, l: 68, jitter: 5 },
  paint: '#c4122f', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'HOU', size: 4.6 },
  floorTexts: [],
  surface: {
    color: '#c4122f',
    texts: [
      { text: 'ROCKETS', x: 0, z: -16.3, h: 1.5, rot: 0, color: '#ffffff', maxW: 11 },
      { text: 'ROCKETS', x: 0, z: 16.3, h: 1.5, rot: Math.PI, color: '#ffffff', maxW: 11 },
      { text: 'TOYOTA CENTER', x: -8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#ffffff', maxW: 8 },
      { text: 'HOUSTON', x: 8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#ffffff', maxW: 6 },
    ],
  },
  led: { text: 'ROCKETS  ★  TOYOTA CENTER  ★  HOUSTON  ★  CLUTCH CITY  ★  ', bg: '#5a0a1e', fg: '#ffffff', accent: '#CE1141' },
  seats: { lower: '#a50f33', upper: '#6e0a22', accent: '#C4CED4' },
  crowd: [['#CE1141', 0.5], ['#f2f2f2', 0.15], ['#15171c', 0.1], ['#C4CED4', 0.1], ['#8b0b2b', 0.15]],
  banners: {
    bg: '#8f0c2d', fg: '#ffffff', trim: '#C4CED4',
    list: [{ l1: 'WEST', l2: 'CHAMPIONS', year: 1981 }, { l1: 'WEST', l2: 'CHAMPIONS', year: 1986 }, { l1: 'NBA', l2: 'CHAMPIONS', year: 1994 }, { l1: 'NBA', l2: 'CHAMPIONS', year: 1995 }],
  },
  board: { title: 'TOYOTA CENTER', top: '#6a0f26', bottom: '#0b0508', accent: '#C4CED4', bar: '#5a0a1e' },
  tableCol: '#8f0c2d', wall: 0x16101a, roof: 0x2c2429, sky: 0x0a0a12,
};

/* ---- Fiserv Forum · Milwaukee Bucks ----
   Parquet crema, contorno y zonas verde bosque, el ciervo de los Bucks en el centro, "BUCKS" crema en las líneas de fondo y
   "FISERV FORUM" en la banda. Tribuna oscura con público verde y crema. */
const MIL = {
  id: 'MIL', team: 'MIL', arena: 'Fiserv Forum', city: 'Milwaukee', real: true,
  floor: { h: 38, s: 52, l: 79, jitter: 4 },
  paint: '#0b5a2c', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'MIL', size: 4.8 },
  floorTexts: [],
  surface: {
    color: '#00471B',
    texts: [
      { text: 'BUCKS', x: 0, z: -16.3, h: 1.5, rot: 0, color: '#EEE1C6', maxW: 10 },
      { text: 'BUCKS', x: 0, z: 16.3, h: 1.5, rot: Math.PI, color: '#EEE1C6', maxW: 10 },
      { text: 'FISERV FORUM', x: -8.95, z: 0, h: 0.65, rot: Math.PI / 2, color: '#EEE1C6', maxW: 8 },
      { text: 'MILWAUKEE', x: 8.95, z: 0, h: 0.65, rot: Math.PI / 2, color: '#EEE1C6', maxW: 7 },
    ],
    minis: [{ team: 'MIL', x: 5.4, z: 9.6, size: 1.5, rot: Math.PI / 2 }, { team: 'MIL', x: -5.4, z: -9.6, size: 1.5, rot: Math.PI / 2 }],
  },
  led: { text: 'BUCKS  ★  FISERV FORUM  ★  MILWAUKEE  ★  FEAR THE DEER  ★  ', bg: '#0a2e17', fg: '#EEE1C6', accent: '#00471B' },
  seats: { lower: '#2a3a31', upper: '#18221c', accent: '#EEE1C6' },
  crowd: [['#00471B', 0.3], ['#EEE1C6', 0.22], ['#f2f2f2', 0.14], ['#15171c', 0.12], ['#0f6b33', 0.1], ['#8b95a5', 0.12]],
  banners: { bg: '#00471B', fg: '#EEE1C6', trim: '#EEE1C6', list: [1971, 2021].map(y => ({ l1: 'NBA', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'FISERV FORUM', top: '#0b3d1e', bottom: '#050b07', accent: '#EEE1C6', bar: '#0a2e17' },
  tableCol: '#00471B', wall: 0x0f1411, roof: 0x232824, sky: 0x080b09,
};

/* ---- TD Garden · Boston Celtics ----
   Parquet clásico claro, contorno y zonas verde Celtics, el trébol con el duende en el centro, "CELTICS" blanco en el fondo y
   "TD GARDEN" en la banda. Los 18 banners de campeonato. Tribuna oscura llena de público verde y blanco. */
const BOS = {
  id: 'BOS', team: 'BOS', arena: 'TD Garden', city: 'Boston', real: true,
  floor: { h: 36, s: 46, l: 72, jitter: 7 },
  paint: '#007A33', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'BOS', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#006b2d',
    texts: [
      { text: 'CELTICS', x: 0, z: -16.3, h: 1.5, rot: 0, color: '#ffffff', maxW: 11 },
      { text: 'CELTICS', x: 0, z: 16.3, h: 1.5, rot: Math.PI, color: '#ffffff', maxW: 11 },
      { text: 'TD GARDEN', x: -8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#ffffff', maxW: 7 },
      { text: 'BOSTON', x: 8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#ffffff', maxW: 6 },
    ],
    minis: [{ team: 'BOS', x: 5.5, z: 9.6, size: 1.5, rot: Math.PI / 2 }, { team: 'BOS', x: -5.5, z: -9.6, size: 1.5, rot: Math.PI / 2 }],
  },
  led: { text: 'CELTICS  ★  TD GARDEN  ★  BOSTON  ★  BANNER 18  ★  ', bg: '#06361a', fg: '#ffffff', accent: '#007A33' },
  seats: { lower: '#232b27', upper: '#151a17', accent: '#007A33' },
  crowd: [['#007A33', 0.3], ['#f2f2f2', 0.24], ['#15171c', 0.16], ['#1f9d4f', 0.1], ['#8b95a5', 0.12], ['#BA9653', 0.08]],
  banners: { bg: '#007A33', fg: '#ffffff', trim: '#ffffff', list: [1957, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966, 1968, 1969, 1974, 1976, 1981, 1984, 1986, 2008, 2024].map(y => ({ l1: 'NBA', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'TD GARDEN', top: '#084a24', bottom: '#050b07', accent: '#ffffff', bar: '#06361a' },
  tableCol: '#007A33', wall: 0x0d1210, roof: 0x222623, sky: 0x070a08,
};

/* ---- American Airlines Center · Dallas Mavericks ----
   Parquet claro, contorno y zonas azul Mavs, el caballo en el centro, "MAVERICKS" azul y blanco en el fondo y
   "AMERICAN AIRLINES CENTER" en la banda. Tribuna llena de público azul. */
const DAL = {
  id: 'DAL', team: 'DAL', arena: 'American Airlines Center', city: 'Dallas', real: true,
  floor: { h: 37, s: 54, l: 74, jitter: 5 },
  paint: '#1b6fc2', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'DAL', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#00538C',
    texts: [
      { text: 'MAVERICKS', x: 0, z: -16.3, h: 1.4, rot: 0, color: '#ffffff', maxW: 12 },
      { text: 'MAVERICKS', x: 0, z: 16.3, h: 1.4, rot: Math.PI, color: '#ffffff', maxW: 12 },
      { text: 'AMERICAN AIRLINES CENTER', x: -8.95, z: 0, h: 0.55, rot: Math.PI / 2, color: '#B8C4CA', maxW: 11 },
      { text: 'DALLAS', x: 8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#B8C4CA', maxW: 5 },
    ],
    minis: [{ team: 'DAL', x: 5.5, z: 9.6, size: 1.5, rot: Math.PI / 2 }, { team: 'DAL', x: -5.5, z: -9.6, size: 1.5, rot: Math.PI / 2 }],
  },
  led: { text: 'MAVERICKS  ★  AMERICAN AIRLINES CENTER  ★  DALLAS  ★  MAVS BALL  ★  ', bg: '#0a2f5a', fg: '#ffffff', accent: '#00A3E0' },
  seats: { lower: '#1d5fae', upper: '#123e73', accent: '#B8C4CA' },
  crowd: [['#1b6fc2', 0.34], ['#00538C', 0.2], ['#f2f2f2', 0.16], ['#6fb6ea', 0.1], ['#15171c', 0.08], ['#8b95a5', 0.12]],
  banners: { bg: '#00538C', fg: '#B8C4CA', trim: '#B8C4CA', list: [{ l1: 'WEST', l2: 'CHAMPIONS', year: 2006 }, { l1: 'NBA', l2: 'CHAMPIONS', year: 2011 }, { l1: 'WEST', l2: 'CHAMPIONS', year: 2024 }] },
  board: { title: 'AMERICAN AIRLINES CENTER', top: '#0b3d73', bottom: '#050a14', accent: '#B8C4CA', bar: '#0a2f5a' },
  tableCol: '#00538C', wall: 0x0e131d, roof: 0x232832, sky: 0x080b12,
};

/* ---- Target Center · Minnesota Timberwolves ----
   Parquet claro, contorno y zonas azul, el círculo de los Timberwolves en el centro, "TIMBERWOLVES" en el fondo y
   "Target CENTER" sobre el parquet. Butacas oscuras con público azul y verde claro. */
const MIN = {
  id: 'MIN', team: 'MIN', arena: 'Target Center', city: 'Minneapolis', real: true,
  floor: { h: 36, s: 46, l: 76, jitter: 4 },
  paint: '#236192', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'MIN', size: 4.0 },
  floorTexts: [],
  surface: {
    color: '#1d5a96',
    texts: [
      { text: 'TIMBERWOLVES', x: 0, z: -16.3, h: 1.35, rot: 0, color: '#ffffff', maxW: 13 },
      { text: 'TIMBERWOLVES', x: 0, z: 16.3, h: 1.35, rot: Math.PI, color: '#ffffff', maxW: 13 },
      { text: 'Target', sub: 'CENTER', x: 4.6, z: -4.4, h: 0.5, rot: Math.PI / 2, color: '#1b2a3f', maxW: 3 },
      { text: 'Target', sub: 'CENTER', x: -4.6, z: 4.4, h: 0.5, rot: Math.PI / 2, color: '#1b2a3f', maxW: 3 },
      { text: 'MINNESOTA', x: -8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#78BE20', maxW: 7 },
    ],
    minis: [{ team: 'MIN', x: 5.5, z: 9.6, size: 1.4, rot: Math.PI / 2 }, { team: 'MIN', x: -5.5, z: -9.6, size: 1.4, rot: Math.PI / 2 }],
  },
  led: { text: 'TIMBERWOLVES  ★  TARGET CENTER  ★  MINNESOTA  ★  RAISE THE HOWL  ★  ', bg: '#0c2340', fg: '#78BE20', accent: '#236192' },
  seats: { lower: '#1f2733', upper: '#11161e', accent: '#78BE20' },
  crowd: [['#236192', 0.3], ['#0C2340', 0.16], ['#f2f2f2', 0.18], ['#78BE20', 0.12], ['#15171c', 0.1], ['#8b95a5', 0.14]],
  banners: null,
  board: { title: 'TARGET CENTER', top: '#123a66', bottom: '#050a14', accent: '#78BE20', bar: '#0c2340' },
  tableCol: '#0C2340', wall: 0x0d121b, roof: 0x1f242c, sky: 0x070a10,
};

/* ---- Madison Square Garden · New York Knicks ----
   Parquet cálido, zonas azules, el escudo naranja de los Knicks en el centro, "KNICKS" en las líneas de fondo y
   "MADISON SQUARE GARDEN" en la banda. Público azul y naranja. */
const NYK = {
  id: 'NYK', team: 'NYK', arena: 'Madison Square Garden', city: 'Nueva York', real: true,
  floor: { h: 33, s: 62, l: 63, jitter: 6 },
  paint: '#006BB6', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'NYK', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#0b57a0',
    texts: [
      { text: 'KNICKS', x: 0, z: -16.3, h: 1.5, rot: 0, color: '#F58426', maxW: 10 },
      { text: 'KNICKS', x: 0, z: 16.3, h: 1.5, rot: Math.PI, color: '#F58426', maxW: 10 },
      { text: 'MADISON SQUARE GARDEN', x: -8.95, z: 0, h: 0.55, rot: Math.PI / 2, color: '#ffffff', maxW: 11 },
      { text: 'NEW YORK', x: 8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#ffffff', maxW: 6 },
    ],
    minis: [{ team: 'NYK', x: 5.5, z: 9.6, size: 1.5, rot: Math.PI / 2 }, { team: 'NYK', x: -5.5, z: -9.6, size: 1.5, rot: Math.PI / 2 }],
  },
  led: { text: 'KNICKS  ★  MADISON SQUARE GARDEN  ★  NEW YORK  ★  NY  ★  ', bg: '#0a2a52', fg: '#F58426', accent: '#F58426' },
  seats: { lower: '#1c4f8f', upper: '#12325a', accent: '#F58426' },
  crowd: [['#006BB6', 0.34], ['#F58426', 0.24], ['#f2f2f2', 0.14], ['#15171c', 0.1], ['#0b2e5c', 0.08], ['#8b95a5', 0.1]],
  banners: { bg: '#006BB6', fg: '#F58426', trim: '#F58426', list: [1970, 1973].map(y => ({ l1: 'NBA', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'MADISON SQUARE GARDEN', top: '#0d3d75', bottom: '#050a14', accent: '#F58426', bar: '#0a2a52' },
  tableCol: '#006BB6', wall: 0x0f121a, roof: 0x24262c, sky: 0x090b12,
};

/* ---- Paycom Center · Oklahoma City Thunder ----
   Parquet claro, contorno y zonas azul Thunder, el escudo del Thunder en el centro, "THUNDER" en el fondo y
   "Paycom CENTER" sobre el parquet. Butacas azules y público azul. */
const OKC = {
  id: 'OKC', team: 'OKC', arena: 'Paycom Center', city: 'Oklahoma City', real: true,
  floor: { h: 38, s: 44, l: 80, jitter: 4 },
  paint: '#007AC1', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'OKC', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#0a64b0',
    texts: [
      { text: 'THUNDER', x: 0, z: -16.3, h: 1.5, rot: 0, color: '#ffffff', maxW: 11 },
      { text: 'THUNDER', x: 0, z: 16.3, h: 1.5, rot: Math.PI, color: '#ffffff', maxW: 11 },
      { text: 'Paycom', sub: 'CENTER', x: 4.6, z: -4.4, h: 0.5, rot: Math.PI / 2, color: '#2b3f55', maxW: 3 },
      { text: 'Paycom', sub: 'CENTER', x: -4.6, z: 4.4, h: 0.5, rot: Math.PI / 2, color: '#2b3f55', maxW: 3 },
      { text: 'OKLAHOMA CITY', x: -8.95, z: 0, h: 0.65, rot: Math.PI / 2, color: '#EF3B24', maxW: 8 },
    ],
    minis: [{ team: 'OKC', x: 5.5, z: 9.6, size: 1.5, rot: Math.PI / 2 }, { team: 'OKC', x: -5.5, z: -9.6, size: 1.5, rot: Math.PI / 2 }],
  },
  led: { text: 'THUNDER  ★  PAYCOM CENTER  ★  OKLAHOMA CITY  ★  THUNDER UP  ★  ', bg: '#0a2c52', fg: '#ffffff', accent: '#EF3B24' },
  seats: { lower: '#1e5bb0', upper: '#143f7d', accent: '#EF3B24' },
  crowd: [['#007AC1', 0.36], ['#0b3a6e', 0.16], ['#f2f2f2', 0.18], ['#EF3B24', 0.08], ['#15171c', 0.08], ['#8b95a5', 0.14]],
  banners: { bg: '#007AC1', fg: '#ffffff', trim: '#EF3B24', list: [{ l1: 'WEST', l2: 'CHAMPIONS', year: 2012 }, { l1: 'NBA', l2: 'CHAMPIONS', year: 2025 }] },
  board: { title: 'PAYCOM CENTER', top: '#0d3e75', bottom: '#050a14', accent: '#EF3B24', bar: '#0a2c52' },
  tableCol: '#007AC1', wall: 0x0d121b, roof: 0x222831, sky: 0x070a11,
};

/* ---- United Center · Chicago Bulls ----
   Parquet claro, zonas rojas, contorno negro con "CHICAGO" y "BULLS" en las líneas de fondo, el toro rojo en el centro
   y "UNITED CENTER" en la banda. Tribuna roja y negra con los banners de los seis títulos. */
const CHI = {
  id: 'CHI', team: 'CHI', arena: 'United Center', city: 'Chicago', real: true,
  floor: { h: 38, s: 50, l: 77, jitter: 4 },
  paint: '#CE1141', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'CHI', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#0e0e11',
    texts: [
      { text: 'CHICAGO', x: 0, z: -16.3, h: 1.4, rot: 0, color: '#ffffff', maxW: 11 },
      { text: 'BULLS', x: 0, z: 16.3, h: 1.4, rot: Math.PI, color: '#CE1141', maxW: 9 },
      { text: 'UNITED CENTER', x: -8.95, z: 0, h: 0.65, rot: Math.PI / 2, color: '#ffffff', maxW: 8 },
      { text: 'CHICAGO BULLS', x: 8.95, z: 0, h: 0.65, rot: Math.PI / 2, color: '#ffffff', maxW: 9 },
    ],
    minis: [{ team: 'CHI', x: 5.5, z: 9.6, size: 1.5, rot: Math.PI / 2 }, { team: 'CHI', x: -5.5, z: -9.6, size: 1.5, rot: Math.PI / 2 }],
  },
  led: { text: 'BULLS  ★  UNITED CENTER  ★  CHICAGO  ★  SEE RED  ★  ', bg: '#1a0a0e', fg: '#ffffff', accent: '#CE1141' },
  seats: { lower: '#a3132e', upper: '#5e0a1a', accent: '#111111' },
  crowd: [['#CE1141', 0.42], ['#15171c', 0.2], ['#f2f2f2', 0.18], ['#8b0b2b', 0.1], ['#8b95a5', 0.1]],
  banners: { bg: '#CE1141', fg: '#ffffff', trim: '#111111', list: [1991, 1992, 1993, 1996, 1997, 1998].map(y => ({ l1: 'NBA', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'UNITED CENTER', top: '#5c0c1f', bottom: '#0a0508', accent: '#ffffff', bar: '#1a0a0e' },
  tableCol: '#CE1141', wall: 0x140f12, roof: 0x28242a, sky: 0x0a080b,
};

/* ---- Footprint Center · Phoenix Suns ----
   Parquet claro, zonas naranjas, contorno violeta con "PHOENIX" y "SUNS" naranja, el sol de los Suns en el centro y
   "Footprint CENTER" sobre el parquet. Tribuna violeta y naranja. */
const PHX = {
  id: 'PHX', team: 'PHX', arena: 'Footprint Center', city: 'Phoenix', real: true,
  floor: { h: 38, s: 55, l: 76, jitter: 4 },
  paint: '#E56020', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'PHX', size: 4.6 },
  floorTexts: [],
  surface: {
    color: '#2a1a73',
    texts: [
      { text: 'SUNS', x: 0, z: -16.3, h: 1.6, rot: 0, color: '#E56020', maxW: 8 },
      { text: 'SUNS', x: 0, z: 16.3, h: 1.6, rot: Math.PI, color: '#E56020', maxW: 8 },
      { text: 'PHOENIX', x: -8.95, z: 0, h: 0.8, rot: Math.PI / 2, color: '#ffffff', maxW: 6 },
      { text: 'Footprint', sub: 'CENTER', x: 4.6, z: -4.4, h: 0.5, rot: Math.PI / 2, color: '#3a2a22', maxW: 3.4 },
      { text: 'Footprint', sub: 'CENTER', x: -4.6, z: 4.4, h: 0.5, rot: Math.PI / 2, color: '#3a2a22', maxW: 3.4 },
    ],
    minis: [{ team: 'PHX', x: 5.5, z: 9.6, size: 1.5, rot: Math.PI / 2 }, { team: 'PHX', x: -5.5, z: -9.6, size: 1.5, rot: Math.PI / 2 }],
  },
  led: { text: 'SUNS  ★  FOOTPRINT CENTER  ★  PHOENIX  ★  VALLEY  ★  ', bg: '#1D1160', fg: '#E56020', accent: '#E56020' },
  seats: { lower: '#4a2f9a', upper: '#2a1a6a', accent: '#E56020' },
  crowd: [['#E56020', 0.3], ['#1D1160', 0.24], ['#f2f2f2', 0.16], ['#6a4bc4', 0.12], ['#15171c', 0.08], ['#8b95a5', 0.1]],
  banners: { bg: '#1D1160', fg: '#E56020', trim: '#E56020', list: [1976, 1993, 2021].map(y => ({ l1: 'WEST', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'FOOTPRINT CENTER', top: '#2a1a73', bottom: '#07050f', accent: '#E56020', bar: '#1D1160' },
  tableCol: '#1D1160', wall: 0x100d1c, roof: 0x25222f, sky: 0x08060f,
};

/* ---- Barclays Center · Brooklyn Nets ----
   Parquet gris claro, zonas gris, líneas y contorno negros (el borde en blanco), el escudo blanco y negro en el centro,
   "Brooklyn Nets" blanco en las bandas y "BARCLAYS CENTER" celeste sobre el parquet. Tribuna toda negra y gris. */
const BKN = {
  id: 'BKN', team: 'BKN', arena: 'Barclays Center', city: 'Brooklyn', real: true,
  floor: { h: 40, s: 7, l: 80, jitter: 3 },
  paint: '#8d8f92', paintRough: 0.55, lineColor: '#111114', edgeColor: '#ffffff',
  logo: { team: 'BKN', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#0b0b0e',
    texts: [
      { text: 'BROOKLYN', x: -8.95, z: -8, h: 0.8, rot: Math.PI / 2, color: '#ffffff', maxW: 7 },
      { text: 'NETS', x: -8.95, z: 8, h: 0.8, rot: Math.PI / 2, color: '#ffffff', maxW: 5 },
      { text: 'BROOKLYN NETS', x: 8.95, z: 0, h: 0.8, rot: Math.PI / 2, color: '#ffffff', maxW: 11 },
      { text: 'BARCLAYS', sub: 'CENTER', x: 4.6, z: -4.5, h: 0.5, rot: Math.PI / 2, color: '#5aa9dd', maxW: 3.2 },
      { text: 'BARCLAYS', sub: 'CENTER', x: -4.6, z: 4.5, h: 0.5, rot: Math.PI / 2, color: '#5aa9dd', maxW: 3.2 },
    ],
  },
  led: { text: 'NETS  ★  BARCLAYS CENTER  ★  BROOKLYN  ★  BK  ★  ', bg: '#0a0a0c', fg: '#ffffff', accent: '#8b95a5' },
  seats: { lower: '#26282d', upper: '#15161a', accent: '#8b95a5' },
  crowd: [['#15171c', 0.34], ['#f2f2f2', 0.24], ['#8b95a5', 0.22], ['#3a3d45', 0.12], ['#5aa9dd', 0.08]],
  banners: null,
  board: { title: 'BARCLAYS CENTER', top: '#1b1c20', bottom: '#060709', accent: '#ffffff', bar: '#0a0a0c' },
  tableCol: '#15161a', wall: 0x0d0e11, roof: 0x1c1e23, sky: 0x07080b,
};

/* ---- Kia Center · Orlando Magic ----
   Parquet claro cálido, contorno y zonas azul Magic, el escudo de las estrellas en el centro, "MAGIC" en el fondo y
   "KIA CENTER" en la banda. Butacas azules y público azul y plateado. */
const ORL = {
  id: 'ORL', team: 'ORL', arena: 'Kia Center', city: 'Orlando', real: true,
  floor: { h: 38, s: 55, l: 74, jitter: 5 },
  paint: '#0b6bc0', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'ORL', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#0a5aa8',
    texts: [
      { text: 'MAGIC', x: 0, z: -16.3, h: 1.5, rot: 0, color: '#ffffff', maxW: 9 },
      { text: 'MAGIC', x: 0, z: 16.3, h: 1.5, rot: Math.PI, color: '#ffffff', maxW: 9 },
      { text: 'KIA CENTER', x: -8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#C4CED4', maxW: 7 },
      { text: 'ORLANDO', x: 8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#C4CED4', maxW: 6 },
    ],
    minis: [{ team: 'ORL', x: 5.5, z: 9.6, size: 1.5, rot: Math.PI / 2 }, { team: 'ORL', x: -5.5, z: -9.6, size: 1.5, rot: Math.PI / 2 }],
  },
  led: { text: 'MAGIC  ★  KIA CENTER  ★  ORLANDO  ★  BELIEVE  ★  ', bg: '#08305c', fg: '#ffffff', accent: '#C4CED4' },
  seats: { lower: '#1d5fc0', upper: '#123f82', accent: '#C4CED4' },
  crowd: [['#0077C0', 0.36], ['#0b2e5c', 0.14], ['#f2f2f2', 0.18], ['#C4CED4', 0.14], ['#15171c', 0.08], ['#8b95a5', 0.1]],
  banners: { bg: '#0077C0', fg: '#ffffff', trim: '#C4CED4', list: [1995, 2009].map(y => ({ l1: 'EAST', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'KIA CENTER', top: '#0d4a8a', bottom: '#050a14', accent: '#C4CED4', bar: '#08305c' },
  tableCol: '#0077C0', wall: 0x0d121b, roof: 0x222831, sky: 0x070a11,
};

/* ---- State Farm Arena · Atlanta Hawks ----
   Parquet crema, zonas rojas, contorno negro con vivos amarillo lima, el halcón rojo en el centro, "HAWKS" en el fondo y
   "State Farm ARENA" en la banda. Tribuna roja y negra. */
const ATL = {
  id: 'ATL', team: 'ATL', arena: 'State Farm Arena', city: 'Atlanta', real: true,
  floor: { h: 40, s: 48, l: 80, jitter: 4 },
  paint: '#E03A3E', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'ATL', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#0e0e10',
    texts: [
      { text: 'HAWKS', x: 0, z: -16.3, h: 1.5, rot: 0, color: '#E03A3E', maxW: 9 },
      { text: 'HAWKS', x: 0, z: 16.3, h: 1.5, rot: Math.PI, color: '#E03A3E', maxW: 9 },
      { text: 'STATE FARM ARENA', x: -8.95, z: 0, h: 0.6, rot: Math.PI / 2, color: '#C1D32F', maxW: 10 },
      { text: 'ATLANTA', x: 8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#C1D32F', maxW: 6 },
    ],
    minis: [{ team: 'ATL', x: 5.5, z: 9.6, size: 1.4, rot: Math.PI / 2 }, { team: 'ATL', x: -5.5, z: -9.6, size: 1.4, rot: Math.PI / 2 }],
  },
  led: { text: 'HAWKS  ★  STATE FARM ARENA  ★  ATLANTA  ★  TRUE TO ATLANTA  ★  ', bg: '#2a0b0d', fg: '#ffffff', accent: '#C1D32F' },
  seats: { lower: '#a32a2e', upper: '#5c1417', accent: '#C1D32F' },
  crowd: [['#E03A3E', 0.42], ['#15171c', 0.22], ['#f2f2f2', 0.16], ['#8b0b2b', 0.08], ['#8b95a5', 0.12]],
  banners: { bg: '#E03A3E', fg: '#ffffff', trim: '#C1D32F', list: [{ l1: 'NBA', l2: 'CHAMPIONS', year: 1958 }] },
  board: { title: 'STATE FARM ARENA', top: '#5c1417', bottom: '#0a0507', accent: '#C1D32F', bar: '#2a0b0d' },
  tableCol: '#E03A3E', wall: 0x140e10, roof: 0x28242a, sky: 0x0a070a,
};

/* ---- Kaseya Center · Miami Heat ----
   Parquet dorado intenso, zonas naranja, contorno oscuro, la pelota en llamas en el centro, "HEAT" en el fondo y
   "KASEYA CENTER" en la banda. Tribuna de público blanco (White Hot) con rojo. */
const MIA = {
  id: 'MIA', team: 'MIA', arena: 'Kaseya Center', city: 'Miami', real: true,
  floor: { h: 41, s: 80, l: 63, jitter: 5 },
  paint: '#f0951c', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'MIA', size: 4.8 },
  floorTexts: [],
  surface: {
    color: '#16090d',
    texts: [
      { text: 'HEAT', x: 0, z: -16.3, h: 1.5, rot: 0, color: '#F9A01B', maxW: 8 },
      { text: 'HEAT', x: 0, z: 16.3, h: 1.5, rot: Math.PI, color: '#F9A01B', maxW: 8 },
      { text: 'KASEYA CENTER', x: -8.95, z: 0, h: 0.65, rot: Math.PI / 2, color: '#ffffff', maxW: 8 },
      { text: 'MIAMI', x: 8.95, z: 0, h: 0.8, rot: Math.PI / 2, color: '#98002E', maxW: 5 },
    ],
  },
  led: { text: 'HEAT  ★  KASEYA CENTER  ★  MIAMI  ★  HEAT CULTURE  ★  ', bg: '#3a0a18', fg: '#F9A01B', accent: '#98002E' },
  seats: { lower: '#a3123b', upper: '#5e0a22', accent: '#ffffff' },
  crowd: [['#f2f2f2', 0.5], ['#98002E', 0.22], ['#F9A01B', 0.08], ['#15171c', 0.08], ['#d8d8d8', 0.12]],
  banners: { bg: '#98002E', fg: '#ffffff', trim: '#F9A01B', list: [2006, 2012, 2013].map(y => ({ l1: 'NBA', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'KASEYA CENTER', top: '#6a0f26', bottom: '#0b0508', accent: '#F9A01B', bar: '#3a0a18' },
  tableCol: '#98002E', wall: 0x16101a, roof: 0x2c2429, sky: 0x0a0a12,
};

/* ---- FedExForum · Memphis Grizzlies ----
   Parquet claro, zonas azul cielo, contorno azul noche, el oso en el centro, "GRIZZLIES" en el fondo y "FedExForum" en
   la banda. Tribuna oscura con público azul y gris. */
const MEM = {
  id: 'MEM', team: 'MEM', arena: 'FedExForum', city: 'Memphis', real: true,
  floor: { h: 36, s: 30, l: 80, jitter: 4 },
  paint: '#7aa0dc', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'MEM', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#12173F',
    texts: [
      { text: 'GRIZZLIES', x: 0, z: -16.3, h: 1.4, rot: 0, color: '#ffffff', maxW: 11 },
      { text: 'GRIZZLIES', x: 0, z: 16.3, h: 1.4, rot: Math.PI, color: '#ffffff', maxW: 11 },
      { text: 'FedExForum', x: -8.95, z: 0, h: 0.65, rot: Math.PI / 2, color: '#5D76A9', maxW: 7 },
      { text: 'MEMPHIS', x: 8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#5D76A9', maxW: 6 },
    ],
    minis: [{ team: 'MEM', x: 5.5, z: 9.6, size: 1.4, rot: Math.PI / 2 }, { team: 'MEM', x: -5.5, z: -9.6, size: 1.4, rot: Math.PI / 2 }],
  },
  led: { text: 'GRIZZLIES  ★  FEDEXFORUM  ★  MEMPHIS  ★  GRIT AND GRIND  ★  ', bg: '#0b1030', fg: '#8fb0ea', accent: '#5D76A9' },
  seats: { lower: '#222638', upper: '#12151f', accent: '#5D76A9' },
  crowd: [['#5D76A9', 0.28], ['#12173F', 0.2], ['#f2f2f2', 0.18], ['#15171c', 0.14], ['#8b95a5', 0.12], ['#8fb0ea', 0.08]],
  banners: null,
  board: { title: 'FEDEXFORUM', top: '#1a2260', bottom: '#050612', accent: '#8fb0ea', bar: '#0b1030' },
  tableCol: '#12173F', wall: 0x0d101a, roof: 0x1c1f29, sky: 0x06070e,
};

/* ---- Smoothie King Center · New Orleans Pelicans ----
   Parquet claro, zonas del mismo parquet con las alas del pelícano, contorno azul noche con "NEW ORLEANS PELICANS" en el
   fondo, el escudo en el centro y "Smoothie King CENTER" en rojo sobre el parquet. */
const NOP = {
  id: 'NOP', team: 'NOP', arena: 'Smoothie King Center', city: 'Nueva Orleans', real: true,
  floor: { h: 30, s: 58, l: 77, jitter: 5 },
  paint: '#d8a876', paintRough: 0.5, lineColor: '#0C2340', edgeColor: '#ffffff',
  logo: { team: 'NOP', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#0C2340',
    texts: [
      { text: 'NEW ORLEANS', x: 0, z: -16.3, h: 1.2, rot: 0, color: '#ffffff', maxW: 12 },
      { text: 'PELICANS', x: 0, z: 16.3, h: 1.2, rot: Math.PI, color: '#ffffff', maxW: 10 },
      { text: 'Smoothie King', sub: 'CENTER', x: 4.6, z: -4.4, h: 0.5, rot: Math.PI / 2, color: '#C8102E', maxW: 3.6 },
      { text: 'Smoothie King', sub: 'CENTER', x: -4.6, z: 4.4, h: 0.5, rot: Math.PI / 2, color: '#C8102E', maxW: 3.6 },
      { text: 'PELICANS', x: -8.95, z: 0, h: 0.65, rot: Math.PI / 2, color: '#85714D', maxW: 6 },
    ],
    minis: [{ team: 'NOP', x: 5.5, z: 9.6, size: 1.3, rot: Math.PI / 2 }, { team: 'NOP', x: -5.5, z: -9.6, size: 1.3, rot: Math.PI / 2 }],
  },
  led: { text: 'PELICANS  ★  SMOOTHIE KING CENTER  ★  NEW ORLEANS  ★  GEAUX PELS  ★  ', bg: '#0C2340', fg: '#ffffff', accent: '#C8102E' },
  seats: { lower: '#1b2f52', upper: '#101c33', accent: '#C8102E' },
  crowd: [['#0C2340', 0.26], ['#C8102E', 0.2], ['#f2f2f2', 0.18], ['#85714D', 0.12], ['#15171c', 0.12], ['#8b95a5', 0.12]],
  banners: null,
  board: { title: 'SMOOTHIE KING CENTER', top: '#14305c', bottom: '#050a14', accent: '#C8102E', bar: '#0C2340' },
  tableCol: '#0C2340', wall: 0x0d121c, roof: 0x1f2530, sky: 0x070a12,
};

/* ---- Moda Center · Portland Trail Blazers ----
   Parquet claro, zonas rojas, contorno rojo de un lado ("PORTLAND") y negro del otro ("TRAIL BLAZERS"), el molinete
   de los Blazers en el centro y "moda center" sobre el parquet. Tribuna roja y negra. */
const POR = {
  id: 'POR', team: 'POR', arena: 'Moda Center', city: 'Portland', real: true,
  floor: { h: 38, s: 52, l: 80, jitter: 4 },
  paint: '#d4202c', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'POR', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#d4202c', color2: '#0e0e10',                       // color2 = el contorno del lado +X (ver paintSurface en arena.js)
    texts: [
      { text: 'PORTLAND', x: -8.95, z: 0, h: 0.85, rot: Math.PI / 2, color: '#ffffff', maxW: 8 },
      { text: 'TRAIL BLAZERS', x: 8.95, z: 0, h: 0.85, rot: Math.PI / 2, color: '#ffffff', maxW: 11 },
      { text: 'moda', sub: 'center', x: 4.7, z: -4.4, h: 0.55, rot: Math.PI / 2, color: '#2b2523', maxW: 3.2 },
      { text: 'moda', sub: 'center', x: -4.7, z: 4.4, h: 0.55, rot: Math.PI / 2, color: '#2b2523', maxW: 3.2 },
      { text: 'RIPCITY.OREGON', x: 0, z: 16.3, h: 0.7, rot: Math.PI, color: '#ffffff', maxW: 8 },
    ],
  },
  led: { text: 'TRAIL BLAZERS  ★  MODA CENTER  ★  PORTLAND  ★  RIP CITY  ★  ', bg: '#1a0a0c', fg: '#ffffff', accent: '#E03A3E' },
  seats: { lower: '#a32228', upper: '#5a1216', accent: '#111111' },
  crowd: [['#E03A3E', 0.42], ['#15171c', 0.24], ['#f2f2f2', 0.16], ['#8b0b2b', 0.08], ['#8b95a5', 0.1]],
  banners: { bg: '#E03A3E', fg: '#ffffff', trim: '#111111', list: [{ l1: 'WEST', l2: 'CHAMPIONS', year: 1990 }, { l1: 'WEST', l2: 'CHAMPIONS', year: 1992 }, { l1: 'NBA', l2: 'CHAMPIONS', year: 1977 }].sort((a, b) => a.year - b.year) },
  board: { title: 'MODA CENTER', top: '#5a1216', bottom: '#0a0507', accent: '#ffffff', bar: '#1a0a0c' },
  tableCol: '#d4202c', wall: 0x140f12, roof: 0x28242a, sky: 0x0a080b,
};

/* ---- Intuit Dome · Los Angeles Clippers ----
   Parquet claro, zonas y contorno azul marino, el escudo circular de los Clippers en el centro, "INTUIT DOME" celeste
   sobre el parquet y "LA CLIPPERS" en la banda. Público azul marino, rojo y blanco. */
const LAC = {
  id: 'LAC', team: 'LAC', arena: 'Intuit Dome', city: 'Inglewood', real: true,
  floor: { h: 38, s: 50, l: 80, jitter: 3 },
  paint: '#0f2a52', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'LAC', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#0d2347',
    texts: [
      { text: 'CLIPPERS', x: 0, z: -16.3, h: 1.4, rot: 0, color: '#ffffff', maxW: 10 },
      { text: 'CLIPPERS', x: 0, z: 16.3, h: 1.4, rot: Math.PI, color: '#ffffff', maxW: 10 },
      { text: 'INTUIT', sub: 'DOME', x: 4.7, z: -4.4, h: 0.6, rot: Math.PI / 2, color: '#2f8fd0', weight: 800, maxW: 3 },
      { text: 'INTUIT', sub: 'DOME', x: -4.7, z: 4.4, h: 0.6, rot: Math.PI / 2, color: '#2f8fd0', weight: 800, maxW: 3 },
      { text: 'LA CLIPPERS', x: 8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#ffffff', maxW: 8 },
    ],
  },
  led: { text: 'CLIPPERS  ★  INTUIT DOME  ★  LOS ANGELES  ★  CLIPPER NATION  ★  ', bg: '#0a1a38', fg: '#ffffff', accent: '#C8102E' },
  seats: { lower: '#1b2f52', upper: '#101c33', accent: '#C8102E' },
  crowd: [['#1D428A', 0.26], ['#0d2347', 0.16], ['#f2f2f2', 0.22], ['#C8102E', 0.14], ['#15171c', 0.1], ['#8b95a5', 0.12]],
  banners: null,
  board: { title: 'INTUIT DOME', top: '#13305f', bottom: '#050a14', accent: '#C8102E', bar: '#0a1a38' },
  tableCol: '#0d2347', wall: 0x0d121c, roof: 0x1f2530, sky: 0x070a12,
};

/* ---- Golden 1 Center · Sacramento Kings ----
   Parquet claro, zonas y contorno violeta, el escudo del Kings (corona, "KINGS" y pelota gris) en el centro,
   "SACRAMENTO" blanco en las líneas de fondo, "SACRAMENTO PROUD" y "KINGS.COM" en las bandas y "Golden1 CENTER" sobre el parquet. */
const SAC = {
  id: 'SAC', team: 'SAC', arena: 'Golden 1 Center', city: 'Sacramento', real: true,
  floor: { h: 38, s: 52, l: 79, jitter: 4 },
  paint: '#5A2D81', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'SAC', size: 4.6 },
  floorTexts: [],
  surface: {
    color: '#5A2D81',
    texts: [
      { text: 'SACRAMENTO', x: 0, z: -16.3, h: 1.4, rot: 0, color: '#ffffff', maxW: 13 },
      { text: 'SACRAMENTO', x: 0, z: 16.3, h: 1.4, rot: Math.PI, color: '#ffffff', maxW: 13 },
      { text: 'SACRAMENTO PROUD', x: -8.95, z: 0, h: 0.6, rot: Math.PI / 2, color: '#ffffff', maxW: 9 },
      { text: 'KINGS.COM', x: 8.95, z: 0, h: 0.6, rot: Math.PI / 2, color: '#ffffff', maxW: 6 },
      { text: 'Golden1', sub: 'CENTER', x: 4.7, z: -4.4, h: 0.5, rot: Math.PI / 2, color: '#3a2f10', maxW: 3.2 },
      { text: 'Golden1', sub: 'CENTER', x: -4.7, z: 4.4, h: 0.5, rot: Math.PI / 2, color: '#3a2f10', maxW: 3.2 },
    ],
  },
  led: { text: 'KINGS  ★  GOLDEN 1 CENTER  ★  SACRAMENTO  ★  LIGHT THE BEAM  ★  ', bg: '#2a1442', fg: '#ffffff', accent: '#63727A' },
  seats: { lower: '#6a3a99', upper: '#3b2058', accent: '#63727A' },
  crowd: [['#5A2D81', 0.36], ['#f2f2f2', 0.22], ['#63727A', 0.16], ['#15171c', 0.1], ['#8b6bc0', 0.1], ['#8b95a5', 0.06]],
  banners: { bg: '#5A2D81', fg: '#ffffff', trim: '#63727A', list: [{ l1: 'NBA', l2: 'CHAMPIONS', year: 1951 }] },
  board: { title: 'GOLDEN 1 CENTER', top: '#3b1d5c', bottom: '#090510', accent: '#63727A', bar: '#2a1442' },
  tableCol: '#5A2D81', wall: 0x120e1c, roof: 0x26222f, sky: 0x08060f,
};

/* ---- Ball Arena · Denver Nuggets ----
   Parquet claro con las zonas del mismo parquet (apenas marcadas), contorno azul noche, el escudo con las piquetas y
   la pelota en el centro, "NUGGETS" dorado en el fondo, "MILE HIGH BASKETBALL" en la banda y "Ball Arena" sobre el parquet. */
const DEN = {
  id: 'DEN', team: 'DEN', arena: 'Ball Arena', city: 'Denver', real: true,
  floor: { h: 38, s: 46, l: 80, jitter: 3 },
  paint: '#dcc08e', paintRough: 0.5, lineColor: '#7a4b2a', edgeColor: '#ffffff',
  logo: { team: 'DEN', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#0E2240',
    texts: [
      { text: 'NUGGETS', x: 0, z: -16.3, h: 1.4, rot: 0, color: '#FEC524', maxW: 11 },
      { text: 'NUGGETS', x: 0, z: 16.3, h: 1.4, rot: Math.PI, color: '#FEC524', maxW: 11 },
      { text: 'MILE HIGH BASKETBALL', x: -8.95, z: 0, h: 0.6, rot: Math.PI / 2, color: '#FEC524', maxW: 12 },
      { text: 'DENVER', x: 8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#ffffff', maxW: 5 },
      { text: 'Ball', sub: 'Arena', x: 4.7, z: -4.4, h: 0.55, rot: Math.PI / 2, color: '#0b0b0f', maxW: 3 },
      { text: 'Ball', sub: 'Arena', x: -4.7, z: 4.4, h: 0.55, rot: Math.PI / 2, color: '#0b0b0f', maxW: 3 },
    ],
  },
  led: { text: 'NUGGETS  ★  BALL ARENA  ★  DENVER  ★  MILE HIGH  ★  ', bg: '#0a1830', fg: '#FEC524', accent: '#FEC524' },
  seats: { lower: '#1d2f55', upper: '#101b33', accent: '#FEC524' },
  crowd: [['#0E2240', 0.26], ['#FEC524', 0.24], ['#f2f2f2', 0.18], ['#8b95a5', 0.12], ['#15171c', 0.1], ['#4a6aa8', 0.1]],
  banners: { bg: '#0E2240', fg: '#FEC524', trim: '#FEC524', list: [{ l1: 'NBA', l2: 'CHAMPIONS', year: 2023 }] },
  board: { title: 'BALL ARENA', top: '#14305c', bottom: '#050a14', accent: '#FEC524', bar: '#0a1830' },
  tableCol: '#0E2240', wall: 0x0d121c, roof: 0x1f2530, sky: 0x070a12,
};

/* ---- Little Caesars Arena · Detroit Pistons ----
   Parquet claro, contorno rojo, zonas azules, el escudo de la pelota en el centro, "DETROIT PISTONS" blanco en el fondo
   y "DETROIT" en la banda. Tribuna azul y roja. */
const DET = {
  id: 'DET', team: 'DET', arena: 'Little Caesars Arena', city: 'Detroit', real: true,
  floor: { h: 35, s: 60, l: 74, jitter: 5 },
  paint: '#1D42BA', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'DET', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#C8102E',
    texts: [
      { text: 'DETROIT PISTONS', x: 0, z: -16.3, h: 1.35, rot: 0, color: '#ffffff', maxW: 13 },
      { text: 'DETROIT PISTONS', x: 0, z: 16.3, h: 1.35, rot: Math.PI, color: '#ffffff', maxW: 13 },
      { text: 'DETROIT', x: -8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#ffffff', maxW: 6 },
      { text: '@DETROITPISTONS', x: 8.95, z: 0, h: 0.5, rot: Math.PI / 2, color: '#ffffff', maxW: 8 },
    ],
  },
  led: { text: 'PISTONS  ★  LITTLE CAESARS ARENA  ★  DETROIT  ★  DETROIT BASKETBALL  ★  ', bg: '#0b1a4a', fg: '#ffffff', accent: '#C8102E' },
  seats: { lower: '#2a4ab8', upper: '#17286e', accent: '#C8102E' },
  crowd: [['#C8102E', 0.3], ['#1D42BA', 0.28], ['#f2f2f2', 0.18], ['#15171c', 0.1], ['#8b95a5', 0.14]],
  banners: { bg: '#1D42BA', fg: '#ffffff', trim: '#C8102E', list: [1989, 1990, 2004].map(y => ({ l1: 'NBA', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'LITTLE CAESARS ARENA', top: '#14297a', bottom: '#050814', accent: '#C8102E', bar: '#0b1a4a' },
  tableCol: '#C8102E', wall: 0x0e1018, roof: 0x24252e, sky: 0x080a10,
};

/* ---- Wells Fargo Center · Philadelphia 76ers ----
   Parquet claro, contorno y zonas azul royal, el "76" con las trece estrellas en el centro, "Philadelphia" blanco en el
   fondo, "Brotherly Love" en la banda y "WELLS FARGO CENTER" dorado sobre el parquet. */
const PHI = {
  id: 'PHI', team: 'PHI', arena: 'Wells Fargo Center', city: 'Filadelfia', real: true,
  floor: { h: 40, s: 55, l: 82, jitter: 3 },
  paint: '#1a4aa0', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'PHI', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#1f56b5',
    texts: [
      { text: 'PHILADELPHIA', x: 0, z: -16.3, h: 1.3, rot: 0, color: '#ffffff', italic: true, maxW: 13 },
      { text: 'PHILADELPHIA', x: 0, z: 16.3, h: 1.3, rot: Math.PI, color: '#ffffff', italic: true, maxW: 13 },
      { text: 'BROTHERLY LOVE', x: -8.95, z: 0, h: 0.6, rot: Math.PI / 2, color: '#ffffff', italic: true, maxW: 9 },
      { text: 'WELLS FARGO', sub: 'CENTER', x: 4.7, z: -4.4, h: 0.42, rot: Math.PI / 2, color: '#b08a4a', maxW: 3.6 },
      { text: 'WELLS FARGO', sub: 'CENTER', x: -4.7, z: 4.4, h: 0.42, rot: Math.PI / 2, color: '#b08a4a', maxW: 3.6 },
    ],
  },
  led: { text: '76ERS  ★  WELLS FARGO CENTER  ★  PHILADELPHIA  ★  TRUST THE PROCESS  ★  ', bg: '#0b2a6b', fg: '#ffffff', accent: '#ED174C' },
  seats: { lower: '#2a5cc0', upper: '#173a80', accent: '#ED174C' },
  crowd: [['#006BB6', 0.3], ['#ED174C', 0.22], ['#f2f2f2', 0.2], ['#0b2a6b', 0.12], ['#15171c', 0.08], ['#8b95a5', 0.08]],
  banners: { bg: '#006BB6', fg: '#ffffff', trim: '#ED174C', list: [1955, 1967, 1983].map(y => ({ l1: 'NBA', l2: 'CHAMPIONS', year: y })) },
  board: { title: 'WELLS FARGO CENTER', top: '#0d3e8a', bottom: '#050a14', accent: '#ED174C', bar: '#0b2a6b' },
  tableCol: '#006BB6', wall: 0x0d121c, roof: 0x222831, sky: 0x070a12,
};

/* ---- Scotiabank Arena · Toronto Raptors ----
   Parquet dorado claro, zonas rojas, contorno rojo con "RAPTORS" y "WE THE NORTH" en negro, la garra de los Raptors en
   negro en el centro. Tribuna oscura con público rojo, blanco y negro. */
const TOR = {
  id: 'TOR', team: 'TOR', arena: 'Scotiabank Arena', city: 'Toronto', real: true,
  floor: { h: 44, s: 58, l: 74, jitter: 5 },
  paint: '#CE1141', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'TOR', size: 5.0 },
  floorTexts: [],
  surface: {
    color: '#b5102f',
    texts: [
      { text: 'RAPTORS', x: 0, z: -16.3, h: 1.45, rot: 0, color: '#111114', maxW: 11 },
      { text: 'RAPTORS', x: 0, z: 16.3, h: 1.45, rot: Math.PI, color: '#111114', maxW: 11 },
      { text: 'WE THE NORTH', x: -8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#111114', maxW: 9 },
      { text: 'TORONTO', x: 8.95, z: 0, h: 0.7, rot: Math.PI / 2, color: '#111114', maxW: 6 },
    ],
  },
  led: { text: 'RAPTORS  ★  SCOTIABANK ARENA  ★  TORONTO  ★  WE THE NORTH  ★  ', bg: '#1a0a0e', fg: '#ffffff', accent: '#CE1141' },
  seats: { lower: '#2b2d33', upper: '#17181c', accent: '#CE1141' },
  crowd: [['#CE1141', 0.38], ['#f2f2f2', 0.24], ['#15171c', 0.18], ['#A1A1A4', 0.12], ['#8b0b2b', 0.08]],
  banners: { bg: '#CE1141', fg: '#ffffff', trim: '#111111', list: [{ l1: 'NBA', l2: 'CHAMPIONS', year: 2019 }] },
  board: { title: 'SCOTIABANK ARENA', top: '#5c0c1f', bottom: '#0a0507', accent: '#ffffff', bar: '#1a0a0e' },
  tableCol: '#CE1141', wall: 0x121216, roof: 0x232329, sky: 0x08080b,
};

/* ---- Capital One Arena · Washington Wizards ----
   Parquet claro con el área del arco de tres en madera oscura (arcFill), zonas rojas, contorno azul grisáceo con
   "Wizards" blanco en el fondo, "DMV" y "Capital One Arena" sobre el parquet, y el escudo en el centro. */
const WAS = {
  id: 'WAS', team: 'WAS', arena: 'Capital One Arena', city: 'Washington D. C.', real: true,
  floor: { h: 37, s: 56, l: 73, jitter: 6 },
  paint: '#c01f3a', paintRough: 0.5, lineColor: '#ffffff', edgeColor: '#ffffff',
  logo: { team: 'WAS', size: 4.4 },
  floorTexts: [],
  surface: {
    color: '#2b3350',
    arcFill: 'rgba(150,82,28,.62)',
    texts: [
      { text: 'WIZARDS', x: 0, z: -16.3, h: 1.35, rot: 0, color: '#ffffff', maxW: 10 },
      { text: 'WIZARDS', x: 0, z: 16.3, h: 1.35, rot: Math.PI, color: '#ffffff', maxW: 10 },
      { text: 'BEYOND', sub: 'BOUNDARIES', x: -8.95, z: 0, h: 0.6, rot: Math.PI / 2, color: '#ffffff', maxW: 6 },
      { text: 'DMV', x: 4.6, z: -10.6, h: 0.55, rot: Math.PI / 2, color: '#ffffff', maxW: 2 },
      { text: 'DMV', x: -4.6, z: 10.6, h: 0.55, rot: Math.PI / 2, color: '#ffffff', maxW: 2 },
      { text: 'Capital One', sub: 'Arena', x: 4.7, z: 4.4, h: 0.45, rot: Math.PI / 2, color: '#1d3a6b', maxW: 3.2 },
      { text: 'Capital One', sub: 'Arena', x: -4.7, z: -4.4, h: 0.45, rot: Math.PI / 2, color: '#1d3a6b', maxW: 3.2 },
    ],
  },
  led: { text: 'WIZARDS  ★  CAPITAL ONE ARENA  ★  WASHINGTON  ★  DMV  ★  ', bg: '#0b1530', fg: '#ffffff', accent: '#E31837' },
  seats: { lower: '#233a6b', upper: '#131f3d', accent: '#E31837' },
  crowd: [['#002B5C', 0.24], ['#E31837', 0.24], ['#f2f2f2', 0.2], ['#8b95a5', 0.12], ['#15171c', 0.1], ['#4a6aa8', 0.1]],
  banners: { bg: '#002B5C', fg: '#ffffff', trim: '#E31837', list: [{ l1: 'NBA', l2: 'CHAMPIONS', year: 1978 }] },
  board: { title: 'CAPITAL ONE ARENA', top: '#0d2347', bottom: '#050a14', accent: '#E31837', bar: '#0b1530' },
  tableCol: '#002B5C', wall: 0x0d111c, roof: 0x1f2430, sky: 0x070a12,
};

const REAL = [GSW, IND, CHA, UTA, SAS, LAL, CLE, HOU, MIL, BOS, DAL, MIN, NYK, OKC, CHI, PHX, BKN, ORL, ATL, MIA, MEM, NOP, POR, LAC, SAC, DEN, DET, PHI, TOR, WAS];                                // <- acá se suman las próximas canchas
const byTeam = new Map(REAL.map(c => [c.team, c]));

/** Cancha genérica para los equipos que todavía no tienen la suya: colores y escudo del equipo. */
function generic(team) {
  const main = lumOf(team.c1) > 0.5 ? team.c2 : team.c1, alt = main === team.c1 ? team.c2 : team.c1;
  const gold = lumOf(alt) > 0.25 ? alt : '#f2f2f2';
  return {
    id: team.ab, team: team.ab, arena: `Cancha de ${team.name}`, city: '', real: false,
    floor: { h: 34, s: 52, l: 62, jitter: 7 },
    paint: lumOf(team.c1) > 0.5 ? team.c2 : team.c1, paintRough: 0.5,
    logo: { team: team.ab, size: 3.3 },
    floorTexts: [],
    led: { text: `${team.name.toUpperCase()}  ★  ${team.ab}  ★  `, bg: mix(main, '#000000', 0.45), fg: gold, accent: gold },
    seats: { lower: mix(main, '#ffffff', 0.12), upper: mix(main, '#000000', 0.35), accent: gold },
    crowd: [[gold, 0.34], [main, 0.28], ['#f2f2f2', 0.16], ['#15171c', 0.08], ['#8b95a5', 0.14]],
    banners: null,
    board: { title: team.name.toUpperCase(), top: mix(main, '#000000', 0.45), bottom: '#070b16', accent: gold, bar: mix(main, '#000000', 0.7) },
    tableCol: mix(main, '#000000', 0.4), wall: 0x10141f, roof: 0x2b2a30, sky: 0x0a0f1d,
  };
}

const gcache = new Map();
/** Cancha de un equipo (la real si existe; si no, una genérica con sus colores). */
export function courtFor(team) {
  const t = typeof team === 'string' ? TEAMS.find(x => x.ab === team) : team;
  if (!t) return GSW;
  if (byTeam.has(t.ab)) return byTeam.get(t.ab);
  if (!gcache.has(t.ab)) gcache.set(t.ab, generic(t));
  return gcache.get(t.ab);
}
export const hasRealCourt = team => byTeam.has(typeof team === 'string' ? team : team.ab);
/** Canchas reales disponibles (las que se pueden elegir en Entrenamiento). */
export const REAL_COURTS = REAL;
export const courtById = id => byTeam.get(id) || courtFor(id);
