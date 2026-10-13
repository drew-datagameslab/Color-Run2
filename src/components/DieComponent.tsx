import React, { useState, useEffect, useRef } from 'react';
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
  /** How long the roll lasts; the tumble lands on `value` just before it ends */
  rollDurationMs?: number;
}

/**
 * Cube rotation that brings each value's face to the front. Each face is placed with the
 * opposite rotation on the same axis (see `faces` below), so the two cancel out and the
 * landed face lines up exactly with the flat die shown after the roll.
 */
const LANDING_ROTATION: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  2: { x: 0, y: -90 },
  5: { x: 0, y: 90 },
  3: { x: 90, y: 0 },
  4: { x: -90, y: 0 },
};

// One "land and settle" bounce, the same shape as the old repeating bounce
const BOUNCE_FRAMES: Keyframe[] = [
  { transform: 'translateY(0px) scale(1)' },
  { transform: 'translateY(-24px) scale(1.08)', offset: 0.22 },
  { transform: 'translateY(2px) scale(0.95)', offset: 0.48 },
  { transform: 'translateY(-10px) scale(1.03)', offset: 0.68 },
  { transform: 'translateY(1px) scale(0.98)', offset: 0.84 },
  { transform: 'translateY(-3px) scale(1.01)', offset: 0.94 },
  { transform: 'translateY(0px) scale(1)' },
];

