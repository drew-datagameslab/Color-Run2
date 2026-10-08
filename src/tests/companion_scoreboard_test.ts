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

  // Test Max 6 Red / 6 Blue dice limit validation
  const testDiceMaxLimit = (dice: Die[]): { hasColorLimitError: boolean; colorErrorMessage: string | null } => {
    const redDiceCount = dice.filter(d => d.color === 'red').length;
    const blueDiceCount = dice.filter(d => d.color === 'blue').length;
    const hasColorLimitError = redDiceCount > 6 || blueDiceCount > 6;

    let colorErrorMessage: string | null = null;
    if (redDiceCount > 6 && blueDiceCount > 6) {
      colorErrorMessage = `Too many dice! Max 6 red (${redDiceCount}/6) & 6 blue (${blueDiceCount}/6) allowed.`;
    } else if (redDiceCount > 6) {
      colorErrorMessage = `Too many red dice (${redDiceCount}/6)! Maximum 6 allowed.`;
    } else if (blueDiceCount > 6) {
      colorErrorMessage = `Too many blue dice (${blueDiceCount}/6)! Maximum 6 allowed.`;
    }

    return { hasColorLimitError, colorErrorMessage };
  };

  // Valid roll with 6 red and 6 blue dice (total 12)
  const fullLegal12: Die[] = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: i + 1, color: 'red' as const, value: 3, zone: 'saved' as const, selected: false })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: i + 7, color: 'blue' as const, value: 4, zone: 'saved' as const, selected: false })),
  ];
  const legalResult = testDiceMaxLimit(fullLegal12);
  assert.strictEqual(legalResult.hasColorLimitError, false);
  assert.strictEqual(legalResult.colorErrorMessage, null);

  // Illegal roll with 7 red dice
  const tooManyRed: Die[] = [
    ...Array.from({ length: 7 }, (_, i) => ({ id: i + 1, color: 'red' as const, value: 2, zone: 'saved' as const, selected: false })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: i + 8, color: 'blue' as const, value: 5, zone: 'saved' as const, selected: false })),
  ];
  const redExceededResult = testDiceMaxLimit(tooManyRed);
  assert.strictEqual(redExceededResult.hasColorLimitError, true);
  assert.ok(redExceededResult.colorErrorMessage?.includes('Too many red dice'));

  // Illegal roll with 8 blue dice
  const tooManyBlue: Die[] = [
    ...Array.from({ length: 2 }, (_, i) => ({ id: i + 1, color: 'red' as const, value: 1, zone: 'saved' as const, selected: false })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: i + 3, color: 'blue' as const, value: 6, zone: 'saved' as const, selected: false })),
  ];
  const blueExceededResult = testDiceMaxLimit(tooManyBlue);
  assert.strictEqual(blueExceededResult.hasColorLimitError, true);
  assert.ok(blueExceededResult.colorErrorMessage?.includes('Too many blue dice'));

  // Removing the extra die clears the error
  const correctedRed = tooManyRed.slice(1); // removes 1st red die, leaving 6 red and 3 blue
  const correctedResult = testDiceMaxLimit(correctedRed);
  assert.strictEqual(correctedResult.hasColorLimitError, false);
  assert.strictEqual(correctedResult.colorErrorMessage, null);

  console.log('✓ Companion Scoreboard 6-dice color limit validation tests passed!');
}
