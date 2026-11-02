import { Die } from '../types/game';
import { scoreDice } from '../lib/scoring';
import { decideCPUSaves } from '../lib/cpu';
import { DIAMOND, SPADE, adjustTutorialRoll, practiceRollValues } from '../lib/tutorial';

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

/** One turn: 3 rolls, saving sets each time (the computer's strategy), with tutorial luck */
function playTurn(luck: 'lucky' | 'small' | 'none', random: () => number): number {
  let dice = freshDice();
  for (let roll = 0; roll < 3; roll++) {
    const active = dice.filter(d => d.zone === 'active');
    if (active.length === 0) break;
    const rolled = active.map(d => ({ ...d, value: 1 + Math.floor(random() * 6) }));
    const adjusted = adjustTutorialRoll(rolled, dice.filter(d => d.zone === 'saved'), luck);
    const byId = new Map(adjusted.map(d => [d.id, d.value]));
    dice = dice.map(d => (d.zone === 'active' ? { ...d, value: byId.get(d.id)! } : d));
    const toSave = decideCPUSaves(dice);
    dice = dice.map(d => (toSave.includes(d.id) ? { ...d, zone: 'saved' } : d)) as Die[];
  }
  return scoreDice(saveSets(dice).filter(d => d.zone === 'saved')).total;
}

function runBattleTest() {
  // 'none' never lets the computer form a new set
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i++) {
    const rolled = Array.from({ length: 12 }, (_, k) => ({
      ...freshDice()[k],
      value: 1 + Math.floor(random() * 6),
    }));
    const out = adjustTutorialRoll(rolled, [], 'none');
    assert(Object.values(counts(out)).every(n => n <= 2), "'none' leaves no set of 3");
    const small = adjustTutorialRoll(rolled, [], 'small');
    assert(Object.values(counts(small)).filter(n => n >= 3).every(n => n === 3), "'small' allows at most sets of 3");
    assert(Object.values(counts(small)).filter(n => n >= 3).length <= 1, "'small' allows at most one set");
  }

  // Simulated tutorial battles to 250: the computer is never ahead after its turn
  let playerWins = 0;
  const games = 200;
  for (let g = 0; g < games; g++) {
    let player = 0;
    let cpu = 0;
    let rounds = 0;
    while (player < 250 && rounds < 30) {
      rounds++;
      player += playTurn('lucky', random);
      cpu += playTurn(cpu + 40 < player ? 'small' : 'none', random);
      assert(cpu < player || player === 0, `Computer never pulls ahead (game ${g}: ${cpu} vs ${player})`);
    }
    // Elimination round: one more turn each, lowest total is knocked out
    player += playTurn('lucky', random);
    cpu += playTurn(cpu + 40 < player ? 'small' : 'none', random);
    if (player > cpu) playerWins++;
  }
  assert(playerWins === games, `New player wins every tutorial battle (${playerWins}/${games})`);
  console.log(`✓ Tutorial battle: new player wins ${playerWins}/${games} simulated games after the elimination round`);
}

export function runTutorialTests() {
  runPracticeTest();
  runBattleTest();
}
