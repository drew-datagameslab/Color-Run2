import React, { useState, useEffect, useRef } from 'react';
import { DiceColor, GameSettings, UserAccount } from '../types/game';
import { ColorRunLogo } from './Logo';
import { playSfx } from '../lib/audio';
import { Users, Loader2, ArrowLeft, Bot, Sparkles, CheckCircle2 } from 'lucide-react';
import { calculatePayouts } from './PickGameScreen';

interface MatchmakingScreenProps {
  playerCount: 2 | 4 | 6 | 8;
  buyIn: number;
  tier: 'standard' | 'double' | 'high_roller';
  user: UserAccount;
  equippedColors: [DiceColor, DiceColor];
  onMatchReady: (settings: GameSettings) => void;
  onCancel: () => void;
}

const BOT_NAMES = ['Ava', 'Pixel', 'Chip', 'Byte', 'Vector', 'Nova', 'Key', 'Mouse'];
const BOT_COLORS = ['#1f7fd6', '#e58a1f', '#8e44c9', '#0d4d23', '#d61f7a', '#00b894', '#0984e3', '#34495e'];

const ONLINE_OPPONENTS_POOL = [
  { name: 'Ava', color: '#1f7fd6' },
  { name: 'Pixel', color: '#8e44c9' },
  { name: 'Chip', color: '#e58a1f' },
  { name: 'Byte', color: '#0d4d23' },
  { name: 'Vector', color: '#d61f7a' },
  { name: 'Nova', color: '#0984e3' },
  { name: 'Key', color: '#00b894' },
  { name: 'Mouse', color: '#34495e' },
];

