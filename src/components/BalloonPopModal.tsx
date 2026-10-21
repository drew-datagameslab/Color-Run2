import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2 } from 'lucide-react';
import { BALLOON_COUNT, BalloonBoardView } from '../lib/balloonBoard';
import { loadBalloonBoard, popBalloon } from '../lib/balloonPop';
import { playSfx, playWinCoinsSound } from '../lib/audio';
import { triggerDieTapHaptic } from '../lib/haptics';

interface BalloonPopModalProps {
  isOpen: boolean;
  uid: string;
  /** Balloon Pop is for signed-in accounts; guests are asked to sign in */
  isSignedIn: boolean;
  onClose: () => void;
  onSignIn: () => void;
  /** Coins won; `offline` means the server couldn't pay them, so add them on the device */
  onCoinsWon: (coins: number, offline: boolean) => void;
  /** The board's status changed (for the main menu badge) */
  onStatusChange?: (view: BalloonBoardView) => void;
}

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#ec4899', '#14b8a6'];

const Balloon: React.FC<{ color: string }> = ({ color }) => (
  <svg viewBox="0 0 40 54" className="w-full h-full drop-shadow-[0_3px_3px_rgba(0,0,0,0.35)]" aria-hidden="true">
    <path d="M20 39 C 16 44, 24 47, 19 53" stroke="#e5e7eb" strokeWidth="1.2" fill="none" />
    <polygon points="17,37 23,37 20,40" fill={color} />
    <ellipse cx="20" cy="19" rx="15" ry="18" fill={color} />
    <ellipse cx="14" cy="12" rx="4" ry="6" fill="white" opacity="0.45" transform="rotate(-20 14 12)" />
  </svg>
);

