import React from 'react';

interface BattleToSurviveGraphicProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export const BattleToSurviveGraphic: React.FC<BattleToSurviveGraphicProps> = ({
  className = '',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'max-w-[200px] h-auto',
    md: 'max-w-[320px] h-auto',
    lg: 'max-w-[460px] h-auto',
    hero: 'max-w-[560px] w-full h-auto',
  }[size];

  return (
    <div className={`relative flex items-center justify-center select-none ${sizeClasses} ${className}`}>
      <svg
        viewBox="0 0 500 250"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
      >
        <defs>
          <filter id="bts-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.7" />
          </filter>
          <linearGradient id="red-gradient" x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor="#ff4040" />
            <stop offset="100%" stopColor="#d11a1a" />
          </linearGradient>
          <linearGradient id="blue-gradient" x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor="#2575fc" />
            <stop offset="100%" stopColor="#104fb5" />
          </linearGradient>
        </defs>

        {/* Outer White Card/Backing Glow */}
        <ellipse cx="250" cy="125" rx="220" ry="110" fill="white" opacity="0.96" />

        {/* "Battle" - Styled Brush Calligraphy in Red */}
        <g filter="url(#bts-glow)">
          <text
            x="250"
            y="95"
            textAnchor="middle"
            fontFamily="'Brush Script MT', 'Dancing Script', 'Caveat', 'Segoe Script', cursive, sans-serif"
            fontSize="98"
            fontWeight="900"
            fontStyle="italic"
            fill="url(#red-gradient)"
            stroke="#b31212"
            strokeWidth="2.5"
            letterSpacing="-1px"
          >
            Battle
          </text>
        </g>

        {/* "to" - Compact Slanted Black */}
        <text
          x="250"
          y="132"
          textAnchor="middle"
          fontFamily="'Brush Script MT', 'Dancing Script', 'Caveat', cursive, sans-serif"
          fontSize="36"
          fontWeight="900"
          fontStyle="italic"
          fill="#1c1917"
          letterSpacing="1px"
        >
          to
        </text>

        {/* "Survive" - Styled Brush Calligraphy in Royal Blue */}
        <g filter="url(#bts-glow)">
          <text
            x="250"
            y="215"
            textAnchor="middle"
            fontFamily="'Brush Script MT', 'Dancing Script', 'Caveat', 'Segoe Script', cursive, sans-serif"
            fontSize="106"
            fontWeight="900"
            fontStyle="italic"
            fill="url(#blue-gradient)"
            stroke="#0d3e8a"
            strokeWidth="2.5"
            letterSpacing="-1px"
          >
            Survive
          </text>
        </g>
      </svg>
    </div>
  );
};
