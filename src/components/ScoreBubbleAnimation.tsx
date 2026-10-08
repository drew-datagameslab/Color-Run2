import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface ScoreBubbleData {
  id: string;
  points: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  unitId: string;
}

interface ScoreBubbleAnimationProps {
  bubble: ScoreBubbleData | null;
  onPop?: (bubble: ScoreBubbleData) => void;
}

export const ScoreBubbleAnimation: React.FC<ScoreBubbleAnimationProps> = ({
  bubble,
  onPop,
}) => {
  const [poppingId, setPoppingId] = useState<string | null>(null);
  const [popPos, setPopPos] = useState<{ x: number; y: number } | null>(null);

  const onPopRef = useRef(onPop);
  onPopRef.current = onPop;

  // Track handled bubble IDs so the animation runs strictly ONCE per bubble
  const handledBubbleIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bubble) return;
    if (handledBubbleIdRef.current === bubble.id) return;
    handledBubbleIdRef.current = bubble.id;

    // Pop timer right as bubble finishes its journey to the scoreboard
    const popTimer = setTimeout(() => {
      setPoppingId(bubble.id);
      setPopPos({ x: bubble.targetX, y: bubble.targetY });
      onPopRef.current?.(bubble);

      // Dismiss pop burst particles after 400ms
      setTimeout(() => {
        setPoppingId(null);
        setPopPos(null);
      }, 400);
    }, 800);

    return () => clearTimeout(popTimer);
  }, [bubble?.id]);

  const arcOffsetX = bubble
    ? (bubble.id.charCodeAt(bubble.id.length - 1) % 2 === 0 ? 14 : -14)
    : 0;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {bubble && poppingId !== bubble.id && (
          <motion.div
            key={bubble.id}
            initial={{
              x: bubble.startX - 36,
              y: bubble.startY - 36,
              scale: 0.4,
              opacity: 0.8,
            }}
            animate={{
              x: [
                bubble.startX - 36,
                bubble.startX + (bubble.targetX - bubble.startX) * 0.5 + arcOffsetX - 36,
                bubble.targetX - 36,
              ],
              y: [
                bubble.startY - 36,
                bubble.startY + (bubble.targetY - bubble.startY) * 0.4 - 28 - 36,
                bubble.targetY - 36,
              ],
              scale: [0.4, 1.15, 1, 0.95],
              opacity: [0.8, 1, 1, 1],
            }}
            exit={{
              scale: 1.35,
              opacity: 0,
            }}
            transition={{
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="absolute pointer-events-none"
            style={{ width: 72, height: 72 }}
          >
            {/* Iridescent Floating Bubble */}
            <div className="relative w-full h-full rounded-full flex items-center justify-center select-none shadow-[0_8px_28px_rgba(40,180,100,0.55)] border-2 border-white/95 bg-gradient-to-br from-white/90 via-emerald-200/60 to-teal-400/50 backdrop-blur-xs animate-bounce-subtle">
              {/* Bubble Highlight Specular Glints */}
              <div className="absolute top-2 left-2.5 w-4 h-2 rounded-full bg-white/95 rotate-[-35deg]" />
              <div className="absolute top-4 left-2 w-1.5 h-1.5 rounded-full bg-white/80" />
              <div className="absolute bottom-2.5 right-3 w-4 h-2 rounded-full bg-white/45 rotate-[-30deg]" />

              {/* Points Total Inside Bubble */}
              <div className="flex flex-col items-center justify-center font-black text-stone-950 z-10 drop-shadow-xs">
                <span className="text-lg sm:text-xl font-mono leading-none tracking-tight text-[#165a27] font-black">
                  +{bubble.points}
                </span>
                <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-extrabold text-[#1a682e] -mt-0.5">
                  POINTS
                </span>
              </div>

              {/* Shimmering pulse ring */}
              <div className="absolute inset-0 rounded-full ring-2 ring-emerald-300/60 animate-ping opacity-30 pointer-events-none" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pop Burst Effect at Target Scoreboard */}
      <AnimatePresence>
        {poppingId && popPos && (
          <div
            key={`pop-${poppingId}`}
            className="absolute pointer-events-none flex items-center justify-center"
            style={{
              left: popPos.x,
              top: popPos.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Expanding Pop Ring */}
            <motion.div
              initial={{ scale: 0.4, opacity: 1 }}
              animate={{ scale: 2.3, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="absolute w-16 h-16 rounded-full border-2 border-yellow-300 bg-yellow-400/25"
            />
            {/* Pop Sparks */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
              <motion.div
                key={deg}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos((deg * Math.PI) / 180) * 30,
                  y: Math.sin((deg * Math.PI) / 180) * 30,
                  opacity: 0,
                  scale: 0.2,
                }}
                transition={{ duration: 0.38, ease: 'easeOut' }}
                className="absolute w-1.5 h-1.5 rounded-full bg-yellow-300 shadow-xs"
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
