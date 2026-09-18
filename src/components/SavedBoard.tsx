import React from 'react';
import { Die, ScoreResult } from '../types/game';
import { DieComponent } from './DieComponent';
import { ColorRunCelebration } from './ColorRunCelebration';

interface SavedBoardProps {
  savedDice: Die[];
  scoreResult: ScoreResult;
  onTapSavedDie: (id: string) => void;
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

  // Calculate total visual rows across all sets to determine adaptive sizing
  // If 8+ dice of a symbol exist, that set breaks into 2 rows
  const visualRowCount =
    sets.length === 0
      ? 1
      : sets.reduce((acc, s) => {
          const count = savedDice.filter(d => d.value === s.value).length;
          return acc + (count >= 8 ? 2 : 1);
        }, 0);

  // Default dice size: slightly smaller than rolling area to account for points total boxes
  // Scales down progressively as more rows are added so dice never overlap
  const defaultDieSizeClass =
    visualRowCount >= 4
      ? 'max-w-[25px] max-h-[25px] sm:max-w-[28px] sm:max-h-[28px]'
      : visualRowCount === 3
      ? 'max-w-[31px] max-h-[31px] sm:max-w-[35px] sm:max-h-[35px]'
      : visualRowCount === 2
      ? 'max-w-[38px] max-h-[38px] sm:max-w-[42px] sm:max-h-[42px]'
      : 'max-w-[45px] max-h-[45px] sm:max-w-[49px] sm:max-h-[49px]';

  // If 7 dice of the same shape are collected, shrink as needed to fit the 7 dice and points total
  const shrunkSevenDieSizeClass =
    visualRowCount >= 4
      ? 'max-w-[21px] max-h-[21px] sm:max-w-[24px] sm:max-h-[24px]'
      : visualRowCount === 3
      ? 'max-w-[26px] max-h-[26px] sm:max-w-[30px] sm:max-h-[30px]'
      : visualRowCount === 2
      ? 'max-w-[32px] max-h-[32px] sm:max-w-[36px] sm:max-h-[36px]'
      : 'max-w-[38px] max-h-[38px] sm:max-w-[42px] sm:max-h-[42px]';

  const rowGapClass =
    visualRowCount >= 4
      ? 'gap-0.5'
      : visualRowCount === 3
      ? 'gap-1'
      : 'gap-1 sm:gap-1.5';

