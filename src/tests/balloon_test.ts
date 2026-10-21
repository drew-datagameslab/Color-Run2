import { WalletService, WalletError } from '../server/wallet.ts';
import { MemoryWalletStore } from '../server/walletStores.ts';
import {
  BALLOON_COUNT,
  BALLOON_PRIZES,
  balloonDay,
  balloonResetsAt,
  balloonWeek,
  newBalloonBoard,
} from '../lib/balloonBoard';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function expectError(promise: Promise<unknown>, code: string, msg: string) {
  try {
    await promise;
  } catch (err) {
    assert(err instanceof WalletError && err.code === code, `${msg} (got ${(err as Error).message})`);
    return;
  }
  throw new Error(`Assertion failed: ${msg} (no error thrown)`);
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function runTimeTests() {
  // Days and weeks follow U.S. Eastern time, not UTC
  const tue = Date.parse('2026-10-20T15:00:00Z'); // Tue 11 AM EDT
  assert(balloonDay(tue) === '2026-10-20', 'Tuesday afternoon is Oct 20');
  assert(balloonWeek(tue) === '2026-10-19', 'Week starts Monday Oct 19');
  assert(balloonDay(Date.parse('2026-10-21T03:30:00Z')) === '2026-10-20', '11:30 PM Eastern is still Oct 20');

  // Sunday 11:59 PM Eastern belongs to the old week; Monday 12:00 AM starts the new one
  assert(balloonWeek(Date.parse('2026-10-26T03:59:00Z')) === '2026-10-19', 'Sunday night is still last week');
  assert(balloonWeek(Date.parse('2026-10-26T04:00:00Z')) === '2026-10-26', 'Monday midnight Eastern starts a new week');

  // Reset time is the next Monday 12:00 AM Eastern (EDT = UTC-4, EST = UTC-5)
  assert(new Date(balloonResetsAt(tue)).toISOString() === '2026-10-26T04:00:00.000Z', 'Resets Mon Oct 26 at midnight EDT');
  const afterDst = Date.parse('2026-11-03T15:00:00Z');
  assert(new Date(balloonResetsAt(afterDst)).toISOString() === '2026-11-09T05:00:00.000Z', 'Resets at midnight EST after DST ends');
  // Week containing the clocks-back Sunday (Nov 1): resets Monday Nov 2 at midnight EST
  assert(
    new Date(balloonResetsAt(Date.parse('2026-10-29T15:00:00Z'))).toISOString() === '2026-11-02T05:00:00.000Z',
    'Reset after the daylight saving change uses EST'
  );

  // The board always holds the same 25 prizes from 10 to 100, shuffled
  assert(BALLOON_PRIZES.length === BALLOON_COUNT, 'Board has 25 prizes');
  assert(Math.min(...BALLOON_PRIZES) === 10 && Math.max(...BALLOON_PRIZES) === 100, 'Prizes range from 10 to 100');
  const board = newBalloonBoard('2026-10-19', n => Math.floor(Math.random() * n));
  assert(
    [...board.prizes].sort((a, b) => a - b).join() === [...BALLOON_PRIZES].sort((a, b) => a - b).join(),
    'Shuffled board keeps the same prizes'
  );
  console.log('✓ Balloon Pop resets Mondays at midnight Eastern, including across daylight saving');
}

async function runServiceTests() {
  const store = new MemoryWalletStore();
  let now = Date.parse('2026-10-20T15:00:00Z'); // Tuesday
  const service = new WalletService(store, () => now);
  const uid = 'popper';

  // Before playing today: the board shows but can't be popped
  let view = await service.balloonBoard(uid);
  assert(view.status === 'play_first', 'Need to play a game first');
  assert(Object.keys(view.popped).length === 0, 'Nothing popped yet');
  assert(!('prizes' in view), 'Hidden prizes are never sent to the app');
  await expectError(service.popBalloon(uid, 3), 'play_first', 'Cannot pop before playing today');

  // After a game: one pop pays that balloon's prize
  await service.startMatch(uid, { buyIn: 0, playerCount: 4, tier: 'standard' });
  assert((await service.balloonBoard(uid)).status === 'ready', 'Ready after a game');
  const before = await service.getBalance(uid);
  const hidden = store.balloonBoards.get(uid)!.prizes[3];
  const pop = await service.popBalloon(uid, 3);
  assert(pop.coins === hidden, 'Pays the prize hidden under that balloon');
  assert(pop.balance === before + hidden, 'Balance goes up by the prize');
  assert(pop.board.popped[3] === hidden && pop.board.status === 'popped_today', 'Board shows the popped balloon');
  assert(store.ledger.some(e => e.uid === uid && e.reason === 'balloon_pop' && e.delta === hidden), 'Pop is in the ledger');

  // Only one pop a day, even after more games
  await service.startMatch(uid, { buyIn: 0, playerCount: 4, tier: 'standard' });
  await expectError(service.popBalloon(uid, 4), 'popped_today', 'Second pop the same day is refused');

  // Next day: must play again; popped balloons stay popped
  now += DAY;
  assert((await service.balloonBoard(uid)).status === 'play_first', 'New day needs a new game');
  await service.startMatch(uid, { buyIn: 0, playerCount: 4, tier: 'standard' });
  await expectError(service.popBalloon(uid, 3), 'already_popped', 'Cannot pop the same balloon twice');
  await expectError(service.popBalloon(uid, 25), 'invalid_balloon', 'Balloon number must be on the board');
  await expectError(service.popBalloon(uid, 'x'), 'invalid_balloon', 'Balloon number must be a number');
  const second = await service.popBalloon(uid, 10);
  assert(Object.keys(second.board.popped).length === 2, 'Two balloons popped this week');

  // Monday at midnight Eastern: a fresh board
  now = Date.parse('2026-10-26T04:00:00Z');
  view = await service.balloonBoard(uid);
  assert(view.weekId === '2026-10-26' && Object.keys(view.popped).length === 0, 'Board resets on Monday');
  console.log('✓ Balloon Pop: one pop a day after a game, prizes paid by the server, weekly reset');
}

export async function runBalloonTests() {
  runTimeTests();
  await runServiceTests();
}
