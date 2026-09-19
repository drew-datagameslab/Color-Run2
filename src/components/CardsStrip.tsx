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

  // Mobile: Show the last 4 rolls (e.g. in round 1..4: 1, 2, 3, 4; in round 5: 2, 3, 4, 5)
  const maxRowMobile = Math.max(4, currentRound);
  const startRowMobile = Math.max(1, maxRowMobile - 4 + 1);
  const mobileRows = Array.from({ length: 4 }, (_, i) => startRowMobile + i);

  // Tablet (md+): Taller scoreboards showing up to 6 rounds of scores
  const maxRowTablet = Math.max(6, currentRound);
  const startRowTablet = Math.max(1, maxRowTablet - 6 + 1);
  const tabletRows = Array.from({ length: 6 }, (_, i) => startRowTablet + i);

  return (
    <div className="w-full flex flex-col">
      {/* Scrollable Scoreboards Container - Native scrollbar hidden so only the single custom bar exists */}
      <div
        ref={scrollRef}
        className={`w-full flex gap-1.5 sm:gap-2 md:gap-2.5 py-0.5 items-stretch ${
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
              className={`flex-shrink-0 rounded-xl md:rounded-2xl py-1 px-1 sm:py-1.5 sm:px-1.5 md:py-2 md:px-2 flex flex-col items-center transition-all duration-200 select-none cursor-pointer relative shadow-md
                ${displayUnits.length > 4 ? 'w-[calc((100%-20px)/4)] min-w-[70px] sm:min-w-[78px] md:min-w-[95px] max-w-[98px] md:max-w-[130px]' : 'flex-1 min-w-[66px] md:min-w-[85px] max-w-[108px] md:max-w-[140px]'}
                ${isEliminationPhase ? 'bg-[#d62828]' : 'bg-[#28974a]'}
                ${isActive
                  ? 'border-2 border-[#f2c14e] ring-2 ring-[#f2c14e]/50 shadow-[0_0_10px_rgba(242,193,78,0.5)] scale-[1.02]'
                  : 'border border-white/20'}
                ${isOut ? 'opacity-40 grayscale-[50%]' : ''}`}
            >
              {/* Avatar Top Center (50% bigger) */}
              <div
                className="w-[30px] h-[30px] sm:w-[34px] sm:h-[34px] md:w-[38px] md:h-[38px] rounded-full flex items-center justify-center font-black text-xs sm:text-sm md:text-base text-white shrink-0 shadow-sm mb-0.5 transition-transform hover:scale-105 border border-white/30"
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
              <div className="w-full flex items-center justify-center gap-0.5 text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-wide text-white leading-none truncate px-0.5 mb-0.5 md:mb-1">
                {unit.isCPU && <span className="text-[8px] md:text-[9px]">🤖</span>}
                <span className="truncate">
                  {unit.isCPU ? unit.name.slice(0, 6).toUpperCase() : unit.name.slice(0, 8).toUpperCase()}
                </span>
              </div>

              {/* Points Total in Boards (30% bigger) */}
              <div className="text-lg sm:text-xl md:text-2xl font-black text-white text-center leading-tight my-0.5 md:my-1 drop-shadow-sm">
                {unit.score}
              </div>

              {/* Elimination status badge if out */}
              {isOut && (
                <div className="text-[7px] md:text-[8px] font-black text-white bg-black/60 rounded px-1 py-0 uppercase text-center mb-0.5 border border-white/20 leading-tight">
                  {unit.place ? `${unit.place}${unit.place === 1 ? 'st' : unit.place === 2 ? 'nd' : unit.place === 3 ? 'rd' : 'th'}` : 'Out'}
                </div>
              )}

              {/* Round History Rows (Mobile: 4 Rolls) */}
              <div className="w-full flex md:hidden flex-col gap-0 mt-0.5 pt-0.5 border-t border-white/20 text-[8.5px] sm:text-[9.5px] font-mono leading-[1.25]">
                {mobileRows.map(r => {
                  const rScore = unit.history[r];
                  return (
                    <div
                      key={r}
                      className={`flex justify-between items-center px-1 py-[1px] rounded leading-[1.25] ${
                        r === currentRound && unit.active
                          ? 'bg-black/25 font-black text-[#f2c14e]'
                          : 'text-white/85'
                      }`}
                    >
                      <span className="opacity-80 leading-[1.25]">{r}</span>
                      <span className="font-bold leading-[1.25]">
                        {rScore !== undefined ? rScore : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Round History Rows (Tablet: 6 Rolls - Taller scoreboard) */}
              <div className="w-full hidden md:flex flex-col gap-0 mt-1 pt-1 border-t border-white/20 text-[10.5px] font-mono leading-[1.3]">
                {tabletRows.map(r => {
                  const rScore = unit.history[r];
                  return (
                    <div
                      key={r}
                      className={`flex justify-between items-center px-1.5 py-[1.5px] rounded leading-[1.3] ${
                        r === currentRound && unit.active
                          ? 'bg-black/25 font-black text-[#f2c14e]'
                          : 'text-white/85'
                      }`}
                    >
                      <span className="opacity-80 leading-[1.3]">{r}</span>
                      <span className="font-bold leading-[1.3]">
                        {rScore !== undefined ? rScore : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* "Your turn to roll!" overlay on the user's scoreboard */}
              {showTurnOverlay && (
                <div className="absolute inset-x-0.5 bottom-0.5 bg-gradient-to-r from-amber-400 via-[#f2c14e] to-yellow-300 text-stone-950 font-black text-[7px] sm:text-[8px] md:text-[9px] py-0.5 px-0.5 rounded text-center shadow-lg border border-white animate-pulse uppercase tracking-tight z-20 leading-tight">
                  Your turn!
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
