/**
 * Balloon Pop bonus board: 25 balloons hide coin prizes from 10 to 100. Signed-in players pop one
 * balloon a day after their first game that day. Popped balloons stay popped all week, and the
 * board resets every Monday at midnight in BALLOON_TIME_ZONE (one time zone for everyone).
 *
 * Shared by the server (which hides the prizes and pays them) and the app.
 */

export const BALLOON_TIME_ZONE = 'America/New_York';
export const BALLOON_COUNT = 25;

/** The 25 prizes, shuffled onto the board each week (average about 37 coins) */
export const BALLOON_PRIZES: number[] = [
  10, 10, 10, 10,
  15, 15, 15,
  20, 20, 20,
  25, 25, 25,
  30, 30,
  40, 40,
  50, 50,
  60, 60,
  75, 75,
  100, 100,
];

export type BalloonStatus = 'ready' | 'play_first' | 'popped_today';

/** What the app is allowed to see: popped balloons only, never the hidden prizes */
export interface BalloonBoardView {
  weekId: string;
  /** Balloon index -> coins won */
  popped: Record<number, number>;
  status: BalloonStatus;
  /** When the board resets (ms since epoch) */
  resetsAt: number;
}

/** The full board, kept where players can't read it (server, or the device when offline) */
export interface BalloonBoardRecord {
  weekId: string;
  prizes: number[];
  popped: Record<string, number>;
  /** Day (in BALLOON_TIME_ZONE) of the last pop */
  lastPopDay: string | null;
}

interface ZonedDate {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

function zonedParts(ts: number): ZonedDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BALLOON_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Calendar day in BALLOON_TIME_ZONE, e.g. "2026-10-20" */
export function balloonDay(ts: number): string {
  const z = zonedParts(ts);
  return dateKey(z.year, z.month, z.day);
}

/** The Monday that starts this board's week, e.g. "2026-10-19" */
export function balloonWeek(ts: number): string {
  const z = zonedParts(ts);
  const civil = new Date(Date.UTC(z.year, z.month - 1, z.day));
  const sinceMonday = (civil.getUTCDay() + 6) % 7;
  civil.setUTCDate(civil.getUTCDate() - sinceMonday);
  return dateKey(civil.getUTCFullYear(), civil.getUTCMonth() + 1, civil.getUTCDate());
}

/** Midnight at the start of a calendar day in BALLOON_TIME_ZONE, as a timestamp */
function zonedMidnight(year: number, month: number, day: number): number {
  const target = Date.UTC(year, month - 1, day);
  // Start from midnight UTC and correct by the zone's offset (twice, for daylight saving changes)
  let ts = target;
  for (let i = 0; i < 2; i++) {
    const z = zonedParts(ts);
    const shownAsUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute);
    ts += target - shownAsUtc;
  }
  return ts;
}

/** Next Monday 12:00 AM in BALLOON_TIME_ZONE */
export function balloonResetsAt(ts: number): number {
  const [y, m, d] = balloonWeek(ts).split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 7));
  return zonedMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** A freshly shuffled board for the week */
export function newBalloonBoard(weekId: string, randomInt: (maxExclusive: number) => number): BalloonBoardRecord {
  const prizes = [...BALLOON_PRIZES];
  for (let i = prizes.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [prizes[i], prizes[j]] = [prizes[j], prizes[i]];
  }
  return { weekId, prizes, popped: {}, lastPopDay: null };
}

/** This week's board (a new one if the stored board is from an earlier week) */
export function currentBalloonBoard(
  stored: BalloonBoardRecord | null,
  now: number,
  randomInt: (maxExclusive: number) => number
): BalloonBoardRecord {
  const weekId = balloonWeek(now);
  return stored && stored.weekId === weekId ? stored : newBalloonBoard(weekId, randomInt);
}

export function balloonStatus(board: BalloonBoardRecord, lastGameDay: string | null | undefined, now: number): BalloonStatus {
  const today = balloonDay(now);
  if (board.lastPopDay === today) return 'popped_today';
  if (lastGameDay !== today) return 'play_first';
  return 'ready';
}

export function balloonView(board: BalloonBoardRecord, lastGameDay: string | null | undefined, now: number): BalloonBoardView {
  const popped: Record<number, number> = {};
  for (const [index, coins] of Object.entries(board.popped)) popped[Number(index)] = coins;
  return { weekId: board.weekId, popped, status: balloonStatus(board, lastGameDay, now), resetsAt: balloonResetsAt(now) };
}

export type PopResult =
  | { ok: true; coins: number; board: BalloonBoardRecord }
  | { ok: false; code: 'invalid_balloon' | 'already_popped' | 'popped_today' | 'play_first'; message: string };

/** Pops one balloon if the rules allow it */
export function popBalloonOnBoard(
  board: BalloonBoardRecord,
  index: unknown,
  lastGameDay: string | null | undefined,
  now: number
): PopResult {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= BALLOON_COUNT) {
    return { ok: false, code: 'invalid_balloon', message: 'Pick a balloon on the board.' };
  }
  const status = balloonStatus(board, lastGameDay, now);
  if (status === 'popped_today') {
    return { ok: false, code: 'popped_today', message: "You've popped today's balloon. Come back tomorrow!" };
  }
  if (status === 'play_first') {
    return { ok: false, code: 'play_first', message: 'Play a game today to pop a balloon.' };
  }
  if (board.popped[String(index)] !== undefined) {
    return { ok: false, code: 'already_popped', message: 'That balloon is already popped.' };
  }
  const coins = board.prizes[index];
  return {
    ok: true,
    coins,
    board: { ...board, popped: { ...board.popped, [String(index)]: coins }, lastPopDay: balloonDay(now) },
  };
}
