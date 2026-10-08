import crypto from 'crypto';
import {
  GRANT_RULES,
  GrantReason,
  MatchTier,
  WELCOME_COINS,
  MAX_BUY_IN,
  MAX_SHOP_PRICE,
  MATCH_TICKET_TTL_MS,
  MAX_FREE_GAME_PRIZES_PER_DAY,
  DAILY_BONUS_COINS_PER_PIP,
  prizeForPlacement,
} from '../src/lib/economy.ts';
import { createInitialDailyMissions, createInitialWeeklyMissions } from '../src/lib/missions.ts';
import { LEVEL_REWARDS } from '../src/lib/levelSystem.ts';

/**
 * Server-side coin wallets. Every balance change goes through here, inside a
 * transaction, using the limits in src/lib/economy.ts.
 */

/** Coupon codes live only on the server so they don't ship inside the app */
const COUPON_CODES: Record<string, number> = {
  DGLFREE300: 300, // email subscriber reward
  DGL1000FREE: 1000, // app tester reward
};

const MAX_LEVEL_REWARD_CLAIMS_PER_DAY = 20;
const MAX_PRESTIGE = 100;
const MAX_ADMIN_BALANCE = 10_000_000;

const MISSION_REWARDS = new Map(
  [...createInitialDailyMissions(), ...createInitialWeeklyMissions()].map(m => [
    m.id,
    { coins: m.rewardCoins, type: m.type },
  ])
);

const LEVEL_COIN_REWARDS = new Map(
  LEVEL_REWARDS.filter(r => r.type === 'coins' && r.coinsAmount).map(r => [r.rewardId, r.coinsAmount!])
);

export interface Wallet {
  balance: number;
  /** UTC day the counters below belong to */
  day: string;
  /** Claims made today, by reason */
  dayCounts: Record<string, number>;
  /** Mission id -> period (day or week) it was last claimed in */
  claimedMissions: Record<string, string>;
  /** "<prestige>:<rewardId>" for level rewards already paid */
  claimedLevelRewards: string[];
  redeemedCoupons: string[];
  createdAt: number;
  updatedAt: number;
}

export interface MatchTicket {
  buyIn: number;
  playerCount: number;
  tier: MatchTier;
  createdAt: number;
  claimed: boolean;
}

export interface LedgerEntry {
  delta: number;
  balance: number;
  reason: string;
  ref?: string;
  timestamp: number;
}

/** One transaction against one player's wallet. Do all reads before any writes. */
export interface WalletTx {
  getWallet(): Promise<Wallet | null>;
  getMatch(matchId: string): Promise<MatchTicket | null>;
  setWallet(wallet: Wallet): void;
  setMatch(matchId: string, ticket: MatchTicket): void;
  addLedger(entry: LedgerEntry): void;
}

export interface WalletStore {
  runTransaction<T>(uid: string, fn: (tx: WalletTx) => Promise<T>): Promise<T>;
  /** Balance kept on the player's profile before wallets existed, used once to open the wallet */
  getLegacyCoins(uid: string): Promise<number | null>;
}

export class WalletError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function utcWeek(now: number): string {
  // ISO week number
  const d = new Date(now);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function newWallet(balance: number, now: number): Wallet {
  return {
    balance,
    day: utcDay(now),
    dayCounts: {},
    claimedMissions: {},
    claimedLevelRewards: [],
    redeemedCoupons: [],
    createdAt: now,
    updatedAt: now,
  };
}

function isWholeNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

export class WalletService {
  constructor(private store: WalletStore, private now: () => number = Date.now) {}

