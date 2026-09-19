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

  // Initialize players - User is the ONLY human player (Slot 0), all other slots are CPU bots
  const [units, setUnits] = useState<PlayerUnit[]>(() => {
    return settings.slots.map((s, idx) => {
      const isUserSlot = idx === 0;
      return {
        id: `u_${idx + 1}`,
        name: s.name,
        isCPU: !isUserSlot,
        isOwner: isUserSlot,
        isOnlinePlayer: false,
        color: s.color,
        image: s.image,
        diceColors: isUserSlot ? (s.diceColors || userDiceColors) : ['blue', 'red'],
        score: 0,
        history: {},
        active: true,
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
  const [showSixCelebration, setShowSixCelebration] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedPlayerForProfile, setSelectedPlayerForProfile] = useState<PlayerUnit | null>(null);
  const [friends, setFriends] = useState<Friend[]>(() => getLocalFriends(user.uid));

  // Turn timer & AFK management - 20s for roll 1, 10s for roll 2 & 3
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(20);
  const [isAfkOverlay, setIsAfkOverlay] = useState(false);
  const [consecutiveAfkTurns, setConsecutiveAfkTurns] = useState(0);
  const [isAutoPilotTurn, setIsAutoPilotTurn] = useState(false);
  const prevActiveUnitIdRef = useRef<string | null>(null);

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
  const isCPU = curUnit ? (!curUnit.isOwner || curUnit.isCPU || isAutoPilotTurn) : false;

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

  // Alert when the user's turn comes up & reset roll timer & bonus announcements
  useEffect(() => {
    if (!curUnit) return;
    if (curUnit.id !== prevActiveUnitIdRef.current) {
      prevActiveUnitIdRef.current = curUnit.id;
      stopWarningSound();
      setTurnSecondsLeft(20);
      setRollSlotsCount(12);
      setIsAutoPilotTurn(false);
      setAnnouncedChimes({});
      setShowSixCelebration(false);

      if (curUnit.isOwner && !curUnit.isCPU) {
        // User turn alert chime & toast alert
        playSfx('add');
        showToast('👉 Your Turn! Tap ROLL');
      }
    }
  }, [curUnit]);

  // Turn countdown timer for human user's turn (ONLY active when additional users are in the room):
  // 20s on roll 1, 10s on rolls 2 & 3
  useEffect(() => {
    if (!isTimerEnabled || !isHumanOwner || isAutoPilotTurn || isRolling || elimModalMsg) {
      stopWarningSound();
      return;
    }

    // Play 5-second countdown warning audio when timer reaches 5 seconds
    if (turnSecondsLeft === 5) {
      playWarning5sSound();
    }

    if (turnSecondsLeft <= 0) {
      stopWarningSound();
      // User time ran out - auto-roll or score
      const active = dice.filter(d => d.zone === 'active');
      if (rollsUsed < 3 && (rollsUsed === 0 || active.length > 0)) {
        doRoll();
      } else {
        bankTurn();
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
    isAutoPilotTurn,
    rollsUsed,
    isRolling,
    elimModalMsg,
    turnSecondsLeft,
    dice,
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
    const active = dice.filter(d => d.zone === 'active');
    if (rollsUsed > 0 && active.length === 0) {
      showToast('All dice saved — Score it!');
      return;
    }

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

    setIsRolling(true);

    // Rapid random shuffle during roll tumble animation
    const shuffleTimer = setInterval(() => {
      setDice(prev =>
        prev.map(d => {
          if (d.zone === 'active') {
            return {
              ...d,
              value: Math.floor(Math.random() * 6) + 1,
            };
          }
          return d;
        })
      );
    }, 60);

    const rollDuration = spectatorFastForward ? 100 : 380;

    setTimeout(() => {
      clearInterval(shuffleTimer);
      // Lock dice values cleanly after the animation ends!
      setDice(prev =>
        prev.map(d => {
          if (d.zone === 'active') {
            const finalVal = finalValuesMap.get(d.id) ?? d.value;
            return {
              ...d,
              value: finalVal,
              selected: false,
            };
          }
          return d;
        })
      );
      setRollsUsed(r => {
        const nextRoll = r + 1;
        // Human player gets 10 seconds for rolls 2 & 3
        if (isHumanOwner && !isCPU) {
          setTurnSecondsLeft(10);
        }
        return nextRoll;
      });
      setIsRolling(false);
    }, rollDuration);
  };

  // Tapping active die: moves matching set to saved area.
  // Stops warning sound immediately, resets timer, and leaves original slot space blank in rolling area!
  const handleTapActive = (id: number) => {
    if (isCPU || rollsUsed === 0 || isRolling) return;

    // Stop warning sound immediately and reset turn timer when user moves dice!
    stopWarningSound();
    if (isHumanOwner && !isCPU) {
      setTurnSecondsLeft(rollsUsed === 0 ? 20 : 10);
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
        return finalized;
      }

      return updated;
    });
  };

  // Tapping saved die sends it back to active area into a vacant slot. Resets timer & stops warning sound!
  const handleTapSaved = (id: number) => {
    if (isCPU || isRolling) return;

    // Stop warning sound immediately and reset turn timer when user moves dice!
    stopWarningSound();
    if (isHumanOwner && !isCPU) {
      setTurnSecondsLeft(rollsUsed === 0 ? 20 : 10);
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
      if (remainingSaved.length < 3) {
        return prev.map(d =>
          d.value === v
            ? { ...d, zone: 'active' as const, selected: false, slotIndex: assignSlot(d.slotIndex) }
            : d
        );
      }
      return prev.map(d =>
        d.id === id
          ? { ...d, zone: 'active' as const, selected: false, slotIndex: assignSlot(d.slotIndex) }
          : d
      );
    });
  };

  // Next Turn or Round Resolution
  const bankTurn = useCallback(() => {
    stopWarningSound();
    if (!curUnit) return;

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

      setDice(createInitialDice(nextColorA, nextColorB));

      if (nextQIdx < stillActive.length) {
        setQIdx(nextQIdx);
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
  }, [curUnit, dice, qIdx, round, settings.colorA, settings.colorB, units, userDiceColors, checkBonusChimes, showSixCelebration]);

  // Round resolution (checking threshold or doing elimination)
  const resolveRound = (currentUnits: PlayerUnit[]) => {
    const liveUnits = currentUnits.filter(u => u.active);

    if (phase === 'regular') {
      const thresholdReached = liveUnits.some(u => u.score >= settings.threshold);
      if (thresholdReached) {
        setPhase('elimination');
        setElimModalMsg(
          `Someone reached ${settings.threshold} points! From here, every player plays a full round, then the lowest total is knocked out. Last one standing wins!`
        );
        return;
      }
      // Continue next regular round
      setRound(r => r + 1);
      setQIdx(0);
      setRollsUsed(0);
      setRollSlotsCount(12);
      const [c1, c2] = getUnitDiceColors(liveUnits[0], userDiceColors);
      setDice(createInitialDice(c1, c2));
      if (liveUnits[0]?.isOwner && !liveUnits[0]?.isCPU) {
        setTurnSecondsLeft(20);
        setIsAutoPilotTurn(false);
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
        onGameOver(winner, finalizedUnits);
        return;
      }

      // Show elimination toast or notice
      const elimNames = toElim.map(e => e.name).join(', ');
      showToast(`⚔️ Round complete: ${elimNames} knocked out!`);

      setRound(r => r + 1);
      setQIdx(0);
      setRollsUsed(0);
      setRollSlotsCount(12);
      const [c1, c2] = getUnitDiceColors(survivors[0], userDiceColors);
      setDice(createInitialDice(c1, c2));
      if (survivors[0]?.isOwner && !survivors[0]?.isCPU) {
        setTurnSecondsLeft(20);
        setIsAutoPilotTurn(false);
      }
    }
  };

  // Dismiss elimination announcement and prepare the round without auto-rolling
  const handleDismissElimModal = () => {
    setElimModalMsg(null);
    setRound(r => r + 1);
    setQIdx(0);
    setRollsUsed(0);
    setRollSlotsCount(12);
    const liveUnits = units.filter(u => u.active);
    const firstUnit = liveUnits[0];
    if (firstUnit) {
      const [c1, c2] = getUnitDiceColors(firstUnit, userDiceColors);
      setDice(createInitialDice(c1, c2));
    }
    if (firstUnit?.isOwner && !firstUnit.isCPU) {
      setTurnSecondsLeft(20);
      setIsAutoPilotTurn(false);
    }
  };

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
  }, [elimModalMsg]);

  // CPU Automated Turn Runner (waits if elimination modal or 6-of-a-kind celebration is displayed)
  useEffect(() => {
    if (!isCPU || !curUnit || isRolling || elimModalMsg || showSixCelebration) return;

    const delay = spectatorFastForward ? 120 : 650;

    const timer = setTimeout(() => {
      if (rollsUsed === 0) {
        doRoll();
      } else {
        // CPU decision on saving sets
        const toSaveIds = decideCPUSaves(dice);

        if (toSaveIds.length > 0) {
          setDice(prev => {
            const next = prev.map(d => (toSaveIds.includes(d.id) ? { ...d, zone: 'saved' as const, selected: false } : d));
            checkBonusChimes(next);
            return next;
          });
        }

        const remainingActive = dice.filter(d => d.zone === 'active' && !toSaveIds.includes(d.id));

        if (rollsUsed < 3 && remainingActive.length > 0) {
          // Roll again
          doRoll();
        } else {
          // Bank turn
          bankTurn();
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isCPU, curUnit, rollsUsed, isRolling, dice, spectatorFastForward, elimModalMsg, showSixCelebration, doRoll, bankTurn, checkBonusChimes]);

  const canRoll = rollsUsed < 3 && dice.filter(d => d.zone === 'active').length > 0 && !isCPU && !isRolling;
  const canScore = (rollsUsed === 3 || dice.filter(d => d.zone === 'active').length === 0) && rollsUsed > 0 && !isCPU;

  const humanPlayer = units.find(u => u.isOwner);
  const isHumanOut = humanPlayer ? !humanPlayer.active : false;
  const onlyComputersLeft = units.filter(u => u.active).every(u => u.isCPU);

  // Target display logic: target is reached once elimination phase begins or someone hits threshold
  const targetReached = phase === 'elimination' || units.some(u => u.score >= settings.threshold);

  // 5-second warning indicator when turn time is almost up (ONLY active when timers are enabled in room)
  const isTimeRunningOut = isTimerEnabled && isHumanOwner && !isCPU && turnSecondsLeft <= 5 && !isRolling;

  const handleExitClick = () => {
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
            isUserTurnToRoll={isHumanOwner && rollsUsed === 0 && !isAutoPilotTurn}
            onSelectUnit={setSelectedPlayerForProfile}
          />
        </div>

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
                : rollsUsed === 0 && isHumanOwner && !isCPU
                ? 'ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/40 animate-pulse shadow-[0_0_12px_rgba(242,193,78,0.5)]'
                : ''
            }`}
          >
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
          {isCPU
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none animate-fade-in">
          <div className="w-full max-w-sm bg-[#faf4e6] border-2 border-[#e5352f] rounded-2xl p-5 shadow-2xl text-center">
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

