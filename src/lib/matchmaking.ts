import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  runTransaction,
  query,
  where,
  onSnapshot,
  FirestoreError,
} from 'firebase/firestore';
import { db } from './firebase';
import { DiceColor, UserAccount, GameSettings, Die, Friend } from '../types/game';

export interface RoomPlayer {
  uid: string;
  sessionId?: string;
  name: string;
  color: string;
  image?: string;
  diceColors?: [DiceColor, DiceColor];
  type: 'human' | 'cpu';
  joinedAt: number;
}

export interface RoomGameState {
  round: number;
  phase: 'regular' | 'elimination' | 'over';
  activeUnitIndex: number;
  activeUnitId: string;
  rollsUsed: number;
  rollSlotsCount?: number;
  dice: Die[];
  scores: Record<string, number>;
  unitHistory: Record<string, Record<number, number>>;
  activeUnitIds: string[];
  unitStatus?: Record<string, { active: boolean; place?: number; score: number; history: Record<number, number> }>;
  lastAction: 'roll' | 'save_dice' | 'bank' | 'sync' | 'step_away' | 'elimination' | 'phase_change';
  lastActionBy: string; // unitId or uid
  lastActionSessionId?: string; // unique persistent device/browser session ID
  lastActionId?: string;
  actionTimestamp: number;
  turnAuthorityUid?: string;
  elimModalMsg?: string | null;
}

export interface GameRoom {
  id: string;
  roomCode?: string; // 4-digit code (e.g. "4821") for direct friend joining
  gameKey: string; // e.g. "standard_4", "double_2", "high_roller_6"
  tier: 'standard' | 'double' | 'high_roller';
  playerCount: 2 | 3 | 4 | 5 | 6 | 8;
  buyIn: number;
  createdAt: number; // ms timestamp when first user selected the game option
  expiresAt: number;
  status: 'waiting' | 'starting' | 'in_progress' | 'cancelled';
  players: RoomPlayer[];
  filledBots?: RoomPlayer[];
  finalSlots?: GameSettings['slots'];
  finalPayouts?: number[];
  leftPlayers?: string[];
  gameState?: RoomGameState;
  updatedAt: number;
  hostUid?: string;
  hostName?: string;
  isChallenge?: boolean;
  invitedResponses?: Record<string, 'pending' | 'joined' | 'will_join_later' | 'dismissed'>;
  invitedFriends?: {
    id: string;
    name: string;
    color: string;
    image?: string;
    status?: 'pending' | 'joined' | 'will_join_later' | 'dismissed';
  }[];
}

export const BOT_NAMES = ['Ava', 'Pixel', 'Chip', 'Byte', 'Vector', 'Nova', 'Key', 'Mouse'];
export const BOT_COLORS = [
  '#1f7fd6',
  '#e58a1f',
  '#8e44c9',
  '#0d4d23',
  '#d61f7a',
  '#00b894',
  '#0984e3',
  '#34495e',
];

/**
 * Generates a persistent browser session ID to differentiate multiple devices or tabs
 * even if they test using the same Google or guest account.
 */
let cachedSessionId: string | null = null;
export function getClientSessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  try {
    const existing = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('cr_session_id') : null;
    if (existing) {
      cachedSessionId = existing;
      return existing;
    }
    const newId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('cr_session_id', newId);
    }
    cachedSessionId = newId;
    return newId;
  } catch {
    if (!cachedSessionId) {
      cachedSessionId = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }
    return cachedSessionId;
  }
}

/**
 * Generates a clean 4-digit numeric room code for direct friend sharing
 */
export function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Deeply sanitizes an object for Firestore by replacing all undefined values with null
 * or stripping them, preventing Firestore "Unsupported field value: undefined" errors.
 */
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (value === undefined) return null;
      return value;
    })
  );
}

/**
 * Generates bot players to fill empty spots in a room
 */