export const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({
  playerCount,
  buyIn,
  tier,
  user,
  equippedColors,
  onMatchReady,
  onCancel,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [statusText, setStatusText] = useState('Searching for online players…');
  const [isStarting, setIsStarting] = useState(false);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);

  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || equippedColors;

  // Initialize slots with the user in slot 0
  const [slots, setSlots] = useState<
    Array<{
      name: string;
      type: 'human' | 'cpu';
      isOnlinePlayer?: boolean;
      color: string;
      image?: string;
      diceColors?: [DiceColor, DiceColor];
      isReady: boolean;
    } | null>
  >(() => {
    const arr = new Array(playerCount).fill(null);
    arr[0] = {
      name: user.name,
      type: 'human',
      isOnlinePlayer: false,
      color: user.avatar.color,
      image: user.avatar.image,
      diceColors: userDiceColors,
      isReady: true,
    };
    return arr;
  });

  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  // Simulate online players joining during the 15-second window
  useEffect(() => {
    // Determine how many online players will join during the 15s (1 to playerCount - 2, so usually some bots will fill unless crowded)
    const maxOnlineToJoin = Math.min(
      playerCount - 1,
      Math.floor(Math.random() * (playerCount - 1)) + 1
    );

    // Schedule join times
    const joinTimeouts: NodeJS.Timeout[] = [];
    const pool = [...ONLINE_OPPONENTS_POOL].sort(() => 0.5 - Math.random());

    for (let i = 0; i < maxOnlineToJoin; i++) {
      // Join between second 12 and second 3
      const delayMs = (2 + Math.random() * 9) * 1000;
      const targetSlot = i + 1;
      const opponent = pool[i % pool.length];

      const t = setTimeout(() => {
        setSlots(prev => {
          if (prev[targetSlot]) return prev;
          const next = [...prev];
          next[targetSlot] = {
            name: opponent.name,
            type: 'cpu',
            isOnlinePlayer: false,
            color: opponent.color,
            diceColors: ['blue', 'red'],
            isReady: true,
          };
          playSfx('add');
          return next;
        });
      }, delayMs);

      joinTimeouts.push(t);
    }

    return () => {
      joinTimeouts.forEach(t => clearTimeout(t));
    };
  }, [playerCount]);

  // Main 15s timer countdown
  useEffect(() => {
    if (secondsLeft <= 0) {
      // 15 seconds elapsed! Fill remaining slots with computer bots!
      setStatusText('15s elapsed. Filling remaining slots with computer players…');

      setTimeout(() => {
        setSlots(prev => {
          const next = [...prev];
          let botIdx = 0;
          for (let i = 1; i < playerCount; i++) {
            if (!next[i]) {
              const bName = BOT_NAMES[botIdx % BOT_NAMES.length];
              const bColor = BOT_COLORS[botIdx % BOT_COLORS.length];
              next[i] = {
                name: bName,
                type: 'cpu',
                isOnlinePlayer: false,
                color: bColor,
                diceColors: ['blue', 'red'],
                isReady: true,
              };
              botIdx++;
            }
          }
          return next;
        });

        // Trigger match launch sequence
        setIsStarting(true);
        setStartCountdown(3);
      }, 700);

      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft(s => s - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, playerCount]);

  // Starting 3-2-1 countdown
  useEffect(() => {
    if (startCountdown === null) return;

    if (startCountdown <= 0) {
      // Launch game
      const mult = tier === 'high_roller' ? 5 : tier === 'double' ? 2 : 1;
      const payouts = calculatePayouts(playerCount, tier);

      const finalSlots: GameSettings['slots'] = slotsRef.current.map((s, idx) => {
        if (!s) {
          return {
            name: `CPU ${idx}`,
            type: 'cpu',
            color: '#34495e',
            diceColors: ['blue', 'red'],
          };
        }
        return {
          name: s.name,
          type: s.type,
          isOnlinePlayer: s.isOnlinePlayer,
          color: s.color,
          image: s.image,
          diceColors: s.diceColors || ['blue', 'red'],
        };
      });

      playSfx('fanfare');
      onMatchReady({
        playersCount: playerCount,
        mode: 'online',
        threshold: 250,
        buyIn,
        tier,
        payoutMultiplier: mult,
        payouts,
        adPlayedDuringMatchmaking: true,
        colorA: userDiceColors[0],
        colorB: userDiceColors[1],
        slots: finalSlots,
      });
      return;
    }

    playSfx('add');
    const t = setTimeout(() => {
      setStartCountdown(c => (c !== null ? c - 1 : null));
    }, 1000);

    return () => clearTimeout(t);
  }, [startCountdown, buyIn, onMatchReady, playerCount, tier, userDiceColors]);

  const filledCount = slots.filter(Boolean).length;
  const progressPercent = Math.max(0, (secondsLeft / 15) * 100);

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center justify-between min-h-[85vh] p-3 pb-8 select-none animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col items-center w-full mt-2">
        <ColorRunLogo size="md" />

        <div className="mt-2 text-center">
          <div className="text-[11px] font-black uppercase tracking-widest text-[#d9ba6d]">
            ONLINE MATCHMAKING
          </div>
          <h2 className="text-xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {playerCount} Players · 🪙 {buyIn} Buy-In
          </h2>
        </div>
      </div>

      {/* Center Radar / Timer Widget */}
      <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-3xl p-5 shadow-2xl flex flex-col items-center my-3">
        {/* Countdown Ring / Ready Banner */}
        <div className="relative mb-3 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full border-4 border-[#ebdcb9] flex items-center justify-center relative shadow-inner">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="36"
                cy="36"
                r="32"
                className="text-[#2f9a4f] stroke-current"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray="201"
                strokeDashoffset={201 - (201 * (15 - secondsLeft)) / 15}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>

            <div className="flex flex-col items-center justify-center">
              {isStarting ? (
                <span className="text-2xl font-black text-[#e58a1f] animate-ping">
                  {startCountdown}
                </span>
              ) : (
                <>
                  <span className="text-xl font-mono font-black text-[#1c6a35]">
                    {secondsLeft}s
                  </span>
                  <span className="text-[9px] font-bold text-[#8c745e] uppercase">Timer</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status Text */}
        <p className="text-xs font-black text-[#4a3622] text-center mb-1 flex items-center justify-center gap-1.5">
          {!isStarting && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2f9a4f]" />}
          <span>{isStarting ? `Room Full! Starting in ${startCountdown}s…` : statusText}</span>
        </p>
        <p className="text-[11px] text-[#735c46] text-center mb-4">
          Filled: {filledCount} of {playerCount} slots
        </p>

        {/* 10-second Ad Banner during the 15s Matchmaking Lobby for non-ad-free players */}
        {!user.isAdFree && (
          <div className="w-full mb-3 bg-gradient-to-r from-[#2b170a] to-[#452712] border-2 border-[#f2c14e]/70 rounded-2xl p-2.5 text-[#faf4e6] shadow-md flex items-center justify-between gap-2.5 animate-fade-in">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#e58a1f] to-[#b3630a] flex items-center justify-center shrink-0 text-lg shadow-xs">
              🎲
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] uppercase tracking-wider font-black bg-[#f2c14e] text-[#2b170a] px-1 py-0.2 rounded font-mono">
                  AD
                </span>
                <span className="text-[11px] font-black text-[#faf4e6] truncate">
                  Color Run: Home Edition
                </span>
              </div>
              <p className="text-[10px] text-[#d8c8a7] truncate leading-tight">
                12 custom carved dice &amp; tabletop playmat
              </p>
            </div>
            <div className="text-right shrink-0">
              {secondsLeft > 5 ? (
                <span className="text-[10px] font-mono font-bold text-[#f2c14e] bg-black/40 px-2 py-0.5 rounded-full border border-[#f2c14e]/30">
                  Ad: {secondsLeft - 5}s
                </span>
              ) : (
                <span className="text-[10px] font-bold text-[#2f9a4f] bg-black/40 px-2 py-0.5 rounded-full border border-[#2f9a4f]/50">
                  ✓ Ad Done
                </span>
              )}
            </div>
          </div>
        )}

        {/* Slots Grid */}
        <div className="w-full grid grid-cols-2 gap-2">
          {slots.map((slot, idx) => {
            return (
              <div
                key={idx}
                className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
                  slot
                    ? 'bg-white border-[#2f9a4f]/50 shadow-xs scale-[1.01]'
                    : 'bg-[#f0e7d5]/60 border-dashed border-[#d4c39f]'
                }`}
              >
                {slot ? (
                  <>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shadow-xs shrink-0"
                      style={{ backgroundColor: slot.color }}
                    >
                      {slot.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-[#2e2316] truncate leading-tight">
                        {slot.name}
                      </div>
                      <div className="text-[10px] flex items-center gap-1 font-bold">
                        {slot.type === 'cpu' ? (
                          <span className="text-amber-700">🤖 CPU Bot</span>
                        ) : slot.isOnlinePlayer ? (
                          <span className="text-green-700">🟢 Live Player</span>
                        ) : (
                          <span className="text-[#1c6a35]">⭐ You (Host)</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 w-full py-1">
                    <div className="w-8 h-8 rounded-full bg-[#dfd0b7]/70 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-[#8a7259] animate-pulse" />
                    </div>
                    <div className="text-[11px] font-bold text-[#8a7259] animate-pulse">
                      Searching…
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cancel Matchmaking Button */}
      {!isStarting && (
        <button
          onClick={onCancel}
          className="flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-black/40 hover:bg-black/60 px-4 py-2 rounded-xl backdrop-blur-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Cancel &amp; Refund Buy-In</span>
        </button>
      )}
    </div>
  );
};
