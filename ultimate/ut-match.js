import { TEAMS } from '../teams.js';
import { kitsFor, autoKit } from '../kits.js';
import * as Box from '../boxscore.js';
import { POS, teamOf, infoFor, fallbackRoster, ensureLinked } from './ut-data.js';
import * as UTS from './ut-state.js';

/* ============================================================================
   Ultimate Team · partido
   buildSetup arma el mismo objeto que usa el partido casual (prematch.getSetup) pero con:
     · tu plantilla de cartas (titulares en su casillero + suplentes) contra un rival armado con cartas reales,
     · la camiseta y la cancha de TU CLUB (equipo elegido en Mi cuenta),
     · la dificultad y la duración del cuarto del modo.
   ========================================================================== */

/** Equipo que "representa" al rival (camiseta y escudo): el de su mejor titular que no sea el tuyo. */
function oppTeam(opp, avoid) {
  const t = [...opp.starters].sort((a, b) => b.o - a.o).map(c => c.t).find(ab => ab !== avoid);
  return teamOf(t || TEAMS.find(x => x.ab !== avoid).ab);
}

export async function buildSetup(pl, base) {
  await ensureLinked().catch(() => {});                       // asegura el enlace carta ↔ jugador de la base antes de armar los 10
  const S = UTS.get(), A = teamOf(S.club.team), B = oppTeam(pl.opp, A.ab);
  const kitA = kitsFor(A)[0], kitB = autoKit(B, kitA);
  const h0 = base.humans?.[0] || { dev: 'kb', pad: null };
  const lineupB = {
    starters: pl.opp.starters.map((c, i) => infoFor(c, POS[i])),
    bench: pl.opp.bench.map(c => infoFor(c)),
  };
  if (lineupB.bench.length < 5) lineupB.bench.push(...fallbackRoster(B).bench.slice(0, 5 - lineupB.bench.length));
  return {
    ...base, players: 1, humans: [{ dev: h0.dev, pad: h0.pad ?? null, team: 0 }], ctrlSlot: 0,
    teamA: A, teamB: B, kitA, kitB, lineupA: UTS.matchLineup(undefined, A.ab), lineupB,
    qLen: pl.qLen, diff: pl.diff, shotClock: true, fatigue: true, autoSubs: true, court: 'home', courtTeam: A,
    online: undefined, styleB: undefined,
  };
}

/** Estadísticas del equipo del usuario al terminar el partido (la tabla de puntos sigue cargada hasta el próximo partido). */
export function collectStats(S) {
  const keys = [...S.lineupA.starters, ...S.lineupA.bench].map(p => String(p.id ?? p.name)), out = {};
  for (const f of ['tpm', 'ast', 'stl', 'blk', 'reb']) out[f] = keys.reduce((t, k) => t + (Box.get(0, k, f) || 0), 0);
  return out;
}
