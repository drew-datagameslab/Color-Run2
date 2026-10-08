import React, { useEffect } from 'react';
import { Sparkles } from 'lucide-react';

interface RisingCoinBubbleProps {
  amount: number;
  isActive: boolean;
  onComplete: () => void;
}

/**
 * Animated golden coin bubble that appears centered and floats
 * up towards the user profile coin counter in the top header.
 */
export const RisingCoinBubble: React.FC<RisingCoinBubbleProps> = ({
  amount,
  isActive,
  onComplete,
}) => {
  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => {
      onComplete();
    }, 1600);
    return () => clearTimeout(timer);
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-100 flex items-center justify-center">
      <style>{`
        @keyframes riseToHeader {
          0% {
            transform: translate(0, 0) scale(0.6);
            opacity: 0;
          }
          20% {
            transform: translate(0, -20px) scale(1.15);
            opacity: 1;
          }
          40% {
            transform: translate(0, -40px) scale(1.05);
            opacity: 1;
          }
          85% {
            transform: translate(calc(-50vw + 90px), calc(-50vh + 35px)) scale(0.8);
            opacity: 0.95;
          }
          100% {
            transform: translate(calc(-50vw + 80px), calc(-50vh + 25px)) scale(0.4);
            opacity: 0;
          }
        }
        .animate-rise-bubble {
          animation: riseToHeader 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>
      <div className="animate-rise-bubble flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#ffd700] via-[#f7b731] to-[#fa8231] text-[#2c1d02] font-black text-xl sm:text-2xl shadow-[0_10px_30px_rgba(247,183,49,0.7)] border-3 border-[#fff3b0] filter drop-shadow-xl select-none">
        <span className="text-2xl sm:text-3xl animate-spin-slow">🪙</span>
        <span>+{amount.toLocaleString()} Coins</span>
        <Sparkles className="w-6 h-6 text-white animate-pulse" />
      </div>
    </div>
  );
};