  /** Runs `fn` on the player's wallet (opening it if needed) and saves any change */
  private async withWallet<T>(
    uid: string,
    fn: (wallet: Wallet, tx: WalletTx, now: number) => Promise<T> | T
  ): Promise<T> {
    const legacy = await this.store.getLegacyCoins(uid);
    return this.store.runTransaction(uid, async rawTx => {
      const now = this.now();
      let wallet = await rawTx.getWallet();
      const isNew = !wallet;
      if (!wallet) {
        wallet = newWallet(legacy !== null && legacy >= 0 ? Math.floor(legacy) : WELCOME_COINS, now);
      }
      if (wallet.day !== utcDay(now)) {
        wallet = { ...wallet, day: utcDay(now), dayCounts: {} };
      }
      // Firestore transactions need every read before the first write, so a new
      // wallet is only saved after `fn` has done its reads
      let walletWritten = false;
      const tx: WalletTx = {
        getWallet: rawTx.getWallet.bind(rawTx),
        getMatch: rawTx.getMatch.bind(rawTx),
        setMatch: rawTx.setMatch.bind(rawTx),
        addLedger: rawTx.addLedger.bind(rawTx),
        setWallet: w => {
          walletWritten = true;
          rawTx.setWallet(w);
        },
      };
      const result = await fn(wallet, tx, now);
      if (isNew && !walletWritten) tx.setWallet(wallet);
      return result;
    });
  }

  private apply(
    tx: WalletTx,
    wallet: Wallet,
    delta: number,
    reason: string,
    now: number,
    countKey?: string,
    ref?: string
  ): Wallet {
    const next: Wallet = {
      ...wallet,
      balance: wallet.balance + delta,
      dayCounts: countKey
        ? { ...wallet.dayCounts, [countKey]: (wallet.dayCounts[countKey] || 0) + 1 }
        : wallet.dayCounts,
      updatedAt: now,
    };
    tx.setWallet(next);
    tx.addLedger({ delta, balance: next.balance, reason, ...(ref ? { ref } : {}), timestamp: now });
    return next;
  }

  async getBalance(uid: string): Promise<number> {
    return this.withWallet(uid, wallet => wallet.balance);
  }

  /** Free coins, referral rewards and (for now) coin packs, within GRANT_RULES limits */
  async grant(uid: string, reason: unknown, amount: unknown): Promise<number> {
    if (typeof reason !== 'string' || !(reason in GRANT_RULES)) {
      throw new WalletError(400, 'invalid_reason', 'Unknown reward type.');
    }
    const rule = GRANT_RULES[reason as GrantReason];
    if (!isWholeNumber(amount) || !rule.allowedAmounts.includes(amount)) {
      throw new WalletError(400, 'invalid_amount', 'That reward amount is not allowed.');
    }
    return this.withWallet(uid, (wallet, tx, now) => {
      if ((wallet.dayCounts[reason] || 0) >= rule.maxPerDay) {
        throw new WalletError(409, 'daily_limit', 'Daily limit reached for this reward. Try again tomorrow.');
      }
      if (rule.maxBalance !== undefined && wallet.balance >= rule.maxBalance) {
        throw new WalletError(409, 'balance_too_high', 'Free coins are only available when you are low on coins.');
      }
      return this.apply(tx, wallet, amount, reason, now, reason).balance;
    });
  }

  async spend(uid: string, amount: unknown, ref?: unknown): Promise<number> {
    if (!isWholeNumber(amount) || amount <= 0 || amount > MAX_SHOP_PRICE) {
      throw new WalletError(400, 'invalid_amount', 'Invalid price.');
    }
    return this.withWallet(uid, (wallet, tx, now) => {
      if (wallet.balance < amount) {
        throw new WalletError(409, 'insufficient_coins', 'Not enough coins.');
      }
      const item = typeof ref === 'string' ? ref.slice(0, 64) : undefined;
      return this.apply(tx, wallet, -amount, 'shop_purchase', now, undefined, item).balance;
    });
  }

