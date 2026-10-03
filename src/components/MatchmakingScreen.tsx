import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DiceColor, GameSettings, UserAccount, Friend } from '../types/game';
import { ColorRunLogo } from './Logo';
import { playSfx } from '../lib/audio';
import { Users, Loader2, ArrowLeft, Copy, Check, Plus, Play } from 'lucide-react';
import { calculatePayouts } from './PickGameScreen';
import { FriendBlock } from './FriendBlock';
import {
  subscribeToOnlinePresence,
  mergeFriendsWithPresence,
  UserPresence,
} from '../lib/presence';
import { sendChallengeInvites } from '../lib/invites';
import {
  findOrCreateRoom,
  subscribeToRoom,
  finalizeAndStartRoom,
  generateBots,
  leaveRoom,
  getClientSessionId,
  GameRoom,
  RoomPlayer,
} from '../lib/matchmaking';

const FLOOR_TABLES = [
  {
    id: 1,
    label: 'Table 1 · 4P',
    pot: 40,
    maxSeats: 4,
    players: [
      { name: 'Maya', color: '#e5352f', angle: 45 },
      { name: 'Liam', color: '#1f7fd6', angle: 135 },
      { name: 'Zoe', color: '#8e44c9', angle: 225 },
      { name: 'Noah', color: '#e58a1f', angle: 315 },
    ],
    dice: [6, 6, 4],
  },
  {
    id: 2,
    label: 'Table 2 · 6P',
    pot: 60,
    maxSeats: 6,
    players: [
      { name: 'Chloe', color: '#00b894', angle: 0 },
      { name: 'Ethan', color: '#d61f7a', angle: 60 },
      { name: 'Aria', color: '#0984e3', angle: 120 },
      { name: 'Lucas', color: '#e58a1f', angle: 180 },
      { name: 'Mia', color: '#8e44c9', angle: 240 },
    ],
    dice: [5, 5, 2],
    hasOpenSeat: true,
  },
  {
    id: 3,
    label: 'Table 3 · 2P',
    pot: 20,
    maxSeats: 2,
    players: [
      { name: 'Jack', color: '#1f7fd6', angle: 90 },
      { name: 'Ruby', color: '#e5352f', angle: 270 },
    ],
    dice: [3, 6, 3],
  },
  {
    id: 4,
    label: 'Table 4 · 4P',
    pot: 80,
    maxSeats: 4,
    players: [
      { name: 'Leo', color: '#0d4d23', angle: 45 },
      { name: 'Nora', color: '#d61f7a', angle: 135 },
      { name: 'Kai', color: '#e58a1f', angle: 225 },
    ],
    dice: [6, 1, 6],
    hasOpenSeat: true,
  },
  {
    id: 5,
    label: 'Table 5 · 6P',
    pot: 120,
    maxSeats: 6,
    players: [
      { name: 'Sam', color: '#8e44c9', angle: 30 },
      { name: 'Eva', color: '#1f7fd6', angle: 90 },
      { name: 'Max', color: '#e5352f', angle: 150 },
      { name: 'Ivy', color: '#00b894', angle: 210 },
      { name: 'Ben', color: '#e58a1f', angle: 270 },
      { name: 'Gia', color: '#0984e3', angle: 330 },
    ],
    dice: [4, 4, 4],
  },
  {
    id: 6,
    label: 'Table 6 · 4P',
    pot: 40,
    maxSeats: 4,
    players: [
      { name: 'Owen', color: '#e5352f', angle: 45 },
      { name: 'Lily', color: '#00b894', angle: 135 },
    ],
    dice: [2, 5, 5],
    hasOpenSeat: true,
  },
];

interface MatchmakingScreenProps {
  playerCount: 2 | 3 | 4 | 5 | 6 | 8;
  buyIn: number;
  tier: 'standard' | 'double' | 'high_roller';
  user: UserAccount;
  equippedColors: [DiceColor, DiceColor];
  initialRoom?: GameRoom;
  friends?: Friend[];
  isChallengeMode?: boolean;
  onMatchReady: (settings: GameSettings) => void;
  onCancel: () => void;
  onToast?: (msg: string) => void;
}

