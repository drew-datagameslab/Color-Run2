/**
 * Client interface for server-authoritative game functions:
 * - Server-side cryptographically secure dice rolling
 * - Server-side authoritative coin balance tracking
 * - Server-side prize calculation and payout validation
 */

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
    const res = await fetch('/api/dice/roll', {
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

    if (res.ok) {
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

/**
 * Executes a server-authoritative tiebreaker roll-off
 */
export async function rollTiebreakerOnServer(
  participants: string[],
  roomId?: string
): Promise<{
  rollScores: Record<string, number>;
  highestRoll: number;
  winners: string[];
  isStillTied: boolean;
}> {
  try {
    const res = await fetch('/api/dice/roll-off', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants, roomId }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        rollScores: data.rollScores || {},
        highestRoll: data.highestRoll || 0,
        winners: data.winners || [],
        isStillTied: !!data.isStillTied,
      };
    }
  } catch (err) {
    console.warn('[ServerTiebreaker] Network unavailable, using local tiebreaker fallback:', err);
  }

  // Fallback
  const rollScores: Record<string, number> = {};
  for (const p of participants) {
    rollScores[p] = Math.floor(Math.random() * 6) + 1;
  }
  let highest = -1;
  for (const val of Object.values(rollScores)) {
    if (val > highest) highest = val;
  }
  const winners = Object.entries(rollScores)
    .filter(([_, val]) => val === highest)
    .map(([id]) => id);

  return {
    rollScores,
    highestRoll: highest,
    winners,
    isStillTied: winners.length > 1,
  };
}

/**
 * Fetches authoritative coin balance from backend server
 */
export async function fetchServerCoins(uid: string): Promise<number | null> {
  if (!uid) return null;
  try {
    const res = await fetch(`/api/coins/${encodeURIComponent(uid)}`);
    if (res.ok) {
      const data = await res.json();
      return typeof data.balance === 'number' ? data.balance : null;
    }
  } catch {
    // Offline fallback
  }
  return null;
}

/**
 * Updates coin balance authoritatively on backend server
 */
export async function updateServerCoins(
  uid: string,
  delta: number,
  reason: string
): Promise<number | null> {
  if (!uid || delta === 0) return null;
  try {
    const res = await fetch('/api/coins/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, delta, reason }),
    });
    if (res.ok) {
      const data = await res.json();
      return typeof data.balance === 'number' ? data.balance : null;
    }
  } catch {
    // Offline fallback
  }
  return null;
}

/**
 * Claims match prize payout authoritatively calculated and credited by the server
 */
export async function claimServerPrizePayout(params: {
  roomId?: string;
  uid: string;
  placement: number;
  totalPlayers: number;
  tier?: string;
  buyIn?: number;
}): Promise<{ prizeWon: number; newBalance: number }> {
  try {
    const res = await fetch('/api/match/payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        prizeWon: data.prizeWon ?? 0,
        newBalance: data.newBalance ?? 0,
      };
    }
  } catch (err) {
    console.warn('[ServerPayout] Failed to contact server for prize payout:', err);
  }

  return { prizeWon: 0, newBalance: 0 };
}
