export interface Mission {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  rewardXp: number;
  current: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  expiresAt: number; // timestamp
}

export interface LevelReward {
  level: number;
  title: string;
  description: string;
  type: 'dice_skin' | 'dice_credit' | 'emote' | 'name_color' | 'ranked_unlock' | 'board_theme' | 'banner_title' | 'roll_effect' | 'animated_dice' | 'coins';
  rewardId: string;
  coinsAmount?: number;
  icon: string;
}

export interface LevelState {
  xp: number; // XP within current level
  totalXp: number; // Lifetime XP in current prestige
  level: number; // 1 to 50
  prestige: number; // 0, 1, 2, ...
  title?: string;
  banner?: string;
  nameColor?: string;
  unlockedRewards: string[];
  unlockedEmotes: string[];
  unlockedTitles: string[];
  unlockedBanners: string[];
  lastFirstWinDate?: string; // YYYY-MM-DD
  missions: Mission[];
  rankedUnlocked: boolean;
}

/**
 * Formula: XP needed for next level = 100 + 20 * (current level - 1)
 */
export function getXpForNextLevel(currentLevel: number): number {
  if (currentLevel >= 50) return 0; // Max level before prestige
  return 100 + 20 * (currentLevel - 1);
}

/**
 * Cumulative total XP needed to reach a given level from level 1 (with 0 XP)
 */
export function getTotalXpToReachLevel(targetLevel: number): number {
  if (targetLevel <= 1) return 0;
  // Arithmetic progression: sum_{k=1}^{targetLevel - 1} [100 + 20*(k-1)]
  const n = targetLevel - 1;
  return (n * (200 + 20 * (n - 1))) / 2;
}

/**
 * Calculates current level and XP progression from total accumulated XP in this prestige
 */
export function calculateLevelFromTotalXp(totalXp: number): {
  level: number;
  xpInLevel: number;
  xpNeededForNext: number;
  progressPercent: number;
} {
  let level = 1;
  let accumulated = 0;

  while (level < 50) {
    const cost = getXpForNextLevel(level);
    if (totalXp >= accumulated + cost) {
      accumulated += cost;
      level++;
    } else {
      break;
    }
  }

  if (level >= 50) {
    return {
      level: 50,
      xpInLevel: totalXp - accumulated,
      xpNeededForNext: 0,
      progressPercent: 100,
    };
  }

  const xpInLevel = totalXp - accumulated;
  const xpNeededForNext = getXpForNextLevel(level);
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpInLevel / xpNeededForNext) * 100)));

  return {
    level,
    xpInLevel,
    xpNeededForNext,
    progressPercent,
  };
}

/**
 * Master catalog of rewards for levels 2 to 50
 */
