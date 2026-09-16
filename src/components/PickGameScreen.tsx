import React, { useState } from 'react';
import { DiceColor, GameSettings, UserAccount } from '../types/game';
import { ColorRunLogo } from './Logo';
import { ArrowLeft } from 'lucide-react';
import { MatchmakingScreen } from './MatchmakingScreen';

interface PickGameScreenProps {
  mode: 'online' | 'cpu' | 'pass_and_play' | 'challenge' | 'challenge_friend';
  user: UserAccount;
  coins: number;
  equippedColors: [DiceColor, DiceColor];
  onStartGame: (settings: GameSettings) => void;
  onBack: () => void;
  onToast: (msg: string) => void;
}

const CPU_NAMES = ['Pixel', 'Byte', 'Spark', 'Volt', 'Chip', 'Dash', 'Echo', 'Nova', 'Blaze', 'Quantum'];
const CPU_COLORS = ['#1f7fd6', '#e58a1f', '#8e44c9', '#2f9a4f', '#d61f7a', '#00b894', '#0984e3'];

export const STANDARD_PAYOUTS: Record<number, number[]> = {
  4: [20, 10],
  6: [30, 15, 5],
  8: [40, 20, 10],
};

export function calculatePayouts(
  playerCount: number,
  tier: 'standard' | 'double' | 'high_roller'
): number[] {
  const base = STANDARD_PAYOUTS[playerCount] || [20, 10];
  const mult = tier === 'high_roller' ? 5 : tier === 'double' ? 2 : 1;
  return base.map(p => p * mult);
}