  /** Rolls the two daily bonus dice on the server, once per UTC day */
  async dailyBonus(uid: string): Promise<{ red: number; blue: number; coins: number; balance: number }> {
    return this.withWallet(uid, (wallet, tx, now) => {
      if ((wallet.dayCounts.daily_bonus || 0) >= 1) {
        throw new WalletError(409, 'already_claimed', 'Daily bonus already claimed today.');
      }
      const red = crypto.randomInt(1, 7);
      const blue = crypto.randomInt(1, 7);
      const coins = (red + blue) * DAILY_BONUS_COINS_PER_PIP;
      const next = this.apply(tx, wallet, coins, 'daily_bonus', now, 'daily_bonus', `${red}+${blue}`);
      return { red, blue, coins, balance: next.balance };
    });
  }

  async redeemCoupon(uid: string, rawCode: unknown): Promise<{ coins: number; balance: number }> {
    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    const coins = COUPON_CODES[code];
    if (!coins) {
      throw new WalletError(404, 'unknown_coupon', 'Coupon code not recognized.');
    }
    return this.withWallet(uid, (wallet, tx, now) => {
      if (wallet.redeemedCoupons.includes(code)) {
        throw new WalletError(409, 'already_redeemed', 'This coupon code has already been redeemed on this account.');
      }
      const next = this.apply(
        tx,
        { ...wallet, redeemedCoupons: [...wallet.redeemedCoupons, code] },
        coins,
        'coupon',
        now,
        undefined,
        code
      );
      return { coins, balance: next.balance };
    });
  }

  /** Pays a mission's catalog reward, once per day (daily) or week (weekly) */
  async missionReward(uid: string, missionId: unknown): Promise<{ coins: number; balance: number }> {
    const mission = typeof missionId === 'string' ? MISSION_REWARDS.get(missionId) : undefined;
    if (!mission) {
      throw new WalletError(404, 'unknown_mission', 'Unknown mission.');
    }
    const id = missionId as string;
    return this.withWallet(uid, (wallet, tx, now) => {
      const period = mission.type === 'weekly' ? utcWeek(now) : utcDay(now);
      if (wallet.claimedMissions[id] === period) {
        throw new WalletError(409, 'already_claimed', 'Mission reward already claimed.');
      }
      const next = this.apply(
        tx,
        { ...wallet, claimedMissions: { ...wallet.claimedMissions, [id]: period } },
        mission.coins,
        'mission_reward',
        now,
        undefined,
        id
      );
      return { coins: mission.coins, balance: next.balance };
    });
  }

  /** Pays level-up coin rewards from the catalog, once per reward per prestige */
  async levelRewards(
    uid: string,
    rewardIds: unknown,
    prestige: unknown
  ): Promise<{ coins: number; balance: number }> {
    if (!Array.isArray(rewardIds) || rewardIds.length === 0 || rewardIds.length > 10) {
      throw new WalletError(400, 'invalid_rewards', 'Invalid level rewards.');
    }
    if (!isWholeNumber(prestige) || prestige < 0 || prestige > MAX_PRESTIGE) {
      throw new WalletError(400, 'invalid_prestige', 'Invalid prestige.');
    }
    return this.withWallet(uid, (wallet, tx, now) => {
      if ((wallet.dayCounts.level_reward || 0) >= MAX_LEVEL_REWARD_CLAIMS_PER_DAY) {
        throw new WalletError(409, 'daily_limit', 'Daily limit reached for level rewards.');
      }
      const claimed = new Set(wallet.claimedLevelRewards);
      let coins = 0;
      for (const rewardId of rewardIds) {
        const amount = typeof rewardId === 'string' ? LEVEL_COIN_REWARDS.get(rewardId) : undefined;
        const key = `${prestige}:${rewardId}`;
        if (amount && !claimed.has(key)) {
          claimed.add(key);
          coins += amount;
        }
      }
      if (coins === 0) {
        throw new WalletError(409, 'already_claimed', 'Level rewards already claimed.');
      }
      const next = this.apply(
        tx,
        { ...wallet, claimedLevelRewards: [...claimed] },
        coins,
        'level_reward',
        now,
        'level_reward'
      );
      return { coins, balance: next.balance };
    });
  }

