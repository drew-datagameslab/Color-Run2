import React from 'react';
import { Die, ScoreResult } from '../types/game';
import { DieComponent } from './DieComponent';
import { ColorRunCelebration } from './ColorRunCelebration';

interface SavedBoardProps {
  savedDice: Die[];
  scoreResult: ScoreResult;
  onTapSavedDie: (id: number) => void;
  isCPU?: boolean;
  showSixCelebration?: boolean;
  onDismissSixCelebration?: () => void;
}

export const SavedBoard: React.FC<SavedBoardProps> = ({
  savedDice,
  scoreResult,
  onTapSavedDie,
  isCPU = false,
  showSixCelebration = false,
  onDismissSixCelebration,
}) => {
  const sets = scoreResult.sets;
  // When no dice are saved, show only one row of empty dice placeholders
  const nRows = savedDice.length === 0 ? 1 : Math.max(1, sets.length);

  // Dynamic sizing based on row count so dice never overlap
  // Default dice size reduced by 20% (baseline 43px -> 34px), and scales down dynamically with more rows
  const dieSizeClass =
    nRows >= 4
      ? 'max-w-[22px] max-h-[22px] sm:max-w-[25px] sm:max-h-[25px]'
      : nRows === 3
      ? 'max-w-[26px] max-h-[26px] sm:max-w-[30px] sm:max-h-[30px]'
      : nRows === 2
      ? 'max-w-[30px] max-h-[30px] sm:max-w-[34px] sm:max-h-[34px]'
      : 'max-w-[34px] max-h-[34px] sm:max-w-[38px] sm:max-h-[38px]';

  const rowGapClass =
    nRows >= 4 ? 'gap-0.5' : nRows === 3 ? 'gap-0.5 sm:gap-1' : 'gap-1 sm:gap-1.5';

  return (
    <div className="relative w-full h-full bg-[#131d2e]/85 border border-white/15 rounded-2xl p-1 sm:p-1.5 shadow-lg backdrop-blur-xs select-none flex flex-col justify-between transition-all duration-300 min-h-[72px] overflow-hidden">
      {/* 6-of-a-kind Color Run Animation playing directly over the dice in the saved dice area with black background removed */}
      {showSixCelebration && (
        <div
          onClick={onDismissSixCelebration}
          className="absolute inset-0 z-30 flex items-center justify-center pointer-events-auto cursor-pointer bg-transparent animate-fade-in"
        >
          <ColorRunCelebration onEnded={onDismissSixCelebration} />
        </div>
      )}

      {/* Header bar: SAVED DICE & POINTS */}
      <div className="flex items-center justify-between px-1.5 pb-0.5 mb-0.5 border-b border-white/10 shrink-0">
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-[#f2c14e] drop-shadow-xs">
          SAVED DICE
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-white/75">
            POINTS
          </span>
          <span className="font-mono font-black text-xs sm:text-sm bg-black/50 text-[#54e38e] px-1.5 py-0.2 rounded border border-[#54e38e]/40 shadow-xs">
            {scoreResult.total}
          </span>
        </div>
      </div>

      {/* Rows Container: Each row pairs dice and points together for strict vertical alignment */}
      <div className={`flex-1 flex flex-col justify-center ${rowGapClass} min-h-0 w-full px-0.5`}>
        {Array.from({ length: nRows }).map((_, rIdx) => {
          const set = sets[rIdx];
          const pts = set ? set.base + set.cb : 0;

          return (
            <div
              key={rIdx}
              className="flex items-center justify-between gap-1 sm:gap-1.5 w-full max-w-[360px] sm:max-w-[400px] mx-auto min-h-0"
            >
              {/* Dice for this row (20% reduced default, adapts to prevent row overlap) */}
              <div className="flex-1 min-w-0 flex items-center justify-center">
                {!set ? (
                  // Empty placeholder row with 6 slots
                  <div className="grid grid-cols-6 gap-1 sm:gap-1.5 items-center justify-items-center w-full">
                    {Array.from({ length: 6 }).map((_, sIdx) => (
                      <div
                        key={sIdx}
                        className={`aspect-square ${dieSizeClass} w-full rounded-lg border border-dashed border-white/15 bg-white/5 flex items-center justify-center`}
                      />
                    ))}
                  </div>
                ) : (
                  (() => {
                    const matchingDice = savedDice.filter(d => d.value === set.value);
                    const cols = Math.max(6, matchingDice.length);

                    // Group consecutive same-color dice
                    const colorGroups: Die[][] = [];
                    let i = 0;
                    while (i < matchingDice.length) {
                      let j = i;
                      while (j < matchingDice.length && matchingDice[j].color === matchingDice[i].color) {
                        j++;
                      }
                      colorGroups.push(matchingDice.slice(i, j));
                      i = j;
                    }

                    const emptySlots = Math.max(0, cols - matchingDice.length);

                    return (
                      <div
                        className="grid gap-0.5 sm:gap-1 items-center justify-items-center w-full"
                        style={{
                          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                        }}
                      >
                        {colorGroups.map((group, gIdx) => {
                          const hasBonus = group.length >= 3;
                          if (hasBonus) {
                            return (
                              <div
                                key={gIdx}
                                className="bonus-box relative flex gap-0.5 p-0.5 items-center justify-center"
                                style={{ gridColumn: `span ${group.length}` }}
                              >
                                <div className="bonus-frame pointer-events-none" />
                                {group.map(d => (
                                  <div
                                    key={d.id}
                                    className={`relative z-1 w-full ${dieSizeClass} flex-1 min-w-0`}
                                  >
                                    <DieComponent
                                      color={d.color}
                                      value={d.value}
                                      onClick={isCPU ? undefined : () => onTapSavedDie(d.id)}
                                    />
                                  </div>
                                ))}
                              </div>
                            );
                          }

                          return group.map(d => (
                            <div
                              key={d.id}
                              className={`w-full ${dieSizeClass} flex items-center justify-center`}
                            >
                              <DieComponent
                                color={d.color}
                                value={d.value}
                                onClick={isCPU ? undefined : () => onTapSavedDie(d.id)}
                              />
                            </div>
                          ));
                        })}

                        {Array.from({ length: emptySlots }).map((_, sIdx) => (
                          <div
                            key={`empty-${sIdx}`}
                            className={`aspect-square ${dieSizeClass} w-full rounded-lg border border-dashed border-white/15 bg-white/5`}
                          />
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Points badge strictly aligned to this exact dice row */}
              <div className="w-8 sm:w-9 shrink-0 flex items-center justify-center border-l border-white/10 pl-1">
                <div
                  className={`w-full flex items-center justify-center font-mono font-black text-[11px] sm:text-xs rounded-md py-0.5 shadow-xs transition-colors
                    ${set ? 'bg-[#28974a] text-white border border-[#34c759]' : 'text-white/30 border border-white/10'}`}
                >
                  {pts}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
