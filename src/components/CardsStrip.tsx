import React, { useRef, useEffect } from 'react';
import { PlayerUnit } from '../types/game';
import { triggerButtonHaptic } from '../lib/haptics';

interface CardsStripProps {
  units: PlayerUnit[];
  activeUnitId?: string;
  currentRound: number;
  isEliminationPhase: boolean;
  isUserTurnToRoll?: boolean;
  onSelectUnit?: (unit: PlayerUnit) => void;
  isTiebreakerActive?: boolean;
  tiebreakerScores?: Record<string, number>;
  tiebreakerAdvancedIds?: string[];
  blinkingUnitIds?: string[];
  liveTurnScore?: { unitId: string; score: number } | null;
}

export const CardsStrip: React.FC<CardsStripProps> = ({
  units,
  activeUnitId,
  currentRound,
  isEliminationPhase,
  isUserTurnToRoll = false,
  onSelectUnit,
  isTiebreakerActive = false,
  tiebreakerScores = {},
  tiebreakerAdvancedIds = [],
  blinkingUnitIds = [],
  liveTurnScore = null,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Active players first in their order, eliminated players pushed to the far right of the boards.
  // When a player is eliminated first, they shift to the far right (greyed out).
  // Eliminated players are then sorted by point total, ascending from right to left (i.e. highest score on the left, lowest on the far right).
  const activeUnits = units.filter(u => u.active);
  const eliminatedUnits = units.filter(u => !u.active);
  const sortedEliminatedUnits = [...eliminatedUnits].sort((a, b) => {
    if (b.score !== a.score) {
      // Ascending from right to left means higher point total on the left, lower on the right
      return b.score - a.score;
    }
    // Secondary tiebreak: earlier eliminated player (higher place number, e.g. 4th vs 3rd) stays to the far right
    return (a.place ?? 0) - (b.place ?? 0);
  });
  const displayUnits = [...activeUnits, ...sortedEliminatedUnits];
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

  // Show up to 3 rounds of scores (e.g. in round 1..3: 1, 2, 3; in round 4: 2, 3, 4; in round 5: 3, 4, 5)
  // Keeps scorecards compact so game elements never run into each other
  const maxRow = Math.max(3, currentRound);
  const startRow = Math.max(1, maxRow - 3 + 1);
  const scoreRows = Array.from({ length: 3 }, (_, i) => startRow + i);

  return (
    <div className="w-full flex flex-col">
      {/* Scoreboards Container: 4 scoreboards fit perfectly without scrolling; scroll only when > 4 players */}
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
          const isBlinking = blinkingUnitIds?.includes(unit.id);
          // isUserTurnToRoll is only true when the active player rolls on this device (includes Pass & Play)
          const showTurnOverlay = isUserTurnToRoll && isActive && !isOut;
          const isAdvanced = tiebreakerAdvancedIds?.includes(unit.id);
          const currentUnitTiebreakScore =
            unit.id === activeUnitId && liveTurnScore?.unitId === unit.id
              ? liveTurnScore.score
              : tiebreakerScores[unit.id] !== undefined
              ? tiebreakerScores[unit.id]
              : 0;

          return (
            <div
              key={unit.id}
              id={`scoreboard-card-${unit.id}`}
              onClick={() => {
                triggerButtonHaptic();
                onSelectUnit?.(unit);
              }}
              className={`rounded-xl py-1 px-1 sm:py-1.5 sm:px-1.5 flex flex-col items-center transition-all duration-200 select-none cursor-pointer relative shadow-md
                ${
                  displayUnits.length > 4
                    ? 'flex-shrink-0 w-[calc((100%-18px)/4)] max-w-[calc((100%-18px)/4)]'
                    : 'flex-1 min-w-0'
                }
                ${isOut
                  ? 'bg-[#37383c] border-white/10 opacity-50 grayscale'
                  : isEliminationPhase || isTiebreakerActive
                  ? 'bg-[#d62828]'
                  : 'bg-[#28974a]'}
                ${isBlinking
                  ? 'animate-tiebreaker-blink ring-4 ring-yellow-400 border-2 border-yellow-300 z-30'
                  : isActive
                  ? 'border-2 border-[#f2c14e] ring-2 ring-[#f2c14e]/50 shadow-[0_0_10px_rgba(242,193,78,0.5)] scale-[1.02]'
                  : 'border border-white/20'}`}
            >
              {/* Avatar Top Center */}
              <div
                className="w-[26px] h-[26px] sm:w-[28px] sm:h-[28px] rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 shadow-sm mb-0.5 transition-transform hover:scale-105 border border-white/30"
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
              <div className="w-full flex items-center justify-center gap-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-wide text-white leading-none truncate px-0.5 mb-0.5">
                {unit.isCPU && <span className="text-[8px]">🤖</span>}
                <span className="truncate">
                  {unit.isCPU ? unit.name.slice(0, 6).toUpperCase() : unit.name.slice(0, 8).toUpperCase()}
                </span>
              </div>

              {/* Points Total in Boards (Points players are tied with) */}
              <div className="text-base sm:text-lg font-black text-white text-center leading-tight my-0.5 drop-shadow-sm">
                {unit.score}
              </div>

              {/* Elimination status badge if out (e.g. 4th, 3rd, 2nd) */}
              {isOut && (
                <div className="text-[8px] sm:text-[9px] font-black text-[#f2c14e] bg-black/85 rounded px-1.5 py-0.5 uppercase text-center my-0.5 border border-[#f2c14e]/40 shadow-sm leading-tight">
                  {unit.place ? `${unit.place}${unit.place === 1 ? 'st' : unit.place === 2 ? 'nd' : unit.place === 3 ? 'rd' : 'th'}` : 'Out'}
                </div>
              )}

              {/* Scoreboard Lower Section: Underneath, remove roll history while tiebreaker screen is active.
                  Add the word "TIEBREAKER" and the user's score during the tiebreak underneath. */}
              {isTiebreakerActive ? (
                <div className="w-full flex flex-col items-center mt-0.5 pt-0.5 border-t border-white/25">
                  <div className="text-[7.5px] sm:text-[8.5px] font-black tracking-wider text-white uppercase text-center leading-none">
                    TIEBREAKER
                  </div>
                  <div
                    className={`text-sm sm:text-base font-black text-center leading-tight mt-0.5 drop-shadow-sm ${
                      isAdvanced ? 'text-yellow-300 animate-pulse text-xs sm:text-sm font-extrabold' : 'text-white'
                    }`}
                  >
                    {isAdvanced ? 'ADVANCE' : currentUnitTiebreakScore}
                  </div>
                </div>
              ) : (
                /* Round History Rows (Shows 3 rolls) in standard play */
                <div className="w-full flex flex-col gap-0 mt-0.5 pt-0.5 border-t border-white/20 text-[8px] sm:text-[9px] font-mono leading-[1.25]">
                  {scoreRows.map(r => {
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
              )}

              {/* "Your turn to roll!" overlay on the user's scoreboard */}
              {showTurnOverlay && (
                <div className="absolute inset-x-0.5 bottom-0.5 bg-gradient-to-r from-amber-400 via-[#f2c14e] to-yellow-300 text-stone-950 font-black text-[7px] sm:text-[8px] py-0.5 px-0.5 rounded text-center shadow-lg border border-white animate-pulse uppercase tracking-tight z-20 leading-tight">
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
