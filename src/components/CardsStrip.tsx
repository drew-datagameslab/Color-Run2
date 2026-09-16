import React from 'react';
import { PlayerUnit } from '../types/game';

interface CardsStripProps {
  units: PlayerUnit[];
  activeUnitId?: string;
  currentRound: number;
  isEliminationPhase: boolean;
  onSelectUnit?: (unit: PlayerUnit) => void;
}

export const CardsStrip: React.FC<CardsStripProps> = ({
  units,
  activeUnitId,
  currentRound,
  isEliminationPhase,
  onSelectUnit,
}) => {
  // Sort: active players first in original index, then eliminated ordered by place
  const sortedUnits = [...units].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.active) return 0;
    return (a.place || 99) - (b.place || 99);
  });

  const maxRow = Math.max(5, currentRound);
  const startRow = Math.max(1, maxRow - 5 + 1);

  return (
    <div className="w-full overflow-x-auto py-1 scrollbar-none flex gap-2">
      {sortedUnits.map(unit => {
        const isActive = unit.id === activeUnitId && unit.active;
        const isOut = !unit.active;

        return (
          <div
            key={unit.id}
            className={`flex-shrink-0 w-28 sm:w-32 rounded-xl p-2 flex flex-col transition-all duration-200 border
              ${isActive ? 'bg-[#fffdf7] border-[#f2c14e] shadow-[0_0_0_2px_#f2c14e,0_4px_10px_rgba(0,0,0,0.15)] scale-[1.02]' : 'bg-[#faf6eb]/90 border-[#d4c5a0]'}
              ${isOut ? 'opacity-50 grayscale-[40%]' : ''}
              ${isEliminationPhase && unit.active ? 'border-[#e5352f]/40' : ''}`}
          >
            {/* Header: Avatar, Name, Total */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <button
                type="button"
                onClick={() => onSelectUnit?.(unit)}
                title={`Click to view ${unit.name} & Add Friend`}
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                style={{
                  backgroundColor: unit.color,
                  backgroundImage: unit.image ? `url(${unit.image})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {!unit.image && unit.name.slice(0, 2).toUpperCase()}
              </button>
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => onSelectUnit?.(unit)}
              >
                <div className="text-[11px] font-extrabold truncate text-[#3e2e1e] leading-tight">
                  {unit.isCPU ? '🤖 ' : ''}{unit.name}
                </div>
                <div className="text-xs font-mono font-black text-[#1c6a35]">
                  {unit.score} pts
                </div>
              </div>
            </div>

            {/* Out Tag if eliminated */}
            {isOut && (
              <div className="text-[10px] font-bold text-white bg-[#e5352f] rounded px-1.5 py-0.5 text-center mb-1">
                {unit.place ? `${unit.place}${unit.place === 1 ? 'st' : unit.place === 2 ? 'nd' : unit.place === 3 ? 'rd' : 'th'} Place` : 'Out'}
              </div>
            )}

            {/* Round History Rows */}
            <div className="flex flex-col gap-0.5 mt-auto pt-1 border-t border-[#ebdcb9] text-[10px] font-mono">
              {Array.from({ length: maxRow - startRow + 1 }).map((_, idx) => {
                const r = startRow + idx;
                const rScore = unit.history[r];
                return (
                  <div
                    key={r}
                    className={`flex justify-between items-center px-1 rounded ${r === currentRound ? 'bg-[#2f9a4f]/15 font-bold text-[#1c6a35]' : 'text-[#6b5845]'}`}
                  >
                    <span>R{r}</span>
                    <span>{rScore !== undefined ? `+${rScore}` : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
