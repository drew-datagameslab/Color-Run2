import { Friend, FriendRequest, PlayerUnit, UserAccount } from '../types/game';
import { db } from './firebase';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';

const FRIENDS_PREFIX = 'cr_friends_';
const REQUESTS_PREFIX = 'cr_friend_reqs_';

export const DEFAULT_FRIENDS: Friend[] = [
  { id: 'f_alex', name: 'Alex M.', color: '#2f9a4f', status: 'online', gamesPlayed: 8, addedAt: '2025-01-10T12:00:00Z', accepted: true },
  { id: 'f_taylor', name: 'Taylor Swift-Roll', color: '#1f7fd6', status: 'online', gamesPlayed: 14, addedAt: '2025-01-11T12:00:00Z', accepted: true },
  { id: 'f_jordan', name: 'Jordan B.', color: '#e58a1f', status: 'online', gamesPlayed: 5, addedAt: '2025-01-12T12:00:00Z', accepted: true },
  { id: 'f_sam', name: 'Sammy Star', color: '#8e44c9', status: 'online', gamesPlayed: 3, addedAt: '2025-01-13T12:00:00Z', accepted: true },
  { id: 'f_casey', name: 'Casey Dice', color: '#d61f7a', status: 'online', gamesPlayed: 19, addedAt: '2025-01-14T12:00:00Z', accepted: true },
  { id: 'f_morgan', name: 'Morgan V.', color: '#0984e3', status: 'online', gamesPlayed: 7, addedAt: '2025-01-15T12:00:00Z', accepted: true },
];

/**
 * Retrieves the local friends list for a user.
 * Enforces offline status for friends who are not accepted or were removed by them.
 */
export function getLocalFriends(userId: string): Friend[] {
  try {
    const raw = localStorage.getItem(FRIENDS_PREFIX + userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(f => {
          // If not accepted or removed by the friend, they ALWAYS appear offline
          if (f.accepted === false || f.removedByThem === true) {
            return { ...f, status: 'offline' as const };
          }
          return f;
        });
      }
    }
  } catch {
    // fallback
  }

  // Seed default friends so user has friends to challenge immediately
  saveLocalFriends(userId, DEFAULT_FRIENDS);
  return DEFAULT_FRIENDS;
}

export function saveLocalFriends(userId: string, friends: Friend[]): void {
  try {
    localStorage.setItem(FRIENDS_PREFIX + userId, JSON.stringify(friends));
  } catch {
    // Ignore
  }
}

/**
 * Retrieves friend requests directed to this user.
 */
export function getFriendRequests(userId: string): FriendRequest[] {
  try {
    const raw = localStorage.getItem(REQUESTS_PREFIX + userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(r => r.status !== 'deleted');
      }
    }
  } catch {
    // fallback
  }
  return [];
}

export function saveFriendRequests(userId: string, reqs: FriendRequest[]): void {
  try {
    localStorage.setItem(REQUESTS_PREFIX + userId, JSON.stringify(reqs));
  } catch {
    // Ignore
  }
}

// In-memory listeners for cross-component / local event dispatch
type FriendRequestListener = (req: FriendRequest) => void;
const localFriendRequestListeners = new Set<FriendRequestListener>();

export function registerLocalFriendRequestListener(listener: FriendRequestListener): () => void {
  localFriendRequestListeners.add(listener);
  return () => {
    localFriendRequestListeners.delete(listener);
  };
}

function notifyFriendRequestListeners(req: FriendRequest) {
  localFriendRequestListeners.forEach(listener => {
    try {
      listener(req);
    } catch (e) {
      console.warn('Error in friend request listener:', e);
    }
  });
}

/**
 * Adds a friend directly (used for mutual referrals, bot friends, etc.)
 */
