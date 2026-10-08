import React from 'react';
import { Swords, Flame } from 'lucide-react';

interface BattleToSurviveGraphicProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  subtitle?: string;
}

export const BattleToSurviveGraphic: React.FC<BattleToSurviveGraphicProps> = ({
  size = 'md',
  className = '',
  subtitle,
}) => {
  const sizeConfig = {
    sm: {
      container: 'py-1 px-3',
      title: 'text-sm sm:text-base tracking-widest',
      subtext: 'text-[9px] sm:text-[10px]',
      swordIcon: 'w-4 h-4',
      flameIcon: 'w-3 h-3',
    },
    md: {
      container: 'py-1.5 px-4',
      title: 'text-base sm:text-lg tracking-widest',
      subtext: 'text-[10px] sm:text-xs',
      swordIcon: 'w-5 h-5',
      flameIcon: 'w-3.5 h-3.5',
    },
    lg: {
      container: 'py-2.5 px-6',
      title: 'text-xl sm:text-2xl tracking-widest',
      subtext: 'text-xs sm:text-sm',
      swordIcon: 'w-6 h-6',
      flameIcon: 'w-4 h-4',
    },
  }[size];

  return (
    <div
      className={`inline-flex flex-col items-center justify-center select-none relative ${className}`}
      role="banner"
      aria-label="Battle to Survive"
    >
      {/* Outer Glow & Background Plaque */}
      <div
        className={`relative flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#400505] via-[#240303] to-[#120101] border-2 border-[#ff3b30]/80 shadow-[0_0_15px_rgba(255,59,48,0.5),inset_0_1px_1px_rgba(255,215,0,0.4)] ${sizeConfig.container}`}
      >
        {/* Subtle decorative inner corner spikes / notches */}
        <div className="absolute -top-1 left-2 w-2 h-1 bg-[#ffd700] rounded-xs shadow-xs" />
        <div className="absolute -top-1 right-2 w-2 h-1 bg-[#ffd700] rounded-xs shadow-xs" />
        <div className="absolute -bottom-1 left-2 w-2 h-1 bg-[#ffd700] rounded-xs shadow-xs" />
        <div className="absolute -bottom-1 right-2 w-2 h-1 bg-[#ffd700] rounded-xs shadow-xs" />

        {/* Left Icon */}
        <div className="flex items-center text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]">
          <Swords className={`${sizeConfig.swordIcon} animate-pulse`} />
        </div>

        {/* Center Title with gradient styling */}
        <div className="flex flex-col items-center leading-tight">
          <span
            className={`font-black uppercase text-transparent bg-clip-text bg-gradient-to-b from-[#fff2a8] via-[#f59e0b] to-[#dc2626] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${sizeConfig.title}`}
            style={{
              textShadow: '0 0 10px rgba(239,68,68,0.5)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Battle to Survive
          </span>

          {subtitle && (
            <span
              className={`font-bold uppercase tracking-wider text-amber-200/90 ${sizeConfig.subtext}`}
            >
              {subtitle}
            </span>
          )}
        </div>

        {/* Right Icon */}
        <div className="flex items-center text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]">
          <Flame className={`${sizeConfig.flameIcon} text-orange-500 animate-bounce`} />
        </div>
      </div>
    </div>
  );
};
