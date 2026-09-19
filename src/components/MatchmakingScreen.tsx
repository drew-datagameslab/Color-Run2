import React, { useState, useEffect, useRef } from 'react';
import { DiceColor, GameSettings, UserAccount } from '../types/game';
import { ColorRunLogo } from './Logo';
import { playSfx } from '../lib/audio';
import { Users, Loader2, ArrowLeft } from 'lucide-react';
import { calculatePayouts } from './PickGameScreen';
import {
  findOrCreateRoom,
  subscribeToRoom,
  finalizeAndStartRoom,
  generateBots,
  leaveRoom,
  GameRoom,
  RoomPlayer,
} from '../lib/matchmaking';

interface MatchmakingScreenProps {
  playerCount: 2 | 4 | 6 | 8;
  buyIn: number;
  tier: 'standard' | 'double' | 'high_roller';
  user: UserAccount;
  equippedColors: [DiceColor, DiceColor];
  onMatchReady: (settings: GameSettings) => void;
  onCancel: () => void;
}

export const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({
  playerCount,
  buyIn,
  tier,
  user,
  equippedColors,
  onMatchReady,
  onCancel,
}) => {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [statusText, setStatusText] = useState('Entering multiplayer room…');
  const [isStarting, setIsStarting] = useState(false);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || equippedColors;

  const roomRef = useRef<GameRoom | null>(null);
  roomRef.current = room;

  const matchLaunchedRef = useRef(false);
  const initRanRef = useRef(false);

  const launchMatchWithSlots = (slots: GameSettings['slots'], roomId: string) => {
    if (matchLaunchedRef.current) return;
    matchLaunchedRef.current = true;
    const mult = tier === 'high_roller' ? 5 : tier === 'double' ? 2 : 1;
    const payouts = calculatePayouts(playerCount, tier);

    // Ensure isOwner and isOnlinePlayer are tailored for the current local client
    const localizedSlots = slots.map(s => {
      const isCurrentLocalUser = s.uid === user.uid;
      return {
        ...s,
        isOwner: isCurrentLocalUser,
        isOnlinePlayer: s.type === 'human' && !isCurrentLocalUser,
      };
    });

    playSfx('fanfare');
    onMatchReady({
      playersCount: playerCount,
      mode: 'online',
      threshold: 250,
      buyIn,
      tier,
      payoutMultiplier: mult,
      payouts,
      adPlayedDuringMatchmaking: true,
      roomId,
      colorA: userDiceColors[0],
      colorB: userDiceColors[1],
      slots: localizedSlots,
    });
  };

  // 1. Enter or create the multiplayer room for this game version
  useEffect(() => {
    if (initRanRef.current) return;
    initRanRef.current = true;

    let unsubscribe: (() => void) | undefined;
    let isCancelled = false;

    async function initRoom() {
      try {
        setStatusText('Searching for open room…');
        const { room: initialRoom } = await findOrCreateRoom(
          tier,
          playerCount,
          buyIn,
          user,
          equippedColors
        );

        if (isCancelled) return;
        setRoom(initialRoom);
        setStatusText('Connected to room. Waiting for players…');

        // Check if room was already finalized
        if (initialRoom.status === 'in_progress' && initialRoom.finalSlots) {
          launchMatchWithSlots(initialRoom.finalSlots, initialRoom.id);
          return;
        }

        // Subscribe to real-time room updates from Firestore
        unsubscribe = subscribeToRoom(initialRoom.id, updatedRoom => {
          if (isCancelled) return;
          setRoom(prev => {
            // Play sound chime when a new player joins
            if (prev && updatedRoom.players.length > prev.players.length) {
              playSfx('add');
            }
            return updatedRoom;
          });

          // When the room is marked in_progress with final slots, launch immediately!
          if (updatedRoom.status === 'in_progress' && updatedRoom.finalSlots && !matchLaunchedRef.current) {
            launchMatchWithSlots(updatedRoom.finalSlots, updatedRoom.id);
          }
        });
      } catch (err) {
        console.warn('Matchmaking init error:', err);
        setStatusText('Searching for online players…');
      }
    }

    initRoom();

    return () => {
      isCancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [tier, playerCount, buyIn, user, equippedColors]);

  // 2. Countdown timer based on room creation timestamp (15-second total entry window)
  useEffect(() => {
    if (!room) return;

    const interval = setInterval(() => {
      const curRoom = roomRef.current;
      if (!curRoom) return;

      const now = Date.now();
      const elapsed = now - curRoom.createdAt;
      const remainingMs = Math.max(0, 15000 - elapsed);
      const remainingSec = Math.ceil(remainingMs / 1000);

      setSecondsLeft(remainingSec);

      if (remainingSec <= 3 && remainingSec > 0) {
        setStatusText('Filling remaining spots with computer players…');
      }

      // Time expired! Launch the game
      if (remainingMs <= 0 && !matchLaunchedRef.current) {
        clearInterval(interval);
        setStatusText('All slots filled! Preparing game…');
        setIsStarting(true);
        setStartCountdown(2);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [room?.createdAt, room?.id]);

  // 3. Launch the game when countdown finishes
  useEffect(() => {
    if (startCountdown === null) return;

    if (startCountdown <= 0) {
      const curRoom = roomRef.current;
      if (!curRoom || matchLaunchedRef.current) return;

      // If room already has finalSlots, launch using them
      if (curRoom.finalSlots && curRoom.finalSlots.length > 0) {
        launchMatchWithSlots(curRoom.finalSlots, curRoom.id);
        return;
      }

      // Otherwise, the first joined human player finalizes slots and persists to Firestore
      const isAuthority = curRoom.players.length > 0 && curRoom.players[0].uid === user.uid;

      const humanPlayers: RoomPlayer[] = curRoom.players || [
        {
          uid: user.uid,
          name: user.name,
          color: user.avatar.color,
          image: user.avatar.image,
          diceColors: userDiceColors,
          type: 'human',
          joinedAt: Date.now(),
        },
      ];

      const neededBots = Math.max(0, playerCount - humanPlayers.length);
      const bots = generateBots(neededBots, humanPlayers.length);
      const combined = [...humanPlayers, ...bots];

      const canonicalSlots: GameSettings['slots'] = combined.slice(0, playerCount).map(p => {
        return {
          name: p.name,
          type: p.type,
          color: p.color,
          image: p.image,
          diceColors: p.diceColors || ['blue', 'red'],
          uid: p.uid,
        };
      });

      if (curRoom.id) {
        finalizeAndStartRoom(curRoom.id, canonicalSlots);
      }

      launchMatchWithSlots(canonicalSlots, curRoom.id);
      return;
    }

    playSfx('add');
    const t = setTimeout(() => {
      setStartCountdown(c => (c !== null ? c - 1 : null));
    }, 1000);

    return () => clearTimeout(t);
  }, [startCountdown, playerCount, user, userDiceColors]);

  // Handle user cancelling matchmaking
  const handleCancel = async () => {
    if (room?.id) {
      await leaveRoom(room.id, user.uid);
    }
    onCancel();
  };

  // Build display slots for the UI
  const displaySlots: Array<RoomPlayer | null> = new Array(playerCount).fill(null);
  const currentHumans = room?.players || [
    {
      uid: user.uid,
      name: user.name,
      color: user.avatar.color,
      image: user.avatar.image,
      diceColors: userDiceColors,
      type: 'human',
      joinedAt: Date.now(),
    },
  ];
  const neededBotsPreview = Math.max(0, playerCount - currentHumans.length);
  const currentBots = secondsLeft <= 3
    ? generateBots(neededBotsPreview, currentHumans.length)
    : (room?.filledBots || []);

  let writeIdx = 0;
  currentHumans.forEach(hp => {
    if (writeIdx < playerCount) {
      displaySlots[writeIdx++] = hp;
    }
  });
  currentBots.forEach(bp => {
    if (writeIdx < playerCount) {
      displaySlots[writeIdx++] = bp;
    }
  });

  const filledCount = displaySlots.filter(Boolean).length;

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-between min-h-0 py-2 sm:py-3 px-3 select-none animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col items-center w-full mt-1">
        <ColorRunLogo size="sm" />

        <div className="mt-1 text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#d9ba6d]">
            MULTIPLAYER MATCHMAKING
          </div>
          <h2 className="text-base sm:text-lg font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {playerCount} Players · 🪙 {buyIn} Buy-In
          </h2>
          {room?.id && (
            <div className="text-[9px] font-mono text-[#ecd8b0]/70 mt-0.5">
              Room: {room.id.slice(-8)}
            </div>
          )}
        </div>
      </div>

      {/* Center Radar / Timer Widget with Loading Bar */}
      <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col items-center my-2">
        {/* Loading Bar Timer */}
        <div className="w-full mb-2 bg-white/80 p-2.5 rounded-xl border border-[#ebdcb9]">
          <div className="flex items-center justify-between text-xs font-bold text-[#4a3622] mb-1.5">
            <span className="flex items-center gap-1.5">
              {!isStarting && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2f9a4f]" />}
              <span>{isStarting ? `Starting game in ${startCountdown}s…` : statusText}</span>
            </span>
            <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-[#2f9a4f]/15 text-[#1c6a35]">
              {isStarting ? `${startCountdown}s` : `${secondsLeft}s`}
            </span>
          </div>
          {/* Visual Loading Bar */}
          <div className="w-full h-2.5 bg-[#ebdcb9] rounded-full overflow-hidden shadow-inner border border-[#c9b877]/60">
            <div
              className="h-full bg-gradient-to-r from-[#2f9a4f] via-[#3ebd63] to-[#2f9a4f] rounded-full transition-all duration-300 ease-linear shadow-xs"
              style={{
                width: isStarting ? '100%' : `${Math.min(100, Math.max(0, ((15 - secondsLeft) / 15) * 100))}%`,
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-1 text-[10px] text-[#735c46]">
            <span>15s matchmaking entry window</span>
            <span className="font-bold">Slots: {filledCount}/{playerCount} filled</span>
          </div>
        </div>

        {/* 10-second Ad Banner during the 15s Matchmaking Lobby for non-ad-free players */}
        {!user.isAdFree && (
          <div className="w-full mb-2 bg-gradient-to-r from-[#2b170a] to-[#452712] border border-[#f2c14e]/70 rounded-xl p-2 text-[#faf4e6] shadow-md flex items-center justify-between gap-2 animate-fade-in">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#e58a1f] to-[#b3630a] flex items-center justify-center shrink-0 text-base shadow-xs">
              🎲
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-[7px] uppercase tracking-wider font-black bg-[#f2c14e] text-[#2b170a] px-1 py-0.2 rounded font-mono">
                  AD
                </span>
                <span className="text-[10px] font-black text-[#faf4e6] truncate">
                  Color Run: Home Edition
                </span>
              </div>
              <p className="text-[9px] text-[#d8c8a7] truncate leading-tight">
                12 custom carved dice &amp; tabletop playmat
              </p>
            </div>
            <div className="text-right shrink-0">
              {secondsLeft > 5 ? (
                <span className="text-[9px] font-mono font-bold text-[#f2c14e] bg-black/40 px-1.5 py-0.5 rounded-full border border-[#f2c14e]/30">
                  Ad: {secondsLeft - 5}s
                </span>
              ) : (
                <span className="text-[9px] font-bold text-[#2f9a4f] bg-black/40 px-1.5 py-0.5 rounded-full border border-[#2f9a4f]/50">
                  ✓ Done
                </span>
              )}
            </div>
          </div>
        )}

        {/* Slots Grid - No "host" designation: all players are peers */}
        <div className="w-full grid grid-cols-2 gap-2">
          {displaySlots.map((slot, idx) => {
            const isLocal = slot?.uid === user.uid;
            return (
              <div
                key={idx}
                className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
                  slot
                    ? 'bg-white border-[#2f9a4f]/50 shadow-xs scale-[1.01]'
                    : 'bg-[#f0e7d5]/60 border-dashed border-[#d4c39f]'
                }`}
              >
                {slot ? (
                  <>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shadow-xs shrink-0"
                      style={{ backgroundColor: slot.color }}
                    >
                      {slot.image ? (
                        <img
                          src={slot.image}
                          alt={slot.name}
                          className="w-full h-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        slot.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-[#2e2316] truncate leading-tight">
                        {slot.name}
                      </div>
                      <div className="text-[10px] flex items-center gap-1 font-bold">
                        {slot.type === 'cpu' ? (
                          <span className="text-amber-700">🤖 CPU Bot</span>
                        ) : isLocal ? (
                          <span className="text-[#1c6a35]">⭐ You</span>
                        ) : (
                          <span className="text-green-700">🟢 Live Player</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 w-full py-1">
                    <div className="w-8 h-8 rounded-full bg-[#dfd0b7]/70 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-[#8a7259] animate-pulse" />
                    </div>
                    <div className="text-[11px] font-bold text-[#8a7259] animate-pulse">
                      Searching…
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cancel Matchmaking Button */}
      {!isStarting && (
        <button
          onClick={handleCancel}
          className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-black/40 hover:bg-black/60 px-4 py-2 rounded-xl backdrop-blur-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Cancel &amp; Refund Buy-In</span>
        </button>
      )}
    </div>
  );
};
