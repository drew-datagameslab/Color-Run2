import React, { useState, useEffect } from 'react';
import { Smartphone } from 'lucide-react';

export const PortraitLockOverlay: React.FC = () => {
  const [isLandscape, setIsLandscape] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const ratio = w / Math.max(h, 1);

      // Foldable phones unfolded (like Samsung Galaxy Z Fold) and tablets have square-ish ratios (~0.75 to 1.33)
      // or substantial dimensions (min dimension >= 550px).
      // With our maximum screen width constraint (9:16 screen ratio), they display the game with zero issues.
      const isFoldableOrTablet = Math.min(w, h) >= 550 || (ratio >= 0.75 && ratio <= 1.35);

      if (isFoldableOrTablet) {
        setIsLandscape(false);
        return;
      }

      // Only trigger if it is a phone held sideways in true landscape (aspect ratio > 1.38 and height < 520px)
      const isTouchDevice =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches;

      if (isTouchDevice && ratio > 1.38 && h < 520) {
        setIsLandscape(true);
      } else {
        setIsLandscape(false);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isLandscape || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0c1420]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white select-none animate-fade-in">
      {/* Animated Rotating Phone Icon */}
      <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#f2c14e]/15 animate-ping opacity-75" />
        <div className="w-14 h-14 rounded-2xl bg-[#144b26] border-2 border-[#54e38e] flex items-center justify-center shadow-2xl animate-[spin_3s_ease-in-out_infinite]">
          <Smartphone className="w-8 h-8 text-[#f2c14e]" />
        </div>
      </div>

      <h2 className="text-xl sm:text-2xl font-black text-[#f2c14e] uppercase tracking-wide mb-2 drop-shadow-md">
        Please Rotate Your Device
      </h2>

      <p className="text-xs sm:text-sm text-white/80 max-w-xs leading-relaxed mb-4">
        Color Run is optimized to be played in <strong className="text-[#54e38e]">portrait mode</strong> for the best dice rolling and scoring experience.
      </p>

      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-white/90">
          <span>📱</span> Rotate to Portrait
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="px-3 py-1.5 rounded-full bg-[#28974a] hover:bg-[#22803f] text-white text-xs font-bold border border-white/30 cursor-pointer active:scale-95 transition-all shadow-md"
        >
          Play Anyway
        </button>
      </div>
    </div>
  );
};
