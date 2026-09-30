import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiceColor, Die, GamePhase, GameSettings, PlayerUnit, ScoreResult, UserAccount, Friend } from '../types/game';
import { scoreDice } from '../lib/scoring';
import { decideCPUSaves } from '../lib/cpu';
import { TiebreakerState, findLowestTie, startTiebreaker, tiebreakerRollTotal, currentTiedUnitId, recordTiebreakerRoll, advanceTiebreaker, resolveTiebreakerRound } from '../lib/tiebreaker';
import { playSfx, playWarning5sSound, stopWarningSound, playEliminatedSound, startBattleMusic, stopBattleMusic } from '../lib/audio';
import { triggerTurnHaptic, triggerButtonHaptic } from '../lib/haptics';
import { getLocalFriends, addFriend, removeFriend, sendFriendRequest } from '../lib/friends';
import { CardsStrip } from './CardsStrip';
import { SavedBoard } from './SavedBoard';
import { RollArea } from './RollArea';
import { PlayerProfileModal } from './PlayerProfileModal';
import { BattleVideoOverlay } from './BattleVideoOverlay';
import { Loader2, Swords } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScoreBubbleAnimation, ScoreBubbleData } from './ScoreBubbleAnimation';
import { subscribeToRoom, markPlayerLeft, updateRoomGameState, getClientSessionId, RoomGameState } from '../lib/matchmaking';
import { calculatePayouts } from './PickGameScreen';

export interface MatchSummaryStats {
  survivedRounds: number;
  colorBonusPoints: number;
  placement: number;
  finished: boolean;
  colorRunsScored?: number;
  scoredFiveOfAKind?: boolean;
  bankedCenturyClub?: boolean;
  precisionRoller?: boolean;
  wonTiebreaker?: boolean;
  underdogAscendant?: boolean;
  isFriendChallenge?: boolean;
}

interface PlayScreenProps {
  settings: GameSettings;
  user: UserAccount;
  onGameOver: (winner: PlayerUnit, units: PlayerUnit[], stats?: MatchSummaryStats) => void;
  onOpenMenu: () => void;
  onAwardPrize?: (amount: number, place: number) => void;
  onExitGame: (prizeWon?: number, stats?: MatchSummaryStats) => void;
  onEmoteSentDuringElimination?: () => void;
}

function createInitialDice(colorA: DiceColor, colorB: DiceColor): Die[] {
  const dice: Die[] = [];
  // 6 of Color A
  for (let i = 1; i <= 6; i++) {
    dice.push({
      id: i,
      color: colorA,
      value: Math.floor(Math.random() * 6) + 1,
      zone: 'active',
      selected: false,
      slotIndex: dice.length,
    });
  }
  // 6 of Color B
  for (let i = 7; i <= 12; i++) {
    dice.push({
      id: i,
      color: colorB,
      value: Math.floor(Math.random() * 6) + 1,
      zone: 'active',
      selected: false,
      slotIndex: dice.length,
    });
  }
  return dice;
}

function getUnitDiceColors(
  unit?: PlayerUnit | { isCPU?: boolean; diceColors?: [DiceColor, DiceColor] } | null,
  fallbackColors?: [DiceColor, DiceColor]
): [DiceColor, DiceColor] {
  // Computer players ALWAYS use red and blue dice
  if (unit?.isCPU) {
    return ['blue', 'red'];
  }
  if (unit?.diceColors && unit.diceColors.length === 2) {
    return unit.diceColors;
  }
  return fallbackColors || ['blue', 'red'];
}

