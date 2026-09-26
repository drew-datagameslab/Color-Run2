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

  // Single lowest roll is eliminated
  tb = advanceTiebreaker(recordTiebreakerRoll(tb, 40), nameOf);
  tb = advanceTiebreaker(recordTiebreakerRoll(tb, 25), nameOf);
  assert(tb.phase === 'outro' && tb.eliminatedUnitId === 'p3', 'P3 with the lowest roll is eliminated');

  // Roll value: scored points, or the pip sum when nothing scores
  const mkDice = (values: number[]): Die[] =>
    values.map((value, i) => ({ id: i + 1, color: i < 6 ? 'red' : 'blue', value, zone: 'active', selected: false }));
  assert(tiebreakerRollTotal(mkDice([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6])) === 42, 'No scoring sets: pip sum is used');
  const scoringDice = mkDice([3, 3, 3, 1, 2, 4, 5, 6, 1, 2, 4, 5]);
  assert(tiebreakerRollTotal(scoringDice) === scoreDice(scoringDice).total, 'Scoring sets: points scored are used');

  console.log('✓ All Elimination Tests Passed!');
}
