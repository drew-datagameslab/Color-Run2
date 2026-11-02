import { Die, UserAccount } from '../types/game';
import { decideCPUSaves } from './cpu';
import { scoreDice } from './scoring';

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

/** Extra dice that join the new player's biggest group on each roll in the tutorial battle */
export const LUCKY_EXTRA_DICE = 1;

function counts(dice: Array<{ value: number }>): Record<number, number> {
  const c: Record<number, number> = {};
  for (const d of dice) c[d.value] = (c[d.value] || 0) + 1;
  return c;
}

/**
 * The new player's luck in the tutorial battle: after each roll, LUCKY_EXTRA_DICE more dice join
 * the biggest group (counting what's already saved), preferring its main color.
 * `rolled` are the dice just rolled (with their new values), `saved` the dice saved this turn.
 */
export function luckyTutorialRoll(rolled: Die[], saved: Die[]): Die[] {
  const result = rolled.map(d => ({ ...d }));
  if (result.length === 0) return result;
  const all = counts([...saved, ...result]);
  const fromRoll = counts(result);
  const target = Number(
    Object.keys(fromRoll).sort((a, b) => (all[+b] || 0) - (all[+a] || 0) || (fromRoll[+b] || 0) - (fromRoll[+a] || 0))[0]
  );
  const mainColor = result.filter(d => d.value === target).map(d => d.color)[0];
  const others = result
    .filter(d => d.value !== target)
    .sort((a, b) => (a.color === mainColor ? -1 : 0) - (b.color === mainColor ? -1 : 0));
  others.slice(0, LUCKY_EXTRA_DICE).forEach(d => (d.value = target));
  return result;
}

/**
 * The computer's roll in the tutorial battle. It rolls and saves sets like in any game; a roll
 * is only re-rolled (up to 40 times) when the sets it would save would put its turn over
 * `budget` points, which keeps it just behind the new player. Returns die id -> value.
 */
export function tutorialComputerRoll(
  active: Die[],
  saved: Die[],
  budget: number,
  random: () => number = Math.random
): Map<number, number> {
  let best: Map<number, number> | null = null;
  let bestPoints = Infinity;
  for (let attempt = 0; attempt < 40; attempt++) {
    const values = new Map(active.map(d => [d.id, 1 + Math.floor(random() * 6)]));
    const dice = [...saved, ...active.map(d => ({ ...d, value: values.get(d.id)! }))];
    const toSave = decideCPUSaves(dice);
    const points = scoreDice(dice.filter(d => d.zone === 'saved' || toSave.includes(d.id))).total;
    if (points <= budget) return values;
    if (points < bestPoints) {
      bestPoints = points;
      best = values;
    }
  }
  return best!;
}
