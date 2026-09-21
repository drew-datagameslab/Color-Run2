import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiceColor, Die, GamePhase, GameSettings, PlayerUnit, ScoreResult, UserAccount, Friend } from '../types/game';
import { scoreDice } from '../lib/scoring';
import { decideCPUSaves } from '../lib/cpu';
import { resolveElimination } from '../lib/elimination';
import { playSfx, playWarning5sSound, stopWarningSound } from '../lib/audio';
import { getLocalFriends, addFriend, removeFriend } from '../lib/friends';
import { CardsStrip } from './CardsStrip';
import { SavedBoard } from './SavedBoard';
import { RollArea } from './RollArea';
import { PlayerProfileModal } from './PlayerProfileModal';
import { Loader2 } from 'lucide-react';
import { subscribeToRoom, markPlayerLeft, updateRoomGameState, getClientSessionId } from '../lib/matchmaking';

interface PlayScreenProps {
  settings: GameSettings;
  user: UserAccount;
  onGameOver: (winner: PlayerUnit, units: PlayerUnit[]) => void;
  onOpenMenu: () => void;
  onAwardPrize?: (amount: number, place: number) => void;
  onExitGame: () => void;
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

  // Multiplayer room detection (no host concept: all players are peers in a shared room)
  const isMultiplayer =
    settings.mode === 'online' ||
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
    settings.mode !== 'online' ||
    myToken === turnAuthorityToken ||
    (isRemoteHuman && myToken === fallbackAuthorityToken);

