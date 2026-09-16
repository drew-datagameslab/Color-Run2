import React, { useState } from 'react';
import { DiceColor } from '../types/game';

interface DieProps {
  color: DiceColor;
  value: number;
  rolling?: boolean;
  selected?: boolean;
  pending?: boolean;
  onClick?: () => void;
  className?: string;
  delayMs?: number;
}

const COLOR_BG_MAP: Record<DiceColor, string> = {
  blue: '#1f7fd6',
  red: '#e5352f',
  green: '#2f9a4f',
  purple: '#8e44c9',
  black: '#222222',
  lblue: '#45aaf2',
  orange: '#fa8231',
  pink: '#fd79a8',
};

// 3x3 grid dot positions for pip fallback
const PIP_CONFIG: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export const DieComponent: React.FC<DieProps> = ({
  color,
  value,
  rolling = false,
  selected = false,
  pending = false,
  onClick,
  className = '',
  delayMs = 0,
}) => {
  const [imgError, setImgError] = useState(false);

  const imgSrc = `/assets/dice/${color}/${value}.png`;

  return (
    <div
      onClick={onClick}
      style={{
        animationDelay: rolling ? `${delayMs}ms` : undefined,
      }}
      className={`relative aspect-square rounded-[16%] cursor-pointer select-none transition-transform duration-100 
        ${rolling ? 'animate-tumble' : ''}
        ${selected ? '-translate-y-1.5 shadow-[0_0_0_3px_#f2c14e,0_8px_14px_rgba(0,0,0,0.45)]' : ''}
        ${pending ? 'shadow-[0_0_0_2px_rgba(255,255,255,0.7),inset_0_-4px_0_rgba(0,0,0,0.22)]' : ''}
        ${className}`}
      title={`${color} die: ${value}`}
    >
      {!imgError ? (
        <img
          src={imgSrc}
          alt={`${color} ${value}`}
          onError={() => setImgError(true)}
          draggable={false}
          className="w-full h-full object-contain block pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]"
        />
      ) : (
        <div
          className="w-full h-full rounded-[16%] flex items-center justify-center p-2 shadow-md"
          style={{ backgroundColor: COLOR_BG_MAP[color] || '#333' }}
        >
          <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5">
            {Array.from({ length: 9 }).map((_, idx) => {
              const isDot = PIP_CONFIG[value]?.includes(idx);
              return (
                <div key={idx} className="flex items-center justify-center">
                  {isDot && (
                    <div className="w-2 h-2 rounded-full bg-white shadow-sm" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