export const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({
  playerCount,
  buyIn,
  tier,
  user,
  equippedColors,
  initialRoom,
  friends = [],
  isChallengeMode = false,
  onMatchReady,
  onCancel,
  onToast,
}) => {
  const [room, setRoom] = useState<GameRoom | null>(initialRoom || null);
  const [isFindingTable, setIsFindingTable] = useState<boolean>(() => !initialRoom && !isChallengeMode);
  const [highlightedTableIdx, setHighlightedTableIdx] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [extraSeconds, setExtraSeconds] = useState(0);
  const [statusText, setStatusText] = useState(initialRoom ? 'Connected to room. Waiting for players…' : 'Finding a table for you.');
  const [isStarting, setIsStarting] = useState(false);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || equippedColors;
  const currentSessionId = getClientSessionId();

  // Check if current user is the host
  const isHost = room?.hostUid ? room.hostUid === user.uid : (isChallengeMode || !initialRoom);

  // Real-time presence map
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(() => new Map());

  useEffect(() => {
    const unsub = subscribeToOnlinePresence(map => {
      setPresenceMap(new Map(map));
    });
    return () => unsub();
  }, []);

  const liveFriends = useMemo(() => {
    return mergeFriendsWithPresence(friends || [], presenceMap, user.uid);
  }, [friends, presenceMap, user.uid]);

  // Sort friends: Online friends to the left-hand side first, Offline friends to the right
  const sortedFriends = useMemo(() => {
    if (!liveFriends || liveFriends.length === 0) return [];
    return [...liveFriends].sort((a, b) => {
      const aOnline = a.status === 'online' ? 1 : 0;
      const bOnline = b.status === 'online' ? 1 : 0;
      return bOnline - aOnline;
    });
  }, [liveFriends]);

  const handleInviteFriendInLobby = async (friend: Friend) => {
    if (friend.status !== 'online') {
      onToast?.(`${friend.name} is offline. Only online friends can be invited.`);
      return;
    }
    if (!room) return;

    const currentResponse = room.invitedResponses?.[friend.id];
    if (currentResponse === 'joined') {
      onToast?.(`${friend.name} has already joined the game!`);
      return;
    }

    try {
      await sendChallengeInvites(room.id, room.roomCode || '', user, [friend], buyIn);
      onToast?.(`📨 Invite sent to ${friend.name}!`);

      // Optimistic update
      setRoom(prev => {
        if (!prev) return prev;
        const prevResponses = prev.invitedResponses || {};
        return {
          ...prev,
          invitedResponses: {
            ...prevResponses,
            [friend.id]: 'pending',
          },
        };
      });
    } catch {
      onToast?.(`Could not send invite to ${friend.name}.`);
    }
  };

  const roomRef = useRef<GameRoom | null>(initialRoom || null);
  roomRef.current = room;

  const matchLaunchedRef = useRef(false);
  const initRanRef = useRef(false);

  const launchMatchWithSlots = (
    slots: GameSettings['slots'],
    roomId: string,
    overridePayouts?: number[]
  ) => {
    if (matchLaunchedRef.current) return;
    matchLaunchedRef.current = true;

    // Actual active player count who joined and whose buy-ins are collected
    const actualPlayerCount = slots.length;
    const mult = tier === 'high_roller' ? 5 : tier === 'double' ? 2 : 1;

    // Do not hard code the payout until the game has started and buy-ins are collected!
    const payouts = overridePayouts && overridePayouts.length > 0
      ? overridePayouts
      : calculatePayouts(actualPlayerCount, tier, buyIn);

    // Ensure isOwner and isOnlinePlayer are tailored for the current local client
    const localizedSlots = slots.map((s, idx) => {
      let isCurrentLocalUser = false;
      if (s.sessionId && currentSessionId) {
        isCurrentLocalUser = s.sessionId === currentSessionId;
      } else if (s.uid && user.uid) {
        const sameUidSlots = slots.filter(x => x.uid === user.uid);
        if (sameUidSlots.length === 1) {
          isCurrentLocalUser = s.uid === user.uid;
        } else {
          // If testing with same UID on multiple devices, distinguish by index based on room order
          isCurrentLocalUser = idx === 0;
        }
      } else {
        isCurrentLocalUser = idx === 0;
      }

      return {
        ...s,
        isOwner: isCurrentLocalUser,
        isOnlinePlayer: s.type === 'human' && !isCurrentLocalUser,
      };
    });

    playSfx('fanfare');
    onMatchReady({
      playersCount: actualPlayerCount,
      mode: isChallengeMode ? 'challenge' : 'online',
      isChallenge: isChallengeMode,
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

  // Keep latest user & equippedColors in refs so background updates (like presence or auth sync)
  // never cancel the 3-second floor hold timer!
  const userRef = useRef(user);
  userRef.current = user;
  const equippedColorsRef = useRef(equippedColors);
  equippedColorsRef.current = equippedColors;

  // 1. Enter or create the multiplayer room for this game version
  // When a user clicks on a multiplayer online game, hold the player for 3 seconds on the game floor screen
  // before placing them in a room so they are placed directly into the best room and never pulled out into another room.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isCancelled = false;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let tableCycleInterval: ReturnType<typeof setInterval> | undefined;

    const attachRoomListener = (targetRoomId: string) => {
      if (unsubscribe) unsubscribe();
      unsubscribe = subscribeToRoom(targetRoomId, updatedRoom => {
        if (isCancelled) return;
        setRoom(prev => {
          if (prev && updatedRoom.players.length > prev.players.length) {
            playSfx('add');
          }
          return updatedRoom;
        });

        // When the room is marked in_progress with final slots, launch immediately!
        if (updatedRoom.status === 'in_progress' && updatedRoom.finalSlots && !matchLaunchedRef.current) {
          launchMatchWithSlots(updatedRoom.finalSlots, updatedRoom.id, updatedRoom.finalPayouts);
          return;
        }

        // When room reaches target player count, transition into quick launch!
        if (updatedRoom.players.length >= playerCount && !matchLaunchedRef.current) {
          setStatusText('All players joined! Preparing game…');
          setIsStarting(true);
          setStartCountdown(c => (c === null ? 2 : Math.min(c, 2)));
        }
      });
    };

    async function initRoom() {
      // Transition to the table lobby screen immediately after the 3s floor hold
      setIsFindingTable(false);
      setStatusText('Connected to table. Waiting for players…');

      try {
        let activeRoom = initialRoom || null;

        if (!activeRoom) {
          const { room: foundRoom } = await findOrCreateRoom(
            tier,
            playerCount as 2 | 4 | 6 | 8,
            buyIn,
            userRef.current,
            equippedColorsRef.current
          );
          activeRoom = foundRoom;
        }

        if (isCancelled) return;
        setRoom(activeRoom);

        // Check if room was already finalized
        if (activeRoom.status === 'in_progress' && activeRoom.finalSlots) {
          launchMatchWithSlots(activeRoom.finalSlots, activeRoom.id, activeRoom.finalPayouts);
          return;
        }

        // Check if room is already full upon initial connection
        if (activeRoom.players && activeRoom.players.length >= playerCount) {
          setStatusText('All players joined! Preparing game…');
          setIsStarting(true);
          setStartCountdown(c => (c === null ? 2 : Math.min(c, 2)));
        }

        // Subscribe to real-time room updates from Firestore
        attachRoomListener(activeRoom.id);
      } catch (err) {
        console.warn('Matchmaking init error:', err);
        setIsFindingTable(false);
        setStatusText('Searching for online players…');
      }
    }

    if (!initialRoom && !isChallengeMode) {
      setIsFindingTable(true);
      setStatusText('Finding a table for you.');
      tableCycleInterval = setInterval(() => {
        setHighlightedTableIdx(prev => (prev + 1) % FLOOR_TABLES.length);
      }, 550);
      holdTimer = setTimeout(() => {
        if (tableCycleInterval) clearInterval(tableCycleInterval);
        if (!isCancelled) {
          initRoom();
        }
      }, 3000);
    } else {
      setIsFindingTable(false);
      initRoom();
    }

    return () => {
      isCancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      if (tableCycleInterval) clearInterval(tableCycleInterval);
      if (unsubscribe) unsubscribe();
    };
  }, [tier, playerCount, buyIn, initialRoom, isChallengeMode]);

  // 2. Countdown timer: starts once the player is placed at the table with a 30s search window
  useEffect(() => {
    if (isFindingTable) return;
    const placedTime = Date.now();

    const interval = setInterval(() => {
      const curRoom = roomRef.current;
      const now = Date.now();
      const baseTime = curRoom ? curRoom.createdAt : placedTime;
      const elapsed = now - baseTime;
      const totalAllowedMs = 30000 + extraSeconds * 1000;
      const remainingMs = Math.max(0, totalAllowedMs - elapsed);
      const remainingSec = Math.ceil(remainingMs / 1000);

      setSecondsLeft(remainingSec);

      // Accelerate launch if room is already full of players
      if (curRoom && curRoom.players && curRoom.players.length >= playerCount && !matchLaunchedRef.current) {
        clearInterval(interval);
        setStatusText('All players joined! Preparing game…');
        setIsStarting(true);
        setStartCountdown(c => (c === null ? 2 : Math.min(c, 2)));
        return;
      }

      if (remainingSec <= 3 && remainingSec > 0) {
        setStatusText('Filling remaining spots with computer players…');
      } else if (!isChallengeMode && remainingSec > 3) {
        if (elapsed < 5000) {
          setStatusText('Scanning for players within 5 levels…');
        } else {
          setStatusText('Scanning for players of any level…');
        }
      }

      // Time expired! Launch the game
      if (remainingMs <= 0 && !matchLaunchedRef.current) {
        clearInterval(interval);
        setStatusText('Time up! Preparing game…');
        setIsStarting(true);
        setStartCountdown(2);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [playerCount, extraSeconds, isChallengeMode, isFindingTable]);

  // 3. Launch the game when countdown finishes
  useEffect(() => {
    if (startCountdown === null) return;

    if (startCountdown <= 0) {
      if (matchLaunchedRef.current) return;
      const curRoom = roomRef.current;

      // If room already has finalSlots, launch using them
      if (curRoom?.finalSlots && curRoom.finalSlots.length > 0) {
        launchMatchWithSlots(curRoom.finalSlots, curRoom.id, curRoom.finalPayouts);
        return;
      }

      const humanPlayers: RoomPlayer[] = (curRoom?.players && curRoom.players.length > 0) ? curRoom.players : [
        {
          uid: user.uid,
          sessionId: currentSessionId,
          name: user.name || 'Player',
          color: user.avatar.color || '#e5352f',
          image: user.avatar.image || null,
          diceColors: userDiceColors,
          type: 'human',
          joinedAt: Date.now(),
        },
      ];

      // In Challenge Mode: If at least 2 humans joined (e.g. host + 2 friends = 3 players),
      // we play with EXACTLY those joined players! No bots added to force initial invited count.
      // If only 1 human is present (the host alone), add 1 bot to enable a 2-player minimum game.
      // In Public Online matchmaking: fill remaining spots with bots up to playerCount.
      const neededBots = isChallengeMode
        ? Math.max(0, 2 - humanPlayers.length)
        : Math.max(0, playerCount - humanPlayers.length);

      const bots = generateBots(neededBots, humanPlayers.length);
      const combined = [...humanPlayers, ...bots];
      const actualStartingPlayers = isChallengeMode
        ? combined
        : combined.slice(0, playerCount);

      const canonicalSlots: GameSettings['slots'] = actualStartingPlayers.map(p => {
        return {
          name: p.name,
          type: p.type,
          color: p.color,
          image: p.image || null,
          diceColors: p.diceColors || ['blue', 'red'],
          uid: p.uid,
          sessionId: p.sessionId,
        };
      });

      const actualStartingCount = canonicalSlots.length;
      // Calculate dynamic payout based on actual players whose buy-ins are collected
      const dynamicPayouts = calculatePayouts(actualStartingCount, tier, buyIn);

      const targetRoomId = curRoom?.id || `room_${Date.now()}_local`;
      if (curRoom?.id) {
        finalizeAndStartRoom(curRoom.id, canonicalSlots, dynamicPayouts, actualStartingCount as any);
      }

      launchMatchWithSlots(canonicalSlots, targetRoomId, dynamicPayouts);
      return;
    }

    playSfx('add');
    const t = setTimeout(() => {
      setStartCountdown(c => (c !== null ? c - 1 : null));
    }, 1000);

    return () => clearTimeout(t);
  }, [startCountdown, playerCount, user, userDiceColors, currentSessionId]);

  // Handle user cancelling matchmaking
  const handleCancel = async () => {
    if (room?.id) {
      await leaveRoom(room.id, user.uid);
    }
    onCancel();
  };

  // Immediate start with bots if user doesn't want to wait
  const handleStartWithBotsNow = () => {
    if (isStarting) return;
    setStatusText('Preparing game with current players…');
    setIsStarting(true);
    setStartCountdown(1);
  };

  // Extend waiting time for friends (+15s)
  const handleExtendWait = () => {
    setExtraSeconds(prev => prev + 15);
    setStatusText('Extended wait by +15s. Looking for players…');
    playSfx('add');
  };

  // Build display slots for the UI
  const displaySlots: Array<RoomPlayer | null> = new Array(playerCount).fill(null);
  const currentHumans = room?.players || [
    {
      uid: user.uid,
      sessionId: currentSessionId,
      name: user.name,
      color: user.avatar.color,
      image: user.avatar.image,
      diceColors: userDiceColors,
      type: 'human',
      joinedAt: Date.now(),
    },
  ];
  const neededBotsPreview = isChallengeMode
    ? 0
    : Math.max(0, playerCount - currentHumans.length);
  const currentBots = (!isChallengeMode && secondsLeft <= 3)
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
  const humanCount = currentHumans.length;

  // Render the 3-second Game Hall Floor screen with lots of tables and people at the tables before placing in a room
  if (isFindingTable) {
    return (
      <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto flex flex-col items-center justify-between max-h-[calc(100dvh-65px)] overflow-y-auto custom-scrollbar py-2 sm:py-3 px-3 select-none animate-fade-in">
        {/* Top Header */}
        <div className="flex flex-col items-center w-full mt-1">
          <ColorRunLogo size="sm" />
          <div className="mt-1.5 bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-2.5">
            <Loader2 className="w-5 h-5 text-[#2f9a4f] animate-spin shrink-0" />
            <div className="text-left">
              <div className="text-sm sm:text-base font-black text-[#1c6a35] leading-tight">
                Finding a table for you.
              </div>
              <div className="text-[10.5px] font-bold text-[#6d5138]">
                {playerCount} Players · 🪙 {buyIn > 0 ? `${buyIn} Buy-In` : 'Casual'} · Scanning active game hall…
              </div>
            </div>
          </div>
        </div>

        {/* Large Game Floor with Lots of Tables and People at the Tables */}
        <div
          className="w-full my-2.5 rounded-3xl border-4 border-[#6b4423] shadow-2xl p-3 sm:p-4 relative overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, #1f6b39 0%, #124724 65%, #0b2e16 100%)',
          }}
        >
          {/* Decorative Floor Carpet Tile Pattern Overlay */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(#f2c14e 1.25px, transparent 1.25px), radial-gradient(#f2c14e 1.25px, #124724 1.25px)',
              backgroundSize: '28px 28px',
              backgroundPosition: '0 0, 14px 14px',
            }}
          />

          <div className="relative z-10 flex items-center justify-between mb-2.5 px-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#f2c14e] drop-shadow">
              🎲 Live Multiplayer Game Floor
            </span>
            <span className="text-[10px] font-bold text-[#d9f2e1] bg-black/30 px-2 py-0.5 rounded-full border border-white/15">
              24 Players Active Across Floor
            </span>
          </div>

          {/* Grid of 6 Tables on the Floor */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 py-1">
            {FLOOR_TABLES.map((tbl, idx) => {
              const isHighlighted = highlightedTableIdx === idx;
              return (
                <div
                  key={tbl.id}
                  className={`relative flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all duration-300 ${
                    isHighlighted
                      ? 'bg-[#f2c14e]/20 ring-2 ring-[#f2c14e] scale-[1.03] shadow-lg'
                      : 'bg-black/20 border border-white/10'
                  }`}
                >
                  {/* Table Header Label */}
                  <div className="w-full flex items-center justify-between text-[9px] font-black text-[#faf4e6] mb-2 px-0.5">
                    <span className="truncate">{tbl.label}</span>
                    <span className="text-[#f2c14e]">🪙 {tbl.pot}</span>
                  </div>

                  {/* Round Wood & Felt Table with Seated Players */}
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center my-0.5">
                    {/* Seated People around the table */}
                    {tbl.players.map((person, pIdx) => {
                      const rad = (person.angle * Math.PI) / 180;
                      const radius = 42; // % offset from center
                      const left = 50 + radius * Math.cos(rad);
                      const top = 50 + radius * Math.sin(rad);
                      return (
                        <div
                          key={pIdx}
                          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
                          style={{ left: `${left}%`, top: `${top}%` }}
                        >
                          <div
                            className="w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full border-2 border-[#faf4e6] shadow-md flex items-center justify-center text-[8px] font-black text-white"
                            style={{ backgroundColor: person.color }}
                            title={person.name}
                          >
                            {person.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-[7px] font-extrabold text-white bg-black/65 px-1 rounded mt-0.5 leading-tight shadow-xs">
                            {person.name}
                          </span>
                        </div>
                      );
                    })}

                    {/* Open Seat Indicator if available */}
                    {tbl.hasOpenSeat && (
                      <div
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                        style={{ left: '15%', top: '82%' }}
                      >
                        <div className="w-6 h-6 rounded-full border-2 border-dashed border-[#f2c14e] bg-[#f2c14e]/25 flex items-center justify-center text-[9px] font-black text-[#f2c14e] animate-pulse">
                          +
                        </div>
                      </div>
                    )}

                    {/* Outer Wooden Table Rim & Inner Green Felt */}
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-br from-[#2a8f4a] to-[#17562b] border-4 border-[#8c5828] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),0_4px_10px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center p-1">
                      {/* Mini Dice on the Table */}
                      <div className="flex items-center gap-0.5">
                        {tbl.dice.map((dVal, dIdx) => (
                          <div
                            key={dIdx}
                            className={`w-3.5 h-3.5 rounded-[3px] flex items-center justify-center text-[8px] font-black text-white shadow-xs ${
                              dIdx % 2 === 0 ? 'bg-[#e5352f]' : 'bg-[#1f7fd6]'
                            }`}
                          >
                            {dVal}
                          </div>
                        ))}
                      </div>
                      <span className="text-[7px] font-bold text-[#f2c14e] mt-0.5 uppercase tracking-tighter">
                        {tbl.hasOpenSeat ? 'Open Seat' : 'In Play'}
                      </span>
                    </div>
                  </div>

                  {/* Table Status Footer */}
                  <div className="mt-1.5 text-[8.5px] font-bold">
                    {isHighlighted ? (
                      <span className="text-[#f2c14e] font-black animate-pulse">
                        Checking table…
                      </span>
                    ) : tbl.hasOpenSeat ? (
                      <span className="text-[#9ef0b6]">
                        {tbl.players.length}/{tbl.maxSeats} Seated
                      </span>
                    ) : (
                      <span className="text-white/60">
                        {tbl.players.length}/{tbl.maxSeats} Full
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cancel Button */}
        <button
          onClick={handleCancel}
          className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-black/40 hover:bg-black/60 px-4 py-2 rounded-xl backdrop-blur-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Cancel &amp; Refund Buy-In</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm sm:max-w-md md:max-w-lg mx-auto flex flex-col items-center justify-start max-h-[calc(100dvh-65px)] overflow-y-auto custom-scrollbar py-2 sm:py-3 px-3 select-none animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col items-center w-full mt-1">
        <ColorRunLogo size="sm" />

        <div className="mt-1 text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#d9ba6d]">
            {isChallengeMode ? 'FRIEND CHALLENGE LOBBY' : 'MULTIPLAYER MATCHMAKING'}
          </div>
          <h2 className="text-base sm:text-lg font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {isChallengeMode ? `Friend Challenge (Up to ${playerCount} Players)` : `${playerCount} Players`} · 🪙 {buyIn > 0 ? `${buyIn} Buy-In` : 'Casual'}
          </h2>
        </div>
      </div>

      {/* Host's Friends Bar across the top of the screen (in case one dismissed, allowing host to invite another) */}
      {isChallengeMode && isHost && sortedFriends.length > 0 && (
        <div className="w-full mt-2.5 bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-2xl p-2.5 shadow-xl">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[11px] font-black uppercase text-[#4a3622] tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#e58a1f]" />
              <span>Your Friends (Invite Players)</span>
            </span>
            <span className="text-[9.5px] font-bold text-[#7d6045]">
              Tap online friend to invite
            </span>
          </div>

          {/* Horizontal scroll container with scrollbar underneath */}
          <div className="w-full flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {sortedFriends.map(friend => {
              const response = room?.invitedResponses?.[friend.id];
              let bubble: string | null = null;
              if (response === 'dismissed') bubble = "Can't make it.";
              else if (response === 'will_join_later') bubble = 'Will join shortly!';
              else if (response === 'joined') bubble = 'Joined!';
              else if (response === 'pending') bubble = 'Invited…';

              const isInvitedOrJoined =
                response === 'pending' || response === 'joined' || response === 'will_join_later';

              return (
                <FriendBlock
                  key={friend.id}
                  friend={friend}
                  compact
                  isSelected={isInvitedOrJoined}
                  bubbleMessage={bubble}
                  onClick={() => handleInviteFriendInLobby(friend)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Center Radar / Timer Widget with Loading Bar */}
      <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col items-center my-2">
        {/* Room Code Badge for Instant Friend Connection */}
        <div className="w-full bg-gradient-to-r from-[#1c6a35]/15 to-[#2f9a4f]/15 border border-[#1c6a35]/30 rounded-xl p-2.5 mb-2.5 flex items-center justify-between gap-2 shadow-xs">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase font-black text-[#5e432d] tracking-wider">
              Direct Room Code
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-mono text-xl sm:text-2xl font-black text-[#1c6a35] tracking-widest leading-none">
                {room?.roomCode || '----'}
              </span>
              <span className="text-[10px] text-[#6d5138] leading-tight">
                Give code to friend to connect!
              </span>
            </div>
          </div>
          {room?.roomCode && (
            <button
              onClick={() => {
                navigator.clipboard?.writeText(room.roomCode!);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                playSfx('add');
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-[#fbf7ee] text-[#1c6a35] border border-[#1c6a35]/40 rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
              title="Copy Room Code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>

        {/* Loading Bar Timer */}
        <div className="w-full mb-2.5 bg-white/80 p-2.5 rounded-xl border border-[#ebdcb9]">
          <div className="flex items-center justify-between text-xs font-bold text-[#4a3622] mb-1.5">
            <span className="flex items-center gap-1.5 min-w-0">
              {!isStarting && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2f9a4f] shrink-0" />}
              <span className="truncate">{isStarting ? `Starting game in ${startCountdown}s…` : statusText}</span>
            </span>
            <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-[#2f9a4f]/15 text-[#1c6a35] shrink-0">
              {isStarting ? `${startCountdown}s` : `${secondsLeft}s`}
            </span>
          </div>
          {/* Visual Loading Bar */}
          <div className="w-full h-2.5 bg-[#ebdcb9] rounded-full overflow-hidden shadow-inner border border-[#c9b877]/60">
            <div
              className="h-full bg-gradient-to-r from-[#2f9a4f] via-[#3ebd63] to-[#2f9a4f] rounded-full transition-all duration-300 ease-linear shadow-xs"
              style={{
                width: isStarting ? '100%' : `${Math.min(100, Math.max(0, (((30 + extraSeconds) - secondsLeft) / (30 + extraSeconds)) * 100))}%`,
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-1 text-[10px] text-[#735c46]">
            <span>{secondsLeft}s search window</span>
            <span className="font-bold">
              {humanCount} {humanCount === 1 ? 'Player' : 'Players'} Joined ({filledCount}/{playerCount})
            </span>
          </div>
        </div>

        {/* Dynamic Payout & Collected Buy-In Card */}
        <div className="w-full mb-2.5 px-3 py-2 rounded-xl bg-[#faf6eb] border border-[#ebdcb9] text-[11px] text-[#4a3622] shadow-xs">
          <div className="flex justify-between items-center font-black">
            <span className="text-[#1c6a35]">
              {buyIn > 0 ? `Collected Pot: 🪙 ${humanCount * buyIn}` : 'Casual Friendly Match'}
            </span>
            <span className="text-[10px] text-[#7d6045] font-bold">
              {humanCount} {humanCount === 1 ? 'Player' : 'Players'} Joined
            </span>
          </div>

          {buyIn > 0 ? (
            <div className="mt-1 pt-1 border-t border-[#ebdcb9] flex flex-col gap-0.5">
              <div className="flex justify-between items-center text-[10.5px]">
                <span className="font-bold text-[#8c673e]">
                  Payout Schedule ({Math.max(2, humanCount)} Players):
                </span>
                <span className="font-mono font-black text-[#2e1d0c]">
                  {calculatePayouts(Math.max(2, humanCount), tier, buyIn)
                    .map((p, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} ${p} 🪙`)
                    .join(' · ')}
                </span>
              </div>
              <div className="text-[9px] text-[#8a6e50] italic leading-tight">
                * Payouts are finalized dynamically when the game starts based on collected buy-ins.
              </div>
            </div>
          ) : (
            <div className="text-[9.5px] text-[#7d6045] mt-0.5">
              Free casual play · No coins wagered
            </div>
          )}
        </div>

        {/* Wait Controls: "+15s Wait" and "Play Now" / "Start Game" */}
        {!isStarting && (
          <div className="w-full grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={handleExtendWait}
              className="flex items-center justify-center gap-1 py-1.5 px-2 bg-[#fdfaf2] hover:bg-white text-[#4a3622] border border-[#c9b877] rounded-xl text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-[#1c6a35]" />
              <span>+15s Wait</span>
            </button>
            <button
              onClick={handleStartWithBotsNow}
              className="flex items-center justify-center gap-1 py-1.5 px-2 bg-gradient-to-b from-[#2f9a4f] to-[#1c6a35] hover:from-[#35ad59] hover:to-[#227b3e] text-white rounded-xl text-xs font-black shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <Play className="w-3 h-3 fill-white" />
              <span>
                {isChallengeMode && humanCount >= 2
                  ? `Start Game (${humanCount}P)`
                  : 'Play Now'}
              </span>
            </button>
          </div>
        )}

        {/* 10-second Ad Banner during Matchmaking Lobby for non-ad-free players */}
        {!user.isAdFree && (
          <div className="w-full mb-2.5 bg-gradient-to-r from-[#2b170a] to-[#452712] border border-[#f2c14e]/70 rounded-xl p-2 text-[#faf4e6] shadow-md flex items-center justify-between gap-2 animate-fade-in">
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
          </div>
        )}

        {/* Slots Grid */}
        <div className="w-full grid grid-cols-2 gap-2">
          {displaySlots.map((slot, idx) => {
            const isLocal = slot?.sessionId ? slot.sessionId === currentSessionId : slot?.uid === user.uid;
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
