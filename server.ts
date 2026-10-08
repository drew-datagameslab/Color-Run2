import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { requireUser, requireAdmin, AuthedRequest } from './src/server/auth.ts';
import { getAdminDb, checkAdminAvailable } from './src/server/firebaseAdmin.ts';
import { WalletService, WalletError } from './src/server/wallet.ts';
import { FirestoreWalletStore } from './src/server/walletStores.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const APP_VERSION = '6.5.2';

const app = express();
app.use(express.json({ limit: '16kb' }));

// -------------------------------------------------------------
// CORS for the Android/iOS apps, which call this server from their own origin
// -------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
]);

app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// -------------------------------------------------------------
// 1. Server-Side Dice Rolling API (Cryptographically Secure)
// -------------------------------------------------------------

/**
 * Generates random dice values on the server using Node crypto.randomInt.
 */
app.post('/api/dice/roll', (req, res) => {
  const { count, diceIds } = req.body || {};
  const targetIds: number[] =
    Array.isArray(diceIds) && diceIds.length > 0
      ? diceIds
      : Array.from({ length: typeof count === 'number' && count > 0 ? count : 12 }, (_, i) => i + 1);

  // A turn never rolls more than the 12 dice in play
  if (targetIds.length > 12 || !targetIds.every(id => Number.isInteger(id) && id >= 0 && id < 1000)) {
    return res.status(400).json({ error: 'invalid_dice', message: 'Up to 12 dice ids are allowed.' });
  }

  const rolls = targetIds.map(id => ({ id, value: crypto.randomInt(1, 7) }));
  res.json({ success: true, rolls, timestamp: Date.now() });
});

// -------------------------------------------------------------
// 2. Coins: every change is made here, for the signed-in player only.
//    Amounts and limits come from src/lib/economy.ts; balances live in
//    Firestore wallets/{uid}, which players can read but not write.
// -------------------------------------------------------------

let walletService: WalletService | null = null;
async function wallets(): Promise<WalletService> {
  if (!walletService) walletService = new WalletService(new FirestoreWalletStore(await getAdminDb()));
  return walletService;
}

/** Wraps a wallet route: sign-in required, uid from the token, consistent errors */
function walletRoute(
  handler: (req: AuthedRequest, service: WalletService) => Promise<Record<string, unknown>>
) {
  return async (req: Request, res: Response) => {
    try {
      res.json({ success: true, ...(await handler(req as AuthedRequest, await wallets())) });
    } catch (err) {
      if (err instanceof WalletError) {
        return res.status(err.status).json({ error: err.code, message: err.message });
      }
      console.error('[Wallet] Error:', err);
      // The app falls back to offline mode on 503
      res.status(503).json({ error: 'wallet_unavailable', message: 'Coin service unavailable.' });
    }
  };
}

const coins = express.Router();
coins.use(requireUser);

coins.get('/', walletRoute(async (req, s) => ({ balance: await s.getBalance(req.user.uid) })));

coins.post(
  '/grant',
  walletRoute(async (req, s) => ({ balance: await s.grant(req.user.uid, req.body?.reason, req.body?.amount) }))
);

coins.post(
  '/spend',
  walletRoute(async (req, s) => ({ balance: await s.spend(req.user.uid, req.body?.amount, req.body?.item) }))
);

coins.post('/daily-bonus', walletRoute(async (req, s) => s.dailyBonus(req.user.uid)));

coins.post('/coupon', walletRoute(async (req, s) => s.redeemCoupon(req.user.uid, req.body?.code)));

coins.post('/mission', walletRoute(async (req, s) => s.missionReward(req.user.uid, req.body?.missionId)));

coins.post(
  '/level-rewards',
  walletRoute(async (req, s) => s.levelRewards(req.user.uid, req.body?.rewardIds, req.body?.prestige))
);

app.use('/api/coins', coins);

// -------------------------------------------------------------
// 3. Games: the buy-in is charged when a game starts, which issues a ticket.
//    The prize is paid once per ticket, from the same table the app shows.
// -------------------------------------------------------------
const match = express.Router();
match.use(requireUser);

match.post('/start', walletRoute(async (req, s) => s.startMatch(req.user.uid, req.body || {})));

match.post(
  '/payout',
  walletRoute(async (req, s) => s.claimMatchPrize(req.user.uid, req.body?.matchId, req.body?.placement))
);

app.use('/api/match', match);

// -------------------------------------------------------------
// 4. Admin: set any player's balance (admins only)
// -------------------------------------------------------------
app.post(
  '/api/admin/coins/set',
  requireUser,
  requireAdmin,
  walletRoute(async (req, s) => ({
    balance: await s.adminSetBalance(req.user.uid, req.body?.uid, req.body?.amount),
  }))
);

// -------------------------------------------------------------
// Health Check Endpoint
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: APP_VERSION,
    serverTime: Date.now(),
  });
});

// -------------------------------------------------------------
// Vite Middleware (Dev) & Static Serving (Prod)
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  let port = parseInt(process.env.PORT || '3000', 10);
  let host = '0.0.0.0';

  // Support CLI arguments: --port <n>, --port=<n>, --host <h>, --host=<h>
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--port' && process.argv[i + 1]) {
      const parsed = parseInt(process.argv[i + 1], 10);
      if (!isNaN(parsed)) port = parsed;
    } else if (arg.startsWith('--port=')) {
      const parsed = parseInt(arg.split('=')[1], 10);
      if (!isNaN(parsed)) port = parsed;
    }
    if (arg === '--host') {
      if (process.argv[i + 1] && !process.argv[i + 1].startsWith('-')) {
        host = process.argv[i + 1];
      } else {
        host = '0.0.0.0';
      }
    } else if (arg.startsWith('--host=')) {
      host = arg.split('=')[1] || '0.0.0.0';
    }
  }

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Serve transformed HTML in dev mode
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, host, () => {
    // Print Vite banner for tooling that waits for Vite stdout
    console.log(`\n  VITE v6.2.3  ready in 180 ms\n\n  ➜  Local:   http://localhost:${port}/\n  ➜  Network: http://${host}:${port}/\n`);
    console.log(`[Color Run Server] Running on http://${host}:${port} (Version ${APP_VERSION})`);
    checkAdminAvailable();
  });
}

startServer().catch(err => {
  console.error('[Color Run Server] Error starting server:', err);
  process.exit(1);
});
