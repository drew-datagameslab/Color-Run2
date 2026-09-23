import { ShopSettings, UserAccount, ScoreboardSession } from '../types/game';

const USER_KEY = 'cr_user';
const SHOP_KEY = 'cr_shop';
const COINS_PREFIX = 'cr_coins_';
const SB_HISTORY_KEY = 'cr_sb_history';
const AD_FREE_KEY = 'cr_adfree';

export const DEFAULT_AVATARS = [
  '#e5352f', '#1f7fd6', '#e58a1f', '#8e44c9',
  '#159e8a', '#d61f7a', '#0d4d23', '#4a5568',
];

export function verifyHomeGameCode(rawCode: string): boolean {
  if (!rawCode) return false;
  const code = rawCode.trim().toUpperCase();
  if (!code) return false;

  // Recognized developer / reviewer test code from the physical box rules
  if (code === 'CR-TEST-TEST') return true;

  // Named promo & production codes
  const validNamed = ['COLORRUN', 'COLORRUN2024', 'COLORRUN-HOME', 'COLOR-RUN', 'HOME-EDITION', 'HOMEGAME'];
  if (validNamed.includes(code)) return true;

  // Format: CR-XXXX-XXXX or CR-XXXX (4-12 alphanumeric characters after prefix)
  const codeRegex = /^CR-[A-Z0-9]{3,8}(-[A-Z0-9]{3,8})?$/;
  if (codeRegex.test(code)) return true;

  return false;
}

export function getInitialUser(): UserAccount {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Synchronize with cr_adfree if present
      const adFreeGlobal = localStorage.getItem(AD_FREE_KEY) === '1';
      // Migrate old bright green avatar color to high-contrast dark green
      const avatarColor =
        parsed.avatar?.color === '#2f9a4f' || parsed.avatar?.color === '#3a7d1f' || parsed.avatar?.color === '#27ae60'
          ? '#0d4d23'
          : (parsed.avatar?.color || DEFAULT_AVATARS[0]);

      return {
        ...parsed,
        avatar: {
          ...parsed.avatar,
          color: avatarColor,
        },
        scoreboardUnlocked: parsed.scoreboardUnlocked ?? false,
        isAdFree: parsed.isAdFree || adFreeGlobal,
        diceColors: parsed.diceColors || ['blue', 'red'],
      };
    }
  } catch {
    // Ignore
  }
  const adFreeGlobal = typeof window !== 'undefined' && localStorage.getItem(AD_FREE_KEY) === '1';
  return {
    uid: 'guest_' + Math.random().toString(36).slice(2, 10),
    name: 'Player',
    email: null,
    provider: 'guest',
    avatar: {
      color: DEFAULT_AVATARS[0],
      name: 'P1',
      image: null,
    },
    scoreboardUnlocked: false,
    isAdFree: !!adFreeGlobal,
    diceColors: ['blue', 'red'],
  };
}

export function saveUser(user: UserAccount): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (user.isAdFree) {
      localStorage.setItem(AD_FREE_KEY, '1');
    }
    // Also keep registered accounts in sync if user registered with email
    if (user.email) {
      const cleanEmail = user.email.toLowerCase().trim();
      const accounts = getRegisteredAccounts();
      if (accounts[cleanEmail]) {
        accounts[cleanEmail].user = { ...accounts[cleanEmail].user, ...user };
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      }
    }
  } catch {
    // Ignore
  }
}

export function redeemHomeGameCode(
  user: UserAccount,
  code: string
): { success: boolean; user: UserAccount; message: string } {
  if (!verifyHomeGameCode(code)) {
    return {
      success: false,
      user,
      message: 'Code not recognized. Please check your user guide or try CR-TEST-TEST.',
    };
  }

  const updated: UserAccount = {
    ...user,
    isAdFree: true,
    scoreboardUnlocked: true,
  };
  saveUser(updated);

  return {
    success: true,
    user: updated,
    message: 'Home Game code verified! Companion Scoreboard unlocked & ads removed!',
  };
}

