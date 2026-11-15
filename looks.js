/* ============================================================================
   Aspecto de los jugadores (v33): altura, contextura, piel, pelo, barba, vincha y manga.
   Orden de prioridad para cada rasgo:  1) columna de la base (supabase/005_aspecto.sql)  →  2) tabla de jugadores
   conocidos de abajo (por nombre)  →  3) estimado desde el nombre (como antes).
   Códigos de peinado:  0 pelado · 1 corto · 2 rapado/fade · 3 afro · 4 high top · 5 trenzas · 6 rodete · 7 cola / pelo largo atado · 8 rizos largos
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
const KNOWN_RAW = {
  // Estrellas
  'LeBron James': L(3, 2, K, 1, '#111111'), 'Stephen Curry': L(2, 2, K, 0), 'Kevin Durant': L(3, 2, K, 1),
  'Giannis Antetokounmpo': L(5, 2, K, 1), 'Nikola Jokic': L(0, 7, DB, 2), 'Luka Doncic': L(0, 1, DB, 2),
  'Joel Embiid': L(4, 2, K, 2), 'Jayson Tatum': L(3, 2, K, 1), 'Jaylen Brown': L(4, 2, K, 1),
  'Shai Gilgeous-Alexander': L(4, 2, K, 1), 'Anthony Edwards': L(4, 2, K, 1), 'Victor Wembanyama': L(4, 2, K, 0),
  'Ja Morant': L(3, 2, K, 0), 'Devin Booker': L(2, 2, K, 1), 'Kawhi Leonard': L(4, 2, K, 1), 'Paul George': L(3, 2, K, 1),
  'Damian Lillard': L(3, 2, K, 1), 'Kyrie Irving': L(2, 2, K, 1), 'James Harden': L(3, 2, K, 2), 'Jimmy Butler': L(3, 2, K, 1),
  'Bam Adebayo': L(3, 2, K, 1), 'Trae Young': L(2, 2, K, 1), 'Donovan Mitchell': L(3, 2, K, 1), 'Tyrese Haliburton': L(2, 2, K, 0),
  'LaMelo Ball': L(2, 8, '#d8c27a', 1), 'Zion Williamson': L(3, 2, K, 1), 'Karl-Anthony Towns': L(2, 2, K, 2),
  'Rudy Gobert': L(3, 2, K, 1), 'Anthony Davis': L(3, 2, K, 1), 'Draymond Green': L(3, 2, K, 1), 'Jrue Holiday': L(3, 2, K, 1),
  'Chris Paul': L(3, 2, K, 1), 'Russell Westbrook': L(3, 2, K, 2), 'Bradley Beal': L(3, 2, K, 1), 'Jalen Brunson': L(2, 2, K, 1),
  'Tyrese Maxey': L(3, 2, K, 0), 'Kyle Lowry': L(3, 0, K, 1), 'Julius Randle': L(3, 2, K, 2), 'Khris Middleton': L(3, 2, K, 1),
  'Pascal Siakam': L(5, 2, K, 1), 'Mikal Bridges': L(3, 2, K, 1), 'OG Anunoby': L(4, 2, K, 1), 'Josh Hart': L(3, 2, K, 1),
  'Aaron Gordon': L(2, 2, K, 1), 'Jamal Murray': L(3, 2, K, 1), 'Dillon Brooks': L(3, 2, K, 2), 'Norman Powell': L(3, 2, K, 1),
  'Mike Conley': L(3, 2, K, 1), 'Dennis Schroder': L(2, 2, K, 1), 'Rui Hachimura': L(2, 2, K, 0), 'Luguentz Dort': L(4, 2, K, 1),
  'DeAaron Fox': L(3, 2, K, 0), 'Darius Garland': L(3, 2, K, 0),
  // Jóvenes
  'Chet Holmgren': L(3, 2, K, 0), 'Cade Cunningham': L(3, 2, K, 0), 'Paolo Banchero': L(2, 2, K, 1), 'Scottie Barnes': L(4, 2, K, 0),
  'Evan Mobley': L(3, 2, K, 0), 'Jabari Smith Jr.': L(3, 2, K, 0), 'Jalen Williams': L(3, 2, K, 0), 'Cooper Flagg': L(0, 1, LB, 0),
  'Jared McCain': L(0, 1, BR, 0), 'Brandin Podziemski': L(0, 1, BR, 0), 'Christian Braun': L(0, 1, BR, 0), 'Josh Giddey': L(0, 1, DB, 0),
  'Franz Wagner': L(0, 1, BR, 0),
  // Blancos / de afuera de EE.UU.
  'Alex Caruso': L(0, 0, K, 1, '#ffffff'), 'Klay Thompson': L(0, 1, BR, 1), 'Domantas Sabonis': L(0, 1, BR, 2),
  'Kristaps Porzingis': L(0, 1, LB, 1), 'Tyler Herro': L(0, 1, BR, 0), 'Austin Reaves': L(0, 1, LB, 1),
  'Isaiah Hartenstein': L(0, 1, DB, 1), 'Ivica Zubac': L(0, 1, DB, 2), 'Jusuf Nurkic': L(0, 1, DB, 2), 'Brook Lopez': L(1, 0, K, 2),
  'Jakob Poeltl': L(0, 1, BR, 1), 'Nikola Vucevic': L(0, 1, DB, 1), 'Bogdan Bogdanovic': L(0, 1, DB, 2), 'Lauri Markkanen': L(0, 1, LB, 1),
  'Deni Avdija': L(1, 1, K, 1), 'Alperen Sengun': L(1, 1, K, 1),
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
    hair: has(r.hair_style) ? clamp(Math.round(Number(r.hair_style)), 0, 8) : kn?.hair,
    hairColor: r.hair_color || kn?.color || undefined,
    beard: has(r.beard) ? clamp(Math.round(Number(r.beard)), 0, 2) : kn?.beard,
    band: r.headband || kn?.band || null,
    sleeve: r.arm_sleeve || kn?.sleeve || null,
    sleeveColor: r.sleeve_color || kn?.sleeveColor || null,
  };
}
