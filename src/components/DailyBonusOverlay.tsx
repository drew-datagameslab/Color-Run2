import React, { useState } from 'react';
import { Sparkles, Dices } from 'lucide-react';
import { playRollDiceSound, playSfx } from '../lib/audio';
import { RisingCoinBubble } from './RisingCoinBubble';
import { ThreeDDice } from './ThreeDDice';

interface DailyBonusOverlayProps {
  isOpen: boolean;
  /**
   * Rolls the two dice on the server (which also credits the coins). Resolves to the dice,
   * null when offline (roll locally), or 'unavailable' when the bonus can't be claimed.
   */
  onRoll?: () => Promise<{ red: number; blue: number } | null | 'unavailable'>;
  onClaim: (coinsWon: number) => void;
  onClose: () => void;
}

export const DailyBonusOverlay: React.FC<DailyBonusOverlayProps> = ({
  isOpen,
  onRoll,
  onClaim,
  onClose,
}) => {
  const [redDie, setRedDie] = useState<number>(3);
  const [blueDie, setBlueDie] = useState<number>(4);
  const [isRolling, setIsRolling] = useState(false);
  const [rollId, setRollId] = useState(0);
  const [hasRolled, setHasRolled] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [coinsWon, setCoinsWon] = useState(0);

  if (!isOpen) return null;

  const handleRoll = async () => {
    if (isRolling || hasRolled) return;
    setIsRolling(true);

    const serverRoll = onRoll ? await onRoll() : null;
    if (serverRoll === 'unavailable') {
      setIsRolling(false);
      onClose();
      return;
    }

    // Server dice when online, otherwise local random numbers
    const finalRed = serverRoll ? serverRoll.red : Math.floor(Math.random() * 6) + 1;
    const finalBlue = serverRoll ? serverRoll.blue : Math.floor(Math.random() * 6) + 1;

    setRedDie(finalRed);
    setBlueDie(finalBlue);
    setIsRolling(true);
    setRollId(prev => prev + 1);

    // Initial toss rattle
    playRollDiceSound();

    // Table clatter sfx on bounce hits
    const t1 = setTimeout(() => {
      playSfx('s3');
    }, 720);

    const t2 = setTimeout(() => {
      playSfx('add');
    }, 1300);

    // Settle after 1.6s of dynamic 3D tumbling
    const t3 = setTimeout(() => {
      setIsRolling(false);
      setHasRolled(true);

      const totalPips = finalRed + finalBlue;
      const won = totalPips * 10;
      setCoinsWon(won);
      playSfx('fanfare');

      // Trigger rising coin bubble
      setTimeout(() => {
        setShowBubble(true);
      }, 550);
    }, 1650);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
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

          <p className="text-sm sm:text-base font-bold text-[#6a4f35] mb-4">
            Roll the dice for your daily bonus
          </p>

          {/* Green Felt Dice Rolling Tray */}
          <div className="w-full bg-gradient-to-b from-[#195932] to-[#0f381f] border-2 border-[#f2c14e]/60 rounded-2xl py-3 px-2 mb-5 flex items-center justify-center gap-5 sm:gap-7 shadow-[inset_0_4px_16px_rgba(0,0,0,0.6),0_6px_18px_rgba(0,0,0,0.25)] relative overflow-hidden">
            {/* Subtle felt surface texture */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.08)_0%,transparent_70%)] pointer-events-none" />

            {/* Red Die */}
            <div className="flex flex-col items-center gap-1 relative z-10">
              <ThreeDDice
                value={redDie}
                color="red"
                isRolling={isRolling}
                rollId={rollId}
                size={82}
              />
              <span
                className={`text-xs font-black uppercase tracking-wider transition-colors ${
                  isRolling
                    ? 'text-white/60 animate-pulse'
                    : 'text-[#ff9692] drop-shadow-xs'
                }`}
              >
                {isRolling ? 'Rolling...' : `${redDie} ${redDie === 1 ? 'Pip' : 'Pips'}`}
              </span>
            </div>

            {/* Plus sign */}
            <div className="text-2xl font-black text-[#f2c14e] drop-shadow-md z-10">+</div>

            {/* Blue Die */}
            <div className="flex flex-col items-center gap-1 relative z-10">
              <ThreeDDice
                value={blueDie}
                color="blue"
                isRolling={isRolling}
                rollId={rollId}
                size={82}
              />
              <span
                className={`text-xs font-black uppercase tracking-wider transition-colors ${
                  isRolling
                    ? 'text-white/60 animate-pulse'
                    : 'text-[#8ec5fc] drop-shadow-xs'
                }`}
              >
                {isRolling ? 'Rolling...' : `${blueDie} ${blueDie === 1 ? 'Pip' : 'Pips'}`}
              </span>
            </div>
          </div>

          {/* Rules Explanation & Payout Indicator */}
          <div className="w-full bg-white/85 border border-[#ebdcb9] rounded-2xl p-3 mb-5 flex flex-col items-center shadow-xs">
            <div className="text-xs font-bold text-[#5c442d] flex items-center gap-1.5">
              <span>Each pip rewards</span>
              <span className="font-black text-[#1c6a35] font-mono">🪙 10 Coins</span>
            </div>
            {hasRolled && (
              <div className="mt-1.5 text-sm font-black text-[#1c6a35] animate-scale-in">
                {totalPips} pips rolled = <span className="font-mono text-base text-[#155328]">🪙 {coinsWon} Coins!</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          {!hasRolled ? (
            <button
              onClick={handleRoll}
              disabled={isRolling}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-[#2f9a4f] to-[#1c6a35] hover:from-[#37ab59] hover:to-[#227e3f] text-white font-black text-base sm:text-lg rounded-2xl shadow-xl border-b-4 border-[#145025] transition-all active:scale-98 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <Dices className={`w-5 h-5 sm:w-6 sm:h-6 ${isRolling ? 'animate-spin' : ''}`} />
              <span>{isRolling ? 'ROLLING...' : 'ROLL THE DICE'}</span>
            </button>
          ) : (
            <div className="text-xs font-bold text-[#6a4f35] py-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#e58a1f] animate-spin" />
              <span>Claiming your bonus...</span>
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
