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

  console.log('✓ All Elimination Tests Passed!');
}
