import React, { useEffect } from 'react';
import { Trophy, RotateCcw, Home } from 'lucide-react';
import { PlayerUnit, GameSettings } from '../types/game';
import { playSfx } from '../lib/audio';

interface WinnerScreenProps {
  winner: PlayerUnit;
  units: PlayerUnit[];
  settings?: GameSettings | null;
  onPlayAgain: () => void;
  onHome: () => void;
}

export const WinnerScreen: React.FC<WinnerScreenProps> = ({
  winner,
  units,
  settings,
  onPlayAgain,
  onHome,
}) => {
  useEffect(() => {
    playSfx('fanfare');
  }, []);

  const ranked = [...units].sort((a, b) => {
    if (a.id === winner.id) return -1;
    if (b.id === winner.id) return 1;
    return (a.place || 99) - (b.place || 99) || b.score - a.score;
  });

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-start max-h-[92vh] overflow-y-auto p-2 sm:p-3 select-none my-auto">
      <div className="w-full bg-[#faf4e6]/98 border-2 border-[#c9b877] rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col items-center">
        {/* Crown & Avatar */}
        <div className="relative mb-1.5">
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
            👑
          </div>
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-3 border-[#f2c14e] shadow-lg flex items-center justify-center text-lg sm:text-xl font-black text-white overflow-hidden"
            style={{
              backgroundColor: winner.color,
              backgroundImage: winner.image ? `url(${winner.image})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!winner.image && (winner.name.slice(0, 2).toUpperCase() || 'W')}
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-[#1c6a35] text-center mb-0.5">
          {winner.name} Wins!
        </h2>
        <div className="text-xs sm:text-sm font-bold text-[#e58a1f] mb-2.5">
          Final Score: {winner.score} Points
        </div>

        {/* Standings List */}
        <div className="w-full bg-white/80 border border-[#ebdcb9] rounded-2xl p-2 mb-3 max-h-48 overflow-y-auto space-y-1.5">
          {ranked.map((p, idx) => (
            <div
              key={p.id}
              className={`flex items-center justify-between py-1.5 px-2 rounded-xl text-xs font-bold ${
                idx === 0
                  ? 'bg-[#2f9a4f]/15 text-[#1c6a35]'
                  : !p.isCPU
                  ? 'bg-[#fef8d8] text-[#4a3622] border border-[#d3bb71]/60'
                  : 'bg-[#faf6eb] text-[#4a3622]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-4 text-center font-black text-[11px]">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </span>
                <span className="truncate max-w-[130px]">
                  {p.isCPU ? '🤖 ' : ''}
                  {p.name}
                  {!p.isCPU ? ' (You)' : ''}
                </span>
              </div>
              <div className="font-mono text-xs font-black">
                {p.score} pts
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-1.5">
          <button
            onClick={onPlayAgain}
            className="w-full py-2.5 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 border-b-3 border-[#1b6b33] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>PLAY AGAIN</span>
          </button>
          <button
            onClick={onHome}
            className="w-full py-2 bg-[#eae0c5] hover:bg-[#ded1af] text-[#4a3622] font-bold text-xs rounded-xl transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