const SHADOW_FRAMES: Keyframe[] = [
  { transform: 'scale(1)', opacity: 0.55 },
  { transform: 'scale(0.55)', opacity: 0.2, offset: 0.22 },
  { transform: 'scale(1.2)', opacity: 0.85, offset: 0.48 },
  { transform: 'scale(0.7)', opacity: 0.35, offset: 0.68 },
  { transform: 'scale(1.1)', opacity: 0.75, offset: 0.84 },
  { transform: 'scale(0.92)', opacity: 0.5, offset: 0.94 },
  { transform: 'scale(1)', opacity: 0.55 },
];

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
  // Gradient sets: start and end colors (the dice images carry the full gradient)
  sunset: { bgTop: '#fbbf24', bgBottom: '#db2777', stroke: 'rgba(255, 255, 255, 0.45)' },
  ruby: { bgTop: '#fb7185', bgBottom: '#4c0519', stroke: 'rgba(255, 255, 255, 0.45)' },
  desert: { bgTop: '#f5d08a', bgBottom: '#7c2d12', stroke: 'rgba(255, 255, 255, 0.45)' },
  gold: { bgTop: '#fde68a', bgBottom: '#8a6508', stroke: 'rgba(255, 255, 255, 0.45)' },
  forest: { bgTop: '#a3e635', bgBottom: '#14532d', stroke: 'rgba(255, 255, 255, 0.45)' },
  aurora: { bgTop: '#34d399', bgBottom: '#7c3aed', stroke: 'rgba(255, 255, 255, 0.45)' },
  ocean: { bgTop: '#22d3ee', bgBottom: '#1e3a8a', stroke: 'rgba(255, 255, 255, 0.45)' },
  silver: { bgTop: '#f1f5f9', bgBottom: '#5b6470', stroke: 'rgba(255, 255, 255, 0.45)' },
  cottoncandy: { bgTop: '#f472b6', bgBottom: '#3b82f6', stroke: 'rgba(255, 255, 255, 0.45)' },
  twilight: { bgTop: '#f472b6', bgBottom: '#1e1b4b', stroke: 'rgba(255, 255, 255, 0.45)' },
  galaxy: { bgTop: '#7c3aed', bgBottom: '#0b1026', stroke: 'rgba(255, 255, 255, 0.35)' },
  rainbow: { bgTop: '#ef4444', bgBottom: '#8b5cf6', stroke: 'rgba(255, 255, 255, 0.45)' },
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
  rollDurationMs = 1100,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<HTMLDivElement>(null);
  const bounceRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const [cubeSize, setCubeSize] = useState(44);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 0) setCubeSize(w);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const isWarm = ['red', 'orange', 'pink', 'sunset', 'ruby', 'desert', 'gold'].includes(color);

  // One tumble per roll that finishes on the rolled value, so the face the die lands on
  // is the result (an endlessly looping spin stopped on whatever face it was showing).
  useEffect(() => {
    if (!rolling) return;
    const cube = cubeRef.current;
    if (!cube || typeof cube.animate !== 'function') return;

    const end = LANDING_ROTATION[value] || LANDING_ROTATION[1];
    // Warm dice spin one way, cool dice the other; two full turns (720deg) before landing
    const turns = isWarm ? 720 : -720;
    const wobble = isWarm ? -14 : 14;
    // Land a little before the roll ends so the flat die replaces an already-settled cube.
    // The stagger delay is capped so short (fast-forward) rolls still finish in time.
    const delay = Math.min(delayMs, rollDurationMs * 0.15);
    const duration = Math.max(40, rollDurationMs - delay - Math.min(60, rollDurationMs * 0.2));
    const timing: KeyframeAnimationOptions = { duration, delay, fill: 'both' };

    const animations = [
      cube.animate(
        [
          { transform: 'rotateX(0deg) rotateY(0deg) rotateZ(0deg)' },
          {
            transform: `rotateX(${turns * 0.6 + end.x * 0.5}deg) rotateY(${turns * 0.6 + end.y * 0.5}deg) rotateZ(${wobble}deg)`,
            offset: 0.55,
          },
          { transform: `rotateX(${turns + end.x}deg) rotateY(${turns + end.y}deg) rotateZ(0deg)` },
        ],
        { ...timing, easing: 'cubic-bezier(0.25, 0.6, 0.3, 1)' }
      ),
      bounceRef.current?.animate(BOUNCE_FRAMES, { ...timing, easing: 'linear' }),
      shadowRef.current?.animate(SHADOW_FRAMES, { ...timing, easing: 'linear' }),
    ];
    return () => animations.forEach(a => a?.cancel());
  }, [rolling, value, isWarm, delayMs, rollDurationMs]);

  const renderFaceGraphic = (faceVal: number) => {
    if (forcePips || imgErrors[faceVal]) {
      return <PippedDieFace color={color} value={faceVal} />;
    }
    return (
      <img
        src={`/assets/dice/${color}/${faceVal}.png`}
        alt={`${color} ${faceVal}`}
        onError={() => setImgErrors(prev => ({ ...prev, [faceVal]: true }))}
        draggable={false}
        className="w-full h-full object-contain block pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.32)]"
      />
    );
  };

  // 3D Tumbling Cube State (shows all 6 faces turning through 3D space during roll)
  if (rolling) {
    const half = Math.round(cubeSize / 2);
    // Standard Western opposing face configuration (1 opposite 6, 2 opposite 5, 3 opposite 4)
    const faces = [
      { val: 1, transform: `translateZ(${half}px)` },
      { val: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
      { val: 2, transform: `rotateY(90deg) translateZ(${half}px)` },
      { val: 5, transform: `rotateY(-90deg) translateZ(${half}px)` },
      { val: 3, transform: `rotateX(-90deg) translateZ(${half}px)` },
      { val: 4, transform: `rotateX(90deg) translateZ(${half}px)` },
    ];

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full aspect-square flex items-center justify-center select-none ${className}`}
        style={{ perspective: '500px' }}
        title={`${color} die rolling...`}
      >
        {/* Dynamic Tabletop Contact Shadow */}
        <div
          ref={shadowRef}
          className="absolute -bottom-1 w-[78%] h-2 rounded-full bg-black/45 blur-[1.5px] pointer-events-none"
        />

        {/* Vertical Bounce Wrapper for Tabletop Physics */}
        <div
          ref={bounceRef}
          style={{ transformStyle: 'preserve-3d' }}
          className="relative w-full h-full flex items-center justify-center"
        >
          {/* 3D Tumbling Cube displaying all 6 sides turning through 3D space */}
          <div
            ref={cubeRef}
            style={{
              width: `${cubeSize}px`,
              height: `${cubeSize}px`,
              transformStyle: 'preserve-3d',
            }}
            className="relative rounded-[16%]"
          >
            {faces.map(({ val, transform }) => (
              <div
                key={val}
                className="absolute inset-0 rounded-[16%] flex items-center justify-center overflow-hidden"
                style={{
                  width: `${cubeSize}px`,
                  height: `${cubeSize}px`,
                  transform,
                  WebkitBackfaceVisibility: 'hidden',
                  backfaceVisibility: 'hidden',
                }}
              >
                {renderFaceGraphic(val)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Resting / Saved / Selectable Die Face
  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`relative w-full h-full aspect-square flex items-center justify-center select-none ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      title={`${color} die: ${value}`}
    >
      <div
        className={`relative w-full h-full rounded-[16%] flex items-center justify-center transition-transform duration-100
          ${selected ? '-translate-y-1.5 shadow-[0_0_0_3px_#f2c14e,0_8px_14px_rgba(0,0,0,0.45)]' : ''}
          ${pending ? 'shadow-[0_0_0_2px_rgba(255,255,255,0.7),inset_0_-4px_0_rgba(0,0,0,0.22)]' : ''}`}
      >
        {renderFaceGraphic(value)}
      </div>
    </div>
  );
};
