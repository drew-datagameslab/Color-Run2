import { useEffect, useRef, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Who is actually present in an online room. Each device writes a heartbeat into the room
 * (rooms/{id}.presence.{token}) while the app is open and in front; it stops when the player
 * switches away (Home button, another app). Other devices notice when a player's heartbeat
 * stops changing. That's judged by each device's own clock, so devices with different clock
 * settings agree.
 *
 * A player with no heartbeat at all (for example an older app version) counts as present, so
 * this only ever makes games keep moving, never stops them.
 */

export const ROOM_HEARTBEAT_MS = 8000;
/** No new heartbeat for this long and a player counts as away */
export const ROOM_AWAY_AFTER_MS = 25000;

/** Keeps this device's heartbeat going in a room while the app is in front */
export function useRoomHeartbeat(roomId: string | undefined, token: string) {
  useEffect(() => {
    if (!roomId || !token || roomId.endsWith('_local')) return;
    const beat = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      updateDoc(doc(db, 'rooms', roomId), { [`presence.${token}`]: Date.now() }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, ROOM_HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [roomId, token]);
}

/**
 * Remembers when this device last saw each player's heartbeat change. A player is away once
 * their heartbeat hasn't changed for ROOM_AWAY_AFTER_MS; a player never seen is present.
 */
export class PresenceTracker {
  private seen: Record<string, { value: number; seenAt: number }> = {};

  observe(presence: Record<string, number> | undefined, at: number) {
    for (const [token, value] of Object.entries(presence || {})) {
      const prev = this.seen[token];
      if (!prev || prev.value !== value) this.seen[token] = { value, seenAt: at };
    }
  }

  isAway(token: string | undefined, now: number): boolean {
    const seen = token ? this.seen[token] : undefined;
    return !!seen && now - seen.seenAt > ROOM_AWAY_AFTER_MS;
  }
}

/**
 * Tracks the room's heartbeats and returns `isAway(token)`: true once a player's heartbeat has
 * not changed for ROOM_AWAY_AFTER_MS (measured from when this device last saw it change, or from
 * when this device started watching).
 */
export function useRoomPresence(presence: Record<string, number> | undefined, enabled: boolean) {
  const trackerRef = useRef(new PresenceTracker());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    trackerRef.current.observe(presence, Date.now());
  }, [presence]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 4000);
    return () => clearInterval(timer);
  }, [enabled]);

  return (token: string | undefined): boolean => enabled && trackerRef.current.isAway(token, now);
}
