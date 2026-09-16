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
    <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-center min-h-[85vh] p-4 select-none">
      <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-3xl p-6 shadow-2xl flex flex-col items-center">
        {/* Crown & Avatar */}
        <div className="relative mb-3">
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-4xl animate-bounce">
            👑
          </div>
          <div
            className="w-20 h-20 rounded-full border-4 border-[#f2c14e] shadow-xl flex items-center justify-center text-2xl font-black text-white overflow-hidden"
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

        <h2 className="text-2xl font-black text-[#1c6a35] text-center mb-0.5">
          {winner.name} Wins!
        </h2>
        <div className="text-sm font-bold text-[#e58a1f] mb-3">
          Final Score: {winner.score} Points
        </div>

        {/* Payouts banner if applicable */}
        {settings?.payouts && settings.payouts.length > 0 && (
          <div className="w-full bg-[#fbf7eb] border border-[#ebdcb9] rounded-2xl p-2.5 mb-3 flex flex-col gap-1 shadow-xs">
            <div className="text-[10px] font-black text-[#6d5138] uppercase tracking-wider text-center">
              🪙 Payout Structure ({settings.tier?.replace('_', ' ').toUpperCase() || 'GAME'})
            </div>
            <div className="flex justify-around items-center text-xs font-bold text-[#3d2c1c]">
              {settings.payouts.map((amount, pIdx) => (
                <div key={pIdx} className="flex items-center gap-1">
                  <span className="font-mono text-[#8c6b41]">
                    {pIdx === 0 ? '1st:' : pIdx === 1 ? '2nd:' : '3rd:'}
                  </span>
                  <span className="font-mono font-black text-[#1c6a35]">🪙 {amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Standings List */}
        <div className="w-full bg-white/80 border border-[#ebdcb9] rounded-2xl p-3 mb-5 max-h-52 overflow-y-auto space-y-2">
          {ranked.map((p, idx) => {
            const payout = settings?.payouts ? (settings.payouts[idx] || 0) : 0;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold ${
                  idx === 0
                    ? 'bg-[#2f9a4f]/15 text-[#1c6a35]'
                    : !p.isCPU
                    ? 'bg-[#fef8d8] text-[#4a3622] border border-[#d3bb71]/60'
                    : 'bg-[#faf6eb] text-[#4a3622]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 text-center font-black">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <span>
                    {p.isCPU ? '🤖 ' : ''}
                    {p.name}
                    {!p.isCPU ? ' (You)' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-sm">{p.score} pts</span>
                  {payout > 0 && (
                    <span className="text-[11px] font-black text-[#1c6a35] bg-[#2f9a4f]/15 px-1.5 py-0.5 rounded-md">
                      +🪙{payout}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={onPlayAgain}
            className="w-full py-3 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-black text-base rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 border-b-3 border-[#1b6b33] cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            <span>PLAY AGAIN</span>
          </button>
          <button
            onClick={onHome}
            className="w-full py-2.5 bg-[#eae0c5] hover:bg-[#ded1af] text-[#4a3622] font-bold text-sm rounded-xl transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
