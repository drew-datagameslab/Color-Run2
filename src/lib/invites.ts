import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  limit,
} from 'firebase/firestore';
import { Friend, UserAccount } from '../types/game';
import { GameRoom } from './matchmaking';

export interface GameInvite {
  id: string;
  roomId: string;
  roomCode?: string;
  hostUid: string;
  hostName: string;
  hostAvatar?: { color: string; image?: string };
  targetFriendId: string;
  targetFriendName: string;
  targetUid?: string;
  buyIn: number;
  status: 'pending' | 'joined' | 'will_join_later' | 'dismissed';
  createdAt: number;
  respondedAt?: number;
}

// Local in-memory invite event emitter for fast same-device / simulation testing
type InviteListener = (invite: GameInvite | null) => void;
const localInviteListeners = new Set<InviteListener>();
let currentActiveInvite: GameInvite | null = null;

export function setLocalActiveInvite(invite: GameInvite | null) {
  currentActiveInvite = invite;
  localInviteListeners.forEach(listener => listener(invite));
}

/**
 * Send challenge invites to multiple friends in Firestore
 */
export async function sendChallengeInvites(
  roomId: string,
  roomCode: string,
  host: UserAccount,
  invitedFriends: Friend[],
  buyIn: number
) {
  const now = Date.now();

  for (const friend of invitedFriends) {
    const inviteId = `inv_${roomId}_${friend.id}`;
    const invite: GameInvite = {
      id: inviteId,
      roomId,
      roomCode,
      hostUid: host.uid,
      hostName: host.name,
      hostAvatar: host.avatar,
      targetFriendId: friend.id,
      targetFriendName: friend.name,
      targetUid: friend.id.startsWith('friend_') || friend.id.startsWith('f_') ? undefined : friend.id,
      buyIn,
      status: 'pending',
      createdAt: now,
    };

    if (db) {
      try {
        await setDoc(doc(db, 'game_invites', inviteId), invite);
      } catch (err) {
        console.warn('Error saving invite to Firestore:', err);
      }
    }

    // Also simulate realistic responses for sample offline/online bots if not a real user
    scheduleSimulatedFriendResponse(roomId, friend, buyIn);
  }
}

/**
 * Update response to an invite
 */
export async function respondToChallengeInvite(
  inviteId: string,
  roomId: string,
  friendId: string,
  response: 'joined' | 'will_join_later' | 'dismissed'
) {
  const now = Date.now();

  if (currentActiveInvite && currentActiveInvite.id === inviteId) {
    currentActiveInvite.status = response;
    setLocalActiveInvite(null);
  }

  if (db) {
    try {
      // 1. Update invite document
      await updateDoc(doc(db, 'game_invites', inviteId), {
        status: response,
        respondedAt: now,
      });

      // 2. Update room document responses
      const roomRef = doc(db, 'rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      if (roomSnap.exists()) {
        const roomData = roomSnap.data() as GameRoom;
        const currentResponses = roomData.invitedResponses || {};
        currentResponses[friendId] = response;

        const updatedFriends = (roomData.invitedFriends || []).map(f =>
          f.id === friendId ? { ...f, status: response } : f
        );

        await updateDoc(roomRef, {
          invitedResponses: currentResponses,
          invitedFriends: updatedFriends,
          updatedAt: now,
        });
      }
    } catch (err) {
      console.warn('Error responding to invite in Firestore:', err);
    }
  }
}

/**
 * Subscribe to invites targeting the current user
 */
export function subscribeToMyInvites(
  user: UserAccount,
  onInvite: (invite: GameInvite | null) => void
): () => void {
  // Listen to local notifications
  localInviteListeners.add(onInvite);
  if (currentActiveInvite && currentActiveInvite.status === 'pending') {
    onInvite(currentActiveInvite);
  }

  if (!db || !user) {
    return () => {
      localInviteListeners.delete(onInvite);
    };
  }

  // Subscribe to real-time firestore invites for this user's name or uid
  let unsubFirestore: (() => void) | undefined;
  try {
    const invitesRef = collection(db, 'game_invites');
    const q = query(
      invitesRef,
      where('targetFriendName', '==', user.name),
      limit(5)
    );

    unsubFirestore = onSnapshot(q, snap => {
      const pending = snap.docs
        .map(d => d.data() as GameInvite)
        .filter(inv => inv.status === 'pending' && inv.hostUid !== user.uid && Date.now() - inv.createdAt < 300000);

      if (pending.length > 0) {
        onInvite(pending[0]);
      } else {
        onInvite(null);
      }
    });
  } catch (err) {
    console.warn('Invite subscription error:', err);
  }

  return () => {
    localInviteListeners.delete(onInvite);
    if (unsubFirestore) unsubFirestore();
  };
}

/**
 * Simulates friend response for testing when challenging friends in single player / demo mode
 */
const simulatedTimeouts = new Map<string, number>();

function scheduleSimulatedFriendResponse(roomId: string, friend: Friend, buyIn: number) {
  // Clear any existing timer
  const key = `${roomId}_${friend.id}`;
  if (simulatedTimeouts.has(key)) {
    clearTimeout(simulatedTimeouts.get(key));
  }

  // If this friend is online, simulate a natural response in 3-5 seconds
  if (friend.status === 'online') {
    const delay = 2500 + Math.random() * 2500;
    const timeoutId = window.setTimeout(async () => {
      simulatedTimeouts.delete(key);

      // Determine outcome: 40% will join, 35% will join shortly, 25% can't make it
      const rand = Math.random();
      let response: 'joined' | 'will_join_later' | 'dismissed' = 'joined';
      if (rand < 0.25) {
        response = 'dismissed';
      } else if (rand < 0.6) {
        response = 'will_join_later';
      } else {
        response = 'joined';
      }

      await respondToChallengeInvite(`inv_${roomId}_${friend.id}`, roomId, friend.id, response);

      // If joined, also add to room's players list in Firestore so they take a seat in the lobby!
      if (response === 'joined' && db) {
        try {
          const roomRef = doc(db, 'rooms', roomId);
          const roomSnap = await getDoc(roomRef);
          if (roomSnap.exists()) {
            const roomData = roomSnap.data() as GameRoom;
            const alreadyIn = roomData.players.some(p => p.name === friend.name);
            if (!alreadyIn) {
              const joinedFriendPlayer = {
                uid: friend.id,
                sessionId: 'sim_' + friend.id,
                name: friend.name,
                color: friend.color || '#208b3a',
                image: friend.image,
                diceColors: ['blue', 'red'] as [any, any],
                type: 'human' as const,
                joinedAt: Date.now(),
              };
              await updateDoc(roomRef, {
                players: [...roomData.players, joinedFriendPlayer],
                updatedAt: Date.now(),
              });
            }
          }
        } catch (err) {
          console.warn('Error adding joined simulated friend to room:', err);
        }
      }
    }, delay);

    simulatedTimeouts.set(key, timeoutId);
  }
}