export function generateBots(countNeeded: number, existingCount: number = 0): RoomPlayer[] {
  const bots: RoomPlayer[] = [];
  for (let i = 0; i < countNeeded; i++) {
    const idx = (existingCount + i) % BOT_NAMES.length;
    bots.push({
      uid: `cpu_bot_${existingCount + i}_${Date.now()}`,
      name: BOT_NAMES[idx],
      color: BOT_COLORS[idx],
      image: null,
      type: 'cpu',
      diceColors: ['blue', 'red'],
      joinedAt: Date.now(),
    });
  }
  return bots;
}

/**
 * Finds an open room within the entry window with available spots,
 * or creates a brand-new game room. Uses an active lobby pointer so that all
 * devices selecting the same option join the exact same room.
 */
export async function findOrCreateRoom(
  tier: 'standard' | 'double' | 'high_roller',
  playerCount: 2 | 4 | 6 | 8,
  buyIn: number,
  user: UserAccount,
  equippedColors: [DiceColor, DiceColor]
): Promise<{ room: GameRoom; isNew: boolean }> {
  const gameKey = `${tier}_${playerCount}`;
  const now = Date.now();
  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || equippedColors;
  const sessionId = getClientSessionId();

  const currentPlayer: RoomPlayer = {
    uid: user.uid,
    sessionId,
    name: user.name || 'Player',
    color: user.avatar?.color || '#e5352f',
    image: user.avatar?.image || null,
    diceColors: userDiceColors,
    type: 'human',
    joinedAt: now,
  };

  const lobbyRef = doc(db, 'lobbies', gameKey);

  // 1. Atomic transaction on the lobby & room so devices joining simultaneously (e.g. iPad, Android, iPhone) converge into the same room
  try {
    const result = await runTransaction(db, async transaction => {
      const lobbySnap = await transaction.get(lobbyRef);
      const currentTime = Date.now();

      if (lobbySnap.exists()) {
        const lobbyData = lobbySnap.data() as {
          roomId: string;
          roomCode?: string;
          createdAt: number;
          playerCount: number;
          maxPlayers?: number;
          status?: string;
        };
        const elapsed = currentTime - (lobbyData.createdAt || 0);

        // Tolerant time window (up to 90s) to account for minor client clock differences and reading screens
        if (elapsed > -90000 && elapsed < 90000 && lobbyData.roomId && lobbyData.status !== 'cancelled') {
          const targetRoomRef = doc(db, 'rooms', lobbyData.roomId);
          const roomSnap = await transaction.get(targetRoomRef);

          if (roomSnap.exists()) {
            const roomData = roomSnap.data() as GameRoom;
            const currentPlayers = roomData.players || [];
            const isFull = currentPlayers.length >= playerCount;
            const isOpen = roomData.status === 'waiting';

            if (isOpen && !isFull) {
              const alreadyThisSession = currentPlayers.some(p => p.sessionId && p.sessionId === sessionId);
              if (alreadyThisSession) {
                return {
                  room: { ...roomData, id: lobbyData.roomId },
                  isNew: false,
                };
              }

              // Multi-device testing with the same account (or distinct accounts)
              const sameUidCount = currentPlayers.filter(p => p.uid === user.uid).length;
              const playerToAdd: RoomPlayer = sameUidCount > 0
                ? {
                    ...currentPlayer,
                    name: `${user.name || 'Player'} (${sameUidCount + 1})`,
                    color: sameUidCount === 1 ? '#1f7fd6' : sameUidCount === 2 ? '#e58a1f' : '#8e44c9',
                  }
                : currentPlayer;

              const updatedPlayers = [...currentPlayers, playerToAdd];

              transaction.update(targetRoomRef, sanitizeForFirestore({
                players: updatedPlayers,
                updatedAt: currentTime,
              }));

              transaction.update(lobbyRef, sanitizeForFirestore({
                playerCount: updatedPlayers.length,
                updatedAt: currentTime,
              }));

              return {
                room: { ...roomData, id: lobbyData.roomId, players: updatedPlayers },
                isNew: false,
              };
            }
          }
        }
      }

      // No suitable existing room found in transaction - create one atomically!
      const newRoomId = `room_${currentTime}_${Math.random().toString(36).substring(2, 7)}`;
      const newRoomCode = generateRoomCode();
      const newRoom: GameRoom = {
        id: newRoomId,
        roomCode: newRoomCode,
        gameKey,
        tier,
        playerCount,
        buyIn,
        createdAt: currentTime,
        expiresAt: currentTime + 45000,
        status: 'waiting',
        players: [currentPlayer],
        filledBots: [],
        updatedAt: currentTime,
      };

      const newRoomRef = doc(db, 'rooms', newRoomId);
      transaction.set(newRoomRef, sanitizeForFirestore(newRoom));
      transaction.set(lobbyRef, sanitizeForFirestore({
        roomId: newRoomId,
        roomCode: newRoomCode,
        createdAt: currentTime,
        playerCount: 1,
        maxPlayers: playerCount,
        status: 'waiting',
        updatedAt: currentTime,
      }));

      return { room: newRoom, isNew: true };
    });

    if (result) {
      return result;
    }
  } catch (txErr) {
    console.warn('Matchmaking transaction error, falling back to query scan:', txErr);
  }

  // 2. Search for waiting rooms with the same game version from the rooms collection
  try {
    const roomsCol = collection(db, 'rooms');
    const q = query(
      roomsCol,
      where('gameKey', '==', gameKey),
      where('status', '==', 'waiting')
    );

    const snapshot = await getDocs(q);

    // 2a. If user is ALREADY waiting in an active room on this session, reuse it!
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as GameRoom;
      const elapsed = now - data.createdAt;
      if (elapsed > -90000 && elapsed < 90000 && data.status === 'waiting') {
        if (data.players && data.players.some(p => p.sessionId === sessionId)) {
          return { room: { ...data, id: docSnap.id }, isNew: false };
        }
      }
    }

    // 2b. Look for open candidate rooms created within window with space available
    const candidateRooms: Array<GameRoom & { id: string }> = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as GameRoom;
      const elapsed = now - data.createdAt;
      if (
        elapsed > -90000 &&
        elapsed < 90000 &&
        data.status === 'waiting' &&
        data.players &&
        data.players.length < playerCount
      ) {
        candidateRooms.push({ ...data, id: docSnap.id });
      }
    });

    // Sort by earliest created first (FIFO room filling)
    candidateRooms.sort((a, b) => a.createdAt - b.createdAt);

    // Try joining candidate rooms reliably via getDoc & updateDoc
    for (const targetRoom of candidateRooms) {
      const roomRef = doc(db, 'rooms', targetRoom.id);
      try {
        const freshSnap = await getDoc(roomRef);
        if (!freshSnap.exists()) continue;
        const freshData = freshSnap.data() as GameRoom;
        if (freshData.status !== 'waiting') continue;
        if (freshData.players && freshData.players.length >= playerCount) continue;

        const currentPlayers = freshData.players || [];
        const alreadyThisSession = currentPlayers.some(p => p.sessionId && p.sessionId === sessionId);
        if (alreadyThisSession) {
          return { room: { ...freshData, id: targetRoom.id }, isNew: false };
        }

        const sameUidCount = currentPlayers.filter(p => p.uid === user.uid).length;
        const playerToAdd: RoomPlayer = sameUidCount > 0
          ? {
              ...currentPlayer,
              name: `${user.name || 'Player'} (${sameUidCount + 1})`,
              color: sameUidCount === 1 ? '#1f7fd6' : sameUidCount === 2 ? '#e58a1f' : '#8e44c9',
            }
          : currentPlayer;

        const updatedPlayers = [...currentPlayers, playerToAdd];

        await updateDoc(roomRef, sanitizeForFirestore({
          players: updatedPlayers,
          updatedAt: Date.now(),
        }));

        // Set or refresh lobby pointer to this room
        await setDoc(lobbyRef, sanitizeForFirestore({
          roomId: targetRoom.id,
          roomCode: freshData.roomCode || targetRoom.roomCode,
          createdAt: targetRoom.createdAt,
          playerCount: updatedPlayers.length,
          maxPlayers: playerCount,
          status: 'waiting',
          updatedAt: Date.now(),
        })).catch(() => {});

        return { room: { ...freshData, id: targetRoom.id, players: updatedPlayers }, isNew: false };
      } catch (err) {
        console.warn('Could not join candidate room, trying next:', err);
      }
    }
  } catch (err) {
    console.warn('Matchmaking lookup warning (falling back to new room):', err);
  }

  // 3. No open room with time and space available — create a brand-new room!
  const newRoomId = `room_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const newRoomCode = generateRoomCode();
  const newRoom: GameRoom = {
    id: newRoomId,
    roomCode: newRoomCode,
    gameKey,
    tier,
    playerCount,
    buyIn,
    createdAt: now,
    expiresAt: now + 45000,
    status: 'waiting',
    players: [currentPlayer],
    filledBots: [],
    updatedAt: now,
  };

  try {
    const roomRef = doc(db, 'rooms', newRoomId);
    await setDoc(roomRef, sanitizeForFirestore(newRoom));

    // Point active lobby to this brand-new room so phones, tablets, iPads all converge
    await setDoc(lobbyRef, sanitizeForFirestore({
      roomId: newRoomId,
      roomCode: newRoomCode,
      createdAt: now,
      playerCount: 1,
      maxPlayers: playerCount,
      status: 'waiting',
      updatedAt: now,
    })).catch(() => {});
  } catch (err) {
    console.warn('Could not persist new room to Firestore (local fallback):', err);
  }

  return { room: newRoom, isNew: true };
}

/**
 * Joins an existing waiting game room directly using its 4-digit code
 */
export async function joinRoomByCode(
  code: string,
  user: UserAccount,
  equippedColors: [DiceColor, DiceColor]
): Promise<{ room: GameRoom } | { error: string }> {
  try {
    const cleanCode = code.trim();
    if (!cleanCode) return { error: 'Please enter a 4-digit room code.' };

    const roomsCol = collection(db, 'rooms');
    const q = query(roomsCol, where('roomCode', '==', cleanCode), where('status', '==', 'waiting'));
    const snap = await getDocs(q);

    if (snap.empty) {
      return { error: 'Room not found or match already started. Please check the 4-digit code.' };
    }

    const candidate = snap.docs[0];
    const roomData = candidate.data() as GameRoom;
    const currentPlayers = roomData.players || [];

    if (currentPlayers.length >= roomData.playerCount) {
      return { error: 'This room is already full.' };
    }

    const sessionId = getClientSessionId();
    const alreadyThisSession = currentPlayers.some(p => p.sessionId && p.sessionId === sessionId);
    if (alreadyThisSession) {
      return { room: { ...roomData, id: candidate.id } };
    }

    const sameUidCount = currentPlayers.filter(p => p.uid === user.uid).length;
    const userDiceColors: [DiceColor, DiceColor] = user.diceColors || equippedColors;
    const playerToAdd: RoomPlayer = {
      uid: user.uid,
      sessionId,
      name: sameUidCount > 0 ? `${user.name || 'Player'} (${sameUidCount + 1})` : (user.name || 'Player'),
      color: sameUidCount > 0 ? '#1f7fd6' : (user.avatar?.color || '#e5352f'),
      image: user.avatar?.image || null,
      diceColors: userDiceColors,
      type: 'human',
      joinedAt: Date.now(),
    };

    const updatedPlayers = [...currentPlayers, playerToAdd];
    const roomRef = doc(db, 'rooms', candidate.id);
    await updateDoc(roomRef, sanitizeForFirestore({
      players: updatedPlayers,
      updatedAt: Date.now(),
    }));

    // Update lobby pointer if matching gameKey
    if (roomData.gameKey) {
      const lobbyRef = doc(db, 'lobbies', roomData.gameKey);
      await updateDoc(lobbyRef, sanitizeForFirestore({
        playerCount: updatedPlayers.length,
        updatedAt: Date.now(),
      })).catch(() => {});
    }

    return { room: { ...roomData, id: candidate.id, players: updatedPlayers } };
  } catch (err: any) {
    console.error('Error joining room by code:', err);
    return { error: err?.message || 'Could not connect to room. Please try again.' };
  }
}

/**
 * Subscribes to real-time changes of a game room document
 */
export function subscribeToRoom(
  roomId: string,
  onUpdate: (room: GameRoom) => void
): () => void {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    return onSnapshot(
      roomRef,
      snapshot => {
        if (snapshot.exists()) {
          onUpdate({ ...(snapshot.data() as GameRoom), id: snapshot.id });
        }
      },
      (error: FirestoreError) => {
        console.warn('Room subscription error:', error);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Finalizes the slots and transitions room to in_progress
 */
export async function finalizeAndStartRoom(
  roomId: string,
  finalSlots: GameSettings['slots'],
  finalPayouts?: number[],
  actualPlayerCount?: number
): Promise<void> {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const updateData: Record<string, any> = {
      status: 'in_progress',
      finalSlots,
      updatedAt: Date.now(),
    };
    if (finalPayouts && finalPayouts.length > 0) {
      updateData.finalPayouts = finalPayouts;
    }
    if (actualPlayerCount) {
      updateData.playerCount = actualPlayerCount;
    }
    await updateDoc(roomRef, sanitizeForFirestore(updateData));
  } catch (err) {
    console.warn('Could not finalize room slots:', err);
  }
}

/**
 * Updates room status
 */
export async function setRoomStatus(
  roomId: string,
  status: 'waiting' | 'starting' | 'in_progress' | 'cancelled'
): Promise<void> {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, sanitizeForFirestore({ status, updatedAt: Date.now() }));
  } catch (err) {
    console.warn('Could not update room status:', err);
  }
}

/**
 * Updates the shared game state during gameplay
 */
export async function updateRoomGameState(
  roomId: string,
  stateUpdate: Partial<RoomGameState>
): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  // Deep-strip any undefined fields to prevent Firestore serialization errors
  const sanitized: Partial<RoomGameState> = sanitizeForFirestore(stateUpdate);

  if (!sanitized.lastActionId) {
    sanitized.lastActionId = `${sanitized.lastAction || 'act'}_${sanitized.lastActionBy || 'p'}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  if (!sanitized.lastActionSessionId) {
    sanitized.lastActionSessionId = getClientSessionId();
  }
  if (!sanitized.actionTimestamp) {
    sanitized.actionTimestamp = Date.now();
  }

  // Primary: updateDoc with dot-notation merges fields cleanly inside the gameState map,
  // preventing unrelated fields (like round, phase, activeUnitIndex) from being wiped!
  const updatePayload: Record<string, any> = {
    updatedAt: Date.now(),
  };
  Object.entries(sanitized).forEach(([key, val]) => {
    updatePayload[`gameState.${key}`] = val;
  });

  try {
    await updateDoc(roomRef, updatePayload);
  } catch (err) {
    try {
      // Fallback: if document has not initialized the gameState map yet, use setDoc with merge
      await setDoc(roomRef, sanitizeForFirestore({ gameState: sanitized, updatedAt: Date.now() }), { merge: true });
    } catch (fallbackErr) {
      console.error('All Firestore update attempts failed for game state:', fallbackErr);
    }
  }
}

