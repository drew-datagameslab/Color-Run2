import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { Die, ScoreResult } from '../types/game';
import { DieComponent } from './DieComponent';
import { ColorRunCelebration } from './ColorRunCelebration';
import { bonusFor } from '../lib/scoring';

interface SavedBoardProps {
  savedDice: Die[];
  scoreResult: ScoreResult;
  onTapSavedDie: (id: number) => void;
  isCPU?: boolean;
  showSixCelebration?: boolean;
  onDismissSixCelebration?: () => void;
  warningSecondsLeft?: number | null;
  onTouchScreen?: () => void;
  forcePips?: boolean;
  colorError?: string | null;
  eliminationBanner?: string | null;
}

export const SavedBoard: React.FC<SavedBoardProps> = ({
  savedDice,
  scoreResult,
  onTapSavedDie,
  isCPU = false,
  showSixCelebration = false,
  onDismissSixCelebration,
  warningSecondsLeft,
  onTouchScreen,
  forcePips = false,
  colorError,
  eliminationBanner,
}) => {
  // Group all saved dice by their face value (1..6).
  // This ensures that as dice are tapped in (especially in the companion app),
  // they appear immediately in the saved dice area without confusion.
  // Ineligible dice (< 3 of a number) appear with 0 pts and a clear "Need 3" badge,
  // while eligible sets (>= 3 of a number) score base points + color bonuses.
  const groups = React.useMemo(() => {
    const byVal: Record<number, Die[]> = {};
    for (const d of savedDice) {
      if (!byVal[d.value]) byVal[d.value] = [];
      byVal[d.value].push(d);
    }

    const result: Array<{
      value: number;
      dice: Die[];
      isEligible: boolean;
      pts: number;
      count: number;
    }> = [];

    for (const vStr in byVal) {
      const v = Number(vStr);
      const diceForVal = [...byVal[v]].sort((a, b) => {
        if (a.color !== b.color) {
          return a.color.localeCompare(b.color);
        }
        return Number(a.id) - Number(b.id);
      });

      const isEligible = diceForVal.length >= 3;
      const setInfo = scoreResult.sets.find(s => s.value === v);
      let pts = 0;
      if (isEligible) {
        if (setInfo) {
          pts = setInfo.base + setInfo.cb;
        } else {
          const base = diceForVal.length * 5;
          const byColor: Record<string, number> = {};
          diceForVal.forEach(d => {
            byColor[d.color] = (byColor[d.color] || 0) + 1;
          });
          let cb = 0;
          for (const c in byColor) {
            cb += bonusFor(byColor[c]);
          }
          pts = base + cb;
        }
      }

      result.push({
        value: v,
        dice: diceForVal,
        isEligible,
        pts,
        count: diceForVal.length,
      });
    }

    // Sort: eligible sets first (sorted by face value), followed by ineligible groups (sorted by face value)
    result.sort((a, b) => {
      if (a.isEligible !== b.isEligible) {
        return a.isEligible ? -1 : 1;
      }
      return a.value - b.value;
    });

    return result;
  }, [savedDice, scoreResult.sets]);

  // Calculate total visual rows across all sets to determine adaptive sizing
  // If 8+ dice of a symbol exist, that set breaks into 2 rows
  const visualRowCount =
    groups.length === 0
      ? 1
      : groups.reduce((acc, g) => {
          return acc + (g.count >= 8 ? 2 : 1);
        }, 0);

  // Die size per row, as the --die CSS variable. Dice shrink below it only when the row is too narrow.
  // Scales down progressively as more rows are added so dice never overlap
  const defaultDieSizeClass =
    visualRowCount >= 5
      ? '[--die:22px] sm:[--die:26px]'
      : visualRowCount === 4
      ? '[--die:26px] sm:[--die:28px]'
      : visualRowCount === 3
      ? '[--die:30px] sm:[--die:34px]'
      : visualRowCount === 2
      ? '[--die:36px] sm:[--die:42px]'
      : '[--die:42px] sm:[--die:48px]';

  // If 7 dice of the same shape are collected, shrink as needed to fit the 7 dice and points total
  const shrunkSevenDieSizeClass =
    visualRowCount >= 5
      ? '[--die:19px] sm:[--die:22px]'
      : visualRowCount === 4
      ? '[--die:22px] sm:[--die:24px]'
      : visualRowCount === 3
      ? '[--die:26px] sm:[--die:30px]'
      : visualRowCount === 2
      ? '[--die:32px] sm:[--die:36px]'
      : '[--die:38px] sm:[--die:42px]';

  const rowGapClass =
    visualRowCount >= 5
      ? 'gap-0.5 md:gap-1'
      : visualRowCount === 4
      ? 'gap-0.5 md:gap-1.5'
      : visualRowCount === 3
      ? 'gap-1 md:gap-2'
      : 'gap-1 sm:gap-1.5 md:gap-2.5';

  // Helper to partition dice across 2 rows keeping same-colored dice on the same line
  const splitDiceByColor = (diceList: Die[]): [Die[], Die[]] => {
    const colorMap = new Map<string, Die[]>();
    for (const d of diceList) {
      const list = colorMap.get(d.color) || [];
      list.push(d);
      colorMap.set(d.color, list);
    }

    // Sort color groups descending by count so the larger color group appears on row 1
    const groups = Array.from(colorMap.values()).sort((a, b) => b.length - a.length);

    // Single color scenario
    if (groups.length === 1) {
      const single = groups[0];
      return [single.slice(0, 6), single.slice(6)];
    }

    // Standard two-color scenario (e.g. Blue & Red in Color Run)
    if (groups.length === 2) {
      const [g1, g2] = groups;
      if (g1.length <= 6 && g2.length <= 6) {
        return [g1, g2];
      }
      if (g1.length > 6) {
        return [g1.slice(0, 6), [...g1.slice(6), ...g2]];
      }
      return [[...g1, ...g2.slice(6)], g2.slice(0, 6)];
    }

    // 3+ colors: keep each color group whole within row 1 (max 6) or row 2 (max 6)
    let row1: Die[] = [];
    let row2: Die[] = [];
    for (const g of groups) {
      if (row1.length + g.length <= 6) {
        row1 = [...row1, ...g];
      } else if (row2.length + g.length <= 6) {
        row2 = [...row2, ...g];
      } else {
        const space1 = Math.max(0, 6 - row1.length);
        row1 = [...row1, ...g.slice(0, space1)];
        row2 = [...row2, ...g.slice(space1)];
      }
    }
    return [row1, row2];
  };

  // Renders one row of dice flush left in fixed-size columns (`cols` slots, each up to --die wide),
  // filling left to right, with dashed placeholders for the remaining slots.
  // Runs of 3+ same-color dice get a gold bonus frame spanning exactly their columns,
  // so framed and unframed dice stay aligned on the same grid.
  const DIE_GAP = 'gap-1 sm:gap-1.5';
  const renderDiceRow = (
    diceList: Die[],
    cols: number,
    dieSizeClass: string,
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

    const renderDie = (d: Die) => (
      <div key={`${keyPrefix}-${d.id}`} className="relative z-1 w-full aspect-square flex items-center justify-center">
        <DieComponent
          color={d.color}
          value={d.value}
          forcePips={forcePips}
          onClick={isCPU ? undefined : () => onTapSavedDie(d.id)}
        />
      </div>
    );

    return (
      <div
        className={`grid ${DIE_GAP} items-center justify-start w-full ${dieSizeClass}`}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, var(--die)))` }}
      >
        {colorGroups.map((group, gIdx) => {
          if (group.length >= 3) {
            const bonusVal = bonusFor(group.length);
            return (
              <div
                key={`${keyPrefix}-bonus-${gIdx}`}
                className={`relative grid ${DIE_GAP} items-center`}
                style={{
                  gridColumn: `span ${group.length}`,
                  gridTemplateColumns: `repeat(${group.length}, minmax(0, 1fr))`,
                }}
              >
                <div className="bonus-frame pointer-events-none" />
                {/* Centered Bonus Total Bubble over dice framed in the yellow outline */}
                <div className="absolute -top-3 sm:-top-3.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none whitespace-nowrap">
                  <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full text-[9px] sm:text-[10px] md:text-[11px] font-black tracking-tight text-[#3a2205] bg-gradient-to-r from-[#ffe066] via-[#fcd34d] to-[#f59e0b] border border-[#fef08a] shadow-[0_2px_6px_rgba(245,158,11,0.55)] animate-scale-up">
                    +{bonusVal} Bonus
                  </span>
                </div>
                {group.map(renderDie)}
              </div>
            );
          }
          return group.map(renderDie);
        })}

        {Array.from({ length: emptySlots }).map((_, sIdx) => (
          <div
            key={`${keyPrefix}-empty-${sIdx}`}
            className="aspect-square w-full rounded-lg md:rounded-xl border border-dashed border-white/15 bg-white/5"
          />
        ))}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full bg-[#131d2e]/85 border border-white/15 rounded-2xl md:rounded-3xl p-1 sm:p-1.5 md:p-3 shadow-lg backdrop-blur-xs select-none flex flex-col justify-between transition-all duration-300 min-h-[72px] md:min-h-[250px] overflow-hidden">
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
      <div className="flex items-center justify-between px-1.5 md:px-2.5 pb-0.5 md:pb-1.5 mb-0.5 md:mb-1.5 border-b border-white/10 shrink-0">
        <span className="text-[13px] sm:text-[15px] md:text-[16px] font-black uppercase tracking-wider text-[#f2c14e] drop-shadow-xs">
          SAVED DICE
        </span>
        <div className="flex items-center gap-2 md:gap-3">
          <span className="text-[10.5px] sm:text-[12px] md:text-[13px] font-extrabold uppercase tracking-wider text-white/80">
            POINTS
          </span>
          <span
            id="saved-dice-total-points"
            className="font-mono font-black text-base sm:text-lg md:text-xl bg-black/60 text-[#54e38e] px-2 md:px-3 py-0.5 md:py-1 rounded-md md:rounded-lg border border-[#54e38e]/50 shadow-xs"
          >
            {scoreResult.total}
          </span>
        </div>
      </div>

      {/* Red banner message when a user is eliminated: "[User] has been eliminated!" */}
      <AnimatePresence>
        {eliminationBanner && (
          <motion.div
            key="elimination-banner-under-labels"
            initial={{ height: 0, opacity: 0, scaleY: 0.85 }}
            animate={{ height: 'auto', opacity: 1, scaleY: 1 }}
            exit={{ height: 0, opacity: 0, scaleY: 0.85 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden w-full px-1 pb-1 shrink-0"
          >
            <div
              id="elimination-alert-banner"
              className="bg-gradient-to-r from-red-700 via-rose-600 to-red-700 border-2 border-red-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 flex items-center justify-center shadow-xl text-white gap-2"
            >
              <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-yellow-300 drop-shadow-md text-center">
                ⚔️ {eliminationBanner}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner if user inputs more than 6 red or blue dice */}
      <AnimatePresence>
        {colorError && (
          <motion.div
            key="dice-limit-error-banner"
            initial={{ height: 0, opacity: 0, scaleY: 0.85 }}
            animate={{ height: 'auto', opacity: 1, scaleY: 1 }}
            exit={{ height: 0, opacity: 0, scaleY: 0.85 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden w-full px-1 pb-1 shrink-0"
          >
            <div
              id="dice-limit-error-banner"
              className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 border border-red-300 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 flex items-center justify-between shadow-lg text-white gap-2"
            >
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-yellow-300 shrink-0 animate-bounce" />
                <span className="text-[10px] sm:text-xs font-black tracking-wide uppercase drop-shadow-xs truncate">
                  {colorError}
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold bg-black/40 text-yellow-200 px-2 py-0.5 rounded-md border border-yellow-300/40 shrink-0 whitespace-nowrap">
                Tap die to remove
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-down 15-second Turn / Idle Warning Bar for Multiplayer Online Games */}
      <AnimatePresence>
        {warningSecondsLeft !== null &&
          warningSecondsLeft !== undefined &&
          warningSecondsLeft <= 15 &&
          warningSecondsLeft > 0 && (
            <motion.div
              key="turn-warning-bar"
              initial={{ height: 0, opacity: 0, scaleY: 0.8 }}
              animate={{ height: 'auto', opacity: 1, scaleY: 1 }}
              exit={{ height: 0, opacity: 0, scaleY: 0.8 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="overflow-hidden w-full px-1 pb-1 shrink-0"
            >
              <div
                onClick={onTouchScreen}
                className="cursor-pointer bg-gradient-to-r from-[#d97706]/95 via-[#dc2626]/95 to-[#d97706]/95 border border-amber-300/80 rounded-lg px-2 sm:px-3 py-1 flex items-center justify-between shadow-md select-none transition-transform active:scale-[0.98]"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-200 shrink-0 animate-bounce" />
                  <span className="text-[10px] sm:text-xs font-black tracking-wide text-white uppercase drop-shadow-xs truncate">
                    Touch screen or roll to play!
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 pl-1.5">
                  <span className="font-mono font-black text-[11px] sm:text-xs bg-black/60 text-[#fef08a] px-1.5 py-0.5 rounded border border-amber-300/50 shadow-inner">
                    {warningSecondsLeft}s
                  </span>
                </div>
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* Rows Container: Each set pairs its dice and points total together */}
      <div className={`flex-1 flex flex-col justify-center ${rowGapClass} min-h-0 w-full px-0.5 pt-1.5 sm:pt-2 pb-0.5 overflow-y-auto`}>
        {groups.length === 0 ? (
          // Empty placeholder row when no dice are saved yet
          <div className="flex items-stretch justify-between gap-1 sm:gap-1.5 md:gap-2.5 w-full max-w-[360px] sm:max-w-[420px] md:max-w-[520px] mx-auto min-h-0">
            <div className="flex-1 min-w-0 flex items-center justify-start">
              {renderDiceRow([], 6, defaultDieSizeClass, 'empty-init')}
            </div>
            {/* Points box matches dice row height, centered */}
            <div className="w-8 sm:w-10 md:w-14 shrink-0 self-stretch flex items-center justify-center pl-1 md:pl-2">
              <div className="w-full h-full min-h-[30px] sm:min-h-[38px] md:min-h-[48px] flex items-center justify-center font-mono font-black text-xs sm:text-base md:text-xl text-white/30 border border-white/10 rounded-lg md:rounded-xl text-center">
                0
              </div>
            </div>
          </div>
        ) : (
          groups.map(group => {
            const matchingDice = group.dice;
            const pts = group.pts;
            const count = group.count;
            const isEligible = group.isEligible;

            if (count >= 8) {
              // 8 or more dice of same symbol: broken into 2 rows, keeping same-colored dice on the same line.
              // Points box is the height of the two rows with points total centered!
              const [row1Dice, row2Dice] = splitDiceByColor(matchingDice);

              return (
                <div
                  key={`group-${group.value}`}
                  className="flex items-stretch justify-between gap-1 sm:gap-1.5 md:gap-2.5 w-full max-w-[360px] sm:max-w-[420px] md:max-w-[520px] mx-auto min-h-0"
                >
                  {/* Two rows of dice */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1 md:gap-1.5 justify-center">
                    {renderDiceRow(row1Dice, 6, defaultDieSizeClass, `group-${group.value}-r1`)}
                    {renderDiceRow(row2Dice, 6, defaultDieSizeClass, `group-${group.value}-r2`)}
                  </div>

                  {/* Points box spanning the height of the two rows with points total centered */}
                  <div className="w-8 sm:w-10 md:w-14 shrink-0 self-stretch flex items-center justify-center pl-1 md:pl-2">
                    {isEligible ? (
                      <div className="w-full h-full min-h-[60px] sm:min-h-[76px] md:min-h-[96px] flex items-center justify-center font-mono font-black text-xs sm:text-base md:text-xl rounded-xl md:rounded-2xl bg-[#28974a] text-white border-2 border-[#34c759] shadow-md text-center">
                        {pts}
                      </div>
                    ) : (
                      <div
                        className="w-full h-full min-h-[60px] sm:min-h-[76px] md:min-h-[96px] flex flex-col items-center justify-center font-mono rounded-xl md:rounded-2xl bg-white/5 border border-dashed border-white/20 text-center shadow-xs px-0.5"
                        title="Ineligible: Needs 3 or more of this number to score"
                      >
                        <span className="font-black text-xs sm:text-base text-white/40">
                          0
                        </span>
                        <span className="text-[7px] sm:text-[8px] font-sans font-extrabold text-[#f2c14e]/85 uppercase tracking-tight -mt-0.5 leading-none">
                          Need 3
                        </span>
                      </div>
                    )}
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
                key={`group-${group.value}`}
                className="flex items-stretch justify-between gap-1 sm:gap-1.5 md:gap-2.5 w-full max-w-[360px] sm:max-w-[420px] md:max-w-[520px] mx-auto min-h-0"
              >
                {/* Dice container for 1 row */}
                <div className="flex-1 min-w-0 flex items-center justify-start">
                  {renderDiceRow(matchingDice, cols, dieClass, `group-${group.value}`)}
                </div>

                {/* Points box matching the height of the single dice row with points total centered */}
                <div className="w-8 sm:w-10 md:w-14 shrink-0 self-stretch flex items-center justify-center pl-1 md:pl-2">
                  {isEligible ? (
                    <div className="w-full h-full min-h-[30px] sm:min-h-[38px] md:min-h-[48px] flex items-center justify-center font-mono font-black text-xs sm:text-base md:text-xl rounded-lg md:rounded-xl bg-[#28974a] text-white border border-[#34c759] shadow-xs text-center transition-colors">
                      {pts}
                    </div>
                  ) : (
                    <div
                      className="w-full h-full min-h-[30px] sm:min-h-[38px] md:min-h-[48px] flex flex-col items-center justify-center font-mono rounded-lg md:rounded-xl bg-white/5 border border-dashed border-white/20 text-center shadow-xs transition-colors px-0.5"
                      title="Ineligible: Needs 3 or more of this number to score"
                    >
                      <span className="font-black text-xs sm:text-sm md:text-base text-white/40">
                        0
                      </span>
                      <span className="text-[7px] sm:text-[8px] font-sans font-extrabold text-[#f2c14e]/85 uppercase tracking-tight -mt-0.5 leading-none">
                        Need 3
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
