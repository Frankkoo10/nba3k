/* ============================================================================
   Datos fijos del modo carrera: divisiones, ligas, clubes, secundarias, nombres por país, edades conocidas.
   Se puede editar a mano: son solo listas.
   ========================================================================== */

/** Conferencias y divisiones de la NBA (abreviaturas de teams.js). */
export const DIVISIONS = {
  Atlantic:  { conf: 'E', teams: ['BOS', 'BKN', 'NYK', 'PHI', 'TOR'] },
  Central:   { conf: 'E', teams: ['CHI', 'CLE', 'DET', 'IND', 'MIL'] },
  Southeast: { conf: 'E', teams: ['ATL', 'CHA', 'MIA', 'ORL', 'WAS'] },
  Northwest: { conf: 'W', teams: ['DEN', 'MIN', 'OKC', 'POR', 'UTA'] },
  Pacific:   { conf: 'W', teams: ['GSW', 'LAC', 'LAL', 'PHX', 'SAC'] },
  Southwest: { conf: 'W', teams: ['DAL', 'HOU', 'MEM', 'NOP', 'SAS'] },
};
export const DIV_NAME = { Atlantic: 'Atlántico', Central: 'Central', Southeast: 'Sudeste', Northwest: 'Noroeste', Pacific: 'Pacífico', Southwest: 'Sudoeste' };
export const CONF_NAME = { E: 'Este', W: 'Oeste' };

/** Ciudad de cada franquicia (para mostrar "G League de ..." y mensajes). */
export const CITY = { ATL: 'Atlanta', BOS: 'Boston', BKN: 'Brooklyn', CHA: 'Charlotte', CHI: 'Chicago', CLE: 'Cleveland', DAL: 'Dallas', DEN: 'Denver', DET: 'Detroit', GSW: 'San Francisco', HOU: 'Houston', IND: 'Indianápolis', LAC: 'Los Ángeles', LAL: 'Los Ángeles', MEM: 'Memphis', MIA: 'Miami', MIL: 'Milwaukee', MIN: 'Minneapolis', NOP: 'Nueva Orleans', NYK: 'Nueva York', OKC: 'Oklahoma City', ORL: 'Orlando', PHI: 'Filadelfia', PHX: 'Phoenix', POR: 'Portland', SAC: 'Sacramento', SAS: 'San Antonio', TOR: 'Toronto', UTA: 'Salt Lake City', WAS: 'Washington' };

