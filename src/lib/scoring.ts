import { Die, ScoreResult, ScoreSet } from '../types/game';

/**
 * Same-color bonus rule:
 * 3 of a color: +10
 * 4 of a color: +25
 * 5 of a color: +40
 * 6 of a color: +100
 */
export function bonusFor(n: number): number {
  if (n >= 6) return 100;
  if (n === 5) return 40;
  if (n === 4) return 25;
  if (n === 3) return 10;
  return 0;
}

/**
 * Score calculation rule (Confirmed):
 * - Needs 3 or more dice of the same symbol (face value 1..6) to form a set.
 * - Each die collected is worth 5 points (base = count * 5).
 * - Each color within a value-set scores its own bonus independently, and
 *   bonuses are summed rather than taking the maximum.
 *
 * Example: 3 blue + 3 red 2s scores 50 points (6*5 = 30 base + 10 blue + 10 red = 50).
 * Example: 4 blue + 3 red 2s scores 70 points (7*5 = 35 base + 25 blue + 10 red = 70).
 */
export function scoreDice(dice: Die[]): ScoreResult {
  const byVal: Record<number, Die[]> = {};
  for (const d of dice) {
    if (!byVal[d.value]) byVal[d.value] = [];
    byVal[d.value].push(d);
  }

  let total = 0;
  const sets: ScoreSet[] = [];

  for (const vStr in byVal) {
    const v = Number(vStr);
    const g = byVal[v];
    if (g.length < 3) continue;

    const base = g.length * 5;
    const byColor: Record<string, number> = {};
    for (const d of g) {
      byColor[d.color] = (byColor[d.color] || 0) + 1;
    }

    let cb = 0;
    for (const c in byColor) {
      cb += bonusFor(byColor[c]);
    }

    total += base + cb;
    sets.push({
      value: v,
      count: g.length,
      base,
      cb,
      byColor,
    });
  }

  sets.sort((a, b) => a.value - b.value);
  return { total, sets };
}