export async function addFriend(
  userId: string,
  candidate: { id?: string; name: string; color: string; image?: string; accepted?: boolean }
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

  const isAccepted = candidate.accepted !== undefined ? candidate.accepted : true;

  const newFriend: Friend = {
    id: candidate.id || `friend_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    uid: candidate.id && !candidate.id.startsWith('friend_') && !candidate.id.startsWith('f_') ? candidate.id : undefined,
    name: candidate.name,
    color: candidate.color || '#e5352f',
    image: candidate.image,
    status: isAccepted ? 'online' : 'offline',
    accepted: isAccepted,
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

/**
 * When a user clicks an avatar and taps "Add Friend":
 * 1. The requester adds the user to their friends list, but with accepted: false.
 *    (They will see the user as a friend, but they will ALWAYS appear offline until accepted).
 * 2. Creates a FriendRequest for the clicked user.
 * 3. Dispatches the notification banner to the clicked user.
 */
export async function sendFriendRequest(
  currentUser: UserAccount,
  target: {
    id?: string;
    uid?: string;
    name: string;
    color?: string;
    image?: string;
    isCPU?: boolean;
  }
): Promise<{ success: boolean; message: string; friends: Friend[]; request: FriendRequest }> {
  const currentFriends = getLocalFriends(currentUser.uid);

  // Add target to current user's friends list if not already there, with accepted: false
  let updatedFriends = currentFriends;
  const existingFriend = currentFriends.find(
    f => f.name.trim().toLowerCase() === target.name.trim().toLowerCase()
  );

  const targetUid = target.uid || (target.id && !target.id.startsWith('friend_') && !target.id.startsWith('f_') ? target.id : undefined);

  if (!existingFriend) {
    const pendingFriend: Friend = {
      id: target.id || `friend_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      uid: targetUid,
      name: target.name,
      color: target.color || '#e5352f',
      image: target.image,
      status: 'offline', // Always appears offline until accepted!
      accepted: false,
      addedAt: new Date().toISOString(),
      gamesPlayed: 1,
    };
    updatedFriends = [pendingFriend, ...currentFriends];
    saveLocalFriends(currentUser.uid, updatedFriends);

    if (currentUser.uid && !currentUser.uid.startsWith('guest_') && db) {
      try {
        const friendDocRef = doc(db, 'users', currentUser.uid, 'friends', pendingFriend.id);
        await setDoc(friendDocRef, { ...pendingFriend, userId: currentUser.uid });
      } catch {
        // Offline fallback
      }
    }
  }

  const reqId = `freq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const friendReq: FriendRequest = {
    id: reqId,
    fromUid: currentUser.uid,
    fromName: currentUser.name,
    fromColor: currentUser.avatar?.color || currentUser.diceColors?.[0] || '#2f9a4f',
    fromImage: currentUser.avatar?.image,
    toUid: targetUid,
    toName: target.name,
    status: 'pending',
    createdAt: Date.now(),
  };

  // Save to target's requests locally
  const targetKey = targetUid || target.name.trim().toLowerCase();
  const targetExistingReqs = getFriendRequests(targetKey);
  const updatedReqs = [friendReq, ...targetExistingReqs.filter(r => r.fromName.toLowerCase() !== currentUser.name.toLowerCase())];
  saveFriendRequests(targetKey, updatedReqs);

  // Also notify listeners
  notifyFriendRequestListeners(friendReq);

  // Push to Firestore
  if (db) {
    try {
      const firestoreData: Record<string, any> = {
        id: reqId,
        fromUid: currentUser.uid,
        fromName: currentUser.name,
        fromColor: currentUser.avatar?.color || currentUser.diceColors?.[0] || '#2f9a4f',
        toName: target.name,
        status: 'pending',
        createdAt: Date.now(),
      };
      if (currentUser.avatar?.image) firestoreData.fromImage = currentUser.avatar.image;
      if (targetUid) firestoreData.toUid = targetUid;

      const reqDocRef = doc(db, 'friend_requests', reqId);
      await setDoc(reqDocRef, firestoreData);

      if (targetUid) {
        const userReqDocRef = doc(db, 'users', targetUid, 'friendRequests', reqId);
        await setDoc(userReqDocRef, firestoreData);
      }
    } catch (e) {
      console.warn('Error saving friend request to Firestore:', e);
    }
  }

  return {
    success: true,
    message: `Friend request sent to ${target.name}!`,
    friends: updatedFriends,
    request: friendReq,
  };
}

/**
 * Accepts a friend request:
 * - Adds the requester to the recipient's accepted friends list.
 * - Updates requester's friendship record for recipient to accepted: true so recipient now appears online.
 * - Marks request as accepted and removes from pending requests.
 */
export async function acceptFriendRequest(
  currentUserId: string,
  currentUserName: string,
  request: FriendRequest
): Promise<{ friends: Friend[]; requests: FriendRequest[] }> {
  // 1. Add requester to current user's friends list as accepted: true
  const currentFriends = getLocalFriends(currentUserId);
  const existing = currentFriends.find(
    f => f.name.trim().toLowerCase() === request.fromName.trim().toLowerCase()
  );

  let updatedFriends: Friend[];
  if (existing) {
    updatedFriends = currentFriends.map(f =>
      f.id === existing.id ? { ...f, accepted: true, status: 'online' as const, removedByThem: false } : f
    );
  } else {
    const newFriend: Friend = {
      id: request.fromUid ? `friend_${request.fromUid}` : `friend_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      uid: request.fromUid,
      name: request.fromName,
      color: request.fromColor || '#2f9a4f',
      image: request.fromImage,
      status: 'online',
      accepted: true,
      addedAt: new Date().toISOString(),
      gamesPlayed: 1,
    };
    updatedFriends = [newFriend, ...currentFriends];
  }
  saveLocalFriends(currentUserId, updatedFriends);

  // 2. Also update requester's friend record for this user to accepted: true!
  // This allows the requester to now see this user as online!
  if (request.fromUid) {
    const requesterFriends = getLocalFriends(request.fromUid);
    const inRequesterList = requesterFriends.find(
      f => f.name.trim().toLowerCase() === currentUserName.trim().toLowerCase()
    );
    if (inRequesterList) {
      const updatedRequesterList = requesterFriends.map(f =>
        f.id === inRequesterList.id ? { ...f, accepted: true, removedByThem: false, status: 'online' as const } : f
      );
      saveLocalFriends(request.fromUid, updatedRequesterList);
    }
  }

  // 3. Mark request as accepted in local storage
  const targetKey = currentUserId || currentUserName.trim().toLowerCase();
  const currentReqs = getFriendRequests(targetKey);
  const remainingReqs = currentReqs.filter(r => r.id !== request.id);
  saveFriendRequests(targetKey, remainingReqs);

  // 4. Sync with Firestore
  if (db) {
    try {
      const reqRef = doc(db, 'friend_requests', request.id);
      await updateDoc(reqRef, { status: 'accepted' });

      if (currentUserId && !currentUserId.startsWith('guest_')) {
        const friendId = request.fromUid ? `friend_${request.fromUid}` : `friend_${Date.now()}`;
        const friendDocRef = doc(db, 'users', currentUserId, 'friends', friendId);
        const friendPayload: Record<string, any> = {
          id: friendId,
          name: request.fromName,
          color: request.fromColor || '#2f9a4f',
          status: 'online',
          accepted: true,
          addedAt: new Date().toISOString(),
        };
        if (request.fromUid) friendPayload.uid = request.fromUid;
        if (request.fromImage) friendPayload.image = request.fromImage;
        await setDoc(friendDocRef, friendPayload, { merge: true });
      }

      // Update requester's friendship doc in Firestore if exists
      if (request.fromUid && !request.fromUid.startsWith('guest_')) {
        const requesterFriendDoc = doc(db, 'users', request.fromUid, 'friends', `friend_${currentUserId}`);
        await setDoc(requesterFriendDoc, { accepted: true, removedByThem: false }, { merge: true });
      }
    } catch (e) {
      console.warn('Error accepting friend request in Firestore:', e);
    }
  }

  return { friends: updatedFriends, requests: remainingReqs };
}