/** Ligas del mundo. `lvl` = nivel medio de sus jugadores (sirve para generar planteles). */
export const LEAGUES = {
  NBA: { name: 'NBA', country: 'EE.UU.', lvl: 74, buyout: 0 },
  GL:  { name: 'G League', country: 'EE.UU.', lvl: 58, buyout: 0 },
  EUR: { name: 'EuroLeague', country: 'Europa', lvl: 66, buyout: 1 },
  ARG: { name: 'Liga Nacional (Argentina)', country: 'Argentina', lvl: 55, buyout: 0.5 },
  AUS: { name: 'NBL (Australia)', country: 'Australia', lvl: 58, buyout: 0.6 },
  CHN: { name: 'CBA (China)', country: 'China', lvl: 57, buyout: 0.8 },
  BRA: { name: 'NBB (Brasil)', country: 'Brasil', lvl: 54, buyout: 0.4 },
  HS:  { name: 'Secundarias', country: 'EE.UU.', lvl: 48, buyout: 0 },
};
/** Clubes de las ligas de afuera: [id, nombre, color1, color2, ciudad/país, prestigio 0-1] */
export const CLUBS = {
  EUR: [
    ['RMA', 'Real Madrid', '#FFFFFF', '#00529F', 'Madrid', 0.95], ['BAR', 'FC Barcelona', '#A50044', '#004D98', 'Barcelona', 0.92],
    ['OLY', 'Olympiacos', '#C8102E', '#FFFFFF', 'Pireo', 0.88], ['PAN', 'Panathinaikos', '#006633', '#FFFFFF', 'Atenas', 0.9],
    ['FEN', 'Fenerbahçe', '#002D62', '#F7D117', 'Estambul', 0.9], ['EFS', 'Anadolu Efes', '#0033A0', '#FFFFFF', 'Estambul', 0.82],
    ['MTA', 'Maccabi Tel Aviv', '#FFD100', '#0033A0', 'Tel Aviv', 0.7], ['PAR', 'Partizan', '#111111', '#FFFFFF', 'Belgrado', 0.8],
    ['CZV', 'Estrella Roja', '#C8102E', '#FFFFFF', 'Belgrado', 0.78], ['BAY', 'Bayern Múnich', '#DC052D', '#0066B2', 'Múnich', 0.7],
    ['BKN', 'Baskonia', '#003366', '#C8102E', 'Vitoria', 0.7], ['VIR', 'Virtus Bolonia', '#111111', '#FFFFFF', 'Bolonia', 0.72],
    ['MIL', 'Olimpia Milán', '#E2001A', '#FFFFFF', 'Milán', 0.78], ['ASV', 'ASVEL', '#111111', '#FFFFFF', 'Villeurbanne', 0.62],
    ['MON', 'Mónaco', '#E2001A', '#FFFFFF', 'Mónaco', 0.8], ['ZAL', 'Žalgiris', '#00854A', '#FFFFFF', 'Kaunas', 0.72],
    ['VAL', 'Valencia Basket', '#F58220', '#111111', 'Valencia', 0.72], ['HTA', 'Hapoel Tel Aviv', '#C8102E', '#FFFFFF', 'Tel Aviv', 0.6],
  ],
  ARG: [
    ['QUI', 'Quimsa', '#C8102E', '#FFFFFF', 'Santiago del Estero', 0.8], ['INS', 'Instituto', '#C8102E', '#FFFFFF', 'Córdoba', 0.7],
    ['BOC', 'Boca Juniors', '#003A8F', '#FFD100', 'Buenos Aires', 0.75], ['OBR', 'Obras Basket', '#E2001A', '#FFFFFF', 'Buenos Aires', 0.6],
    ['REG', 'Regatas Corrientes', '#E2001A', '#FFFFFF', 'Corrientes', 0.6], ['GIM', 'Gimnasia (CdU)', '#2E7D32', '#FFFFFF', 'Concepción del Uruguay', 0.5],
    ['PEN', 'Peñarol', '#111111', '#FFFFFF', 'Mar del Plata', 0.6], ['SMC', 'San Martín (Corrientes)', '#C8102E', '#FFFFFF', 'Corrientes', 0.5],
    ['OLI', 'Olímpico', '#1E3A8A', '#FFFFFF', 'La Banda', 0.5], ['FER', 'Ferro', '#0B6B3A', '#FFFFFF', 'Buenos Aires', 0.5],
    ['ATE', 'Atenas', '#E2001A', '#FFFFFF', 'Córdoba', 0.5], ['UNI', 'Unión de Santa Fe', '#C8102E', '#111111', 'Santa Fe', 0.45],
  ],
  AUS: [
    ['SYD', 'Sydney Kings', '#5B2D8C', '#FFFFFF', 'Sídney', 0.8], ['MEL', 'Melbourne United', '#1E3A8A', '#FFFFFF', 'Melbourne', 0.75],
    ['PER', 'Perth Wildcats', '#C8102E', '#111111', 'Perth', 0.75], ['ILL', 'Illawarra Hawks', '#C8102E', '#111111', 'Wollongong', 0.5],
    ['NZB', 'New Zealand Breakers', '#111111', '#FFFFFF', 'Auckland', 0.6], ['ADE', 'Adelaide 36ers', '#C8102E', '#FFFFFF', 'Adelaida', 0.55],
    ['BRI', 'Brisbane Bullets', '#7A1F3D', '#F2B01E', 'Brisbane', 0.5], ['CAI', 'Cairns Taipans', '#F2B01E', '#111111', 'Cairns', 0.45],
    ['SEM', 'S.E. Melbourne Phoenix', '#FF6B00', '#111111', 'Melbourne', 0.55], ['TAS', 'Tasmania JackJumpers', '#00855A', '#FFFFFF', 'Hobart', 0.5],
  ],
  CHN: [
    ['GUA', 'Guangdong Southern Tigers', '#C8102E', '#FFFFFF', 'Dongguan', 0.9], ['LIA', 'Liaoning Flying Leopards', '#C8102E', '#FFFFFF', 'Shenyang', 0.8],
    ['BEI', 'Beijing Ducks', '#C8102E', '#FFD100', 'Pekín', 0.7], ['SHA', 'Shanghai Sharks', '#0033A0', '#FFFFFF', 'Shanghái', 0.65],
    ['ZHE', 'Zhejiang Lions', '#1E3A8A', '#FFFFFF', 'Hangzhou', 0.6], ['XIN', 'Xinjiang Flying Tigers', '#C8102E', '#FFFFFF', 'Ürümqi', 0.6],
    ['SHE', 'Shenzhen Leopards', '#C8102E', '#111111', 'Shenzhen', 0.55], ['JIL', 'Jilin Northeast Tigers', '#0B6B3A', '#FFFFFF', 'Changchun', 0.5],
    ['SDG', 'Shandong Heroes', '#C8102E', '#FFFFFF', 'Jinan', 0.5], ['FUJ', 'Fujian Sturgeons', '#1E3A8A', '#FFFFFF', 'Jinjiang', 0.5],
    ['JIA', 'Jiangsu Dragons', '#C8102E', '#FFD100', 'Nankín', 0.5], ['GZL', 'Guangzhou Loong-Lions', '#C8102E', '#FFFFFF', 'Cantón', 0.45],
  ],
  BRA: [
    ['FLA', 'Flamengo', '#C8102E', '#111111', 'Río de Janeiro', 0.8], ['FRA', 'Franca', '#0B6B3A', '#FFFFFF', 'Franca', 0.65],
    ['MIN', 'Minas', '#1E3A8A', '#FFFFFF', 'Belo Horizonte', 0.6], ['PAU', 'Paulistano', '#C8102E', '#FFFFFF', 'São Paulo', 0.6],
    ['BAU', 'Bauru', '#FFD100', '#111111', 'Bauru', 0.5], ['BRB', 'Brasília', '#1E3A8A', '#FFD100', 'Brasilia', 0.5],
    ['CAX', 'Caxias do Sul', '#C8102E', '#FFFFFF', 'Caxias do Sul', 0.4], ['SJC', 'São José', '#1E3A8A', '#FFFFFF', 'São José dos Campos', 0.4],
  ],
};

