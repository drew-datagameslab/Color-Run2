import React, { useState } from 'react';
import { DiceColor, GameSettings, UserAccount } from '../types/game';
import { ColorRunLogo } from './Logo';
import { ArrowLeft, KeyRound, Loader2, Sparkles, X } from 'lucide-react';
import { MatchmakingScreen } from './MatchmakingScreen';
import { joinRoomByCode, GameRoom } from '../lib/matchmaking';
import { playSfx } from '../lib/audio';

interface PickGameScreenProps {
  mode: 'online' | 'cpu' | 'pass_and_play' | 'challenge' | 'challenge_friend';
  user: UserAccount;
  coins: number;
  equippedColors: [DiceColor, DiceColor];
  onStartGame: (settings: GameSettings) => void;
  onBack: () => void;
  onToast: (msg: string) => void;
  onAddCoins?: (amount: number) => void;
}

const CPU_NAMES = ['Ava', 'Pixel', 'Chip', 'Byte', 'Vector', 'Nova', 'Key', 'Mouse'];
const CPU_COLORS = ['#1f7fd6', '#e58a1f', '#8e44c9', '#0d4d23', '#d61f7a', '#00b894', '#0984e3', '#34495e'];

export const STANDARD_PAYOUTS: Record<number, number[]> = {
  2: [16],
  4: [20, 10],
  6: [30, 15, 5],
  8: [40, 20, 10],
};

