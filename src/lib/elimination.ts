import { PlayerUnit } from '../types/game';

export interface ElimLogEntry {
  players: string[];
  rolls: Record<string, number>;
  winnerOrElim: string;
  isRollOff: boolean;
}

export interface ElimResolution {
  toElim: PlayerUnit[];
  log: ElimLogEntry[];
}

/**
 * Resolves elimination at the end of an elimination round:
 * - If > 6 players in the game initially, 2 players knocked out per round; else 1.
 * - Knocked out players are those with the lowest cumulative total.
 * - Ties for lowest total are resolved via a 12-dice roll-off!
 */
export function resolveElimination(
  activeUnits: PlayerUnit[],
  countToElim: number,
  rollDiceFn: () => number = () => 1 + Math.floor(Math.random() * 6)
): ElimResolution {
  const toElim: PlayerUnit[] = [];
  const log: ElimLogEntry[] = [];
  let guard = 0;

  while (toElim.length < countToElim) {
    if (++guard > 500) break;
    const remaining = activeUnits.filter(u => !toElim.some(e => e.id === u.id));
    if (remaining.length <= 1) break;

    // Find lowest score
    const minScore = Math.min(...remaining.map(u => u.score));
    const tied = remaining.filter(u => u.score === minScore);

    if (tied.length === 1) {
      toElim.push(tied[0]);
    } else {
      // Tie-breaker roll-off with 12 dice!
      // In Color Run rulebook: "Ties for last are broken by a 12-dice roll-off."
      let rollOffGuard = 0;
      let worstPlayer: PlayerUnit | null = null;

      while (!worstPlayer && ++rollOffGuard < 100) {
        const rolls: Record<string, number> = {};
        for (const p of tied) {
          let sum = 0;
          for (let d = 0; d < 12; d++) sum += rollDiceFn();
          rolls[p.name] = sum;
        }

        const minRoll = Math.min(...tied.map(p => rolls[p.name]));
        const rollLoss = tied.filter(p => rolls[p.name] === minRoll);

        log.push({
          players: tied.map(p => p.name),
          rolls,
          winnerOrElim: rollLoss.map(p => p.name).join(', '),
          isRollOff: true,
        });

        if (rollLoss.length === 1) {
          worstPlayer = rollLoss[0];
        }
      }

      if (worstPlayer) {
        toElim.push(worstPlayer);
      } else {
        toElim.push(tied[0]);
      }
    }
  }

  return { toElim, log };
}
