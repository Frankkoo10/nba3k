/* ============================================================================
   Aspecto de los jugadores (v33): altura, contextura, piel, pelo, barba, vincha y manga.
   Orden de prioridad para cada rasgo:  1) columna de la base (supabase/005_aspecto.sql)  →  2) tabla de jugadores
   conocidos de abajo (por nombre)  →  3) estimado desde el nombre (como antes).
   Códigos de peinado:  0 pelado · 1 corto · 2 rapado/fade · 3 afro · 4 high top · 5 trenzas · 6 rodete · 7 cola / pelo largo atado · 8 rizos largos · 9 corto-medio · 10 rizado medio
   Extras (v35): wrist = muñequera, knee = rodillera ('L' izq · 'R' der · 'B' ambas), cada una con su color.
   Piel: 0 muy claro · 1 trigueño · 2 marrón claro · 3 marrón · 4 oscuro · 5 muy oscuro
   ========================================================================== */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---- tamaño y cuerpo ---- */
const BUILD = { PG: 0.94, SG: 0.98, SF: 1.0, PF: 1.06, C: 1.11 };
/** Contextura (ancho): con peso real sale del IMC (+ un poco de la fuerza); sin peso, de la posición. */
export function buildFor(info) {
  if (!info.weightLb) return BUILD[info.pos] ?? 1;
  const kg = info.weightLb * 0.4536, m = info.height / 100, bmi = kg / (m * m);
  const mus = Number.isFinite(info.strength) ? clamp((info.strength - 65) * 0.0025, -0.04, 0.05) : 0;
  return clamp(1 + (bmi - 24.5) * 0.04 + mus, 0.88, 1.16);
}
/** Escala del modelo según la altura real (el modelo base mide 1,98 m). Antes se achataba entre 0,93 y 1,08. */
export const scaleFor = info => clamp((info.height || 198) / 198, 0.88, 1.16);

