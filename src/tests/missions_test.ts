import {
  createInitialDailyMissions,
  createInitialWeeklyMissions,
  recordMatchForMissions,
  recordEmoteSent,
  claimMissionReward,
  getUnclaimedMissionsCount,
  getMissionsData,
  saveMissionsData,
  MissionsData,
} from '../lib/missions';

export function runMissionsTests() {
  console.log('--- Running Missions & Achievements Tests ---');

  // Clear mock storage for test runner environment if localStorage is defined or polyfill
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] || null,
      length: store.size,
    } as any;
  }

  const testUid = 'test_user_missions_' + Date.now();

  // Test 1: Initial Daily Missions setup verification (9 original + 4 new = 13 total)
  const dailies = createInitialDailyMissions();
  if (dailies.length !== 13) {
    throw new Error(`Expected 13 daily missions, got ${dailies.length}`);
  }

  const expectedDailyIds = [
    'daily_online_std',
    'daily_online_double',
    'daily_online_high_roller',
    'daily_cpu_std',
    'daily_cpu_double',
    'daily_cpu_high_roller',
    'daily_win_10',
    'daily_win_cpu_8p',
    'daily_win_6p',
    'daily_century_club',
    'daily_friendly_showdown',
    'daily_emote_enthusiast',
    'daily_precision_roller',
  ];
  for (const id of expectedDailyIds) {
    const found = dailies.find(d => d.id === id);
    if (!found) throw new Error(`Missing expected daily mission: ${id}`);
  }

  // Rewards verification
  const onlineStd = dailies.find(d => d.id === 'daily_online_std')!;
  const onlineDouble = dailies.find(d => d.id === 'daily_online_double')!;
  const onlineHigh = dailies.find(d => d.id === 'daily_online_high_roller')!;
  if (onlineStd.rewardCoins !== 10) throw new Error('Online Std reward must be 10 coins');
  if (onlineDouble.rewardCoins !== 20) throw new Error('Online Double reward must be 20 coins');
  if (onlineHigh.rewardCoins !== 50) throw new Error('Online High Roller reward must be 50 coins');

  const centuryClub = dailies.find(d => d.id === 'daily_century_club')!;
  const friendlyShowdown = dailies.find(d => d.id === 'daily_friendly_showdown')!;
  const emoteEnthusiast = dailies.find(d => d.id === 'daily_emote_enthusiast')!;
  const precisionRoller = dailies.find(d => d.id === 'daily_precision_roller')!;
  if (centuryClub.rewardCoins !== 20) throw new Error('Century club reward must be 20 coins');
  if (friendlyShowdown.rewardCoins !== 30) throw new Error('Friendly Showdown reward must be 30 coins');
  if (emoteEnthusiast.rewardCoins !== 20) throw new Error('Emote Enthusiast reward must be 20 coins');
  if (precisionRoller.rewardCoins !== 30) throw new Error('Precision Roller reward must be 30 coins');

  // Test 2: Weekly missions verification (4 original + 3 new = 7 total)
  const weeklies = createInitialWeeklyMissions(0);
  if (weeklies.length !== 7) {
    throw new Error(`Expected 7 weekly missions, got ${weeklies.length}`);
  }
  const expectedWeeklyIds = [
    'weekly_color_runs_5',
    'weekly_daily_missions_15',
    'weekly_survive_50',
    'weekly_streak_7',
    'weekly_color_master_3',
    'weekly_tiebreaker_hero',
    'weekly_underdog_ascendant',
  ];
  for (const id of expectedWeeklyIds) {
    const found = weeklies.find(w => w.id === id);
    if (!found) throw new Error(`Missing expected weekly mission: ${id}`);
    if (found.rewardCoins !== 100) throw new Error(`Weekly mission ${id} must award 100 coins`);
  }

  // Test 3: Tracking progress for 2p, 4p, 6p SubGoals
  let state = getMissionsData(testUid);
  // Simulate playing 2p, 4p, 6p CPU Standard games
  recordMatchForMissions(testUid, {
    mode: 'cpu',
    tier: 'standard',
    playersCount: 2,
    isWin: false,
    placement: 2,
    survivedRounds: 0,
    colorRunsScored: 0,
    finished: true,
  });
  recordMatchForMissions(testUid, {
    mode: 'cpu',
    tier: 'standard',
    playersCount: 4,
    isWin: false,
    placement: 3,
    survivedRounds: 1,
    colorRunsScored: 0,
    finished: true,
  });
  state = getMissionsData(testUid);
  let cpuStdMission = state.dailyMissions.find(m => m.id === 'daily_cpu_std')!;
  if (cpuStdMission.current !== 2 || cpuStdMission.completed) {
    throw new Error(`Expected cpuStd to have 2 subgoals complete, got ${cpuStdMission.current}`);
  }

  // Complete the 6p subgoal
  const res6p = recordMatchForMissions(testUid, {
    mode: 'cpu',
    tier: 'standard',
    playersCount: 6,
    isWin: true,
    placement: 1,
    survivedRounds: 5,
    colorRunsScored: 1,
    bankedCenturyClub: true,
    precisionRoller: true,
    scoredFiveOfAKind: true,
    wonTiebreaker: true,
    underdogAscendant: true,
    finished: true,
  });
  cpuStdMission = res6p.missionsData.dailyMissions.find(m => m.id === 'daily_cpu_std')!;
  if (!cpuStdMission.completed) {
    throw new Error('Expected cpuStd to be marked completed after 2p, 4p, and 6p were all played');
  }

  // Test Century Club, Precision Roller, and Weekly milestones
  const cc = res6p.missionsData.dailyMissions.find(m => m.id === 'daily_century_club')!;
  if (!cc.completed) throw new Error('Expected Century Club to be completed');
  const pr = res6p.missionsData.dailyMissions.find(m => m.id === 'daily_precision_roller')!;
  if (!pr.completed) throw new Error('Expected Precision Roller to be completed');
  const cm = res6p.missionsData.weeklyMissions.find(m => m.id === 'weekly_color_master_3')!;
  if (cm.current !== 1) throw new Error('Expected Color Master to increment to 1');
  const th = res6p.missionsData.weeklyMissions.find(m => m.id === 'weekly_tiebreaker_hero')!;
  if (!th.completed) throw new Error('Expected Tiebreaker Hero to be completed');
  const ua = res6p.missionsData.weeklyMissions.find(m => m.id === 'weekly_underdog_ascendant')!;
  if (!ua.completed) throw new Error('Expected Underdog Ascendant to be completed');

  // Test Emote Enthusiast during elimination
  recordEmoteSent(testUid, true);
  recordEmoteSent(testUid, true);
  const emoteRes = recordEmoteSent(testUid, true);
  const ee = emoteRes.missionsData.dailyMissions.find(m => m.id === 'daily_emote_enthusiast')!;
  if (!ee.completed || ee.current !== 3) {
    throw new Error(`Expected Emote Enthusiast to be completed with 3 emotes, got current: ${ee.current}`);
  }

  // Check unclaimed count
  const unclaimed = getUnclaimedMissionsCount(res6p.missionsData);
  if (unclaimed.dailyUnclaimed < 1) {
    throw new Error('Expected at least 1 unclaimed daily mission');
  }

  // Claim reward
  const claimRes = claimMissionReward(testUid, 'daily_cpu_std');
  if (!claimRes.success || claimRes.rewardCoins !== 10) {
    throw new Error(`Claim failed or gave incorrect coins: ${claimRes.rewardCoins}`);
  }
  const postClaim = getMissionsData(testUid);
  const claimedMission = postClaim.dailyMissions.find(m => m.id === 'daily_cpu_std')!;
  if (!claimedMission.claimed) {
    throw new Error('Mission should now be marked claimed');
  }

  console.log('✓ All 13 Daily Missions & 7 Weekly Goals verified!');
  console.log('✓ Emote Enthusiast elimination reaction tracking verified!');
  console.log('✓ Century Club, Color Master, Precision Roller, Tiebreaker Hero, Underdog Ascendant verified!');
}
