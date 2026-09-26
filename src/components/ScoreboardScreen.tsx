import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, UserPlus, Trash2, RotateCcw, Lock, CheckCircle2, AlertCircle, ShieldCheck, Undo2, Award, Info, X, History, Swords } from 'lucide-react';
import { Die, PlayerUnit, ScoreResult } from '../types/game';
import { CardsStrip } from './CardsStrip';
import { SavedBoard } from './SavedBoard';
import { DieComponent } from './DieComponent';
import { scoreDice } from '../lib/scoring';
import { playSfx, playEliminatedSound, startBattleMusic, stopBattleMusic } from '../lib/audio';
import { triggerDieTapHaptic, triggerDieRemoveHaptic, triggerCelebrationHaptic } from '../lib/haptics';
import { BattleVideoOverlay } from './BattleVideoOverlay';
import { findLowestTie, startTiebreaker, resolveTiebreakerRound } from '../lib/tiebreaker';
import { BattleToSurviveGraphic } from './BattleToSurviveGraphic';

interface ScoreboardScreenProps {
  isUnlocked: boolean;
  onUnlockCode: (code: string) => boolean;
  onBack: () => void;
}

interface RollTurnRecord {
  playerIndex: number;
  playerName: string;
  round: number;
  addedScore: number;
  savedDice: Die[];
  scoreResult: ScoreResult;
  prevUnits: PlayerUnit[];
  prevEliminationPhase: boolean;
  prevActiveUnitId: string;
  prevRound: number;
}

const PLAYER_PALETTE = [
  '#28974a', '#1f7fd6', '#e58a1f', '#8e44c9', '#d62828',
  '#00b894', '#0984e3', '#34495e', '#e84393', '#fdcb6e',
  '#6c5ce7', '#00cec9', '#d35400', '#27ae60', '#2980b9',
  '#8e44ad', '#2c3e50', '#f39c12', '#16a085', '#c0392b',
];