  // Timers are added to keep the games moving when additional Users are in the room.
  // When the user is only playing against computer players (Play vs Computer rooms), no timers are needed.
  const isTimerEnabled = settings.mode === 'online' || settings.slots.some((s, idx) => idx > 0 && s.isOnlinePlayer);

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
    };
  }, []);

  // Auto-dismiss 6-of-a-kind Color Run celebration after animation plays
  useEffect(() => {
    if (!showSixCelebration) return;
    const timer = setTimeout(() => {
      setShowSixCelebration(false);
    }, 3200);
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
    const newAnnounced = { ...announcedChimes };
    for (const k in byVC) {
      const count = byVC[k];
      if (count < 3) continue;
      const tier = Math.min(6, count);
      if (tier > (newAnnounced[k] || 0)) {
        newAnnounced[k] = tier;
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
    setAnnouncedChimes(newAnnounced);
    return triggeredSix;
  }, [announcedChimes]);

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

    setDice(prev => {
      const targetDie = prev.find(d => d.id === id);
      if (!targetDie) return prev;

      const willSelect = !targetDie.selected;
      const val = targetDie.value;

      const updated = prev.map(d => {
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
        return finalized;
      }

      return updated;
    });
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

    setDice(prev => {
      const target = prev.find(d => d.id === id);
      if (!target) return prev;
      const v = target.value;

      // Find occupied slots among active dice
      const activeSlots = new Set(
        prev.filter(d => d.zone === 'active').map(d => d.slotIndex)
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
      const remainingSaved = prev.filter(
        d => d.zone === 'saved' && d.value === v && d.id !== id
      );
      const result = remainingSaved.length < 3
        ? prev.map(d =>
            d.value === v
              ? { ...d, zone: 'active' as const, selected: false, slotIndex: assignSlot(d.slotIndex) }
              : d
          )
        : prev.map(d =>
            d.id === id
              ? { ...d, zone: 'active' as const, selected: false, slotIndex: assignSlot(d.slotIndex) }
              : d
          );

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

      return result;
    });
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
      // Elimination phase: knock out lowest score!
      const countToElim = liveUnits.length > 6 ? 2 : 1;
      const { toElim, log } = resolveElimination(liveUnits, countToElim);

      const remainingAfterElim = liveUnits.length - toElim.length;

      const finalizedUnits = currentUnits.map(u => {
        const eliminatedMatch = toElim.find(e => e.id === u.id);
        if (eliminatedMatch) {
          return { ...u, active: false, place: remainingAfterElim + 1 };
        }
        return u;
      });

      setUnits(finalizedUnits);

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

      // Show elimination toast or notice
      const elimNames = toElim.map(e => e.name).join(', ');
      showToast(`⚔️ Round complete: ${elimNames} knocked out!`);

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

  // Target display logic: target is reached once elimination phase begins or someone hits threshold
  const targetReached = phase === 'elimination' || units.some(u => u.score >= settings.threshold);

  // 5-second warning indicator when turn time is almost up (ONLY active when timers are enabled in room)
  const isTimeRunningOut = isTimerEnabled && isHumanOwner && !isCPU && turnSecondsLeft <= 5 && !isRolling;

  const handleExitClick = () => {
    if (settings.roomId && user?.uid) {
      markPlayerLeft(settings.roomId, user.uid);
    }
    if (!isHumanOut && humanPlayer?.active) {
      // Route through onOpenMenu to show forfeiture warning modal
      onOpenMenu();
    } else {
      // User is eliminated — they can leave early and still receive any prize they earned!
      if (humanPlayer && humanPlayer.place && settings.payouts && settings.payouts.length > 0) {
        const prize = settings.payouts[humanPlayer.place - 1] || 0;
        if (prize > 0) {
          onAwardPrize?.(prize, humanPlayer.place);
        }
      }
      onExitGame();
    }
  };

  return (
    <div className="w-full max-w-lg md:max-w-2xl mx-auto flex flex-col h-full max-h-[100dvh] p-1 sm:p-2 md:p-3 select-none relative overflow-hidden">
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

        {/* If user is eliminated and only computers left, give options */}
        {(isHumanOut || onlyComputersLeft) && (
          <div className="flex items-center justify-between px-2.5 py-1 mb-1 bg-[#131d2e]/90 border border-white/15 rounded-xl shadow-xs">
            <span className="text-[10px] text-white/80 font-bold">
              {isHumanOut ? "You're out of the game" : "All opponents finished"}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setSpectatorChoiceMade(true);
                  setSpectatorFastForward(true);
                }}
                className="text-[10px] font-black bg-[#28974a] hover:bg-[#22803e] text-white px-2 py-0.5 rounded-lg shadow-xs cursor-pointer active:scale-95"
              >
                ⏩ Speed to Final Score
              </button>
              <button
                onClick={handleExitClick}
                className="text-[10px] font-bold bg-[#8c745e] hover:bg-[#735d49] text-white px-2 py-0.5 rounded-lg shadow-xs cursor-pointer"
              >
                Leave Room
              </button>
            </div>
          </div>
        )}

        {/* Players Scoreboards Strip */}
        <div className="mb-1">
          <CardsStrip
            units={units}
            activeUnitId={curUnit?.id}
            currentRound={round}
            isEliminationPhase={phase === 'elimination'}
            isUserTurnToRoll={isHumanOwner && rollsUsed === 0 && !isAutoPilotTurn && (joiningCountdown === null || joiningCountdown <= 0)}
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
        onTouchStart={() => stopWarningSound()}
        onMouseDown={() => stopWarningSound()}
        className="flex-1 flex flex-col justify-between min-h-0 py-0.5 md:py-2 gap-1 md:gap-3 overflow-hidden"
      >
        {/* Saved Dice Board - MAIN FLEX POINT: grows and shrinks as needed */}
        <div className="flex-1 min-h-0 flex flex-col justify-center transition-all duration-300">
          <SavedBoard
            savedDice={savedDice}
            scoreResult={scoreResult}
            onTapSavedDie={handleTapSaved}
            isCPU={isCPU}
            showSixCelebration={showSixCelebration}
            onDismissSixCelebration={() => setShowSixCelebration(false)}
          />
        </div>

        {/* Active Roll Area - Compact, fits dice compactly */}
        <div className="shrink-0 flex flex-col justify-center">
          <RollArea
            dice={dice}
            rollsUsed={rollsUsed}
            rollSlotsCount={rollSlotsCount}
            isCPU={isCPU}
            isHumanOwner={isHumanOwner}
            isRemoteHuman={isRemoteHuman}
            joiningCountdown={joiningCountdown}
            playerName={curUnit?.name || 'Player'}
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

      {/* Bottom Controls Area (Fixed at bottom - with extra padding on tablet to reveal more background) */}
      <div className="shrink-0 flex flex-col gap-0.5 md:gap-2 md:pt-4 md:pb-2">
        {/* Action Buttons: ROLL, SCORE IT!, and INFO */}
        <div className="flex gap-1.5 md:gap-3 md:py-1">
          <button
            onClick={doRoll}
            disabled={!canRoll}
            className={`flex-1 py-1.5 sm:py-2 md:py-3.5 px-2 md:px-4 bg-[#28974a] hover:bg-[#22803e] disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs sm:text-sm md:text-base rounded-xl md:rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1 md:gap-2 border-b-2 md:border-b-3 border-[#185e2e] ${
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
            className="flex-1 py-1.5 sm:py-2 md:py-3.5 px-2 md:px-4 bg-[#e58a1f] hover:bg-[#cb7512] disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs sm:text-sm md:text-base rounded-xl md:rounded-2xl shadow-md transition-transform active:scale-98 flex items-center justify-center gap-1 md:gap-2 border-b-2 md:border-b-3 border-[#a65d0a]"
          >
            <span>Score it!</span>
            {rollsUsed > 0 && (
              <span className="text-[11px] md:text-xs font-mono font-normal opacity-90">
                - {scoreResult.total} pts
              </span>
            )}
          </button>

          <button
            onClick={() => setShowInfoModal(true)}
            className="py-1.5 sm:py-2 md:py-3.5 px-3 md:px-5 bg-[#e8dec0] hover:bg-[#ded1af] text-[#3e2e1e] font-black text-xs sm:text-sm md:text-base rounded-xl md:rounded-2xl shadow-md transition-transform active:scale-98 flex items-center justify-center border-b-2 md:border-b-3 border-[#c8bc9a]"
            title="Game Rules & Scoring Info"
          >
            INFO
          </button>
        </div>

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
    </div>
  );
};

