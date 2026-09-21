import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  query,
  where,
  onSnapshot,
  FirestoreError,
} from 'firebase/firestore';
import { db } from './firebase';
import { DiceColor, UserAccount, GameSettings, Die } from '../types/game';

export interface RoomPlayer {
  uid: string;
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
  lastActionId?: string;
  actionTimestamp: number;
  turnAuthorityUid?: string;
  elimModalMsg?: string | null;
}

export interface GameRoom {
  id: string;
  gameKey: string; // e.g. "standard_4", "double_2", "high_roller_6"
  tier: 'standard' | 'double' | 'high_roller';
  playerCount: 2 | 4 | 6 | 8;
  buyIn: number;
  createdAt: number; // ms timestamp when first user selected the game option
  expiresAt: number; // createdAt + 15000
  status: 'waiting' | 'starting' | 'in_progress' | 'cancelled';
  players: RoomPlayer[];
  filledBots?: RoomPlayer[];
  finalSlots?: GameSettings['slots'];
  leftPlayers?: string[];
  gameState?: RoomGameState;
  updatedAt: number;
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

  const currentPlayer: RoomPlayer = {
    uid: user.uid,
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
        const lobbyData = lobbySnap.data() as { roomId: string; createdAt: number; playerCount: number; maxPlayers?: number };
        const elapsed = currentTime - (lobbyData.createdAt || 0);

        // Tolerant time window (up to 60s) to account for minor client clock differences
        if (elapsed > -60000 && elapsed < 60000 && lobbyData.roomId) {
          const targetRoomRef = doc(db, 'rooms', lobbyData.roomId);
          const roomSnap = await transaction.get(targetRoomRef);

          if (roomSnap.exists()) {
            const roomData = roomSnap.data() as GameRoom;
            const currentPlayers = roomData.players || [];
            const isFull = currentPlayers.length >= playerCount;
            const isOpen = roomData.status === 'waiting';

            if (isOpen && !isFull) {
              const alreadyIn = currentPlayers.some(p => p.uid === user.uid);
              const updatedPlayers = alreadyIn ? currentPlayers : [...currentPlayers, currentPlayer];

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
      const newRoom: GameRoom = {
        id: newRoomId,
        gameKey,
        tier,
        playerCount,
        buyIn,
        createdAt: currentTime,
        expiresAt: currentTime + 30000,
        status: 'waiting',
        players: [currentPlayer],
        filledBots: [],
        updatedAt: currentTime,
      };

      const newRoomRef = doc(db, 'rooms', newRoomId);
      transaction.set(newRoomRef, sanitizeForFirestore(newRoom));
      transaction.set(lobbyRef, sanitizeForFirestore({
        roomId: newRoomId,
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

    // 2a. If user is ALREADY waiting in an active room for this gameKey, reuse it!
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as GameRoom;
      const elapsed = now - data.createdAt;
      if (elapsed > -60000 && elapsed < 60000 && data.status === 'waiting') {
        if (data.players && data.players.some(p => p.uid === user.uid)) {
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
        elapsed > -60000 &&
        elapsed < 60000 &&
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
        const alreadyIn = currentPlayers.some(p => p.uid === user.uid);
        const updatedPlayers = alreadyIn ? currentPlayers : [...currentPlayers, currentPlayer];

        await updateDoc(roomRef, sanitizeForFirestore({
          players: updatedPlayers,
          updatedAt: Date.now(),
        }));

        // Set or refresh lobby pointer to this room
        await setDoc(lobbyRef, sanitizeForFirestore({
          roomId: targetRoom.id,
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
  const newRoom: GameRoom = {
    id: newRoomId,
    gameKey,
    tier,
    playerCount,
    buyIn,
    createdAt: now,
    expiresAt: now + 30000,
    status: 'waiting',
    players: [currentPlayer],
    filledBots: [],
    updatedAt: now,
  };

  try {
    const roomRef = doc(db, 'rooms', newRoomId);
    await setDoc(roomRef, sanitizeForFirestore(newRoom));

    // Point active lobby to this brand-new room so phones, tablets, iPads all converge
    const lobbyRef = doc(db, 'lobbies', gameKey);
    await setDoc(lobbyRef, sanitizeForFirestore({
      roomId: newRoomId,
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
  finalSlots: GameSettings['slots']
): Promise<void> {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, sanitizeForFirestore({
      status: 'in_progress',
      finalSlots,
      updatedAt: Date.now(),
    }));
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
    const roomRef = doc(db, 'rooms', roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;

    const data = snap.data() as GameRoom;
    const remainingPlayers = data.players.filter(p => p.uid !== userId);

    if (remainingPlayers.length === 0) {
      await updateDoc(roomRef, { status: 'cancelled', updatedAt: Date.now() });
    } else {
      await updateDoc(roomRef, { players: remainingPlayers, updatedAt: Date.now() });
    }
  } catch (err) {
    console.warn('Error leaving room:', err);
  }
}
