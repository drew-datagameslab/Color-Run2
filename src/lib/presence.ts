import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { Friend, UserAccount } from '../types/game';
import { saveLocalFriends } from './friends';

export interface UserPresence {
  uid: string;
  name: string;
  color: string;
  image?: string;
  status: 'online' | 'offline';
  inGame?: boolean;
  lastSeen: number;
  updatedAt: number;
}

// 45 seconds threshold for considering a client currently active in the game
const ONLINE_THRESHOLD_MS = 45000;

// In-memory cache of live active users
let currentOnlinePresences = new Map<string, UserPresence>();

/**
 * Starts publishing live presence heartbeat to Firestore
 */
export function startPresenceHeartbeat(user: UserAccount): () => void {
  if (!db || !user?.uid) {
    return () => {};
  }

  const presenceRef = doc(db, 'presence', user.uid);

  const writePresence = async (status: 'online' | 'offline' = 'online', inGame: boolean = false) => {
    try {
      const payload: UserPresence = {
        uid: user.uid,
        name: user.name || 'Player',
        color: user.avatar?.color || '#1f7fd6',
        image: user.avatar?.image,
        status,
        inGame,
        lastSeen: Date.now(),
        updatedAt: Date.now(),
      };
      await setDoc(presenceRef, payload, { merge: true });
    } catch (err) {
      console.warn('Presence heartbeat update error:', err);
    }
  };

  // Immediate heartbeat on start
  writePresence('online', false);

  // Periodic heartbeat every 12 seconds
  const intervalId = window.setInterval(() => {
    if (document.visibilityState !== 'hidden') {
      writePresence('online', false);
    }
  }, 12000);

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      writePresence('online', false);
    }
  };

  const handleBeforeUnload = () => {
    // Best effort mark offline on tab close
    writePresence('offline', false);
  };

  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    writePresence('offline', false);
  };
}

/**
 * Real-time subscription to online users in the game
 */
export function subscribeToOnlinePresence(
  onUpdate: (presenceMap: Map<string, UserPresence>) => void
): () => void {
  if (!db) {
    return () => {};
  }

  try {
    const q = query(collection(db, 'presence'));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const now = Date.now();
        const map = new Map<string, UserPresence>();

        snapshot.forEach(docSnap => {
          const data = docSnap.data() as UserPresence;
          if (data && data.uid) {
            const isFresh = data.status === 'online' && now - (data.lastSeen || 0) < ONLINE_THRESHOLD_MS;
            if (isFresh) {
              map.set(data.uid, data);
              // Also index by normalized name for robust matching
              if (data.name) {
                map.set(data.name.trim().toLowerCase(), data);
              }
            }
          }
        });

        currentOnlinePresences = map;
        onUpdate(map);
      },
      err => {
        console.warn('Presence subscription error:', err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Error initiating presence subscription:', err);
    return () => {};
  }
}

/**
 * Merges a user's friends list with real-time presence data from Firestore.
 * 1. Overrides friend status to 'online' if an active presence exists.
 * 2. If other real users are actively online in the app on other devices,
 *    they are dynamically included as available online opponents.
 */
export function mergeFriendsWithPresence(
  friends: Friend[],
  presenceMap: Map<string, UserPresence>,
  currentUid: string
): Friend[] {
  const now = Date.now();

  // Create working copy of friends
  const updatedFriends = friends.map(f => {
    // Look up by id, uid, or normalized name
    const match =
      presenceMap.get(f.id) ||
      (f.uid ? presenceMap.get(f.uid) : undefined) ||
      presenceMap.get(f.name.trim().toLowerCase());

    if (match) {
      const isOnline = match.status === 'online' && now - match.lastSeen < ONLINE_THRESHOLD_MS;
      return {
        ...f,
        uid: match.uid,
        status: isOnline ? ('online' as const) : ('offline' as const),
        color: match.color || f.color,
        image: match.image || f.image,
      };
    }

    // Default mock friends (Alex, Taylor, Jordan) stay available for testing unless matched
    if (f.id === 'f_alex' || f.id === 'f_taylor' || f.id === 'f_jordan') {
      return f;
    }

    return f;
  });

  // Check if any other online users exist who aren't yet in the friends list
  const existingKeys = new Set<string>();
  updatedFriends.forEach(f => {
    existingKeys.add(f.name.trim().toLowerCase());
    if (f.uid) existingKeys.add(f.uid);
    existingKeys.add(f.id);
  });

  const discoveredOnlineFriends: Friend[] = [];

  presenceMap.forEach(p => {
    if (!p.uid || p.uid === currentUid) return;
    const normName = (p.name || '').trim().toLowerCase();
    if (!existingKeys.has(p.uid) && !existingKeys.has(normName)) {
      existingKeys.add(p.uid);
      existingKeys.add(normName);
      discoveredOnlineFriends.push({
        id: p.uid,
        uid: p.uid,
        name: p.name,
        color: p.color || '#1f7fd6',
        image: p.image,
        status: 'online',
        addedAt: new Date().toISOString(),
        gamesPlayed: 0,
      });
    }
  });

  if (discoveredOnlineFriends.length > 0) {
    const combined = [...discoveredOnlineFriends, ...updatedFriends];
    if (currentUid) {
      saveLocalFriends(currentUid, combined);
    }
    return combined;
  }

  return updatedFriends;
}
