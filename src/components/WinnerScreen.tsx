import React, { useEffect, useState, useRef } from 'react';
import { Trophy, RotateCcw, Home, Sparkles, ChevronDown, ChevronUp, Award } from 'lucide-react';
import { PlayerUnit, GameSettings, UserAccount } from '../types/game';
import { playSfx } from '../lib/audio';
import { MatchXpResult, calculateLevelFromTotalXp, getXpForNextLevel } from '../lib/levelSystem';

interface WinnerScreenProps {
  winner: PlayerUnit;
  units: PlayerUnit[];
  settings?: GameSettings | null;
  wonCoins?: number;
  xpResult?: MatchXpResult | null;
  currentUser?: UserAccount;
  onCoinsAwarded?: (amount: number) => void;
  onPlayAgain: () => void;
  onHome: () => void;
}

export const WinnerScreen: React.FC<WinnerScreenProps> = ({
  winner,
  units,
  settings,
  wonCoins = 0,
  xpResult,
  currentUser,
  onCoinsAwarded,
  onPlayAgain,
  onHome,
}) => {
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
  const [isFloating, setIsFloating] = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [showXpBreakdown, setShowXpBreakdown] = useState(false);
  const awardedRef = useRef(false);

  const awardCoinsOnce = (amount: number) => {
    if (awardedRef.current || amount <= 0) return;
    awardedRef.current = true;
    onCoinsAwarded?.(amount);
  };

  useEffect(() => {
    playSfx('fanfare');
  }, []);

  useEffect(() => {
    if (!wonCoins || wonCoins <= 0) return;

    let holdTimer: NodeJS.Timeout;
    let floatTimer: NodeJS.Timeout;

    // Position bubble directly over the line showing the user's name
    const raf = requestAnimationFrame(() => {
      const userRowEl = document.getElementById('winner-user-row');
      if (!userRowEl) return;

      const rect = userRowEl.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;

      setBubblePos({ x: startX, y: startY });
      setBubbleVisible(true);

      // Hold on the line for 2 seconds
      holdTimer = setTimeout(() => {
        // Target: left side of the User bar at the top of the screen
        const targetEl =
          document.getElementById('header-user-coins') ||
          document.getElementById('header-user-bar');
        const targetRect = targetEl?.getBoundingClientRect();

        const endX = targetRect ? targetRect.left + targetRect.width / 2 : 65;
        const endY = targetRect ? targetRect.top + targetRect.height / 2 : 28;

        setBubblePos({ x: endX, y: endY });
        setIsFloating(true);

        // Float duration is 750ms
        floatTimer = setTimeout(() => {
          setBubbleVisible(false);
          playSfx('add');
          awardCoinsOnce(wonCoins);
        }, 750);
      }, 2000);
    });

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(holdTimer);
      clearTimeout(floatTimer);
      // Guarantee player receives their coins even if they leave before animation finishes
      if (!awardedRef.current && wonCoins > 0) {
        awardCoinsOnce(wonCoins);
      }
    };
  }, [wonCoins]);

  const handleSafePlayAgain = () => {
    if (wonCoins > 0 && !awardedRef.current) {
      awardCoinsOnce(wonCoins);
    }
    onPlayAgain();
  };

  const handleSafeHome = () => {
    if (wonCoins > 0 && !awardedRef.current) {
      awardCoinsOnce(wonCoins);
    }
    onHome();
  };

  const ranked = [...units].sort((a, b) => {
    if (a.id === winner.id) return -1;
    if (b.id === winner.id) return 1;
    return (a.place || 99) - (b.place || 99) || b.score - a.score;
  });

  const levelInfo = calculateLevelFromTotalXp(currentUser?.totalXp || 0);

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-start max-h-[92vh] overflow-y-auto p-2 sm:p-3 select-none my-auto relative custom-scrollbar">
      {/* Floating Won Coins Bubble */}
      {bubbleVisible && bubblePos && wonCoins > 0 && (
        <div
          id="winner-won-coin-bubble"
          className="fixed z-50 pointer-events-none flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-[#3b2a0c] font-black text-xs sm:text-sm shadow-[0_4px_16px_rgba(245,158,11,0.65)] border-2 border-yellow-100 whitespace-nowrap"
          style={{
            left: `${bubblePos.x}px`,
            top: `${bubblePos.y}px`,
            transform: isFloating
              ? 'translate(-50%, -50%) scale(0.85)'
              : 'translate(-50%, -50%) scale(1.05)',
            transition: isFloating
              ? 'all 750ms cubic-bezier(0.2, 0.8, 0.25, 1)'
              : 'transform 0.2s ease-out',
          }}
        >
          <span className="drop-shadow-xs">+ 🪙 {wonCoins.toLocaleString()}</span>
        </div>
      )}

      <div className="w-full bg-[#faf4e6]/98 border-2 border-[#c9b877] rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col items-center">
        {/* Crown & Avatar */}
        <div className="relative mb-1.5">
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
            👑
          </div>
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-3 border-[#f2c14e] shadow-lg flex items-center justify-center text-lg sm:text-xl font-black text-white overflow-hidden"
            style={{
              backgroundColor: winner.color,
              backgroundImage: winner.image ? `url(${winner.image})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!winner.image && (winner.name.slice(0, 2).toUpperCase() || 'W')}
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-[#1c6a35] text-center mb-0.5">
          {winner.name} Wins!
        </h2>
        <div className="text-xs sm:text-sm font-bold text-[#e58a1f] mb-2.5">
          Final Score: {winner.score} Points
        </div>

        {/* Standings List */}
        <div className="w-full bg-white/80 border border-[#ebdcb9] rounded-2xl p-2 mb-2.5 max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar">
          {ranked.map((p, idx) => {
            const isMe = !p.isCPU;
            return (
              <div
                key={p.id}
                id={isMe ? 'winner-user-row' : undefined}
                className={`relative flex items-center justify-between py-1.5 px-2 rounded-xl text-xs font-bold transition-colors ${
                  idx === 0
                    ? 'bg-[#2f9a4f]/15 text-[#1c6a35]'
                    : !p.isCPU
                    ? 'bg-[#fef8d8] text-[#4a3622] border border-[#d3bb71]/60'
                    : 'bg-[#faf6eb] text-[#4a3622]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="w-4 text-center font-black text-[11px] shrink-0">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <span className="truncate max-w-[130px]">
                    {p.isCPU ? '🤖 ' : ''}
                    {p.name}
                    {!p.isCPU ? ' (You)' : ''}
                  </span>
                </div>
                <div className="font-mono text-xs font-black shrink-0">
                  {p.score} pts
                </div>
              </div>
            );
          })}
        </div>

        {/* Level & Match XP Card */}
        {xpResult && (
          <div className="w-full bg-[#f4ecdb] border border-[#d6c497] rounded-2xl p-2.5 mb-3 text-left shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">⚡</span>
                <span className="font-black text-xs text-[#2c1d11]">Match XP Earned</span>
              </div>
              <span className="font-black text-xs text-[#1c6a35] bg-[#2f9a4f]/15 px-2 py-0.5 rounded-full">
                +{xpResult.totalXp} XP
              </span>
            </div>

            {/* Level Bar */}
            <div className="w-full mb-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-[#6d5138] mb-1">
                <span>
                  {currentUser?.prestige && currentUser.prestige > 0 ? `⭐ Prestige ${currentUser.prestige} ` : ''}
                  Level {levelInfo.level}
                </span>
                <span>
                  {levelInfo.level >= 50
                    ? 'Max Level (Prestige Ready!)'
                    : `${levelInfo.xpInLevel} / ${levelInfo.xpNeededForNext} XP (${levelInfo.progressPercent}%)`}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#ded1b6] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Level Up Celebration Banner */}
            {xpResult.leveledUp && (
              <div className="my-1.5 p-2 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-400/25 to-amber-500/20 border border-amber-400/80 animate-bounce-subtle text-center">
                <div className="inline-flex items-center gap-1 text-xs font-black text-[#855307]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>LEVEL UP! Reached Level {xpResult.newLevel}!</span>
                </div>
                {xpResult.unlockedRewards.length > 0 && (
                  <div className="text-[11px] font-bold text-[#4a3622] mt-0.5">
                    🎁 Unlocked: {xpResult.unlockedRewards.map(r => r.title).join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Expandable Breakdown Details */}
            <button
              onClick={() => setShowXpBreakdown(!showXpBreakdown)}
              className="w-full flex items-center justify-between text-[10px] font-bold text-[#8c745e] hover:text-[#5c4a3a] pt-1 border-t border-[#e2d5ba] cursor-pointer"
            >
              <span>View XP Breakdown</span>
              {showXpBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showXpBreakdown && (
              <div className="mt-1 space-y-0.5 text-[10px] text-[#5c4a3a] font-medium pt-1">
                {xpResult.breakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-0.5">
                    <span>{item.label}</span>
                    <span className="font-bold text-[#2f9a4f]">+{item.xp} XP</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="w-full flex flex-col gap-1.5">
          <button
            onClick={handleSafePlayAgain}
            className="w-full py-2.5 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 border-b-3 border-[#1b6b33] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>PLAY AGAIN</span>
          </button>
          <button
            onClick={handleSafeHome}
            className="w-full py-2 bg-[#eae0c5] hover:bg-[#ded1af] text-[#4a3622] font-bold text-xs rounded-xl transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};