  // Helper to render a row of dice with bonus groups (gold frame for 3+ consecutive same color)
  const renderDiceRow = (
    diceList: Die[],
    cols: number,
    dieClass: string,
    keyPrefix: string
  ) => {
    // Group consecutive same-color dice
    const colorGroups: Die[][] = [];
    let i = 0;
    while (i < diceList.length) {
      let j = i;
      while (j < diceList.length && diceList[j].color === diceList[i].color) {
        j++;
      }
      colorGroups.push(diceList.slice(i, j));
      i = j;
    }

    const emptySlots = Math.max(0, cols - diceList.length);

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
                key={`${keyPrefix}-bonus-${gIdx}`}
                className="bonus-box relative flex gap-0.5 p-0.5 items-center justify-center"
                style={{ gridColumn: `span ${group.length}` }}
              >
                <div className="bonus-frame pointer-events-none" />
                {group.map(d => (
                  <div
                    key={`${keyPrefix}-${d.id}`}
                    className={`relative z-1 w-full ${dieClass} flex items-center justify-center`}
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
              key={`${keyPrefix}-${d.id}`}
              className={`w-full ${dieClass} flex items-center justify-center`}
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
            key={`${keyPrefix}-empty-${sIdx}`}
            className={`aspect-square ${dieClass} w-full rounded-lg border border-dashed border-white/15 bg-white/5`}
          />
        ))}
      </div>
    );
  };

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

      {/* Header bar: SAVED DICE & POINTS (30% larger) */}
      <div className="flex items-center justify-between px-1.5 pb-0.5 mb-0.5 border-b border-white/10 shrink-0">
        <span className="text-[13px] sm:text-[15px] font-black uppercase tracking-wider text-[#f2c14e] drop-shadow-xs">
          SAVED DICE
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] sm:text-[12px] font-extrabold uppercase tracking-wider text-white/80">
            POINTS
          </span>
          <span className="font-mono font-black text-base sm:text-lg bg-black/60 text-[#54e38e] px-2 py-0.5 rounded-md border border-[#54e38e]/50 shadow-xs">
            {scoreResult.total}
          </span>
        </div>
      </div>

      {/* Rows Container: Each set pairs its dice and points total together */}
      <div className={`flex-1 flex flex-col justify-center ${rowGapClass} min-h-0 w-full px-0.5`}>
        {sets.length === 0 ? (
          // Empty placeholder row when no dice are saved yet
          <div className="flex items-stretch justify-between gap-1 sm:gap-1.5 w-full max-w-[360px] sm:max-w-[420px] mx-auto min-h-0">
            <div className="flex-1 min-w-0 flex items-center justify-center">
              <div className="grid grid-cols-6 gap-1 sm:gap-1.5 items-center justify-items-center w-full">
                {Array.from({ length: 6 }).map((_, sIdx) => (
                  <div
                    key={`empty-init-${sIdx}`}
                    className={`aspect-square ${defaultDieSizeClass} w-full rounded-lg border border-dashed border-white/15 bg-white/5 flex items-center justify-center`}
                  />
                ))}
              </div>
            </div>
            {/* Points box matches dice row height, centered */}
            <div className="w-8 sm:w-9 shrink-0 self-stretch flex items-center justify-center pl-1">
              <div className="w-full h-full min-h-[32px] flex items-center justify-center font-mono font-black text-xs sm:text-sm text-white/30 border border-white/10 rounded-lg text-center">
                0
              </div>
            </div>
          </div>
        ) : (
          sets.map(set => {
            const matchingDice = savedDice.filter(d => d.value === set.value);
            const pts = set.base + set.cb;
            const count = matchingDice.length;

            if (count >= 8) {
              // 8 or more dice of same symbol: broken into 2 rows.
              // Points box is the height of the two rows with points total centered!
              const row1Dice = matchingDice.slice(0, 6);
              const row2Dice = matchingDice.slice(6);

              return (
                <div
                  key={`set-${set.value}`}
                  className="flex items-stretch justify-between gap-1 sm:gap-1.5 w-full max-w-[360px] sm:max-w-[420px] mx-auto min-h-0"
                >
                  {/* Two rows of dice */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1 justify-center">
                    {renderDiceRow(row1Dice, 6, defaultDieSizeClass, `set-${set.value}-r1`)}
                    {renderDiceRow(row2Dice, 6, defaultDieSizeClass, `set-${set.value}-r2`)}
                  </div>

                  {/* Points box spanning the height of the two rows with points total centered */}
                  <div className="w-8 sm:w-9 shrink-0 self-stretch flex items-center justify-center pl-1">
                    <div className="w-full h-full min-h-[64px] flex items-center justify-center font-mono font-black text-xs sm:text-sm rounded-xl bg-[#28974a] text-white border-2 border-[#34c759] shadow-md text-center">
                      {pts}
                    </div>
                  </div>
                </div>
              );
            }

            // 1 to 7 dice of the same symbol: 1 row
            // If 7 dice: shrink as needed to fit the seven dice and the points total
            const isSeven = count === 7;
            const cols = isSeven ? 7 : 6;
            const dieClass = isSeven ? shrunkSevenDieSizeClass : defaultDieSizeClass;

            return (
              <div
                key={`set-${set.value}`}
                className="flex items-stretch justify-between gap-1 sm:gap-1.5 w-full max-w-[360px] sm:max-w-[420px] mx-auto min-h-0"
              >
                {/* Dice container for 1 row */}
                <div className="flex-1 min-w-0 flex items-center justify-center">
                  {renderDiceRow(matchingDice, cols, dieClass, `set-${set.value}`)}
                </div>

                {/* Points box matching the height of the single dice row with points total centered */}
                <div className="w-8 sm:w-9 shrink-0 self-stretch flex items-center justify-center pl-1">
                  <div className="w-full h-full min-h-[32px] flex items-center justify-center font-mono font-black text-xs sm:text-sm rounded-lg bg-[#28974a] text-white border border-[#34c759] shadow-xs text-center">
                    {pts}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