export const PickGameScreen: React.FC<PickGameScreenProps> = ({
  mode,
  user,
  coins,
  equippedColors,
  onStartGame,
  onBack,
  onToast,
}) => {
  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || equippedColors;

  // State for the 15-second online matchmaking lobby
  const [matchmakingConfig, setMatchmakingConfig] = useState<{
    playerCount: 4 | 6 | 8;
    buyIn: number;
    tier: 'standard' | 'double' | 'high_roller';
  } | null>(null);

  const handlePick = (
    playerCount: 4 | 6 | 8,
    buyIn: number,
    tier: 'standard' | 'double' | 'high_roller'
  ) => {
    if (coins < buyIn) {
      onToast(`Not enough coins — need 🪙 ${buyIn} to play`);
      return;
    }

    // For "Play vs Others" (online mode), enter the 15-second matchmaking room!
    if (mode === 'online') {
      setMatchmakingConfig({ playerCount, buyIn, tier });
      return;
    }

    // Default vs CPU mode
    const slots: GameSettings['slots'] = [];

    // Player 1 (Human User)
    slots.push({
      name: user.name,
      type: 'human',
      color: user.avatar.color,
      image: user.avatar.image,
      diceColors: userDiceColors,
    });

    // Computer players always use red and blue dice
    for (let i = 1; i < playerCount; i++) {
      const botName = CPU_NAMES[i - 1] || `CPU ${i}`;
      slots.push({
        name: botName,
        type: 'cpu',
        color: CPU_COLORS[(i - 1) % CPU_COLORS.length],
        diceColors: ['blue', 'red'],
      });
    }

    const mult = tier === 'high_roller' ? 5 : tier === 'double' ? 2 : 1;
    const payouts = calculatePayouts(playerCount, tier);

    onStartGame({
      playersCount: playerCount,
      mode: 'cpu',
      threshold: 250,
      buyIn,
      tier,
      payoutMultiplier: mult,
      payouts,
      colorA: userDiceColors[0],
      colorB: userDiceColors[1],
      slots,
    });
  };

  // If in active online matchmaking, render the 15s MatchmakingScreen
  if (matchmakingConfig) {
    return (
      <MatchmakingScreen
        playerCount={matchmakingConfig.playerCount}
        buyIn={matchmakingConfig.buyIn}
        tier={matchmakingConfig.tier}
        user={user}
        equippedColors={equippedColors}
        onMatchReady={settings => {
          setMatchmakingConfig(null);
          onStartGame(settings);
        }}
        onCancel={() => {
          setMatchmakingConfig(null);
          onToast('Matchmaking cancelled.');
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center min-h-[85vh] p-3 pb-8 select-none">
      {/* Color Run Logo */}
      <div className="flex flex-col items-center mt-2">
        <ColorRunLogo size="md" />

        {/* 6 Suit Badges: 3 Blue Spades, 3 Red Stars */}
        <div className="flex items-center justify-center gap-1.5 mt-2 mb-2">
          {[0, 1, 2].map(i => (
            <div
              key={`spade-${i}`}
              className="w-6 h-6 rounded-md bg-[#1f7fd6] text-white flex items-center justify-center text-sm font-black shadow-xs border border-white/30"
            >
              ♠
            </div>
          ))}
          {[0, 1, 2].map(i => (
            <div
              key={`star-${i}`}
              className="w-6 h-6 rounded-md bg-[#e5352f] text-white flex items-center justify-center text-xs font-black shadow-xs border border-white/30"
            >
              ★
            </div>
          ))}
        </div>

        {/* PICK YOUR GAME in White Font */}
        <h1 className="text-white font-black text-xl tracking-wider uppercase text-center mt-1 mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
          PICK YOUR GAME
        </h1>
        {mode === 'online' && (
          <p className="text-xs text-[#d9ba6d] font-bold text-center mb-3">
            15s Matchmaking Lobby · Live Online Players
          </p>
        )}
      </div>

      {/* Cards Container */}
      <div className="w-full flex flex-col gap-3.5">
        {/* Tier 1: STANDARD GAME- 10 Coins */}
        <div className="w-full bg-[#fbf7ee] rounded-2xl border-2 border-[#d9c79e] p-4 shadow-lg">
          <div className="font-black text-xs text-[#5e432d] uppercase tracking-wider mb-2.5">
            STANDARD GAME- 10 Coins
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {([4, 6, 8] as const).map(count => (
              <button
                key={`standard-${count}`}
                onClick={() => handlePick(count, 10, 'standard')}
                className="p-3 bg-gradient-to-b from-[#2f9a4f] to-[#1c6a35] hover:from-[#35ad59] hover:to-[#227b3e] text-white rounded-xl shadow-md border-b-3 border-[#155229] active:translate-y-0.5 active:border-b-1 transition-all flex flex-col items-center justify-center cursor-pointer"
              >
                <span className="font-black text-xs sm:text-sm text-white tracking-tight">
                  {count} Player
                </span>
                <span className="text-[11px] font-bold text-white/95 flex items-center justify-center gap-1 mt-1 font-mono">
                  <span>🪙</span>
                  <span>10</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tier 2: DOUBLE ACTION - 20 Coins */}
        <div className="w-full bg-[#fbf7ee] rounded-2xl border-2 border-[#d9c79e] p-4 shadow-lg">
          <div className="font-black text-xs text-[#5e432d] uppercase tracking-wider mb-0.5">
            DOUBLE ACTION - 20 Coins
          </div>
          <div className="text-xs text-[#5e432d] font-semibold mb-2.5">
            Double the buy-in, double the payouts.
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {([4, 6, 8] as const).map(count => (
              <button
                key={`double-${count}`}
                onClick={() => handlePick(count, 20, 'double')}
                className="p-3 bg-gradient-to-b from-[#2f9a4f] to-[#1c6a35] hover:from-[#35ad59] hover:to-[#227b3e] text-white rounded-xl shadow-md border-b-3 border-[#155229] active:translate-y-0.5 active:border-b-1 transition-all flex flex-col items-center justify-center cursor-pointer"
              >
                <span className="font-black text-xs sm:text-sm text-white tracking-tight">
                  {count} Player
                </span>
                <span className="text-[11px] font-bold text-white/95 flex items-center justify-center gap-1 mt-1 font-mono">
                  <span>🪙</span>
                  <span>20</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tier 3: HIGH ROLLER - 50 Coins */}
        <div className="w-full bg-[#fbf7ee] rounded-2xl border-2 border-[#d9c79e] p-4 shadow-lg">
          <div className="font-black text-xs text-[#5e432d] uppercase tracking-wider mb-0.5">
            HIGH ROLLER - 50 Coins
          </div>
          <div className="text-xs text-[#5e432d] font-semibold mb-2.5">
            5x the buy-in, 5x the payouts.
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {([4, 6, 8] as const).map(count => (
              <button
                key={`highroller-${count}`}
                onClick={() => handlePick(count, 50, 'high_roller')}
                className="p-3 bg-gradient-to-b from-[#2f9a4f] to-[#1c6a35] hover:from-[#35ad59] hover:to-[#227b3e] text-white rounded-xl shadow-md border-b-3 border-[#155229] active:translate-y-0.5 active:border-b-1 transition-all flex flex-col items-center justify-center cursor-pointer"
              >
                <span className="font-black text-xs sm:text-sm text-white tracking-tight">
                  {count} Player
                </span>
                <span className="text-[11px] font-bold text-white/95 flex items-center justify-center gap-1 mt-1 font-mono">
                  <span>🪙</span>
                  <span>50</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Back Button to Mode Select */}
        <button
          onClick={onBack}
          className="mt-3 mx-auto flex items-center justify-center gap-1 text-xs font-bold text-white/90 hover:text-white bg-black/35 hover:bg-black/55 px-4 py-2 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Mode Select</span>
        </button>
      </div>
    </div>
  );
};
