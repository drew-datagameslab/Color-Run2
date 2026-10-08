import {
  getLocalFriends,
  saveLocalFriends,
  getFriendRequests,
  saveFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  dismissFriendRequest,
  deleteFriendRequest,
  removeFriend,
} from '../lib/friends';
import { mergeFriendsWithPresence, UserPresence } from '../lib/presence';
import { UserAccount, Friend } from '../types/game';

export function runFriendsTests() {
  console.log('--- Running Friends & Friend Requests Tests ---');

  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] || null,
      length: store.size,
    } as any;
  }

  const userA: UserAccount = {
    uid: 'user_a_' + Date.now(),
    name: 'Alice Roller',
    email: 'alice@example.com',
    provider: 'guest',
    scoreboardUnlocked: true,
    avatar: { name: 'Alice', color: '#1f7fd6' },
    level: 5,
    xp: 200,
    totalXp: 1200,
    prestige: 0,
    diceColors: ['blue', 'red'],
  };

  const userB: UserAccount = {
    uid: 'user_b_' + Date.now(),
    name: 'Bob Banker',
    email: 'bob@example.com',
    provider: 'guest',
    scoreboardUnlocked: true,
    avatar: { name: 'Bob', color: '#e5352f' },
    level: 3,
    xp: 150,
    totalXp: 800,
    prestige: 0,
    diceColors: ['green', 'orange'],
  };

  // 1. User A sends friend request to User B
  const sendResult = sendFriendRequest(userA, {
    uid: userB.uid,
    name: userB.name,
    color: userB.avatar.color,
  });

  return sendResult.then(async (res) => {
    // Verification: User A sees User B as friend, but ALWAYS offline until accepted!
    const aFriends = getLocalFriends(userA.uid);
    const bInAList = aFriends.find(f => f.name === userB.name);
    if (!bInAList) throw new Error('User B must appear in User A friends list');
    if (bInAList.accepted !== false) throw new Error('User B must not be accepted initially');
    if (bInAList.status !== 'offline') throw new Error('User B must appear offline until accepted');

    // Verification: User B receives friend request
    const bRequests = getFriendRequests(userB.uid);
    const reqFromA = bRequests.find(r => r.fromUid === userA.uid);
    if (!reqFromA) throw new Error('User B must have received friend request from User A');
    if (reqFromA.status !== 'pending') throw new Error('Request status must be pending');

    // 2. Test Dismiss flow: User B dismisses the notification banner
    await dismissFriendRequest(userB.uid, reqFromA.id);
    const bReqsAfterDismiss = getFriendRequests(userB.uid);
    const dismissedReq = bReqsAfterDismiss.find(r => r.id === reqFromA.id);
    if (!dismissedReq || dismissedReq.status !== 'dismissed') {
      throw new Error('Request must remain in list as dismissed after banner dismissal');
    }

    // User A STILL sees User B as offline
    const aFriendsAfterDismiss = getLocalFriends(userA.uid);
    const bStillOffline = aFriendsAfterDismiss.find(f => f.name === userB.name);
    if (bStillOffline?.status !== 'offline') {
      throw new Error('Invited user must still appear offline after dismissal');
    }

    // Presence check: Even if User B is online in presence map, they MUST appear offline to User A!
    const mockPresenceMap = new Map<string, UserPresence>();
    mockPresenceMap.set(userB.uid, {
      uid: userB.uid,
      name: userB.name,
      status: 'online',
      lastSeen: Date.now(),
      updatedAt: Date.now(),
      color: '#e5352f',
    });
    const presenceFriends = mergeFriendsWithPresence(aFriendsAfterDismiss, mockPresenceMap, userA.uid);
    const bInPresence = presenceFriends.find(f => f.name === userB.name);
    if (bInPresence?.status !== 'offline') {
      throw new Error('Unaccepted friend must be forced offline by presence merge');
    }

    // 3. Test Accept flow: User B accepts the request from Account > Friends
    const acceptRes = await acceptFriendRequest(userB.uid, userB.name, dismissedReq);
    const bFriends = acceptRes.friends;
    const aInBList = bFriends.find(f => f.name === userA.name);
    if (!aInBList || aInBList.accepted !== true) {
      throw new Error('User A must be an accepted friend in User B list');
    }

    // User A can now see User B as online!
    const aFriendsAfterAccept = getLocalFriends(userA.uid);
    const bNowAccepted = aFriendsAfterAccept.find(f => f.name === userB.name);
    if (!bNowAccepted || bNowAccepted.accepted !== true) {
      throw new Error('User B must now be accepted in User A list');
    }

    const presenceAfterAccept = mergeFriendsWithPresence(aFriendsAfterAccept, mockPresenceMap, userA.uid);
    const bNowOnline = presenceAfterAccept.find(f => f.name === userB.name);
    if (bNowOnline?.status !== 'online') {
      throw new Error('User B must now appear online after acceptance');
    }

    // 4. Test Remove flow: User B removes User A
    // "If a player removes a friend, the former friend user would still see the user but would not be able to see when they are online."
    const bFriendsAfterRemove = await removeFriend(userB.uid, aInBList.id, userB.name);
    if (bFriendsAfterRemove.some(f => f.id === aInBList.id)) {
      throw new Error('User A must be removed from User B friends list');
    }

    // Former friend User A still sees User B, but cannot see when online!
    const aFriendsAfterBRemoved = getLocalFriends(userA.uid);
    const bStillInAList = aFriendsAfterBRemoved.find(f => f.name === userB.name);
    if (!bStillInAList) {
      throw new Error('Former friend User A must still see User B in friends list');
    }
    const presenceAfterRemove = mergeFriendsWithPresence(aFriendsAfterBRemoved, mockPresenceMap, userA.uid);
    const bForcedOffline = presenceAfterRemove.find(f => f.name === userB.name);
    if (bForcedOffline?.status !== 'offline') {
      throw new Error('User B must appear offline to User A after removal');
    }

    // 5. Test Delete Request flow
    // Create new test request and delete it
    const testReq = {
      id: 'req_delete_test',
      fromUid: 'user_c',
      fromName: 'Charlie',
      toUid: userB.uid,
      toName: userB.name,
      status: 'pending' as const,
      createdAt: Date.now(),
    };
    saveFriendRequests(userB.uid, [testReq]);
    const afterDelete = await deleteFriendRequest(userB.uid, testReq.id);
    if (afterDelete.some(r => r.id === testReq.id)) {
      throw new Error('Delete button must remove user requesting friendship from list');
    }

    console.log('✓ Friend request notification, offline behavior, acceptance, and removal verified!');
  });
}
