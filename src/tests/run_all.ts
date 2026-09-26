import { runScoreTests } from './score_test';
import { runElimTests } from './elim_test';
import { runTiebreakerScenarioTests } from './tiebreaker_scenario_test';
import { runAdAndCodeTests } from './ad_code_test';
import { runCompanionScoreboardTests } from './companion_scoreboard_test';

console.log('==========================================');
console.log('   COLOR RUN TEST SUITE VERIFICATION');
console.log('==========================================');

try {
  runScoreTests();
  runElimTests();
  runTiebreakerScenarioTests();
  runAdAndCodeTests();
  runCompanionScoreboardTests();
  console.log('==========================================');
  console.log('   ALL TEST HARNESSES PASSED GREEN! ✓');
  console.log('==========================================');
} catch (err) {
  console.error('Test failed with error:', err);
  process.exit(1);
}
