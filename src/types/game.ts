export type DiceColor = 'blue' | 'red' | 'green' | 'purple' | 'black' | 'lblue' | 'orange' | 'pink';

export interface Die {
  id: number;
  color: DiceColor;
  value: number; // 1 to 6
  zone: 'active' | 'saved';
  selected: boolean;
  slotIndex?: number;
}

export interface ScoreSet {
  value: number;
  count: number;
  base: number;
  cb: number;
  byColor: Record<string, number>;
}

export interface ScoreResult {
  total: number;
  sets: ScoreSet[];
}

export interface Friend {
  id: string;
  uid?: string;
  name: string;
  color: string;
  image?: string;
  status: 'online' | 'in-game' | 'offline';
  addedAt: string;
  gamesPlayed?: number;
}

export interface PlayerUnit {
  id: string;
  name: string;
  isCPU: boolean;
  isOnlinePlayer?: boolean;
  isOwner?: boolean;
  color: string;
  image?: string;
  score: number;
  history: Record<number, number>;
  active: boolean;
  place?: number;
  diceColors?: [DiceColor, DiceColor];
  uid?: string;
  sessionId?: string;
}

export interface TurnState {
  cpu: boolean;
  dice: Die[];
  rollsUsed: number;
  announced: Record<string, number>;
}

export type GamePhase = 'regular' | 'elimination' | 'over';

export interface GameSettings {
  playersCount: number;
  mode: 'cpu' | 'pass_and_play' | 'challenge' | 'online' | 'challenge_friend';
  isChallenge?: boolean;
  threshold: number;
  colorA: DiceColor;
  colorB: DiceColor;
  tier?: 'standard' | 'double' | 'high_roller';
  buyIn?: number;
  payoutMultiplier?: number;
  payouts?: number[];
  adPlayedDuringMatchmaking?: boolean;
  roomId?: string;
  slots: Array<{
    name: string;
    type: 'human' | 'cpu';
    isOnlinePlayer?: boolean;
    isOwner?: boolean;
    color: string;
    image?: string;
    diceColors?: [DiceColor, DiceColor];
    uid?: string;
    sessionId?: string;
  }>;
}

export interface UserAvatar {
  color: string;
  name: string;
  image?: string;
}

export interface UserAccount {
  uid: string;
  name: string;
  email: string | null;
  phoneNumber?: string;
  provider: 'guest' | 'email' | 'google' | 'apple';
  avatar: UserAvatar;
  scoreboardUnlocked: boolean;
  isAdFree?: boolean;
  adFreePlan?: 'monthly' | 'yearly';
  adFreeBillingDate?: string;
  adFreeRecurring?: boolean;
  isGuest?: boolean;
  createdAt?: string;
  diceColors?: [DiceColor, DiceColor];
}

export interface UserFileRecord {
  id: string;
  userId: string;
  name: string;
  size: number;
  type: string;
  uploadDate: string;
  dataUrl?: string;
  notes?: string;
}

export interface ShopSettings {
  equippedColors: [DiceColor, DiceColor];
  unlockedColors: DiceColor[];
  equippedBg: string;
  unlockedBgs: string[];
  volume: number; // 0 to 100
}

export interface ScoreboardPlayer {
  name: string;
  type: 'human' | 'cpu';
  total: number;
  active: boolean;
  place?: number;
  history: Record<number, number>;
}

export interface ScoreboardSession {
  id: string;
  date: string;
  threshold: number;
  round: number;
  phase: GamePhase;
  elimPerRound: number;
  players: ScoreboardPlayer[];
  currentIdx: number;
  pending: number[];
}
