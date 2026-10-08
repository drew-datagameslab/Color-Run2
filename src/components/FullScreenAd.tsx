import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, Play, KeyRound, Check } from 'lucide-react';
import { verifyHomeGameCode } from '../lib/storage';

interface FullScreenAdProps {
  onComplete: () => void;
  onRedeemCode: (code: string) => boolean;
  titleBanner?: string;
  subtitleBanner?: string;
  completionLabel?: string;
}

export const FullScreenAd: React.FC<FullScreenAdProps> = ({
  onComplete,
  onRedeemCode,
  titleBanner = 'Advertisement',
  subtitleBanner = 'Sponsored Showcase',
  completionLabel = 'Continue to Game',
}) => {
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [canSkip, setCanSkip] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [codeError, setCodeError] = useState('');

  // 10-second countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) {
      setCanSkip(true);
      return;
    }

    const timer = setTimeout(() => {
      setSecondsLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    const ok = onRedeemCode(inputCode.trim());
    if (ok) {
      // Successfully redeemed! Skip ad immediately into game
      onComplete();
    } else {
      setCodeError('Code not recognized. Check your user guide or try CR-TEST-TEST');
    }
  };

  const progressPercent = Math.max(0, Math.min(100, ((10 - secondsLeft) / 10) * 100));

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-[#1c1209] via-[#2d1b0f] to-[#120a05] text-[#faf4e6] p-4 sm:p-6 select-none animate-fade-in">
      {/* Top Bar: Advertisement Tag & Countdown */}
      <div className="w-full max-w-md flex items-center justify-between border-b border-[#c9b877]/30 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest bg-[#f2c14e] text-[#2b170a] px-2 py-0.5 rounded shadow-xs">
            {titleBanner}
          </span>
          <span className="text-xs text-[#d3c299] font-medium">
            {subtitleBanner}
          </span>
        </div>

        {/* 10-second countdown pill / Continue Button */}
        <div>
          {!canSkip ? (
            <div className="flex items-center gap-2 bg-black/40 border border-[#c9b877]/40 px-3 py-1 rounded-full text-xs font-mono font-black text-[#f2c14e]">
              <span className="w-2 h-2 rounded-full bg-[#e5352f] animate-ping" />
              <span>{secondsLeft}s remaining</span>
            </div>
          ) : (
            <button
              onClick={onComplete}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-black text-xs rounded-full shadow-lg transition-transform active:scale-95 animate-pulse cursor-pointer"
            >
              <span>{completionLabel}</span>
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full max-w-md h-1 bg-white/10 rounded-full overflow-hidden mt-2">
        <div
          className="h-full bg-[#f2c14e] transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Feature Creative: Color Run Home Edition */}
      <div className="w-full max-w-md my-auto flex flex-col items-center text-center py-4">
        {/* Dice Visual Showcase */}
        <div className="relative mb-4">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-[#e58a1f] to-[#b3630a] p-1 shadow-2xl flex items-center justify-center border-2 border-[#f2c14e]">
            <div className="w-full h-full rounded-2xl bg-[#2b170a] flex flex-col items-center justify-center p-2">
              <div className="text-3xl mb-1">🎲🎲</div>
              <div className="text-[10px] font-black tracking-wider text-[#f2c14e] uppercase">
                Home Edition
              </div>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-[#2f9a4f] text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-white/40 shadow-md">
            12 Custom Dice
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-[#faf4e6] tracking-tight mb-1">
          Color Run: The Physical Tabletop Game
        </h2>
        <p className="text-xs sm:text-sm text-[#d3c299] max-w-xs leading-relaxed mb-4">
          Experience the physical dice roll! Includes 12 carved color dice, rolling playmat, score cards, and the official user guide code.
        </p>

        {/* Feature bullets */}
        <div className="grid grid-cols-2 gap-2 w-full max-w-xs text-left mb-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
            <div className="text-[#f2c14e] font-black text-xs mb-0.5">2–20 Players</div>
            <div className="text-[10px] text-stone-300">Elimination rules &amp; party rounds</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
            <div className="text-[#f2c14e] font-black text-xs mb-0.5">Ad-Free Access</div>
            <div className="text-[10px] text-stone-300">Unlock companion app code</div>
          </div>
        </div>

        {/* Home Game Code Redemption Section */}
        {!showCodeInput ? (
          <button
            onClick={() => setShowCodeInput(true)}
            className="flex items-center gap-1.5 text-xs text-[#f2c14e] hover:text-[#ffd666] font-bold underline cursor-pointer transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Already bought the physical game? Enter code</span>
          </button>
        ) : (
          <form
            onSubmit={handleRedeem}
            className="w-full max-w-xs bg-white/10 border border-[#f2c14e]/40 rounded-2xl p-3 flex flex-col gap-2 mt-1"
          >
            <div className="text-[11px] font-bold text-[#faf4e6] flex items-center justify-between">
              <span>Enter User Guide Code:</span>
              <button
                type="button"
                onClick={() => setShowCodeInput(false)}
                className="text-stone-400 hover:text-white text-[10px]"
              >
                Cancel
              </button>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={inputCode}
                onChange={e => {
                  setInputCode(e.target.value.toUpperCase());
                  setCodeError('');
                }}
                placeholder="e.g. CR-TEST-TEST"
                className="flex-1 bg-black/60 border border-[#c9b877]/60 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#faf4e6] text-center uppercase focus:outline-hidden focus:ring-1 focus:ring-[#f2c14e]"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#2f9a4f] hover:bg-[#268a48] text-white text-xs font-black rounded-xl shadow-xs"
              >
                Unlock
              </button>
            </div>
            {codeError && (
              <div className="text-[10px] text-[#ff6b6b] font-bold text-center">
                {codeError}
              </div>
            )}
            <div className="text-[9px] text-[#d3c299] text-center">
              Removes all ads &amp; unlocks the Companion Scoreboard!
            </div>
          </form>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="w-full max-w-md pt-2 border-t border-[#c9b877]/20 flex flex-col items-center gap-2">
        {canSkip ? (
          <button
            onClick={onComplete}
            className="w-full py-3 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-black text-sm rounded-xl shadow-xl transition-transform active:scale-98 flex items-center justify-center gap-2 border-b-2 border-[#1c6a35]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>START PLAYING NOW</span>
          </button>
        ) : (
          <div className="text-xs text-[#d3c299] font-mono flex items-center gap-1.5">
            <span>Game will launch in</span>
            <span className="font-black text-[#f2c14e] text-sm">{secondsLeft}s</span>
          </div>
        )}
      </div>
    </div>
  );
};
