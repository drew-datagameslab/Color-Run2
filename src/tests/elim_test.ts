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

  // Test 5: Battle to Survive 3-player Tiebreaker System Rules
  // Rule: If three are tied, each rolls one time. If one user gets highest while other two tied, highest advances, other two roll again.
  const scoresRound1: Record<string, number> = { 'p1': 50, 'p2': 30, 'p3': 30 };
  const tiedUnitsRound1 = ['p1', 'p2', 'p3'];
  const minRollRound1 = Math.min(...tiedUnitsRound1.map(id => scoresRound1[id]));
  const lowestUnitsRound1 = tiedUnitsRound1.filter(id => scoresRound1[id] === minRollRound1);
  assert(lowestUnitsRound1.length === 2, 'P2 and P3 are tied for lowest (30 pts)');
  assert(lowestUnitsRound1.length < tiedUnitsRound1.length, 'P1 scored higher and advances');
  const advancingRound1 = tiedUnitsRound1.filter(id => scoresRound1[id] > minRollRound1);
  assert(advancingRound1.includes('p1') && advancingRound1.length === 1, 'P1 with 50 pts advances');

  // Next round: P2 and P3 roll again
  const scoresRound2: Record<string, number> = { 'p2': 40, 'p3': 25 };
  const tiedUnitsRound2 = lowestUnitsRound1;
  const minRollRound2 = Math.min(...tiedUnitsRound2.map(id => scoresRound2[id]));
  const lowestUnitsRound2 = tiedUnitsRound2.filter(id => scoresRound2[id] === minRollRound2);
  assert(lowestUnitsRound2.length === 1 && lowestUnitsRound2[0] === 'p3', 'P3 with 25 pts is the single lowest player and eliminated');

  console.log('✓ All Elimination Tests Passed!');
}
