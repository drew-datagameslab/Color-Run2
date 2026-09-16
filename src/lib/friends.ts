import { Friend, PlayerUnit, UserAccount } from '../types/game';
import { db } from './firebase';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const FRIENDS_PREFIX = 'cr_friends_';

export function getLocalFriends(userId: string): Friend[] {
  try {
    const raw = localStorage.getItem(FRIENDS_PREFIX + userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  return [];
}

export function saveLocalFriends(userId: string, friends: Friend[]): void {
  try {
    localStorage.setItem(FRIENDS_PREFIX + userId, JSON.stringify(friends));
  } catch {
    // Ignore
  }
}

export async function addFriend(
  userId: string,
  candidate: { id?: string; name: string; color: string; image?: string }
): Promise<{ success: boolean; message: string; friends: Friend[]; isDuplicate?: boolean }> {
  const current = getLocalFriends(userId);

  // Check duplicate by name (case-insensitive)
  const existing = current.find(
    f => f.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()
  );

  if (existing) {
    return {
      success: false,
      isDuplicate: true,
      message: `${candidate.name} is already in your friends list!`,
      friends: current,
    };
  }

  const newFriend: Friend = {
    id: candidate.id || `friend_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: candidate.name,
    color: candidate.color || '#e5352f',
    image: candidate.image,
    status: Math.random() > 0.35 ? 'online' : 'in-game',
    addedAt: new Date().toISOString(),
    gamesPlayed: 1,
  };

  const updated = [newFriend, ...current];
  saveLocalFriends(userId, updated);

  // Firestore sync if not guest
  if (userId && !userId.startsWith('guest_') && db) {
    try {
      const friendDocRef = doc(db, 'users', userId, 'friends', newFriend.id);
      await setDoc(friendDocRef, { ...newFriend, userId });
    } catch {
      // Offline fallback
    }
  }

  return {
    success: true,
    message: `✨ ${candidate.name} added to your friends list!`,
    friends: updated,
  };
}

export async function removeFriend(userId: string, friendId: string): Promise<Friend[]> {
  const current = getLocalFriends(userId);
  const updated = current.filter(f => f.id !== friendId);
  saveLocalFriends(userId, updated);

  if (userId && !userId.startsWith('guest_') && db) {
    try {
      const friendDocRef = doc(db, 'users', userId, 'friends', friendId);
      await deleteDoc(friendDocRef);
    } catch {
      // Ignore
    }
  }

  return updated;
}

export async function syncFriendsFromFirestore(userId: string): Promise<Friend[]> {
  if (!userId || userId.startsWith('guest_') || !db) {
    return getLocalFriends(userId);
  }

  try {
    const colRef = collection(db, 'users', userId, 'friends');
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      const cloudFriends: Friend[] = [];
      snapshot.forEach(d => {
        cloudFriends.push(d.data() as Friend);
      });
      // Merge with local
      const local = getLocalFriends(userId);
      const map = new Map<string, Friend>();
      local.forEach(f => map.set(f.name.toLowerCase(), f));
      cloudFriends.forEach(f => map.set(f.name.toLowerCase(), f));
      const merged = Array.from(map.values());
      saveLocalFriends(userId, merged);
      return merged;
    }
  } catch {
    // Fallback to local
  }

  return getLocalFriends(userId);
}
