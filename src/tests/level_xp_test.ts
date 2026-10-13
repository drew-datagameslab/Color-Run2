import {
  getXpForNextLevel,
  getTotalXpToReachLevel,
  calculateLevelFromTotalXp,
  calculateMatchXp,
  applyXpToUser,
  executePrestige,
  LEVEL_REWARDS,
  LevelState,
} from '../lib/levelSystem';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runLevelXpTests() {
  console.log('\n--- Running Level Curve & XP Tests ---');

  // Test 1: Level Curve Formula
  // Formula: XP needed for next level = 100 + 20 * (current level - 1)
  assert(getXpForNextLevel(1) === 100, 'Level 1 needs 100 XP for next level');
  assert(getXpForNextLevel(2) === 120, 'Level 2 needs 120 XP for next level');
  assert(getXpForNextLevel(3) === 140, 'Level 3 needs 140 XP for next level');
  assert(getXpForNextLevel(9) === 260, 'Level 9 needs 260 XP for next level');

  // Cumulative table from prompt:
  // Reach level 2: Total XP = 100
  // Reach level 10: Total XP = 1,620
  // Reach level 25: Total XP = 7,920
  // Reach level 50: Total XP = 28,420
  assert(getTotalXpToReachLevel(2) === 100, `Level 2 total XP must be 100, got ${getTotalXpToReachLevel(2)}`);
  assert(getTotalXpToReachLevel(10) === 1620, `Level 10 total XP must be 1620, got ${getTotalXpToReachLevel(10)}`);
  assert(getTotalXpToReachLevel(25) === 7920, `Level 25 total XP must be 7920, got ${getTotalXpToReachLevel(25)}`);
  assert(getTotalXpToReachLevel(50) === 28420, `Level 50 total XP must be 28420, got ${getTotalXpToReachLevel(50)}`);
  console.log('✓ Level curve arithmetic matches specification exactly: 100 / 1,620 / 7,920 / 28,420');

  // Test 2: Calculate Level from Total XP
  const calcLvl1 = calculateLevelFromTotalXp(0);
  assert(calcLvl1.level === 1 && calcLvl1.xpInLevel === 0, '0 XP is Level 1');

  const calcLvl2 = calculateLevelFromTotalXp(100);
  assert(calcLvl2.level === 2 && calcLvl2.xpInLevel === 0, '100 XP reaches Level 2');

  const calcLvl10 = calculateLevelFromTotalXp(1620);
  assert(calcLvl10.level === 10 && calcLvl10.xpInLevel === 0, '1620 XP reaches Level 10');

  const calcLvl25 = calculateLevelFromTotalXp(7920);
  assert(calcLvl25.level === 25 && calcLvl25.xpInLevel === 0, '7920 XP reaches Level 25');

  const calcLvl50 = calculateLevelFromTotalXp(28420);
  assert(calcLvl50.level === 50, '28420 XP reaches Level 50');
  console.log('✓ calculateLevelFromTotalXp correctly calculates levels from XP');

  // Test 3: Match XP Breakdown
  // Source:
  // Finishing match (not quitting): 20
  // Surviving each elimination round: +5
  // Placement: 1st (+30), 2nd (+20), 3rd (+10)
  // Color bonus points / 10 (capped up to +20)
  // First win of the day: +50
  // Quitting early: 0

  // Case A: Quitting early
  const quitEarly = calculateMatchXp({
    finished: false,
    survivedRounds: 2,
    placement: 4,
  });
  assert(quitEarly.totalXp === 0, 'Quitting early must award 0 XP');

  // Case B: Typical match (Finished + 2 rounds survived + 2nd place = 20 + 10 + 20 = 50 XP)
  const typicalMatch = calculateMatchXp({
    finished: true,
    survivedRounds: 2,
    placement: 2,
    colorBonusPoints: 0,
  });
  assert(typicalMatch.totalXp === 50, `Typical match should come out to 50 XP, got ${typicalMatch.totalXp}`);

  // Case C: 1st place victory with color bonus and first win of the day
  // 20 (finish) + 15 (3 rounds survived) + 30 (1st) + 20 (capped color bonus) + 50 (first win) = 135 XP
  const bigWin = calculateMatchXp({
    finished: true,
    survivedRounds: 3,
    placement: 1,
    colorBonusPoints: 250, // 250 / 10 = 25 -> capped at 20
    lastFirstWinDate: '2020-01-01', // different day
  });
  assert(bigWin.totalXp === 135, `Big win should be 135 XP, got ${bigWin.totalXp}`);
  assert(bigWin.isFirstWin === true, 'First win of day recognized');
  console.log('✓ Match XP calculations and caps verified');

  // Test 4: Rewards and Leveling Progression
  const initialUserLevel: LevelState = {
    xp: 0,
    totalXp: 0,
    level: 1,
    prestige: 0,
    unlockedRewards: [],
    unlockedEmotes: [],
    unlockedTitles: [],
    unlockedBanners: [],
    missions: [],
    rankedUnlocked: false,
  };

  // Give 1,700 XP (enough to reach Level 10)
  const progressRes = applyXpToUser(initialUserLevel, 1700, false);
  assert(progressRes.leveledUp === true, 'Player leveled up');
  assert(progressRes.updatedState.level === 10, `Player should be level 10, got ${progressRes.updatedState.level}`);
  assert(progressRes.updatedState.rankedUnlocked === true, 'Ranked mode unlocked at level 10');
  assert(progressRes.updatedState.unlockedRewards.includes('feature_custom_name_color'), 'Custom name color unlocked at level 5');
  assert(progressRes.updatedState.unlockedRewards.includes('coupon_lvl10'), 'Level 10 coupon unlocked in rewards');
  // Coupons at levels 2, 3, 4, 8 and 10
  assert(progressRes.diceCreditsAwarded === 5, `Five free coupons by level 10, got ${progressRes.diceCreditsAwarded}`);
  console.log('✓ Level up progression and rewards unlocks verified');

  // Test 5: Prestige Execution
  const maxLevelUser: LevelState = {
    ...initialUserLevel,
    level: 50,
    totalXp: 28420,
    prestige: 0,
  };

  const prestiged = executePrestige(maxLevelUser);
  assert(prestiged.prestige === 1, 'Prestige count incremented to 1');
  assert(prestiged.level === 1, 'Level reset to 1 after prestige');
  assert(prestiged.totalXp === 0, 'Total XP reset for prestige cycle');
  assert(prestiged.title?.includes('Prestige 1'), 'Prestige title awarded');
  console.log('✓ Prestige reset and permanent rewards verified');

  // Test 6: Rewards Catalog completeness
  assert(LEVEL_REWARDS.length >= 48, 'Catalog has rewards for all levels 2 to 50');
  const lvl5 = LEVEL_REWARDS.find(r => r.level === 5);
  assert(lvl5?.type === 'name_color', 'Level 5 reward is custom name color');
  const lvl10 = LEVEL_REWARDS.find(r => r.level === 10);
  assert(lvl10?.type === 'dice_credit', 'Level 10 reward is a free dice or background coupon');
  const lvl50 = LEVEL_REWARDS.find(r => r.level === 50);
  assert(lvl50?.type === 'dice_credit', 'Level 50 reward is a free coupon & prestige access');
  const lvl2 = LEVEL_REWARDS.find(r => r.level === 2);
  assert(lvl2?.type === 'dice_credit', 'Level 2 reward is a free coupon');
  // Every reward unlocks something real: no emotes, themes, roll effects or ranked mode
  const unbuilt = LEVEL_REWARDS.filter(r => ['emote', 'board_theme', 'roll_effect', 'ranked_unlock', 'animated_dice', 'dice_skin'].includes(r.type));
  assert(unbuilt.length === 0, `No rewards for features that do not exist, found ${unbuilt.map(r => r.level).join(', ')}`);
  const coupons = LEVEL_REWARDS.filter(r => r.type === 'dice_credit').map(r => r.level);
  assert(coupons.join() === '2,3,4,8,10,12,15,17,20,22,27,30,32,35,37,40,42,45,47,50', `Coupon levels, got ${coupons.join()}`);
  console.log('✓ Master rewards catalog verified (20 free dice or background coupons)');
}