  /** Charges the buy-in and issues the ticket the prize is claimed with */
  async startMatch(
    uid: string,
    input: { buyIn?: unknown; playerCount?: unknown; tier?: unknown }
  ): Promise<{ matchId: string; balance: number }> {
    const buyIn = input.buyIn ?? 0;
    const { playerCount, tier = 'standard' } = input;
    if (!isWholeNumber(buyIn) || buyIn < 0 || buyIn > MAX_BUY_IN) {
      throw new WalletError(400, 'invalid_buy_in', 'Invalid buy-in.');
    }
    if (!isWholeNumber(playerCount) || playerCount < 2 || playerCount > 8) {
      throw new WalletError(400, 'invalid_players', 'Invalid player count.');
    }
    if (tier !== 'standard' && tier !== 'double' && tier !== 'high_roller') {
      throw new WalletError(400, 'invalid_tier', 'Invalid game tier.');
    }
    const matchId = crypto.randomUUID();
    return this.withWallet(uid, (wallet, tx, now) => {
      if (wallet.balance < buyIn) {
        throw new WalletError(409, 'insufficient_coins', `Not enough coins — need 🪙 ${buyIn} to play.`);
      }
      tx.setMatch(matchId, { buyIn, playerCount, tier, createdAt: now, claimed: false });
      const next = buyIn > 0 ? this.apply(tx, wallet, -buyIn, 'buy_in', now, undefined, matchId) : wallet;
      if (buyIn === 0) tx.setWallet(next);
      return { matchId, balance: next.balance };
    });
  }

  /** Pays the prize for a finishing place, once per game ticket */
  async claimMatchPrize(
    uid: string,
    matchId: unknown,
    placement: unknown
  ): Promise<{ prize: number; balance: number }> {
    if (typeof matchId !== 'string' || matchId.length > 64) {
      throw new WalletError(400, 'invalid_match', 'Invalid game.');
    }
    return this.withWallet(uid, async (wallet, tx, now) => {
      const ticket = await tx.getMatch(matchId);
      if (!ticket) throw new WalletError(404, 'unknown_match', 'Game not found.');
      if (ticket.claimed) throw new WalletError(409, 'already_claimed', 'Prize already claimed for this game.');
      if (now - ticket.createdAt > MATCH_TICKET_TTL_MS) {
        throw new WalletError(409, 'expired', 'This game is too old to claim a prize.');
      }
      if (!isWholeNumber(placement) || placement < 1 || placement > ticket.playerCount) {
        throw new WalletError(400, 'invalid_placement', 'Invalid finishing place.');
      }
      const prize = prizeForPlacement(ticket.playerCount, ticket.tier, ticket.buyIn, placement);
      const isFreeGamePrize = ticket.buyIn === 0 && prize > 0;
      if (isFreeGamePrize && (wallet.dayCounts.free_game_prize || 0) >= MAX_FREE_GAME_PRIZES_PER_DAY) {
        throw new WalletError(409, 'daily_limit', 'Daily limit reached for free-game prizes.');
      }
      tx.setMatch(matchId, { ...ticket, claimed: true });
      if (prize === 0) {
        tx.setWallet(wallet);
        return { prize, balance: wallet.balance };
      }
      const next = this.apply(
        tx,
        wallet,
        prize,
        'match_prize',
        now,
        isFreeGamePrize ? 'free_game_prize' : undefined,
        matchId
      );
      return { prize, balance: next.balance };
    });
  }

  async adminSetBalance(adminUid: string, uid: unknown, amount: unknown): Promise<number> {
    if (typeof uid !== 'string' || !uid || uid.length > 128) {
      throw new WalletError(400, 'invalid_user', 'Invalid user.');
    }
    if (!isWholeNumber(amount) || amount < 0 || amount > MAX_ADMIN_BALANCE) {
      throw new WalletError(400, 'invalid_amount', 'Invalid amount.');
    }
    return this.withWallet(uid, (wallet, tx, now) => {
      return this.apply(tx, wallet, amount - wallet.balance, 'admin_set', now, undefined, adminUid).balance;
    });
  }
}
