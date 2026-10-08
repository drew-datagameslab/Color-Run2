import React, { useState, useEffect } from 'react';

interface ThreeDDiceProps {
  value: number; // 1 to 6
  color: 'red' | 'blue';
  isRolling: boolean;
  rollId: number;
  size?: number; // Size in pixels, default 84
}

// Pip positions in a 3x3 grid (indices 0 to 8)
const PIP_CONFIG: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Target cube rotations to bring each face facing front (+Z)
const TARGET_ANGLES: Record<number, { x: number; y: number; z: number }> = {
  1: { x: 0, y: 0, z: 0 },
  2: { x: 0, y: -90, z: 0 },
  3: { x: 90, y: 0, z: 0 },
  4: { x: -90, y: 0, z: 0 },
  5: { x: 0, y: 90, z: 0 },
  6: { x: 0, y: 180, z: 0 },
};

export const ThreeDDice: React.FC<ThreeDDiceProps> = ({
  value,
  color,
  isRolling,
  rollId,
  size = 84,
}) => {
  const half = size / 2;
  const isRed = color === 'red';

  // Current orientation in degrees
  const [rotation, setRotation] = useState(() => TARGET_ANGLES[value] || TARGET_ANGLES[1]);

  useEffect(() => {
    if (rollId === 0) {
      // Direct position update if reset
      setRotation(TARGET_ANGLES[value] || TARGET_ANGLES[1]);
      return;
    }

    const target = TARGET_ANGLES[value] || TARGET_ANGLES[1];

    // Give Red and Blue dice different spin trajectories so they tumble independently
    const spinsX = isRed ? 4 : 5;
    const spinsY = isRed ? 5 : 4;
    const spinsZ = isRed ? 1 : -1;

    setRotation(prev => {
      const normX = ((prev.x % 360) + 360) % 360;
      const normY = ((prev.y % 360) + 360) % 360;

      const diffX = ((target.x - normX) % 360 + 360) % 360;
      const diffY = ((target.y - normY) % 360 + 360) % 360;

      return {
        x: prev.x + spinsX * 360 + diffX,
        y: prev.y + spinsY * 360 + diffY,
        z: prev.z + spinsZ * 360,
      };
    });
  }, [rollId, value, isRed]);

  // The 6 faces of the 3D die cube
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
      className="relative flex flex-col items-center justify-center select-none py-2"
      style={{ perspective: '900px' }}
    >
      {/* Bouncing wrapper for jump physics during roll */}
      <div
        className={`relative ${
          isRolling
            ? isRed
              ? 'animate-dice-bounce-red'
              : 'animate-dice-bounce-blue'
            : 'transition-transform duration-200 hover:scale-105'
        }`}
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {/* 3D Cube */}
        <div
          className="relative"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`,
            transition: isRolling
              ? 'transform 1.6s cubic-bezier(0.16, 0.9, 0.26, 1.12)'
              : 'transform 0.35s ease-out',
          }}
        >
          {faces.map(({ val, transform }) => {
            const pips = PIP_CONFIG[val] || [4];

            return (
              <div
                key={val}
                className={`absolute inset-0 rounded-[18px] border-2 flex items-center justify-center box-border ${
                  isRed
                    ? 'bg-gradient-to-br from-[#f8433d] via-[#d62822] to-[#80120e] border-[#ff8d87]/60'
                    : 'bg-gradient-to-br from-[#3b9eff] via-[#1a74c8] to-[#0c447a] border-[#8ec5fc]/60'
                }`}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  transform,
                  WebkitBackfaceVisibility: 'hidden',
                  backfaceVisibility: 'hidden',
                  boxShadow: isRed
                    ? 'inset 0 3px 5px rgba(255,255,255,0.45), inset 0 -3px 6px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.4)'
                    : 'inset 0 3px 5px rgba(255,255,255,0.45), inset 0 -3px 6px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.4)',
                }}
              >
                {/* Surface specular reflection */}
                <div className="absolute inset-0 rounded-[16px] bg-gradient-to-br from-white/25 via-transparent to-black/20 pointer-events-none" />

                {/* 3x3 Grid for pips */}
                <div className="w-full h-full p-3 grid grid-cols-3 grid-rows-3 gap-1 items-center justify-items-center relative z-10">
                  {Array.from({ length: 9 }).map((_, idx) => {
                    const hasPip = pips.includes(idx);
                    if (!hasPip) {
                      return <div key={idx} className="w-3.5 h-3.5" />;
                    }

                    // Authentic large center pip on Ace (1)
                    const isAceCenter = val === 1 && idx === 4;

                    return (
                      <div
                        key={idx}
                        className={`rounded-full bg-[#faf9f5] shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.4),0_0.5px_1px_rgba(255,255,255,0.85)] ${
                          isAceCenter
                            ? 'w-4.5 h-4.5 scale-120 bg-[#fff]'
                            : 'w-3.5 h-3.5'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic contact shadow below die */}
      <div
        className={`mt-4 rounded-full bg-black/45 blur-xs transition-all ${
          isRolling
            ? 'animate-dice-shadow'
            : 'w-16 h-3 opacity-60 scale-100'
        }`}
      />
    </div>
  );
};
