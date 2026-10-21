import {
  BalloonBoardRecord,
  BalloonBoardView,
  balloonDay,
  balloonView,
  currentBalloonBoard,
  popBalloonOnBoard,
} from './balloonBoard';
import { fetchBalloonBoard, requestBalloonPop } from './serverAuthoritative';

/**
 * Balloon Pop in the app. The server holds the board and pays prizes; when the server can't be
 * reached (offline, like other coin features), the board is kept on the device instead.
 */

const LOCAL_KEY = 'cr_balloon_';

interface LocalBalloonState {
  board: BalloonBoardRecord | null;
  lastGameDay: string | null;
}

function readLocal(uid: string): LocalBalloonState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY + uid);
    if (raw) return JSON.parse(raw) as LocalBalloonState;
  } catch {
    // ignore
  }
  return { board: null, lastGameDay: null };
}

function writeLocal(uid: string, state: LocalBalloonState) {
  try {
    localStorage.setItem(LOCAL_KEY + uid, JSON.stringify(state));
  } catch {
    // ignore
  }
}

const randomInt = (n: number) => Math.floor(Math.random() * n);

/** Notes that the player started a game today (the server records its own copy) */
export function recordGamePlayedForBalloons(uid: string) {
  writeLocal(uid, { ...readLocal(uid), lastGameDay: balloonDay(Date.now()) });
}

function localBoard(uid: string): { state: LocalBalloonState; board: BalloonBoardRecord } {
  const state = readLocal(uid);
  const board = currentBalloonBoard(state.board, Date.now(), randomInt);
  if (board !== state.board) writeLocal(uid, { ...state, board });
  return { state, board };
}

export async function loadBalloonBoard(uid: string): Promise<{ view: BalloonBoardView; offline: boolean }> {
  const res = await fetchBalloonBoard();
  if (res.ok && res.data) return { view: res.data.board, offline: false };
  const { state, board } = localBoard(uid);
  return { view: balloonView(board, state.lastGameDay, Date.now()), offline: true };
}

export type BalloonPopOutcome =
  | { ok: true; coins: number; view: BalloonBoardView; /** coins must be added on the device */ offline: boolean }
  | { ok: false; message: string };

export async function popBalloon(uid: string, index: number): Promise<BalloonPopOutcome> {
  const res = await requestBalloonPop(index);
  if (res.ok && res.data) return { ok: true, coins: res.data.coins, view: res.data.board, offline: false };
  if (!res.offline) return { ok: false, message: res.message };

  const { state, board } = localBoard(uid);
  const now = Date.now();
  const result = popBalloonOnBoard(board, index, state.lastGameDay, now);
  if ('message' in result) return { ok: false, message: result.message };
  writeLocal(uid, { ...state, board: result.board });
  return { ok: true, coins: result.coins, view: balloonView(result.board, state.lastGameDay, now), offline: true };
}
