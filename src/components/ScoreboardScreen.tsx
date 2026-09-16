import React, { useState } from 'react';
import { ArrowLeft, UserPlus, Trash2, Trophy, RotateCcw, Lock, KeyRound, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { ScoreboardPlayer } from '../types/game';

interface ScoreboardScreenProps {
  isUnlocked: boolean;
  onUnlockCode: (code: string) => boolean;
  onBack: () => void;
}

export const ScoreboardScreen: React.FC<ScoreboardScreenProps> = ({
  isUnlocked,
  onUnlockCode,
  onBack,
}) => {
  const [players, setPlayers] = useState<ScoreboardPlayer[]>([
    { name: 'Player 1', type: 'human', total: 0, active: true, history: {} },
    { name: 'Player 2', type: 'human', total: 0, active: true, history: {} },
    { name: 'Player 3', type: 'human', total: 0, active: true, history: {} },
  ]);
  const [round, setRound] = useState(1);
  const [threshold] = useState(250);
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [scoreInput, setScoreInput] = useState('');
  const [isElimPhase, setIsElimPhase] = useState(false);

  // Lock screen code input state
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState('');

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

  const addPlayer = () => {
    if (players.length >= 20) return;
    const newP: ScoreboardPlayer = {
      name: `Player ${players.length + 1}`,
      type: 'human',
      total: 0,
      active: true,
      history: {},
    };
    setPlayers([...players, newP]);
  };

  const removePlayer = (idx: number) => {
    if (players.length <= 2) return;
    setPlayers(players.filter((_, i) => i !== idx));
  };

  const commitTurnScore = (pts: number) => {
    if (isNaN(pts)) return;
    const updated = [...players];
    const cur = updated[activePlayerIdx];
    if (!cur) return;

    cur.history[round] = pts;
    cur.total += pts;

    // Check if threshold reached
    if (!isElimPhase && cur.total >= threshold) {
      setIsElimPhase(true);
    }

    setPlayers(updated);
    setScoreInput('');

    // Advance to next active player
    let nextIdx = (activePlayerIdx + 1) % players.length;
    let loopGuard = 0;
    while (!players[nextIdx]?.active && loopGuard++ < players.length) {
      nextIdx = (nextIdx + 1) % players.length;
    }

    if (nextIdx <= activePlayerIdx) {
      // Completed full round!
      if (isElimPhase) {
        // Knock out lowest active player
        const activeOnly = updated.filter(p => p.active);
        if (activeOnly.length > 1) {
          const minScore = Math.min(...activeOnly.map(p => p.total));
          const toKnock = activeOnly.find(p => p.total === minScore);
          if (toKnock) {
            toKnock.active = false;
            toKnock.place = activeOnly.length;
          }
        }
      }
      setRound(r => r + 1);
    }

    setActivePlayerIdx(nextIdx);
  };

  const resetGame = () => {
    if (!confirm('Reset current game and scores?')) return;
    setPlayers(players.map(p => ({ ...p, total: 0, active: true, place: undefined, history: {} })));
    setRound(1);
    setActivePlayerIdx(0);
    setIsElimPhase(false);
  };

  const curPlayer = players[activePlayerIdx];

  return (
    <div className="w-full max-w-lg mx-auto p-3 sm:p-4 flex flex-col min-h-[85vh]">
      <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#ebdcb9]">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-1 rounded-full hover:bg-black/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#5c4937]" />
            </button>
            <h2 className="text-lg sm:text-xl font-black text-[#1c6a35]">
              Companion Scoreboard
            </h2>
            <span className="hidden sm:inline-block text-[10px] font-bold bg-[#2f9a4f]/15 text-[#1c6a35] px-2 py-0.5 rounded-full border border-[#2f9a4f]/30">
              Ad-Free
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={resetGame}
              className="p-1.5 rounded-lg bg-[#ebdcb9] hover:bg-[#ded1af] text-[#4a3622] text-xs font-bold flex items-center gap-1"
              title="Reset Game"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between bg-white/80 border border-[#ebdcb9] rounded-xl px-3 py-1.5 mb-3 text-xs font-bold">
          <span className="text-[#5e4933]">
            Round <span className="font-mono text-[#1c6a35] text-sm">{round}</span>
          </span>
          <span className={isElimPhase ? 'text-[#e5352f] animate-pulse' : 'text-[#8c745e]'}>
            {isElimPhase ? '⚔️ Elimination Active' : `Race to ${threshold} pts`}
          </span>
        </div>

        {/* Current Turn Keypad */}
        {curPlayer && curPlayer.active && (
          <div className="bg-[#2f9a4f]/10 border border-[#2f9a4f]/30 rounded-2xl p-3 mb-4 flex flex-col items-center">
            <div className="text-xs font-bold text-[#1c6a35] mb-1">
              Current Turn: <span className="text-sm font-black underline">{curPlayer.name}</span>
            </div>
            <div className="flex items-center gap-2 w-full max-w-xs">
              <input
                type="number"
                placeholder="Points (e.g. 50)"
                value={scoreInput}
                onChange={e => setScoreInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && scoreInput) {
                    commitTurnScore(parseInt(scoreInput, 10) || 0);
                  }
                }}
                className="flex-1 px-3 py-2 text-base font-mono font-bold bg-white border border-[#2f9a4f]/40 rounded-xl text-center text-[#1c6a35] focus:outline-hidden focus:ring-2 focus:ring-[#2f9a4f]"
              />
              <button
                onClick={() => commitTurnScore(parseInt(scoreInput, 10) || 0)}
                className="px-4 py-2 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-bold text-sm rounded-xl shadow-md transition-transform active:scale-95"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Players List */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1 max-h-[42vh]">
          {players.map((p, idx) => {
            const isTurn = idx === activePlayerIdx && p.active;
            return (
              <div
                key={idx}
                onClick={() => p.active && setActivePlayerIdx(idx)}
                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${isTurn ? 'bg-[#fffdf7] border-[#2f9a4f] ring-2 ring-[#2f9a4f]/50 shadow-md' : 'bg-white/70 border-[#ebdcb9] hover:bg-white'} ${!p.active ? 'opacity-40 grayscale-[60%]' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-[#1c6a35] text-white flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#2e2316] truncate">
                      {p.name}
                    </div>
                    {!p.active && (
                      <div className="text-[10px] text-[#e5352f] font-bold">
                        Eliminated ({p.place || '?'} place)
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-base font-mono font-black text-[#1c6a35]">
                    {p.total} pts
                  </div>
                  {players.length > 2 && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        removePlayer(idx);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Player button */}
        {players.length < 20 && (
          <button
            onClick={addPlayer}
            className="w-full py-2 bg-[#eae0c5] hover:bg-[#ded1af] text-[#4a3622] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Player (Max 20)</span>
          </button>
        )}
      </div>
    </div>
  );
};
