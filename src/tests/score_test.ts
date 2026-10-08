import { bonusFor, scoreDice } from '../lib/scoring';
import { Die } from '../types/game';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error('Assertion Failed: ' + msg);
  }
}

export function runScoreTests() {
  console.log('Running Score Tests...');

  // Test 1: Bonus tier mapping
  assert(bonusFor(2) === 0, 'bonusFor(2) must be 0');
  assert(bonusFor(3) === 10, 'bonusFor(3) must be 10');
  assert(bonusFor(4) === 25, 'bonusFor(4) must be 25');
  assert(bonusFor(5) === 40, 'bonusFor(5) must be 40');
  assert(bonusFor(6) === 100, 'bonusFor(6) must be 100');
  assert(bonusFor(7) === 100, 'bonusFor(7) must be 100');

  // Test 2: Set under 3 dice gives 0
  const underThree: Die[] = [
    { id: 1, color: 'blue', value: 2, zone: 'saved', selected: false },
    { id: 2, color: 'red', value: 2, zone: 'saved', selected: false },
  ];
  assert(scoreDice(underThree).total === 0, 'Fewer than 3 dice must score 0');

  // Test 3: 3 blue 2s => base 15 + bonus 10 = 25
  const threeBlue: Die[] = [
    { id: 1, color: 'blue', value: 2, zone: 'saved', selected: false },
    { id: 2, color: 'blue', value: 2, zone: 'saved', selected: false },
    { id: 3, color: 'blue', value: 2, zone: 'saved', selected: false },
  ];
  const res3Blue = scoreDice(threeBlue);
  assert(res3Blue.total === 25, `3 blue 2s should be 25, got ${res3Blue.total}`);

  // Test 4: Confirmed rule example 1:
  // "3 blue plus 3 red 2s scores 50 points."
  // 6 dice * 5 = 30 base + 10 (3 blue) + 10 (3 red) = 50.
  const example1: Die[] = [
    { id: 1, color: 'blue', value: 2, zone: 'saved', selected: false },
    { id: 2, color: 'blue', value: 2, zone: 'saved', selected: false },
    { id: 3, color: 'blue', value: 2, zone: 'saved', selected: false },
    { id: 4, color: 'red', value: 2, zone: 'saved', selected: false },
    { id: 5, color: 'red', value: 2, zone: 'saved', selected: false },
    { id: 6, color: 'red', value: 2, zone: 'saved', selected: false },
  ];
  const resEx1 = scoreDice(example1);
  assert(resEx1.total === 50, `3 blue + 3 red 2s must score 50, got ${resEx1.total}`);

  // Test 5: Confirmed rule example 2:
  // "4 blue plus 3 red 2s scores 70 points."
  // 7 dice * 5 = 35 base + 25 (4 blue) + 10 (3 red) = 70.
  const example2: Die[] = [
    { id: 1, color: 'blue', value: 2, zone: 'saved', selected: false },
    { id: 2, color: 'blue', value: 2, zone: 'saved', selected: false },
    { id: 3, color: 'blue', value: 2, zone: 'saved', selected: false },
    { id: 4, color: 'blue', value: 2, zone: 'saved', selected: false },
    { id: 5, color: 'red', value: 2, zone: 'saved', selected: false },
    { id: 6, color: 'red', value: 2, zone: 'saved', selected: false },
    { id: 7, color: 'red', value: 2, zone: 'saved', selected: false },
  ];
  const resEx2 = scoreDice(example2);
  assert(resEx2.total === 70, `4 blue + 3 red 2s must score 70, got ${resEx2.total}`);

  // Test 6: Multiple independent sets (e.g. 3 ones and 3 sixes)
  const multiSet: Die[] = [
    { id: 1, color: 'blue', value: 1, zone: 'saved', selected: false },
    { id: 2, color: 'blue', value: 1, zone: 'saved', selected: false },
    { id: 3, color: 'blue', value: 1, zone: 'saved', selected: false },
    { id: 4, color: 'red', value: 6, zone: 'saved', selected: false },
    { id: 5, color: 'red', value: 6, zone: 'saved', selected: false },
    { id: 6, color: 'red', value: 6, zone: 'saved', selected: false },
  ];
  const resMulti = scoreDice(multiSet);
  assert(resMulti.sets.length === 2, 'Should have 2 sets');
  assert(resMulti.total === 50, `Two 3-sets should total 50, got ${resMulti.total}`);

  console.log('✓ All Score Tests Passed!');
}
