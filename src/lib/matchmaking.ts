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
  dice: Die[];
  scores: Record<string, number>;
  unitHistory: Record<string, Record<number, number>>;
  activeUnitIds: string[];
  lastAction: 'roll' | 'save_dice' | 'bank' | 'sync' | 'step_away';
  lastActionBy: string; // unitId or uid
  actionTimestamp: number;
  turnAuthorityUid: string;
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
      type: 'cpu',
      diceColors: ['blue', 'red'],
      joinedAt: Date.now(),
    });
  }
  return bots;
}

/**
 * Finds an open room within the 15-second entry window with available spots,
 * or creates a brand-new game room.
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
    name: user.name,
    color: user.avatar.color,
    image: user.avatar.image,
    diceColors: userDiceColors,
    type: 'human',
    joinedAt: now,
  };

  try {
    // 1. Search for waiting rooms with the same game version
    const roomsCol = collection(db, 'rooms');
    const q = query(
      roomsCol,
      where('gameKey', '==', gameKey),
      where('status', '==', 'waiting')
    );

    const snapshot = await getDocs(q);

    // 1a. If user is ALREADY waiting in an active room for this gameKey (< 15s elapsed), reuse it!
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as GameRoom;
      const elapsed = now - data.createdAt;
      if (elapsed >= 0 && elapsed < 15000 && data.status === 'waiting') {
        if (data.players && data.players.some(p => p.uid === user.uid)) {
          return { room: { ...data, id: docSnap.id }, isNew: false };
        }
      }
    }

    // 1b. Look for open candidate rooms created within the 14s entry window with space available
    const candidateRooms: Array<GameRoom & { id: string }> = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as GameRoom;
      const elapsed = now - data.createdAt;
      if (
        elapsed >= 0 &&
        elapsed < 14000 &&
        data.status === 'waiting' &&
        data.players &&
        data.players.length < playerCount
      ) {
        candidateRooms.push({ ...data, id: docSnap.id });
      }
    });

    // Sort by earliest created first (FIFO room filling)
    candidateRooms.sort((a, b) => a.createdAt - b.createdAt);

    // Try joining candidate rooms atomically via transaction
    for (const targetRoom of candidateRooms) {
      const roomRef = doc(db, 'rooms', targetRoom.id);
      try {
        const joinedRoom = await runTransaction(db, async transaction => {
          const roomDoc = await transaction.get(roomRef);
          if (!roomDoc.exists()) throw new Error('Room does not exist');
          const roomData = roomDoc.data() as GameRoom;
          if (roomData.status !== 'waiting') throw new Error('Room is no longer waiting');
          const elapsed = Date.now() - roomData.createdAt;
          if (elapsed >= 15000) throw new Error('Room entry window expired');
          if (roomData.players && roomData.players.length >= playerCount) {
            throw new Error('Room is full');
          }

          const currentPlayers = roomData.players || [];
          const alreadyIn = currentPlayers.some(p => p.uid === user.uid);
          const updatedPlayers = alreadyIn ? currentPlayers : [...currentPlayers, currentPlayer];

          transaction.update(roomRef, {
            players: updatedPlayers,
            updatedAt: Date.now(),
          });

          return { ...roomData, id: targetRoom.id, players: updatedPlayers };
        });

        return { room: joinedRoom, isNew: false };
      } catch (err) {
        console.warn('Could not join candidate room via transaction, trying next:', err);
      }
    }
  } catch (err) {
    console.warn('Matchmaking lookup warning (falling back to new room):', err);
  }

  // 2. No open room with time and space available — create a brand-new room!
  const newRoomId = `room_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const newRoom: GameRoom = {
    id: newRoomId,
    gameKey,
    tier,
    playerCount,
    buyIn,
    createdAt: now,
    expiresAt: now + 15000,
    status: 'waiting',
    players: [currentPlayer],
    filledBots: [],
    updatedAt: now,
  };

  try {
    const roomRef = doc(db, 'rooms', newRoomId);
    await setDoc(roomRef, newRoom);
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
    await updateDoc(roomRef, {
      status: 'in_progress',
      finalSlots,
      updatedAt: Date.now(),
    });
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
    await updateDoc(roomRef, { status, updatedAt: Date.now() });
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
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const updatePayload: Record<string, any> = {
      updatedAt: Date.now(),
    };
    Object.entries(stateUpdate).forEach(([key, val]) => {
      updatePayload[`gameState.${key}`] = val;
    });
    await updateDoc(roomRef, updatePayload);
  } catch (err) {
    console.warn('Could not update room game state:', err);
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
