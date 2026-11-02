import { Die } from '../types/game';
import { scoreDice } from '../lib/scoring';
import { decideCPUSaves } from '../lib/cpu';
import { DIAMOND, SPADE, luckyTutorialRoll, practiceRollValues, tutorialComputerRoll } from '../lib/tutorial';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

function freshDice(): Die[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    color: i < 6 ? 'blue' : 'red',
    value: 1,
    zone: 'active' as const,
    selected: false,
  })) as Die[];
}

const counts = (dice: Die[]) => {
  const c: Record<number, number> = {};
  dice.forEach(d => (c[d.value] = (c[d.value] || 0) + 1));
  return c;
};

/** Saves every symbol that has 3 or more (with what's already saved), like tapping each set */
function saveSets(dice: Die[], only?: number[]): Die[] {
  const all = counts(dice);
  return dice.map(d =>
    d.zone === 'active' && all[d.value] >= 3 && (!only || only.includes(d.value)) ? { ...d, zone: 'saved' } : d
  ) as Die[];
}

function runPracticeTest() {
  let dice = freshDice();
  for (let roll = 0; roll < 3; roll++) {
    const active = dice.filter(d => d.zone === 'active');
    const values = practiceRollValues(roll, active, 'blue');
    dice = dice.map(d => (d.zone === 'active' ? { ...d, value: values.get(d.id)! } : d));
    if (roll === 0) {
      const rolled = counts(dice);
      const blueSpades = dice.filter(d => d.value === SPADE && d.color === 'blue').length;
      const redSpades = dice.filter(d => d.value === SPADE && d.color === 'red').length;
      assert(blueSpades === 3 && redSpades === 1, 'Roll 1: 3 blue spades and 1 red spade');
      assert(Object.entries(rolled).every(([v, n]) => +v === SPADE || n < 3), 'Roll 1: no other set');
    }
    if (roll === 1) {
      const rolled = dice.filter(d => d.zone === 'active');
      assert(rolled.filter(d => d.value === SPADE && d.color === 'blue').length === 2, 'Roll 2: 2 more blue spades');
      assert(rolled.filter(d => d.value === DIAMOND && d.color === 'red').length === 3, 'Roll 2: 3 red diamonds');
    }
    dice = saveSets(dice, [SPADE, DIAMOND]);
  }
  const saved = dice.filter(d => d.zone === 'saved');
  assert(saved.filter(d => d.value === SPADE && d.color === 'blue').length === 6, 'All 6 blue spades: a Color Run');
  assert(saved.filter(d => d.value === DIAMOND && d.color === 'red').length === 4, '4 red diamonds');
  assert(scoreDice(saved).total === 180, `Practice turn scores 180 (got ${scoreDice(saved).total})`);
  console.log('✓ Tutorial practice turn: 6 blue spades (Color Run) + 4 red diamonds = 180 points');
}

/** One turn: 3 rolls, saving sets after each (the computer's strategy). Returns points and saving rolls. */
function playTurn(
  roll: (active: Die[], saved: Die[]) => Map<number, number>
): { points: number; savingRolls: number } {
  let dice = freshDice();
  let savingRolls = 0;
  for (let r = 0; r < 3; r++) {
    const active = dice.filter(d => d.zone === 'active');
    if (active.length === 0) break;
    const values = roll(active, dice.filter(d => d.zone === 'saved'));
    dice = dice.map(d => (d.zone === 'active' ? { ...d, value: values.get(d.id)! } : d));
    const toSave = decideCPUSaves(dice);
    if (toSave.length > 0) savingRolls++;
    dice = dice.map(d => (toSave.includes(d.id) ? { ...d, zone: 'saved' } : d)) as Die[];
  }
  return { points: scoreDice(saveSets(dice).filter(d => d.zone === 'saved')).total, savingRolls };
}

function runBattleTest() {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const lucky = (active: Die[], saved: Die[]) =>
    new Map(
      luckyTutorialRoll(
        active.map(d => ({ ...d, value: 1 + Math.floor(random() * 6) })),
        saved
      ).map(d => [d.id, d.value] as [number, number])
    );

  let playerWins = 0;
  let computerTurns = 0;
  let computerTurnsWithSets = 0;
  let playerPoints = 0;
  let computerPoints = 0;
  const games = 200;
  for (let g = 0; g < games; g++) {
    let player = 0;
    let cpu = 0;
    let rounds = 0;
    let elimination = false;
    while (rounds < 30) {
      rounds++;
      const p = playTurn(lucky);
      player += p.points;
      playerPoints += p.points;
      const budget = Math.max(0, player - cpu - 5);
      const c = playTurn((active, saved) => tutorialComputerRoll(active, saved, budget, random));
      cpu += c.points;
      computerPoints += c.points;
      computerTurns++;
      if (c.savingRolls > 0) computerTurnsWithSets++;
      assert(cpu < player, `Computer never pulls ahead (game ${g}: ${cpu} vs ${player})`);
      // First to 250 starts the elimination round: everyone plays one more full round
      if (elimination) break;
      if (player >= 250 || cpu >= 250) elimination = true;
    }
    if (player > cpu) playerWins++;
  }
  assert(playerWins === games, `New player wins every tutorial battle (${playerWins}/${games})`);
  // The computer plays a real game: it collects sets in (nearly) every turn
  const withSetsPct = Math.round((100 * computerTurnsWithSets) / computerTurns);
  assert(withSetsPct >= 95, `Computer saves sets in its turns (${withSetsPct}%)`);
  console.log(
    `✓ Tutorial battle: new player wins ${playerWins}/${games}; computer saves sets in ${withSetsPct}% of turns ` +
      `(avg ${Math.round(computerPoints / computerTurns)} vs player ${Math.round(playerPoints / computerTurns)} per turn)`
  );
}

export function runTutorialTests() {
  runPracticeTest();
  runBattleTest();
}
