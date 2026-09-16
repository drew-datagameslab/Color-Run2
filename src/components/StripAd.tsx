import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface StripAdProps {
  onRemoveAdsClick: () => void;
}

const MOCK_SPONSORS = [
  {
    title: 'Color Run: Home Edition',
    desc: 'The official physical board game with 12 custom engraved dice & playmat.',
    cta: 'Get Game Code',
  },
  {
    title: 'Double Action Velvet Trays',
    desc: 'Premium noise-dampening dice trays designed for Color Run showdowns.',
    cta: 'Explore Gear',
  },
  {
    title: 'Color Run World Tour 2026',
    desc: 'Compete in community tournaments, earn physical trophies & prizes!',
    cta: 'Learn More',
  },
];

export const StripAd: React.FC<StripAdProps> = ({ onRemoveAdsClick }) => {
  const [adIdx, setAdIdx] = useState(0);

  // Rotate placeholder ad creative gently every 12 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setAdIdx(prev => (prev + 1) % MOCK_SPONSORS.length);
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  const currentAd = MOCK_SPONSORS[adIdx];

  return (
    <div
      id="bottom-strip-ad"
      className="w-full bg-[#1e150f] border-t border-[#c9b877]/40 shadow-2xl backdrop-blur-xs select-none sticky bottom-0 z-30 shrink-0"
    >
      <div className="max-w-xl mx-auto px-3 py-1.5 flex items-center justify-between gap-2 min-h-[50px]">
        {/* Ad Badge & Creative Text */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="shrink-0 flex flex-col items-center justify-center">
            <span className="text-[9px] font-black uppercase tracking-wider bg-[#c9b877] text-[#2b170a] px-1.5 py-0.5 rounded leading-none shadow-xs">
              AD
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-[#faf4e6] truncate">
                {currentAd.title}
              </span>
              <span className="hidden sm:inline-block text-[10px] text-[#f2c14e] font-medium">
                · {currentAd.cta}
              </span>
            </div>
            <p className="text-[10px] text-[#d3c299] truncate leading-tight">
              {currentAd.desc}
            </p>
          </div>
        </div>

        {/* Remove Ads / Go Ad Free Button */}
        <button
          onClick={onRemoveAdsClick}
          className="shrink-0 px-2.5 py-1 bg-[#2f9a4f] hover:bg-[#268a48] text-white text-[11px] font-bold rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1 border border-[#2f9a4f]/40 whitespace-nowrap"
          title="Remove Ads with Home Game Code or Game Store"
        >
          <Sparkles className="w-3 h-3 text-amber-200" />
          <span>Remove Ads</span>
        </button>
      </div>
    </div>
  );
};
