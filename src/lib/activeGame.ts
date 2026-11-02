import { GameSettings } from '../types/game';
import { adoptClientSessionId, getRoom, markPlayerLeft } from './matchmaking';

/**
 * Remembers the online game a player is in, so if the app closes or reloads mid-game (Home
 * button, phone locks, browser reloads the page) they can return to it from the main menu.
 */

const KEY = 'cr_active_game';
/** Games older than this aren't offered (they've almost certainly finished) */
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

interface ActiveGameRecord {
  uid: string;
  settings: GameSettings;
  savedAt: number;
}

export function saveActiveGame(uid: string, settings: GameSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ uid, settings: { ...settings, rejoin: false }, savedAt: Date.now() }));
  } catch {
    // ignore
  }
}

export function clearActiveGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** The online game this player can still return to, or null */
export async function findGameToRejoin(uid: string): Promise<GameSettings | null> {
  let record: ActiveGameRecord | null = null;
  try {
    record = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    record = null;
  }
  if (!record || record.uid !== uid || !record.settings?.roomId || Date.now() - record.savedAt > MAX_AGE_MS) {
    if (record) clearActiveGame();
    return null;
  }
  const room = await getRoom(record.settings.roomId);
  const stillPlaying =
    !!room &&
    room.status === 'in_progress' &&
    room.gameState?.phase !== 'over' &&
    !(room.leftPlayers || []).includes(uid) &&
    !!room.finalSlots?.some(s => s.uid === uid);
  if (!stillPlaying) {
    clearActiveGame();
    return null;
  }
  return record.settings;
}

/** Settings to reopen the game with; the device takes back the session id the room knows */
export function prepareRejoin(uid: string, settings: GameSettings): GameSettings {
  const mySlot = settings.slots.find(s => s.uid === uid);
  if (mySlot?.sessionId) adoptClientSessionId(mySlot.sessionId);
  return { ...settings, rejoin: true };
}

/** The player chose not to return: hand their seat to the computer for good */
export async function abandonGame(uid: string, settings: GameSettings) {
  clearActiveGame();
  if (settings.roomId) await markPlayerLeft(settings.roomId, uid);
}
