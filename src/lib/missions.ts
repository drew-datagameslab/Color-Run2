export interface SubGoal {
  id: string; // e.g. '2p', '4p', '6p'
  label: string; // e.g. '2 Player'
  completed: boolean;
}

export interface MissionGoal {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  rewardCoins: number;
  current: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  icon?: string;
  category?: 'multiplayer' | 'cpu' | 'wins' | 'special';
  subGoals?: SubGoal[];
}

export interface MissionsData {
  dailyResetDate: string; // YYYY-MM-DD
  weeklyResetWeek: string; // YYYY-Www
  dailyMissions: MissionGoal[];
  weeklyMissions: MissionGoal[];
  streakDays: number;
  lastDailyCompletionDate?: string; // YYYY-MM-DD
  totalDailyCompletedThisWeek: number;
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentWeekString(): string {
  const d = new Date();
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

export function createInitialDailyMissions(): MissionGoal[] {
  return [
    {
      id: 'daily_online_std',
      title: 'Online Multiplayer — Standard',
      description: 'Play and complete 2P, 4P, and 6P Standard games.',
      type: 'daily',
      rewardCoins: 10,
      current: 0,
      target: 3,
      completed: false,
      claimed: false,
      icon: '🌐',
      category: 'multiplayer',
      subGoals: [
        { id: '2p', label: '2P', completed: false },
        { id: '4p', label: '4P', completed: false },
        { id: '6p', label: '6P', completed: false },
      ],
    },
    {
      id: 'daily_online_double',
      title: 'Online Multiplayer — Double Action',
      description: 'Play and complete 2P, 4P, and 6P Double Action games.',
      type: 'daily',
      rewardCoins: 20,
      current: 0,
      target: 3,
      completed: false,
      claimed: false,
      icon: '⚡',
      category: 'multiplayer',
      subGoals: [
        { id: '2p', label: '2P', completed: false },
        { id: '4p', label: '4P', completed: false },
        { id: '6p', label: '6P', completed: false },
      ],
    },
    {
      id: 'daily_online_high_roller',
      title: 'Online Multiplayer — High Roller',
      description: 'Play and complete 2P, 4P, and 6P High Roller games.',
      type: 'daily',
      rewardCoins: 50,
      current: 0,
      target: 3,
      completed: false,
      claimed: false,
      icon: '💎',
      category: 'multiplayer',
      subGoals: [
        { id: '2p', label: '2P', completed: false },
        { id: '4p', label: '4P', completed: false },
        { id: '6p', label: '6P', completed: false },
      ],
    },
    {
      id: 'daily_cpu_std',
      title: 'User vs. CPU — Standard',
      description: 'Play and complete 2P, 4P, and 6P Standard games.',
      type: 'daily',
      rewardCoins: 10,
      current: 0,
      target: 3,
      completed: false,
      claimed: false,
      icon: '🤖',
      category: 'cpu',
      subGoals: [
        { id: '2p', label: '2P', completed: false },
        { id: '4p', label: '4P', completed: false },
        { id: '6p', label: '6P', completed: false },
      ],
    },
    {
      id: 'daily_cpu_double',
      title: 'User vs. CPU — Double Action',
      description: 'Play and complete 2P, 4P, and 6P Double Action games.',
      type: 'daily',
      rewardCoins: 20,
      current: 0,
      target: 3,
      completed: false,
      claimed: false,
      icon: '🔥',
      category: 'cpu',
      subGoals: [
        { id: '2p', label: '2P', completed: false },
        { id: '4p', label: '4P', completed: false },
        { id: '6p', label: '6P', completed: false },
      ],
    },
    {
      id: 'daily_cpu_high_roller',
      title: 'User vs. CPU — High Roller',
      description: 'Play and complete 2P, 4P, and 6P High Roller games.',
      type: 'daily',
      rewardCoins: 50,
      current: 0,
      target: 3,
      completed: false,
      claimed: false,
      icon: '👑',
      category: 'cpu',
      subGoals: [
        { id: '2p', label: '2P', completed: false },
        { id: '4p', label: '4P', completed: false },
        { id: '6p', label: '6P', completed: false },
      ],
    },
    {
      id: 'daily_win_10',
      title: 'Victory Champion',
      description: 'Win any 10 games (CPU or Multiplayer).',
      type: 'daily',
      rewardCoins: 20,
      current: 0,
      target: 10,
      completed: false,
      claimed: false,
      icon: '🏆',
      category: 'wins',
    },
    {
      id: 'daily_win_cpu_8p',
      title: 'CPU 8-Player Conqueror',
      description: 'Win two User vs. CPU 8-player games.',
      type: 'daily',
      rewardCoins: 20,
      current: 0,
      target: 2,
      completed: false,
      claimed: false,
      icon: '⚔️',
      category: 'wins',
    },
    {
      id: 'daily_win_6p',
      title: '6-Player Master',
      description: 'Win five 6-player games in either vs. CPU or Multiplayer mode.',
      type: 'daily',
      rewardCoins: 20,
      current: 0,
      target: 5,
      completed: false,
      claimed: false,
      icon: '🌟',
      category: 'wins',
    },
    {
      id: 'daily_century_club',
      title: 'Century Club',
      description: 'Bank 70+ points in a single 3-roll turn (e.g. 4 blue + 3 red).',
      type: 'daily',
      rewardCoins: 20,
      current: 0,
      target: 1,
      completed: false,
      claimed: false,
      icon: '💯',
      category: 'special',
    },
    {
      id: 'daily_friendly_showdown',
      title: 'Friendly Showdown',
      description: 'Challenge a friend via SMS / direct invite and play 1 match.',
      type: 'daily',
      rewardCoins: 30,
      current: 0,
      target: 1,
      completed: false,
      claimed: false,
      icon: '🤝',
      category: 'special',
    },
    {
      id: 'daily_emote_enthusiast',
      title: 'Emote Enthusiast',
      description: 'Send 3 celebratory emotes during elimination rounds.',
      type: 'daily',
      rewardCoins: 20,
      current: 0,
      target: 3,
      completed: false,
      claimed: false,
      icon: '🥳',
      category: 'special',
    },
    {
      id: 'daily_precision_roller',
      title: 'Precision Roller',
      description: 'Win a match without ever being in the bottom two during an elimination round.',
      type: 'daily',
      rewardCoins: 30,
      current: 0,
      target: 1,
      completed: false,
      claimed: false,
      icon: '🎯',
      category: 'special',
    },
  ];
}

export function createInitialWeeklyMissions(streakDays = 0): MissionGoal[] {
  return [
    {
      id: 'weekly_color_runs_5',
      title: 'Color Run Virtuoso',
      description: 'Score 5 Color Runs (6-of-a-kind same color in a set).',
      type: 'weekly',
      rewardCoins: 100,
      current: 0,
      target: 5,
      completed: false,
      claimed: false,
      icon: '🌈',
      category: 'special',
    },
    {
      id: 'weekly_daily_missions_15',
      title: 'Mission Veteran',
      description: 'Complete 15 daily missions.',
      type: 'weekly',
      rewardCoins: 100,
      current: 0,
      target: 15,
      completed: false,
      claimed: false,
      icon: '🎯',
      category: 'special',
    },
    {
      id: 'weekly_survive_50',
      title: 'Iron Survivor',
      description: 'Survive 50 Elimination Rounds.',
      type: 'weekly',
      rewardCoins: 100,
      current: 0,
      target: 50,
      completed: false,
      claimed: false,
      icon: '🛡️',
      category: 'special',
    },
    {
      id: 'weekly_streak_7',
      title: '7-Day Dedication',
      description: '7-day streak of completing at least one daily mission.',
      type: 'weekly',
      rewardCoins: 100,
      current: Math.min(7, streakDays),
      target: 7,
      completed: streakDays >= 7,
      claimed: false,
      icon: '🔥',
      category: 'special',
    },
    {
      id: 'weekly_color_master_3',
      title: 'Color Master',
      description: 'Score a 5-of-a-kind color bonus (+40 pts) in 3 different matches.',
      type: 'weekly',
      rewardCoins: 100,
      current: 0,
      target: 3,
      completed: false,
      claimed: false,
      icon: '🎨',
      category: 'special',
    },
    {
      id: 'weekly_tiebreaker_hero',
      title: 'Tiebreaker Hero',
      description: 'Win a sudden-death 12-dice roll-off elimination.',
      type: 'weekly',
      rewardCoins: 100,
      current: 0,
      target: 1,
      completed: false,
      claimed: false,
      icon: '⚔️',
      category: 'special',
    },
    {
      id: 'weekly_underdog_ascendant',
      title: 'Underdog Ascendant',
      description: 'Win 1st place after entering the elimination threshold in last place.',
      type: 'weekly',
      rewardCoins: 100,
      current: 0,
      target: 1,
      completed: false,
      claimed: false,
      icon: '🦅',
      category: 'special',
    },
  ];
}

const MISSIONS_STORAGE_PREFIX = 'color_run_missions_v6_';

export function getMissionsData(userId: string): MissionsData {
  const today = getTodayDateString();
  const currentWeek = getCurrentWeekString();
  const key = MISSIONS_STORAGE_PREFIX + (userId || 'guest');

  let data: MissionsData | null = null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      data = JSON.parse(raw);
    }
  } catch {
    // Ignore parse errors
  }

