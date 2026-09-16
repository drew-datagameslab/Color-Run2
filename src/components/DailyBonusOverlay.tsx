import React, { useState } from 'react';
import { Sparkles, Dices } from 'lucide-react';
import { playRollDiceSound } from '../lib/audio';
import { RisingCoinBubble } from './RisingCoinBubble';

interface DailyBonusOverlayProps {
  isOpen: boolean;
  onClaim: (coinsWon: number) => void;
  onClose: () => void;
}

// Normal pip dice face component (1 - 6)
const PipDie: React.FC<{ value: number; color: 'red' | 'blue'; isRolling: boolean }> = ({
  value,
  color,
  isRolling,
}) => {
  const bgClass = color === 'red'
    ? 'bg-gradient-to-br from-[#f24741] via-[#d62822] to-[#9c1813] border-[#ff7b75]'
    : 'bg-gradient-to-br from-[#3092ed] via-[#1a74c8] to-[#124d85] border-[#68b2f7]';

  // Standard 3x3 grid positions for 1-6 pips
  const pipPatterns: Record<number, number[]> = {
    1: [4],
    2: [2, 6],
    3: [2, 4, 6],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  const activePips = pipPatterns[value] || [4];

  return (
    <div
      className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-3.5 border-3 shadow-2xl flex flex-col justify-between select-none transition-transform duration-150 ${bgClass} ${
        isRolling ? 'animate-bounce scale-105 rotate-6' : 'hover:scale-102'
      }`}
      style={{
        boxShadow: color === 'red'
          ? '0 12px 25px -4px rgba(214, 40, 34, 0.6), inset 0 2px 4px rgba(255,255,255,0.4)'
          : '0 12px 25px -4px rgba(26, 116, 200, 0.6), inset 0 2px 4px rgba(255,255,255,0.4)',
      }}
    >
      <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-1.5 items-center justify-items-center">
        {Array.from({ length: 9 }).map((_, idx) => {
          const isPip = activePips.includes(idx);
          return (
            <div
              key={idx}
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full transition-opacity ${
                isPip
                  ? 'bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.3),0_1px_1px_rgba(255,255,255,0.8)] opacity-100 scale-100'
                  : 'opacity-0 scale-50'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

export const DailyBonusOverlay: React.FC<DailyBonusOverlayProps> = ({
  isOpen,
  onClaim,
  onClose,
}) => {
  const [redDie, setRedDie] = useState<number>(3);
  const [blueDie, setBlueDie] = useState<number>(4);
  const [isRolling, setIsRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [coinsWon, setCoinsWon] = useState(0);

  if (!isOpen) return null;

  const handleRoll = () => {
    if (isRolling || hasRolled) return;
    setIsRolling(true);
    playRollDiceSound();

    let rollCount = 0;
    const interval = setInterval(() => {
      setRedDie(Math.floor(Math.random() * 6) + 1);
      setBlueDie(Math.floor(Math.random() * 6) + 1);
      rollCount++;

      if (rollCount >= 14) {
        clearInterval(interval);
        const finalRed = Math.floor(Math.random() * 6) + 1;
        const finalBlue = Math.floor(Math.random() * 6) + 1;
        setRedDie(finalRed);
        setBlueDie(finalBlue);
        setIsRolling(false);
        setHasRolled(true);

        const totalPips = finalRed + finalBlue;
        const won = totalPips * 10;
        setCoinsWon(won);

        // Trigger rising coin bubble
        setTimeout(() => {
          setShowBubble(true);
        }, 500);
      }
    }, 80);
  };

  const handleBubbleComplete = () => {
    setShowBubble(false);
    onClaim(coinsWon);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const totalPips = redDie + blueDie;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none animate-fade-in">
        <div className="w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#faf4e6] to-[#f3e6c8] border-3 border-[#f2c14e] rounded-3xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center relative overflow-hidden">
          {/* Header decorative ribbons */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-20 bg-gradient-to-r from-[#f2c14e]/20 to-[#e58a1f]/20 rounded-full blur-xl pointer-events-none" />

          {/* Title & Subtitle */}
          <div className="flex items-center gap-2 mb-1 text-[#f2c14e]">
            <Sparkles className="w-6 h-6 animate-pulse text-[#e58a1f]" />
            <span className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-[#1c6a35]">
              Daily Bonus
            </span>
            <Sparkles className="w-6 h-6 animate-pulse text-[#e58a1f]" />
          </div>

          <p className="text-sm sm:text-base font-bold text-[#6a4f35] mb-6">
            Roll the dice for your daily bonus
          </p>

          {/* Dice Stage */}
          <div className="flex items-center justify-center gap-5 sm:gap-7 mb-6 py-2">
            <div className="flex flex-col items-center gap-1.5">
              <PipDie value={redDie} color="red" isRolling={isRolling} />
              <span className="text-xs font-black uppercase text-[#d62822] tracking-wider">
                {redDie} {redDie === 1 ? 'Pip' : 'Pips'}
              </span>
            </div>

            <div className="text-2xl font-black text-[#a68662]">+</div>

            <div className="flex flex-col items-center gap-1.5">
              <PipDie value={blueDie} color="blue" isRolling={isRolling} />
              <span className="text-xs font-black uppercase text-[#1a74c8] tracking-wider">
                {blueDie} {blueDie === 1 ? 'Pip' : 'Pips'}
              </span>
            </div>
          </div>

          {/* Rules Explanation & Payout Indicator */}
          <div className="w-full bg-white/80 border border-[#ebdcb9] rounded-2xl p-3 mb-6 flex flex-col items-center">
            <div className="text-xs font-bold text-[#5c442d] flex items-center gap-1.5">
              <span>Each pip rewards</span>
              <span className="font-black text-[#1c6a35] font-mono">🪙 10 Coins</span>
            </div>
            {hasRolled && (
              <div className="mt-1 text-sm font-black text-[#1c6a35] animate-scale-in">
                {totalPips} pips rolled = <span className="font-mono text-base">🪙 {coinsWon} Coins!</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          {!hasRolled ? (
            <button
              onClick={handleRoll}
              disabled={isRolling}
              className="w-full py-4 px-6 bg-gradient-to-r from-[#2f9a4f] to-[#1c6a35] hover:from-[#37ab59] hover:to-[#227e3f] text-white font-black text-lg rounded-2xl shadow-xl border-b-4 border-[#145025] transition-all active:scale-98 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <Dices className={`w-6 h-6 ${isRolling ? 'animate-spin' : ''}`} />
              <span>{isRolling ? 'ROLLING...' : 'ROLL THE DICE'}</span>
            </button>
          ) : (
            <div className="text-xs font-bold text-[#6a4f35] py-2">
              Claiming your bonus...
            </div>
          )}
        </div>
      </div>

      {/* Floating Coin Bubble that rises to user profile coin total */}
      <RisingCoinBubble
        amount={coinsWon}
        isActive={showBubble}
        onComplete={handleBubbleComplete}
      />
    </>
  );
};
