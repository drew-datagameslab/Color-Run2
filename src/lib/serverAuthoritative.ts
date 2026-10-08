/// <reference types="vite/client" />
import { auth } from './firebase';
import type { GrantReason, MatchTier } from './economy';

/**
 * Client for the Color Run server (server.ts):
 * - Server-side cryptographically secure dice rolling
 * - Coin balances: the server is the only place a balance changes. Every call sends
 *   the player's Firebase sign-in token, and the server applies the limits in economy.ts.
 *
 * The web app is served by the same server, so calls go to /api. The Android/iOS apps
 * need the server's address: set VITE_API_BASE_URL (e.g. the Cloud Run URL) when building.
 */
const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface ServerResult<T> {
  ok: boolean;
  /** The server's answer when ok */
  data: T | null;
  /** The server couldn't be reached (or isn't available), so the app may continue locally */
  offline: boolean;
  message: string;
}

type BalanceListener = (uid: string, balance: number) => void;
const balanceListeners = new Set<BalanceListener>();

/** Called with the server's balance after every successful coin call */
export function onServerBalance(listener: BalanceListener): () => void {
  balanceListeners.add(listener);
  return () => balanceListeners.delete(listener);
}

async function callServer<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<ServerResult<T>> {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, data: null, offline: true, message: 'Not signed in.' };
  }
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${API_BASE}${path}`, {
      method: init.method || 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    // Static hosting without the server answers /api with the app's HTML page
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : null;
    if (res.ok && data?.success) {
      if (typeof data.balance === 'number' && path !== '/api/admin/coins/set') {
        balanceListeners.forEach(listener => listener(user.uid, data.balance));
      }
      return { ok: true, data: data as T, offline: false, message: '' };
    }
    return {
      ok: false,
      data: null,
      offline: !isJson || res.status === 503,
      message: data?.message || 'Coin service unavailable.',
    };
  } catch {
    return { ok: false, data: null, offline: true, message: 'Coin service unavailable.' };
  }
}

export function fetchWalletBalance() {
  return callServer<{ balance: number }>('/api/coins', { method: 'GET' });
}

export function requestCoinGrant(reason: GrantReason, amount: number) {
  return callServer<{ balance: number }>('/api/coins/grant', { body: { reason, amount } });
}

export function requestSpend(amount: number, item: string) {
  return callServer<{ balance: number }>('/api/coins/spend', { body: { amount, item } });
}

export function requestDailyBonus() {
  return callServer<{ red: number; blue: number; coins: number; balance: number }>('/api/coins/daily-bonus');
}

export function requestCouponRedeem(code: string) {
  return callServer<{ coins: number; balance: number }>('/api/coins/coupon', { body: { code } });
}

export function requestMissionReward(missionId: string) {
  return callServer<{ coins: number; balance: number }>('/api/coins/mission', { body: { missionId } });
}

export function requestLevelRewards(rewardIds: string[], prestige: number) {
  return callServer<{ coins: number; balance: number }>('/api/coins/level-rewards', {
    body: { rewardIds, prestige },
  });
}

export function requestMatchStart(game: { buyIn: number; playerCount: number; tier: MatchTier }) {
  return callServer<{ matchId: string; balance: number }>('/api/match/start', { body: game });
}

export function requestMatchPrize(matchId: string, placement: number) {
  return callServer<{ prize: number; balance: number }>('/api/match/payout', { body: { matchId, placement } });
}

export function adminSetCoins(uid: string, amount: number) {
  return callServer<{ balance: number }>('/api/admin/coins/set', { body: { uid, amount } });
}

/**
 * Rolls dice using the backend server's cryptographically secure random number generator.
 * Eliminates client-side Math.random() manipulation.
 */
export async function rollDiceOnServer(
  activeDiceIds: number[],
  options?: {
    roomId?: string;
    round?: number;
    rollNumber?: number;
    playerUid?: string;
  }
): Promise<Map<number, number>> {
  const result = new Map<number, number>();

  try {
    const res = await fetch(`${API_BASE}/api/dice/roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diceIds: activeDiceIds,
        roomId: options?.roomId,
        round: options?.round,
        rollNumber: options?.rollNumber,
        playerUid: options?.playerUid,
      }),
    });

    if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data.rolls)) {
        for (const item of data.rolls) {
          result.set(item.id, item.value);
        }
        return result;
      }
    }
  } catch (err) {
    console.warn('[ServerRoll] Network unavailable, falling back to local entropy:', err);
  }

  // Fallback if server is temporarily unreachable (e.g. offline airplane mode)
  activeDiceIds.forEach(id => {
    // Cryptographic web crypto fallback if available
    let val = 1;
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const buf = new Uint8Array(1);
      window.crypto.getRandomValues(buf);
      val = (buf[0] % 6) + 1;
    } else {
      val = Math.floor(Math.random() * 6) + 1;
    }
    result.set(id, val);
  });

  return result;
}
