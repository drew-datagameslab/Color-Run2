import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BattleToSurviveGraphic } from './BattleToSurviveGraphic';

interface BattleToSurviveCurtainProps {
  isVisible: boolean;
  phase: 'intro' | 'outro' | null;
  eliminatedPlayerName?: string;
  onIntroComplete?: () => void;
  onOutroComplete?: () => void;
}

export const BattleToSurviveCurtain: React.FC<BattleToSurviveCurtainProps> = ({
  isVisible,
  phase,
  eliminatedPlayerName,
  onIntroComplete,
  onOutroComplete,
}) => {
  useEffect(() => {
    if (!isVisible) return;

    if (phase === 'intro') {
      // Show for exactly 2 seconds, then raise the curtain
      const timer = setTimeout(() => {
        if (onIntroComplete) onIntroComplete();
      }, 2000);
      return () => clearTimeout(timer);
    }

    if (phase === 'outro') {
      // Show for exactly 3 seconds, then return to normal gameplay
      const timer = setTimeout(() => {
        if (onOutroComplete) onOutroComplete();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, phase, onIntroComplete, onOutroComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="battle-to-survive-curtain"
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at center, #a61c1c 0%, #750808 60%, #3d0202 100%)',
          }}
        >
          {/* Theatrical Curtain Texture (Folds & Lighting) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(0,0,0,0.4) 0px, transparent 24px, rgba(255,255,255,0.15) 48px, transparent 72px, rgba(0,0,0,0.5) 96px)',
            }}
          />

          {/* Golden Stage Fringe Top & Bottom */}
          <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-r from-yellow-600 via-amber-300 to-yellow-600 shadow-md border-b border-yellow-200/50" />
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-r from-yellow-600 via-amber-300 to-yellow-600 shadow-md border-t border-yellow-200/50" />

          {/* Central Animated Content with Grow Animation */}
          <motion.div
            initial={{ scale: 0.25, opacity: 0 }}
            animate={{ scale: [0.25, 1.15, 1.0], opacity: 1 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            className="relative z-10 flex flex-col items-center justify-center p-4 max-w-lg w-full text-center"
          >
            {/* High-res Graphic */}
            <BattleToSurviveGraphic size="hero" className="mb-4" />

            {/* Suspenseful Mode Badge */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-2"
            >
              {phase === 'intro' ? (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/60 border-2 border-yellow-400 text-yellow-300 font-black text-xs sm:text-sm tracking-widest uppercase shadow-2xl animate-pulse">
                  <span>⚡ ROLL-OFF FOR SURVIVAL ⚡</span>
                </div>
              ) : (
                <div className="inline-flex flex-col items-center gap-1 px-5 py-2 rounded-2xl bg-black/75 border-2 border-red-500 text-white font-black text-xs sm:text-sm tracking-wider uppercase shadow-2xl">
                  <span className="text-yellow-300">⚔️ ELIMINATION DECIDED ⚔️</span>
                  {eliminatedPlayerName && (
                    <span className="text-red-400 text-xs sm:text-sm font-black">
                      {eliminatedPlayerName} is knocked out!
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