  if (!data) {
    data = {
      dailyResetDate: today,
      weeklyResetWeek: currentWeek,
      dailyMissions: createInitialDailyMissions(),
      weeklyMissions: createInitialWeeklyMissions(0),
      streakDays: 0,
      totalDailyCompletedThisWeek: 0,
    };
    saveMissionsData(userId, data);
    return data;
  }

  let modified = false;

  // Check Daily Reset (resets at midnight server/local time)
  if (data.dailyResetDate !== today) {
    const yesterday = getYesterdayDateString();
    // If player completed a daily mission yesterday, streak is maintained.
    // If player missed yesterday, reset streak to 0
    if (data.lastDailyCompletionDate !== yesterday && data.lastDailyCompletionDate !== today) {
      data.streakDays = 0;
    }

    data.dailyResetDate = today;
    data.dailyMissions = createInitialDailyMissions();
    modified = true;
  }

  // Check Weekly Reset
  if (data.weeklyResetWeek !== currentWeek) {
    data.weeklyResetWeek = currentWeek;
    data.weeklyMissions = createInitialWeeklyMissions(data.streakDays);
    data.totalDailyCompletedThisWeek = 0;
    modified = true;
  } else {
    // Sync streak into weekly streak goal
    const streakMission = data.weeklyMissions.find(m => m.id === 'weekly_streak_7');
    if (streakMission) {
      streakMission.current = Math.min(7, data.streakDays);
      if (streakMission.current >= streakMission.target && !streakMission.completed) {
        streakMission.completed = true;
        modified = true;
      }
    }
  }

