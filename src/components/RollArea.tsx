import React from 'react';
import { Die } from '../types/game';
import { DieComponent } from './DieComponent';

interface RollAreaProps {
  dice: Die[];
  rollsUsed: number;
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
  isCPU,
  playerName,
  isRolling,
  onTapActiveDie,
  onDoRoll,
  spectatorState,
}) => {
  const activeDice = dice.filter(d => d.zone === 'active');

  // Count active selected by value
  const selByVal: Record<number, number> = {};
  activeDice.forEach(d => {
    if (d.selected) selByVal[d.value] = (selByVal[d.value] || 0) + 1;
  });

  return (
    <div className="relative w-full rounded-2xl bg-[#1d5930]/90 border border-[#2f9a4f] p-3 shadow-2xl min-h-[190px] sm:min-h-[220px] flex flex-col justify-center">
      {/* 12-Dice Grid */}
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5 max-w-md mx-auto w-full">
        {activeDice.map((die, idx) => {
          return (
            <DieComponent
              key={die.id}
              color={die.color}
              value={die.value}
              rolling={isRolling}
              selected={die.selected}
              delayMs={idx * 35}
              onClick={isCPU || rollsUsed === 0 ? undefined : () => onTapActiveDie(die.id)}
            />
          );
        })}
      </div>

      {/* Start Turn Overlay Hint */}
      {rollsUsed === 0 && (
        <div
          onClick={isCPU ? undefined : onDoRoll}
          className={`absolute inset-0 rounded-2xl bg-[#144628]/85 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-opacity z-10 
            ${!isCPU ? 'hover:bg-[#144628]/75' : ''}`}
        >
          <div className="text-xl sm:text-2xl font-black text-white drop-shadow-md">
            {isCPU ? `🤖 ${playerName} is ready` : 'Tap ROLL to start'}
          </div>
          <div className="text-xs sm:text-sm text-[#a3e9b8] mt-1 font-medium">
            {isCPU ? 'Computer will roll…' : `${playerName}'s turn · Roll all 12 dice`}
          </div>
        </div>
      )}

      {/* All Dice Saved Hint */}
      {rollsUsed > 0 && activeDice.length === 0 && (
        <div className="absolute inset-0 rounded-2xl bg-[#144628]/85 flex flex-col items-center justify-center p-4 text-center z-10">
          <div className="text-xl sm:text-2xl font-black text-[#f2c14e] drop-shadow-md">
            All dice saved! 🎉
          </div>
          <div className="text-xs sm:text-sm text-[#d8f3df] mt-1 font-medium">
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
              className="flex-1 py-2 px-3 bg-[#2f9a4f] hover:bg-[#268a48] text-white text-xs sm:text-sm font-bold rounded-lg shadow-md transition-transform active:scale-95"
            >
              Show Final Score
            </button>
            <button
              onClick={spectatorState.onLetPlayersFinish}
              className="flex-1 py-2 px-3 bg-[#efe3ad] hover:bg-[#e4d69b] text-[#2e2316] text-xs sm:text-sm font-bold rounded-lg shadow-md transition-transform active:scale-95"
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
