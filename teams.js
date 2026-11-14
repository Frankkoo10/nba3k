// [abreviatura, nombre, color principal, color secundario]
const RAW = [
  ['ATL','Atlanta Hawks','#E03A3E','#C1D32F'], ['BOS','Boston Celtics','#007A33','#FFFFFF'],
  ['BKN','Brooklyn Nets','#111111','#FFFFFF'], ['CHA','Charlotte Hornets','#00788C','#1D1160'],
  ['CHI','Chicago Bulls','#CE1141','#111111'], ['CLE','Cleveland Cavaliers','#860038','#FDBB30'],
  ['DAL','Dallas Mavericks','#00538C','#B8C4CA'], ['DEN','Denver Nuggets','#0E2240','#FEC524'],
  ['DET','Detroit Pistons','#C8102E','#1D42BA'], ['GSW','Golden State Warriors','#1D428A','#FFC72C'],
  ['HOU','Houston Rockets','#CE1141','#C4CED4'], ['IND','Indiana Pacers','#002D62','#FDBB30'],
  ['LAC','LA Clippers','#C8102E','#1D428A'], ['LAL','Los Angeles Lakers','#552583','#FDB927'],
  ['MEM','Memphis Grizzlies','#5D76A9','#12173F'], ['MIA','Miami Heat','#98002E','#F9A01B'],
  ['MIL','Milwaukee Bucks','#00471B','#EEE1C6'], ['MIN','Minnesota Timberwolves','#236192','#0C2340'],
  ['NOP','New Orleans Pelicans','#0C2340','#C8102E'], ['NYK','New York Knicks','#006BB6','#F58426'],
  ['OKC','Oklahoma City Thunder','#007AC1','#EF3B24'], ['ORL','Orlando Magic','#0077C0','#C4CED4'],
  ['PHI','Philadelphia 76ers','#006BB6','#ED174C'], ['PHX','Phoenix Suns','#1D1160','#E56020'],
  ['POR','Portland Trail Blazers','#E03A3E','#111111'], ['SAC','Sacramento Kings','#5A2D81','#63727A'],
  ['SAS','San Antonio Spurs','#C4CED4','#111111'], ['TOR','Toronto Raptors','#CE1141','#111111'],
  ['UTA','Utah Jazz','#002B5C','#F9A01B'], ['WAS','Washington Wizards','#002B5C','#E31837'],
];
export const TEAMS = RAW.map(([ab, name, c1, c2]) => ({ ab, name, c1, c2, logo: `logos/${ab}.png` }));
