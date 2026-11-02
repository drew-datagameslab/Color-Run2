import { Die, UserAccount } from '../types/game';

/**
 * First-time player tutorial:
 *  1. welcome      Welcome message
 *  2. practice     A scripted three-roll practice turn on the player's own board
 *  3. battle       A real game against one computer player, where the new player's rolls are a
 *                  little luckier, so they win after the first elimination round
 *  4. balloon      Balloon Pop opens after the game, as it does for everyone
 *  5. menu         Coach: tap PLAY GAME
 *  6. modes        Coach: each game mode explained, then Play vs Computer
 *  7. pick         Coach: Standard 4 Player, which starts their first real game; tutorial done
 */
export type TutorialStep = 'welcome' | 'practice' | 'battle' | 'menu' | 'modes' | 'pick' | 'done';

const KEY = 'cr_tutorial_';

export function getTutorialStep(uid: string): TutorialStep | null {
  try {
    return (localStorage.getItem(KEY + uid) as TutorialStep) || null;
  } catch {
    return null;
  }
}

export function setTutorialStep(uid: string, step: TutorialStep) {
  try {
    localStorage.setItem(KEY + uid, step);
  } catch {
    // ignore
  }
}

/** A brand-new account that hasn't seen (or skipped) the tutorial */
export function shouldStartTutorial(user: UserAccount): boolean {
  if (user.isGuest || getTutorialStep(user.uid)) return false;
  return (user.xp || 0) === 0 && (user.level || 1) <= 1;
}

// Face values: 1 triangle, 2 diamond, 3 club, 4 spade, 5 heart, 6 star
export const SPADE = 4;
export const DIAMOND = 2;

/**
 * The practice turn's rolls, per color ("A" is the player's first dice color, blue by default;
 * "B" the second, red). Values are handed to that color's active dice in order.
 *  Roll 1: 3 blue spades + 1 red spade, nothing else makes a set
 *  Roll 2: 2 more blue spades + 3 red diamonds
 *  Roll 3: the last blue spade (6 blue spades: a Color Run!) + 1 more red diamond
 * Final: 7 spades (35 + 100 bonus) + 4 red diamonds (20 + 25 bonus) = 180 points
 */
export const PRACTICE_ROLLS: Array<{ A: number[]; B: number[] }> = [
  { A: [SPADE, SPADE, SPADE, 1, 2, 3], B: [SPADE, 1, 2, 5, 6, 6] },
  { A: [SPADE, SPADE, 1], B: [DIAMOND, DIAMOND, DIAMOND, 3, 5] },
  { A: [SPADE], B: [DIAMOND, 1] },
];

/** Values for the practice roll; extra dice (if the player saved differently) get a non-matching value */
export function practiceRollValues(rollIndex: number, active: Die[], colorA: string): Map<number, number> {
  const script = PRACTICE_ROLLS[Math.min(rollIndex, PRACTICE_ROLLS.length - 1)];
  const queues = { A: [...script.A], B: [...script.B] };
  const values = new Map<number, number>();
  for (const d of active) {
    const queue = d.color === colorA ? queues.A : queues.B;
    values.set(d.id, queue.length > 0 ? queue.shift()! : 1 + ((d.id * 5) % 6));
  }
  return values;
}

function counts(dice: Array<{ value: number }>): Record<number, number> {
  const c: Record<number, number> = {};
  for (const d of dice) c[d.value] = (c[d.value] || 0) + 1;
  return c;
}

/**
 * Tutorial battle luck. `rolled` are the dice just rolled (with their new values), `saved` the
 * dice already saved this turn.
 *  - 'lucky' (the new player): two more dice join the biggest group, preferring its main color
 *  - 'small' (computer, behind): at most one set of exactly 3 per turn
 *  - 'none'  (computer, close to the player): no sets at all this roll
 */
export function adjustTutorialRoll(rolled: Die[], saved: Die[], luck: 'lucky' | 'small' | 'none'): Die[] {
  const result = rolled.map(d => ({ ...d }));
  if (result.length === 0) return result;

  if (luck === 'lucky') {
    const all = counts([...saved, ...result]);
    const fromRoll = counts(result);
    // Grow the symbol that's already biggest (counting saved dice), using this roll's dice
    const target = Number(
      Object.keys(fromRoll).sort((a, b) => (all[+b] || 0) - (all[+a] || 0) || (fromRoll[+b] || 0) - (fromRoll[+a] || 0))[0]
    );
    const mainColor = result.filter(d => d.value === target).map(d => d.color)[0];
    const others = result
      .filter(d => d.value !== target)
      .sort((a, b) => (a.color === mainColor ? -1 : 0) - (b.color === mainColor ? -1 : 0));
    others.slice(0, 2).forEach(d => (d.value = target));
    return result;
  }

  // Computer: cap how many of each symbol it can collect
  const savedCounts = counts(saved);
  const hasSavedSet = Object.values(savedCounts).some(n => n >= 3);
  const capFor = (value: number) => {
    const s = savedCounts[value] || 0;
    if (s >= 3) return s; // no more of a set it already has
    return 2; // no new sets by default
  };
  // 'small': one value may reach exactly 3, if the computer has no set yet this turn
  let allowedSet: number | null = null;
  if (luck === 'small' && !hasSavedSet) {
    const c = counts([...saved, ...result]);
    const best = Object.keys(c).map(Number).sort((a, b) => c[b] - c[a])[0];
    if (c[best] >= 3) allowedSet = best;
  }
  const total = counts(saved);
  for (const d of result) {
    const cap = d.value === allowedSet ? 3 : capFor(d.value);
    if ((total[d.value] || 0) < cap) {
      total[d.value] = (total[d.value] || 0) + 1;
      continue;
    }
    // Move this die to the symbol with the most room
    const options = [1, 2, 3, 4, 5, 6].filter(v => v !== allowedSet && (total[v] || 0) < capFor(v));
    const next = options.sort((a, b) => (total[a] || 0) - (total[b] || 0))[0] ?? d.value;
    d.value = next;
    total[next] = (total[next] || 0) + 1;
  }
  return result;
}