export const LEVEL_REWARDS: LevelReward[] = [
  { level: 2, title: 'Dice Color Credit', description: 'Credit to unlock any current dice color in the shop for free!', type: 'dice_credit', rewardId: 'credit_dice_color_lvl2', icon: '🎨' },
  { level: 3, title: 'Dice Color Credit', description: 'Credit to unlock any current dice color in the shop for free!', type: 'dice_credit', rewardId: 'credit_dice_color_lvl3', icon: '🎨' },
  { level: 4, title: 'Dice Color Credit', description: 'Credit to unlock any current dice color in the shop for free!', type: 'dice_credit', rewardId: 'credit_dice_color_lvl4', icon: '🎨' },
  { level: 5, title: 'Custom Name Color', description: 'Unlock custom player name colors across the entire game!', type: 'name_color', rewardId: 'feature_custom_name_color', icon: '🎨' },
  { level: 6, title: '50 Bonus Coins', description: 'Coins for reaching Level 6', type: 'coins', rewardId: 'coins_50', coinsAmount: 50, icon: '🪙' },
  { level: 7, title: '75 Bonus Coins', description: 'Coins for reaching Level 7', type: 'coins', rewardId: 'coins_75', coinsAmount: 75, icon: '🪙' },
  { level: 8, title: 'Dice Shake Emote', description: 'Express yourself with the Dice Shake emote', type: 'emote', rewardId: 'emote_dice_shake', icon: '🎲' },
  { level: 9, title: '100 Bonus Coins', description: 'Coins for reaching Level 9', type: 'coins', rewardId: 'coins_100', coinsAmount: 100, icon: '🪙' },
  { level: 10, title: 'RANKED MODE UNLOCKED', description: 'Enter competitive ranked matchmaking against skilled opponents!', type: 'ranked_unlock', rewardId: 'feature_ranked_mode', icon: '🏆' },
  { level: 11, title: '125 Bonus Coins', description: 'Coins for reaching Level 11', type: 'coins', rewardId: 'coins_125', coinsAmount: 125, icon: '🪙' },
  { level: 12, title: 'Celebration Emote', description: 'Party Popper emote for wins', type: 'emote', rewardId: 'emote_celebration', icon: '🎉' },
  { level: 13, title: '150 Bonus Coins', description: 'Coins for reaching Level 13', type: 'coins', rewardId: 'coins_150', coinsAmount: 150, icon: '🪙' },
  { level: 14, title: '150 Bonus Coins', description: 'Coins for reaching Level 14', type: 'coins', rewardId: 'coins_150_b', coinsAmount: 150, icon: '🪙' },
  { level: 15, title: 'Dice Color Credit', description: 'Credit to unlock any current dice color in the shop for free!', type: 'dice_credit', rewardId: 'credit_dice_color_lvl15', icon: '🎨' },
  { level: 16, title: '175 Bonus Coins', description: 'Coins for reaching Level 16', type: 'coins', rewardId: 'coins_175', coinsAmount: 175, icon: '🪙' },
  { level: 17, title: 'Fire Emote', description: 'On Fire roll emote', type: 'emote', rewardId: 'emote_fire', icon: '🔥' },
  { level: 18, title: '200 Bonus Coins', description: 'Coins for reaching Level 18', type: 'coins', rewardId: 'coins_200', coinsAmount: 200, icon: '🪙' },
  { level: 19, title: '200 Bonus Coins', description: 'Coins for reaching Level 19', type: 'coins', rewardId: 'coins_200_b', coinsAmount: 200, icon: '🪙' },
  { level: 20, title: 'Retro Synthwave Theme', description: 'Premium 80s neon grid board background', type: 'board_theme', rewardId: 'bg_synthwave', icon: '🌆' },
  { level: 21, title: '225 Bonus Coins', description: 'Coins for reaching Level 21', type: 'coins', rewardId: 'coins_225', coinsAmount: 225, icon: '🪙' },
  { level: 22, title: 'Shocked Emote', description: 'Mindblown reaction emote', type: 'emote', rewardId: 'emote_shocked', icon: '🤯' },
  { level: 23, title: '250 Bonus Coins', description: 'Coins for reaching Level 23', type: 'coins', rewardId: 'coins_250', coinsAmount: 250, icon: '🪙' },
  { level: 24, title: '250 Bonus Coins', description: 'Coins for reaching Level 24', type: 'coins', rewardId: 'coins_250_b', coinsAmount: 250, icon: '🪙' },
  { level: 25, title: 'Profile Banners & Titles', description: 'Unlock customizable profile headers and exclusive titles ("Color Champion", "High Roller")', type: 'banner_title', rewardId: 'feature_banners_titles', icon: '👑' },
  { level: 26, title: '275 Bonus Coins', description: 'Coins for reaching Level 26', type: 'coins', rewardId: 'coins_275', coinsAmount: 275, icon: '🪙' },
  { level: 27, title: 'Sunglasses Emote', description: 'Cool shades victory emote', type: 'emote', rewardId: 'emote_sunglasses', icon: '😎' },
  { level: 28, title: '300 Bonus Coins', description: 'Coins for reaching Level 28', type: 'coins', rewardId: 'coins_300', coinsAmount: 300, icon: '🪙' },
  { level: 29, title: '300 Bonus Coins', description: 'Coins for reaching Level 29', type: 'coins', rewardId: 'coins_300_b', coinsAmount: 300, icon: '🪙' },
  { level: 30, title: 'Imperial Palace Theme', description: 'Regal golden marble board background', type: 'board_theme', rewardId: 'bg_imperial', icon: '🏛️' },
  { level: 31, title: '350 Bonus Coins', description: 'Coins for reaching Level 31', type: 'coins', rewardId: 'coins_350', coinsAmount: 350, icon: '🪙' },
  { level: 32, title: 'Crown Emote', description: 'Golden crown flex emote', type: 'emote', rewardId: 'emote_crown', icon: '👑' },
  { level: 33, title: '400 Bonus Coins', description: 'Coins for reaching Level 33', type: 'coins', rewardId: 'coins_400', coinsAmount: 400, icon: '🪙' },
  { level: 34, title: '400 Bonus Coins', description: 'Coins for reaching Level 34', type: 'coins', rewardId: 'coins_400_b', coinsAmount: 400, icon: '🪙' },
  { level: 35, title: 'Dice Color Credit', description: 'Credit to unlock any current dice color in the shop for free!', type: 'dice_credit', rewardId: 'credit_dice_color_lvl35', icon: '🎨' },
  { level: 36, title: '450 Bonus Coins', description: 'Coins for reaching Level 36', type: 'coins', rewardId: 'coins_450', coinsAmount: 450, icon: '🪙' },
  { level: 37, title: 'Swords Clash Emote', description: 'Battle to survive duel emote', type: 'emote', rewardId: 'emote_swords', icon: '⚔️' },
  { level: 38, title: '500 Bonus Coins', description: 'Coins for reaching Level 38', type: 'coins', rewardId: 'coins_500', coinsAmount: 500, icon: '🪙' },
  { level: 39, title: '500 Bonus Coins', description: 'Coins for reaching Level 39', type: 'coins', rewardId: 'coins_500_b', coinsAmount: 500, icon: '🪙' },
  { level: 40, title: 'Electric Sparks Roll Effect', description: 'Premium electric lightning trail whenever dice are rolled!', type: 'roll_effect', rewardId: 'effect_lightning_roll', icon: '⚡' },
  { level: 41, title: '550 Bonus Coins', description: 'Coins for reaching Level 41', type: 'coins', rewardId: 'coins_550', coinsAmount: 550, icon: '🪙' },
  { level: 42, title: 'Diamond Trophy Emote', description: 'Prestigious diamond trophy emote', type: 'emote', rewardId: 'emote_trophy', icon: '💎' },
  { level: 43, title: '600 Bonus Coins', description: 'Coins for reaching Level 43', type: 'coins', rewardId: 'coins_600', coinsAmount: 600, icon: '🪙' },
  { level: 44, title: '600 Bonus Coins', description: 'Coins for reaching Level 44', type: 'coins', rewardId: 'coins_600_b', coinsAmount: 600, icon: '🪙' },
  { level: 45, title: 'Stardust Void Theme', description: 'Deep space cosmic nebula theme', type: 'board_theme', rewardId: 'bg_stardust', icon: '🌌' },
  { level: 46, title: '700 Bonus Coins', description: 'Coins for reaching Level 46', type: 'coins', rewardId: 'coins_700', coinsAmount: 700, icon: '🪙' },
  { level: 47, title: 'Champion Flex Emote', description: 'Ultimate roll champion emote', type: 'emote', rewardId: 'emote_muscle', icon: '💪' },
  { level: 48, title: '800 Bonus Coins', description: 'Coins for reaching Level 48', type: 'coins', rewardId: 'coins_800', coinsAmount: 800, icon: '🪙' },
  { level: 49, title: '1,000 Bonus Coins', description: 'Coins for reaching Level 49', type: 'coins', rewardId: 'coins_1000', coinsAmount: 1000, icon: '🪙' },
  { level: 50, title: 'Prestige Master & Dice Color Credit', description: 'Credit to unlock any current dice color in the shop + access to Prestige Reset with permanent badge & border!', type: 'dice_credit', rewardId: 'credit_dice_color_lvl50', icon: '👑' },
];

