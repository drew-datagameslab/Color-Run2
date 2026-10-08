import express from 'express';
import { AddressInfo } from 'net';
import { WalletService, WalletError, utcWeek } from '../server/wallet.ts';
import { MemoryWalletStore } from '../server/walletStores.ts';
import { requireUser, requireAdmin } from '../server/auth.ts';
import { prizeForPlacement, WELCOME_COINS, FREE_GAME_WIN_BONUS } from '../lib/economy';
import { createInitialDailyMissions, createInitialWeeklyMissions } from '../lib/missions';
import { LEVEL_REWARDS } from '../lib/levelSystem';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function expectError(promise: Promise<unknown>, status: number, msg: string) {
  try {
    await promise;
  } catch (err) {
    assert(err instanceof WalletError && err.status === status, `${msg} (got ${(err as Error).message})`);
    return;
  }
  throw new Error(`Assertion failed: ${msg} (no error thrown)`);
}

const DAY = 24 * 60 * 60 * 1000;

function setup(start = Date.UTC(2026, 9, 8, 12)) {
  const store = new MemoryWalletStore();
  let now = start;
  const service = new WalletService(store, () => now);
  return { store, service, advance: (ms: number) => (now += ms), now: () => now };
}

async function runEconomyTests() {
  // New wallets start with the welcome coins; old profile balances carry over once
  {
    const { store, service } = setup();
    assert((await service.getBalance('new_player')) === WELCOME_COINS, 'New wallet starts with 200 coins');
    store.legacyCoins.set('old_player', 750);
    assert((await service.getBalance('old_player')) === 750, 'Existing profile balance carries over');
    store.legacyCoins.set('old_player', 999999);
    assert((await service.getBalance('old_player')) === 750, 'Profile balance is only used to open the wallet');
  }

  // Free coins: only listed amounts, only when low, limited per day
  {
    const { service, store } = setup();
    await service.getBalance('p');
    await expectError(service.grant('p', 'free_coins', 100), 409, 'No free coins at 200 balance');
    store.wallets.set('p', { ...store.wallets.get('p')!, balance: 0 });
    await expectError(service.grant('p', 'free_coins', 5000), 400, 'Unlisted amount rejected');
    await expectError(service.grant('p', 'jackpot', 100), 400, 'Unknown reason rejected');
    assert((await service.grant('p', 'free_coins', 50)) === 50, 'Free coins granted when low');
  }

  // Coin packs (testing): limited per day, reset the next UTC day
  {
    const { service, advance } = setup();
    for (let i = 0; i < 5; i++) await service.grant('p', 'coin_pack', 100);
    await expectError(service.grant('p', 'coin_pack', 100), 409, 'Coin pack daily limit');
    advance(DAY);
    assert((await service.grant('p', 'coin_pack', 2000)) === 200 + 500 + 2000, 'Limit resets next day');
  }

  // Spending
  {
    const { service, store } = setup();
    assert((await service.spend('p', 50, 'color:purple')) === 150, 'Purchase deducts the price');
    await expectError(service.spend('p', 500), 409, 'Cannot spend more than the balance');
    await expectError(service.spend('p', -100), 400, 'Negative price rejected');
    assert(store.wallets.get('p')!.balance === 150, 'Failed purchase changes nothing');
    assert(store.ledger.length === 1, 'Failed purchase writes no ledger entry');
  }

  // Daily bonus: rolled on the server, once per UTC day
  {
    const { service, advance } = setup();
    const bonus = await service.dailyBonus('p');
    assert(bonus.red >= 1 && bonus.red <= 6 && bonus.blue >= 1 && bonus.blue <= 6, 'Two real dice');
    assert(bonus.coins === (bonus.red + bonus.blue) * 10 && bonus.balance === 200 + bonus.coins, '10 coins per pip');
    await expectError(service.dailyBonus('p'), 409, 'Daily bonus once per day');
    advance(DAY);
    await service.dailyBonus('p');
  }

  // Coupons: server-side codes, once per account
  {
    const { service } = setup();
    await expectError(service.redeemCoupon('p', 'FREEMONEY'), 404, 'Unknown coupon rejected');
    assert((await service.redeemCoupon('p', ' dgl1000free ')).coins === 1000, 'Coupon codes are case-insensitive');
    await expectError(service.redeemCoupon('p', 'DGL1000FREE'), 409, 'Coupon only once');
  }

  // Missions: catalog reward, once per day (daily) or week (weekly)
  {
    const { service, advance, now } = setup();
    const daily = createInitialDailyMissions()[0];
    const weekly = createInitialWeeklyMissions()[0];
    await expectError(service.missionReward('p', 'made_up_mission'), 404, 'Unknown mission rejected');
    assert((await service.missionReward('p', daily.id)).coins === daily.rewardCoins, 'Daily mission pays its catalog reward');
    await expectError(service.missionReward('p', daily.id), 409, 'Daily mission once per day');
    assert((await service.missionReward('p', weekly.id)).coins === weekly.rewardCoins, 'Weekly mission pays');
    const week = utcWeek(now());
    advance(DAY);
    await service.missionReward('p', daily.id);
    if (utcWeek(now()) === week) {
      await expectError(service.missionReward('p', weekly.id), 409, 'Weekly mission once per week');
    }
  }

  // Level rewards: catalog amounts, once per reward per prestige
  {
    const { service } = setup();
    const coinRewards = LEVEL_REWARDS.filter(r => r.type === 'coins');
    const [first, second] = coinRewards;
    const res = await service.levelRewards('p', [first.rewardId, second.rewardId, 'not_a_reward'], 0);
    assert(res.coins === first.coinsAmount! + second.coinsAmount!, 'Pays only catalog coin rewards');
    await expectError(service.levelRewards('p', [first.rewardId], 0), 409, 'Level reward only once');
    assert((await service.levelRewards('p', [first.rewardId], 1)).coins === first.coinsAmount, 'Again after prestige');
    await expectError(service.levelRewards('p', [first.rewardId], 5000), 400, 'Unreasonable prestige rejected');
  }

  // Games: buy-in charged at start, prize paid once per ticket
  {
    const { service, advance } = setup();
    const { matchId, balance } = await service.startMatch('p', { buyIn: 50, playerCount: 4, tier: 'high_roller' });
    assert(balance === 150, 'Buy-in charged when the game starts');
    await expectError(service.claimMatchPrize('p', matchId, 5), 400, 'Place beyond the player count rejected');
    const first = await service.claimMatchPrize('p', matchId, 1);
    assert(first.prize === prizeForPlacement(4, 'high_roller', 50, 1) && first.prize === 100, '1st of 4 at 50 buy-in pays 100');
    await expectError(service.claimMatchPrize('p', matchId, 1), 409, 'Prize only once per game');
    await expectError(service.claimMatchPrize('p', 'not-a-ticket', 1), 404, 'Unknown game rejected');
    await expectError(service.claimMatchPrize('other_player', matchId, 1), 404, "Another player's ticket can't be used");
    await expectError(service.startMatch('p', { buyIn: 5000, playerCount: 4 }), 400, 'Buy-in above the maximum rejected');
    await expectError(service.startMatch('p', { buyIn: 1000, playerCount: 4 }), 409, 'Buy-in above the balance rejected');

    const late = await service.startMatch('p', { buyIn: 10, playerCount: 2 });
    advance(7 * 60 * 60 * 1000);
    await expectError(service.claimMatchPrize('p', late.matchId, 1), 409, 'Old tickets expire');

    const free = await service.startMatch('p', { buyIn: 0, playerCount: 2 });
    assert((await service.claimMatchPrize('p', free.matchId, 1)).prize === FREE_GAME_WIN_BONUS, 'Free game winner bonus');
  }

  // Admin balance set
  {
    const { service } = setup();
    assert((await service.adminSetBalance('admin', 'p', 5000)) === 5000, 'Admin sets an exact balance');
    await expectError(service.adminSetBalance('admin', 'p', -1), 400, 'Negative balance rejected');
  }

  console.log('✓ Server coin wallet rules verified (grants, limits, purchases, daily bonus, coupons, missions, levels, games, admin)');
}

async function runAuthTests() {
  const app = express();
  app.use(express.json());
  app.post('/api/coins/grant', requireUser, (_req, res) => res.json({ success: true }));
  app.post('/api/admin/coins/set', requireUser, requireAdmin, (_req, res) => res.json({ success: true }));
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  try {
    const post = (path: string, headers: Record<string, string> = {}) =>
      fetch(`http://127.0.0.1:${port}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ uid: 'victim', amount: 1000000 }),
      });

    assert((await post('/api/coins/grant')).status === 401, 'Coin calls without sign-in are rejected');
    assert((await post('/api/admin/coins/set')).status === 401, 'Admin balance set without sign-in is rejected');
    assert(
      (await post('/api/admin/coins/set', { Authorization: 'Bearer not-a-real-token' })).status === 401,
      'Forged sign-in tokens are rejected'
    );
  } finally {
    server.close();
  }
  console.log('✓ Coin and admin endpoints require a valid sign-in');
}

export async function runWalletTests() {
  console.log('\n--- Running Server Coin Wallet Tests ---');
  await runEconomyTests();
  await runAuthTests();
}