/* ---- jugadores conocidos ---- */
const K = '#15120f', DB = '#2b1d14', BR = '#4a3222', LB = '#7a5a36';
const L = (skin, hair, color, beard = 0, band = null, sleeve = null, sleeveColor = null) => ({ skin, hair, color, beard, band, sleeve, sleeveColor });
/** X(look, { wrist:'L', wristColor:'#fff', knee:'L', kneeColor:'#111' }) suma muñequera / rodillera a un aspecto. */
const X = (l, extra) => ({ ...l, ...extra });
const W = '#ffffff', BK = '#111111';
const KNOWN_RAW = {
  // ---- Estrellas ----
  'LeBron James': L(3, 2, K, 1, null, 'R', BK), 'Stephen Curry': L(2, 1, K, 0, null, 'L', BK), 'Kevin Durant': L(3, 1, K, 1),
  'Giannis Antetokounmpo': L(5, 2, K, 1), 'Nikola Jokic': L(0, 7, DB, 2), 'Luka Doncic': L(0, 9, DB, 2),
  'Joel Embiid': X(L(4, 2, K, 2), { knee: 'L', kneeColor: BK }), 'Jayson Tatum': L(3, 2, K, 1), 'Jaylen Brown': L(4, 2, K, 1, null, 'L', W),
  'Shai Gilgeous-Alexander': L(4, 5, K, 1, W), 'Anthony Edwards': L(4, 2, K, 1), 'Victor Wembanyama': L(4, 1, K, 0),
  'Ja Morant': L(3, 1, K, 0), 'Devin Booker': L(2, 1, K, 1), 'Kawhi Leonard': L(4, 2, K, 1), 'Paul George': L(3, 1, K, 1),
  'Damian Lillard': L(3, 1, K, 1), 'Kyrie Irving': L(2, 10, K, 1), 'James Harden': L(3, 2, K, 2), 'Jimmy Butler': L(3, 1, K, 1, W),
  'Bam Adebayo': L(3, 2, K, 1), 'Trae Young': L(2, 1, K, 1), 'Donovan Mitchell': L(3, 1, K, 1), 'Tyrese Haliburton': L(2, 10, K, 0),
  'LaMelo Ball': L(2, 8, '#d8c27a', 1), 'Zion Williamson': L(3, 1, K, 1), 'Karl-Anthony Towns': L(2, 1, K, 2),
  'Rudy Gobert': L(3, 2, K, 1), 'Anthony Davis': L(3, 1, K, 1, W), 'Draymond Green': L(3, 2, K, 1), 'Jrue Holiday': L(3, 1, K, 1),
  'Chris Paul': L(3, 2, K, 1), 'Russell Westbrook': L(3, 1, K, 2), 'Bradley Beal': L(3, 1, K, 1), 'Jalen Brunson': L(2, 1, K, 1),
  'Tyrese Maxey': L(3, 10, K, 0), 'Kyle Lowry': L(3, 0, K, 1), 'Julius Randle': L(3, 2, K, 2), 'Khris Middleton': L(3, 2, K, 1),
  'Pascal Siakam': L(5, 1, K, 1, W), 'Mikal Bridges': L(3, 1, K, 1), 'OG Anunoby': L(4, 2, K, 1), 'Josh Hart': L(3, 2, K, 1),
  'Aaron Gordon': L(2, 1, K, 1), 'Jamal Murray': L(3, 10, K, 1), 'Dillon Brooks': L(3, 2, K, 2), 'Norman Powell': L(3, 2, K, 1),
  'Mike Conley': L(3, 2, K, 1), 'Dennis Schroder': L(2, 1, K, 1), 'Rui Hachimura': L(2, 2, K, 0), 'Luguentz Dort': L(4, 2, K, 1),
  'DeAaron Fox': L(3, 1, K, 0), 'Darius Garland': L(3, 1, K, 0),
  // ---- Jóvenes ----
  'Chet Holmgren': L(3, 1, K, 0), 'Cade Cunningham': L(3, 1, K, 0), 'Paolo Banchero': L(2, 10, K, 1), 'Scottie Barnes': L(4, 2, K, 0),
  'Evan Mobley': L(3, 1, K, 0), 'Jabari Smith Jr.': L(3, 1, K, 0), 'Jalen Williams': L(3, 1, K, 0), 'Cooper Flagg': L(0, 9, LB, 0),
  'Jared McCain': L(0, 9, BR, 0), 'Brandin Podziemski': L(0, 9, BR, 0), 'Christian Braun': L(0, 9, BR, 0), 'Josh Giddey': L(0, 9, DB, 0),
  'Franz Wagner': L(0, 9, BR, 0), 'Jalen Duren': L(3, 1, K, 0), 'Bilal Coulibaly': L(4, 1, K, 0), 'Jaden McDaniels': L(3, 1, K, 0),
  'Trey Murphy III': L(3, 1, K, 0), 'Andrew Nembhard': L(3, 1, K, 0), 'Ayo Dosunmu': L(3, 1, K, 0),
  // ---- Más jugadores ----
  'Zach LaVine': L(2, 1, K, 1), 'Marcus Smart': L(3, 2, K, 2), 'Jarrett Allen': L(3, 10, K, 0), 'Jaren Jackson Jr.': L(3, 10, K, 1),
  'Kentavious Caldwell-Pope': L(3, 2, K, 1), 'Bobby Portis': L(3, 2, K, 2), 'CJ McCollum': L(3, 2, K, 1), 'Herbert Jones': L(3, 2, K, 0),
  'Brandon Ingram': L(3, 10, K, 1), 'Jordan Poole': L(3, 1, K, 0), 'Kyle Kuzma': L(3, 1, K, 1), 'Aaron Nesmith': L(3, 1, K, 1),
  'Myles Turner': L(3, 1, K, 1), 'Isaiah Stewart': L(4, 2, K, 2), 'Al Horford': L(1, 0, '#8d8d8d', 2), 'John Collins': L(3, 2, K, 1),
  'Cameron Johnson': L(0, 9, LB, 0), 'Kevin Huerter': L(0, 9, BR, 0), 'Max Strus': L(0, 9, BR, 1), 'Duncan Robinson': L(0, 9, LB, 1),
  'Grayson Allen': L(0, 9, LB, 1), 'Donte DiVincenzo': L(0, 9, DB, 1),
  // ---- Blancos / de afuera de EE.UU. ----
  'Alex Caruso': L(0, 0, K, 1, '#ffffff'), 'Klay Thompson': L(0, 9, BR, 1), 'Domantas Sabonis': L(0, 1, BR, 2),
  'Kristaps Porzingis': L(0, 9, LB, 1), 'Tyler Herro': L(0, 9, BR, 0), 'Austin Reaves': L(0, 9, '#8a4a22', 1),
  'Isaiah Hartenstein': L(0, 1, DB, 1), 'Ivica Zubac': L(0, 1, DB, 2), 'Jusuf Nurkic': L(0, 9, DB, 2), 'Brook Lopez': L(1, 0, K, 2),
  'Jakob Poeltl': L(0, 1, BR, 1), 'Nikola Vucevic': L(0, 1, DB, 1), 'Bogdan Bogdanovic': L(0, 1, DB, 2), 'Lauri Markkanen': L(0, 9, LB, 1),
  'Deni Avdija': L(1, 1, K, 1), 'Alperen Sengun': L(1, 1, K, 1),
  // ---- v35: más jugadores (rotación, jóvenes y rookies) ----
  'DeMar DeRozan': L(3, 2, K, 1), 'Derrick White': L(3, 1, K, 0), 'Jalen Green': L(4, 1, K, 0), 'Amen Thompson': L(4, 5, K, 0),
  'Ausar Thompson': L(4, 5, K, 0), 'Dyson Daniels': L(3, 1, K, 0), 'Stephon Castle': L(3, 1, K, 0), 'Keyonte George': L(3, 1, K, 0),
  'Jalen Johnson': L(3, 1, K, 1), 'Desmond Bane': L(3, 1, K, 1), 'Jalen Suggs': L(3, 1, K, 0, W), 'Payton Pritchard': L(0, 9, LB, 1),
  'Sam Hauser': L(0, 9, BR, 1), 'Naz Reid': L(3, 10, K, 1), 'Jerami Grant': L(3, 1, K, 1), 'Andrew Wiggins': L(3, 1, K, 0),
  'Terry Rozier': L(3, 1, K, 1), 'Coby White': L(3, 1, K, 0), 'Cam Thomas': L(3, 1, K, 0), 'Michael Porter Jr.': L(3, 1, K, 1),
  'Ben Simmons': L(3, 1, K, 1), 'Jonathan Kuminga': L(3, 1, K, 0), 'Scoot Henderson': L(3, 1, K, 0), 'Shaedon Sharpe': L(3, 1, K, 0),
  'Anfernee Simons': L(3, 1, K, 0), 'Deandre Ayton': L(3, 1, K, 1), 'Donovan Clingan': L(3, 1, K, 1), 'Wendell Carter Jr.': L(3, 1, K, 1),
  'Nickeil Alexander-Walker': L(3, 1, K, 1), 'Immanuel Quickley': L(3, 1, K, 0), 'RJ Barrett': L(3, 1, K, 1), 'Dejounte Murray': L(3, 1, K, 1),
  'Brandon Miller': L(3, 1, K, 0), 'Alex Sarr': L(3, 1, K, 0), 'Zaccharie Risacher': L(3, 1, K, 0), 'Tobias Harris': L(3, 2, K, 1),
  'Buddy Hield': L(3, 1, K, 1), 'Kevin Love': L(0, 9, LB, 2), 'Jonas Valanciunas': L(0, 9, DB, 2), 'Nikola Jovic': L(0, 9, BR, 0),
  'Tre Jones': L(3, 1, K, 0), 'Moritz Wagner': L(0, 9, LB, 1), 'Daniel Gafford': L(3, 1, K, 0), "Kel'el Ware": L(3, 1, K, 0),
  'Dylan Harper': L(2, 1, K, 0), 'VJ Edgecombe': L(3, 1, K, 0), 'Kon Knueppel': L(0, 9, BR, 0), 'Miles McBride': L(3, 1, K, 0),
  'Tyus Jones': L(3, 1, K, 0), 'Jose Alvarado': L(2, 1, K, 1), 'Mitchell Robinson': L(3, 10, K, 0), 'Walker Kessler': L(1, 1, K, 0),
};

