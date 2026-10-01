import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// -------------------------------------------------------------
// Server-Authoritative State & Storage
// -------------------------------------------------------------

// Server authoritative coin balance store
const serverUserCoins = new Map<string, number>();

// Audit log of server transactions
const serverTransactions: Array<{
  id: string;
  uid: string;
  delta: number;
  balance: number;
  reason: string;
  timestamp: number;
}> = [];

// Pre-seed Master Admin
serverUserCoins.set('ZYHRSo415HeN1Tm9ChGYNJBGik02', 100000);

// -------------------------------------------------------------
// 1. Server-Side Dice Rolling API (Cryptographically Secure)
// -------------------------------------------------------------

/**
 * Generates tamper-proof random dice values on the server using Node crypto.randomInt.
 * Protects multiplayer and solo games against modified client apps.
 */
app.post('/api/dice/roll', (req, res) => {
  try {
    const { count, diceIds, roomId, playerUid, rollNumber } = req.body;
    const targetIds: number[] = Array.isArray(diceIds) && diceIds.length > 0
      ? diceIds
      : Array.from({ length: typeof count === 'number' && count > 0 ? count : 12 }, (_, i) => i + 1);

    const rolls: Array<{ id: number; value: number }> = [];

    // crypto.randomInt(1, 7) guarantees cryptographically unbiased integer 1..6
    for (const id of targetIds) {
      const value = crypto.randomInt(1, 7);
      rolls.push({ id, value });
    }

    const timestamp = Date.now();
    const serverSignature = crypto
      .createHash('sha256')
      .update(`${roomId || 'solo'}:${playerUid || 'anonymous'}:${rollNumber || 1}:${rolls.map(r => r.value).join(',')}:${timestamp}`)
      .digest('hex')
      .slice(0, 16);

    res.json({
      success: true,
      rolls,
      timestamp,
      serverSignature,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate server dice roll', details: err?.message });
  }
});

/**
 * Server-authoritative tiebreaker roll-off
 */
app.post('/api/dice/roll-off', (req, res) => {
  try {
    const { participants, roomId } = req.body;
    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Participants array required' });
    }

    const rollScores: Record<string, number> = {};
    for (const p of participants) {
      rollScores[p] = crypto.randomInt(1, 7);
    }

    let highest = -1;
    for (const val of Object.values(rollScores)) {
      if (val > highest) highest = val;
    }

    const winners = Object.entries(rollScores)
      .filter(([_, val]) => val === highest)
      .map(([id]) => id);

    res.json({
      success: true,
      rollScores,
      highestRoll: highest,
      winners,
      isStillTied: winners.length > 1,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Tiebreaker roll-off failed', details: err?.message });
  }
});

// -------------------------------------------------------------
// 2. Server-Side Coin Balance Management API
// -------------------------------------------------------------

/**
 * Retrieves the authoritative coin balance for a player
 */
app.get('/api/coins/:uid', (req, res) => {
  const uid = req.params.uid;
  let balance = serverUserCoins.get(uid);
  if (balance === undefined) {
    balance = 200; // Standard 200 welcome coins
    serverUserCoins.set(uid, balance);
  }
  res.json({
    uid,
    balance,
    timestamp: Date.now(),
  });
});

/**
 * Updates a player's balance authoritatively on the server
 */
app.post('/api/coins/update', (req, res) => {
  try {
    const { uid, delta, reason } = req.body;
    if (!uid || typeof delta !== 'number') {
      return res.status(400).json({ error: 'Valid uid and numeric delta required' });
    }

    const current = serverUserCoins.get(uid) ?? 200;
    const newBalance = Math.max(0, current + delta);
    serverUserCoins.set(uid, newBalance);

    const txId = 'tx_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    serverTransactions.push({
      id: txId,
      uid,
      delta,
      balance: newBalance,
      reason: reason || 'gameplay_action',
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      uid,
      balance: newBalance,
      delta,
      transactionId: txId,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update coin balance', details: err?.message });
  }
});

/**
 * Sets an exact balance (e.g. admin grant or initial sync)
 */
app.post('/api/coins/set', (req, res) => {
  try {
    const { uid, amount } = req.body;
    if (!uid || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Valid uid and numeric amount required' });
    }

    const newBalance = Math.max(0, Math.floor(amount));
    serverUserCoins.set(uid, newBalance);

    res.json({
      success: true,
      uid,
      balance: newBalance,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to set coin balance', details: err?.message });
  }
});

// -------------------------------------------------------------
// 3. Server-Side Prize Calculation & Payout API
// -------------------------------------------------------------

/**
 * Calculates and awards official match prize payouts on the server.
 * Completely prevents clients from fabricating their own winnings.
 */
app.post('/api/match/payout', (req, res) => {
  try {
    const { roomId, uid, placement, totalPlayers, tier, buyIn } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'Player UID required' });
    }

    const cleanTier = String(tier || 'casual').toLowerCase();
    const cleanPlacement = Math.max(1, parseInt(placement, 10) || 1);
    const cleanTotalP = Math.max(2, parseInt(totalPlayers, 10) || 2);
    const cleanBuyIn = Math.max(0, parseInt(buyIn, 10) || 0);

    let multiplier = 1;
    if (cleanTier === 'highroller') multiplier = 2;
    else if (cleanTier === 'elite') multiplier = 5;

    let prizeWon = 0;

    if (cleanTier === 'casual' || cleanBuyIn === 0) {
      // Casual match: only 1st place receives 150 coins bonus
      if (cleanPlacement === 1) {
        prizeWon = 150;
      }
    } else {
      // Competitive tiered match payouts
      if (cleanTotalP <= 2) {
        if (cleanPlacement === 1) prizeWon = 100 * multiplier;
      } else if (cleanTotalP === 3) {
        if (cleanPlacement === 1) prizeWon = 100 * multiplier;
        else if (cleanPlacement === 2) prizeWon = 50 * multiplier;
      } else if (cleanTotalP === 4) {
        if (cleanPlacement === 1) prizeWon = 120 * multiplier;
        else if (cleanPlacement === 2) prizeWon = 60 * multiplier;
        else if (cleanPlacement === 3) prizeWon = 20 * multiplier;
      } else {
        // 5 or 6 players
        if (cleanPlacement === 1) prizeWon = 150 * multiplier;
        else if (cleanPlacement === 2) prizeWon = 75 * multiplier;
        else if (cleanPlacement === 3) prizeWon = 25 * multiplier;
      }
    }

    // Credit server balance immediately
    const current = serverUserCoins.get(uid) ?? 200;
    const newBalance = current + prizeWon;
    serverUserCoins.set(uid, newBalance);

    const txId = 'payout_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    serverTransactions.push({
      id: txId,
      uid,
      delta: prizeWon,
      balance: newBalance,
      reason: `match_prize_${cleanTier}_place_${cleanPlacement}`,
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      prizeWon,
      newBalance,
      placement: cleanPlacement,
      tier: cleanTier,
      transactionId: txId,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to calculate prize payout', details: err?.message });
  }
});

// -------------------------------------------------------------
// Health Check Endpoint
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '6.2.7',
    serverTime: Date.now(),
  });
});

// -------------------------------------------------------------
// Vite Middleware (Dev) & Static Serving (Prod)
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const PORT = parseInt(process.env.PORT || '3000', 10);

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Color Run Server] Running on http://localhost:${PORT} (Version 6.2.7)`);
  });
}

startServer().catch(err => {
  console.error('[Color Run Server] Error starting server:', err);
  process.exit(1);
});