/**
 * Dismisses a friend request banner:
 * The banner closes, but the request remains in the friend requests list in Account.
 * The requester still sees the user as a friend, but the user ALWAYS appears offline.
 */
export async function dismissFriendRequest(
  currentUserId: string,
  requestId: string
): Promise<FriendRequest[]> {
  const targetKey = currentUserId;
  const currentReqs = getFriendRequests(targetKey);
  const updatedReqs = currentReqs.map(r =>
    r.id === requestId ? { ...r, status: 'dismissed' as const } : r
  );
  saveFriendRequests(targetKey, updatedReqs);

  if (db) {
    try {
      const reqRef = doc(db, 'friend_requests', requestId);
      await updateDoc(reqRef, { status: 'dismissed' });
    } catch (e) {
      console.warn('Error dismissing friend request in Firestore:', e);
    }
  }

  return updatedReqs;
}

/**
 * Deletes a friend request:
 * "The delete button removes the user requesting friendship from the list."
 */
export async function deleteFriendRequest(
  currentUserId: string,
  requestId: string
): Promise<FriendRequest[]> {
  const targetKey = currentUserId;
  const currentReqs = getFriendRequests(targetKey);
  const updatedReqs = currentReqs.filter(r => r.id !== requestId);
  saveFriendRequests(targetKey, updatedReqs);

  if (db) {
    try {
      const reqRef = doc(db, 'friend_requests', requestId);
      await deleteDoc(reqRef);
    } catch (e) {
      console.warn('Error deleting friend request in Firestore:', e);
    }
  }

  return updatedReqs;
}