export interface XpBreakdownItem {
  label: string;
  xp: number;
}

export interface MatchXpResult {
  totalXp: number;
  breakdown: XpBreakdownItem[];
  isFirstWin: boolean;
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
  unlockedRewards: LevelReward[];
}

/**
 * Calculates XP earned from a game match according to the rules:
 * - Finishing a match (not quitting): 20
 * - Surviving each elimination round: +5
 * - Placement: 1st / 2nd / 3rd: +30 / +20 / +10
 * - Color bonus points / 10 (capped): up to +20
 * - First win of the day: +50
 * - Daily and weekly missions: 50 to 200
 * - Quitting early: 0
 */
export function calculateMatchXp(params: {
  finished: boolean;
  survivedRounds: number;
  placement?: number;
  colorBonusPoints?: number;
  lastFirstWinDate?: string;
  completedMissionsXp?: number;
}): { totalXp: number; breakdown: XpBreakdownItem[]; isFirstWin: boolean } {
  if (!params.finished) {
    return {
      totalXp: 0,
      breakdown: [],
      isFirstWin: false,
    };
  }

  const breakdown: XpBreakdownItem[] = [];
  let total = 0;

  // 1. Finishing match: 20 XP
  breakdown.push({ label: 'Finished Match', xp: 20 });
  total += 20;

  // 2. Surviving each elimination round: +5 per round
  if (params.survivedRounds > 0) {
    const elimXp = params.survivedRounds * 5;
    breakdown.push({ label: `Elimination Rounds Survived (${params.survivedRounds}×5)`, xp: elimXp });
    total += elimXp;
  }

  // 3. Placement: 1st (+30) / 2nd (+20) / 3rd (+10)
  if (params.placement === 1) {
    breakdown.push({ label: '1st Place Victory', xp: 30 });
    total += 30;
  } else if (params.placement === 2) {
    breakdown.push({ label: '2nd Place Finish', xp: 20 });
    total += 20;
  } else if (params.placement === 3) {
    breakdown.push({ label: '3rd Place Finish', xp: 10 });
    total += 10;
  }

  // 4. Color bonus points ÷ 10 (capped at +20)
  if (params.colorBonusPoints && params.colorBonusPoints > 0) {
    const rawColorXp = Math.floor(params.colorBonusPoints / 10);
    const colorXp = Math.min(20, Math.max(0, rawColorXp));
    if (colorXp > 0) {
      breakdown.push({ label: `Color Bonus Points (${params.colorBonusPoints} pts)`, xp: colorXp });
      total += colorXp;
    }
  }

  // 5. First win of the day: +50 XP
  const todayStr = new Date().toISOString().split('T')[0];
  let isFirstWin = false;
  if (params.placement === 1 && params.lastFirstWinDate !== todayStr) {
    isFirstWin = true;
    breakdown.push({ label: '🌟 First Win of the Day', xp: 50 });
    total += 50;
  }

  // 6. Mission XP if any
  if (params.completedMissionsXp && params.completedMissionsXp > 0) {
    breakdown.push({ label: '🎯 Completed Missions', xp: params.completedMissionsXp });
    total += params.completedMissionsXp;
  }

  return {
    totalXp: total,
    breakdown,
    isFirstWin,
  };
}

