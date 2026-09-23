import React from 'react';
import { Die } from '../types/game';
import { DieComponent } from './DieComponent';

interface RollAreaProps {
  dice: Die[];
  rollsUsed: number;
  rollSlotsCount?: number;
  isCPU: boolean;
  isHumanOwner?: boolean;
  isRemoteHuman?: boolean;
  joiningCountdown?: number | null;
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
  isHumanOwner = false,
  isRemoteHuman = false,
  joiningCountdown = null,
  playerName,
  isRolling,
  onTapActiveDie,
  onDoRoll,
  spectatorState,
}) => {
  const activeDice = dice.filter(d => d.zone === 'active');
  const slotsCount = rollSlotsCount ?? (rollsUsed === 0 ? 12 : activeDice.length);

  // Layout sizing:
  // - Roll 1 or when more than 6 dice remain: 2 rows of 6 dice (12 slots in grid-cols-6)
  // - When 6 dice or fewer remain after a roll: 1 row of dice
  const isSingleRow = rollsUsed > 0 && activeDice.length <= 6;
  const totalSlots = isSingleRow ? Math.max(activeDice.length, 1) : 12;

  const slots = Array.from({ length: totalSlots }, (_, i) => i);

  return (
    <div
      className={`relative w-full rounded-2xl bg-[#144b26] border border-[#2f9a4f]/70 p-1.5 sm:p-2 shadow-xl flex flex-col justify-center transition-all duration-200 overflow-visible ${
        isSingleRow ? 'min-h-[70px] sm:min-h-[78px] py-1.5 sm:py-2' : 'min-h-[116px] sm:min-h-[126px] py-1.5 sm:py-2'
      }`}
    >
      {/* Dice Grid/Row - strictly 1 row of up to 6 dice or 2 rows of 6 dice */}
      <div
        className={
          isSingleRow
            ? 'flex justify-center items-center gap-1.5 sm:gap-2 max-w-full mx-auto w-full px-1'
            : 'grid grid-cols-6 gap-1 sm:gap-1.5 max-w-full mx-auto w-full px-1 justify-items-center'
        }
      >
        {isSingleRow ? (
          // In single row mode: display remaining active dice centered at proportional size
          activeDice.map(die => (
            <div
              key={die.id}
              className="w-[42px] h-[42px] sm:w-[48px] sm:h-[48px] max-w-[48px] flex-shrink-0 aspect-square flex items-center justify-center"
            >
              <DieComponent
                color={die.color}
                value={die.value}
                rolling={isRolling}
                selected={die.selected}
                delayMs={0}
                onClick={
                  isHumanOwner && rollsUsed > 0 && !isRolling ? () => onTapActiveDie(die.id) : undefined
                }
              />
            </div>
          ))
        ) : (
          slots.map(slotIdx => {
            const die =
              activeDice.find(d => d.slotIndex === slotIdx) ||
              (activeDice[slotIdx] && activeDice[slotIdx].slotIndex === undefined
                ? activeDice[slotIdx]
                : undefined);

            if (die) {
              return (
                <div
                  key={die.id}
                  className="w-full max-w-[44px] sm:max-w-[48px] aspect-square min-w-0 flex items-center justify-center"
                >
                  <DieComponent
                    color={die.color}
                    value={die.value}
                    rolling={isRolling}
                    selected={die.selected}
                    delayMs={0}
                    onClick={
                      isHumanOwner && rollsUsed > 0 && !isRolling ? () => onTapActiveDie(die.id) : undefined
                    }
                  />
                </div>
              );
            }

            // Blank space where die was moved to Saved Area
            return (
              <div
                key={`slot-empty-${slotIdx}`}
                className="aspect-square rounded-[16%] border border-dashed border-[#2f9a4f]/35 bg-black/15 pointer-events-none transition-all w-full max-w-[44px] sm:max-w-[48px] min-w-0"
              />
            );
          })
        )}
      </div>

      {/* Start Turn Overlay Hint - High-visibility alert that the user needs to roll */}
      {rollsUsed === 0 && (
        <div
          onClick={isHumanOwner && (joiningCountdown === null || joiningCountdown <= 0) ? onDoRoll : undefined}
          className={`absolute inset-0 rounded-2xl bg-[#144628]/90 flex flex-col items-center justify-center p-3 text-center transition-all z-10 
            ${isHumanOwner && (joiningCountdown === null || joiningCountdown <= 0) ? 'cursor-pointer hover:bg-[#144628]/80 ring-2 ring-[#f2c14e] ring-inset animate-pulse' : 'pointer-events-none select-none'}`}
        >
          <div className="text-lg sm:text-xl font-black text-[#f2c14e] drop-shadow-md">
            {joiningCountdown !== null && joiningCountdown > 0
              ? `⏳ Waiting for all players… (${joiningCountdown}s)`
              : isHumanOwner
              ? '👉 Your Turn! Tap ROLL'
              : isRemoteHuman
              ? `⏳ ${playerName}'s Turn`
              : `🤖 ${playerName} is ready`}
          </div>
          <div className="text-xs text-white/95 mt-0.5 font-bold">
            {joiningCountdown !== null && joiningCountdown > 0
              ? 'Round 1 begins when countdown completes'
              : isHumanOwner
              ? `${playerName} · Tap to roll all 12 dice`
              : isRemoteHuman
              ? `Waiting for ${playerName} to roll…`
              : 'Computer will roll…'}
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