/**
 * Removes a friend:
 * "If a player removes a friend, the former friend user would still see the user
 * but would not be able to see when they are online."
 */
export async function removeFriend(userId: string, friendId: string, currentUserName?: string): Promise<Friend[]> {
  const current = getLocalFriends(userId);
  const friendToRemove = current.find(f => f.id === friendId);
  const updated = current.filter(f => f.id !== friendId);
  saveLocalFriends(userId, updated);

  // If the former friend has a uid or local entry, flag removedByThem: true so they cannot see when online
  if (friendToRemove?.uid) {
    const formerFriendsList = getLocalFriends(friendToRemove.uid);
    const updatedFormerList = formerFriendsList.map(f => {
      if (f.uid === userId || (currentUserName && f.name.toLowerCase() === currentUserName.toLowerCase())) {
        return { ...f, removedByThem: true, status: 'offline' as const };
      }
      return f;
    });
    saveLocalFriends(friendToRemove.uid, updatedFormerList);
  }

  if (userId && !userId.startsWith('guest_') && db) {
    try {
      const friendDocRef = doc(db, 'users', userId, 'friends', friendId);
      await deleteDoc(friendDocRef);

      if (friendToRemove?.uid) {
        // In former friend's document, flag removedByThem: true so they can still see user but never online
        const formerUserFriendDoc = doc(db, 'users', friendToRemove.uid, 'friends', `friend_${userId}`);
        await setDoc(formerUserFriendDoc, { removedByThem: true, status: 'offline' }, { merge: true });
      }
    } catch {
      // Ignore
    }
  }

  return updated;
}

/**
 * Subscribes to friend requests targeting the user.
 * Dispatches active pending requests to the notification banner callback.
 */
export function subscribeToFriendRequests(
  user: UserAccount,
  onRequestsChange: (reqs: FriendRequest[]) => void,
  onIncomingBanner?: (req: FriendRequest) => void
): () => void {
  // 1. Initial check of local requests
  const localReqs = getFriendRequests(user.uid);
  onRequestsChange(localReqs);

  const pendingLocal = localReqs.find(r => r.status === 'pending');
  if (pendingLocal && onIncomingBanner) {
    onIncomingBanner(pendingLocal);
  }

  // 2. Register local in-memory event listener
  const unsubLocal = registerLocalFriendRequestListener(req => {
    if (
      (req.toUid && req.toUid === user.uid) ||
      (req.toName && req.toName.toLowerCase() === user.name.toLowerCase())
    ) {
      onIncomingBanner?.(req);
      const reqs = getFriendRequests(user.uid);
      const exists = reqs.some(r => r.id === req.id);
      const next = exists ? reqs : [req, ...reqs];
      saveFriendRequests(user.uid, next);
      onRequestsChange(next);
    }
  });

  // 3. Firestore real-time listener if db is active
  if (!db || !user?.uid) {
    return () => unsubLocal();
  }

  let unsubFirestore: (() => void) | undefined;
  try {
    const reqsRef = collection(db, 'friend_requests');
    const q = query(
      reqsRef,
      where('status', 'in', ['pending', 'dismissed']),
      where('toName', '==', user.name)
    );

    unsubFirestore = onSnapshot(
      q,
      snapshot => {
        if (!snapshot.empty) {
          const cloudReqs: FriendRequest[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data() as FriendRequest;
            cloudReqs.push(data);
          });

          // Look for pending request for banner
          const activePending = cloudReqs.find(r => r.status === 'pending');
          if (activePending && onIncomingBanner) {
            onIncomingBanner(activePending);
          }

          saveFriendRequests(user.uid, cloudReqs);
          onRequestsChange(cloudReqs);
        }
      },
      err => {
        console.warn('Friend requests snapshot error:', err);
      }
    );
  } catch (err) {
    console.warn('Error subscribing to friend requests:', err);
  }

  return () => {
    unsubLocal();
    if (unsubFirestore) unsubFirestore();
  };
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
      const merged = Array.from(map.values()).map(f => {
        if (f.accepted === false || f.removedByThem === true) {
          return { ...f, status: 'offline' as const };
        }
        return f;
      });
      saveLocalFriends(userId, merged);
      return merged;
    }
  } catch {
    // Fallback to local
  }

  return getLocalFriends(userId);
}