/** Normaliza un nombre para compararlo: sin tildes, mayúsculas, puntos ni sufijos (Jr., III). */
export const normName = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[.'’]/g, '').replace(/-/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
export const KNOWN = Object.fromEntries(Object.entries(KNOWN_RAW).map(([n, v]) => [normName(n), { ...v, name: n }]));
export const knownLook = name => KNOWN[normName(name)] || null;

const has = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
/** Arma el objeto de aspecto de un jugador: columnas de la base primero, después la tabla de conocidos. */
export function lookOf(r, kn) {
  return {
    hair: has(r.hair_style) ? clamp(Math.round(Number(r.hair_style)), 0, 10) : kn?.hair,
    hairColor: r.hair_color || kn?.color || undefined,
    beard: has(r.beard) ? clamp(Math.round(Number(r.beard)), 0, 2) : kn?.beard,
    band: r.headband || kn?.band || null,
    sleeve: r.arm_sleeve || kn?.sleeve || null,
    sleeveColor: r.sleeve_color || kn?.sleeveColor || null,
    wrist: r.wrist_band || kn?.wrist || null,
    wristColor: r.wrist_color || kn?.wristColor || null,
    knee: r.knee_sleeve || kn?.knee || null,
    kneeColor: r.knee_color || kn?.kneeColor || null,
  };
}