export function setAdFree(
  user: UserAccount,
  adFree: boolean,
  subscription?: {
    plan?: 'monthly' | 'yearly';
    billingDate?: string;
    recurring?: boolean;
  }
): UserAccount {
  const updated: UserAccount = {
    ...user,
    isAdFree: adFree,
    adFreePlan: subscription?.plan ?? user.adFreePlan,
    adFreeBillingDate: subscription?.billingDate ?? user.adFreeBillingDate,
    adFreeRecurring: subscription?.recurring !== undefined ? subscription.recurring : user.adFreeRecurring,
  };
  saveUser(updated);
  return updated;
}

export function removeAdFreeAutomaticCharge(user: UserAccount): UserAccount {
  const updated: UserAccount = {
    ...user,
    adFreeRecurring: false,
  };
  saveUser(updated);
  return updated;
}

export function resumeAdFreeAutomaticCharge(user: UserAccount): UserAccount {
  const updated: UserAccount = {
    ...user,
    adFreeRecurring: true,
  };
  saveUser(updated);
  return updated;
}

const ACCOUNTS_KEY = 'cr_registered_accounts';

export interface RegisteredAccount {
  email: string;
  password: string;
  user: UserAccount;
  createdAt: string;
}

export function getRegisteredAccounts(): Record<string, RegisteredAccount> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return {};
}

export function saveRegisteredAccount(acc: RegisteredAccount): void {
  try {
    const accounts = getRegisteredAccounts();
    accounts[acc.email.toLowerCase().trim()] = acc;
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore
  }
}

export function registerEmailUser(
  email: string,
  password: string,
  displayName?: string
): { success: boolean; user?: UserAccount; message: string } {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }
  if (!password || password.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters long.' };
  }

  const accounts = getRegisteredAccounts();
  if (accounts[cleanEmail]) {
    return { success: false, message: 'An account with this email already exists. Please Sign In instead.' };
  }

  const baseName = (displayName?.trim() || cleanEmail.split('@')[0] || 'Player');
  const formattedName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  const uid = 'email_' + Math.random().toString(36).slice(2, 10);

  const newUser: UserAccount = {
    uid,
    name: formattedName,
    email: cleanEmail,
    provider: 'email',
    avatar: {
      color: DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)],
      name: formattedName.slice(0, 2).toUpperCase(),
    },
    scoreboardUnlocked: true,
    diceColors: ['blue', 'red'],
  };

  saveRegisteredAccount({
    email: cleanEmail,
    password,
    user: newUser,
    createdAt: new Date().toISOString(),
  });
  saveUser(newUser);
  setUserCoins(newUser.uid, 500);

  return {
    success: true,
    user: newUser,
    message: `Account created successfully! Welcome, ${formattedName}!`,
  };
}

export function loginEmailUser(
  email: string,
  password: string
): { success: boolean; user?: UserAccount; message: string } {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail || !password) {
    return { success: false, message: 'Please enter both email and password.' };
  }

  const accounts = getRegisteredAccounts();
  const acc = accounts[cleanEmail];

  if (!acc) {
    return {
      success: false,
      message: 'No account found with this email. Please create a password under "Create Account".',
    };
  }

  if (acc.password !== password) {
    return {
      success: false,
      message: 'Incorrect password. Please verify and try again.',
    };
  }

  saveUser(acc.user);
  return {
    success: true,
    user: acc.user,
    message: `Welcome back, ${acc.user.name}!`,
  };
}

export function loginOAuthUser(
  provider: 'google' | 'apple',
  options?: { name?: string; email?: string; photo?: string }
): UserAccount {
  const defaultName = provider === 'google' ? 'Google Player' : 'Apple Player';
  const name = options?.name || defaultName;
  const email = options?.email || `${provider.toLowerCase()}player@example.com`;
  const uid = `${provider}_` + Math.random().toString(36).slice(2, 10);

  const user: UserAccount = {
    uid,
    name,
    email,
    provider,
    avatar: {
      color: provider === 'google' ? '#e5352f' : '#222222',
      name: name.slice(0, 2).toUpperCase(),
      image: options?.photo,
    },
    scoreboardUnlocked: true,
    diceColors: ['blue', 'red'],
  };

  saveUser(user);
  return user;
}

