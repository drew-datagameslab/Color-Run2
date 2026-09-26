import React, { useState } from 'react';
import { DiceColor } from '../types/game';

export interface DieProps {
  color: DiceColor;
  value: number;
  rolling?: boolean;
  selected?: boolean;
  pending?: boolean;
  forcePips?: boolean;
  onClick?: () => void;
  className?: string;
  delayMs?: number;
}

const COLOR_THEMES: Record<
  DiceColor,
  { bgTop: string; bgBottom: string; stroke: string }
> = {
  blue: { bgTop: '#2b86e2', bgBottom: '#135fae', stroke: 'rgba(255, 255, 255, 0.45)' },
  red: { bgTop: '#f0433b', bgBottom: '#b71c1c', stroke: 'rgba(255, 255, 255, 0.45)' },
  green: { bgTop: '#34c759', bgBottom: '#1b7d34', stroke: 'rgba(255, 255, 255, 0.45)' },
  purple: { bgTop: '#a855f7', bgBottom: '#6b21a8', stroke: 'rgba(255, 255, 255, 0.45)' },
  black: { bgTop: '#404040', bgBottom: '#171717', stroke: 'rgba(255, 255, 255, 0.35)' },
  lblue: { bgTop: '#60a5fa', bgBottom: '#1d4ed8', stroke: 'rgba(255, 255, 255, 0.45)' },
  orange: { bgTop: '#fb923c', bgBottom: '#c2410c', stroke: 'rgba(255, 255, 255, 0.45)' },
  pink: { bgTop: '#f472b6', bgBottom: '#be185d', stroke: 'rgba(255, 255, 255, 0.45)' },
};

// 1-6 pip center positions in 100x100 viewBox
const PIP_POSITIONS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

export const PippedDieFace: React.FC<{ color: DiceColor; value: number }> = ({ color, value }) => {
  const theme = COLOR_THEMES[color] || COLOR_THEMES.blue;
  const pips = PIP_POSITIONS[value] || [[50, 50]];

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full block pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`grad-die-${color}`} x1="0" y1="0" x2="0" y2="100%">
          <stop offset="0%" stopColor={theme.bgTop} />
          <stop offset="100%" stopColor={theme.bgBottom} />
        </linearGradient>
        <radialGradient id="pip-highlight" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f3f4f6" />
          <stop offset="100%" stopColor="#d1d5db" />
        </radialGradient>
        <filter id="pip-inset-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="0.8" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Die Body */}
      <rect
        x="3"
        y="3"
        width="94"
        height="94"
        rx="20"
        ry="20"
        fill={`url(#grad-die-${color})`}
        stroke={theme.stroke}
        strokeWidth="2.5"
      />

      {/* Glossy top bevel reflection */}
      <path
        d="M 12 14 C 12 8, 20 6, 28 6 L 72 6 C 80 6, 88 8, 88 14 C 88 18, 68 22, 50 22 C 32 22, 12 18, 12 14 Z"
        fill="rgba(255, 255, 255, 0.22)"
      />

      {/* Pips */}
      {pips.map(([cx, cy], idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r={value === 1 ? 11 : 8.8}
          fill="url(#pip-highlight)"
          filter="url(#pip-inset-shadow)"
        />
      ))}
    </svg>
  );
};

export const DieComponent: React.FC<DieProps> = ({
  color,
  value,
  rolling = false,
  selected = false,
  pending = false,
  forcePips = false,
  onClick,
  className = '',
  delayMs = 0,
}) => {
  const [imgError, setImgError] = useState(false);

  const imgSrc = `/assets/dice/${color}/${value}.png`;
  // Real dice geometry: opposite faces sum to 7 (1 opposite 6, 2 opposite 5, 3 opposite 4)
  const oppositeValue = Math.max(1, Math.min(6, 7 - value));
  const oppositeImgSrc = `/assets/dice/${color}/${oppositeValue}.png`;

  const isWarm = color === 'red' || color === 'orange' || color === 'pink';
  const bounceClass = isWarm ? 'animate-tumble-bounce-red' : 'animate-tumble-bounce-blue';
  const rotateClass = isWarm ? 'animate-tumble-rotate-red' : 'animate-tumble-rotate-blue';

  const renderFace = (faceVal: number, src: string) => {
    if (forcePips) {
      return <PippedDieFace color={color} value={faceVal} />;
    }
    if (!imgError) {
      return (
        <img
          src={src}
          alt={`${color} ${faceVal}`}
          onError={() => setImgError(true)}
          draggable={false}
          className="w-full h-full object-contain block pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
        />
      );
    }
    return <PippedDieFace color={color} value={faceVal} />;
  };

  if (rolling) {
    return (
      <div
        className={`relative aspect-square flex items-center justify-center select-none ${className}`}
        style={{ perspective: '450px' }}
        title={`${color} die rolling...`}
      >
        {/* Dynamic Tabletop Contact Shadow */}
        <div
          style={{ animationDelay: delayMs > 0 ? `${delayMs}ms` : undefined }}
          className="absolute -bottom-1 w-[82%] h-2 rounded-full bg-black/45 blur-[1.5px] animate-tumble-shadow pointer-events-none"
        />

        {/* Vertical Bounce Wrapper (jump & gravity decay) */}
        <div
          style={{
            animationDelay: delayMs > 0 ? `${delayMs}ms` : undefined,
            transformStyle: 'preserve-3d',
          }}
          className={`relative w-full h-full ${bounceClass}`}
        >
          {/* 3D Multi-Axis Tumbling Cube */}
          <div
            style={{
              animationDelay: delayMs > 0 ? `${delayMs}ms` : undefined,
              transformStyle: 'preserve-3d',
            }}
            className={`relative w-full h-full rounded-[16%] ${rotateClass}`}
          >
            {/* Front Face */}
            <div
              className="absolute inset-0 w-full h-full rounded-[16%] overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              {renderFace(value, imgSrc)}
            </div>

            {/* Back Opposite Face (Authentic dice flip across X and Y) */}
            <div
              className="absolute inset-0 w-full h-full rounded-[16%] overflow-hidden"
              style={{
                transform: 'rotateY(180deg) rotateX(180deg)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              {renderFace(oppositeValue, oppositeImgSrc)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Resting / Saved / Selectable Die Face
  return (
    <div
      onClick={onClick}
      className={`relative aspect-square rounded-[16%] cursor-pointer select-none transition-transform duration-100 
        ${selected ? '-translate-y-1.5 shadow-[0_0_0_3px_#f2c14e,0_8px_14px_rgba(0,0,0,0.45)]' : ''}
        ${pending ? 'shadow-[0_0_0_2px_rgba(255,255,255,0.7),inset_0_-4px_0_rgba(0,0,0,0.22)]' : ''}
        ${className}`}
      title={`${color} die: ${value}`}
    >
      {renderFace(value, imgSrc)}
    </div>
  );
};
