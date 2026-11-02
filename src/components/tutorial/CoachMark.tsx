import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface CoachMarkProps {
  /** id of the element to spotlight; without one, the bubble is centered */
  targetId?: string;
  title?: string;
  text: React.ReactNode;
  /** Shows a button in the bubble (for explanation steps) */
  nextLabel?: string;
  onNext?: () => void;
  onSkip?: () => void;
  /** Step counter, e.g. "2 of 4" */
  progress?: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;

/**
 * Tutorial coach bubble. Dims the screen except the spotlighted element, which stays tappable,
 * and points at it with a speech bubble.
 */
export const CoachMark: React.FC<CoachMarkProps> = ({ targetId, title, text, nextLabel, onNext, onSkip, progress }) => {
  const [rect, setRect] = useState<Rect | null>(null);

  // Follow the target as the layout changes (scrolling, animations, resizing)
  useEffect(() => {
    if (!targetId) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.getElementById(targetId);
      if (!el) return setRect(null);
      const r = el.getBoundingClientRect();
      setRect(prev =>
        prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height }
      );
    };
    const el = document.getElementById(targetId);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    measure();
    const timer = setInterval(measure, 250);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', measure);
    };
  }, [targetId]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const hole = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        right: Math.min(vw, rect.left + rect.width + PAD),
        bottom: Math.min(vh, rect.top + rect.height + PAD),
      }
    : null;
  // Bubble goes below the target when there's room, otherwise above
  const below = hole ? hole.bottom + 190 < vh || hole.top < 190 : false;

  const shade = 'fixed pointer-events-auto';
  const dim = 'rgba(0, 0, 0, 0.65)';
  return (
    <div className="fixed inset-0 z-[260] pointer-events-none">
      {hole ? (
        <>
          <div className={shade} style={{ background: dim, top: 0, left: 0, right: 0, height: hole.top }} />
          <div className={shade} style={{ background: dim, top: hole.bottom, left: 0, right: 0, bottom: 0 }} />
          <div className={shade} style={{ background: dim, top: hole.top, left: 0, width: hole.left, height: hole.bottom - hole.top }} />
          <div className={shade} style={{ background: dim, top: hole.top, left: hole.right, right: 0, height: hole.bottom - hole.top }} />
          <div
            className="fixed rounded-2xl ring-4 ring-[#f2c14e] animate-pulse pointer-events-none"
            style={{ top: hole.top, left: hole.left, width: hole.right - hole.left, height: hole.bottom - hole.top }}
          />
        </>
      ) : (
        <div className={`${shade} inset-0`} style={{ background: dim }} />
      )}

      <motion.div
        key={`${targetId}-${title}`}
        initial={{ opacity: 0, y: below ? -8 : 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="fixed left-1/2 -translate-x-1/2 w-[min(340px,calc(100vw-24px))] pointer-events-auto"
        style={
          hole
            ? below
              ? { top: hole.bottom + 12 }
              : { bottom: vh - hole.top + 12 }
            : { top: '32%' }
        }
      >
        <div className="relative rounded-2xl bg-[#fcf8ef] border-2 border-[#f2c14e] shadow-2xl px-4 py-3">
          {hole && (
            <div
              className={`absolute w-4 h-4 bg-[#fcf8ef] border-[#f2c14e] rotate-45 ${
                below ? '-top-2 border-l-2 border-t-2' : '-bottom-2 border-r-2 border-b-2'
              }`}
              style={{ left: Math.min(Math.max((hole.left + hole.right) / 2 - (vw - Math.min(340, vw - 24)) / 2 - 8, 16), 300) }}
            />
          )}
          <div className="flex items-center justify-between gap-2">
            {title && <h3 className="text-sm font-black text-[#1c6a35]">{title}</h3>}
            {progress && <span className="text-[10px] font-bold text-[#8c745e] shrink-0">{progress}</span>}
          </div>
          <div className="mt-0.5 text-[13px] leading-snug text-[#3e2e1e]">{text}</div>
          {(onNext || onSkip) && (
            <div className="mt-2.5 flex items-center justify-between gap-2">
              {onSkip ? (
                <button onClick={onSkip} className="text-[11px] font-bold text-[#8c745e] underline cursor-pointer">
                  Skip tutorial
                </button>
              ) : (
                <span />
              )}
              {onNext && (
                <button
                  onClick={onNext}
                  className="px-4 py-1.5 rounded-xl bg-[#2f9a4f] text-white text-xs font-black shadow cursor-pointer active:scale-98"
                >
                  {nextLabel || 'Next'}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