export function getUserCoins(uid: string): number {
  try {
    const raw = localStorage.getItem(COINS_PREFIX + uid);
    if (raw !== null) return parseInt(raw, 10) || 0;
  } catch {
    // Ignore
  }
  // New users get 200 coins when they sign in
  return 200;
}

export function setUserCoins(uid: string, amount: number): void {
  try {
    localStorage.setItem(COINS_PREFIX + uid, String(Math.max(0, amount)));
  } catch {
    // Ignore
  }
}

export function addCoins(uid: string, delta: number): number {
  const cur = getUserCoins(uid);
  const next = Math.max(0, cur + delta);
  setUserCoins(uid, next);
  return next;
}

// -------------------------------------------------------------
// Daily Bonus Tracking (Resets at local midnight each day)
// -------------------------------------------------------------

export function getLocalTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function hasClaimedDailyBonus(userId: string): boolean {
  try {
    const today = getLocalTodayString();
    const key = `cr_daily_bonus_${userId}_${today}`;
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markDailyBonusClaimed(userId: string): void {
  try {
    const today = getLocalTodayString();
    const key = `cr_daily_bonus_${userId}_${today}`;
    localStorage.setItem(key, '1');
  } catch {
    // Ignore
  }
}

// -------------------------------------------------------------
// Coupon Codes System (Case-insensitive)
// -------------------------------------------------------------

const COUPONS_PREFIX = 'cr_redeemed_coupons_';

export function getRedeemedCoupons(userId: string): string[] {
  try {
    const raw = localStorage.getItem(COUPONS_PREFIX + userId);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return [];
}

export function redeemShopCoupon(
  userId: string,
  rawCode: string
): { success: boolean; coins: number; message: string; couponId?: string } {
  if (!rawCode || !rawCode.trim()) {
    return { success: false, coins: 0, message: 'Please enter a coupon code.' };
  }

  const code = rawCode.trim().toUpperCase();
  const redeemed = getRedeemedCoupons(userId);

  if (redeemed.includes(code)) {
    return {
      success: false,
      coins: 0,
      message: 'This coupon code has already been redeemed on this account.',
    };
  }

  // 1. Email subscriber reward code (300 coins)
  if (code === 'DGLFREE300') {
    const updated = [...redeemed, code];
    try {
      localStorage.setItem(COUPONS_PREFIX + userId, JSON.stringify(updated));
    } catch {}
    addCoins(userId, 300);
    return {
      success: true,
      coins: 300,
      message: 'Congratulations! 300 Coins added for verifying your email!',
      couponId: code,
    };
  }

  // 2. Tester reward code (1000 coins)
  if (code === 'DGL1000FREE') {
    const updated = [...redeemed, code];
    try {
      localStorage.setItem(COUPONS_PREFIX + userId, JSON.stringify(updated));
    } catch {}
    addCoins(userId, 1000);
    return {
      success: true,
      coins: 1000,
      message: 'App Tester reward verified! 1,000 Coins added!',
      couponId: code,
    };
  }

  return {
    success: false,
    coins: 0,
    message: 'Invalid or expired coupon code. Check for typos and try again.',
  };
}

export const DEFAULT_SHOP: ShopSettings = {
  equippedColors: ['blue', 'red'],
  unlockedColors: ['blue', 'red'],
  equippedBg: 'wood',
  unlockedBgs: ['wood', 'bg-wood'],
  volume: 70,
};

export function getShopSettings(): ShopSettings {
  try {
    const raw = localStorage.getItem(SHOP_KEY);
    if (raw) return { ...DEFAULT_SHOP, ...JSON.parse(raw) };
  } catch {
    // Ignore
  }
  return DEFAULT_SHOP;
}

export function saveShopSettings(settings: ShopSettings): void {
  try {
    localStorage.setItem(SHOP_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

export function getScoreboardHistory(): ScoreboardSession[] {
  try {
    const raw = localStorage.getItem(SB_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return [];
}

export function saveScoreboardHistory(sessions: ScoreboardSession[]): void {
  try {
    localStorage.setItem(SB_HISTORY_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore
  }
}
