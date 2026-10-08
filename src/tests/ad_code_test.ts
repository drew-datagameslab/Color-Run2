import {
  verifyHomeGameCode,
  redeemHomeGameCode,
  setAdFree,
  getInitialUser,
  removeAdFreeAutomaticCharge,
  resumeAdFreeAutomaticCharge,
} from '../lib/storage';
import { computeNextBillingDate } from '../lib/billing';
import { UserAccount } from '../types/game';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runAdAndCodeTests() {
  console.log('\n--- Running Ad & Home Game Code Verification Tests ---');

  // Test 1: Code verification checks
  assert(verifyHomeGameCode('CR-TEST-TEST') === true, 'CR-TEST-TEST should be recognized');
  assert(verifyHomeGameCode('cr-test-test') === true, 'Case-insensitive test code should pass');
  assert(verifyHomeGameCode('COLORRUN') === true, 'COLORRUN should be valid');
  assert(verifyHomeGameCode('HOMEGAME') === true, 'HOMEGAME should be valid');
  assert(verifyHomeGameCode('CR-ABCD-1234') === true, 'Standard CR-XXXX-XXXX format should pass');
  assert(verifyHomeGameCode('CR-9876') === true, 'Standard CR-XXXX format should pass');

  assert(verifyHomeGameCode('INVALID-CODE') === false, 'Bogus code should fail');
  assert(verifyHomeGameCode('') === false, 'Empty code should fail');
  assert(verifyHomeGameCode('12345') === false, 'Unformatted number should fail');
  console.log('✓ Code verification patterns passed!');

  // Test 2: Initial user state
  const mockUser: UserAccount = {
    uid: 'test_user_1',
    name: 'Test',
    email: null,
    provider: 'guest',
    avatar: { color: '#e5352f', name: 'P1' },
    scoreboardUnlocked: false,
    isAdFree: false,
  };
  assert(mockUser.isAdFree === false, 'Initial user should have ads enabled');
  assert(mockUser.scoreboardUnlocked === false, 'Initial user should have scoreboard locked');

  // Test 3: Redemption of Home Game Code
  const result = redeemHomeGameCode(mockUser, 'CR-TEST-TEST');
  assert(result.success === true, 'Redemption should succeed');
  assert(result.user.isAdFree === true, 'Redeemed user should be ad-free');
  assert(result.user.scoreboardUnlocked === true, 'Redeemed user should have scoreboard unlocked');
  console.log('✓ Home game code redemption passed!');

  // Test 4: "Go Ad Free" purchase
  const adFreeUser = setAdFree(mockUser, true);
  assert(adFreeUser.isAdFree === true, 'setAdFree should mark user ad-free');
  console.log('✓ In-store Ad-Free purchase passed!');

  // Test 5: Recurring billing calculation rules
  // Example 1: August 31 sign up -> September 30 (monthly)
  const aug31 = new Date(2026, 7, 31, 12, 0, 0); // Month 7 is August
  const nextMonthlyFromAug31 = computeNextBillingDate(aug31, 'monthly');
  assert(nextMonthlyFromAug31.getFullYear() === 2026, 'Year should be 2026');
  assert(nextMonthlyFromAug31.getMonth() === 8, 'Month should be September (8)');
  assert(nextMonthlyFromAug31.getDate() === 30, 'Date should clamp to 30th of September');

  // Example 2: August 31, 2026 sign up -> August 31, 2027 (yearly)
  const nextYearlyFromAug31 = computeNextBillingDate(aug31, 'yearly');
  assert(nextYearlyFromAug31.getFullYear() === 2027, 'Year should be 2027');
  assert(nextYearlyFromAug31.getMonth() === 7, 'Month should be August (7)');
  assert(nextYearlyFromAug31.getDate() === 31, 'Date should be 31st of August');

  // Example 3: Current date test (Sept 14 -> Oct 14 / Sept 14 next year)
  const sept14 = new Date(2026, 8, 14, 12, 0, 0);
  const nextMonthlySept14 = computeNextBillingDate(sept14, 'monthly');
  assert(nextMonthlySept14.getMonth() === 9 && nextMonthlySept14.getDate() === 14, 'Sept 14 monthly should be Oct 14');
  const nextYearlySept14 = computeNextBillingDate(sept14, 'yearly');
  assert(nextYearlySept14.getFullYear() === 2027 && nextYearlySept14.getDate() === 14, 'Sept 14 yearly should be Sept 14 2027');

  console.log('✓ Recurring billing date calculations passed!');

  // Test 6: Removing and resuming automatic recurring charge
  const subscribedUser = setAdFree(mockUser, true, {
    plan: 'monthly',
    billingDate: nextMonthlySept14.toISOString(),
    recurring: true,
  });
  assert(subscribedUser.isAdFree === true, 'User should be ad-free');
  assert(subscribedUser.adFreeRecurring === true, 'User should be enrolled in auto-renewal');

  const cancelledUser = removeAdFreeAutomaticCharge(subscribedUser);
  assert(cancelledUser.isAdFree === true, 'User remains ad-free after removing auto-charge');
  assert(cancelledUser.adFreeRecurring === false, 'adFreeRecurring should now be false');
  assert(cancelledUser.adFreePlan === 'monthly', 'Plan remains recorded');

  const resumedUser = resumeAdFreeAutomaticCharge(cancelledUser);
  assert(resumedUser.adFreeRecurring === true, 'adFreeRecurring should now be true again');
  console.log('✓ Removing & resuming automatic charge passed!');

  console.log('--- All Ad & Code Tests Passed! ---\n');
}