export function calculatePayouts(
  playerCount: number,
  tier: 'standard' | 'double' | 'high_roller'
): number[] {
  const base = STANDARD_PAYOUTS[playerCount] || [16];
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
  onAddCoins,
}) => {
  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || equippedColors;

  // State for active online matchmaking lobby
  const [matchmakingConfig, setMatchmakingConfig] = useState<{
    playerCount: 2 | 4 | 6 | 8;
    buyIn: number;
    tier: 'standard' | 'double' | 'high_roller';
    initialRoom?: GameRoom;
  } | null>(null);

  // Modal state for direct room code joining
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [isJoiningWithCode, setIsJoiningWithCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const roomCounts: Array<2 | 4 | 6 | 8> = mode === 'online' ? [2, 4, 6] : [4, 6, 8];

  const getPlayerLabel = (count: number) => {
    return count === 6 ? '6 Players' : `${count} Player`;
  };

  const handlePick = (
    playerCount: 2 | 4 | 6 | 8,
    buyIn: number,
    tier: 'standard' | 'double' | 'high_roller'
  ) => {
    if (coins < buyIn) {
      if (onAddCoins) {
        onAddCoins(50);
        onToast('Claimed +50 Free Coins! Entering game…');
      } else {
        onToast(`Not enough coins — need 🪙 ${buyIn} to play`);
        return;
      }
    }

    // For "Play vs Others" (online mode), enter matchmaking room!
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

  // Direct joining via 4-digit room code
  const handleJoinByCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = enteredCode.trim();
    if (!clean) {
      setCodeError('Please enter a 4-digit code.');
      return;
    }

    setIsJoiningWithCode(true);
    setCodeError(null);

    try {
      const res = await joinRoomByCode(clean, user, userDiceColors);
      if ('error' in res) {
        setCodeError(res.error);
        setIsJoiningWithCode(false);
        return;
      }

      playSfx('add');
      setShowCodeModal(false);
      setMatchmakingConfig({
        playerCount: res.room.playerCount,
        buyIn: res.room.buyIn,
        tier: res.room.tier,
        initialRoom: res.room,
      });
    } catch (err: any) {
      setCodeError(err?.message || 'Could not connect to room.');
    } finally {
      setIsJoiningWithCode(false);
    }
  };

  // If in active online matchmaking, render the MatchmakingScreen
  if (matchmakingConfig) {
    return (
      <MatchmakingScreen
        playerCount={matchmakingConfig.playerCount}
        buyIn={matchmakingConfig.buyIn}
        tier={matchmakingConfig.tier}
        user={user}
        equippedColors={equippedColors}
        initialRoom={matchmakingConfig.initialRoom}
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
    <div className="w-full max-w-sm mx-auto flex flex-col items-center max-h-[calc(100dvh-65px)] overflow-y-auto custom-scrollbar p-2.5 sm:p-3 pb-8 select-none">
      {/* Color Run Logo */}
      <div className="flex flex-col items-center mt-1 mb-1">
        <ColorRunLogo size="sm" className="h-10 max-h-10 sm:h-12 sm:max-h-12" />

        {/* Top headline under logo */}
        <h1 className="text-white font-black text-lg sm:text-xl tracking-wider uppercase text-center mt-1.5 mb-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
          {mode === 'online'
            ? 'Online Game Rooms'
            : mode === 'cpu'
            ? 'Beat our Computer Overlords'
            : 'PICK YOUR GAME'}
        </h1>
        {mode === 'cpu' && (
          <p className="text-xs text-[#d9ba6d] font-bold text-center mb-1.5">
            Match your skills against virtual opponents
          </p>
        )}
      </div>

      {/* Online Friend Room Code Card */}
      {mode === 'online' && (
        <div className="w-full bg-[#faf4e6] border-2 border-[#d9c79e] rounded-2xl p-2 sm:p-2.5 mb-2 flex items-center justify-between gap-2 shadow-md">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[11px] font-black text-[#5e432d]">
              <KeyRound className="w-3.5 h-3.5 text-[#1c6a35]" />
              <span>Playing with a Friend?</span>
            </div>
            <div className="text-[10px] text-[#7d6045] leading-tight mt-0.5">
              Enter their 4-digit code to join their exact room
            </div>
          </div>
          <button
            onClick={() => {
              setCodeError(null);
              setEnteredCode('');
              setShowCodeModal(true);
              playSfx('add');
            }}
            className="px-3 py-1.5 bg-gradient-to-b from-[#1f7fd6] to-[#1664ab] hover:from-[#2a8eeb] hover:to-[#1a6ec0] text-white text-xs font-black rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
          >
            Enter Code
          </button>
        </div>
      )}

      {/* Cards Container with styled custom scrollbar */}
      <div className="w-full flex flex-col gap-2.5">
        {/* Tier 1: STANDARD GAME - 🪙 10 Coins Buy-In */}
        <div className="w-full bg-[#fbf7ee] rounded-2xl border-2 border-[#d9c79e] p-3 sm:p-3.5 shadow-lg">
          <div className="font-black text-xs text-[#5e432d] uppercase tracking-wider mb-2">
            STANDARD GAME - 🪙 10 Coins Buy-In
          </div>
          <div className="grid grid-cols-3 gap-2">
            {roomCounts.map(count => (
              <button
                key={`standard-${count}`}
                onClick={() => handlePick(count, 10, 'standard')}
                className="py-1 px-2 sm:py-1.5 sm:px-2.5 bg-gradient-to-b from-[#2f9a4f] to-[#1c6a35] hover:from-[#35ad59] hover:to-[#227b3e] text-white rounded-xl shadow-md border-b-2.5 border-[#155229] active:translate-y-0.5 active:border-b-1 transition-all flex flex-col items-center justify-center cursor-pointer min-h-[34px] sm:min-h-[38px]"
              >
                <span className="font-black text-xs sm:text-sm text-white tracking-tight">
                  {getPlayerLabel(count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tier 2: DOUBLE ACTION - 🪙 20 Coins Buy-In */}
        <div className="w-full bg-[#fbf7ee] rounded-2xl border-2 border-[#d9c79e] p-3 sm:p-3.5 shadow-lg">
          <div className="font-black text-xs text-[#5e432d] uppercase tracking-wider mb-0.5">
            DOUBLE ACTION - 🪙 20 Coins Buy-In
          </div>
          <div className="text-[11px] sm:text-xs text-[#5e432d] font-semibold mb-2">
            Double the buy-in, double the payouts.
          </div>
          <div className="grid grid-cols-3 gap-2">
            {roomCounts.map(count => (
              <button
                key={`double-${count}`}
                onClick={() => handlePick(count, 20, 'double')}
                className="py-1 px-2 sm:py-1.5 sm:px-2.5 bg-gradient-to-b from-[#2f9a4f] to-[#1c6a35] hover:from-[#35ad59] hover:to-[#227b3e] text-white rounded-xl shadow-md border-b-2.5 border-[#155229] active:translate-y-0.5 active:border-b-1 transition-all flex flex-col items-center justify-center cursor-pointer min-h-[34px] sm:min-h-[38px]"
              >
                <span className="font-black text-xs sm:text-sm text-white tracking-tight">
                  {getPlayerLabel(count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tier 3: HIGH ROLLER - 🪙 50 Coins Buy-In */}
        <div className="w-full bg-[#fbf7ee] rounded-2xl border-2 border-[#d9c79e] p-3 sm:p-3.5 shadow-lg">
          <div className="font-black text-xs text-[#5e432d] uppercase tracking-wider mb-0.5">
            HIGH ROLLER - 🪙 50 Coins Buy-In
          </div>
          <div className="text-[11px] sm:text-xs text-[#5e432d] font-semibold mb-2">
            5x the buy-in, 5x the payouts.
          </div>
          <div className="grid grid-cols-3 gap-2">
            {roomCounts.map(count => (
              <button
                key={`highroller-${count}`}
                onClick={() => handlePick(count, 50, 'high_roller')}
                className="py-1 px-2 sm:py-1.5 sm:px-2.5 bg-gradient-to-b from-[#2f9a4f] to-[#1c6a35] hover:from-[#35ad59] hover:to-[#227b3e] text-white rounded-xl shadow-md border-b-2.5 border-[#155229] active:translate-y-0.5 active:border-b-1 transition-all flex flex-col items-center justify-center cursor-pointer min-h-[34px] sm:min-h-[38px]"
              >
                <span className="font-black text-xs sm:text-sm text-white tracking-tight">
                  {getPlayerLabel(count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Low balance bonus helper */}
        {coins < 10 && onAddCoins && (
          <div className="w-full bg-amber-500/20 border border-amber-500/40 rounded-xl p-2.5 flex items-center justify-between text-white text-xs">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>Low on coins?</span>
            </span>
            <button
              onClick={() => {
                onAddCoins(100);
                onToast('Claimed +100 Free Coins!');
              }}
              className="px-2.5 py-1 bg-yellow-500 hover:bg-yellow-400 text-[#301c05] font-black rounded-lg shadow-xs cursor-pointer"
            >
              +100 Coins
            </button>
          </div>
        )}

        {/* Back Button to Mode Select */}
        <button
          onClick={onBack}
          className="mt-2 mb-2 mx-auto flex items-center justify-center gap-1 text-xs font-bold text-white/90 hover:text-white bg-black/35 hover:bg-black/55 px-4 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Mode Select</span>
        </button>
      </div>

      {/* Direct Room Code Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-xs bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col items-center relative">
            <button
              onClick={() => setShowCodeModal(false)}
              className="absolute top-3 right-3 text-[#735c46] hover:text-[#4a3622] p-1 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-10 h-10 rounded-full bg-[#1f7fd6]/15 flex items-center justify-center text-[#1f7fd6] mb-2">
              <KeyRound className="w-5 h-5" />
            </div>

            <h3 className="text-base font-black text-[#4a3622] text-center">
              Join with Room Code
            </h3>
            <p className="text-xs text-[#735c46] text-center mt-1 mb-3">
              Enter the 4-digit code shown on your friend's screen
            </p>

            <form onSubmit={handleJoinByCode} className="w-full flex flex-col gap-2.5">
              <input
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={4}
                value={enteredCode}
                onChange={e => {
                  setEnteredCode(e.target.value.replace(/\D/g, ''));
                  setCodeError(null);
                }}
                placeholder="4-Digit Code"
                className="w-full text-center font-mono text-2xl font-black tracking-widest py-2 px-3 bg-white border-2 border-[#c9b877] rounded-xl text-[#2e2316] placeholder:text-[#c9b877]/60 focus:outline-hidden focus:border-[#1f7fd6]"
                autoFocus
              />

              {codeError && (
                <div className="text-[11px] text-red-600 font-bold text-center bg-red-50 p-1.5 rounded-lg border border-red-200">
                  {codeError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="py-2 px-3 bg-gray-200 hover:bg-gray-300 text-[#4a3622] text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enteredCode.length < 4 || isJoiningWithCode}
                  className="py-2 px-3 bg-gradient-to-b from-[#1f7fd6] to-[#1664ab] hover:from-[#2a8eeb] hover:to-[#1a6ec0] disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isJoiningWithCode ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <span>Connect</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