export const ScoreboardScreen: React.FC<ScoreboardScreenProps> = ({
  isUnlocked,
  onUnlockCode,
  onBack,
}) => {
  // Lock screen code input state
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState('');

  // Host setup state
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup');
  const [playerNames, setPlayerNames] = useState<string[]>([
    'Player 1',
    'Player 2',
    'Player 3',
    'Player 4',
  ]);
  const [threshold] = useState<number>(250);

  // Playing game state
  const [units, setUnits] = useState<PlayerUnit[]>([]);
  const [activeUnitId, setActiveUnitId] = useState<string>('');
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [isEliminationPhase, setIsEliminationPhase] = useState<boolean>(false);
  const [eliminationBanner, setEliminationBanner] = useState<string | null>(null);
  const [savedDice, setSavedDice] = useState<Die[]>([]);
  const [historyLog, setHistoryLog] = useState<RollTurnRecord[]>([]);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showSixCelebration, setShowSixCelebration] = useState<boolean>(false);
  const [winner, setWinner] = useState<PlayerUnit | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [eliminationBannerUnderLabels, setEliminationBannerUnderLabels] = useState<string | null>(null);

  // Tiebreaker State for Companion Scoreboard
  const [tiebreaker, setTiebreaker] = useState<{
    isActive: boolean;
    phase: 'intro' | 'rolling' | 'outro' | null;
    tiedUnitIds: string[];
    currentRollScores: Record<string, number>;
    eliminatedUnit: PlayerUnit | null;
    roundNumber: number;
    noticeMsg: string | null;
  }>({
    isActive: false,
    phase: null,
    tiedUnitIds: [],
    currentRollScores: {},
    eliminatedUnit: null,
    roundNumber: 1,
    noticeMsg: null,
  });

  const nextDieIdRef = useRef(1);
  // Stop the roll-off music if the scoreboard closes mid-tiebreaker
  useEffect(() => stopBattleMusic, []);

  const eliminationBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Red "[User] has been eliminated!" banner under the Saved Dice labels row, with eliminated.mp3
  const triggerEliminatedBanner = (playerName: string) => {
    setEliminationBannerUnderLabels(`${playerName} has been eliminated!`);
    playEliminatedSound();
    if (eliminationBannerTimerRef.current) clearTimeout(eliminationBannerTimerRef.current);
    eliminationBannerTimerRef.current = setTimeout(() => setEliminationBannerUnderLabels(null), 6000);
  };

  useEffect(() => {
    return () => {
      if (eliminationBannerTimerRef.current) clearTimeout(eliminationBannerTimerRef.current);
    };
  }, []);

  // Calculate current score for whatever dice are currently saved
  const currentScoreResult: ScoreResult = scoreDice(savedDice);

  // Validate dice counts per color: max 6 red and 6 blue allowed
  const redDiceCount = savedDice.filter(d => d.color === 'red').length;
  const blueDiceCount = savedDice.filter(d => d.color === 'blue').length;
  const hasColorLimitError = redDiceCount > 6 || blueDiceCount > 6;

  let colorErrorMessage: string | null = null;
  if (redDiceCount > 6 && blueDiceCount > 6) {
    colorErrorMessage = `Too many dice! Max 6 red (${redDiceCount}/6) & 6 blue (${blueDiceCount}/6) allowed.`;
  } else if (redDiceCount > 6) {
    colorErrorMessage = `Too many red dice (${redDiceCount}/6)! Maximum 6 allowed.`;
  } else if (blueDiceCount > 6) {
    colorErrorMessage = `Too many blue dice (${blueDiceCount}/6)! Maximum 6 allowed.`;
  }

  const handleRedeemCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) {
      setCodeError('Please enter your code');
      return;
    }
    const ok = onUnlockCode(codeInput.trim());
    if (ok) {
      setCodeSuccess('🎉 Code verified! Companion Scoreboard unlocked!');
      setCodeError('');
      playSfx('fanfare');
    } else {
      setCodeError('Code not recognized. Check your user guide or try CR-TEST-TEST');
    }
  };

  // If locked, show the Home Game Code unlocking screen
  if (!isUnlocked) {
    return (
      <div className="w-full max-w-md mx-auto p-4 flex flex-col items-center select-none">
        <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-3xl p-6 sm:p-7 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={onBack}
              className="p-1 rounded-full hover:bg-black/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#5c4937]" />
            </button>
            <h2 className="text-lg font-black text-[#1c6a35]">
              Scoreboard Mode
            </h2>
          </div>

          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-[#f2c14e]/20 border border-[#d4ab3a] flex items-center justify-center text-[#9a6a12] mb-3 shadow-xs">
              <Lock className="w-8 h-8 text-[#1c6a35]" />
            </div>
            <h3 className="text-xl font-black text-[#2e2316] mb-1">
              Unlock Companion Scoreboard
            </h3>
            <p className="text-xs text-[#6e533c] max-w-xs leading-relaxed">
              Companion Scoreboard is an exclusive feature for owners of the physical Color Run home board game.
            </p>
          </div>

          <div className="bg-white/80 border border-[#ebdcb9] rounded-2xl p-3.5 mb-5 space-y-2 text-xs font-bold text-[#3e2e1e]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2f9a4f] shrink-0" />
              <span>Digital scorekeeper for up to 20 tabletop players</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2f9a4f] shrink-0" />
              <span>Automated elimination thresholds &amp; round tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2f9a4f] shrink-0" />
              <span>Permanently removes all ads across the entire app</span>
            </div>
          </div>

          <form onSubmit={handleRedeemCode} className="space-y-3 mb-4">
            <div>
              <label className="block text-[11px] font-bold text-[#5c4937] mb-1">
                Enter Code from User Guide (or inside box lid):
              </label>
              <input
                type="text"
                value={codeInput}
                onChange={e => {
                  setCodeInput(e.target.value.toUpperCase());
                  setCodeError('');
                }}
                placeholder="e.g. CR-TEST-TEST"
                autoFocus
                className="w-full px-3 py-2.5 bg-white border border-[#c9b877] rounded-xl text-center font-mono font-black text-sm text-[#1c6a35] placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f] uppercase tracking-wider"
              />
            </div>

            {codeError && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#e5352f] bg-red-50 p-2 rounded-xl border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{codeError}</span>
              </div>
            )}

            {codeSuccess && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#1c6a35] bg-green-50 p-2 rounded-xl border border-green-200">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{codeSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-black text-sm rounded-xl shadow-md transition-transform active:scale-98 flex items-center justify-center gap-1.5 border-b-2 border-[#1c6a35]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Redeem &amp; Unlock Feature</span>
            </button>
          </form>

          <div className="text-center">
            <span className="text-[10px] text-[#8c745e]">
              Dev / Reviewer tip: Use <code className="font-mono font-bold text-[#1c6a35]">CR-TEST-TEST</code>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PHASE 1: SETTINGS / HOST PLAYER SETUP SCREEN
  // ==========================================
  const handleAddPlayer = () => {
    if (playerNames.length >= 20) return;
    setPlayerNames([...playerNames, `Player ${playerNames.length + 1}`]);
  };

  const handleRemovePlayer = (idx: number) => {
    if (playerNames.length <= 2) return;
    setPlayerNames(playerNames.filter((_, i) => i !== idx));
  };

  const handleUpdatePlayerName = (idx: number, name: string) => {
    const updated = [...playerNames];
    updated[idx] = name;
    setPlayerNames(updated);
  };

  const handleStartGame = () => {
    const cleanNames = playerNames.map((n, idx) => (n.trim() ? n.trim() : `Player ${idx + 1}`));
    const initialUnits: PlayerUnit[] = cleanNames.map((name, idx) => ({
      id: `p-${idx + 1}`,
      name,
      isCPU: false,
      color: PLAYER_PALETTE[idx % PLAYER_PALETTE.length],
      score: 0,
      history: {},
      active: true,
      diceColors: ['blue', 'red'],
    }));

    setUnits(initialUnits);
    setActiveUnitId(initialUnits[0].id);
    setCurrentRound(1);
    setIsEliminationPhase(false);
    setSavedDice([]);
    setHistoryLog([]);
    setWinner(null);
    setPhase('playing');
    playSfx('add');
  };

  if (phase === 'setup') {
    return (
      <div className="w-full max-w-lg mx-auto p-3 sm:p-4 flex flex-col justify-center select-none my-auto">
        <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#ebdcb9]">
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                className="p-1 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
                title="Back to Main Menu"
              >
                <ArrowLeft className="w-5 h-5 text-[#5c4937]" />
              </button>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#1c6a35] leading-tight">
                  Companion Scoreboard
                </h2>
                <span className="text-[10px] font-bold text-[#8c745e]">
                  Home Game Setup (2–20 Players)
                </span>
              </div>
            </div>
            <span className="text-[10px] font-black bg-[#2f9a4f]/15 text-[#1c6a35] px-2.5 py-1 rounded-full border border-[#2f9a4f]/30">
              {playerNames.length} Players
            </span>
          </div>

          <p className="text-xs text-[#5c4937] font-medium mb-3">
            Enter the names of all the players joining your tabletop game:
          </p>

          {/* Players List with input fields */}
          <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1 max-h-[52vh]">
            {playerNames.map((name, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 bg-white/80 border border-[#ebdcb9] rounded-xl shadow-xs"
              >
                <div
                  className="w-7 h-7 rounded-full text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs"
                  style={{ backgroundColor: PLAYER_PALETTE[idx % PLAYER_PALETTE.length] }}
                >
                  {idx + 1}
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={e => handleUpdatePlayerName(idx, e.target.value)}
                  placeholder={`Player ${idx + 1}`}
                  maxLength={18}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-[#c9b877] rounded-lg text-xs sm:text-sm font-bold text-[#2e2316] placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f]"
                />
                {playerNames.length > 2 && (
                  <button
                    onClick={() => handleRemovePlayer(idx)}
                    className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    title="Remove Player"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Player button */}
          {playerNames.length < 20 && (
            <button
              onClick={handleAddPlayer}
              className="w-full py-2.5 mb-4 bg-[#eae0c5] hover:bg-[#ded1af] text-[#4a3622] font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition-transform active:scale-98 cursor-pointer border border-[#c9b877]"
            >
              <UserPlus className="w-4 h-4 text-[#1c6a35]" />
              <span>Add Player ({playerNames.length}/20)</span>
            </button>
          )}

          {/* Start Game button */}
          <button
            onClick={handleStartGame}
            className="w-full py-3 sm:py-3.5 bg-[#28974a] hover:bg-[#22803e] text-white font-black text-sm sm:text-base rounded-2xl shadow-xl transition-transform active:scale-98 flex items-center justify-center gap-2 border-b-4 border-[#185e2e] cursor-pointer"
          >
            <span>Start Game</span>
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // PHASE 2: IN-GAME COMPANION SCOREBOARD
  // ==========================================
  const activeUnit = units.find(u => u.id === activeUnitId) || units.find(u => u.active) || units[0];

  // Add die on pip button tap
  const handleTapPipDie = (color: 'red' | 'blue', value: number) => {
    // Provide tactile haptic feedback on die tap
    triggerDieTapHaptic();

    const newDie: Die = {
      id: nextDieIdRef.current++,
      color,
      value,
      zone: 'saved',
      selected: false,
    };
    const nextSaved = [...savedDice, newDie];
    setSavedDice(nextSaved);

    // Audio chime feedback for set formation, color bonus tiers & 6-of-a-kind Color Run celebration
    const sameColorCount = nextSaved.filter(d => d.value === value && d.color === color).length;
    const totalValCount = nextSaved.filter(d => d.value === value).length;

    if (sameColorCount === 6) {
      setShowSixCelebration(true);
      playSfx('s6');
      triggerCelebrationHaptic();
    } else if (sameColorCount === 5 || totalValCount === 5) {
      playSfx('s5');
    } else if (sameColorCount === 4 || totalValCount === 4) {
      playSfx('s4');
    } else if (sameColorCount === 3 || totalValCount === 3) {
      playSfx('s3');
    } else if (totalValCount >= 6) {
      playSfx('s6');
    } else {
      playSfx('add');
    }
  };

  // Remove individual die if tapped from saved board
  const handleRemoveSavedDie = (dieId: any) => {
    triggerDieRemoveHaptic();
    setShowSixCelebration(false);
    setSavedDice(prev => prev.filter(d => String(d.id) !== String(dieId)));
    playSfx('add');
  };

  // Allow scorer to tap any player board at the top to activate their turn
  const handleSelectPlayerBoard = (unit: PlayerUnit) => {
    if (!unit.active) return;
    setShowSixCelebration(false);
    setActiveUnitId(unit.id);
    setSavedDice([]);
  };

  // Undo last scored turn
  const handleUndo = () => {
    setShowSixCelebration(false);
    if (historyLog.length === 0) {
      // If dice are currently staged, clear them
      if (savedDice.length > 0) {
        setSavedDice([]);
      }
      return;
    }

    const lastEntry = historyLog[historyLog.length - 1];
    const newLog = historyLog.slice(0, -1);

    setWinner(null);
    setUnits(lastEntry.prevUnits);
    setIsEliminationPhase(lastEntry.prevEliminationPhase);
    setCurrentRound(lastEntry.prevRound);
    setActiveUnitId(lastEntry.prevActiveUnitId);
    setSavedDice(lastEntry.savedDice);
    setHistoryLog(newLog);
    setEliminationBanner(null);
    playSfx('add');
  };

  // Score It: commit the turn
  const handleScoreIt = () => {
    setShowSixCelebration(false);
    if (!activeUnit || hasColorLimitError) return;
    const playerIdx = units.findIndex(u => u.id === activeUnit.id);
    if (playerIdx === -1) return;

    const addedScore = currentScoreResult.total;

    // Record history snapshot for undo capability
    const turnRecord: RollTurnRecord = {
      playerIndex: playerIdx,
      playerName: activeUnit.name,
      round: currentRound,
      addedScore,
      savedDice: [...savedDice],
      scoreResult: { ...currentScoreResult },
      prevUnits: units.map(u => ({ ...u, history: { ...u.history } })),
      prevEliminationPhase: isEliminationPhase,
      prevActiveUnitId: activeUnitId,
      prevRound: currentRound,
    };

    const updatedUnits = units.map(u => {
      if (u.id === activeUnit.id) {
        const nextScore = u.score + addedScore;
        const nextHist = { ...u.history, [currentRound]: addedScore };
        return {
          ...u,
          score: nextScore,
          history: nextHist,
        };
      }
      return u;
    });

    setHistoryLog(prev => [...prev, turnRecord]);
    setSavedDice([]);

    // Usual scoring sounds based on banked turn points
    if (addedScore >= 100) {
      playSfx('fanfare');
    } else if (addedScore >= 40) {
      playSfx('s5');
    } else if (addedScore >= 25) {
      playSfx('s4');
    } else if (addedScore > 0) {
      playSfx('s3');
    } else {
      playSfx('add');
    }

    const activeUnits = updatedUnits.filter(u => u.active);
    const curActiveIndex = activeUnits.findIndex(u => u.id === activeUnit.id);

    // CRITICAL: Ensure ALL active players finish the round before checking
    // if a player achieved the 250 threshold and starting an elimination round.
    const allFinishedRound = activeUnits.every(u => u.history[currentRound] !== undefined);

    if (!allFinishedRound) {
      // The round is NOT finished yet. Other players still need to take their turn this round.
      // Do NOT check threshold, do NOT enter elimination mode, do NOT eliminate anyone.
      // Advance to the next active player who hasn't played this round yet.
      let nextUnit: PlayerUnit | undefined;
      for (let offset = 1; offset < activeUnits.length; offset++) {
        const candidate = activeUnits[(curActiveIndex + offset) % activeUnits.length];
        if (candidate && candidate.history[currentRound] === undefined) {
          nextUnit = candidate;
          break;
        }
      }
      if (!nextUnit) {
        nextUnit = activeUnits.find(u => u.history[currentRound] === undefined);
      }

      setUnits(updatedUnits);
      if (nextUnit) {
        setActiveUnitId(nextUnit.id);
      }
      return;
    }

    // =========================================================================
    // ALL ACTIVE PLAYERS HAVE COMPLETED THE ROUND!
    // =========================================================================

    if (isEliminationPhase) {
      // Players tied for the lowest total (in seating order) battle to survive
      const participating = findLowestTie(activeUnits);
      const minScore = Math.min(...activeUnits.map(u => u.score));
      const tiedForLowest = activeUnits.filter(u => u.score === minScore);

      if (participating.length > 0) {
        setUnits(updatedUnits);
        setTiebreaker({
          isActive: true,
          phase: 'intro',
          tiedUnitIds: participating.map(u => u.id),
          currentRollScores: {},
          eliminatedUnit: null,
          roundNumber: 1,
          noticeMsg: null,
        });
        startBattleMusic();
        return;
      }

      // No tie: single lowest player is eliminated
      if (activeUnits.length > 2) {
        const lowestUnit = tiedForLowest[0];
        const place = activeUnits.length;
        const finalizedUnits = updatedUnits.map(u =>
          u.id === lowestUnit.id ? { ...u, active: false, place } : u
        );
        setUnits(finalizedUnits);
        setCurrentRound(r => r + 1);
        triggerEliminatedBanner(lowestUnit.name);

        const remaining = finalizedUnits.filter(u => u.active);
        setActiveUnitId(remaining[0]?.id || '');
        return;
      } else if (activeUnits.length === 2) {
        const sorted = [...activeUnits].sort((a, b) => b.score - a.score);
        const champ = sorted[0];
        const runnerUp = sorted[1];
        const finalizedUnits = updatedUnits.map(u => {
          if (u.id === champ.id) return { ...u, place: 1 };
          if (u.id === runnerUp.id) return { ...u, active: false, place: 2 };
          return u;
        });
        setUnits(finalizedUnits);
        setWinner(champ);
        triggerEliminatedBanner(runnerUp.name);
        playSfx('fanfare');
        return;
      }
    } else {
      // Regular Phase: now that ALL players finished the round, check if any reached threshold!
      const thresholdReached = updatedUnits.some(u => u.score >= threshold);
      if (thresholdReached) {
        setIsEliminationPhase(true);
        playSfx('fanfare');
        setEliminationBanner(`Threshold of ${threshold} pts reached! Elimination Round begins!`);
        setTimeout(() => setEliminationBanner(null), 5000);
      }
    }

    // Advance to the next round with all remaining active players starting with player 0
    setUnits(updatedUnits);
    setCurrentRound(r => r + 1);
    setActiveUnitId(activeUnits[0].id);
  };

  const handleTiebreakerIntroComplete = () => {
    setTiebreaker(prev => ({ ...prev, phase: 'rolling' }));
  };

  const handleTiebreakerOutroComplete = () => {
    stopBattleMusic();
    const eliminated = tiebreaker.eliminatedUnit;
    setTiebreaker({
      isActive: false,
      phase: null,
      tiedUnitIds: [],
      currentRollScores: {},
      eliminatedUnit: null,
      roundNumber: 1,
      noticeMsg: null,
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
      const winnerUnit = remainingActive[0] || finalizedUnits[0];
      setWinner(winnerUnit);
      playSfx('fanfare');
    } else {
      setCurrentRound(r => r + 1);
      setActiveUnitId(remainingActive[0]?.id || '');
    }
  };

  const handleSetTiebreakerScore = (unitId: string, val: number) => {
    setTiebreaker(prev => ({
      ...prev,
      currentRollScores: {
        ...prev.currentRollScores,
        [unitId]: Math.max(0, val),
      },
    }));
  };

  const handleResolveTiebreakerRolls = () => {
    const scores = tiebreaker.currentRollScores;
    const allEntered = tiebreaker.tiedUnitIds.every(id => scores[id] !== undefined && !isNaN(scores[id]));
    if (!allEntered) return;

    // Same roll-off rules as the app game (src/lib/tiebreaker.ts)
    const next = resolveTiebreakerRound(
      { ...startTiebreaker(tiebreaker.tiedUnitIds), roundNumber: tiebreaker.roundNumber },
      scores,
      id => units.find(u => u.id === id)?.name || 'Player'
    );

    if (next.phase === 'outro') {
      // Single lowest player is eliminated!
      setTiebreaker(prev => ({
        ...prev,
        phase: 'outro',
        eliminatedUnit: units.find(u => u.id === next.eliminatedUnitId) || null,
      }));
      stopBattleMusic();
      return;
    }

    // Higher rolls advance; players still tied for lowest roll again
    setTiebreaker(prev => ({
      ...prev,
      tiedUnitIds: next.tiedUnitIds,
      currentRollScores: {},
      roundNumber: next.roundNumber,
      noticeMsg: next.noticeMsg,
    }));
    playSfx('s3');
  };

  const handleResetGamePrompt = () => {
    if (!confirm('Start a new game or re-configure players?')) return;
    setPhase('setup');
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between min-h-0 select-none overflow-hidden pb-1 px-1 sm:px-2">
      {/* Top Bar: Round & Mode Information */}
      <div className="w-full flex items-center justify-between py-1 px-2 mb-1 bg-[#131d2e]/90 border border-white/15 rounded-xl shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPhase('setup')}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Back to Player Setup"
          >
            <ArrowLeft className="w-4 h-4 text-stone-300" />
          </button>
          <div className="flex flex-col">
            <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>{isEliminationPhase ? '⚔️ ELIMINATION ROUND' : 'ROUND'} {currentRound}</span>
              <span className="text-[9px] font-bold text-[#f2c14e] bg-black/40 px-1.5 py-0.5 rounded">
                Target: {threshold}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* History Toggle Button */}
          <button
            onClick={() => setShowHistory(h => !h)}
            className={`px-2 py-1 rounded-lg ${
              showHistory ? 'bg-[#28974a] text-white' : 'bg-[#ebdcb9] hover:bg-[#ded1af] text-[#4a3622]'
            } text-[10px] sm:text-xs font-black flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-xs`}
            title="Toggle Roll History (Last 5)"
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          <button
            onClick={handleResetGamePrompt}
            className="px-2 py-1 rounded-lg bg-[#ebdcb9] hover:bg-[#ded1af] text-[#4a3622] text-[10px] sm:text-xs font-black flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-xs"
            title="Reset Game"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Elimination Announcement Banner */}
      {eliminationBanner && (
        <div className="w-full bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-white font-black text-[11px] sm:text-xs py-1.5 px-3 rounded-xl mb-1 text-center shadow-lg animate-pulse border border-yellow-300 shrink-0">
          ⚔️ {eliminationBanner}
        </div>
      )}

      {/* TIEBREAKER ACTIVE ARENA: SHOW ONLY THE PLAYERS INVOLVED IN TIEBREAKER */}
      {tiebreaker.isActive && tiebreaker.phase === 'rolling' ? (
        <div className="flex-1 flex flex-col justify-between min-h-0 bg-[#2b0808]/90 border-2 border-red-500 rounded-2xl p-2.5 sm:p-3 shadow-2xl text-white my-1 overflow-y-auto">
          <div className="flex flex-col items-center text-center mb-2">
            <BattleToSurviveGraphic size="sm" className="mb-1" />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/60 border border-yellow-400 text-yellow-300 font-black text-xs uppercase tracking-wider shadow-md">
              <Swords className="w-4 h-4 text-yellow-300 animate-pulse" />
              <span>Roll-Off Round {tiebreaker.roundNumber}</span>
            </div>
            <p className="text-[11px] text-stone-200 mt-1 font-bold">
              Each tied player rolls one time on the tabletop. Enter their scores below:
            </p>
            {tiebreaker.noticeMsg && (
              <div className="mt-1 px-3 py-1 bg-yellow-400 text-stone-900 font-black text-xs rounded-lg shadow-md animate-bounce">
                {tiebreaker.noticeMsg}
              </div>
            )}
          </div>

          {/* Cards for ONLY players involved in tiebreaker */}
          <div className="space-y-2 mb-3">
            {units
              .filter(u => tiebreaker.tiedUnitIds.includes(u.id))
              .map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-black/60 border border-red-400/50 shadow-md gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm border border-white/40"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name.charAt(0)}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs sm:text-sm font-black text-white truncate">
                        {player.name}
                      </span>
                      <span className="text-[10px] text-stone-400 font-bold">
                        Game Score: {player.score} pts
                      </span>
                    </div>
                  </div>

                  {/* Input for single roll total */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] sm:text-xs font-bold text-yellow-300 uppercase">
                      Roll Score:
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={tiebreaker.currentRollScores[player.id] ?? ''}
                      onChange={e => handleSetTiebreakerScore(player.id, parseInt(e.target.value, 10))}
                      placeholder="0"
                      className="w-16 sm:w-20 px-2 py-1 text-center bg-white text-stone-900 font-black text-sm rounded-lg border-2 border-yellow-400 shadow-inner focus:outline-hidden focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              ))}
          </div>

          {/* Submit Roll-Off Button */}
          <button
            onClick={handleResolveTiebreakerRolls}
            className="w-full py-3 bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:brightness-110 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-xl border-b-4 border-red-800 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <Swords className="w-4 h-4 text-yellow-300" />
            <span>Resolve Roll-Off Results</span>
          </button>
        </div>
      ) : (
        <>
          {/* Boards Strip at the Top */}
          <div className="w-full mb-1 shrink-0">
            <CardsStrip
              units={units}
              activeUnitId={activeUnitId}
              currentRound={currentRound}
              isEliminationPhase={isEliminationPhase}
              onSelectUnit={handleSelectPlayerBoard}
            />
          </div>

          {/* Middle Section: Saved Dice Board (Grows and adapts like PlayScreen) */}
          <div className="flex-1 min-h-0 flex flex-col justify-center transition-all duration-300 relative my-0.5 sm:my-1">
            <SavedBoard
              savedDice={savedDice}
              scoreResult={currentScoreResult}
              onTapSavedDie={handleRemoveSavedDie}
              showSixCelebration={showSixCelebration}
              onDismissSixCelebration={() => setShowSixCelebration(false)}
              forcePips={true}
              colorError={colorErrorMessage}
              eliminationBanner={eliminationBannerUnderLabels}
            />

            {/* Winner overlay if game concluded */}
            {winner && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 rounded-2xl bg-[#140e0a]/95 border-2 border-[#f2c14e] shadow-2xl backdrop-blur-xs text-center animate-scale-up">
                <Award className="w-12 h-12 text-[#f2c14e] mb-2 drop-shadow-md animate-bounce" />
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide mb-1">
                  🏆 {winner.name} Wins!
                </h2>
                <p className="text-xs text-stone-300 mb-4 font-bold">
                  Final Score: {winner.score} Points
                </p>
                <button
                  onClick={() => setPhase('setup')}
                  className="py-2.5 px-6 bg-[#28974a] hover:bg-[#22803e] text-white font-black text-sm rounded-xl shadow-lg border-b-2 border-[#185e2e] cursor-pointer active:scale-95"
                >
                  Start New Game
                </button>
              </div>
            )}
          </div>

          {/* Rolling Area: Row 1 = Red Dice 1-6, Row 2 = Blue Dice 1-6 */}
          <div className="relative w-full rounded-2xl bg-[#144b26] border border-[#2f9a4f]/70 p-1.5 sm:p-2.5 shadow-xl flex flex-col justify-center shrink-0 mb-1.5">
            <div className="flex items-center justify-between px-1 mb-1 border-b border-white/10 pb-0.5">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#f2c14e]">
                INPUT FINAL DICE — <span className="text-white underline">{activeUnit?.name}</span>'S TURN
              </span>
              <span className="text-[9px] text-white/70">
                Tap dice to save • Under 3 score 0 pts
              </span>
            </div>

            {/* Red Dice Row (1 to 6) */}
            <div className="grid grid-cols-6 gap-1 sm:gap-2 mb-1.5 items-center justify-items-center">
              {[1, 2, 3, 4, 5, 6].map(val => (
                <div
                  key={`red-${val}`}
                  className="w-full max-w-[44px] sm:max-w-[50px] aspect-square flex items-center justify-center transition-transform active:scale-90"
                >
                  <DieComponent
                    color="red"
                    value={val}
                    forcePips={true}
                    onClick={() => handleTapPipDie('red', val)}
                    className="hover:brightness-110 shadow-md cursor-pointer"
                  />
                </div>
              ))}
            </div>

            {/* Blue Dice Row (1 to 6) */}
            <div className="grid grid-cols-6 gap-1 sm:gap-2 items-center justify-items-center">
              {[1, 2, 3, 4, 5, 6].map(val => (
                <div
                  key={`blue-${val}`}
                  className="w-full max-w-[44px] sm:max-w-[50px] aspect-square flex items-center justify-center transition-transform active:scale-90"
                >
                  <DieComponent
                    color="blue"
                    value={val}
                    forcePips={true}
                    onClick={() => handleTapPipDie('blue', val)}
                    className="hover:brightness-110 shadow-md cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons: Score It, Undo, and Info */}
          <div className="flex items-center gap-1.5 sm:gap-2 w-full max-w-lg mx-auto shrink-0">
            {/* Score It Button */}
            <button
              onClick={handleScoreIt}
              disabled={!activeUnit || !activeUnit.active || hasColorLimitError}
              className={`flex-1 min-h-[44px] sm:min-h-[48px] py-1.5 px-3 ${
                hasColorLimitError
                  ? 'bg-stone-600/90 border-stone-700 opacity-50 cursor-not-allowed'
                  : 'bg-[#e58a1f] hover:bg-[#cb7512] border-[#a65d0a] cursor-pointer'
              } disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl shadow-md transition-transform active:scale-98 flex flex-col items-center justify-center leading-tight border-b-2`}
              title={hasColorLimitError ? 'Max 6 red and 6 blue allowed. Remove extra dice to score.' : 'Score It'}
            >
              <span className="font-black text-xs sm:text-sm tracking-wide">
                {hasColorLimitError ? 'CANNOT SCORE -' : 'SCORE IT -'}
              </span>
              <span className="font-bold text-[10px] sm:text-xs text-white/95 leading-none mt-0.5">
                {hasColorLimitError ? 'Max 6 Red / 6 Blue' : `${currentScoreResult.total} Points`}
              </span>
            </button>

            {/* Undo Button */}
            <button
              onClick={handleUndo}
              disabled={historyLog.length === 0 && savedDice.length === 0}
              className="min-h-[44px] sm:min-h-[48px] px-3.5 sm:px-4 bg-[#8c745e] hover:bg-[#735d49] disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-transform active:scale-98 flex items-center gap-1 border-b-2 border-[#5c4a3a] cursor-pointer"
              title="Undo last action"
            >
              <Undo2 className="w-4 h-4" />
              <span>Undo</span>
            </button>

            {/* Info / Scoring Guide Button */}
            <button
              onClick={() => setShowInfoModal(true)}
              className="min-h-[44px] sm:min-h-[48px] px-3 sm:px-4 bg-[#e8dec0] hover:bg-[#ded1af] text-[#3e2e1e] font-black text-xs sm:text-sm rounded-xl shadow-md transition-transform active:scale-98 flex items-center justify-center border-b-2 border-[#c8bc9a] cursor-pointer"
              title="Scoring Rules"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* History Modal (Displays Last 5 Completed Rolls) */}
      {showHistory && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl p-4 sm:p-5 max-w-sm w-full shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#ebdcb9]">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#1c6a35]" />
                <h3 className="text-base sm:text-lg font-black text-[#1c6a35]">
                  Roll History (Last 5)
                </h3>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-black/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {historyLog.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500 font-medium">
                  No completed rolls yet. Completed rolls will be recorded here to verify progress.
                </div>
              ) : (
                historyLog
                  .slice(-5)
                  .reverse()
                  .map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white/90 border border-[#ebdcb9] rounded-xl shadow-xs flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase bg-[#ebdcb9] text-[#5c442d] px-2 py-0.5 rounded-md">
                            Round {entry.round}
                          </span>
                          <span className="text-xs font-black text-[#2e2316]">
                            {entry.playerName}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-black text-[#1c6a35] bg-[#28974a]/10 px-2 py-0.5 rounded-md border border-[#28974a]/30">
                          +{entry.addedScore} pts
                        </span>
                      </div>

                      {/* Staged Dice */}
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        {entry.savedDice.map((d, dIdx) => (
                          <div
                            key={dIdx}
                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black text-white shadow-xs ${
                              d.color === 'red' ? 'bg-[#d62828]' : 'bg-[#1f7fd6]'
                            }`}
                          >
                            {d.value}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>

            <button
              onClick={() => setShowHistory(false)}
              className="mt-3 w-full py-2 bg-[#28974a] hover:bg-[#22803e] text-white font-black text-xs sm:text-sm rounded-xl transition-all active:scale-98 cursor-pointer shadow-md"
            >
              Close History
            </button>
          </div>
        </div>
      )}

      {/* Battle to Survive Theatrical Curtain */}
      <BattleVideoOverlay
        isVisible={tiebreaker.isActive && (tiebreaker.phase === 'intro' || tiebreaker.phase === 'outro')}
        phase={tiebreaker.phase}
        eliminatedPlayerName={tiebreaker.eliminatedUnit?.name}
        onIntroComplete={handleTiebreakerIntroComplete}
        onOutroComplete={handleTiebreakerOutroComplete}
      />

      {/* Scoring Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl p-5 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-3.5 right-3.5 text-stone-500 hover:text-stone-800 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-black text-[#1c6a35] mb-2 flex items-center gap-1.5">
              <span>📋</span> Companion Scoring Rules
            </h3>
            <div className="text-xs text-[#4a3622] space-y-2">
              <p>
                <strong>Valid Sets:</strong> Minimum 3 dice of the same number (e.g., three 5s or four 6s).
              </p>
              <p>
                <strong>Points:</strong> Each die in a valid set is worth 5 points.
              </p>
              <p>
                <strong>Color Bonus:</strong> 3 of same color = +10, 4 = +25, 5 = +40, 6 = +100!
              </p>
              <p>
                <strong>Host Tip:</strong> Tap any player's card at the top if players take turns out of sequence.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