/**
 * Marks that a player left or disconnected from the room
 */
export async function markPlayerLeft(roomId: string, userId: string): Promise<void> {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;
    const data = snap.data() as GameRoom;
    const leftUids: string[] = data.leftPlayers || [];
    if (!leftUids.includes(userId)) {
      leftUids.push(userId);
    }
    await updateDoc(roomRef, { leftPlayers: leftUids, updatedAt: Date.now() });
  } catch (err) {
    console.warn('Could not mark player left:', err);
  }
}

/**
 * Leaves or cancels matchmaking in a room
 */
export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  try {
    const sessionId = getClientSessionId();
    const roomRef = doc(db, 'rooms', roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const data = snap.data() as GameRoom;
    const remainingPlayers = (data.players || []).filter(
      p => (p.sessionId ? p.sessionId !== sessionId : p.uid !== userId)
    );

    if (remainingPlayers.length === 0) {
      await updateDoc(roomRef, { status: 'cancelled', updatedAt: Date.now() });
      if (data.gameKey) {
        const lobbyRef = doc(db, 'lobbies', data.gameKey);
        await deleteDoc(lobbyRef).catch(() => {});
      }
    } else {
      await updateDoc(roomRef, { players: remainingPlayers, updatedAt: Date.now() });
      if (data.gameKey) {
        const lobbyRef = doc(db, 'lobbies', data.gameKey);
        await updateDoc(lobbyRef, { playerCount: remainingPlayers.length, updatedAt: Date.now() }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Error leaving room:', err);
  }
}

/**
 * Creates a challenge room hosted by a player with invited friends
 */
export async function createChallengeRoom(
  user: UserAccount,
  equippedColors: [DiceColor, DiceColor],
  invitedFriends: Friend[],
  buyIn: number
): Promise<GameRoom> {
  const code = generateRoomCode();
  const roomId = 'room_ch_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const now = Date.now();
  const sessionId = getClientSessionId();
  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || equippedColors;

  const hostPlayer: RoomPlayer = {
    uid: user.uid,
    sessionId,
    name: user.name || 'Host',
    color: user.avatar?.color || '#e58a1f',
    image: user.avatar?.image || null,
    diceColors: userDiceColors,
    type: 'human',
    joinedAt: now,
  };

  const initialResponses: Record<string, 'pending' | 'joined' | 'will_join_later' | 'dismissed'> = {};
  invitedFriends.forEach(f => {
    initialResponses[f.id] = 'pending';
  });

  const totalCount = Math.min(6, Math.max(2, invitedFriends.length + 1));
  const clampedPlayerCount: 2 | 3 | 4 | 5 | 6 = totalCount as 2 | 3 | 4 | 5 | 6;

  const room: GameRoom = {
    id: roomId,
    roomCode: code,
    gameKey: `challenge_${clampedPlayerCount}_${buyIn}`,
    tier: 'standard',
    playerCount: clampedPlayerCount,
    buyIn,
    createdAt: now,
    expiresAt: now + 300000,
    status: 'waiting',
    players: [hostPlayer],
    updatedAt: now,
    hostUid: user.uid,
    hostName: user.name,
    isChallenge: true,
    invitedResponses: initialResponses,
    invitedFriends: invitedFriends.map(f => ({
      id: f.id,
      name: f.name,
      color: f.color,
      image: f.image,
      status: 'pending',
    })),
  };

  if (db) {
    try {
      await setDoc(doc(db, 'rooms', roomId), sanitizeForFirestore(room));
    } catch (err) {
      console.warn('Error creating challenge room in Firestore:', err);
    }
  }

  return room;
}

/**
 * Joins an existing challenge room
 */
export async function joinChallengeRoom(
  roomId: string,
  user: UserAccount,
  equippedColors: [DiceColor, DiceColor]
): Promise<GameRoom | null> {
  if (!db) return null;
  const roomRef = doc(db, 'rooms', roomId);
  const sessionId = getClientSessionId();
  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || equippedColors;

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return null;
    const room = snap.data() as GameRoom;

    // Check if player already in room
    const alreadyIn = room.players.some(
      p => p.uid === user.uid || (p.sessionId && p.sessionId === sessionId)
    );
    if (alreadyIn) return room;

    const newPlayer: RoomPlayer = {
      uid: user.uid,
      sessionId,
      name: user.name || 'Player',
      color: user.avatar?.color || '#1f7fd6',
      image: user.avatar?.image || null,
      diceColors: userDiceColors,
      type: 'human',
      joinedAt: Date.now(),
    };

    const updatedPlayers = [...room.players, newPlayer];
    await updateDoc(roomRef, {
      players: sanitizeForFirestore(updatedPlayers),
      updatedAt: Date.now(),
    });

    return {
      ...room,
      players: updatedPlayers,
    };
  } catch (err) {
    console.warn('Error joining challenge room:', err);
    return null;
  }
}