  // Ensure all standard daily missions are present (in case of updates)
  const initialDailies = createInitialDailyMissions();
  for (const initial of initialDailies) {
    if (!data.dailyMissions.some(m => m.id === initial.id)) {
      data.dailyMissions.push(initial);
      modified = true;
    }
  }

  // Ensure all standard weekly missions are present
  const initialWeeklies = createInitialWeeklyMissions(data.streakDays);
  for (const initial of initialWeeklies) {
    if (!data.weeklyMissions.some(m => m.id === initial.id)) {
      data.weeklyMissions.push(initial);
      modified = true;
    }
  }

  if (modified) {
    saveMissionsData(userId, data);
  }

  return data;
}

export function saveMissionsData(userId: string, data: MissionsData): void {
  try {
    const key = MISSIONS_STORAGE_PREFIX + (userId || 'guest');
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export interface MatchOutcomeForMissions {
  mode: string; // 'cpu' | 'online' | 'ranked' | 'challenge' | 'challenge_friend' | 'pass_and_play'
  tier?: 'standard' | 'double' | 'high_roller';
  playersCount: number; // 2, 4, 6, 8
  isWin: boolean; // placement === 1
  placement: number;
  survivedRounds: number;
  colorRunsScored: number;
  finished: boolean;
  scoredFiveOfAKind?: boolean;
  bankedCenturyClub?: boolean;
  precisionRoller?: boolean;
  wonTiebreaker?: boolean;
  underdogAscendant?: boolean;
  isFriendChallenge?: boolean;
}

/**
 * Updates mission progress based on a completed game match
 */
export function recordMatchForMissions(
  userId: string,
  match: MatchOutcomeForMissions
): {
  missionsData: MissionsData;
  newlyCompletedMissions: MissionGoal[];
} {
  const data = getMissionsData(userId);
  const newlyCompletedMissions: MissionGoal[] = [];

  if (!match.finished) {
    return { missionsData: data, newlyCompletedMissions: [] };
  }

  const isCpuMode = match.mode === 'cpu';
  const isOnlineMode =
    match.mode === 'online' ||
    match.mode === 'ranked' ||
    match.mode === 'challenge' ||
    match.mode === 'challenge_friend';
  const tier = match.tier || 'standard';
  const count = match.playersCount;

  // Helper to update 3-player-count subgoals
  const updatePlayerCountSubGoals = (missionId: string) => {
    const mission = data.dailyMissions.find(m => m.id === missionId);
    if (!mission || mission.completed) return;

    if (mission.subGoals) {
      const pKey = `${count}p`;
      const subGoal = mission.subGoals.find(sg => sg.id === pKey);
      if (subGoal && !subGoal.completed) {
        subGoal.completed = true;
        mission.current = mission.subGoals.filter(sg => sg.completed).length;
        if (mission.current >= mission.target) {
          mission.completed = true;
          newlyCompletedMissions.push({ ...mission });
        }
      }
    }
  };

  // 1. Online Multiplayer Daily Missions
  if (isOnlineMode) {
    if (tier === 'standard') {
      updatePlayerCountSubGoals('daily_online_std');
    } else if (tier === 'double') {
      updatePlayerCountSubGoals('daily_online_double');
    } else if (tier === 'high_roller') {
      updatePlayerCountSubGoals('daily_online_high_roller');
    }
  }

  // 2. User vs CPU Daily Missions
  if (isCpuMode) {
    if (tier === 'standard') {
      updatePlayerCountSubGoals('daily_cpu_std');
    } else if (tier === 'double') {
      updatePlayerCountSubGoals('daily_cpu_double');
    } else if (tier === 'high_roller') {
      updatePlayerCountSubGoals('daily_cpu_high_roller');
    }
  }

  // 3. Win any 10 games
  if (match.isWin) {
    const win10 = data.dailyMissions.find(m => m.id === 'daily_win_10');
    if (win10 && !win10.completed) {
      win10.current = Math.min(win10.target, win10.current + 1);
      if (win10.current >= win10.target) {
        win10.completed = true;
        newlyCompletedMissions.push({ ...win10 });
      }
    }

    // 4. Win two User vs. CPU 8-player games
    if (isCpuMode && count === 8) {
      const win8p = data.dailyMissions.find(m => m.id === 'daily_win_cpu_8p');
      if (win8p && !win8p.completed) {
        win8p.current = Math.min(win8p.target, win8p.current + 1);
        if (win8p.current >= win8p.target) {
          win8p.completed = true;
          newlyCompletedMissions.push({ ...win8p });
        }
      }
    }

    // 5. Win five 6-player games in either vs. CPU or Multiplayer mode
    if ((isCpuMode || isOnlineMode) && count === 6) {
      const win6p = data.dailyMissions.find(m => m.id === 'daily_win_6p');
      if (win6p && !win6p.completed) {
        win6p.current = Math.min(win6p.target, win6p.current + 1);
        if (win6p.current >= win6p.target) {
          win6p.completed = true;
          newlyCompletedMissions.push({ ...win6p });
        }
      }
    }
  }

  // 6. Strategic: Century Club (Bank 70+ points in a single 3-roll turn)
  if (match.bankedCenturyClub) {
    const cc = data.dailyMissions.find(m => m.id === 'daily_century_club');
    if (cc && !cc.completed) {
      cc.current = 1;
      cc.completed = true;
      newlyCompletedMissions.push({ ...cc });
    }
  }

  // 7. Social: Friendly Showdown (Challenge a friend via SMS / direct invite and play 1 match)
  if (match.isFriendChallenge || match.mode === 'challenge_friend' || match.mode === 'challenge') {
    const fs = data.dailyMissions.find(m => m.id === 'daily_friendly_showdown');
    if (fs && !fs.completed) {
      fs.current = 1;
      fs.completed = true;
      newlyCompletedMissions.push({ ...fs });
    }
  }

  // 8. Strategic: Precision Roller (Win match without ever being in bottom two during elimination)
  if (match.isWin && match.precisionRoller) {
    const pr = data.dailyMissions.find(m => m.id === 'daily_precision_roller');
    if (pr && !pr.completed) {
      pr.current = 1;
      pr.completed = true;
      newlyCompletedMissions.push({ ...pr });
    }
  }

  // 9. Weekly: Score 5 Color Runs
  if (match.colorRunsScored > 0) {
    const crMission = data.weeklyMissions.find(m => m.id === 'weekly_color_runs_5');
    if (crMission && !crMission.completed) {
      crMission.current = Math.min(crMission.target, crMission.current + match.colorRunsScored);
      if (crMission.current >= crMission.target) {
        crMission.completed = true;
        newlyCompletedMissions.push({ ...crMission });
      }
    }
  }

  // 10. Weekly: Survive 50 Elimination Rounds
  if (match.survivedRounds > 0) {
    const survMission = data.weeklyMissions.find(m => m.id === 'weekly_survive_50');
    if (survMission && !survMission.completed) {
      survMission.current = Math.min(survMission.target, survMission.current + match.survivedRounds);
      if (survMission.current >= survMission.target) {
        survMission.completed = true;
        newlyCompletedMissions.push({ ...survMission });
      }
    }
  }

  // 11. Weekly: Color Master (Score a 5-of-a-kind color bonus in 3 different matches)
  if (match.scoredFiveOfAKind) {
    const cm = data.weeklyMissions.find(m => m.id === 'weekly_color_master_3');
    if (cm && !cm.completed) {
      cm.current = Math.min(cm.target, cm.current + 1);
      if (cm.current >= cm.target) {
        cm.completed = true;
        newlyCompletedMissions.push({ ...cm });
      }
    }
  }

  // 12. Weekly: Tiebreaker Hero (Win a sudden-death 12-dice roll-off elimination)
  if (match.wonTiebreaker) {
    const th = data.weeklyMissions.find(m => m.id === 'weekly_tiebreaker_hero');
    if (th && !th.completed) {
      th.current = 1;
      th.completed = true;
      newlyCompletedMissions.push({ ...th });
    }
  }

  // 13. Weekly: Underdog Ascendant (Win 1st place after entering elimination threshold in last place)
  if (match.isWin && match.underdogAscendant) {
    const ua = data.weeklyMissions.find(m => m.id === 'weekly_underdog_ascendant');
    if (ua && !ua.completed) {
      ua.current = 1;
      ua.completed = true;
      newlyCompletedMissions.push({ ...ua });
    }
  }

  saveMissionsData(userId, data);
  return { missionsData: data, newlyCompletedMissions };
}

/**
 * Tracks celebratory emotes sent during elimination rounds for "Emote Enthusiast"
 */
export function recordEmoteSent(
  userId: string,
  duringElimination: boolean
): {
  missionsData: MissionsData;
  newlyCompletedMissions: MissionGoal[];
} {
  const data = getMissionsData(userId);
  const newlyCompletedMissions: MissionGoal[] = [];

  if (duringElimination) {
    const emoteMission = data.dailyMissions.find(m => m.id === 'daily_emote_enthusiast');
    if (emoteMission && !emoteMission.completed) {
      emoteMission.current = Math.min(emoteMission.target, emoteMission.current + 1);
      if (emoteMission.current >= emoteMission.target) {
        emoteMission.completed = true;
        newlyCompletedMissions.push({ ...emoteMission });
      }
      saveMissionsData(userId, data);
    }
  }

  return { missionsData: data, newlyCompletedMissions };
}

/**
 * Claims reward for a completed mission.
 * Returns the number of coins awarded.
 */
export function claimMissionReward(
  userId: string,
  missionId: string
): {
  success: boolean;
  rewardCoins: number;
  mission?: MissionGoal;
  missionsData: MissionsData;
} {
  const data = getMissionsData(userId);
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  let targetMission = data.dailyMissions.find(m => m.id === missionId);
  let isDaily = true;

  if (!targetMission) {
    targetMission = data.weeklyMissions.find(m => m.id === missionId);
    isDaily = false;
  }

  if (!targetMission || !targetMission.completed || targetMission.claimed) {
    return { success: false, rewardCoins: 0, missionsData: data };
  }

  targetMission.claimed = true;
  const rewardCoins = targetMission.rewardCoins;

  // If this was a daily mission:
  if (isDaily) {
    // 1. Advance Weekly: Complete 15 daily missions
    const weeklyDailyCount = data.weeklyMissions.find(m => m.id === 'weekly_daily_missions_15');
    if (weeklyDailyCount && !weeklyDailyCount.completed) {
      data.totalDailyCompletedThisWeek += 1;
      weeklyDailyCount.current = Math.min(weeklyDailyCount.target, data.totalDailyCompletedThisWeek);
      if (weeklyDailyCount.current >= weeklyDailyCount.target) {
        weeklyDailyCount.completed = true;
      }
    }

    // 2. Advance Streak for 7-day streak
    if (data.lastDailyCompletionDate !== today) {
      if (data.lastDailyCompletionDate === yesterday) {
        data.streakDays += 1;
      } else {
        data.streakDays = 1;
      }
      data.lastDailyCompletionDate = today;

      // Update weekly 7-day streak mission
      const streakMission = data.weeklyMissions.find(m => m.id === 'weekly_streak_7');
      if (streakMission && !streakMission.completed) {
        streakMission.current = Math.min(streakMission.target, data.streakDays);
        if (streakMission.current >= streakMission.target) {
          streakMission.completed = true;
        }
      }
    }
  }

  saveMissionsData(userId, data);
  return {
    success: true,
    rewardCoins,
    mission: { ...targetMission },
    missionsData: data,
  };
}

/**
 * Checks if there are any unclaimed completed missions in daily or weekly tabs
 */
export function getUnclaimedMissionsCount(data: MissionsData): {
  dailyUnclaimed: number;
  weeklyUnclaimed: number;
  totalUnclaimed: number;
} {
  const dailyUnclaimed = data.dailyMissions.filter(m => m.completed && !m.claimed).length;
  const weeklyUnclaimed = data.weeklyMissions.filter(m => m.completed && !m.claimed).length;
  return {
    dailyUnclaimed,
    weeklyUnclaimed,
    totalUnclaimed: dailyUnclaimed + weeklyUnclaimed,
  };
}
