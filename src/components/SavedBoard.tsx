import React from 'react';
import { Die, ScoreResult } from '../types/game';
import { DieComponent } from './DieComponent';

interface SavedBoardProps {
  savedDice: Die[];
  scoreResult: ScoreResult;
  onTapSavedDie: (id: number) => void;
  isCPU?: boolean;
}

export const SavedBoard: React.FC<SavedBoardProps> = ({
  savedDice,
  scoreResult,
  onTapSavedDie,
  isCPU = false,
}) => {
  const sets = scoreResult.sets;
  const nRows = Math.max(1, sets.length);

  return (
    <div className="w-full bg-[#f6edd5] border border-[#d6c7a1] rounded-xl p-2 sm:p-2.5 shadow-inner">
      <div className="flex items-center justify-between text-xs font-bold text-[#6d5138] px-1 pb-1 mb-1 border-b border-[#ebdcb9]">
        <span>Saved Dice</span>
        <span>Points</span>
      </div>

      <div className="flex gap-2">
        {/* Dice Rows Grid */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          {Array.from({ length: nRows }).map((_, rIdx) => {
            const set = sets[rIdx];
            if (!set) {
              // Empty placeholder row with 6 slots
              return (
                <div key={rIdx} className="grid grid-cols-6 gap-1.5 min-h-9 sm:min-h-11">
                  {Array.from({ length: 6 }).map((_, sIdx) => (
                    <div
                      key={sIdx}
                      className="aspect-square rounded-[16%] border-2 border-dashed border-[#ddceaa] bg-black/5"
                    />
                  ))}
                </div>
              );
            }

            // Dice for this set, keeping color contiguous
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
                key={rIdx}
                className="grid gap-1.5 min-h-9 sm:min-h-11 items-center"
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
                        className="bonus-box relative flex gap-1 p-0.5"
                        style={{ gridColumn: `span ${group.length}` }}
                      >
                        <div className="bonus-frame pointer-events-none" />
                        {group.map(d => (
                          <div key={d.id} className="relative z-1 flex-1 min-w-0">
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
                    <div key={d.id} className="w-full">
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
                    className="aspect-square rounded-[16%] border-2 border-dashed border-[#ddceaa] bg-black/5"
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* Points Column */}
        <div className="w-14 sm:w-16 flex flex-col gap-1.5 border-l border-[#ebdcb9] pl-2 justify-around">
          {Array.from({ length: nRows }).map((_, rIdx) => {
            const set = sets[rIdx];
            const pts = set ? set.base + set.cb : 0;
            return (
              <div
                key={rIdx}
                className={`flex items-center justify-center font-mono font-bold text-sm sm:text-base rounded-md py-1 
                  ${set ? 'bg-[#2f9a4f]/10 text-[#1c6a35] border border-[#2f9a4f]/30' : 'text-[#b5a993]'}`}
              >
                {pts}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
