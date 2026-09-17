import React from 'react';
import { Die, ScoreResult } from '../types/game';
import { DieComponent } from './DieComponent';

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
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (showSixCelebration && videoRef.current) {
      const p = videoRef.current.play();
      if (p !== undefined) {
        p.catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [showSixCelebration]);

  return (
    <div className="relative w-full h-full bg-[#131d2e]/85 border border-white/15 rounded-2xl p-1.5 sm:p-2 shadow-lg backdrop-blur-xs select-none flex flex-col justify-between transition-all duration-300 min-h-[80px] overflow-hidden">
      {/* 6-of-a-kind Color Run Video Animation playing directly over the dice in the saved dice area */}
      {showSixCelebration && (
        <div
          onClick={onDismissSixCelebration}
          className="absolute inset-0 z-30 flex items-center justify-center pointer-events-auto cursor-pointer bg-transparent animate-fade-in"
        >
          <video
            ref={videoRef}
            src="/media/color-run.mp4"
            autoPlay
            playsInline
            className="w-full h-full object-contain pointer-events-none"
            style={{
              mixBlendMode: 'screen',
              opacity: 0.95,
              filter: 'contrast(1.15) brightness(1.1)',
            }}
            onEnded={onDismissSixCelebration}
          />
        </div>
      )}

      {/* Header bar: SAVED DICE & POINTS */}
      <div className="flex items-center justify-between px-1.5 pb-1 mb-1 border-b border-white/10 shrink-0">
        <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#f2c14e] drop-shadow-xs">
          SAVED DICE
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-white/75">
            POINTS
          </span>
          <span className="font-mono font-black text-xs sm:text-sm bg-black/50 text-[#54e38e] px-2 py-0.5 rounded-md border border-[#54e38e]/40 shadow-xs">
            {scoreResult.total}
          </span>
        </div>
      </div>

      {/* Rows Container: Each row pairs dice and points together for 100% strict vertical alignment */}
      <div className="flex-1 flex flex-col justify-center gap-1 sm:gap-1.5 min-h-0 w-full px-1">
        {Array.from({ length: nRows }).map((_, rIdx) => {
          const set = sets[rIdx];
          const pts = set ? set.base + set.cb : 0;

          return (
            <div
              key={rIdx}
              className="flex items-center justify-between gap-1.5 sm:gap-2 w-full max-w-[360px] sm:max-w-[400px] mx-auto min-h-0"
            >
              {/* Dice for this row (1.25x larger default with fluid shrink) */}
              <div className="flex-1 min-w-0 flex items-center justify-center">
                {!set ? (
                  // Empty placeholder row with 6 slots (1.25x larger)
                  <div className="grid grid-cols-6 gap-1 sm:gap-1.5 items-center justify-items-center w-full">
                    {Array.from({ length: 6 }).map((_, sIdx) => (
                      <div
                        key={sIdx}
                        className="aspect-square max-w-[43px] max-h-[43px] sm:max-w-[48px] sm:max-h-[48px] w-full rounded-xl border-2 border-dashed border-white/15 bg-white/5 flex items-center justify-center"
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
                        className="grid gap-1 sm:gap-1.5 items-center justify-items-center w-full"
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
                                    className="relative z-1 w-full max-w-[43px] sm:max-w-[48px] flex-1 min-w-0"
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
                              className="w-full max-w-[43px] sm:max-w-[48px] flex items-center justify-center"
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
                            className="aspect-square max-w-[43px] max-h-[43px] sm:max-w-[48px] sm:max-h-[48px] w-full rounded-xl border-2 border-dashed border-white/15 bg-white/5"
                          />
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Points badge strictly aligned to this exact dice row */}
              <div className="w-10 sm:w-11 shrink-0 flex items-center justify-center border-l border-white/10 pl-1.5 sm:pl-2">
                <div
                  className={`w-full flex items-center justify-center font-mono font-black text-xs sm:text-sm rounded-lg py-1 sm:py-1.5 shadow-xs transition-colors
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
