import assert from 'assert';
import { scoreDice } from '../lib/scoring';
import { Die } from '../types/game';

export function runCompanionScoreboardTests(): void {
  console.log('--- Running Companion Scoreboard Dice & Rules Tests ---');

  // Test the exact scenario from user's prompt:
  // "I just rolled three blue 5s and one red five and three red 6s and one blue 6.
  // I would press the blue 5 three times and the red 5 once. Then I would press the red 6 three times and the blue 6 once.
  // With each press, one die would appear in the saved dice area. The other dice in my sample roll could not be saved and would be ignored."
  const diceSample: Die[] = [
    // 3 blue 5s + 1 red 5 (total 4 5s)
    { id: 1, color: 'blue', value: 5, zone: 'saved', selected: false },
    { id: 2, color: 'blue', value: 5, zone: 'saved', selected: false },
    { id: 3, color: 'blue', value: 5, zone: 'saved', selected: false },
    { id: 4, color: 'red', value: 5, zone: 'saved', selected: false },
    // 3 red 6s + 1 blue 6 (total 4 6s)
    { id: 5, color: 'red', value: 6, zone: 'saved', selected: false },
    { id: 6, color: 'red', value: 6, zone: 'saved', selected: false },
    { id: 7, color: 'red', value: 6, zone: 'saved', selected: false },
    { id: 8, color: 'blue', value: 6, zone: 'saved', selected: false },
  ];

  const result = scoreDice(diceSample);

  // Set 5s: 4 dice * 5 = 20 base. 3 blue = +10 bonus, 1 red = 0. Total for 5s = 30 pts.
  // Set 6s: 4 dice * 5 = 20 base. 3 red = +10 bonus, 1 blue = 0. Total for 6s = 30 pts.
  // Combined score should be 60 pts.
  assert.strictEqual(result.total, 60, `Expected total 60 but got ${result.total}`);
  assert.strictEqual(result.sets.length, 2, 'Expected 2 sets (5s and 6s)');

  const set5 = result.sets.find(s => s.value === 5);
  assert.ok(set5, 'Set of 5s exists');
  assert.strictEqual(set5.count, 4);
  assert.strictEqual(set5.base, 20);
  assert.strictEqual(set5.cb, 10);

  const set6 = result.sets.find(s => s.value === 6);
  assert.ok(set6, 'Set of 6s exists');
  assert.strictEqual(set6.count, 4);
  assert.strictEqual(set6.base, 20);
  assert.strictEqual(set6.cb, 10);

  console.log('✓ Companion Scoreboard sample roll scoring verified (60 points)!');
}
