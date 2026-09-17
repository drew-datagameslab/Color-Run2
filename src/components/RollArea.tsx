import React from 'react';
import { Die } from '../types/game';
import { DieComponent } from './DieComponent';

interface RollAreaProps {
  dice: Die[];
  rollsUsed: number;
  rollSlotsCount?: number;
  isCPU: boolean;
  playerName: string;
  isRolling: boolean;
  onTapActiveDie: (id: number) => void;
  onDoRoll: () => void;
  spectatorState?: {
    isUserOut: boolean;
    choiceMade: boolean;
    fastForwarding: boolean;
    onShowFinalScore: () => void;
    onLetPlayersFinish: () => void;
  };
}

export const RollArea: React.FC<RollAreaProps> = ({
  dice,
  rollsUsed,
  rollSlotsCount,
  isCPU,
  playerName,
  isRolling,
  onTapActiveDie,
  onDoRoll,
  spectatorState,
}) => {
  const activeDice = dice.filter(d => d.zone === 'active');
  const slotsCount = rollSlotsCount ?? (rollsUsed === 0 ? 12 : activeDice.length);

  // Layout sizing:
  // - Roll 1: 12 dice (2 rows of 6)
  // - Roll 2/3 with 4 saved (8 remaining): 2 rows of 4
  // - Roll 2/3 with 6 or less remaining: 1 row of dice, container shrinks in height
  const isSingleRow = rollsUsed > 0 && slotsCount <= 6;
  const isFourCols = !isSingleRow && slotsCount <= 8;
  const totalSlots = isSingleRow ? Math.max(slotsCount, 1) : isFourCols ? 8 : 12;

  const slots = Array.from({ length: totalSlots }, (_, i) => i);

  return (
    <div
      className={`relative w-full rounded-2xl bg-[#144b26] border border-[#2f9a4f]/70 p-1 sm:p-1.5 shadow-xl flex flex-col justify-center transition-all duration-200 ${
        isSingleRow ? 'min-h-[58px] sm:min-h-[66px] py-1.5' : 'min-h-[106px] sm:min-h-[118px] py-1.5'
      }`}
    >
      {/* Dice Grid/Row - 1.25x larger default dice with responsive width shrinking */}
      <div
        className={
          isSingleRow
            ? 'flex justify-center items-center gap-1.5 sm:gap-2 max-w-[350px] sm:max-w-[390px] mx-auto w-full px-1.5'
            : isFourCols
            ? 'grid grid-cols-4 gap-1.5 sm:gap-2 max-w-[250px] sm:max-w-[280px] mx-auto w-full px-1.5 justify-items-center'
            : 'grid grid-cols-6 gap-1.5 sm:gap-2 max-w-[350px] sm:max-w-[390px] mx-auto w-full px-1.5 justify-items-center'
        }
      >
        {slots.map(slotIdx => {
          const die =
            activeDice.find(d => d.slotIndex === slotIdx) ||
            (activeDice[slotIdx] && activeDice[slotIdx].slotIndex === undefined
              ? activeDice[slotIdx]
              : undefined);

          if (die) {
            return (
              <div
                key={die.id}
                className={
                  isSingleRow
                    ? 'w-9 h-9 sm:w-10 sm:h-10 max-w-[50px] max-h-[50px] flex-shrink-1 min-w-0'
                    : 'w-full max-w-[50px] sm:max-w-[55px] min-w-0 aspect-square'
                }
              >
                <DieComponent
                  color={die.color}
                  value={die.value}
                  rolling={isRolling}
                  selected={die.selected}
                  delayMs={0}
                  onClick={
                    isCPU || rollsUsed === 0 ? undefined : () => onTapActiveDie(die.id)
                  }
                />
              </div>
            );
          }

          // Blank space where die was moved to Saved Area
          return (
            <div
              key={`slot-empty-${slotIdx}`}
              className={`aspect-square rounded-[16%] border border-dashed border-[#2f9a4f]/30 bg-black/15 pointer-events-none transition-all ${
                isSingleRow
                  ? 'w-9 h-9 sm:w-10 sm:h-10 max-w-[50px] max-h-[50px] flex-shrink-1 min-w-0'
                  : 'w-full max-w-[50px] sm:max-w-[55px] min-w-0'
              }`}
            />
          );
        })}
      </div>

      {/* Start Turn Overlay Hint - High-visibility alert that the user needs to roll */}
      {rollsUsed === 0 && (
        <div
          onClick={isCPU ? undefined : onDoRoll}
          className={`absolute inset-0 rounded-2xl bg-[#144628]/90 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all z-10 
            ${!isCPU ? 'hover:bg-[#144628]/80 ring-2 ring-[#f2c14e] ring-inset animate-pulse' : ''}`}
        >
          <div className="text-lg sm:text-xl font-black text-[#f2c14e] drop-shadow-md">
            {isCPU ? `🤖 ${playerName} is ready` : '👉 Your Turn! Tap ROLL'}
          </div>
          <div className="text-xs text-white/95 mt-0.5 font-bold">
            {isCPU ? 'Computer will roll…' : `${playerName} · Tap to roll all 12 dice`}
          </div>
        </div>
      )}

      {/* All Dice Saved Hint */}
      {rollsUsed > 0 && activeDice.length === 0 && (
        <div className="absolute inset-0 rounded-2xl bg-[#144628]/85 flex flex-col items-center justify-center p-3 text-center z-10">
          <div className="text-lg sm:text-xl font-black text-[#f2c14e] drop-shadow-md">
            All dice saved! 🎉
          </div>
          <div className="text-xs text-[#d8f3df] mt-0.5 font-medium">
            Tap SCORE IT! to bank points
          </div>
        </div>
      )}

      {/* Spectator Choice Overlay if player is out */}
      {spectatorState?.isUserOut && !spectatorState.choiceMade && (
        <div className="absolute inset-0 rounded-2xl bg-black/85 flex flex-col items-center justify-center p-4 text-center z-20 gap-3">
          <div className="text-white font-bold text-sm sm:text-base">
            You're out — the CPUs are still playing!
          </div>
          <div className="flex gap-2 w-full max-w-xs justify-center">
            <button
              onClick={spectatorState.onShowFinalScore}
              className="flex-1 py-2 px-3 bg-[#2f9a4f] hover:bg-[#268a48] text-white text-xs sm:text-sm font-bold rounded-lg shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              Speed to Final Score
            </button>
            <button
              onClick={spectatorState.onLetPlayersFinish}
              className="flex-1 py-2 px-3 bg-[#efe3ad] hover:bg-[#e4d69b] text-[#2e2316] text-xs sm:text-sm font-bold rounded-lg shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              Watch Game
            </button>
          </div>
        </div>
      )}

      {/* Spectator Fast Forward Indicator */}
      {spectatorState?.isUserOut && spectatorState.fastForwarding && (
        <div className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center p-4 text-center z-20">
          <div className="text-2xl animate-spin">⏳</div>
          <div className="text-white font-medium text-xs mt-2">
            Simulating the rest of the game…
          </div>
        </div>
      )}
    </div>
  );
};
