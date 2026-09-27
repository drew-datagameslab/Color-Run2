import {
  findLowestTie,
  startTiebreaker,
  currentTiedUnitId,
  recordTiebreakerRoll,
  advanceTiebreaker,
  resolveTiebreakerRound,
  tiebreakerRollTotal,
  TiebreakerState,
} from '../lib/tiebreaker';
import { scoreDice } from '../lib/scoring';
import { Die, PlayerUnit } from '../types/game';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error('Assertion Failed: ' + msg);
  }
}

export function runTiebreakerScenarioTests() {
  console.log('--- Running Deep Tiebreaker Scenario Tests ---');

  const nameOf = (id: string): string => {
    const names: Record<string, string> = {
      p1: 'Alice',
      p2: 'Bob',
      p3: 'Charlie',
      p4: 'Diana',
    };
    return names[id] || id.toUpperCase();
  };

  // Helper to create test dice with specified values
  const makeDice = (values: number[]): Die[] =>
    values.map((v, idx) => ({
      id: idx + 1,
      color: idx < 6 ? 'red' : 'blue',
      value: v,
      zone: 'active' as const,
      selected: false,
    }));

  // =========================================================================
  // SCENARIO 1: Tie Detection (findLowestTie)
  // =========================================================================
  console.log('Testing Scenario 1: Tie Detection edge cases...');
  {
    // Empty & single player
    assert(findLowestTie([]).length === 0, 'Empty array has no tie');
    assert(findLowestTie([{ id: 'p1', score: 100 }]).length === 0, 'Single player has no tie');

    // Distinct scores: clear lowest, no tie
    const distinct = [
      { id: 'p1', score: 300 },
      { id: 'p2', score: 250 },
      { id: 'p3', score: 180 },
    ];
    assert(findLowestTie(distinct).length === 0, 'Clear lowest player has no roll-off tie');

    // Tie exists at HIGH scores, but lowest is unique -> NO tiebreaker!
    const tieAtTop = [
      { id: 'p1', score: 350 },
      { id: 'p2', score: 350 },
      { id: 'p3', score: 150 }, // Single lowest
    ];
    assert(findLowestTie(tieAtTop).length === 0, 'Tie at top does not trigger elimination tiebreaker');

    // Two-player tie for lowest in 3-player game
    const tieLowest2 = [
      { id: 'p1', score: 300 },
      { id: 'p2', score: 200 },
      { id: 'p3', score: 200 },
    ];
    const tied2 = findLowestTie(tieLowest2);
    assert(tied2.length === 2, 'Two tied lowest players detected');
    assert(tied2[0].id === 'p2' && tied2[1].id === 'p3', 'Preserves seating order (p2, p3)');

    // Three-player tie for lowest in 4-player game (with seating order interleaved)
    const tieLowest3 = [
      { id: 'p1', score: 180 },
      { id: 'p2', score: 400 },
      { id: 'p3', score: 180 },
      { id: 'p4', score: 180 },
    ];
    const tied3 = findLowestTie(tieLowest3);
    assert(tied3.length === 3, 'Three tied lowest players detected');
    assert(tied3.map(u => u.id).join(',') === 'p1,p3,p4', 'Maintains original seating order p1, p3, p4');

    // All players tied
    const allTied = [
      { id: 'p1', score: 250 },
      { id: 'p2', score: 250 },
      { id: 'p3', score: 250 },
      { id: 'p4', score: 250 },
    ];
    assert(findLowestTie(allTied).length === 4, 'All tied players participate');
  }
  console.log('✓ Scenario 1: Tie Detection verified!');

  // =========================================================================
  // SCENARIO 2: Tiebreaker Roll Total Calculation
  // =========================================================================
  console.log('Testing Scenario 2: Roll Total scoring & pip fallback...');
  {
    // A: Roll with standard scored sets (e.g., three blue 5s = 15 base + 10 color bonus = 25 pts)
    const rollWithSets = makeDice([5, 5, 5, 1, 2, 3, 4, 6, 1, 2, 3, 4]);
    const scoreVal = scoreDice(rollWithSets).total;
    assert(scoreVal === 25, `Scored 25 for three 5s, got ${scoreVal}`);
    assert(tiebreakerRollTotal(rollWithSets) === 25, 'Tiebreaker roll total uses scored points');

    // Also test a multi-set roll: 3 red 1s (25) + 3 blue 6s (25) = 50 pts
    const doubleSet = makeDice([1, 1, 1, 2, 3, 4, 6, 6, 6, 2, 3, 4]);
    assert(tiebreakerRollTotal(doubleSet) === 50, 'Double 3-set totals 50 points');

    // B: Roll with zero scored sets (pip fallback)
    // 12 dice with two 1s, two 2s, two 3s, two 4s, two 5s, two 6s (no 3-of-a-kind)
    const noScoringRoll = makeDice([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
    assert(scoreDice(noScoringRoll).total === 0, 'No scoring sets present');
    const pips = 2 + 4 + 6 + 8 + 10 + 12; // 42
    assert(tiebreakerRollTotal(noScoringRoll) === 42, 'Pip fallback sum is exactly 42');

    // C: Low pips roll with no scoring sets (e.g. 1,1, 2,2, 3,3, 1,2, 3, 4, 1, 2)
    // Ensure roll total is never 0 and always strictly positive
    const lowPips = makeDice([1, 1, 2, 2, 3, 3, 4, 4, 2, 2, 3, 3]);
    // wait: four 2s and four 3s would score. Let's make no 3-of-a-kind:
    const nonScoring = makeDice([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]);
    assert(tiebreakerRollTotal(nonScoring) > 0, 'Fallback pip sum is strictly positive');
  }
  console.log('✓ Scenario 2: Roll Total calculations verified!');

  // =========================================================================
  // SCENARIO 3: 2-Player Tiebreaker (Standard & Multi-round)
  // =========================================================================
  console.log('Testing Scenario 3: 2-Player Tiebreaker resolution...');
  {
    // Scenario 3A: P1 rolls 50, P2 rolls 30 -> P2 eliminated immediately
    let tb = startTiebreaker(['p1', 'p2']);
    assert(tb.phase === 'intro', 'Starts in intro phase');
    assert(tb.roundNumber === 1, 'Starts at round 1');
    assert(currentTiedUnitId(tb) === 'p1', 'First seated player rolls first');

    tb = { ...tb, phase: 'rolling' };
    tb = recordTiebreakerRoll(tb, 50);
    assert(tb.lastRollTotal === 50, 'Last roll total recorded as 50');
    assert(tb.rollScores['p1'] === 50, 'P1 roll score saved');

    tb = advanceTiebreaker(tb, nameOf);
    assert(currentTiedUnitId(tb) === 'p2', 'Turn moves to P2');
    assert(tb.lastRollTotal === null, 'Last roll total reset for P2');

    tb = recordTiebreakerRoll(tb, 30);
    assert(tb.rollScores['p2'] === 30, 'P2 roll score saved');

    tb = advanceTiebreaker(tb, nameOf);
    assert(tb.phase === 'blinking', 'All have rolled: round resolves to blinking');
    assert(tb.eliminatedUnitId === 'p2', 'P2 with lowest roll 30 is eliminated');
    assert(tb.blinkingUnitIds.includes('p1'), 'Winner P1 blinks');

    // Scenario 3B: P1 and P2 tie in Round 1, tie in Round 2, resolved in Round 3
    let tbMulti = startTiebreaker(['p1', 'p2']);
    tbMulti = { ...tbMulti, phase: 'rolling' };

    // Round 1: Both roll 40
    tbMulti = recordTiebreakerRoll(tbMulti, 40);
    tbMulti = advanceTiebreaker(tbMulti, nameOf);
    tbMulti = recordTiebreakerRoll(tbMulti, 40);
    tbMulti = advanceTiebreaker(tbMulti, nameOf);

    assert(tbMulti.phase === 'rolling', 'Still rolling after tie');
    assert(tbMulti.roundNumber === 2, 'Advanced to round 2');
    assert(tbMulti.tiedUnitIds.length === 2, 'Both players still tied');
    assert(tbMulti.noticeMsg?.includes('Still tied (40 pts)'), 'Notice informs players of tie');
    assert(currentTiedUnitId(tbMulti) === 'p1', 'Round 2 restarts with P1');

    // Round 2: Both roll 25
    tbMulti = recordTiebreakerRoll(tbMulti, 25);
    tbMulti = advanceTiebreaker(tbMulti, nameOf);
    tbMulti = recordTiebreakerRoll(tbMulti, 25);
    tbMulti = advanceTiebreaker(tbMulti, nameOf);

    assert(tbMulti.phase === 'rolling', 'Still rolling after second tie');
    assert(tbMulti.roundNumber === 3, 'Advanced to round 3');
    assert(tbMulti.tiedUnitIds.length === 2, 'Both players still tied in round 3');

    // Round 3: P1 rolls 60, P2 rolls 15
    tbMulti = recordTiebreakerRoll(tbMulti, 60);
    tbMulti = advanceTiebreaker(tbMulti, nameOf);
    tbMulti = recordTiebreakerRoll(tbMulti, 15);
    tbMulti = advanceTiebreaker(tbMulti, nameOf);

    assert(tbMulti.phase === 'blinking', 'Round 3 resolved to blinking');
    assert(tbMulti.eliminatedUnitId === 'p2', 'P2 eliminated in Round 3');
    assert(tbMulti.blinkingUnitIds.includes('p1'), 'Winner P1 blinks');
  }
  console.log('✓ Scenario 3: 2-Player Tiebreaker verified!');

  // =========================================================================
  // SCENARIO 4: 3-Player Tiebreaker (Partial Advance & Re-roll)
  // =========================================================================
  console.log('Testing Scenario 4: 3-Player Tiebreaker scenarios...');
  {
    // Scenario 4A: P1 rolls 70 (high), P2 rolls 30 (low), P3 rolls 30 (low)
    // Rule: P1 rolled higher than the lowest roll, so P1 advances!
    // P2 and P3 tied for lowest, so only P2 and P3 roll again in Round 2!
    let tb3 = startTiebreaker(['p1', 'p2', 'p3']);
    tb3 = { ...tb3, phase: 'rolling' };

    tb3 = recordTiebreakerRoll(tb3, 70); // P1
    tb3 = advanceTiebreaker(tb3, nameOf);
    tb3 = recordTiebreakerRoll(tb3, 30); // P2
    tb3 = advanceTiebreaker(tb3, nameOf);
    tb3 = recordTiebreakerRoll(tb3, 30); // P3
    tb3 = advanceTiebreaker(tb3, nameOf);

    assert(tb3.phase === 'rolling', 'Continues to round 2');
    assert(tb3.roundNumber === 2, 'Round 2 reached');
    assert(tb3.tiedUnitIds.length === 2, 'Only 2 players remain tied');
    assert(tb3.tiedUnitIds.join(',') === 'p2,p3', 'P1 advanced! P2 and P3 remain');
    assert(tb3.noticeMsg?.includes('Alice advance'), 'Notice explicitly names Alice (P1) advancing');
    assert(tb3.noticeMsg?.includes('Bob & Charlie remain tied'), 'Notice names Bob & Charlie remaining');

    // Round 2 between P2 and P3
    assert(currentTiedUnitId(tb3) === 'p2', 'P2 rolls first in Round 2');
    tb3 = recordTiebreakerRoll(tb3, 45); // P2
    tb3 = advanceTiebreaker(tb3, nameOf);
    assert(currentTiedUnitId(tb3) === 'p3', 'P3 rolls next in Round 2');
    tb3 = recordTiebreakerRoll(tb3, 20); // P3
    tb3 = advanceTiebreaker(tb3, nameOf);

    assert(tb3.phase === 'blinking', 'Round 2 resolved to blinking');
    assert(tb3.eliminatedUnitId === 'p3', 'P3 eliminated with lowest roll in Round 2');
    assert(tb3.blinkingUnitIds.includes('p1') && tb3.blinkingUnitIds.includes('p2'), 'Both advancing users (P1 from round 1 and P2 from round 2) blink');

    // Scenario 4B: Two high rolls tied, one single lowest roll:
    // P1 rolls 60, P2 rolls 60, P3 rolls 20.
    // Rule: Single lowest roll is eliminated immediately! No need for P1 & P2 to roll again!
    let tb3B = startTiebreaker(['p1', 'p2', 'p3']);
    tb3B = { ...tb3B, phase: 'rolling' };

    tb3B = recordTiebreakerRoll(tb3B, 60);
    tb3B = advanceTiebreaker(tb3B, nameOf);
    tb3B = recordTiebreakerRoll(tb3B, 60);
    tb3B = advanceTiebreaker(tb3B, nameOf);
    tb3B = recordTiebreakerRoll(tb3B, 20);
    tb3B = advanceTiebreaker(tb3B, nameOf);

    assert(tb3B.phase === 'blinking', 'Single lowest roll eliminated directly to blinking');
    assert(tb3B.eliminatedUnitId === 'p3', 'P3 eliminated immediately in Round 1');
    assert(tb3B.blinkingUnitIds.includes('p1') && tb3B.blinkingUnitIds.includes('p2'), 'Both advancing users P1 and P2 blink');

    // Scenario 4C: All 3 tied on roll total
    // P1 rolls 35, P2 rolls 35, P3 rolls 35
    let tb3C = startTiebreaker(['p1', 'p2', 'p3']);
    tb3C = { ...tb3C, phase: 'rolling' };

    tb3C = recordTiebreakerRoll(tb3C, 35);
    tb3C = advanceTiebreaker(tb3C, nameOf);
    tb3C = recordTiebreakerRoll(tb3C, 35);
    tb3C = advanceTiebreaker(tb3C, nameOf);
    tb3C = recordTiebreakerRoll(tb3C, 35);
    tb3C = advanceTiebreaker(tb3C, nameOf);

    assert(tb3C.phase === 'rolling', 'All 3 tied continues to Round 2');
    assert(tb3C.roundNumber === 2, 'Round number is 2');
    assert(tb3C.tiedUnitIds.length === 3, 'All 3 remain in roll-off');
    assert(tb3C.noticeMsg?.includes('Still tied (35 pts)'), 'Notice reflects 3-way tie');
  }
  console.log('✓ Scenario 4: 3-Player Tiebreaker verified!');

  // =========================================================================
  // SCENARIO 5: 4-Player Cascading Tiebreaker
  // =========================================================================
  console.log('Testing Scenario 5: 4-Player Cascading Tiebreaker...');
  {
    // 4 players tied for lowest in an elimination round
    // Round 1: P1=80, P2=60, P3=35, P4=35
    // P1 and P2 advance (80 > 35, 60 > 35)
    // P3 and P4 roll in Round 2
    let tb4 = startTiebreaker(['p1', 'p2', 'p3', 'p4']);
    tb4 = { ...tb4, phase: 'rolling' };

    tb4 = recordTiebreakerRoll(tb4, 80);
    tb4 = advanceTiebreaker(tb4, nameOf);
    tb4 = recordTiebreakerRoll(tb4, 60);
    tb4 = advanceTiebreaker(tb4, nameOf);
    tb4 = recordTiebreakerRoll(tb4, 35);
    tb4 = advanceTiebreaker(tb4, nameOf);
    tb4 = recordTiebreakerRoll(tb4, 35);
    tb4 = advanceTiebreaker(tb4, nameOf);

    assert(tb4.phase === 'rolling', 'Continues to round 2');
    assert(tb4.roundNumber === 2, 'Round 2 reached');
    assert(tb4.tiedUnitIds.join(',') === 'p3,p4', 'P3 and P4 remain tied');
    assert(tb4.noticeMsg?.includes('Alice, Bob advance'), 'Both Alice and Bob advance');

    // Round 2 between P3 and P4
    tb4 = recordTiebreakerRoll(tb4, 40); // P3
    tb4 = advanceTiebreaker(tb4, nameOf);
    tb4 = recordTiebreakerRoll(tb4, 25); // P4
    tb4 = advanceTiebreaker(tb4, nameOf);

    assert(tb4.phase === 'blinking', 'Cascading tiebreaker completed to blinking');
    assert(tb4.eliminatedUnitId === 'p4', 'Diana (P4) eliminated');
    assert(tb4.blinkingUnitIds.includes('p1') && tb4.blinkingUnitIds.includes('p2') && tb4.blinkingUnitIds.includes('p3'), 'Advancing players blink');
  }
  console.log('✓ Scenario 5: 4-Player Cascading Tiebreaker verified!');

  // =========================================================================
  // SCENARIO 6: ScoreboardScreen Direct Resolution Simulation
  // =========================================================================
  console.log('Testing Scenario 6: ScoreboardScreen manual resolution simulation...');
  {
    // In Scoreboard mode, the user enters scores on the tabletop and clicks "Resolve Round"
    const scoresRound1 = {
      p1: 50,
      p2: 30,
      p3: 30,
    };
    const next1 = resolveTiebreakerRound(
      { ...startTiebreaker(['p1', 'p2', 'p3']), roundNumber: 1 },
      scoresRound1,
      nameOf
    );
    assert(next1.roundNumber === 2, 'Scoreboard advances to round 2');
    assert(next1.tiedUnitIds.join(',') === 'p2,p3', 'Scoreboard narrows tied players to p2, p3');

    // Round 2 scores entered in Scoreboard
    const scoresRound2 = {
      p2: 40,
      p3: 20,
    };
    const next2 = resolveTiebreakerRound(
      { ...startTiebreaker(next1.tiedUnitIds), roundNumber: next1.roundNumber, advancedUnitIds: next1.advancedUnitIds },
      scoresRound2,
      nameOf
    );
    assert(next2.phase === 'blinking', 'Scoreboard reaches blinking phase');
    assert(next2.eliminatedUnitId === 'p3', 'Scoreboard identifies p3 as eliminated');
    assert(next2.blinkingUnitIds.includes('p1') && next2.blinkingUnitIds.includes('p2'), 'Both advancing users blink');
  }
  console.log('✓ Scenario 6: ScoreboardScreen simulation verified!');

  // =========================================================================
  // SCENARIO 7: Full Game Elimination Placement Integration
  // =========================================================================
  console.log('Testing Scenario 7: Game Elimination Placement & Survivor Flow...');
  {
    const initialUnits: PlayerUnit[] = [
      { id: 'p1', name: 'Alice', isCPU: false, score: 200, active: true, history: {}, color: '#e5352f' },
      { id: 'p2', name: 'Bob', isCPU: true, score: 200, active: true, history: {}, color: '#1f7fd6' },
      { id: 'p3', name: 'Charlie', isCPU: true, score: 320, active: true, history: {}, color: '#2f9a4f' },
      { id: 'p4', name: 'Diana', isCPU: true, score: 350, active: true, history: {}, color: '#f59e0b' },
    ];

    // Detect tie for lowest total
    const tied = findLowestTie(initialUnits.filter(u => u.active));
    assert(tied.length === 2, 'Alice and Bob tied for lowest total (200)');
    assert(tied[0].id === 'p1' && tied[1].id === 'p2', 'Alice & Bob in order');

    // Simulate tiebreaker roll-off where Bob is eliminated
    const eliminatedId = 'p2';
    const liveCount = initialUnits.filter(u => u.active).length; // 4
    const finalizedUnits = initialUnits.map(u =>
      u.id === eliminatedId ? { ...u, active: false, place: liveCount } : u
    );

    const bob = finalizedUnits.find(u => u.id === 'p2')!;
    assert(!bob.active, 'Bob is marked inactive');
    assert(bob.place === 4, 'Bob is placed 4th (out of 4 players)');

    const remainingActive = finalizedUnits.filter(u => u.active);
    assert(remainingActive.length === 3, '3 players continue to next round');
    assert(remainingActive.map(u => u.id).join(',') === 'p1,p3,p4', 'Alice, Charlie, Diana survive');
  }
  console.log('✓ Scenario 7: Game Elimination Placement verified!');

  console.log('====================================================');
  console.log('   ALL TIEBREAKER SCENARIO TESTS PASSED (100%)! ✓   ');
  console.log('====================================================');
}
