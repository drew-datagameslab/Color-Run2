import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiceColor, Die, GamePhase, GameSettings, PlayerUnit, ScoreResult, UserAccount, Friend } from '../types/game';
import { scoreDice } from '../lib/scoring';
import { decideCPUSaves } from '../lib/cpu';
import { resolveElimination } from '../lib/elimination';
import { playSfx, playWarning5sSound, stopWarningSound, playSwordSlashSound, startBattleMusic, stopBattleMusic, playRollDiceSound } from '../lib/audio';
import { triggerTurnHaptic } from '../lib/haptics';
import { getLocalFriends, addFriend, removeFriend } from '../lib/friends';
import { CardsStrip } from './CardsStrip';
import { SavedBoard } from './SavedBoard';
import { RollArea } from './RollArea';
import { PlayerProfileModal } from './PlayerProfileModal';
import { BattleToSurviveCurtain } from './BattleToSurviveCurtain';
import { BattleToSurviveGraphic } from './BattleToSurviveGraphic';
import { Loader2, Swords } from 'lucide-react';
import { subscribeToRoom, markPlayerLeft, updateRoomGameState, getClientSessionId } from '../lib/matchmaking';
import { calculatePayouts } from './PickGameScreen';

interface PlayScreenProps {
  settings: GameSettings;
  user: UserAccount;
  onGameOver: (winner: PlayerUnit, units: PlayerUnit[]) => void;
  onOpenMenu: () => void;
  onAwardPrize?: (amount: number, place: number) => void;
  onExitGame: (prizeWon?: number) => void;
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
}) => {
  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || [settings.colorA, settings.colorB];

  // Friends challenge detection
  const isFriendsChallenge =
    settings.mode === 'challenge' ||
    settings.mode === 'challenge_friend' ||
    Boolean((settings as any).isChallenge);

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
        isOnlinePlayer: !isLocalUser && isHuman,
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

  const triggerEliminatedBanner = useCallback((playerName: string) => {
    setEliminationBannerUnderLabels(`${playerName} has been eliminated!`);
    playSwordSlashSound();
    setTimeout(() => {
      setEliminationBannerUnderLabels(null);
    }, 6000);
  }, []);

  // Battle to Survive Roll-Off Tiebreaker State
  const [tiebreakerState, setTiebreakerState] = useState<{
    isActive: boolean;
    phase: 'intro' | 'rolling' | 'outro' | null;
    tiedUnitIds: string[];
    activeTiedIndex: number;
    rollScores: Record<string, number>;
    eliminatedUnit: PlayerUnit | null;
    roundNumber: number;
    noticeMsg: string | null;
    hasRolledCurrentTurn: boolean;
    lastRollTotal: number | null;
  }>({
    isActive: false,
    phase: null,
    tiedUnitIds: [],
    activeTiedIndex: 0,
    rollScores: {},
    eliminatedUnit: null,
    roundNumber: 1,
    noticeMsg: null,
    hasRolledCurrentTurn: false,
    lastRollTotal: null,
  });

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
    const res = await addFriend(user.uid, {
      name: player.name,
      color: player.color,
      image: player.image,
    });
    setFriends(res.friends);
    setToastMsg(res.message);
  };

  const handleRemoveFriend = async (playerName: string) => {
    const target = friends.find(f => f.name.toLowerCase() === playerName.toLowerCase());
    if (target) {
      const updated = await removeFriend(user.uid, target.id);
      setFriends(updated);
      setToastMsg(`Removed ${playerName} from friends.`);
    }
  };

  // Spectator mode states
  const [spectatorChoiceMade, setSpectatorChoiceMade] = useState(false);
  const [spectatorFastForward, setSpectatorFastForward] = useState(false);

  // Queue of active player units
  const activeUnits = units.filter(u => u.active);
  const curUnit = activeUnits[qIdx] || activeUnits[0];
  const isHumanOwner = curUnit ? (curUnit.isOwner && !curUnit.isCPU) : false;
  const isRemoteHuman = curUnit ? (!curUnit.isOwner && curUnit.isOnlinePlayer && !curUnit.isCPU) : false;
  const isCPU = curUnit ? (curUnit.isCPU || isAutoPilotTurn) : false;

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

  // Vibration when it is the user's turn in Multiplayer, vs Computer and Friends Challenge games
  const prevIsHumanOwnerRef = useRef(false);
  useEffect(() => {
    if (isHumanOwner && !prevIsHumanOwnerRef.current && phase !== 'over') {
      triggerTurnHaptic();
    }
    prevIsHumanOwnerRef.current = isHumanOwner;
  }, [isHumanOwner, curUnit?.id, phase]);

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
              onGameOver(winner, prev);
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
          } else if (gs.lastAction === 'bank' || gs.lastAction === 'elimination' || gs.lastAction === 'phase_change') {
            if (rollAnimTimeoutRef.current) {
              clearTimeout(rollAnimTimeoutRef.current);
              rollAnimTimeoutRef.current = null;
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
            onGameOver(winner, prev);
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

      if (curUnit.isOwner && !curUnit.isCPU) {
        // User turn alert chime & toast alert
        playSfx('add');
        showToast('👉 Your Turn! Tap ROLL');
      }
    }
  }, [curUnit, round, ROLL_1_TIME, userDiceColors]);

  // Turn countdown timer (active when additional users are in the room):
  // 30s on roll 1, 20s on rolls 2 & 3 in multiplayer
  useEffect(() => {
    if (
      !isTimerEnabled ||
      (!isHumanOwner && !isRemoteHuman) ||
      isAutoPilotTurn ||
      isRolling ||
      elimModalMsg ||
      (joiningCountdown !== null && joiningCountdown > 0)
    ) {
      stopWarningSound();
      return;
    }

    // Play 5-second countdown warning audio when timer reaches 5 seconds (only for local human player)
    if (turnSecondsLeft === 5 && isHumanOwner) {
      playWarning5sSound();
    }

    if (isHumanOwner && turnSecondsLeft <= 0) {
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

    if (isRemoteHuman && isTurnAuthority && turnSecondsLeft <= -15) {
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
        else if (tier === 5) playSfx('s5');
        else if (tier === 6) {
          playSfx('s6');
          setShowSixCelebration(true);
          triggeredSix = true;
        }
      }
    }
    setAnnouncedChimes({ ...announcedChimesRef.current });
    return triggeredSix;
  }, []);

  // Roll dice action: re-slots active dice and locks final values when animation completes
  const doRoll = () => {
    stopWarningSound();
    if (rollsUsed >= 3 || isRolling) return;
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
    if (settings.roomId && (isHumanOwner || (isCPU && isTurnAuthority))) {
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

    setIsRolling(true);

    // Rapid random shuffle during roll tumble animation
    const shuffleTimer = setInterval(() => {
      setDice(prev =>
        prev.map(d => {
          if (d.zone === 'active' && activeIds.has(d.id)) {
            return {
              ...d,
              value: Math.floor(Math.random() * 6) + 1,
            };
          }
          return d;
        })
      );
    }, 60);

    const rollDuration = spectatorFastForward ? 120 : 1100;
    const lockPreTime = spectatorFastForward ? 60 : 800;

    // Phase 1: Pre-lock true final values while the dice are still actively tumbling.
    setTimeout(() => {
      clearInterval(shuffleTimer);
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
      clearInterval(shuffleTimer);
      setDice(finalDice);
      setRollsUsed(nextRoll);

      // Human player gets time for rolls 2 & 3 (20s in multiplayer, 10s otherwise)
      if (isHumanOwner && !isCPU) {
        setTurnSecondsLeft(ROLL_2_3_TIME);
      }
      setIsRolling(false);
    }, rollDuration);
  };

  // Tapping active die: moves matching set to saved area.
  // Stops warning sound immediately, resets timer, and leaves original slot space blank in rolling area!
  const handleTapActive = (id: number) => {
    if (!isHumanOwner || isCPU || rollsUsed === 0 || isRolling) return;
    if (joiningCountdown !== null && joiningCountdown > 0) return;

    // Stop warning sound immediately and reset turn timer when user moves dice!
    stopWarningSound();
    if (isHumanOwner && !isCPU) {
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
      if (settings.roomId && isHumanOwner) {
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
    } else {
      setDice(updated);
    }
  };

  // Tapping saved die sends it back to active area into a vacant slot. Resets timer & stops warning sound!
  const handleTapSaved = (id: number) => {
    if (!isHumanOwner || isCPU || isRolling) return;
    if (joiningCountdown !== null && joiningCountdown > 0) return;

    // Stop warning sound immediately and reset turn timer when user moves dice!
    stopWarningSound();
    if (isHumanOwner && !isCPU) {
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

    if (settings.roomId && isHumanOwner) {
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
    if (!curUnit) return;
    const canAct = (curUnit.isOwner ?? false) || (curUnit.isCPU && isTurnAuthority) || (isRemoteHuman && isTurnAuthority && turnSecondsLeft <= -15);
    if (!canAct) return;
    if (joiningCountdown !== null && joiningCountdown > 0) return;

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
    playSfx('add');

    // Update player score & history
    const updatedUnits = units.map(u => {
      if (u.id === curUnit.id) {
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
  }, [curUnit, dice, qIdx, round, phase, settings.colorA, settings.colorB, units, userDiceColors, checkBonusChimes, showSixCelebration, isTurnAuthority]);

  doRollRef.current = doRoll;
  bankTurnRef.current = bankTurn;

  // Round resolution (checking threshold or doing elimination)
  const resolveRound = (currentUnits: PlayerUnit[]) => {
    const liveUnits = currentUnits.filter(u => u.active);

    if (phase === 'regular') {
      const thresholdReached = liveUnits.some(u => u.score >= settings.threshold);
      if (thresholdReached) {
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
        if (liveUnits[0]?.isOwner && !liveUnits[0]?.isCPU) {
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
      if (liveUnits[0]?.isOwner && !liveUnits[0]?.isCPU) {
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
      // Elimination phase: check if there is a tie for the lowest total score!
      const minScore = Math.min(...liveUnits.map(u => u.score));
      const tiedForLowest = liveUnits.filter(u => u.score === minScore);
      const isTwoPlayerTie = liveUnits.length === 2 && liveUnits[0].score === liveUnits[1].score;

      if (isTwoPlayerTie || tiedForLowest.length > 1) {
        // Trigger BATTLE TO SURVIVE TIEBREAKER!
        const participating = isTwoPlayerTie ? liveUnits : tiedForLowest;
        setTiebreakerState({
          isActive: true,
          phase: 'intro',
          tiedUnitIds: participating.map(u => u.id),
          activeTiedIndex: 0,
          rollScores: {},
          eliminatedUnit: null,
          roundNumber: 1,
          noticeMsg: null,
          hasRolledCurrentTurn: false,
          lastRollTotal: null,
        });
        startBattleMusic();
        return;
      }

      // No tie: single lowest score player is eliminated
      const lowestUnit = tiedForLowest[0];
      const remainingAfterElim = liveUnits.length - 1;

      const finalizedUnits = currentUnits.map(u => {
        if (u.id === lowestUnit.id) {
          return { ...u, active: false, place: remainingAfterElim + 1 };
        }
        return u;
      });

      setUnits(finalizedUnits);
      triggerEliminatedBanner(lowestUnit.name);

      const survivors = finalizedUnits.filter(u => u.active);
      if (survivors.length <= 1) {
        // We have a winner!
        const winner = survivors[0] || currentUnits[0];
        winner.place = 1;

        if (settings.roomId) {
          const scoresRecord: Record<string, number> = {};
          const histRecord: Record<string, Record<number, number>> = {};
          finalizedUnits.forEach(u => {
            scoresRecord[u.id] = u.score;
            histRecord[u.id] = u.history;
          });
          const unitStatus = buildUnitStatusRecord(finalizedUnits);
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
            lastAction: 'elimination',
            lastActionBy: user.uid,
            actionTimestamp: Date.now(),
          });
        }

        onGameOver(winner, finalizedUnits);
        return;
      }

      // Show elimination toast
      showToast(`⚔️ Round complete: ${lowestUnit.name} knocked out!`);

      const nextRound = round + 1;
      setRound(nextRound);
      setQIdx(0);
      setRollsUsed(0);
      setRollSlotsCount(12);
      const [c1, c2] = getUnitDiceColors(survivors[0], userDiceColors);
      const nextDice = createInitialDice(c1, c2);
      setDice(nextDice);
      if (survivors[0]?.isOwner && !survivors[0]?.isCPU) {
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
          lastAction: 'elimination',
          lastActionBy: user.uid,
          actionTimestamp: Date.now(),
        });
      }
    }
  };

  // =========================================================================
  // Battle to Survive Roll-Off Tiebreaker Handlers
  // =========================================================================
  const handleTiebreakerIntroComplete = useCallback(() => {
    // 2-second intro curtain finished: raise curtain and show tiebreaker rolling screen
    setTiebreakerState(prev => {
      const firstTiedUnit = units.find(u => u.id === prev.tiedUnitIds[0]);
      if (firstTiedUnit) {
        const [c1, c2] = getUnitDiceColors(firstTiedUnit, userDiceColors);
        setDice(createInitialDice(c1, c2));
      }
      return {
        ...prev,
        phase: 'rolling',
        activeTiedIndex: 0,
        rollScores: {},
        hasRolledCurrentTurn: false,
        lastRollTotal: null,
      };
    });
  }, [units, userDiceColors]);

  const handleDoTiebreakerRoll = useCallback(() => {
    if (!tiebreakerState.isActive || tiebreakerState.phase !== 'rolling' || tiebreakerState.hasRolledCurrentTurn) return;

    const currentTiedId = tiebreakerState.tiedUnitIds[tiebreakerState.activeTiedIndex];
    const currentUnit = units.find(u => u.id === currentTiedId);
    if (!currentUnit) return;

    // 12 dice roll one time
    const [c1, c2] = getUnitDiceColors(currentUnit, userDiceColors);
    const rolledDice: Die[] = [];
    for (let i = 1; i <= 6; i++) {
      rolledDice.push({
        id: i,
        color: c1,
        value: Math.floor(Math.random() * 6) + 1,
        zone: 'active',
        selected: false,
        slotIndex: rolledDice.length,
      });
    }
    for (let i = 7; i <= 12; i++) {
      rolledDice.push({
        id: i,
        color: c2,
        value: Math.floor(Math.random() * 6) + 1,
        zone: 'active',
        selected: false,
        slotIndex: rolledDice.length,
      });
    }
    setDice(rolledDice);
    playRollDiceSound();

    // Calculate score: scored points from valid sets or pip sum if 0
    const scoredPts = scoreDice(rolledDice).total;
    const pipSum = rolledDice.reduce((acc, d) => acc + d.value, 0);
    const finalTotal = scoredPts > 0 ? scoredPts : pipSum;

    setTiebreakerState(prev => ({
      ...prev,
      hasRolledCurrentTurn: true,
      lastRollTotal: finalTotal,
    }));
  }, [tiebreakerState, units, userDiceColors]);

  const handleConfirmTiebreakerRoll = useCallback((scoreVal?: number) => {
    if (!tiebreakerState.isActive || tiebreakerState.phase !== 'rolling' || !tiebreakerState.hasRolledCurrentTurn) return;

    const currentTiedId = tiebreakerState.tiedUnitIds[tiebreakerState.activeTiedIndex];
    const finalScore = scoreVal !== undefined ? scoreVal : (tiebreakerState.lastRollTotal || 0);
    const updatedScores = {
      ...tiebreakerState.rollScores,
      [currentTiedId]: finalScore,
    };

    const nextIdx = tiebreakerState.activeTiedIndex + 1;
    if (nextIdx < tiebreakerState.tiedUnitIds.length) {
      // Advance to next tied player
      const nextUnit = units.find(u => u.id === tiebreakerState.tiedUnitIds[nextIdx]);
      if (nextUnit) {
        const [c1, c2] = getUnitDiceColors(nextUnit, userDiceColors);
        setDice(createInitialDice(c1, c2));
      }
      setTiebreakerState(prev => ({
        ...prev,
        activeTiedIndex: nextIdx,
        rollScores: updatedScores,
        hasRolledCurrentTurn: false,
        lastRollTotal: null,
      }));
      return;
    }

    // All participating tied players have rolled! Evaluate results:
    const tiedUnits = units.filter(u => tiebreakerState.tiedUnitIds.includes(u.id));
    const minRoll = Math.min(...tiedUnits.map(u => updatedScores[u.id]));
    const lowestRollUnits = tiedUnits.filter(u => updatedScores[u.id] === minRoll);

    if (lowestRollUnits.length === 1) {
      // Single lowest player eliminated! Red curtain will return and show for 3 seconds
      const eliminated = lowestRollUnits[0];
      setTiebreakerState(prev => ({
        ...prev,
        phase: 'outro',
        eliminatedUnit: eliminated,
        rollScores: updatedScores,
      }));
      stopBattleMusic();
      return;
    }

    // Tie-breakers rule:
    // If three are tied, and 1 user gets highest while other two tied, highest advances, other two roll again.
    // In general: if some players scored higher than minRoll, those higher advance, and the tied lowest roll again!
    if (lowestRollUnits.length < tiedUnits.length) {
      const advancingUnits = tiedUnits.filter(u => updatedScores[u.id] > minRoll);
      const advancingNames = advancingUnits.map(u => u.name).join(', ');
      const firstUnit = units.find(u => u.id === lowestRollUnits[0].id);
      if (firstUnit) {
        const [c1, c2] = getUnitDiceColors(firstUnit, userDiceColors);
        setDice(createInitialDice(c1, c2));
      }
      setTiebreakerState(prev => ({
        ...prev,
        tiedUnitIds: lowestRollUnits.map(u => u.id),
        activeTiedIndex: 0,
        rollScores: {},
        roundNumber: prev.roundNumber + 1,
        noticeMsg: `${advancingNames} advance! ${lowestRollUnits.map(u => u.name).join(' & ')} remain tied and roll again!`,
        hasRolledCurrentTurn: false,
        lastRollTotal: null,
      }));
      playSfx('s3');
      return;
    }

    // All remaining tied players had the exact same score: roll again!
    const firstUnit = units.find(u => u.id === tiebreakerState.tiedUnitIds[0]);
    if (firstUnit) {
      const [c1, c2] = getUnitDiceColors(firstUnit, userDiceColors);
      setDice(createInitialDice(c1, c2));
    }
    setTiebreakerState(prev => ({
      ...prev,
      activeTiedIndex: 0,
      rollScores: {},
      roundNumber: prev.roundNumber + 1,
      noticeMsg: `Still tied (${minRoll} pts)! Roll again!`,
      hasRolledCurrentTurn: false,
      lastRollTotal: null,
    }));
    playSfx('add');
  }, [tiebreakerState, units, userDiceColors]);

  const handleTiebreakerOutroComplete = useCallback(() => {
    stopBattleMusic();
    const eliminated = tiebreakerState.eliminatedUnit;
    setTiebreakerState({
      isActive: false,
      phase: null,
      tiedUnitIds: [],
      activeTiedIndex: 0,
      rollScores: {},
      eliminatedUnit: null,
      roundNumber: 1,
      noticeMsg: null,
      hasRolledCurrentTurn: false,
      lastRollTotal: null,
    });

    if (!eliminated) return;

    const remainingActive = units.filter(u => u.active && u.id !== eliminated.id);
    const place = remainingActive.length + 1;
    const finalizedUnits = units.map(u =>
      u.id === eliminated.id ? { ...u, active: false, place } : u
    );

    setUnits(finalizedUnits);
    triggerEliminatedBanner(eliminated.name);

    if (remainingActive.length <= 1) {
      const winner = remainingActive[0] || finalizedUnits[0];
      winner.place = 1;
      onGameOver(winner, finalizedUnits);
    } else {
      const nextRound = round + 1;
      setRound(nextRound);
      setQIdx(0);
      setRollsUsed(0);
      setRollSlotsCount(12);
      const [c1, c2] = getUnitDiceColors(remainingActive[0], userDiceColors);
      setDice(createInitialDice(c1, c2));
      if (remainingActive[0]?.isOwner && !remainingActive[0]?.isCPU) {
        setTurnSecondsLeft(ROLL_1_TIME);
        setIsAutoPilotTurn(false);
      }
    }
  }, [tiebreakerState.eliminatedUnit, units, round, userDiceColors, onGameOver, triggerEliminatedBanner]);

  // CPU automated turns during tiebreaker
  useEffect(() => {
    if (!tiebreakerState.isActive || tiebreakerState.phase !== 'rolling') return;
    const currentTiedId = tiebreakerState.tiedUnitIds[tiebreakerState.activeTiedIndex];
    const currentUnit = units.find(u => u.id === currentTiedId);
    if (!currentUnit || !currentUnit.isCPU) return;

    if (!tiebreakerState.hasRolledCurrentTurn) {
      const rollTimer = setTimeout(() => {
        handleDoTiebreakerRoll();
      }, 1200);
      return () => clearTimeout(rollTimer);
    } else {
      const confirmTimer = setTimeout(() => {
        handleConfirmTiebreakerRoll(tiebreakerState.lastRollTotal || 0);
      }, 1600);
      return () => clearTimeout(confirmTimer);
    }
  }, [
    tiebreakerState.isActive,
    tiebreakerState.phase,
    tiebreakerState.activeTiedIndex,
    tiebreakerState.hasRolledCurrentTurn,
    tiebreakerState.lastRollTotal,
    tiebreakerState.tiedUnitIds,
    units,
    handleDoTiebreakerRoll,
    handleConfirmTiebreakerRoll,
  ]);

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
    if (
      !isCPU ||
      !curUnit ||
      isRolling ||
      elimModalMsg ||
      showSixCelebration ||
      (joiningCountdown !== null && joiningCountdown > 0)
    )
      return;

    // In multiplayer: only the designated turn authority client runs the CPU bots!
    if (settings.mode === 'online' && !isTurnAuthority && !isAutoPilotTurn) {
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

        if (settings.roomId && isTurnAuthority) {
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
        // Yield execution! This gives time for the dice to move to the saved area,
        // updates component dice state, and syncs to remote peers.
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
    showSixCelebration,
    joiningCountdown,
    doRoll,
    bankTurn,
    checkBonusChimes,
  ]);

  const canRoll =
    rollsUsed < 3 &&
    dice.filter(d => d.zone === 'active').length > 0 &&
    isHumanOwner &&
    !isCPU &&
    !isRolling &&
    (joiningCountdown === null || joiningCountdown <= 0);

  const canScore =
    (rollsUsed === 3 || dice.filter(d => d.zone === 'active').length === 0) &&
    rollsUsed > 0 &&
    isHumanOwner &&
    !isCPU &&
    (joiningCountdown === null || joiningCountdown <= 0);

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
    onExitGame(eliminatedPrize);
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
      onExitGame(eliminatedPrize);
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
        {/* Logos Row (reduced by 15%) */}
        <div className="flex items-center justify-between px-2 py-0 mb-0.5">
          <img
            src="/assets/img/cr-logo.png"
            alt="Color Run"
            className="h-[66px] sm:h-[75px] object-contain drop-shadow-md select-none"
            draggable={false}
          />
          <img
            src="/assets/img/dg-logo.png"
            alt="Data Games Lab"
            className="h-[75px] sm:h-[83px] object-contain drop-shadow-md select-none"
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
            units={tiebreakerState.isActive && tiebreakerState.phase === 'rolling'
              ? units.filter(u => tiebreakerState.tiedUnitIds.includes(u.id))
              : units}
            activeUnitId={tiebreakerState.isActive && tiebreakerState.phase === 'rolling'
              ? tiebreakerState.tiedUnitIds[tiebreakerState.activeTiedIndex]
              : curUnit?.id}
            currentRound={round}
            isEliminationPhase={phase === 'elimination'}
            isUserTurnToRoll={!tiebreakerState.isActive && isHumanOwner && rollsUsed === 0 && !isAutoPilotTurn && (joiningCountdown === null || joiningCountdown <= 0)}
            onSelectUnit={setSelectedPlayerForProfile}
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
                🤖
              </div>
              <h2 className="text-base sm:text-lg md:text-xl font-black text-white tracking-wide mb-3 drop-shadow-md">
                You're out — the CPUs are still playing!
              </h2>

              <div className="flex flex-row items-center justify-center gap-2 sm:gap-3 w-full max-w-[290px]">
                <button
                  id="btn-speed-to-final-score"
                  onClick={() => {
                    setSpectatorChoiceMade(true);
                    setSpectatorFastForward(true);
                  }}
                  className="flex-1 py-2 sm:py-2.5 px-2.5 bg-[#28974a] hover:bg-[#22803e] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer border-b-2 border-[#185e2e] whitespace-nowrap"
                >
                  Speed to Final Score
                </button>
                <button
                  id="btn-watch-game"
                  onClick={() => {
                    setSpectatorChoiceMade(true);
                  }}
                  className="flex-1 py-2 sm:py-2.5 px-2.5 bg-[#efe3ad] hover:bg-[#e4d69b] text-[#2e2316] font-black text-xs sm:text-sm rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer border-b-2 border-[#cfc38a] whitespace-nowrap"
                >
                  Watch Game
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Active Roll Area - Compact, fits dice compactly */}
        <div className="shrink-0 flex flex-col justify-center">
          {/* Battle to Survive Status Banner during Roll-Off */}
          {tiebreakerState.isActive && tiebreakerState.phase === 'rolling' && (
            <div className="w-full bg-gradient-to-r from-red-950 via-[#750808] to-red-950 border-2 border-red-500 rounded-xl p-2 mb-1 text-center shadow-lg animate-fade-in shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-600/70 border border-yellow-400 text-yellow-300 font-black text-xs uppercase tracking-wider shadow-sm mb-1">
                <Swords className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                <span>⚡ ROLL-OFF FOR SURVIVAL — ROUND {tiebreakerState.roundNumber} ⚡</span>
              </div>
              <p className="text-xs text-white font-bold">
                {units.find(u => u.id === tiebreakerState.tiedUnitIds[tiebreakerState.activeTiedIndex])?.name}'s Roll:{' '}
                {tiebreakerState.hasRolledCurrentTurn ? (
                  <span className="text-yellow-300 font-black">{tiebreakerState.lastRollTotal} Points</span>
                ) : (
                  'Ready to roll 1 time!'
                )}
              </p>
              {tiebreakerState.noticeMsg && (
                <p className="text-[11px] text-yellow-300 font-black mt-1 animate-pulse">
                  {tiebreakerState.noticeMsg}
                </p>
              )}
            </div>
          )}

          <RollArea
            dice={dice}
            rollsUsed={tiebreakerState.isActive && tiebreakerState.phase === 'rolling' ? (tiebreakerState.hasRolledCurrentTurn ? 1 : 0) : rollsUsed}
            rollSlotsCount={rollSlotsCount}
            isCPU={tiebreakerState.isActive && tiebreakerState.phase === 'rolling' ? !!units.find(u => u.id === tiebreakerState.tiedUnitIds[tiebreakerState.activeTiedIndex])?.isCPU : isCPU}
            isHumanOwner={tiebreakerState.isActive && tiebreakerState.phase === 'rolling' ? !!units.find(u => u.id === tiebreakerState.tiedUnitIds[tiebreakerState.activeTiedIndex])?.isOwner && !units.find(u => u.id === tiebreakerState.tiedUnitIds[tiebreakerState.activeTiedIndex])?.isCPU : isHumanOwner}
            isRemoteHuman={tiebreakerState.isActive && tiebreakerState.phase === 'rolling' ? false : isRemoteHuman}
            joiningCountdown={joiningCountdown}
            playerName={tiebreakerState.isActive && tiebreakerState.phase === 'rolling' ? (units.find(u => u.id === tiebreakerState.tiedUnitIds[tiebreakerState.activeTiedIndex])?.name || 'Player') : (curUnit?.name || 'Player')}
            isRolling={isRolling}
            onTapActiveDie={handleTapActive}
            onDoRoll={tiebreakerState.isActive && tiebreakerState.phase === 'rolling' ? handleDoTiebreakerRoll : doRoll}
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

      {/* Bottom Controls Area (Fixed at bottom) */}
      <div className="shrink-0 flex flex-col gap-0.5 sm:gap-1 pt-0.5 pb-1">
        {tiebreakerState.isActive && tiebreakerState.phase === 'rolling' ? (
          /* Tiebreaker Roll-Off Action Controls */
          <div className="py-0.5">
            {(() => {
              const currentTiedUnit = units.find(u => u.id === tiebreakerState.tiedUnitIds[tiebreakerState.activeTiedIndex]);
              const isTiedHuman = currentTiedUnit ? (currentTiedUnit.isOwner && !currentTiedUnit.isCPU) : false;

              if (isTiedHuman) {
                if (!tiebreakerState.hasRolledCurrentTurn) {
                  return (
                    <button
                      onClick={handleDoTiebreakerRoll}
                      className="w-full min-h-[46px] py-2 px-3 bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:brightness-110 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-xl border-b-2 border-red-800 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 animate-pulse"
                    >
                      <Swords className="w-5 h-5 text-yellow-300" />
                      <span>🎲 Roll 1 Time For Survival!</span>
                    </button>
                  );
                } else {
                  return (
                    <button
                      onClick={() => handleConfirmTiebreakerRoll()}
                      className="w-full min-h-[46px] py-2 px-3 bg-[#28974a] hover:bg-[#22803e] text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-xl border-b-2 border-[#185e2e] transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>Confirm Roll ({tiebreakerState.lastRollTotal} pts) ➔</span>
                    </button>
                  );
                }
              }

              return (
                <div className="w-full min-h-[46px] py-2 px-3 bg-black/75 border-2 border-red-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                  <span>
                    {currentTiedUnit?.name} is rolling for survival…
                    {tiebreakerState.hasRolledCurrentTurn && (
                      <span className="text-yellow-300 ml-1.5">({tiebreakerState.lastRollTotal} pts)</span>
                    )}
                  </span>
                </div>
              );
            })()}
          </div>
        ) : (
          /* Normal Action Buttons: ROLL, SCORE IT!, and INFO */
          <div className="flex gap-1.5 sm:gap-2 py-0.5">
            <button
              onClick={doRoll}
              disabled={!canRoll}
              className={`flex-1 min-h-[42px] sm:min-h-[46px] py-1.5 sm:py-2 px-2 bg-[#28974a] hover:bg-[#22803e] disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1 sm:gap-1.5 border-b-2 border-[#185e2e] ${
                isTimeRunningOut
                  ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-black/50 animate-pulse bg-red-700 hover:bg-red-800'
                  : rollsUsed === 0 && isHumanOwner && !isCPU && (joiningCountdown === null || joiningCountdown <= 0)
                  ? 'ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/40 animate-pulse shadow-[0_0_12px_rgba(242,193,78,0.5)]'
                  : ''
              }`}
            >
              {joiningCountdown !== null && joiningCountdown > 0 ? (
                <span>⏳ Waiting for players ({joiningCountdown}s)</span>
              ) : isRemoteHuman ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white/80" />
                  <span>Waiting for {curUnit.name}…</span>
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

            <button
              onClick={() => setShowInfoModal(true)}
              className="py-2 sm:py-2.5 px-3 sm:px-4 bg-[#e8dec0] hover:bg-[#ded1af] text-[#3e2e1e] font-black text-xs sm:text-sm rounded-xl shadow-md transition-transform active:scale-98 flex items-center justify-center border-b-2 border-[#c8bc9a]"
              title="Game Rules & Scoring Info"
            >
              INFO
            </button>
          </div>
        )}

        {/* Hint tip text */}
        <div className="text-center text-[10px] sm:text-[11px] text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mt-0.5 font-medium">
          {joiningCountdown !== null && joiningCountdown > 0
            ? '⏳ Waiting for all players to join before starting round 1…'
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
      <BattleToSurviveCurtain
        isVisible={tiebreakerState.isActive && (tiebreakerState.phase === 'intro' || tiebreakerState.phase === 'outro')}
        phase={tiebreakerState.phase}
        eliminatedPlayerName={tiebreakerState.eliminatedUnit?.name}
        onIntroComplete={handleTiebreakerIntroComplete}
        onOutroComplete={handleTiebreakerOutroComplete}
      />
    </div>
  );
};