/**
 * Applies earned XP to user's LevelState, checks for level ups and unlocks
 */
export function applyXpToUser(
  currentLevelState: LevelState,
  earnedXp: number,
  isFirstWin: boolean
): {
  updatedState: LevelState;
  leveledUp: boolean;
  newRewards: LevelReward[];
  coinsAwarded: number;
  diceCreditsAwarded: number;
} {
  if (earnedXp <= 0) {
    return {
      updatedState: currentLevelState,
      leveledUp: false,
      newRewards: [],
      coinsAwarded: 0,
      diceCreditsAwarded: 0,
    };
  }

  const prevTotalXp = currentLevelState.totalXp || 0;
  const newTotalXp = prevTotalXp + earnedXp;

  const prevCalc = calculateLevelFromTotalXp(prevTotalXp);
  const newCalc = calculateLevelFromTotalXp(newTotalXp);

  const leveledUp = newCalc.level > prevCalc.level;
  const newRewards: LevelReward[] = [];
  let coinsAwarded = 0;
  let diceCreditsAwarded = 0;

  const currentUnlocked = new Set(currentLevelState.unlockedRewards || []);
  const currentEmotes = new Set(currentLevelState.unlockedEmotes || []);
  const currentTitles = new Set(currentLevelState.unlockedTitles || []);
  const currentBanners = new Set(currentLevelState.unlockedBanners || []);

  if (leveledUp) {
    for (let lvl = prevCalc.level + 1; lvl <= newCalc.level; lvl++) {
      const reward = LEVEL_REWARDS.find(r => r.level === lvl);
      if (reward) {
        newRewards.push(reward);
        currentUnlocked.add(reward.rewardId);

        if (reward.type === 'coins' && reward.coinsAmount) {
          coinsAwarded += reward.coinsAmount;
        } else if (reward.type === 'dice_credit') {
          diceCreditsAwarded += 1;
        } else if (reward.type === 'emote') {
          currentEmotes.add(reward.rewardId);
        } else if (reward.type === 'banner_title') {
          currentTitles.add('Color Champion');
          currentTitles.add('High Roller');
          currentTitles.add('Dice Maestro');
          currentBanners.add('Cosmic Aurora');
          currentBanners.add('Golden Laurel');
        }
      }
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const updatedState: LevelState = {
    ...currentLevelState,
    totalXp: newTotalXp,
    xp: newCalc.xpInLevel,
    level: newCalc.level,
    rankedUnlocked: newCalc.level >= 10 || currentLevelState.rankedUnlocked,
    lastFirstWinDate: isFirstWin ? todayStr : currentLevelState.lastFirstWinDate,
    unlockedRewards: Array.from(currentUnlocked),
    unlockedEmotes: Array.from(currentEmotes),
    unlockedTitles: Array.from(currentTitles),
    unlockedBanners: Array.from(currentBanners),
  };

  return {
    updatedState,
    leveledUp,
    newRewards,
    coinsAwarded,
    diceCreditsAwarded,
  };
}

/**
 * Triggers Prestige Reset:
 * Player must be level 50. Level resets to 1, totalXp resets to 0,
 * prestige count increments, player gets permanent Prestige badge and border!
 */
export function executePrestige(currentLevelState: LevelState): LevelState {
  if (currentLevelState.level < 50) return currentLevelState;

  const nextPrestige = (currentLevelState.prestige || 0) + 1;
  const currentTitles = new Set(currentLevelState.unlockedTitles || []);
  currentTitles.add(`Prestige ${nextPrestige} Legend`);

  return {
    ...currentLevelState,
    prestige: nextPrestige,
    level: 1,
    xp: 0,
    totalXp: 0,
    title: `Prestige ${nextPrestige} Legend`,
    unlockedTitles: Array.from(currentTitles),
  };
}

/**
 * Generates default or refreshed missions for daily/weekly play
 */
export function generateDefaultMissions(): Mission[] {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * oneDayMs;

  return [
    {
      id: 'daily_match_1',
      title: 'Roll into Action',
      description: 'Finish 1 full match (any mode)',
      type: 'daily',
      rewardXp: 50,
      current: 0,
      target: 1,
      completed: false,
      claimed: false,
      expiresAt: now + oneDayMs,
    },
    {
      id: 'daily_score_150',
      title: 'High Scorer',
      description: 'Score 150+ points in a single match',
      type: 'daily',
      rewardXp: 75,
      current: 0,
      target: 150,
      completed: false,
      claimed: false,
      expiresAt: now + oneDayMs,
    },
    {
      id: 'daily_win_1',
      title: 'Daily Champion',
      description: 'Win 1st place in a game',
      type: 'daily',
      rewardXp: 100,
      current: 0,
      target: 1,
      completed: false,
      claimed: false,
      expiresAt: now + oneDayMs,
    },
    {
      id: 'weekly_survive_10',
      title: 'Survivor Elite',
      description: 'Survive 10 elimination rounds',
      type: 'weekly',
      rewardXp: 150,
      current: 0,
      target: 10,
      completed: false,
      claimed: false,
      expiresAt: now + sevenDaysMs,
    },
    {
      id: 'weekly_win_3',
      title: 'Roll Master',
      description: 'Win 3 matches this week',
      type: 'weekly',
      rewardXp: 200,
      current: 0,
      target: 3,
      completed: false,
      claimed: false,
      expiresAt: now + sevenDaysMs,
    },
  ];
}

export const PRESET_NAME_COLORS = [
  { name: 'Classic Gold', hex: '#f2c14e' },
  { name: 'Crimson Fire', hex: '#ff4d4d' },
  { name: 'Neon Emerald', hex: '#2ecc71' },
  { name: 'Cyan Spark', hex: '#00d2d3' },
  { name: 'Royal Amethyst', hex: '#a55eea' },
  { name: 'Electric Pink', hex: '#ff3f8b' },
  { name: 'Solar Amber', hex: '#fa8231' },
  { name: 'Pure Diamond', hex: '#e0f7fa' },
];