function timeLeft(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const STATUS_TEXT: Record<BalloonBoardView['status'], string> = {
  ready: '👇 Pick a balloon to pop!',
  play_first: '🎲 Play a game today to pop a balloon',
  popped_today: "✅ Today's balloon is popped. Come back tomorrow!",
};

/**
 * Balloon Pop bonus board: 25 balloons with hidden prizes of 10 to 100 coins. One pop a day after
 * the first game that day; popped balloons stay popped until the Monday reset.
 */
export const BalloonPopModal: React.FC<BalloonPopModalProps> = ({
  isOpen,
  uid,
  isSignedIn,
  onClose,
  onSignIn,
  onCoinsWon,
  onStatusChange,
}) => {
  const [view, setView] = useState<BalloonBoardView | null>(null);
  const [popping, setPopping] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<{ index: number; coins: number } | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  // Kept in a ref so a new callback from the parent doesn't reload the board (and clear the win)
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    const { view: next } = await loadBalloonBoard(uid);
    setView(next);
    onStatusChangeRef.current?.(next);
  }, [uid, isSignedIn]);

  useEffect(() => {
    if (!isOpen) return;
    setLastWin(null);
    setError('');
    refresh();
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  const handlePop = async (index: number) => {
    if (!view || view.status !== 'ready' || popping !== null || view.popped[index] !== undefined) return;
    triggerDieTapHaptic();
    setError('');
    setPopping(index);
    const [result] = await Promise.all([popBalloon(uid, index), new Promise(r => setTimeout(r, 350))]);
    setPopping(null);
    if ('message' in result) {
      setError(result.message);
      refresh();
      return;
    }
    playSfx('add');
    playWinCoinsSound();
    setView(result.view);
    setLastWin({ index, coins: result.coins });
    onStatusChangeRef.current?.(result.view);
    onCoinsWon(result.coins, result.offline);
  };

  const poppedCount = view ? Object.keys(view.popped).length : 0;

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="relative w-full max-w-sm max-h-[96dvh] flex flex-col rounded-3xl border-2 border-[#f2c14e] shadow-2xl overflow-hidden bg-gradient-to-b from-[#1d4ed8] via-[#3b82f6] to-[#93c5fd]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Balloon Pop"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-3 pb-2 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-white drop-shadow-md tracking-wide">🎈 Balloon Pop</h2>
            <p className="text-[11px] font-bold text-blue-50">Pop 1 balloon a day after you play. Win 10 to 100 coins!</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status */}
        <div className="px-4 shrink-0">
          <div
            className={`text-center text-xs font-black rounded-full py-1.5 px-3 shadow-sm ${
              view?.status === 'ready' ? 'bg-[#f2c14e] text-[#3a2205] animate-pulse' : 'bg-white/85 text-[#1e3a8a]'
            }`}
          >
            {!isSignedIn ? '🔒 Sign in to play Balloon Pop' : view ? STATUS_TEXT[view.status] : 'Loading the board…'}
          </div>
          {error && <p className="mt-1 text-center text-[11px] font-black text-white bg-red-600/90 rounded-lg py-1">{error}</p>}
        </div>

        {/* Board */}
        <div className="relative flex-1 min-h-0 px-3 py-3">
          {isSignedIn && !view ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: BALLOON_COUNT }, (_, i) => {
                const won = view?.popped[i];
                const isPopping = popping === i;
                const canPick = !!view && view.status === 'ready' && won === undefined && popping === null;
                return (
                  <button
                    key={i}
                    onClick={() => handlePop(i)}
                    disabled={!canPick}
                    aria-label={won !== undefined ? `Balloon ${i + 1}: ${won} coins` : `Balloon ${i + 1}`}
                    className={`relative aspect-[4/5] flex items-center justify-center ${canPick ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {won !== undefined ? (
                      <motion.div
                        initial={lastWin?.index === i ? { scale: 0.3, opacity: 0 } : false}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                        className={`flex flex-col items-center justify-center w-full h-full rounded-xl ${
                          lastWin?.index === i ? 'bg-[#f2c14e] ring-2 ring-white' : 'bg-white/25'
                        }`}
                      >
                        <span className="text-base leading-none">🪙</span>
                        <span className={`text-sm font-black leading-tight ${lastWin?.index === i ? 'text-[#3a2205]' : 'text-white'}`}>
                          {won}
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        className="w-[88%] h-full"
                        animate={
                          isPopping
                            ? { scale: [1, 1.35, 0], opacity: [1, 1, 0] }
                            : { y: [0, -3, 0] }
                        }
                        transition={
                          isPopping
                            ? { duration: 0.35, times: [0, 0.6, 1] }
                            : { duration: 2.2 + (i % 5) * 0.25, repeat: Infinity, ease: 'easeInOut', delay: (i % 7) * 0.15 }
                        }
                        style={{ opacity: !isSignedIn || view?.status === 'ready' ? 1 : 0.75 }}
                      >
                        <Balloon color={COLORS[(i * 3) % COLORS.length]} />
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Win banner */}
          <AnimatePresence>
            {lastWin && (
              <motion.div
                key="win"
                initial={{ scale: 0.4, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                className="absolute inset-x-6 top-1/3 z-10 rounded-2xl bg-[#1c6a35] border-2 border-[#f2c14e] shadow-2xl px-4 py-3 text-center pointer-events-none"
              >
                <div className="text-3xl">🎉</div>
                <div className="text-2xl font-black text-[#f2c14e]">+{lastWin.coins} coins!</div>
                <div className="text-[11px] font-bold text-white">Come back tomorrow for another pop</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Guests */}
          {!isSignedIn && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="w-full rounded-2xl bg-white/95 p-4 text-center shadow-2xl">
                <p className="text-sm font-black text-[#1e3a8a]">Balloon Pop is for signed-in players</p>
                <p className="text-xs text-[#475569] mt-1">Sign in to pop a balloon every day you play.</p>
                <button
                  onClick={onSignIn}
                  className="mt-3 w-full py-2.5 rounded-xl bg-[#2f9a4f] text-white font-black text-sm cursor-pointer active:scale-98"
                >
                  Sign In
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-3 pt-1 shrink-0 text-center">
          {view && (
            <p className="text-[11px] font-bold text-[#1e3a8a]">
              {poppedCount} of {BALLOON_COUNT} popped this week · New board in {timeLeft(view.resetsAt - now)}
            </p>
          )}
          <p className="text-[10px] font-semibold text-[#1e40af]">Resets every Monday at 12:00 AM Eastern Time</p>
          {lastWin && (
            <button
              onClick={onClose}
              className="mt-2 w-full py-2.5 rounded-xl bg-[#f2c14e] text-[#3a2205] font-black text-sm shadow-md cursor-pointer active:scale-98"
            >
              Collect &amp; Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
