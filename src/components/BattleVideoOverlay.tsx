import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const BATTLE_VIDEO_SRC = '/assets/video/battle.mp4';
const INTRO_MS = 2000;
const OUTRO_MS = 3000;

interface BattleVideoOverlayProps {
  isVisible: boolean;
  phase: 'intro' | 'rolling' | 'outro' | null;
  eliminatedPlayerName?: string;
  onIntroComplete?: () => void;
  onOutroComplete?: () => void;
}

/**
 * Full-screen "Battle to Survive" video overlay for the elimination roll-off.
 * The 1080x1080 video uses object-cover, so it fills any screen: the sides are
 * cropped on phones, and top/bottom on wide screens such as an unfolded Fold.
 * Intro: on screen for 2s, then raises up to reveal the roll-off.
 * Outro: drops back down for 3s once the eliminated player is decided.
 */
export const BattleVideoOverlay: React.FC<BattleVideoOverlayProps> = ({
  isVisible,
  phase,
  eliminatedPlayerName,
  onIntroComplete,
  onOutroComplete,
}) => {
  // Keep the latest callbacks in refs so parent re-renders don't restart the timers
  const onIntroCompleteRef = useRef(onIntroComplete);
  const onOutroCompleteRef = useRef(onOutroComplete);
  onIntroCompleteRef.current = onIntroComplete;
  onOutroCompleteRef.current = onOutroComplete;

  useEffect(() => {
    if (!isVisible) return;
    if (phase === 'intro') {
      const timer = setTimeout(() => onIntroCompleteRef.current?.(), INTRO_MS);
      return () => clearTimeout(timer);
    }
    if (phase === 'outro') {
      const timer = setTimeout(() => onOutroCompleteRef.current?.(), OUTRO_MS);
      return () => clearTimeout(timer);
    }
  }, [isVisible, phase]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={`battle-video-${phase}`}
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 bg-black overflow-hidden select-none"
        >
          {/* Muted so it autoplays on iOS/Android; the battle music loop provides the audio */}
          <video
            src={BATTLE_VIDEO_SRC}
            autoPlay
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
          />

          {phase === 'outro' && eliminatedPlayerName && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="absolute left-0 right-0 bottom-[max(2rem,env(safe-area-inset-bottom))] flex justify-center px-4"
            >
              <div className="px-5 py-2 rounded-2xl bg-black/75 border-2 border-red-500 text-red-400 font-black text-sm sm:text-base uppercase tracking-wider text-center shadow-2xl">
                {eliminatedPlayerName} has been eliminated!
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
