import { runScoreTests } from './score_test';
import { runElimTests } from './elim_test';
import { runAdAndCodeTests } from './ad_code_test';

console.log('==========================================');
console.log('   COLOR RUN TEST SUITE VERIFICATION');
console.log('==========================================');

try {
  runScoreTests();
  runElimTests();
  runAdAndCodeTests();
  console.log('==========================================');
  console.log('   ALL TEST HARNESSES PASSED GREEN! ✓');
  console.log('==========================================');
} catch (err) {
  console.error('Test failed with error:', err);
  process.exit(1);
}
