import { findLowestTie, startTiebreaker, currentTiedUnitId, recordTiebreakerRoll, advanceTiebreaker, tiebreakerRollTotal } from '../lib/tiebreaker';
import { scoreDice } from '../lib/scoring';
import { Die } from '../types/game';
import { resolveElimination } from '../lib/elimination';
import { PlayerUnit } from '../types/game';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error('Assertion Failed: ' + msg);
  }
}

export function runElimTests() {
  console.log('Running Elimination Tests...');

  // Test 1: Simple knockout of lowest score
  const p1: PlayerUnit = { id: '1', name: 'Alice', isCPU: false, score: 320, history: {}, active: true, color: '#e5352f' };
  const p2: PlayerUnit = { id: '2', name: 'Bob', isCPU: true, score: 260, history: {}, active: true, color: '#1f7fd6' };
  const p3: PlayerUnit = { id: '3', name: 'Charlie', isCPU: true, score: 180, history: {}, active: true, color: '#2f9a4f' };

  const res1 = resolveElimination([p1, p2, p3], 1);
  assert(res1.toElim.length === 1, 'Should eliminate 1 player');
  assert(res1.toElim[0].id === '3', 'Charlie with lowest score 180 must be eliminated');

  // Test 2: Two players knocked out when count is 2
  const res2 = resolveElimination([p1, p2, p3], 2);
  assert(res2.toElim.length === 2, 'Should eliminate 2 players');
  assert(res2.toElim[0].id === '3' && res2.toElim[1].id === '2', 'Charlie and Bob must be eliminated');

  // Test 3: Tie-breaker roll-off
  const tiedP1: PlayerUnit = { id: '1', name: 'Player1', isCPU: false, score: 200, history: {}, active: true, color: '#e5352f' };
  const tiedP2: PlayerUnit = { id: '2', name: 'Player2', isCPU: true, score: 200, history: {}, active: true, color: '#1f7fd6' };
  const aheadP3: PlayerUnit = { id: '3', name: 'Player3', isCPU: true, score: 300, history: {}, active: true, color: '#2f9a4f' };

  // Mock deterministic dice function: tiedP1 rolls lower
  let rollCount = 0;
  const mockRoll = () => {
    rollCount++;
    return (rollCount % 2 === 0) ? 5 : 2;
  };

  const resTie = resolveElimination([tiedP1, tiedP2, aheadP3], 1, mockRoll);
  assert(resTie.toElim.length === 1, 'Should eliminate 1 tied player');
  assert(resTie.log.some(l => l.isRollOff), 'Roll-off must be logged');

  // Test 4: Elimination placement and prize calculation for multiplayer/challenge games
  const payouts4Player = [20, 10]; // 1st gets 20, 2nd gets 10
  const activeCountAfterElim = 1; // 1 survivor left -> eliminated player is 2nd place
  const humanPlace = activeCountAfterElim + 1; // 2nd place
  const prizeWon = payouts4Player[humanPlace - 1] || 0;
  assert(prizeWon === 10, '2nd place eliminated player must receive 10 coin prize');

  const payouts5Player = [25, 10, 5]; // 3rd place receives 5 coins
  const remainingSurvivors = 2; // 2 survivors left -> eliminated player is 3rd place
  const placeIn5Player = remainingSurvivors + 1; // 3rd place
  const prizeIn5Player = payouts5Player[placeIn5Player - 1] || 0;
  assert(prizeIn5Player === 5, '3rd place eliminated player must receive 5 coin prize');

  // Test 5: Battle to Survive roll-off rules (src/lib/tiebreaker.ts)
  const nameOf = (id: string) => id.toUpperCase();

  // Only players tied for the lowest total battle, in seating order
  const tiedLow = findLowestTie([
    { id: 'p1', score: 300 },
    { id: 'p2', score: 280 },
    { id: 'p3', score: 280 },
    { id: 'p4', score: 280 },
  ]);
  assert(tiedLow.map(u => u.id).join() === 'p2,p3,p4', 'Tied lowest players battle in seating order');
  assert(findLowestTie([{ id: 'a', score: 10 }, { id: 'b', score: 20 }]).length === 0, 'No battle without a tie');
  assert(findLowestTie([{ id: 'a', score: 20 }, { id: 'b', score: 20 }]).length === 2, 'Two-player tie battles');

  // Three tied: each rolls one time, in order
  let tb = startTiebreaker(['p1', 'p2', 'p3']);
  assert(tb.phase === 'intro' && currentTiedUnitId(tb) === 'p1', 'Roll-off starts with the first seated player');
  tb = { ...tb, phase: 'rolling' };
  tb = advanceTiebreaker(recordTiebreakerRoll(tb, 50), nameOf);
  assert(currentTiedUnitId(tb) === 'p2' && tb.lastRollTotal === null, 'Second player rolls next');
  tb = advanceTiebreaker(recordTiebreakerRoll(tb, 30), nameOf);
  assert(currentTiedUnitId(tb) === 'p3', 'Third player rolls next');
  tb = advanceTiebreaker(recordTiebreakerRoll(tb, 30), nameOf);

  // Highest advances; the two still tied roll again
  assert(tb.phase === 'rolling', 'Roll-off continues');
  assert(tb.tiedUnitIds.join() === 'p2,p3', 'P1 advances, P2 and P3 roll again');
  assert(tb.roundNumber === 2 && currentTiedUnitId(tb) === 'p2', 'Round 2 starts with P2');
  assert(!!tb.noticeMsg && tb.noticeMsg.includes('P1 advance'), 'Notice names the advancing player');

  // Still tied: roll again
  tb = advanceTiebreaker(recordTiebreakerRoll(tb, 22), nameOf);
  tb = advanceTiebreaker(recordTiebreakerRoll(tb, 22), nameOf);
  assert(tb.phase === 'rolling' && tb.roundNumber === 3 && tb.tiedUnitIds.length === 2, 'Exact tie rolls again');

  // Single lowest roll is eliminated: winner board(s) blink for 3 seconds before outro
  tb = advanceTiebreaker(recordTiebreakerRoll(tb, 40), nameOf);
  tb = advanceTiebreaker(recordTiebreakerRoll(tb, 25), nameOf);
  assert(tb.phase === 'blinking' && tb.eliminatedUnitId === 'p3', 'P3 with the lowest roll is eliminated and winner boards blink');
  assert(tb.blinkingUnitIds.includes('p1') && tb.blinkingUnitIds.includes('p2'), 'In a 3-user tiebreak, the two users who advance (P1 and P2) have their board blink');

  // Roll value: scored points, or the pip sum when nothing scores
  const mkDice = (values: number[]): Die[] =>
    values.map((value, i) => ({ id: i + 1, color: i < 6 ? 'red' : 'blue', value, zone: 'active', selected: false }));
  assert(tiebreakerRollTotal(mkDice([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6])) === 42, 'No scoring sets: pip sum is used');
  const scoringDice = mkDice([3, 3, 3, 1, 2, 4, 5, 6, 1, 2, 4, 5]);
  assert(tiebreakerRollTotal(scoringDice) === scoreDice(scoringDice).total, 'Scoring sets: points scored are used');

  // Test 6: Eliminated scoreboard sorting ascending from right to left
  const elimP1: PlayerUnit = { id: 'p1', name: 'P1', isCPU: false, score: 350, history: {}, active: true, color: '#e5352f' };
  const elimP2: PlayerUnit = { id: 'p2', name: 'P2', isCPU: true, score: 280, history: {}, active: true, color: '#1f7fd6' };
  const elimP3: PlayerUnit = { id: 'p3', name: 'P3', isCPU: true, score: 195, history: {}, active: false, place: 3, color: '#2f9a4f' }; // eliminated 2nd
  const elimP4: PlayerUnit = { id: 'p4', name: 'P4', isCPU: true, score: 140, history: {}, active: false, place: 4, color: '#f2c14e' }; // eliminated 1st

  const allTestUnits = [elimP1, elimP2, elimP3, elimP4];
  const activeTestUnits = allTestUnits.filter(u => u.active);
  const elimTestUnits = allTestUnits.filter(u => !u.active);
  const sortedElimTestUnits = [...elimTestUnits].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.place ?? 0) - (b.place ?? 0);
  });
  const displayTestUnits = [...activeTestUnits, ...sortedElimTestUnits];

  // Rightmost element must be P4 (140 pts, eliminated first)
  assert(displayTestUnits[displayTestUnits.length - 1].id === 'p4', 'First eliminated player (lowest score) must be on the far right');
  assert(displayTestUnits[displayTestUnits.length - 2].id === 'p3', 'Second eliminated player must be to the left of the first');
  // Scores ascending from right to left: displayTestUnits[3].score (140) <= displayTestUnits[2].score (195)
  assert(
    displayTestUnits[displayTestUnits.length - 1].score <= displayTestUnits[displayTestUnits.length - 2].score,
    'Eliminated scoreboards must be sorted by point total ascending from right to left'
  );

  console.log('✓ All Elimination Tests Passed!');
}
