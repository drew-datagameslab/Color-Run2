import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiceColor, Die, GamePhase, GameSettings, PlayerUnit, ScoreResult, UserAccount, Friend } from '../types/game';
import { scoreDice } from '../lib/scoring';
import { decideCPUSaves } from '../lib/cpu';
import { resolveElimination } from '../lib/elimination';
import { playSfx } from '../lib/audio';
import { getLocalFriends, addFriend, removeFriend } from '../lib/friends';
import { CardsStrip } from './CardsStrip';
import { SavedBoard } from './SavedBoard';
import { RollArea } from './RollArea';
import { PlayerProfileModal } from './PlayerProfileModal';
import { ArrowLeft, Menu, Sparkles } from 'lucide-react';

interface PlayScreenProps {
  settings: GameSettings;
  user: UserAccount;
  onGameOver: (winner: PlayerUnit, units: PlayerUnit[]) => void;
  onOpenMenu: () => void;
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
  onExitGame,
}) => {
  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || [settings.colorA, settings.colorB];

  // Initialize players
  const [units, setUnits] = useState<PlayerUnit[]>(() => {
    return settings.slots.map((s, idx) => ({
      id: `u_${idx + 1}`,
      name: s.name,
      isCPU: s.type === 'cpu',
      isOwner: s.name === user.name,
      color: s.color,
      image: s.image,
      diceColors: s.type === 'cpu' ? ['blue', 'red'] : (s.diceColors || userDiceColors),
      score: 0,
      history: {},
      active: true,
    }));
  });

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<GamePhase>('regular');
  const [qIdx, setQIdx] = useState(0);
  const [rollsUsed, setRollsUsed] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [announcedChimes, setAnnouncedChimes] = useState<Record<string, number>>({});
  const [dice, setDice] = useState<Die[]>(() => {
    const firstSlot = settings.slots[0];
    const [c1, c2] = getUnitDiceColors(firstSlot, userDiceColors);
    return createInitialDice(c1, c2);
  });
  const [toastMsg, setToastMsg] = useState('');
  const [elimModalMsg, setElimModalMsg] = useState<string | null>(null);
  const [showSixCelebration, setShowSixCelebration] = useState(false);
  const [selectedPlayerForProfile, setSelectedPlayerForProfile] = useState<PlayerUnit | null>(null);
  const [friends, setFriends] = useState<Friend[]>(() => getLocalFriends(user.uid));

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
  const isCPU = curUnit ? curUnit.isCPU : false;

  // Saved dice and score calculation
  const savedDice = dice.filter(d => d.zone === 'saved');
  const scoreResult: ScoreResult = scoreDice(savedDice);

  // Sync human player unit if user updates profile or dice during the match
  useEffect(() => {
    setUnits(prev =>
      prev.map(u => {
        if (!u.isCPU) {
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
    if (!curUnit?.isCPU && rollsUsed === 0 && savedDice.length === 0 && user.diceColors) {
      const [c1, c2] = user.diceColors;
      setDice(createInitialDice(c1, c2));
    }
  }, [user.diceColors, user.name, user.avatar]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Sound chime detector for color bonuses
  const checkBonusChimes = useCallback((currentDice: Die[]) => {
    const saved = currentDice.filter(d => d.zone === 'saved');
    const byVC: Record<string, number> = {};
    saved.forEach(d => {
      const k = `${d.value}-${d.color}`;
      byVC[k] = (byVC[k] || 0) + 1;
    });

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
        }
      }
    }
    setAnnouncedChimes(newAnnounced);
  }, [announcedChimes]);

  // Roll dice action
  const doRoll = () => {
    if (rollsUsed >= 3 || isRolling) return;
    const active = dice.filter(d => d.zone === 'active');
    if (rollsUsed > 0 && active.length === 0) {
      showToast('All dice saved — Score it!');
      return;
    }

    setIsRolling(true);
    setTimeout(() => {
      setDice(prev =>
        prev.map(d => {
          if (d.zone === 'active') {
            return {
              ...d,
              value: Math.floor(Math.random() * 6) + 1,
              selected: false,
            };
          }
          return d;
        })
      );
      setRollsUsed(r => r + 1);
      setIsRolling(false);
    }, spectatorFastForward ? 80 : 380);
  };

  // Tapping active die
  // Tapping any one active die selects every other active die showing the same symbol
  // too, so one tap gathers the whole matching group instead of tapping each die of a
  // kind individually — autoCommit() then saves them together the moment there are 3+
  const handleTapActive = (id: number) => {
    if (isCPU || rollsUsed === 0) return;

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
      const selectedActive = updated.filter(d => d.zone === 'active' && d.selected && d.value === val);

      if (savedCount + selectedActive.length >= 3) {
        const finalized = updated.map(d => {
          if (d.zone === 'active' && d.selected && d.value === val) {
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

  // Tapping saved die sends it back to active
  const handleTapSaved = (id: number) => {
    if (isCPU) return;
    setDice(prev => {
      const target = prev.find(d => d.id === id);
      if (!target) return prev;
      const v = target.value;

      // If pulling back leaves < 3 in that set, pull all matching back
      const remainingSaved = prev.filter(d => d.zone === 'saved' && d.value === v && d.id !== id);
      if (remainingSaved.length < 3) {
        return prev.map(d => (d.value === v ? { ...d, zone: 'active', selected: false } : d));
      }
      return prev.map(d => (d.id === id ? { ...d, zone: 'active', selected: false } : d));
    });
  };

  // Next Turn or Round Resolution
  const bankTurn = useCallback(() => {
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

    if (modified) {
      setDice(curDice);
      checkBonusChimes(curDice);
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

    // Reset turn state
    setRollsUsed(0);
    setAnnouncedChimes({});
    setDice(createInitialDice(settings.colorA, settings.colorB));

    // Next player or end of round
    const nextQIdx = qIdx + 1;
    const stillActive = updatedUnits.filter(u => u.active);
    const nextTargetUnit = nextQIdx < stillActive.length ? stillActive[nextQIdx] : stillActive[0];
    const [nextColorA, nextColorB] = getUnitDiceColors(nextTargetUnit, userDiceColors);

    // Reset turn state
    setRollsUsed(0);
    setAnnouncedChimes({});
    setDice(createInitialDice(nextColorA, nextColorB));

    if (nextQIdx < stillActive.length) {
      setQIdx(nextQIdx);
    } else {
      // Completed full round!
      resolveRound(updatedUnits);
    }
  }, [curUnit, dice, qIdx, round, settings.colorA, settings.colorB, units, userDiceColors, checkBonusChimes]);

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
      const [c1, c2] = getUnitDiceColors(liveUnits[0], userDiceColors);
      setDice(createInitialDice(c1, c2));
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
      const [c1, c2] = getUnitDiceColors(survivors[0], userDiceColors);
      setDice(createInitialDice(c1, c2));
    }
  };

  // CPU Automated Turn Runner
  useEffect(() => {
    if (!isCPU || !curUnit || isRolling) return;

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
  }, [isCPU, curUnit, rollsUsed, isRolling, dice, spectatorFastForward, doRoll, bankTurn, checkBonusChimes]);

  const canRoll = rollsUsed < 3 && dice.filter(d => d.zone === 'active').length > 0 && !isCPU && !isRolling;
  const canScore = (rollsUsed === 3 || dice.filter(d => d.zone === 'active').length === 0) && rollsUsed > 0 && !isCPU;

  const humanPlayer = units.find(u => !u.isCPU);
  const isHumanOut = humanPlayer ? !humanPlayer.active : false;

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col min-h-[92vh] p-2 sm:p-3 select-none">
      {/* Top Play Bar */}
      <div className="flex items-center justify-between px-2 py-1 mb-2 bg-[#faf4e6]/90 border border-[#c9b877] rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (confirm('End this game and return to menu?')) onExitGame();
            }}
            className="p-1 rounded-lg hover:bg-black/10 text-[#4a3622]"
            title="End Game"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="text-xs font-black text-[#1c6a35]">
            Round <span className="font-mono text-sm">{round}</span>
          </div>
          {phase === 'elimination' && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#e5352f] text-white px-2 py-0.5 rounded-full shadow-xs">
              Elimination
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#6d5138]">
            Target: <b className="text-[#1c6a35] font-mono">{settings.threshold} pts</b>
          </span>
          <button
            onClick={onOpenMenu}
            className="p-1.5 rounded-lg bg-[#ebdcb9] hover:bg-[#ded1af] text-[#4a3622]"
            title="Game Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Players Cards Strip */}
      <div className="mb-2">
        <CardsStrip
          units={units}
          activeUnitId={curUnit?.id}
          currentRound={round}
          isEliminationPhase={phase === 'elimination'}
          onSelectUnit={setSelectedPlayerForProfile}
        />
      </div>

      {/* Toast message */}
      {toastMsg && (
        <div className="bg-[#1c6a35] text-white text-xs font-bold px-3 py-1.5 rounded-xl text-center mb-2 shadow-md animate-fade-in">
          {toastMsg}
        </div>
      )}

      {/* Saved Dice Board */}
      <div className="mb-2">
        <SavedBoard
          savedDice={savedDice}
          scoreResult={scoreResult}
          onTapSavedDie={handleTapSaved}
          isCPU={isCPU}
        />
      </div>

      {/* Active Roll Area */}
      <div className="flex-1 flex flex-col justify-center mb-3">
        <RollArea
          dice={dice}
          rollsUsed={rollsUsed}
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

      {/* Action Buttons: ROLL & SCORE IT! */}
      <div className="flex gap-2">
        <button
          onClick={doRoll}
          disabled={!canRoll}
          className="flex-1 py-3 px-3 bg-[#2f9a4f] hover:bg-[#268a48] disabled:opacity-40 disabled:pointer-events-none text-white font-black text-base rounded-2xl shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-1.5 border-b-4 border-[#1b6b33]"
        >
          <span>{rollsUsed === 0 ? 'Roll' : 'Rolls'}</span>
          {rollsUsed > 0 && (
            <span className="text-xs font-mono font-normal opacity-90">
              - {Math.max(0, 3 - rollsUsed)} left
            </span>
          )}
        </button>

        <button
          onClick={bankTurn}
          disabled={!canScore}
          className="flex-1 py-3 px-3 bg-[#e58a1f] hover:bg-[#cb7512] disabled:opacity-40 disabled:pointer-events-none text-white font-black text-base rounded-2xl shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-1.5 border-b-4 border-[#a65d0a]"
        >
          <span>Score it!</span>
          {rollsUsed > 0 && (
            <span className="text-xs font-mono font-normal opacity-90">
              - {scoreResult.total} pts
            </span>
          )}
        </button>
      </div>

      {/* Hint tip text */}
      <div className="text-center text-[11px] text-[#fcf9ea] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mt-2 font-medium">
        {isCPU
          ? `🤖 ${curUnit?.name} is thinking…`
          : rollsUsed === 0
            ? 'Tap ROLL to roll all 12 dice'
            : savedDice.length === 0
              ? 'Tap matching dice (3+ of a symbol) to save them'
              : 'Saved dice are safe. Tap a saved die to send it back.'}
      </div>

      {/* 6-of-a-kind Color Run Video Celebration */}
      {showSixCelebration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs cursor-pointer animate-fade-in"
          onClick={() => setShowSixCelebration(false)}
        >
          <div className="relative max-w-xs w-full bg-black/80 border-2 border-[#f2c14e] rounded-3xl p-4 shadow-2xl flex flex-col items-center">
            <video
              src="/media/color-run.mp4"
              autoPlay
              playsInline
              className="w-full rounded-2xl shadow-lg object-contain"
              onEnded={() => setShowSixCelebration(false)}
            />
            <div className="mt-3 text-center">
              <span className="text-xs font-bold text-[#f2c14e] tracking-wider uppercase">
                🎉 Color Run Bonus! (Tap to close)
              </span>
            </div>
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

      {/* Elimination Modal Announcement */}
      {elimModalMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[#faf4e6] border-2 border-[#e5352f] rounded-2xl p-5 shadow-2xl text-center">
            <div className="text-3xl mb-1">⚔️</div>
            <h3 className="text-xl font-black text-[#e5352f] mb-2">Elimination Round!</h3>
            <p className="text-xs text-[#4a3622] leading-relaxed mb-4">{elimModalMsg}</p>
            <button
              onClick={() => {
                setElimModalMsg(null);
                setRound(r => r + 1);
                setQIdx(0);
              }}
              className="w-full py-2.5 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-bold text-sm rounded-xl shadow-md transition-transform active:scale-98"
            >
              Begin Elimination Round
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