/** Secundarias (las que usa el modo carrera para generar a los prospectos del Draft). */
export const SCHOOLS = [
  'Montverde Academy', 'IMG Academy', 'Oak Hill Academy', 'Sierra Canyon', 'Link Academy', 'Prolific Prep', 'Long Island Lutheran', 'La Lumiere',
  'Duncanville HS', 'Findlay Prep', 'Brewster Academy', 'Compass Prep', 'Wasatch Academy', 'Chino Hills HS', 'Bishop Gorman', 'Christ the King',
  'Hamilton Heights', 'Camden HS', 'Paul VI Catholic', 'St. Frances Academy', 'Harvard-Westlake', 'DeMatha Catholic', 'Westtown School', 'Corona Centennial',
];
export const COLLEGES = ['Duke', 'Kentucky', 'Kansas', 'UConn', 'Gonzaga', 'Arizona', 'Houston', 'Purdue', 'Tennessee', 'North Carolina', 'Alabama', 'Baylor'];

/** Pools de nombres por nacionalidad: [pesoDeAparición, nombres, apellidos, alturaMediaCm]. */
export const NAMES = {
  USA: [10, ['Marcus', 'Jaylen', 'Tyrese', 'DeAndre', 'Malik', 'Jalen', 'Isaiah', 'Terrence', 'Darius', 'Kendrick', 'Trey', 'Xavier', 'Caleb', 'Devin', 'Elijah', 'Jordan', 'Cameron', 'Nolan', 'Brandon', 'Rashad', 'Corey', 'Tyler', 'Mason', 'Austin', 'Dante', 'Khalil', 'Landon', 'Micah', 'Zion', 'Jabari'],
    ['Johnson', 'Williams', 'Brown', 'Jackson', 'Harris', 'Robinson', 'Thompson', 'Walker', 'Hayes', 'Coleman', 'Bryant', 'Sanders', 'Hawkins', 'Bishop', 'Fleming', 'Maddox', 'Whitfield', 'Pruitt', 'Rollins', 'Tate', 'Gaines', 'Holloway', 'Barnett', 'Mercer', 'Dillard', 'Strickland', 'Oakes', 'Wallace', 'Reese', 'Crawford', 'Boone', 'Lattimore'], 198],
  ARG: [2, ['Facundo', 'Matías', 'Nicolás', 'Lucas', 'Santiago', 'Franco', 'Tomás', 'Bruno', 'Leandro', 'Gonzalo', 'Joaquín', 'Marcos', 'Agustín', 'Ignacio'], ['Gómez', 'Fernández', 'Rodríguez', 'Acosta', 'Benítez', 'Sosa', 'Ledesma', 'Peralta', 'Romero', 'Ibáñez', 'Cabrera', 'Vildoza', 'Paz', 'Medina', 'Brussino', 'Campazzo'].filter(x => x !== 'Campazzo'), 195],
  ESP: [2, ['Álvaro', 'Pablo', 'Sergio', 'Jorge', 'Raúl', 'Unai', 'Iker', 'Víctor', 'Carlos', 'Dani'], ['García', 'Martínez', 'Sánchez', 'Navarro', 'Ortega', 'Ferrer', 'Castillo', 'Vidal', 'Prieto', 'Llull'].filter(x => x !== 'Llull'), 200],
  FRA: [2, ['Théo', 'Maxime', 'Antoine', 'Nolan', 'Hugo', 'Axel', 'Mathis', 'Yanis', 'Rayan', 'Killian'], ['Dubois', 'Moreau', 'Laurent', 'Diallo', 'Camara', 'Traoré', 'Fournier', 'Mercier', 'Lefèvre', 'Bernard', 'Cissé'], 201],
  SRB: [1.5, ['Nikola', 'Marko', 'Filip', 'Stefan', 'Luka', 'Vasilije', 'Aleksa', 'Dušan', 'Uroš', 'Nemanja'], ['Petrović', 'Jovanović', 'Marković', 'Ilić', 'Stojanović', 'Kostić', 'Pavlović', 'Lazić', 'Vukčević', 'Todorović'], 205],
  GRE: [1.2, ['Giorgos', 'Nikos', 'Dimitris', 'Kostas', 'Thanasis', 'Vassilis', 'Panos', 'Tasos'], ['Papadakis', 'Antetokounmpo', 'Mitrou', 'Vasileiadis', 'Galanis', 'Kourtis', 'Nikolaidis', 'Spanoulis'].filter(x => x !== 'Antetokounmpo' && x !== 'Spanoulis'), 200],
  LIT: [1, ['Mantas', 'Tomas', 'Arnas', 'Rokas', 'Lukas', 'Domantas', 'Donatas', 'Gytis'], ['Kazlauskas', 'Petraitis', 'Jonaitis', 'Butkus', 'Stankevičius', 'Šimkus', 'Navickas', 'Vaitkus'], 203],
  SLO: [0.8, ['Žan', 'Luka', 'Aleksej', 'Klemen', 'Jaka', 'Edo', 'Vlatko', 'Gregor'], ['Novak', 'Horvat', 'Kovač', 'Zupan', 'Vidmar', 'Kos', 'Potočnik', 'Mlakar'], 201],
  TUR: [1.2, ['Emre', 'Cedi', 'Furkan', 'Ercan', 'Berk', 'Yiğit', 'Ege', 'Arda'], ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk', 'Arslan'], 200],
  GER: [1, ['Maximilian', 'Leon', 'Paul', 'Tim', 'Jonas', 'Moritz', 'Niklas', 'David'], ['Müller', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Richter'], 203],
  ITA: [1, ['Matteo', 'Marco', 'Andrea', 'Davide', 'Riccardo', 'Federico', 'Simone', 'Lorenzo'], ['Rossi', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino'], 198],
  AUS: [1.5, ['Jack', 'Oliver', 'Tom', 'Liam', 'Harry', 'Cooper', 'Luke', 'Archie'], ['Smith', 'Jones', 'Taylor', 'Walsh', 'Murray', 'Kelly', 'Ryan', 'Cameron'], 200],
  CAN: [2, ['Jamal', 'Shaedon', 'Dillon', 'Kelly', 'Andrew', 'Nickeil', 'Zach', 'Ethan'], ['Murphy', 'Tremblay', 'Gagnon', 'Roy', 'Lavoie', 'Bouchard', 'Clarke', 'Brooks'], 199],
  BRA: [1.2, ['Gabriel', 'Rafael', 'Thiago', 'Vinícius', 'Bruno', 'Lucas', 'Matheus', 'Guilherme'], ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Almeida', 'Barbosa'], 197],
  NGR: [1.2, ['Chidi', 'Emeka', 'Obinna', 'Tunde', 'Ikenna', 'Kelechi', 'Uche', 'Chuka'], ['Okafor', 'Adeyemi', 'Nwosu', 'Eze', 'Okonkwo', 'Balogun', 'Abiola', 'Ugochukwu'], 204],
  CHN: [1, ['Wei', 'Jun', 'Hao', 'Ming', 'Yu', 'Lei', 'Tao', 'Zhen'], ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao'], 200],
  LAT: [0.8, ['Rodrigo', 'Esteban', 'Mauricio', 'Camilo', 'Emilio', 'Sebastián', 'Gael', 'Andrés'], ['Vargas', 'Rojas', 'Núñez', 'Herrera', 'Mendoza', 'Salazar', 'Guerrero', 'Paredes'], 196],
  CRO: [0.8, ['Ivan', 'Dario', 'Mario', 'Josip', 'Bojan', 'Karlo', 'Toni', 'Dino'], ['Babić', 'Horvat', 'Perić', 'Marić', 'Tomić', 'Jurić', 'Knežević', 'Lovrić'], 203],
  LAV: [0.6, ['Kristaps', 'Rihards', 'Artūrs', 'Dairis', 'Mārtiņš', 'Klāvs'].filter(x => x !== 'Kristaps').concat(['Roberts']), ['Bērziņš', 'Ozols', 'Kalniņš', 'Liepa', 'Sproģis', 'Krūmiņš'], 204],
};
export const NAT_NAME = { USA: 'EE.UU.', ARG: 'Argentina', ESP: 'España', FRA: 'Francia', SRB: 'Serbia', GRE: 'Grecia', LIT: 'Lituania', SLO: 'Eslovenia', TUR: 'Turquía', GER: 'Alemania', ITA: 'Italia', AUS: 'Australia', CAN: 'Canadá', BRA: 'Brasil', NGR: 'Nigeria', CHN: 'China', LAT: 'Latinoamérica', CRO: 'Croacia', LAV: 'Letonia' };
/** Nacionalidades de cada liga (probabilidades relativas). */
export const LEAGUE_NATS = {
  NBA: { USA: 78, CAN: 4, FRA: 2, AUS: 2, SRB: 1.5, ESP: 1, GER: 1, GRE: 1, NGR: 1, LIT: 0.5, SLO: 0.5, ARG: 0.5, BRA: 0.5, TUR: 0.5 },
  GL: { USA: 85, CAN: 3, NGR: 2, AUS: 1, FRA: 1, LAT: 1 },
  EUR: { SRB: 12, GRE: 12, ESP: 12, FRA: 10, ITA: 8, LIT: 8, TUR: 10, GER: 8, SLO: 4, CRO: 6, USA: 22, LAV: 3, ARG: 2 },
  ARG: { ARG: 80, USA: 12, LAT: 4, BRA: 2 },
  AUS: { AUS: 62, USA: 28, CAN: 3 },
  CHN: { CHN: 78, USA: 18 },
  BRA: { BRA: 78, USA: 10, ARG: 6, LAT: 4 },
  HS: { USA: 86, CAN: 4, NGR: 2, FRA: 2, AUS: 1, LAT: 2 },
  INT: { FRA: 14, SRB: 10, ESP: 12, LIT: 8, GER: 10, TUR: 8, AUS: 8, ARG: 6, GRE: 8, BRA: 6, NGR: 4, SLO: 4, CRO: 4, ITA: 6, LAT: 4 },
};

/** Edad aproximada (en octubre de 2026) de estrellas conocidas, para que las edades no salgan al azar. Son aproximadas. */
export const KNOWN_AGE = {
  'lebron james': 41, 'stephen curry': 38, 'kevin durant': 38, 'nikola jokic': 31, 'giannis antetokounmpo': 31, 'luka doncic': 27, 'shai gilgeous-alexander': 28,
  'victor wembanyama': 22, 'jayson tatum': 28, 'anthony edwards': 25, 'devin booker': 30, 'joel embiid': 32, 'james harden': 37, 'kawhi leonard': 35, 'paul george': 36,
  'jimmy butler': 37, 'anthony davis': 33, 'damian lillard': 36, 'tyrese haliburton': 26, 'jalen brunson': 30, 'donovan mitchell': 30, 'karl-anthony towns': 31,
  'trae young': 28, 'ja morant': 27, 'zion williamson': 26, 'paolo banchero': 24, 'cade cunningham': 25, 'tyrese maxey': 26, 'scottie barnes': 25, 'jaylen brown': 30,
  'jalen williams': 25, 'chet holmgren': 24, 'cooper flagg': 19, 'dylan harper': 20, "de'aaron fox": 28, 'domantas sabonis': 30, 'bam adebayo': 29, 'demar derozan': 37,
  'kyrie irving': 34, 'jamal murray': 29, 'lamelo ball': 25, 'evan mobley': 25, 'franz wagner': 25, 'alperen sengun': 24, 'desmond bane': 28, 'jaren jackson jr.': 27,
  'jrue holiday': 36, 'chris paul': 41, 'russell westbrook': 38, 'al horford': 40, 'draymond green': 36, 'klay thompson': 36, 'brook lopez': 38, 'mike conley': 39,
  'victor oladipo': 34, 'amen thompson': 23, 'ausar thompson': 23, 'jalen green': 24, 'scoot henderson': 22, 'jabari smith jr.': 23, 'keegan murray': 25, 'zach edey': 24,
};
