import React, { useRef, useEffect } from 'react';
import { PlayerUnit } from '../types/game';

interface CardsStripProps {
  units: PlayerUnit[];
  activeUnitId?: string;
  currentRound: number;
  isEliminationPhase: boolean;
  isUserTurnToRoll?: boolean;
  onSelectUnit?: (unit: PlayerUnit) => void;
}

export const CardsStrip: React.FC<CardsStripProps> = ({
  units,
  activeUnitId,
  currentRound,
  isEliminationPhase,
  isUserTurnToRoll = false,
  onSelectUnit,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Active players first in their order, eliminated players pushed to the far right of the boards
  const activeUnits = units.filter(u => u.active);
  const eliminatedUnits = units.filter(u => !u.active);
  const displayUnits = [...activeUnits, ...eliminatedUnits];
  const activeIdx = displayUnits.findIndex(u => u.id === activeUnitId);

  // Auto-scroll rule:
  // "The scroll bar should stay on the far left (showing the first four players) then slide to the far right when the remaining player take their turns."
  useEffect(() => {
    if (!scrollRef.current || displayUnits.length <= 4) return;

    if (activeIdx >= 0 && activeIdx < 4) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (activeIdx >= 4) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }
  }, [activeIdx, displayUnits.length]);

  // Show the last 4 rolls (e.g., in round 1..4: 1, 2, 3, 4; in round 5: 2, 3, 4, 5)
  const maxRow = Math.max(4, currentRound);
  const startRow = Math.max(1, maxRow - 4 + 1);
  const rows = Array.from({ length: 4 }, (_, i) => startRow + i);

  return (
    <div className="w-full flex flex-col">
      {/* Scrollable Scoreboards Container - Native scrollbar hidden so only the single custom bar exists */}
      <div
        ref={scrollRef}
        className={`w-full flex gap-1.5 sm:gap-2 py-0.5 items-stretch ${
          displayUnits.length > 4
            ? 'overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
            : 'justify-between'
        }`}
      >
        {displayUnits.map((unit) => {
          const isActive = unit.id === activeUnitId && unit.active;
          const isOut = !unit.active;
          const showTurnOverlay = isUserTurnToRoll && unit.isOwner && !isOut;

          return (
            <div
              key={unit.id}
              onClick={() => onSelectUnit?.(unit)}
              className={`flex-shrink-0 rounded-2xl p-1.5 sm:p-2 flex flex-col items-center transition-all duration-200 select-none cursor-pointer relative shadow-md
                ${displayUnits.length > 4 ? 'w-[calc((100%-24px)/4)] min-w-[74px] sm:min-w-[82px] max-w-[105px]' : 'flex-1 min-w-[70px] max-w-[115px]'}
                ${isEliminationPhase ? 'bg-[#d62828]' : 'bg-[#28974a]'}
                ${isActive
                  ? 'border-2 border-[#f2c14e] ring-2 ring-[#f2c14e]/50 shadow-[0_0_12px_rgba(242,193,78,0.5)] scale-[1.02]'
                  : 'border border-white/20'}
                ${isOut ? 'opacity-40 grayscale-[50%]' : ''}`}
            >
              {/* Avatar Top Center */}
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 shadow-xs mb-1 transition-transform hover:scale-105 border border-white/20"
                style={{
                  backgroundColor: unit.color,
                  backgroundImage: unit.image ? `url(${unit.image})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {!unit.image && unit.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Username under Avatar */}
              <div className="w-full flex items-center justify-center gap-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wide text-white leading-tight truncate px-0.5">
                {unit.isCPU && <span className="text-[9px]">🤖</span>}
                <span className="truncate">
                  {unit.isCPU ? unit.name.slice(0, 6).toUpperCase() : unit.name.slice(0, 8).toUpperCase()}
                </span>
              </div>

              {/* Points Total in Larger Font */}
              <div className="text-lg sm:text-xl font-black text-white text-center leading-tight my-0.5 drop-shadow-xs">
                {unit.score}
              </div>

              {/* Elimination status badge if out */}
              {isOut && (
                <div className="text-[8px] font-black text-white bg-black/60 rounded px-1.5 py-0.5 uppercase text-center mb-0.5 border border-white/20">
                  {unit.place ? `${unit.place}${unit.place === 1 ? 'st' : unit.place === 2 ? 'nd' : unit.place === 3 ? 'rd' : 'th'}` : 'Out'}
                </div>
              )}

              {/* Round History Rows (Last 4 Rolls) */}
              <div className="w-full flex flex-col gap-0.5 mt-auto pt-1 border-t border-white/20 text-[9px] sm:text-[10px] font-mono">
                {rows.map(r => {
                  const rScore = unit.history[r];
                  return (
                    <div
                      key={r}
                      className={`flex justify-between items-center px-1 rounded ${
                        r === currentRound && unit.active
                          ? 'bg-black/25 font-black text-[#f2c14e]'
                          : 'text-white/85'
                      }`}
                    >
                      <span className="opacity-80">{r}</span>
                      <span className="font-bold">
                        {rScore !== undefined ? rScore : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* "Your turn to roll!" overlay on the user's scoreboard */}
              {showTurnOverlay && (
                <div className="absolute inset-x-1 bottom-1 bg-gradient-to-r from-amber-400 via-[#f2c14e] to-yellow-300 text-stone-950 font-black text-[8px] sm:text-[9px] py-1 px-0.5 rounded-lg text-center shadow-xl border border-white animate-pulse uppercase tracking-tight z-20 leading-tight">
                  Your turn to roll!
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Single clean scroll indicator if more than 4 players */}
      {displayUnits.length > 4 && (
        <div className="w-24 mx-auto h-1 bg-white/20 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isEliminationPhase ? 'bg-[#ff8a8a]' : 'bg-[#f2c14e]'
            }`}
            style={{
              width: '50%',
              transform: `translateX(${activeIdx >= 4 ? '100%' : '0%'})`,
            }}
          />
        </div>
      )}
    </div>
  );
};
