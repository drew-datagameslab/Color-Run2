import React, { useState, useEffect } from 'react';
import { Smartphone } from 'lucide-react';

export const PortraitLockOverlay: React.FC = () => {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Trigger if width > height AND height is mobile/tablet scale (< 700px)
      // or if screen.orientation indicates landscape on touch devices
      const isTouchDevice =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches;

      const landscapeByDimensions = window.innerWidth > window.innerHeight && window.innerHeight < 700;
      const landscapeByOrientation =
        window.screen?.orientation?.type?.startsWith('landscape') && window.innerHeight < 768;

      if (isTouchDevice && (landscapeByDimensions || landscapeByOrientation)) {
        setIsLandscape(true);
      } else if (landscapeByDimensions && window.innerHeight < 550) {
        // Very short desktop/embedded iframe landscape
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

  if (!isLandscape) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0c1420]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white select-none animate-fade-in">
      {/* Animated Rotating Phone Icon */}
      <div className="relative w-20 h-20 mb-5 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#f2c14e]/15 animate-ping opacity-75" />
        <div className="w-16 h-16 rounded-2xl bg-[#144b26] border-2 border-[#54e38e] flex items-center justify-center shadow-2xl animate-[spin_3s_ease-in-out_infinite]">
          <Smartphone className="w-9 h-9 text-[#f2c14e]" />
        </div>
      </div>

      <h2 className="text-xl sm:text-2xl font-black text-[#f2c14e] uppercase tracking-wide mb-2 drop-shadow-md">
        Please Rotate Your Device
      </h2>

      <p className="text-xs sm:text-sm text-white/80 max-w-xs leading-relaxed mb-4">
        Color Run is optimized to be played in <strong className="text-[#54e38e]">portrait mode</strong> for the best dice rolling and scoring experience.
      </p>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-white/90">
        <span>📱</span> Rotate to Portrait
      </div>
    </div>
  );
};
