/**
 * Coin economy rules shared by the app and the server (server.ts).
 *
 * The server is the only place that changes a player's coin balance. It uses these
 * tables to decide how many coins each kind of grant is worth and how often it can
 * be claimed, so the app cannot award itself arbitrary coins.
 */

export type MatchTier = 'standard' | 'double' | 'high_roller';

/** Base prize table by number of players (standard tier, 10-coin buy-in) */
export const STANDARD_PAYOUTS: Record<number, number[]> = {
  2: [16],
  3: [18, 6],
  4: [20, 10],
  5: [25, 10, 5],
  6: [30, 15, 5],
  8: [40, 20, 10],
};

/** Prize for winning a game that has no buy-in */
export const FREE_GAME_WIN_BONUS = 150;

export function calculatePayouts(
  playerCount: number,
  tier: MatchTier = 'standard',
  customBuyIn?: number
): number[] {
  const base = STANDARD_PAYOUTS[playerCount] || [16];
  if (customBuyIn === 0) {
    return base.map(() => 0);
  }
  if (typeof customBuyIn === 'number' && customBuyIn > 0) {
    const scale = customBuyIn / 10;
    return base.map(p => Math.round(p * scale));
  }
  const mult = tier === 'high_roller' ? 5 : tier === 'double' ? 2 : 1;
  return base.map(p => p * mult);
}

/** Prize the server pays for a finishing place, matching what the app shows */
export function prizeForPlacement(
  playerCount: number,
  tier: MatchTier,
  buyIn: number,
  placement: number
): number {
  if (buyIn <= 0) return placement === 1 ? FREE_GAME_WIN_BONUS : 0;
  return calculatePayouts(playerCount, tier, buyIn)[placement - 1] || 0;
}

/** Coins every new account starts with */
export const WELCOME_COINS = 200;

/** Largest buy-in a game can have (custom Friends Challenge buy-ins included) */
export const MAX_BUY_IN = 1000;

/** How long a started game can still claim its prize */
export const MATCH_TICKET_TTL_MS = 6 * 60 * 60 * 1000;

/** Most free-game win bonuses a player can collect per day */
export const MAX_FREE_GAME_PRIZES_PER_DAY = 25;

/** Daily bonus: the server rolls two dice and pays this many coins per pip */
export const DAILY_BONUS_COINS_PER_PIP = 10;

/**
 * Grant reasons the app can request, with the server-enforced limits.
 * The daily bonus, missions, level rewards, coupons and match prizes have their own
 * server endpoints that check the app's catalogs instead.
 */
export type GrantReason = 'free_coins' | 'referral' | 'coin_pack';

export interface GrantRule {
  /** Exact amounts allowed for this grant */
  allowedAmounts: number[];
  /** Most times it can be claimed per day (UTC) */
  maxPerDay: number;
  /** Only allowed when the balance is below this */
  maxBalance?: number;
}

export const GRANT_RULES: Record<GrantReason, GrantRule> = {
  // "Low on coins?" (+100) and the automatic +50 when a buy-in can't be covered
  free_coins: { allowedAmounts: [50, 100], maxPerDay: 5, maxBalance: 100 },
  referral: { allowedAmounts: [300], maxPerDay: 3 },
  // TESTING ONLY: coin packs are not charged yet. Replace with App Store / Google Play
  // receipt verification on the server before launch.
  coin_pack: { allowedAmounts: [100, 200, 500, 1000, 2000], maxPerDay: 5 },
};

/** Spending reasons (coins leave the balance) */
export type SpendReason = 'shop_purchase';

export const MAX_SHOP_PRICE = 10000;