export const PlayScreen: React.FC<PlayScreenProps> = ({
  settings,
  user,
  onGameOver,
  onOpenMenu,
  onAwardPrize,
  onExitGame,
  onEmoteSentDuringElimination,
}) => {
  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || [settings.colorA, settings.colorB];

  // Friends challenge detection
  const isFriendsChallenge =
    settings.mode === 'challenge' ||
    settings.mode === 'challenge_friend' ||
    Boolean((settings as any).isChallenge);

  // Pass & Play: every human player shares this device and takes their own turns on it
  const isPassAndPlay = settings.mode === 'pass_and_play';
  // True for players whose turns are played on this device (never CPU or remote players)
  const isLocalHuman = (u?: PlayerUnit) => !!u && !u.isCPU && (u.isOwner || isPassAndPlay);

  // Multiplayer room detection (no host concept: all players are peers in a shared room)
  // In Friends Challenge, timing rules are identical to Multiplayer Online games.
  const isMultiplayer =
    settings.mode === 'online' ||
    isFriendsChallenge ||
    !!settings.roomId ||
    settings.slots.some(s => s.isOnlinePlayer);

  // Timing for rolls in multiplayer rooms: 30s for roll 1, 20s for rolls 2 & 3
  const ROLL_1_TIME = isMultiplayer ? 30 : 20;
  const ROLL_2_3_TIME = isMultiplayer ? 20 : 10;

  // Immediate start since matchmaking screen already handled the 15-second lobby sync
  const [joiningCountdown, setJoiningCountdown] = useState<number | null>(null);

  // Initialize players from settings slots
  const [units, setUnits] = useState<PlayerUnit[]>(() => {
    const mySessionId = getClientSessionId();
    return settings.slots.map((s, idx) => {
      const isLocalUser = s.isOwner !== undefined
        ? s.isOwner
        : (s.sessionId && mySessionId ? s.sessionId === mySessionId : (s.uid ? s.uid === user.uid : idx === 0));
      const isHuman = s.type === 'human' || (!!s.uid && s.type !== 'cpu');
      const isCPU = s.type === 'cpu' || (!isLocalUser && !isHuman);
      return {
        id: `u_${idx + 1}`,
        name: s.name,
        isCPU: isCPU,
        isOwner: isLocalUser,
        isOnlinePlayer: !isLocalUser && isHuman && !isPassAndPlay,
        color: s.color,
        image: s.image,
        diceColors: s.diceColors || (isLocalUser ? userDiceColors : ['blue', 'red']),
        score: 0,
        history: {},
        active: true,
        uid: s.uid,
        sessionId: s.sessionId,
      };
    });
  });

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<GamePhase>('regular');
  const [qIdx, setQIdx] = useState(0);
  const [rollsUsed, setRollsUsed] = useState(0);
  const [rollSlotsCount, setRollSlotsCount] = useState(12);
  const [isRolling, setIsRolling] = useState(false);
  const [announcedChimes, setAnnouncedChimes] = useState<Record<string, number>>({});
  const announcedChimesRef = useRef<Record<string, number>>({});
  const [dice, setDice] = useState<Die[]>(() => {
    const firstSlot = settings.slots[0];
    const [c1, c2] = getUnitDiceColors(firstSlot, userDiceColors);
    return createInitialDice(c1, c2);
  });
  const [toastMsg, setToastMsg] = useState('');
  const [elimModalMsg, setElimModalMsg] = useState<string | null>(null);
  const [elimCountdown, setElimCountdown] = useState(5);
  const hasShownElimWarningRef = useRef(false);

  const triggerEliminationWarning = useCallback((msg: string) => {
    if (hasShownElimWarningRef.current) return;
    hasShownElimWarningRef.current = true;
    setElimModalMsg(msg);
    setElimCountdown(5);
  }, []);
  const [showSixCelebration, setShowSixCelebration] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedPlayerForProfile, setSelectedPlayerForProfile] = useState<PlayerUnit | null>(null);
  const [friends, setFriends] = useState<Friend[]>(() => getLocalFriends(user.uid));

  // Elimination Banner under Saved Dice and Points labels row
  const [eliminationBannerUnderLabels, setEliminationBannerUnderLabels] = useState<string | null>(null);

  const eliminationBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerEliminatedBanner = useCallback((playerName: string) => {
    setEliminationBannerUnderLabels(`${playerName} has been eliminated!`);
    playEliminatedSound();
    // Restart the 6s window so an earlier banner's timer can't hide this one early
    if (eliminationBannerTimerRef.current) clearTimeout(eliminationBannerTimerRef.current);
    eliminationBannerTimerRef.current = setTimeout(() => {
      setEliminationBannerUnderLabels(null);
    }, 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (eliminationBannerTimerRef.current) clearTimeout(eliminationBannerTimerRef.current);
    };
  }, []);

  // Battle to Survive Roll-Off Tiebreaker (null when no roll-off is running).
  // In room games it is shared through gameState.tiebreaker so every device shows the same roll-off.
  const [tiebreaker, setTiebreaker] = useState<TiebreakerState | null>(null);
  const tiebreakerRef = useRef<TiebreakerState | null>(null);
  tiebreakerRef.current = tiebreaker;
  // True on the device that resolved the roll-off; it publishes the elimination to the room
  const isTiebreakerDriverRef = useRef(false);
  const tbActive = tiebreaker !== null;
  const tbRolling = tiebreaker?.phase === 'rolling';
  const applyRemoteTiebreakerRef = useRef<(lastAction: string, next: TiebreakerState | null | undefined, remoteDice: Die[] | undefined) => void>(() => {});

  // Turn timer & AFK management - 30s for roll 1, 20s for rolls 2 & 3 in multiplayer
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(ROLL_1_TIME);
  const [isAfkOverlay, setIsAfkOverlay] = useState(false);
  const [consecutiveAfkTurns, setConsecutiveAfkTurns] = useState(0);
  const [isAutoPilotTurn, setIsAutoPilotTurn] = useState(false);
  const prevActiveUnitIdRef = useRef<string | null>(null);
  const prevRoundRef = useRef<number>(1);
  const doRollRef = useRef<() => void>(() => {});
  const bankTurnRef = useRef<() => void>(() => {});

  const handleAddFriend = async (player: PlayerUnit) => {
    const res = await sendFriendRequest(user, {
      id: player.id,
      uid: player.uid,
      name: player.name,
      color: player.color,
      image: player.image,
      isCPU: player.isCPU,
    });
    setFriends(res.friends);
    setToastMsg(res.message);
  };

  const handleRemoveFriend = async (playerName: string) => {
    const target = friends.find(f => f.name.toLowerCase() === playerName.toLowerCase());
    if (target) {
      const updated = await removeFriend(user.uid, target.id, user.name);
      setFriends(updated);
      setToastMsg(`Removed ${playerName} from friends.`);
    }
  };

  // Spectator mode states
  const [spectatorChoiceMade, setSpectatorChoiceMade] = useState(false);
  const [spectatorFastForward, setSpectatorFastForward] = useState(false);

  // Emoji Reactions State
  const [floatingEmotes, setFloatingEmotes] = useState<
    Array<{ id: string; emoji: string; senderName: string; isSelf: boolean; x: number; y: number }>
  >([]);
  const CELEBRATORY_EMOTES = ['🥳', '🔥', '👑', '👏', '🎲', '🎉', '💪', '🏆'];

  // Saved Dice Area Emoji Reactions
  const [savedBoardEmotes, setSavedBoardEmotes] = useState<
    Array<{ id: string; emoji: string; senderName: string; timestamp: number }>
  >([]);

  // React Overlay State (10-second countdown timer per user specification)
  const [isReactOverlayOpen, setIsReactOverlayOpen] = useState(false);
  const [reactTimeRemaining, setReactTimeRemaining] = useState(10);
  const REACT_EMOJI_OPTIONS = ['🥳', '🔥', '👑', '👏', '🎲', '🎉', '💪', '🏆', '❤️', '😂', '🤯', '😎'];

  // Floating Score Bubble Animation State (when user or CPU banks score)
  const [activeScoreBubble, setActiveScoreBubble] = useState<ScoreBubbleData | null>(null);
  const [isScoreBanking, setIsScoreBanking] = useState<boolean>(false);
  const lastHandledBankTimestampRef = useRef<number>(0);

  const triggerScoreBubble = useCallback((points: number, unitId: string) => {
    // 1. Origin: From the total points (In the Saved Dice bar)
    const pointsElem = document.getElementById('saved-dice-total-points');
    const pointsRect = pointsElem?.getBoundingClientRect();

    const startX = pointsRect ? pointsRect.left + pointsRect.width / 2 : window.innerWidth * 0.78;
    const startY = pointsRect ? pointsRect.top + pointsRect.height / 2 : window.innerHeight * 0.35;

    // 2. Target: To the user or cpu player's scoreboard card
    const cardElem =
      document.getElementById(`scoreboard-card-${unitId}`) ||
      document.querySelector(`[id="scoreboard-card-${unitId}"]`);

    if (cardElem) {
      cardElem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
    const cardRect = cardElem?.getBoundingClientRect();

    const targetX = cardRect ? cardRect.left + cardRect.width / 2 : window.innerWidth / 2;
    const targetY = cardRect ? cardRect.top + cardRect.height / 2 : 110;

    setActiveScoreBubble({
      id: 'bubble_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      points,
      startX,
      startY,
      targetX,
      targetY,
      unitId,
    });
  }, []);

  useEffect(() => {
    if (!isReactOverlayOpen) return;
    setReactTimeRemaining(10);
    const interval = setInterval(() => {
      setReactTimeRemaining(prev => {
        if (prev <= 1) {
          setIsReactOverlayOpen(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isReactOverlayOpen]);

  const handleOpenReactOverlay = () => {
    setReactTimeRemaining(10);
    setIsReactOverlayOpen(true);
    triggerButtonHaptic();
  };

  const handleSelectReactEmoji = (emoji: string) => {
    sendEmote(emoji);
    setIsReactOverlayOpen(false);
  };

  const sendEmote = (emoji: string) => {
    const emoteId = 'emote_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const isElim = phase === 'elimination' || tbActive;

    // 1. Appear in the saved dice area of device
    const newSavedEmote = {
      id: emoteId,
      emoji,
      senderName: user.name,
      timestamp: Date.now(),
    };
    setSavedBoardEmotes(prev => [...prev.slice(-3), newSavedEmote]);
    setTimeout(() => {
      setSavedBoardEmotes(prev => prev.filter(e => e.id !== emoteId));
    }, 4000);

    // 2. Floating animation
    const randomOffsetX = Math.random() * 80 - 40;
    const spawnX = Math.max(50, Math.min(window.innerWidth - 50, window.innerWidth / 2 + randomOffsetX));
    const spawnY = Math.max(100, window.innerHeight * 0.65);

    setFloatingEmotes(prev => [
      ...prev,
      { id: emoteId, emoji, senderName: user.name, isSelf: true, x: spawnX, y: spawnY },
    ]);
    setTimeout(() => {
      setFloatingEmotes(prev => prev.filter(e => e.id !== emoteId));
    }, 2800);

    playSfx('add');
    triggerButtonHaptic();

    if (isElim) {
      emotesSentDuringElimRef.current += 1;
      onEmoteSentDuringElimination?.();
    }

    if (settings.roomId) {
      updateRoomGameState(settings.roomId, {
        latestEmote: {
          id: emoteId,
          senderUid: user.uid,
          senderName: user.name,
          emoji,
          timestamp: Date.now(),
          duringElimination: isElim,
        },
      });
    }
  };

  // Queue of active player units
  const activeUnits = units.filter(u => u.active);
  const curUnit = activeUnits[qIdx] || activeUnits[0];
  const isHumanOwner = isLocalHuman(curUnit);
  const isRemoteHuman = curUnit ? (!curUnit.isOwner && curUnit.isOnlinePlayer && !curUnit.isCPU) : false;
  const isCPU = curUnit ? (curUnit.isCPU || isAutoPilotTurn) : false;

  const tiedCurrentUnit = tiebreaker ? units.find(u => u.id === currentTiedUnitId(tiebreaker)) : undefined;
  const isTiedLocalHuman = isLocalHuman(tiedCurrentUnit);
  const isTiedRemoteHuman = !!tiedCurrentUnit && !tiedCurrentUnit.isCPU && !isTiedLocalHuman;

  const isEffectiveHuman = tbActive ? isTiedLocalHuman : isHumanOwner;
  const isEffectiveCPU = tbActive ? !!tiedCurrentUnit?.isCPU : isCPU;
  const isEffectiveRemote = tbActive ? isTiedRemoteHuman : isRemoteHuman;
  const effectivePlayerName = (tbActive ? tiedCurrentUnit?.name : curUnit?.name) || 'Player';

  const humanUnits = units.filter(u => !u.isCPU && (u.isOwner || u.isOnlinePlayer));
  const mySessionId = getClientSessionId();
  const sortedHumanTokens = humanUnits.map(u => u.sessionId || u.uid).filter(Boolean).sort() as string[];
  const turnAuthorityToken = sortedHumanTokens.length > 0 ? sortedHumanTokens[0] : (humanUnits[0]?.sessionId || humanUnits[0]?.uid || user.uid);
  const otherHumanTokens = humanUnits
    .filter(u => (u.sessionId || u.uid) !== (curUnit?.sessionId || curUnit?.uid))
    .map(u => u.sessionId || u.uid)
    .filter(Boolean)
    .sort() as string[];
  const fallbackAuthorityToken = otherHumanTokens.length > 0 ? otherHumanTokens[0] : turnAuthorityToken;
  const myToken = mySessionId || user.uid;
  const isTurnAuthority =
    !isMultiplayer ||
    myToken === turnAuthorityToken ||
    (isRemoteHuman && myToken === fallbackAuthorityToken);

  const tbNameOf = (unitId: string) => units.find(u => u.id === unitId)?.name || 'Player';
  const isTiebreakerAuthority = !isMultiplayer || myToken === turnAuthorityToken;
  const tbTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const humanColorBonusTotalRef = useRef<number>(0);
  const humanColorRunsCountRef = useRef<number>(0);
  const humanFiveOfAKindScoredRef = useRef<boolean>(false);
  const humanCenturyClubScoredRef = useRef<boolean>(false);
  const humanEverInBottomTwoRef = useRef<boolean>(false);
  const humanWonTiebreakerRef = useRef<boolean>(false);
  const humanWasLastWhenElimStartedRef = useRef<boolean>(false);
  const lastEmoteIdRef = useRef<string>('');
  const emotesSentDuringElimRef = useRef<number>(0);

  const getMatchStats = (currentUnitsList: PlayerUnit[], winnerUnit?: PlayerUnit): MatchSummaryStats => {
    const human = currentUnitsList.find(u => !u.isCPU);
    const place = human?.place || (winnerUnit?.id === human?.id ? 1 : 2);
    const totalP = settings.playersCount || currentUnitsList.length;
    const isWin = place === 1;
    return {
      survivedRounds: Math.max(0, totalP - place),
      colorBonusPoints: humanColorBonusTotalRef.current,
      placement: place,
      finished: true,
      colorRunsScored: humanColorRunsCountRef.current,
      scoredFiveOfAKind: humanFiveOfAKindScoredRef.current,
      bankedCenturyClub: humanCenturyClubScoredRef.current,
      precisionRoller: isWin && !humanEverInBottomTwoRef.current,
      wonTiebreaker: humanWonTiebreakerRef.current,
      underdogAscendant: isWin && humanWasLastWhenElimStartedRef.current,
      isFriendChallenge:
        settings.isChallenge ||
        settings.isFriendsChallenge ||
        settings.mode === 'challenge_friend' ||
        settings.mode === 'challenge',
    };
  };

  useEffect(() => {
    return () => tbTimersRef.current.forEach(clearTimeout);
  }, []);

  const freshDiceFor = (unitId: string | undefined): Die[] | null => {
    const unit = units.find(u => u.id === unitId);
    if (!unit) return null;
    const [c1, c2] = getUnitDiceColors(unit, userDiceColors);
    return createInitialDice(c1, c2);
  };

  const publishTiebreaker = (
    lastAction: 'tiebreaker_start' | 'tiebreaker_roll' | 'tiebreaker_save' | 'tiebreaker_next' | 'tiebreaker_blink' | 'tiebreaker_outro',
    state: TiebreakerState,
    tbDice: Die[] | null,
    extra: Partial<RoomGameState> = {}
  ) => {
    if (!settings.roomId) return;
    updateRoomGameState(settings.roomId, {
      ...extra,
      ...(tbDice ? { dice: tbDice } : {}),
      rollsUsed: 0,
      tiebreaker: state,
      lastAction,
      lastActionBy: user.uid,
      actionTimestamp: Date.now(),
    });
  };

  // Timers are added to keep games moving in online rooms and friends challenges.
  // When the user is only playing against computer players (Play vs Computer rooms), no timers are needed.
  const isTimerEnabled = settings.mode === 'online' || isFriendsChallenge || settings.slots.some((s, idx) => idx > 0 && s.isOnlinePlayer);

  // Saved dice and score calculation
  const savedDice = dice.filter(d => d.zone === 'saved');
  const scoreResult: ScoreResult = scoreDice(savedDice);

  // Sync human player unit if user updates profile or dice during the match
  useEffect(() => {
    setUnits(prev =>
      prev.map(u => {
        if (u.isOwner) {
          return {
            ...u,
            name: user.name,
            image: user.avatar.image,
            color: user.avatar.color,
            diceColors: user.diceColors || u.diceColors,
          };
        }
        return u;
      })
    );
    if (curUnit?.isOwner && rollsUsed === 0 && savedDice.length === 0 && user.diceColors) {
      const [c1, c2] = user.diceColors;
      setDice(createInitialDice(c1, c2));
    }
  }, [user.diceColors, user.name, user.avatar]);

  // Clean up any playing warning sound on unmount
  useEffect(() => {
    return () => {
      stopWarningSound();
      stopBattleMusic();
    };
  }, []);

  // Vibration when it is the user's turn in Multiplayer, vs CPU, and Friends Challenge games
  const isVibrationEligibleMode =
    settings.mode === 'online' ||
    settings.mode === 'cpu' ||
    settings.mode === 'challenge' ||
    settings.mode === 'challenge_friend' ||
    isMultiplayer ||
    isFriendsChallenge;

  const isUserTurnToRoll =
    !tbActive &&
    isHumanOwner &&
    !isAutoPilotTurn &&
    (joiningCountdown === null || joiningCountdown <= 0) &&
    phase !== 'over';

  const isUserTiebreakerTurn =
    tbActive &&
    tiebreaker?.phase === 'rolling' &&
    isTiedLocalHuman &&
    rollsUsed === 0;

  const isUserTurn = isVibrationEligibleMode && (isUserTurnToRoll || isUserTiebreakerTurn);

  const activeTurnId = isUserTiebreakerTurn
    ? `tb-${tiedCurrentUnit?.id}-r${tiebreaker?.roundNumber}-i${tiebreaker?.activeTiedIndex}`
    : isUserTurnToRoll
    ? `turn-${curUnit?.id}-r${round}-q${qIdx}`
    : null;

  const lastVibratedTurnRef = useRef<string | null>(null);

  useEffect(() => {
    if (isUserTurn && activeTurnId && lastVibratedTurnRef.current !== activeTurnId) {
      lastVibratedTurnRef.current = activeTurnId;
      triggerTurnHaptic();
    }
  }, [isUserTurn, activeTurnId]);

  const handleDismissSixCelebration = useCallback(() => {
    setShowSixCelebration(false);
  }, []);

  // Auto-dismiss 6-of-a-kind Color Run celebration after animation plays
  useEffect(() => {
    if (!showSixCelebration) return;
    const timer = setTimeout(() => {
      setShowSixCelebration(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, [showSixCelebration]);

  // 15 seconds on the gameplay screen to allow all players to join the room
  useEffect(() => {
    if (joiningCountdown === null) return;
    if (joiningCountdown <= 0) {
      setJoiningCountdown(null);
      playSfx('fanfare');
      showToast('🎲 All players ready! Round 1 begins');
      return;
    }

    const timer = setInterval(() => {
      setJoiningCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [joiningCountdown]);

  const lastActionTimestampRef = useRef(0);
  const lastActionIdRef = useRef<string>('');
  const lastActionRef = useRef<string>('');
  const qIdxRef = useRef<number>(-1);
  const rollsUsedRef = useRef<number>(-1);
  const roundRef = useRef<number>(1);
  const phaseRef = useRef<GamePhase>('regular');
  const rollAnimTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    qIdxRef.current = qIdx;
  }, [qIdx]);

  useEffect(() => {
    rollsUsedRef.current = rollsUsed;
  }, [rollsUsed]);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Listen for room updates & players who stepped away / disconnected
  useEffect(() => {
    if (!settings.roomId) return;
    const unsub = subscribeToRoom(settings.roomId, updatedRoom => {
      // 1. Sync players who disconnected or stepped away
      const leftUids: string[] = updatedRoom.leftPlayers || [];
      if (leftUids.length > 0) {
        setUnits(prev =>
          prev.map(u => {
            const slot = settings.slots.find(s => s.name === u.name);
            if (slot?.uid && leftUids.includes(slot.uid) && !u.isCPU) {
              showToast(`${u.name} stepped away. Computer has taken over.`);
              return { ...u, isCPU: true, isOnlinePlayer: false };
            }
            return u;
          })
        );
      }

      // 2. Sync shared real-time gameState across players
      const gs = updatedRoom.gameState;
      if (!gs) return;

      // Sync real-time emoji reactions from peers in the room
      if (gs.latestEmote && gs.latestEmote.id && gs.latestEmote.id !== lastEmoteIdRef.current) {
        lastEmoteIdRef.current = gs.latestEmote.id;
        const isSelf = gs.latestEmote.senderUid === user.uid;
        if (!isSelf) {
          const emoteId = gs.latestEmote.id;

          // Appear in saved dice area of all users' devices
          const newSavedEmote = {
            id: emoteId,
            emoji: gs.latestEmote.emoji,
            senderName: gs.latestEmote.senderName,
            timestamp: Date.now(),
          };
          setSavedBoardEmotes(prev => [...prev.slice(-3), newSavedEmote]);
          setTimeout(() => {
            setSavedBoardEmotes(prev => prev.filter(e => e.id !== emoteId));
          }, 4000);

          const randomOffsetX = Math.random() * 80 - 40;
          const spawnX = Math.max(50, Math.min(window.innerWidth - 50, window.innerWidth / 2 + randomOffsetX));
          const spawnY = Math.max(100, window.innerHeight * 0.55);

          setFloatingEmotes(prev => [
            ...prev,
            {
              id: emoteId,
              emoji: gs.latestEmote!.emoji,
              senderName: gs.latestEmote!.senderName,
              isSelf: false,
              x: spawnX,
              y: spawnY,
            },
          ]);
          playSfx('add');
          setTimeout(() => {
            setFloatingEmotes(prev => prev.filter(e => e.id !== emoteId));
          }, 2800);
        }
      }

      const isNewAction =
        !lastActionIdRef.current ||
        (gs.lastActionId && gs.lastActionId !== lastActionIdRef.current) ||
        (gs.actionTimestamp && gs.actionTimestamp > lastActionTimestampRef.current) ||
        (gs.lastAction && gs.lastAction !== lastActionRef.current) ||
        (typeof gs.activeUnitIndex === 'number' && gs.activeUnitIndex !== qIdxRef.current) ||
        (typeof gs.rollsUsed === 'number' && gs.rollsUsed !== rollsUsedRef.current) ||
        (gs.phase && gs.phase !== phaseRef.current) ||
        (typeof gs.round === 'number' && gs.round !== roundRef.current);

      if (isNewAction) {
        if (gs.lastActionId) lastActionIdRef.current = gs.lastActionId;
        if (gs.actionTimestamp) lastActionTimestampRef.current = Math.max(lastActionTimestampRef.current, gs.actionTimestamp);
        if (gs.lastAction) lastActionRef.current = gs.lastAction;
        if (typeof gs.activeUnitIndex === 'number') qIdxRef.current = gs.activeUnitIndex;
        if (typeof gs.rollsUsed === 'number') rollsUsedRef.current = gs.rollsUsed;
        if (gs.phase) phaseRef.current = gs.phase as GamePhase;
        if (typeof gs.round === 'number') roundRef.current = gs.round;

        const mySessionId = getClientSessionId();
        // Action is from self only if executed by this specific device/session
        const isFromSelf = (gs.lastActionSessionId && mySessionId)
          ? gs.lastActionSessionId === mySessionId
          : gs.lastActionBy === user.uid;

        // Action was performed by another peer
        if (!isFromSelf) {
          // 1. Synchronize core progression fields on EVERY peer action
          if (typeof gs.activeUnitIndex === 'number') {
            setQIdx(gs.activeUnitIndex);
          }
          if (typeof gs.round === 'number') {
            setRound(gs.round);
          }
          if (gs.phase) {
            setPhase(gs.phase as GamePhase);
            if (gs.phase === 'elimination' && !hasShownElimWarningRef.current) {
              triggerEliminationWarning(
                `Someone reached ${settings.threshold} points! From here, every player plays a full round, then the lowest total is knocked out. Last one standing wins!`
              );
            }
          }
          if (gs.unitStatus) {
            setUnits(prev =>
              prev.map(u => {
                const st = gs.unitStatus![u.id];
                if (st) {
                  return {
                    ...u,
                    score: st.score ?? u.score,
                    history: st.history ?? u.history,
                    active: st.active !== undefined ? st.active : u.active,
                    place: st.place !== undefined ? st.place : u.place,
                  };
                }
                return u;
              })
            );
          } else if (gs.scores) {
            setUnits(prev =>
              prev.map(u => {
                const isActive = gs.activeUnitIds ? gs.activeUnitIds.includes(u.id) : u.active;
                if (gs.scores![u.id] !== undefined) {
                  return {
                    ...u,
                    score: gs.scores![u.id],
                    history: gs.unitHistory?.[u.id] || u.history,
                    active: isActive,
                  };
                }
                return u;
              })
            );
          }

          if (gs.phase === 'over') {
            setUnits(prev => {
              const winner = prev.find(u => u.active) || prev[0];
              if (winner) winner.place = 1;
              onGameOver(winner, prev, getMatchStats(prev, winner));
              return prev;
            });
            return;
          }

          // 2. Action-specific handling
          if (gs.lastAction === 'roll') {
            if (rollAnimTimeoutRef.current) {
              clearTimeout(rollAnimTimeoutRef.current);
            }
            setIsRolling(true);
            setDice(gs.dice);
            setRollsUsed(gs.rollsUsed);
            if (typeof gs.rollSlotsCount === 'number') setRollSlotsCount(gs.rollSlotsCount);
            setTurnSecondsLeft(ROLL_2_3_TIME);
            rollAnimTimeoutRef.current = setTimeout(() => {
              setIsRolling(false);
              rollAnimTimeoutRef.current = null;
            }, 1100);
          } else if (gs.lastAction === 'save_dice') {
            if (rollAnimTimeoutRef.current) {
              clearTimeout(rollAnimTimeoutRef.current);
              rollAnimTimeoutRef.current = null;
            }
            setIsRolling(false);
            setDice(gs.dice);
            if (typeof gs.rollsUsed === 'number') setRollsUsed(gs.rollsUsed);
            checkBonusChimes(gs.dice);
          } else if (
            gs.lastAction?.startsWith('tiebreaker')
          ) {
            // Battle to Survive tiebreaker event on another device
            applyRemoteTiebreakerRef.current(gs.lastAction, gs.tiebreaker, gs.dice);
          } else if (gs.lastAction === 'bank' || gs.lastAction === 'elimination' || gs.lastAction === 'phase_change') {
            if (rollAnimTimeoutRef.current) {
              clearTimeout(rollAnimTimeoutRef.current);
              rollAnimTimeoutRef.current = null;
            }
            if (
              gs.lastAction === 'bank' &&
              !isFromSelf &&
              gs.scores &&
              gs.actionTimestamp &&
              gs.actionTimestamp > lastHandledBankTimestampRef.current
            ) {
              lastHandledBankTimestampRef.current = gs.actionTimestamp;
              const targetUnitId =
                (gs as any).lastBankedUnitId ||
                (typeof gs.activeUnitIndex === 'number' && units[gs.activeUnitIndex]?.id) ||
                units.find(u => gs.scores![u.id] !== undefined && gs.scores![u.id] > u.score)?.id;
              if (targetUnitId && gs.scores[targetUnitId] !== undefined) {
                const scoringUnit = units.find(u => u.id === targetUnitId);
                const addedPts = typeof (gs as any).lastBankedPoints === 'number'
                  ? (gs as any).lastBankedPoints
                  : scoringUnit ? gs.scores[targetUnitId] - scoringUnit.score : 0;
                if (addedPts > 0) {
                  triggerScoreBubble(addedPts, targetUnitId);
                }
              }
            }
            playSfx('add');
            setIsRolling(false);
            setRollsUsed(0);
            announcedChimesRef.current = {};
            setAnnouncedChimes({});
            setShowSixCelebration(false);
            if (gs.dice) {
              // Ensure that on a banked turn transitioning to roll 0, all dice are in the active zone
              const freshActiveDice = gs.dice.map(d => ({ ...d, zone: 'active' as const, selected: false }));
              setDice(freshActiveDice);
            }
            setTurnSecondsLeft(ROLL_1_TIME);
          }
        } else if (gs.phase === 'over') {
          setUnits(prev => {
            const winner = prev.find(u => u.active) || prev[0];
            if (winner) winner.place = 1;
            onGameOver(winner, prev, getMatchStats(prev, winner));
            return prev;
          });
        }
      }
    });
    return () => {
      unsub();
      if (rollAnimTimeoutRef.current) {
        clearTimeout(rollAnimTimeoutRef.current);
        rollAnimTimeoutRef.current = null;
      }
    };
  }, [settings.roomId, settings.slots, user.uid, ROLL_1_TIME, ROLL_2_3_TIME]);

  // Alert when the user's turn comes up & reset roll timer & bonus announcements
  useEffect(() => {
    if (!curUnit) return;
    if (curUnit.id !== prevActiveUnitIdRef.current || round !== prevRoundRef.current) {
      prevActiveUnitIdRef.current = curUnit.id;
      prevRoundRef.current = round;
      stopWarningSound();
      setTurnSecondsLeft(ROLL_1_TIME);
      setRollSlotsCount(12);
      setIsAutoPilotTurn(false);
      announcedChimesRef.current = {};
      setAnnouncedChimes({});
      setShowSixCelebration(false);

      // On new turn or new round, guarantee all 12 dice are fresh in the active zone
      setDice(prev => {
        if (rollsUsed === 0 && (prev.some(d => d.zone === 'saved') || prev.length < 12)) {
          const [c1, c2] = getUnitDiceColors(curUnit, userDiceColors);
          return createInitialDice(c1, c2);
        }
        return prev;
      });

      if (isLocalHuman(curUnit)) {
        // User turn alert chime & toast alert (Pass & Play names the player to hand the device to)
        playSfx('add');
        showToast(isPassAndPlay ? `👉 ${curUnit.name}'s Turn! Tap ROLL` : '👉 Your Turn! Tap ROLL');
      }
    }
  }, [curUnit, round, ROLL_1_TIME, userDiceColors]);

  // Turn countdown timer (active when additional users are in the room):
  // 30s on roll 1, 20s on rolls 2 & 3 in multiplayer
  useEffect(() => {
    if (
      !isTimerEnabled ||
      (!isHumanOwner && !isRemoteHuman) ||
      tbActive ||
      isAutoPilotTurn ||
      isRolling ||
      elimModalMsg ||
      (joiningCountdown !== null && joiningCountdown > 0)
    ) {
      stopWarningSound();
      return;
    }

    // Play 5-second countdown warning audio when timer reaches 5 seconds (only for local human player)
    if (turnSecondsLeft === 5 && isEffectiveHuman) {
      playWarning5sSound();
    }

    if (isEffectiveHuman && turnSecondsLeft <= 0) {
      stopWarningSound();
      // User turn time ran out - auto-roll or score for this roll to keep match moving
      const active = dice.filter(d => d.zone === 'active');
      if (rollsUsed < 3 && (rollsUsed === 0 || active.length > 0)) {
        doRollRef.current();
      } else {
        bankTurnRef.current();
      }
      return;
    }

    const isCurrentAuthority = tbActive ? isTiebreakerAuthority : isTurnAuthority;
    if (isEffectiveRemote && isCurrentAuthority && turnSecondsLeft <= -15) {
      stopWarningSound();
      // Remote human had 15 seconds of network grace beyond their full turn time with no response!
      // Turn authority executes a single roll/bank to keep the room progressing,
      // but DOES NOT mark them as left or convert them to a bot!
      const active = dice.filter(d => d.zone === 'active');
      if (rollsUsed < 3 && (rollsUsed === 0 || active.length > 0)) {
        doRollRef.current();
      } else {
        bankTurnRef.current();
      }
      return;
    }

    const timer = setInterval(() => {
      setTurnSecondsLeft(s => s - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [
    isTimerEnabled,
    isHumanOwner,
    isRemoteHuman,
    isTurnAuthority,
    isAutoPilotTurn,
    rollsUsed,
    isRolling,
    elimModalMsg,
    tbActive,
    joiningCountdown,
    turnSecondsLeft,
    dice,
    curUnit,
    settings.roomId,
  ]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Sound chime detector for color bonuses & 6-of-a-kind Color Run celebration
  const checkBonusChimes = useCallback((currentDice: Die[]): boolean => {
    const saved = currentDice.filter(d => d.zone === 'saved');
    const byVC: Record<string, number> = {};
    saved.forEach(d => {
      const k = `${d.value}-${d.color}`;
      byVC[k] = (byVC[k] || 0) + 1;
    });

    let triggeredSix = false;
    for (const k in byVC) {
      const count = byVC[k];
      if (count < 3) continue;
      const tier = Math.min(6, count);
      if (tier > (announcedChimesRef.current[k] || 0)) {
        announcedChimesRef.current[k] = tier;
        if (tier === 3) playSfx('s3');
        else if (tier === 4) playSfx('s4');
        else if (tier === 5) {
          playSfx('s5');
          humanFiveOfAKindScoredRef.current = true;
        } else if (tier === 6) {
          playSfx('s6');
          setShowSixCelebration(true);
          triggeredSix = true;
          humanColorRunsCountRef.current += 1;
          humanFiveOfAKindScoredRef.current = true;
        }
      }
    }
    setAnnouncedChimes({ ...announcedChimesRef.current });
    return triggeredSix;
  }, []);

  // Roll dice action: re-slots active dice and locks final values when animation completes
  const doRoll = () => {
    stopWarningSound();
    if (rollsUsed >= 3 || isRolling || isScoreBanking) return;
    if (!isHumanOwner && !(isCPU && isTurnAuthority)) return;
    if (joiningCountdown !== null && joiningCountdown > 0) return;

    // Guarantee that on roll 1 (rollsUsed === 0), all 12 dice are in the active rolling zone
    let workingDice = dice;
    if (rollsUsed === 0) {
      if (workingDice.length < 12 || workingDice.some(d => d.zone === 'saved')) {
        const [c1, c2] = getUnitDiceColors(curUnit, userDiceColors);
        workingDice = createInitialDice(c1, c2);
        setDice(workingDice);
      }
    }

    const active = workingDice.filter(d => d.zone === 'active');
    if (rollsUsed > 0 && active.length === 0) {
      showToast('All dice saved — Score it!');
      return;
    }

    const activeIds = new Set(active.map(d => d.id));
    const activeCount = active.length;
    // On roll 2/3: adjust spaces. 8 remaining -> 2 rows of 4; <=6 remaining -> 1 row
    const newSlots = rollsUsed === 0 ? 12 : activeCount;
    setRollSlotsCount(newSlots);

    // Re-index slots for active dice so they align cleanly to the adjusted layout
    setDice(prev => {
      let nextSlot = 0;
      return prev.map(d => {
        if (d.zone === 'active') {
          return {
            ...d,
            slotIndex: nextSlot++,
            selected: false,
          };
        }
        return d;
      });
    });

    // Generate final random values for this roll
    const finalValuesMap = new Map<number, number>();
    active.forEach(d => {
      finalValuesMap.set(d.id, Math.floor(Math.random() * 6) + 1);
    });

    const nextRoll = rollsUsed + 1;
    let nextSlot = 0;
    const finalDice = workingDice.map(d => {
      if (d.zone === 'active') {
        const finalVal = finalValuesMap.get(d.id) ?? d.value;
        return {
          ...d,
          slotIndex: nextSlot++,
          value: finalVal,
          selected: false,
        };
      }
      return d;
    });

    // Broadcast roll to peers immediately when the roll starts so all devices animate in sync
    if (settings.roomId && (isEffectiveHuman || (isEffectiveCPU && (tbActive ? isTiebreakerAuthority : isTurnAuthority)))) {
      if (tbActive && tiebreaker) {
        updateRoomGameState(settings.roomId, {
          rollsUsed: nextRoll,
          dice: finalDice,
          rollSlotsCount: newSlots,
          tiebreaker: tiebreakerRef.current,
          lastAction: 'tiebreaker_roll',
          lastActionBy: user.uid,
          actionTimestamp: Date.now(),
        });
      } else if (isHumanOwner || (isCPU && isTurnAuthority)) {
        updateRoomGameState(settings.roomId, {
          round,
          phase,
          activeUnitIndex: qIdx,
          activeUnitId: curUnit.id,
          rollsUsed: nextRoll,
          dice: finalDice,
          rollSlotsCount: newSlots,
          lastAction: 'roll',
          lastActionBy: user.uid,
          actionTimestamp: Date.now(),
        });
      }
    }

    setIsRolling(true);

    const rollDuration = spectatorFastForward ? 120 : 1100;
    const lockPreTime = spectatorFastForward ? 60 : 800;

    // Phase 1: Pre-lock true final values while the dice are still actively tumbling.
    setTimeout(() => {
      setDice(prev =>
        prev.map(d => {
          if (d.zone === 'active' && activeIds.has(d.id)) {
            return {
              ...d,
              value: finalValuesMap.get(d.id) ?? d.value,
              selected: false,
            };
          }
          return d;
        })
      );
    }, lockPreTime);

    // Phase 2: Complete roll tumble animation cleanly
    setTimeout(() => {
      setDice(finalDice);
      setRollsUsed(nextRoll);

      // Human player gets time for rolls 2 & 3 (20s in multiplayer, 10s otherwise)
      if (isEffectiveHuman && !isEffectiveCPU) {
        setTurnSecondsLeft(ROLL_2_3_TIME);
      }
      setIsRolling(false);
    }, rollDuration);
  };

  // Tapping active die: moves matching set to saved area.
  // Stops warning sound immediately, resets timer, and leaves original slot space blank in rolling area!
  const handleTapActive = (id: number) => {
    if (!isEffectiveHuman || isEffectiveCPU || rollsUsed === 0 || isRolling) return;
    if (joiningCountdown !== null && joiningCountdown > 0) return;
    if (tbActive && tiebreaker?.phase !== 'rolling') return;

    // Stop warning sound immediately and reset turn timer when user moves dice!
    stopWarningSound();
    if (isEffectiveHuman && !isEffectiveCPU) {
      setTurnSecondsLeft(rollsUsed === 0 ? ROLL_1_TIME : ROLL_2_3_TIME);
    }

    const targetDie = dice.find(d => d.id === id);
    if (!targetDie) return;

    const willSelect = !targetDie.selected;
    const val = targetDie.value;

    const updated = dice.map(d => {
      if (d.zone === 'active' && d.value === val) {
        return { ...d, selected: willSelect };
      }
      return d;
    });

    // Auto-commit if selected + saved of that face >= 3
    const savedCount = updated.filter(d => d.zone === 'saved' && d.value === val).length;
    const selectedActive = updated.filter(
      d => d.zone === 'active' && d.selected && d.value === val
    );

    if (savedCount + selectedActive.length >= 3) {
      const finalized = updated.map(d => {
        if (d.zone === 'active' && d.selected && d.value === val) {
          // Keep its slotIndex so the spot remains blank in RollArea!
          return { ...d, zone: 'saved' as const, selected: false };
        }
        return d;
      });
      setDice(finalized);
      checkBonusChimes(finalized);
      if (settings.roomId && (isEffectiveHuman || (isEffectiveCPU && (tbActive ? isTiebreakerAuthority : isTurnAuthority)))) {
        if (tbActive && tiebreaker) {
          updateRoomGameState(settings.roomId, {
            dice: finalized,
            rollsUsed,
            tiebreaker: tiebreakerRef.current,
            lastAction: 'tiebreaker_save',
            lastActionBy: user.uid,
            actionTimestamp: Date.now(),
          });
        } else if (isHumanOwner || (isCPU && isTurnAuthority)) {
          updateRoomGameState(settings.roomId, {
            round,
            phase,
            activeUnitIndex: qIdx,
            activeUnitId: curUnit.id,
            rollsUsed,
            dice: finalized,
            lastAction: 'save_dice',
            lastActionBy: user.uid,
            actionTimestamp: Date.now(),
          });
        }
      }
    } else {
      setDice(updated);
    }
  };

  // Tapping saved die sends it back to active area into a vacant slot. Resets timer & stops warning sound!
  const handleTapSaved = (id: number) => {
    if (!isEffectiveHuman || isEffectiveCPU || isRolling) return;
    if (joiningCountdown !== null && joiningCountdown > 0) return;
    if (tbActive && tiebreaker?.phase !== 'rolling') return;

    // Stop warning sound immediately and reset turn timer when user moves dice!
    stopWarningSound();
    if (isEffectiveHuman && !isEffectiveCPU) {
      setTurnSecondsLeft(rollsUsed === 0 ? ROLL_1_TIME : ROLL_2_3_TIME);
    }

    const target = dice.find(d => d.id === id);
    if (!target) return;
    const v = target.value;

    // Find occupied slots among active dice
    const activeSlots = new Set(
      dice.filter(d => d.zone === 'active').map(d => d.slotIndex)
    );

    const assignSlot = (originalSlot?: number) => {
      if (originalSlot !== undefined && !activeSlots.has(originalSlot)) {
        activeSlots.add(originalSlot);
        return originalSlot;
      }
      for (let i = 0; i < 12; i++) {
        if (!activeSlots.has(i)) {
          activeSlots.add(i);
          return i;
        }
      }
      return 0;
    };

    // If pulling back leaves < 3 in that set, pull all matching back
    const remainingSaved = dice.filter(
      d => d.zone === 'saved' && d.value === v && d.id !== id
    );
    const result = remainingSaved.length < 3
      ? dice.map(d =>
          d.value === v
            ? { ...d, zone: 'active' as const, selected: false, slotIndex: assignSlot(d.slotIndex) }
            : d
        )
      : dice.map(d =>
          d.id === id
            ? { ...d, zone: 'active' as const, selected: false, slotIndex: assignSlot(d.slotIndex) }
            : d
        );

    setDice(result);

    if (settings.roomId && (isEffectiveHuman || (isEffectiveCPU && (tbActive ? isTiebreakerAuthority : isTurnAuthority)))) {
      if (tbActive && tiebreaker) {
        updateRoomGameState(settings.roomId, {
          dice: result,
          rollsUsed,
          tiebreaker: tiebreakerRef.current,
          lastAction: 'tiebreaker_save',
          lastActionBy: user.uid,
          actionTimestamp: Date.now(),
        });
      } else if (isHumanOwner || (isCPU && isTurnAuthority)) {
        updateRoomGameState(settings.roomId, {
          round,
          phase,
          activeUnitIndex: qIdx,
          activeUnitId: curUnit.id,
          rollsUsed,
          dice: result,
          lastAction: 'save_dice',
          lastActionBy: user.uid,
          actionTimestamp: Date.now(),
        });
      }
    }
  };

  // Helper to build unit status record with no undefined fields for Firestore serialization
  const buildUnitStatusRecord = (playerList: PlayerUnit[]) => {
    const status: Record<string, { active: boolean; place?: number; score: number; history: Record<number, number> }> = {};
    playerList.forEach(u => {
      status[u.id] = {
        active: u.active,
        score: u.score,
        history: u.history,
        ...(u.place !== undefined ? { place: u.place } : {}),
      };
    });
    return status;
  };

  // Next Turn or Round Resolution
  const bankTurn = useCallback(() => {
    stopWarningSound();
    const activePlayer = tbActive ? tiedCurrentUnit : curUnit;
    if (!activePlayer) return;
    const canAct = tbActive
      ? (isTiedLocalHuman || (tiedCurrentUnit?.isCPU && isTiebreakerAuthority) || (isTiedRemoteHuman && isTiebreakerAuthority && turnSecondsLeft <= -15))
      : (isLocalHuman(curUnit) || (curUnit.isCPU && isTurnAuthority) || (isRemoteHuman && isTurnAuthority && turnSecondsLeft <= -15));
    if (!canAct || isScoreBanking) return;
    if (joiningCountdown !== null && joiningCountdown > 0) return;
    if (tbActive && tiebreaker?.phase !== 'rolling') return;

    // Automatically commit any full sets remaining in active dice before banking
    let curDice = [...dice];
    const savedCounts: Record<number, number> = {};
    curDice.filter(d => d.zone === 'saved').forEach(d => {
      savedCounts[d.value] = (savedCounts[d.value] || 0) + 1;
    });

    const activeByVal: Record<number, Die[]> = {};
    curDice.filter(d => d.zone === 'active').forEach(d => {
      if (!activeByVal[d.value]) activeByVal[d.value] = [];
      activeByVal[d.value].push(d);
    });

    let modified = false;
    for (const v in activeByVal) {
      const count = (savedCounts[v] || 0) + activeByVal[v].length;
      if (count >= 3) {
        modified = true;
        curDice = curDice.map(d => (d.zone === 'active' && d.value === Number(v) ? { ...d, zone: 'saved', selected: false } : d));
      }
    }

    let hasSixCelebration = showSixCelebration;
    if (modified) {
      setDice(curDice);
      if (checkBonusChimes(curDice)) {
        hasSixCelebration = true;
      }
    }

    const currentSaved = curDice.filter(d => d.zone === 'saved');
    const finalScore = scoreDice(currentSaved);
    if (isHumanOwner && !isCPU) {
      const turnCb = finalScore.sets.reduce((sum, s) => sum + (s.cb || 0), 0);
      humanColorBonusTotalRef.current += turnCb;
    }
    playSfx('add');

    // Trigger bubble animation: floats points total to user's scoreboard
    const pointsToFloat = tbActive
      ? (finalScore.total > 0 ? finalScore.total : curDice.reduce((acc, d) => acc + d.value, 0))
      : finalScore.total;
    setIsScoreBanking(true);
    triggerScoreBubble(pointsToFloat, activePlayer.id);

    const executeBankTransition = () => {
      setIsScoreBanking(false);

      // === TIEBREAKER TURN RESOLUTION ===
      if (tbActive && tiebreaker && tiebreaker.phase === 'rolling' && tiedCurrentUnit) {
        const tb = tiebreaker;
        const turnTotal = finalScore.total > 0 ? finalScore.total : curDice.reduce((acc, d) => acc + d.value, 0);

        setRollsUsed(0);
        setAnnouncedChimes({});
        setShowSixCelebration(false);

        const nextRollScores = {
          ...tb.rollScores,
          [tiedCurrentUnit.id]: turnTotal,
        };

        const nextTiedIdx = tb.activeTiedIndex + 1;
        if (nextTiedIdx < tb.tiedUnitIds.length) {
          // Next tied player in this tiebreak round takes their normal turn!
          const nextTargetUnitId = tb.tiedUnitIds[nextTiedIdx];
          const nextDiceForTurn = freshDiceFor(nextTargetUnitId) || createInitialDice(settings.colorA, settings.colorB);
          const nextTb: TiebreakerState = {
            ...tb,
            activeTiedIndex: nextTiedIdx,
            rollScores: nextRollScores,
            lastRollTotal: turnTotal,
          };

          setDice(nextDiceForTurn);
          setTurnSecondsLeft(ROLL_1_TIME);
          setIsAutoPilotTurn(false);
          setTiebreaker(nextTb);

          publishTiebreaker('tiebreaker_next', nextTb, nextDiceForTurn);
        } else {
          // Final player in the tiebreak hits "SCORE IT"!
          const resolved = resolveTiebreakerRound(tb, nextRollScores, tbNameOf);

          if (resolved.phase === 'blinking') {
            // Check if human was tied and survived / won
            const human = units.find(u => u.isOwner || (!u.isCPU && !isMultiplayer));
            if (human && tb.tiedUnitIds.includes(human.id) && resolved.eliminatedUnitId !== human.id) {
              humanWonTiebreakerRef.current = true;
            }

            // Winner's board (or two advancing boards in 3-player) will blink for 3 seconds!
            const blinkingTb: TiebreakerState = {
              ...resolved,
              phase: 'blinking',
              rollScores: nextRollScores,
            };
            setTiebreaker(blinkingTb);
            publishTiebreaker('tiebreaker_blink', blinkingTb, null);
            playSfx('fanfare');

            // Winner's board blinks for 3 seconds, then closing animation appears!
            const blinkTimer = setTimeout(() => {
              const outroTb: TiebreakerState = {
                ...blinkingTb,
                phase: 'outro',
              };
              isTiebreakerDriverRef.current = true;
              setTiebreaker(outroTb);
              stopBattleMusic();
              publishTiebreaker('tiebreaker_outro', outroTb, null);
            }, 3000);
            tbTimersRef.current.push(blinkTimer);
          } else {
            // If 3-player tiebreak and 1 user scored most while others tied again:
            // The user who scored most shows "ADVANCE" under the score while the other users roll again.
            // The score from round one goes back to zero for the two remaining users, who roll again.
            // Or if all tied again: scores go back to zero and they roll again.
            const nextTargetUnitId = currentTiedUnitId(resolved);
            const nextDiceForTurn = freshDiceFor(nextTargetUnitId) || createInitialDice(settings.colorA, settings.colorB);

            setDice(nextDiceForTurn);
            setTurnSecondsLeft(ROLL_1_TIME);
            setIsAutoPilotTurn(false);
            setTiebreaker(resolved);
            playSfx('s3');

            publishTiebreaker('tiebreaker_next', resolved, nextDiceForTurn);
          }
        }
        return;
      }

      // Update player score & history
      const updatedUnits = units.map(u => {
        if (u.id === curUnit.id) {
          if (u.isOwner) {
            if (finalScore.total >= 70) {
              humanCenturyClubScoredRef.current = true;
            }
            const has5OfAKind = finalScore.sets.some(s => Object.values(s.byColor).some(cnt => cnt >= 5));
            if (has5OfAKind) {
              humanFiveOfAKindScoredRef.current = true;
            }
          }
          const nextScore = u.score + finalScore.total;
          const nextHist = { ...u.history, [round]: finalScore.total };
          return { ...u, score: nextScore, history: nextHist };
        }
        return u;
      });

      setUnits(updatedUnits);

      const finishBank = () => {
        // Reset turn state
        setRollsUsed(0);
        setAnnouncedChimes({});
        setShowSixCelebration(false);

        // Next player or end of round
        const nextQIdx = qIdx + 1;
        const stillActive = updatedUnits.filter(u => u.active);
        const nextTargetUnit = nextQIdx < stillActive.length ? stillActive[nextQIdx] : stillActive[0];
        const [nextColorA, nextColorB] = getUnitDiceColors(nextTargetUnit, userDiceColors);
        const nextDiceForTurn = createInitialDice(nextColorA, nextColorB);

        setDice(nextDiceForTurn);
        setTurnSecondsLeft(ROLL_1_TIME);
        setIsAutoPilotTurn(false);

        if (nextQIdx < stillActive.length) {
          setQIdx(nextQIdx);

          if (settings.roomId) {
            const scoresRecord: Record<string, number> = {};
            const histRecord: Record<string, Record<number, number>> = {};
            updatedUnits.forEach(u => {
              scoresRecord[u.id] = u.score;
              histRecord[u.id] = u.history;
            });
            const unitStatus = buildUnitStatusRecord(updatedUnits);

            updateRoomGameState(settings.roomId, {
              round,
              phase,
              activeUnitIndex: nextQIdx,
              activeUnitId: nextTargetUnit.id,
              scores: scoresRecord,
              unitHistory: histRecord,
              activeUnitIds: stillActive.map(u => u.id),
              unitStatus,
              rollsUsed: 0,
              dice: nextDiceForTurn,
              lastAction: 'bank',
              lastActionBy: user.uid,
              actionTimestamp: Date.now(),
            });
          }
        } else {
          // Completed full round!
          resolveRound(updatedUnits);
        }
      };

      if (hasSixCelebration) {
        setTimeout(finishBank, 3100);
      } else {
        finishBank();
      }
    };

    if (spectatorFastForward) {
      executeBankTransition();
    } else {
      setTimeout(executeBankTransition, 820);
    }
  }, [
    curUnit,
    dice,
    qIdx,
    round,
    phase,
    settings.colorA,
    settings.colorB,
    units,
    userDiceColors,
    checkBonusChimes,
    showSixCelebration,
    isTurnAuthority,
    tbActive,
    tiebreaker,
    tiedCurrentUnit,
    isTiedLocalHuman,
    isTiedRemoteHuman,
    isTiebreakerAuthority,
    turnSecondsLeft,
    joiningCountdown,
    tbNameOf,
    freshDiceFor,
    publishTiebreaker,
  ]);

  doRollRef.current = doRoll;
  bankTurnRef.current = bankTurn;

  // Round resolution (checking threshold or doing elimination)
  const resolveRound = (currentUnits: PlayerUnit[]) => {
    const liveUnits = currentUnits.filter(u => u.active);

    if (phase === 'regular') {
      const thresholdReached = liveUnits.some(u => u.score >= settings.threshold);
      if (thresholdReached) {
        // Track if human entered elimination threshold in last place
        const sortedScores = [...liveUnits].sort((a, b) => a.score - b.score);
        const lowestScore = sortedScores[0]?.score;
        const human = liveUnits.find(u => u.isOwner || (!u.isCPU && !isMultiplayer));
        if (human && human.score === lowestScore) {
          humanWasLastWhenElimStartedRef.current = true;
        }

        setPhase('elimination');
        const msg = `Someone reached ${settings.threshold} points! From here, every player plays a full round, then the lowest total is knocked out. Last one standing wins!`;
        triggerEliminationWarning(msg);

        // Advance to round 4 (the first elimination round) and reset to first player
        const nextRound = round + 1;
        setRound(nextRound);
        setQIdx(0);
        setRollsUsed(0);
        setRollSlotsCount(12);
        const [c1, c2] = getUnitDiceColors(liveUnits[0], userDiceColors);
        const nextDice = createInitialDice(c1, c2);
        setDice(nextDice);
        if (isLocalHuman(liveUnits[0])) {
          setTurnSecondsLeft(ROLL_1_TIME);
          setIsAutoPilotTurn(false);
        }

        if (settings.roomId) {
          const scoresRecord: Record<string, number> = {};
          const histRecord: Record<string, Record<number, number>> = {};
          currentUnits.forEach(u => {
            scoresRecord[u.id] = u.score;
            histRecord[u.id] = u.history;
          });
          const unitStatus = buildUnitStatusRecord(currentUnits);

          updateRoomGameState(settings.roomId, {
            round: nextRound,
            phase: 'elimination',
            activeUnitIndex: 0,
            activeUnitId: liveUnits[0].id,
            scores: scoresRecord,
            unitHistory: histRecord,
            activeUnitIds: liveUnits.map(u => u.id),
            unitStatus,
            rollsUsed: 0,
            dice: nextDice,
            lastAction: 'phase_change',
            lastActionBy: user.uid,
            actionTimestamp: Date.now(),
          });
        }
        return;
      }

      // Continue next regular round
      const nextRound = round + 1;
      setRound(nextRound);
      setQIdx(0);
      setRollsUsed(0);
      setRollSlotsCount(12);
      const [c1, c2] = getUnitDiceColors(liveUnits[0], userDiceColors);
      const nextDice = createInitialDice(c1, c2);
      setDice(nextDice);
      if (isLocalHuman(liveUnits[0])) {
        setTurnSecondsLeft(ROLL_1_TIME);
        setIsAutoPilotTurn(false);
      }

      if (settings.roomId) {
        const scoresRecord: Record<string, number> = {};
        const histRecord: Record<string, Record<number, number>> = {};
        currentUnits.forEach(u => {
          scoresRecord[u.id] = u.score;
          histRecord[u.id] = u.history;
        });
        const unitStatus = buildUnitStatusRecord(currentUnits);

        updateRoomGameState(settings.roomId, {
          round: nextRound,
          phase: 'regular',
          activeUnitIndex: 0,
          activeUnitId: liveUnits[0].id,
          scores: scoresRecord,
          unitHistory: histRecord,
          activeUnitIds: liveUnits.map(u => u.id),
          unitStatus,
          rollsUsed: 0,
          dice: nextDice,
          lastAction: 'bank',
          lastActionBy: user.uid,
          actionTimestamp: Date.now(),
        });
      }
    } else {
      // Elimination phase: check if human is in the bottom two among live units (Precision Roller tracking)
      if (liveUnits.length >= 3) {
        const sortedLive = [...liveUnits].sort((a, b) => a.score - b.score);
        const bottomTwoIds = sortedLive.slice(0, 2).map(u => u.id);
        const human = liveUnits.find(u => u.isOwner || (!u.isCPU && !isMultiplayer));
        if (human && bottomTwoIds.includes(human.id)) {
          humanEverInBottomTwoRef.current = true;
        }
      }

      // Elimination phase: a tie for the lowest total starts the Battle to Survive roll-off
      const tied = findLowestTie(liveUnits);
      if (tied.length > 0) {
        beginTiebreaker(currentUnits, tied.map(u => u.id));
        return;
      }

      // No tie: single lowest score player is eliminated
      const lowestUnit = liveUnits.reduce((lo, u) => (u.score < lo.score ? u : lo));
      finishElimination(currentUnits, lowestUnit.id);
    }
  };

  // Knocks out one player at the end of an elimination round, then starts the next round
  // or ends the game. Only the device that decided the elimination calls this; in room
  // games it publishes the result and the other devices apply it from the room update.
  const finishElimination = (currentUnits: PlayerUnit[], eliminatedId: string) => {
    const eliminated = currentUnits.find(u => u.id === eliminatedId);
    if (!eliminated) return;
    const liveCount = currentUnits.filter(u => u.active).length;

    const finalizedUnits = currentUnits.map(u =>
      u.id === eliminatedId ? { ...u, active: false, place: liveCount } : u
    );

    setUnits(finalizedUnits);
    triggerEliminatedBanner(eliminated.name);

    const survivors = finalizedUnits.filter(u => u.active);
    if (survivors.length <= 1) {
      // We have a winner!
      const winner = { ...(survivors[0] || finalizedUnits[0]), place: 1 };
      const unitsWithWinner = finalizedUnits.map(u => (u.id === winner.id ? winner : u));

      if (settings.roomId) {
        const scoresRecord: Record<string, number> = {};
        const histRecord: Record<string, Record<number, number>> = {};
        unitsWithWinner.forEach(u => {
          scoresRecord[u.id] = u.score;
          histRecord[u.id] = u.history;
        });
        const unitStatus = buildUnitStatusRecord(unitsWithWinner);
        unitStatus[winner.id] = { ...unitStatus[winner.id], place: 1, active: true };

        updateRoomGameState(settings.roomId, {
          round: round + 1,
          phase: 'over',
          activeUnitIndex: 0,
          activeUnitId: winner.id,
          scores: scoresRecord,
          unitHistory: histRecord,
          activeUnitIds: [winner.id],
          unitStatus,
          rollsUsed: 0,
          dice,
          tiebreaker: null,
          lastAction: 'elimination',
          lastActionBy: user.uid,
          actionTimestamp: Date.now(),
        });
      }

      onGameOver(winner, unitsWithWinner, getMatchStats(unitsWithWinner, winner));
      return;
    }

    // Show elimination toast
    showToast(`⚔️ Round complete: ${eliminated.name} knocked out!`);

    const nextRound = round + 1;
    setRound(nextRound);
    setQIdx(0);
    setRollsUsed(0);
    setRollSlotsCount(12);
    const [c1, c2] = getUnitDiceColors(survivors[0], userDiceColors);
    const nextDice = createInitialDice(c1, c2);
    setDice(nextDice);
    if (isLocalHuman(survivors[0])) {
      setTurnSecondsLeft(ROLL_1_TIME);
      setIsAutoPilotTurn(false);
    }

    if (settings.roomId) {
      const scoresRecord: Record<string, number> = {};
      const histRecord: Record<string, Record<number, number>> = {};
      finalizedUnits.forEach(u => {
        scoresRecord[u.id] = u.score;
        histRecord[u.id] = u.history;
      });
      const unitStatus = buildUnitStatusRecord(finalizedUnits);

      updateRoomGameState(settings.roomId, {
        round: nextRound,
        phase: 'elimination',
        activeUnitIndex: 0,
        activeUnitId: survivors[0].id,
        scores: scoresRecord,
        unitHistory: histRecord,
        activeUnitIds: survivors.map(u => u.id),
        unitStatus,
        rollsUsed: 0,
        dice: nextDice,
        tiebreaker: null,
        lastAction: 'elimination',
        lastActionBy: user.uid,
        actionTimestamp: Date.now(),
      });
    }
  };

  // Applies a new roll-off state on this device: music, sounds and fresh dice for the next roller
  const showTiebreakerState = (next: TiebreakerState, prev: TiebreakerState | null) => {
    if (!prev) startBattleMusic();
    if (next.phase === 'outro' && prev?.phase !== 'outro') {
      stopBattleMusic();
    } else if (prev && next.roundNumber > prev.roundNumber) {
      playSfx('s3');
    }
    if (next.phase !== 'outro') {
      const nextDice = freshDiceFor(currentTiedUnitId(next));
      if (nextDice) setDice(nextDice);
    }
    setTiebreaker(next);
  };

  const beginTiebreaker = (currentUnits: PlayerUnit[], tiedIds: string[]) => {
    const state = startTiebreaker(tiedIds);
    isTiebreakerDriverRef.current = false;
    setRollsUsed(0);
    setRollSlotsCount(12);
    const initialDice = freshDiceFor(tiedIds[0]) || createInitialDice(settings.colorA, settings.colorB);
    setDice(initialDice);
    showTiebreakerState(state, null);
    publishTiebreaker('tiebreaker_start', state, initialDice, {
      unitStatus: buildUnitStatusRecord(currentUnits),
    });
  };

  const handleTiebreakerIntroComplete = () => {
    // The video raises after 4s to reveal the roll-off (each device times its own intro)
    setTiebreaker(tb => (tb && tb.phase === 'intro' ? { ...tb, phase: 'rolling' } : tb));
    setRollsUsed(0);
    setRollSlotsCount(12);
    setTurnSecondsLeft(ROLL_1_TIME);
  };

  // Roll-off state published by another device
  const applyRemoteTiebreaker = (
    lastAction: string,
    next: TiebreakerState | null | undefined,
    remoteDice: Die[] | undefined
  ) => {
    if (!next) return;
    const prev = tiebreakerRef.current;
    isTiebreakerDriverRef.current = false;
    if (lastAction === 'tiebreaker_roll' && remoteDice) {
      if (!prev) startBattleMusic();
      setIsRolling(true);
      setDice(remoteDice);
      setTimeout(() => {
        setIsRolling(false);
      }, 1100);
      setTiebreaker(next);
      return;
    }
    if (lastAction === 'tiebreaker_save' && remoteDice) {
      setDice(remoteDice);
      return;
    }
    if (lastAction === 'tiebreaker_blink') {
      setTiebreaker(next);
      playSfx('fanfare');
      return;
    }
    if (lastAction === 'tiebreaker_outro') {
      setTiebreaker(next);
      stopBattleMusic();
      return;
    }
    showTiebreakerState(next, prev);
  };
  applyRemoteTiebreakerRef.current = applyRemoteTiebreaker;

  const handleTiebreakerOutroComplete = () => {
    const tb = tiebreakerRef.current;
    setTiebreaker(null);
    stopBattleMusic();
    if (!tb?.eliminatedUnitId) return;

    if (!settings.roomId || isTiebreakerDriverRef.current) {
      isTiebreakerDriverRef.current = false;
      finishElimination(units, tb.eliminatedUnitId);
    } else {
      // The deciding device publishes the elimination; this device just shows the banner
      triggerEliminatedBanner(tbNameOf(tb.eliminatedUnitId));
    }
  };

  // Dismiss elimination announcement without altering round or dice (state is already synced)
  const handleDismissElimModal = useCallback(() => {
    setElimModalMsg(null);
  }, []);

  // 5-second countdown timer on the elimination warning button
  useEffect(() => {
    if (!elimModalMsg) return;
    setElimCountdown(5);
    const timer = setInterval(() => {
      setElimCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleDismissElimModal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [elimModalMsg, handleDismissElimModal]);

  // CPU Automated Turn Runner (waits if elimination modal or 6-of-a-kind celebration or joining countdown is displayed)
  useEffect(() => {
    const curPlayer = tbActive ? tiedCurrentUnit : curUnit;
    const isBot = tbActive ? !!tiedCurrentUnit?.isCPU : isCPU;
    if (
      !isBot ||
      !curPlayer ||
      isRolling ||
      elimModalMsg ||
      showSixCelebration ||
      isScoreBanking ||
      (joiningCountdown !== null && joiningCountdown > 0) ||
      (tbActive && tiebreaker?.phase !== 'rolling')
    )
      return;

    // In multiplayer: only the designated turn authority client runs the CPU bots!
    const authority = tbActive ? isTiebreakerAuthority : isTurnAuthority;
    if (settings.mode === 'online' && !authority && !isAutoPilotTurn) {
      return;
    }

    const delay = spectatorFastForward ? 120 : settings.mode === 'online' ? 850 : 650;

    const timer = setTimeout(() => {
      if (rollsUsed === 0) {
        doRoll();
        return;
      }

      // Step 1: Check if there are sets of 3+ (or matching sets) in active dice to save
      const toSaveIds = decideCPUSaves(dice);
      if (toSaveIds.length > 0) {
        const nextDice = dice.map(d =>
          toSaveIds.includes(d.id) ? { ...d, zone: 'saved' as const, selected: false } : d
        );
        playSfx('add');
        setDice(nextDice);
        checkBonusChimes(nextDice);

        if (settings.roomId && authority) {
          if (tbActive && tiebreaker) {
            updateRoomGameState(settings.roomId, {
              dice: nextDice,
              rollsUsed,
              tiebreaker: tiebreakerRef.current,
              lastAction: 'tiebreaker_save',
              lastActionBy: user.uid,
              actionTimestamp: Date.now(),
            });
          } else {
            updateRoomGameState(settings.roomId, {
              round,
              phase,
              activeUnitIndex: qIdx,
              activeUnitId: curUnit.id,
              rollsUsed,
              dice: nextDice,
              lastAction: 'save_dice',
              lastActionBy: user.uid,
              actionTimestamp: Date.now(),
            });
          }
        }
        // Yield execution!
        return;
      }

      // Step 2: All valid sets are in the saved area. Decide next action:
      const remainingActive = dice.filter(d => d.zone === 'active');
      if (rollsUsed < 3 && remainingActive.length > 0) {
        // Roll remaining active dice for roll 2 or roll 3
        doRoll();
      } else {
        // No more rolls or no more active dice: bank turn
        bankTurn();
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [
    isCPU,
    isTurnAuthority,
    isAutoPilotTurn,
    settings.mode,
    settings.roomId,
    user.uid,
    curUnit,
    round,
    phase,
    qIdx,
    rollsUsed,
    isRolling,
    dice,
    spectatorFastForward,
    elimModalMsg,
    tbActive,
    tiebreaker,
    tiedCurrentUnit,
    isTiebreakerAuthority,
    showSixCelebration,
    joiningCountdown,
    doRoll,
    bankTurn,
    checkBonusChimes,
  ]);

  const canRoll =
    rollsUsed < 3 &&
    dice.filter(d => d.zone === 'active').length > 0 &&
    isEffectiveHuman &&
    !isEffectiveCPU &&
    !isRolling &&
    (joiningCountdown === null || joiningCountdown <= 0) &&
    (!tbActive || tiebreaker?.phase === 'rolling');

  const canScore =
    !isScoreBanking &&
    (rollsUsed === 3 || dice.filter(d => d.zone === 'active').length === 0) &&
    rollsUsed > 0 &&
    isEffectiveHuman &&
    !isEffectiveCPU &&
    (joiningCountdown === null || joiningCountdown <= 0) &&
    (!tbActive || tiebreaker?.phase === 'rolling');

  const humanPlayer = units.find(u => u.isOwner);
  const isHumanOut = humanPlayer ? !humanPlayer.active : false;
  const onlyComputersLeft = units.filter(u => u.active).every(u => u.isCPU);

  // Elimination overlay state for multiplayer and Friends Challenge games
  const [hasDismissedElimOverlay, setHasDismissedElimOverlay] = useState(false);
  const wasEliminatedSoundPlayedRef = useRef(false);

  // Determine user's finishing place if eliminated
  const humanPlace = humanPlayer?.place && humanPlayer.place > 0
    ? humanPlayer.place
    : (units.filter(u => u.active).length + 1);

  // Calculate prize payout eligibility
  const effectivePayouts = settings.payouts && settings.payouts.length > 0
    ? settings.payouts
    : calculatePayouts(settings.playersCount || units.length, settings.tier || 'standard', settings.buyIn);

  const eliminatedPrize = (effectivePayouts && humanPlace > 0 && effectivePayouts[humanPlace - 1])
    ? effectivePayouts[humanPlace - 1]
    : 0;

  // Show overlay over Saved Dice area in multiplayer or Friends Challenge when eliminated
  const showMultiplayerElimOverlay =
    (isMultiplayer || isFriendsChallenge) &&
    isHumanOut &&
    !hasDismissedElimOverlay &&
    phase !== 'over';

  // Show overlay over Saved Dice area in Play vs Computer when eliminated
  const showVsCpuElimOverlay =
    !isMultiplayer &&
    !isFriendsChallenge &&
    isHumanOut &&
    !spectatorChoiceMade &&
    phase !== 'over';

  useEffect(() => {
    if ((showMultiplayerElimOverlay || showVsCpuElimOverlay) && !wasEliminatedSoundPlayedRef.current) {
      wasEliminatedSoundPlayedRef.current = true;
      triggerEliminatedBanner(humanPlayer?.name || user.name || 'You');
    }
  }, [showMultiplayerElimOverlay, showVsCpuElimOverlay, humanPlayer?.name, user.name, triggerEliminatedBanner]);

  // Target display logic: target is reached once elimination phase begins or someone hits threshold
  const targetReached = phase === 'elimination' || units.some(u => u.score >= settings.threshold);

  // 5-second warning indicator when turn time is almost up (ONLY active when timers are enabled in room)
  const isTimeRunningOut = isTimerEnabled && isHumanOwner && !isCPU && turnSecondsLeft <= 5 && !isRolling;

  // In a multiplayer online game, when 15 seconds remain to either touch the screen or roll,
  // have a bar slide down under the Saved Dice/Points label.
  const isMultiplayerGame = settings.mode === 'online' || isTimerEnabled;
  const show15sWarning =
    isMultiplayerGame &&
    isHumanOwner &&
    !isCPU &&
    !isRolling &&
    !elimModalMsg &&
    (joiningCountdown === null || joiningCountdown <= 0) &&
    turnSecondsLeft <= 15 &&
    turnSecondsLeft > 0;

  const handleScreenTouchAction = () => {
    stopWarningSound();
    if (isHumanOwner && isMultiplayerGame && turnSecondsLeft <= 15 && turnSecondsLeft > 0) {
      setTurnSecondsLeft(rollsUsed === 0 ? ROLL_1_TIME : ROLL_2_3_TIME);
    }
  };

  const handleEliminationExit = () => {
    if (settings.roomId && user?.uid) {
      markPlayerLeft(settings.roomId, user.uid);
    }
    const stats: MatchSummaryStats = {
      survivedRounds: Math.max(0, (settings.playersCount || units.length) - humanPlace),
      colorBonusPoints: humanColorBonusTotalRef.current,
      placement: humanPlace,
      finished: true,
    };
    onExitGame(eliminatedPrize, stats);
  };

  const handleExitClick = () => {
    if (settings.roomId && user?.uid) {
      markPlayerLeft(settings.roomId, user.uid);
    }
    if (!isHumanOut && humanPlayer?.active) {
      // Route through onOpenMenu to show forfeiture warning modal
      onOpenMenu();
    } else {
      // User is eliminated — they can leave early and still receive any prize they earned!
      const stats: MatchSummaryStats = {
        survivedRounds: Math.max(0, (settings.playersCount || units.length) - humanPlace),
        colorBonusPoints: humanColorBonusTotalRef.current,
        placement: humanPlace,
        finished: true,
      };
      onExitGame(eliminatedPrize, stats);
    }
  };

  return (
    <div
      onTouchStart={handleScreenTouchAction}
      onMouseDown={handleScreenTouchAction}
      className="w-full max-w-none mx-auto flex flex-col h-full max-h-[100dvh] p-1 sm:p-2 md:p-3 select-none relative overflow-hidden"
    >
      {/* AFK Grey Overlay if user stepped away */}
      {isAfkOverlay && (
        <div
          onClick={() => {
            setIsAfkOverlay(false);
            setConsecutiveAfkTurns(0);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm cursor-pointer select-none animate-fade-in"
        >
          <div className="bg-[#2d2319]/95 border-2 border-[#f2c14e] rounded-3xl p-6 max-w-xs text-center text-white shadow-2xl">
            <div className="text-3xl mb-2">⏳</div>
            <h3 className="text-lg font-black text-[#f2c14e] mb-1">You stepped away</h3>
            <p className="text-xs text-stone-300 leading-relaxed mb-4">
              Tap the screen to continue.
            </p>
            <div className="py-2.5 px-6 bg-[#2f9a4f] text-white text-xs font-black rounded-xl inline-block shadow-md">
              Tap to continue
            </div>
            {consecutiveAfkTurns > 0 && (
              <div className="text-[11px] font-bold text-amber-300/90 mt-3 bg-black/40 py-1 px-2 rounded-lg border border-amber-300/30">
                Inactive turn: {consecutiveAfkTurns} of 4 before room forfeit
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Anchored Section (Logos, Round Bar, Scorecards Strip, Toast) - Fixed in place under user bar */}
      <div className="w-full flex flex-col shrink-0">
        {/* Logos Row (reduced by 20% per user specification) */}
        <div className="flex items-center justify-between px-2 py-0 mb-0.5">
          <img
            src="/assets/img/cr-logo.png"
            alt="Color Run"
            className="h-[53px] sm:h-[60px] object-contain drop-shadow-md select-none"
            draggable={false}
          />
          <img
            src="/assets/img/dg-logo.png"
            alt="Data Games Lab"
            className="h-[60px] sm:h-[66px] object-contain drop-shadow-md select-none"
            draggable={false}
          />
        </div>

        {/* Round Indicator Bar - Text 10% smaller */}
        <div
          className={`w-full py-0.5 px-2.5 rounded-full text-center font-black text-[10.5px] sm:text-[11px] tracking-wider uppercase shadow-sm transition-colors duration-300 mb-0.5 flex items-center justify-center gap-2 ${
            phase === 'elimination'
              ? 'bg-[#d62828] text-white'
              : 'bg-[#28974a] text-white'
          }`}
        >
          <span>
            {!targetReached
              ? `Round ${round} - Target ${settings.threshold} pts.`
              : phase === 'elimination'
              ? `Elimination Round ${round}`
              : `Round ${round}`}
          </span>
          {isTimerEnabled && isHumanOwner && !isAutoPilotTurn && !isCPU && (
            <span
              className={`text-[9.5px] sm:text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                isTimeRunningOut
                  ? 'bg-red-500 text-white border-red-600 animate-pulse'
                  : 'bg-black/30 text-white border-white/30'
              }`}
            >
              ⏱️ {turnSecondsLeft}s
            </span>
          )}
        </div>

        {/* Players Scoreboards Strip */}
        <div className="mb-1">
          <CardsStrip
            units={
              tiebreaker
                ? units.filter(
                    u =>
                      tiebreaker.initialTiedUnitIds?.includes(u.id) ||
                      tiebreaker.tiedUnitIds.includes(u.id) ||
                      tiebreaker.advancedUnitIds?.includes(u.id)
                  )
                : units
            }
            activeUnitId={tiebreaker ? tiedCurrentUnit?.id : curUnit?.id}
            currentRound={round}
            isEliminationPhase={phase === 'elimination' || tbActive}
            isUserTurnToRoll={
              (!tbActive && isHumanOwner && rollsUsed === 0 && !isAutoPilotTurn && (joiningCountdown === null || joiningCountdown <= 0)) ||
              (tbActive && isTiedLocalHuman && rollsUsed === 0 && tiebreaker.phase === 'rolling')
            }
            onSelectUnit={setSelectedPlayerForProfile}
            isTiebreakerActive={tbActive}
            tiebreakerScores={tiebreaker?.rollScores}
            tiebreakerAdvancedIds={tiebreaker?.advancedUnitIds}
            blinkingUnitIds={tiebreaker?.blinkingUnitIds}
            liveTurnScore={
              tbActive && tiedCurrentUnit
                ? {
                    unitId: tiedCurrentUnit.id,
                    score: scoreResult.total > 0 ? scoreResult.total : (tiebreaker?.rollScores[tiedCurrentUnit.id] ?? 0),
                  }
                : null
            }
          />
        </div>

        {/* 15-second Gameplay Screen Waiting Period for Multiplayer Rooms */}
        {joiningCountdown !== null && joiningCountdown > 0 && (
          <div className="bg-[#faf4e6]/95 border-2 border-[#f2c14e] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 mb-1 shadow-lg text-center animate-fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-[#3e2e1e]">
                <Loader2 className="w-4 h-4 animate-spin text-[#2f9a4f]" />
                <span>Waiting for all players to join…</span>
              </div>
              <span className="font-mono text-xs font-black px-2 py-0.5 rounded-full bg-[#f2c14e] text-[#2b170a] shadow-xs">
                ⏱️ {joiningCountdown}s
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#735c46] leading-snug mt-0.5">
              Allowing 15 seconds for all players to finish intro screens and connect.
            </p>
            {/* Quick status dots of all room players */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1.5">
              {units.map((u, idx) => (
                <div
                  key={u.id || idx}
                  className="flex items-center gap-1 bg-white/90 border border-[#ebdcb9] px-2 py-0.5 rounded-full text-[10px] font-bold text-[#3e2e1e] shadow-2xs"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: u.color }}
                  />
                  <span className="truncate max-w-[80px]">{u.name}</span>
                  {u.isCPU ? (
                    <span className="text-[9px] text-[#b3630a] font-mono">🤖 CPU</span>
                  ) : (
                    <span className="text-[9px] text-[#2f9a4f] font-mono">🟢 Ready</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toast message (for friend additions/actions) */}
        {toastMsg && (
          <div className="bg-[#1c6a35] text-white text-[11px] font-bold px-2.5 py-1 rounded-xl text-center mb-1 shadow-md animate-fade-in">
            {toastMsg}
          </div>
        )}
      </div>

      {/* Middle Game Area (Saved Dice & Active Roll Area) - SavedBoard is the MAIN FLEX POINT */}
      <div
        onTouchStart={handleScreenTouchAction}
        onMouseDown={handleScreenTouchAction}
        className="flex-1 flex flex-col justify-between min-h-0 py-0.5 sm:py-1 gap-1 sm:gap-1.5 overflow-hidden"
      >
        {/* Saved Dice Board - MAIN FLEX POINT: grows and shrinks as needed */}
        <div className="flex-1 min-h-0 flex flex-col justify-center transition-all duration-300 relative">
          <SavedBoard
            savedDice={savedDice}
            scoreResult={scoreResult}
            onTapSavedDie={handleTapSaved}
            isCPU={isCPU}
            showSixCelebration={showSixCelebration}
            onDismissSixCelebration={handleDismissSixCelebration}
            warningSecondsLeft={show15sWarning ? turnSecondsLeft : null}
            onTouchScreen={handleScreenTouchAction}
            eliminationBanner={eliminationBannerUnderLabels}
          />

          {/* Reaction Overlay in the Saved Dice Area (Appears on all users' devices) */}
          <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center overflow-hidden">
            <AnimatePresence>
              {savedBoardEmotes.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ scale: 0.2, y: 25, opacity: 0 }}
                  animate={{ scale: [0.3, 1.2, 1], y: 0, opacity: 1 }}
                  exit={{ scale: 1.3, y: -35, opacity: 0 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="absolute flex flex-col items-center justify-center pointer-events-none"
                  style={{
                    zIndex: 25 + idx,
                    transform: `translateX(${(idx - (savedBoardEmotes.length - 1) / 2) * 60}px)`,
                  }}
                >
                  <div className="text-4xl sm:text-5xl md:text-6xl filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] animate-bounce-subtle">
                    {item.emoji}
                  </div>
                  <div className="text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full bg-black/85 text-yellow-300 border border-yellow-400/50 shadow-xl whitespace-nowrap mt-1 flex items-center gap-1 backdrop-blur-xs">
                    <span>💬</span>
                    <span>{item.senderName}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Elimination Overlay over the Saved Dice Area for Multiplayer Online & Friends Challenge */}
          {showMultiplayerElimOverlay && (
            <div
              id="eliminated-saved-dice-overlay"
              className="absolute inset-0 z-30 flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-[#140e0a]/95 border-2 border-[#e58a1f] shadow-2xl backdrop-blur-xs text-center animate-scale-up select-none"
            >
              <div className="text-3xl sm:text-4xl mb-1.5 drop-shadow-md">
                🚫
              </div>
              <h2 className="text-base sm:text-lg md:text-xl font-black text-white tracking-wide mb-1 drop-shadow-md">
                You have been eliminated!
              </h2>

              {eliminatedPrize > 0 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 font-bold text-xs sm:text-sm mb-3 shadow-xs">
                  <span>🪙</span>
                  <span>You won {eliminatedPrize} coins in this game!</span>
                </div>
              ) : (
                <p className="text-[11px] sm:text-xs text-stone-300 mb-3 max-w-[260px] leading-snug">
                  You can stay to watch the remaining players or exit to the main menu.
                </p>
              )}

              <div className="flex flex-row items-center justify-center gap-2 sm:gap-3 w-full max-w-[280px]">
                <button
                  id="btn-stay-and-watch"
                  onClick={() => setHasDismissedElimOverlay(true)}
                  className="flex-1 py-2 sm:py-2.5 px-3 bg-[#28974a] hover:bg-[#22803e] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer border-b-2 border-[#185e2e]"
                >
                  Stay and Watch
                </button>
                <button
                  id="btn-exit-room"
                  onClick={handleEliminationExit}
                  className="flex-1 py-2 sm:py-2.5 px-3 bg-[#8c745e] hover:bg-[#735d49] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer border-b-2 border-[#5c4a3a]"
                >
                  Exit Room
                </button>
              </div>
            </div>
          )}

          {/* Elimination Overlay over the Saved Dice Area for Play vs Computer */}
          {showVsCpuElimOverlay && (
            <div
              id="eliminated-saved-dice-overlay-cpu"
              className="absolute inset-0 z-30 flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-[#140e0a]/95 border-2 border-[#e58a1f] shadow-2xl backdrop-blur-xs text-center animate-scale-up select-none"
            >
              <div className="text-3xl sm:text-4xl mb-1.5 drop-shadow-md">
                🚫
              </div>
              <h2 className="text-base sm:text-lg md:text-xl font-black text-white tracking-wide mb-1 drop-shadow-md">
                You have been eliminated!
              </h2>

              {eliminatedPrize > 0 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 font-bold text-xs sm:text-sm mb-3 shadow-xs">
                  <span>🪙</span>
                  <span>You won {eliminatedPrize} coins in this game!</span>
                </div>
              ) : (
                <p className="text-[11px] sm:text-xs text-stone-300 mb-3 max-w-[260px] leading-snug">
                  You're out — the CPUs are still playing!
                </p>
              )}

              <div className="flex flex-row items-center justify-center gap-2 sm:gap-3 w-full max-w-[290px]">
                <button
                  id="btn-speed-to-finish"
                  onClick={() => {
                    setSpectatorChoiceMade(true);
                    setSpectatorFastForward(true);
                  }}
                  className="flex-1 py-2 sm:py-2.5 px-2.5 bg-[#28974a] hover:bg-[#22803e] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer border-b-2 border-[#185e2e] whitespace-nowrap"
                >
                  Speed to finish
                </button>
                <button
                  id="btn-exit-game"
                  onClick={handleEliminationExit}
                  className="flex-1 py-2 sm:py-2.5 px-2.5 bg-[#8c745e] hover:bg-[#735d49] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer border-b-2 border-[#5c4a3a] whitespace-nowrap"
                >
                  Exit Game
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Active Roll Area - Compact, fits dice compactly */}
        <div className="shrink-0 flex flex-col justify-center">
          {/* Battle to Survive Status Banner during Roll-Off */}
          {tiebreaker && (
            <div className="w-full bg-gradient-to-r from-red-950 via-[#750808] to-red-950 border-2 border-red-500 rounded-xl p-2 mb-1 text-center shadow-lg animate-fade-in shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-600/70 border border-yellow-400 text-yellow-300 font-black text-xs uppercase tracking-wider shadow-sm mb-1">
                <Swords className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                <span>⚡ BATTLE TO SURVIVE — ROUND {tiebreaker.roundNumber} ⚡</span>
              </div>
              <p className="text-xs text-white font-bold">
                {tiedCurrentUnit?.name}'s Turn (3 rolls to build your best outcome)
              </p>
              {tiebreaker.noticeMsg && (
                <p className="text-[11px] text-yellow-300 font-black mt-1 animate-pulse">
                  {tiebreaker.noticeMsg}
                </p>
              )}
            </div>
          )}

          <RollArea
            dice={dice}
            rollsUsed={rollsUsed}
            rollSlotsCount={rollSlotsCount}
            isCPU={isEffectiveCPU}
            isHumanOwner={isEffectiveHuman}
            isRemoteHuman={isEffectiveRemote}
            joiningCountdown={joiningCountdown}
            playerName={(tbActive ? tiedCurrentUnit?.name : curUnit?.name) || 'Player'}
            isRolling={isRolling}
            onTapActiveDie={handleTapActive}
            onDoRoll={doRoll}
            spectatorState={{
              isUserOut: isHumanOut,
              choiceMade: spectatorChoiceMade,
              fastForwarding: spectatorFastForward,
              onShowFinalScore: () => {
                setSpectatorChoiceMade(true);
                setSpectatorFastForward(true);
              },
              onLetPlayersFinish: () => {
                setSpectatorChoiceMade(true);
              },
            }}
          />
        </div>
      </div>

      {/* Floating Emoji Reactions Layer */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        {floatingEmotes.map(emote => (
          <div
            key={emote.id}
            className="absolute flex flex-col items-center animate-bounce-subtle pointer-events-none transition-all duration-700"
            style={{
              left: `${emote.x}px`,
              top: `${emote.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="text-3xl sm:text-4xl filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
              {emote.emoji}
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/80 text-white border border-white/20 whitespace-nowrap mt-1 shadow-md">
              {emote.senderName}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom Controls Area (Fixed at bottom) */}
      <div className="shrink-0 flex flex-col gap-0.5 sm:gap-1 pt-0.5 pb-1">
        {tiebreaker?.phase === 'blinking' ? (
          <div className="w-full min-h-[42px] sm:min-h-[46px] py-2 px-3 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 text-stone-950 font-black text-xs sm:text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 border-2 border-yellow-200 animate-pulse">
            <Swords className="w-4 h-4 text-stone-950" />
            <span>Advancing boards blinking! Preparing results…</span>
          </div>
        ) : (
          /* Normal Action Buttons: ROLL, SCORE IT!, and REACT */
          <div className="flex gap-1.5 sm:gap-2 py-0.5">
            <button
              onClick={doRoll}
              disabled={!canRoll}
              className={`flex-1 min-h-[42px] sm:min-h-[46px] py-1.5 sm:py-2 px-2 bg-[#28974a] hover:bg-[#22803e] disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1 sm:gap-1.5 border-b-2 border-[#185e2e] ${
                isTimeRunningOut
                  ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-black/50 animate-pulse bg-red-700 hover:bg-red-800'
                  : rollsUsed === 0 && isEffectiveHuman && !isEffectiveCPU && (joiningCountdown === null || joiningCountdown <= 0)
                  ? 'ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/40 animate-pulse shadow-[0_0_12px_rgba(242,193,78,0.5)]'
                  : ''
              }`}
            >
              {joiningCountdown !== null && joiningCountdown > 0 ? (
                <span>⏳ Waiting for players ({joiningCountdown}s)</span>
              ) : isEffectiveRemote ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white/80" />
                  <span>Waiting for {effectivePlayerName}…</span>
                  {turnSecondsLeft <= 5 && turnSecondsLeft > 0 && (
                    <span className="ml-1 bg-yellow-400 text-black text-[10px] md:text-xs font-mono font-black px-1.5 py-0.2 rounded-full">
                      ⚠️ {turnSecondsLeft}s
                    </span>
                  )}
                </span>
              ) : (
                <>
                  <span>{rollsUsed === 0 ? '🎲 ROLL' : 'Rolls'}</span>
                  {rollsUsed > 0 && (
                    <span className="text-[11px] md:text-xs font-mono font-normal opacity-90">
                      - {Math.max(0, 3 - rollsUsed)} left
                    </span>
                  )}
                  {isTimeRunningOut && (
                    <span className="ml-1 bg-yellow-400 text-black text-[10px] md:text-xs font-mono font-black px-1.5 py-0.2 rounded-full animate-bounce">
                      ⚠️ {turnSecondsLeft}s!
                    </span>
                  )}
                </>
              )}
            </button>

            <button
              id="score-it-button"
              onClick={bankTurn}
              disabled={!canScore}
              className="flex-1 min-h-[42px] sm:min-h-[46px] py-1 sm:py-1.5 px-2 bg-[#e58a1f] hover:bg-[#cb7512] disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl shadow-md transition-transform active:scale-98 flex flex-col items-center justify-center leading-tight border-b-2 border-[#a65d0a]"
            >
              <span className="font-black text-xs sm:text-sm tracking-wide">
                SCORE IT -
              </span>
              <span className="font-normal text-[10px] sm:text-xs text-white/95 leading-none mt-0.5">
                {scoreResult.total} Points
              </span>
            </button>

            {/* React Button replacing Info button */}
            <button
              id="react-button"
              onClick={handleOpenReactOverlay}
              className="py-2 sm:py-2.5 px-3 sm:px-4 bg-[#e8dec0] hover:bg-[#ded1af] text-[#3e2e1e] font-black text-xs sm:text-sm rounded-xl shadow-md transition-transform active:scale-98 flex items-center justify-center border-b-2 border-[#c8bc9a] tracking-wider"
              title="React with emojis"
            >
              React
            </button>
          </div>
        )}

        {/* Hint tip text */}
        <div className="text-center text-[10px] sm:text-[11px] text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mt-0.5 font-medium">
          {joiningCountdown !== null && joiningCountdown > 0
            ? '⏳ Waiting for all players to join before starting round 1…'
            : tbActive
            ? (isEffectiveHuman
              ? <span className="text-[#f2c14e] font-bold animate-pulse">👉 Your turn in Battle to Survive! Build and match your best score in 3 rolls</span>
              : `⚔️ ${tiedCurrentUnit?.name}'s turn in Battle to Survive. Lowest score is eliminated.`)
            : isRemoteHuman
            ? `⏳ ${curUnit?.name}'s turn — waiting for their roll…`
            : isCPU
            ? `🤖 ${curUnit?.name} is thinking…`
            : rollsUsed === 0
              ? <span className="text-[#f2c14e] font-bold animate-pulse">👉 Your turn! Tap ROLL to roll all 12 dice</span>
              : savedDice.length === 0
                ? 'Tap matching dice (3+ of a symbol) to save them'
                : 'Saved dice are safe. Tap a saved die to send it back.'}
        </div>

        {/* Bottom Ad Banner */}
        <div className="mt-0.5 py-0.5 px-2.5 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between text-xs text-white/70">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-black bg-white/20 text-white px-1 py-0.2 rounded">AD</span>
            <span className="text-[10px] sm:text-[11px] font-medium truncate">Go ad-free for $2.99/mo</span>
          </div>
          <button
            onClick={onOpenMenu}
            className="text-[10px] font-bold text-[#f2c14e] hover:underline cursor-pointer ml-2 shrink-0"
          >
            Upgrade
          </button>
        </div>
      </div>

      {/* React Emoji Reaction Overlay (10s timer per user specification) */}
      <AnimatePresence>
        {isReactOverlayOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none"
            onClick={() => setIsReactOverlayOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.88, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.88, y: 20 }}
              transition={{ type: 'spring', damping: 24, stiffness: 350 }}
              className="bg-[#182030] border-2 border-[#f2c14e] rounded-3xl p-4 sm:p-5 max-w-xs sm:max-w-sm w-full text-white shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              {/* Header with Title, 10s Timer Pill, and Close Button */}
              <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💬</span>
                  <h3 className="text-sm sm:text-base font-black text-[#f2c14e] uppercase tracking-wider">
                    React
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono font-black text-xs px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                      reactTimeRemaining <= 3
                        ? 'bg-red-500/30 text-red-300 border-red-400 animate-pulse'
                        : 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                    }`}
                  >
                    <span>⏱️</span>
                    <span>{reactTimeRemaining}s</span>
                  </span>
                  <button
                    onClick={() => setIsReactOverlayOpen(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Subtitle instructions */}
              <p className="text-[11px] sm:text-xs text-stone-300 text-center mb-3">
                Select an emoji to send to the saved dice area:
              </p>

              {/* Emoji Options Grid */}
              <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
                {REACT_EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelectReactEmoji(emoji)}
                    className="aspect-square flex items-center justify-center rounded-2xl bg-white/10 hover:bg-[#f2c14e]/25 hover:border-[#f2c14e] border border-white/15 text-2xl sm:text-3xl transition-all active:scale-125 cursor-pointer shadow-md"
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* 10-second Countdown Progress Bar */}
              <div className="w-full bg-black/40 h-1.5 rounded-full mt-4 overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(reactTimeRemaining / 10) * 100}%` }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info / Scoring Rules Modal */}
      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="bg-[#1c2436] border-2 border-[#f2c14e] rounded-3xl p-5 max-w-sm w-full text-white shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-black text-[#f2c14e] mb-3 text-center uppercase tracking-wider">
              🎲 Scoring Rules
            </h3>
            <div className="space-y-2 text-xs text-stone-200">
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="font-bold text-white">3+ Matching Symbols:</span>
                <p className="text-[11px] text-stone-300 mt-0.5">
                  Save 3, 4, 5, or 6 of any face symbol to score points (sum of face values).
                </p>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="font-bold text-[#54e38e]">Color Run Bonus (2x):</span>
                <p className="text-[11px] text-stone-300 mt-0.5">
                  If 3 or more of your saved matching dice share the same color, you earn DOUBLE points!
                </p>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="font-bold text-[#f2c14e]">6-of-a-Kind Color Run:</span>
                <p className="text-[11px] text-stone-300 mt-0.5">
                  Rolling all 6 dice of the exact same color and symbol triggers the 500-point jackpot!
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowInfoModal(false)}
              className="mt-4 w-full py-2.5 bg-[#28974a] hover:bg-[#22803e] text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </div>
      )}


      {/* Player Avatar Profile / Add Friend Modal */}
      {selectedPlayerForProfile && (
        <PlayerProfileModal
          player={selectedPlayerForProfile}
          user={user}
          isFriend={friends.some(
            f => f.name.toLowerCase() === selectedPlayerForProfile.name.toLowerCase()
          )}
          onAddFriend={handleAddFriend}
          onRemoveFriend={handleRemoveFriend}
          onClose={() => setSelectedPlayerForProfile(null)}
        />
      )}

      {/* Elimination Modal Announcement with 5-second countdown on button */}
      {elimModalMsg && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none animate-fade-in"
          onClick={handleDismissElimModal}
        >
          <div 
            className="w-full max-w-sm bg-[#faf4e6] border-2 border-[#e5352f] rounded-2xl p-5 shadow-2xl text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-3xl mb-1">⚔️</div>
            <h3 className="text-xl font-black text-[#e5352f] mb-2">Elimination Round!</h3>
            <p className="text-xs text-[#4a3622] leading-relaxed mb-4">{elimModalMsg}</p>
            <button
              onClick={handleDismissElimModal}
              className="w-full py-3 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-black text-sm rounded-xl shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer border-b-2 border-[#1c6a35]"
            >
              <span>Begin Elimination Round</span>
              <span className="bg-black/30 px-2 py-0.5 rounded-full text-xs font-mono font-black text-yellow-300">
                ({elimCountdown}s)
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Battle to Survive Theatrical Red Curtain */}
      <BattleVideoOverlay
        isVisible={tiebreaker?.phase === 'intro' || tiebreaker?.phase === 'outro'}
        phase={tiebreaker?.phase ?? null}
        eliminatedPlayerName={tiebreaker?.eliminatedUnitId ? tbNameOf(tiebreaker.eliminatedUnitId) : undefined}
        onIntroComplete={handleTiebreakerIntroComplete}
        onOutroComplete={handleTiebreakerOutroComplete}
      />

      {/* Floating Score Bubble Animation (when user or CPU banks score) */}
      <ScoreBubbleAnimation
        bubble={activeScoreBubble}
        onPop={() => setActiveScoreBubble(null)}
      />
    </div>
  );
};

