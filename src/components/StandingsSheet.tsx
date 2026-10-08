import React from 'react';
import { X, BookOpen, Maximize, RotateCcw } from 'lucide-react';
import { PlayerUnit } from '../types/game';

interface StandingsSheetProps {
  isOpen: boolean;
  units: PlayerUnit[];
  threshold: number;
  isElimination: boolean;
  onClose: () => void;
  onOpenRules: () => void;
  onNewGame: () => void;
}

export const StandingsSheet: React.FC<StandingsSheetProps> = ({
  isOpen,
  units,
  threshold,
  isElimination,
  onClose,
  onOpenRules,
  onNewGame,
}) => {
  if (!isOpen) return null;

  const ranked = [...units].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.active) return b.score - a.score;
    return (a.place || 99) - (b.place || 99);
  });

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-[#faf4e6] border-t-2 sm:border-2 border-[#c9b877] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Grip */}
        <div className="w-10 h-1 bg-[#d3c299] rounded-full mx-auto mb-3" />

        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-black text-[#1c6a35]">Standings</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10">
            <X className="w-5 h-5 text-[#5c4937]" />
          </button>
        </div>

        <p className="text-xs text-[#6e533c] mb-4">
          {isElimination
            ? 'Lowest total is knocked out each round.'
            : `First to ${threshold} pts starts elimination.`}
        </p>

        {/* Ranked Players List */}
        <div className="space-y-2 mb-5">
          {ranked.map((p, idx) => (
            <div
              key={p.id}
              className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold ${idx === 0 && p.active ? 'bg-[#2f9a4f]/15 border border-[#2f9a4f]/30 text-[#1c6a35]' : 'bg-white/80 border border-[#ebdcb9] text-[#3e2e1e]'} ${!p.active ? 'opacity-40 grayscale-[60%]' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 text-center font-mono">
                  {p.active ? `#${idx + 1}` : p.place ? `${p.place}th` : 'Out'}
                </span>
                <div>
                  <div>{p.isCPU ? '🤖 ' : ''}{p.name}</div>
                  {!p.active && (
                    <div className="text-[10px] text-[#e5352f]">
                      Eliminated · {p.place || '?'} place
                    </div>
                  )}
                </div>
              </div>
              <span className="font-mono text-sm">{p.score} pts</span>
            </div>
          ))}
        </div>

        {/* Action Links */}
        <div className="space-y-2">
          <button
            onClick={() => {
              onClose();
              onOpenRules();
            }}
            className="w-full py-2 bg-[#ebdcb9] hover:bg-[#ded1af] text-[#4a3622] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            <span>How to play</span>
          </button>

          <button
            onClick={toggleFullScreen}
            className="w-full py-2 bg-[#ebdcb9] hover:bg-[#ded1af] text-[#4a3622] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            <Maximize className="w-4 h-4" />
            <span>Toggle Full Screen</span>
          </button>

          <button
            onClick={() => {
              if (confirm('End this game and start over?')) {
                onClose();
                onNewGame();
              }
            }}
            className="w-full py-2 bg-[#e58a1f] hover:bg-[#cb7512] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>New Game</span>
          </button>
        </div>
      </div>
    </div>
  );
};
