import React from 'react';
import { Users, Swords, ArrowLeft, Globe, Bot } from 'lucide-react';
import { Friend, UserAccount } from '../types/game';

interface ModeSelectScreenProps {
  user?: UserAccount;
  friends?: Friend[];
  onSelectMode: (mode: 'online' | 'cpu' | 'challenge_friend' | 'pass_and_play') => void;
  onSelectFriend?: (friend: Friend) => void;
  onInviteFriends?: () => void;
  onToast?: (msg: string) => void;
  onBack: () => void;
}

export const ModeSelectScreen: React.FC<ModeSelectScreenProps> = ({
  onSelectMode,
  onBack,
}) => {
  return (
    <div className="w-full max-h-[calc(100vh-65px)] overflow-y-auto custom-scrollbar flex flex-col justify-center items-center select-none py-4 px-2">
      {/* 1. Main Select Game Mode Card (centered, scrollable if height constrained) */}
      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg mx-auto my-auto py-2 flex flex-col items-center">
        <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col items-center">
          <h2 className="text-lg sm:text-xl font-black text-[#1c6a35] mb-0.5 text-center">
            Select Game Mode
          </h2>
          <p className="text-[11px] sm:text-xs text-[#6e533c] text-center mb-3 font-medium">
            Choose how you want to play Color Run
          </p>

          <div className="w-full flex flex-col gap-2.5">
            {/* Mode 1: Multiplayer Online */}
            <button
              onClick={() => onSelectMode('online')}
              className="w-full p-2.5 sm:p-3 bg-white hover:bg-[#f9f5ea] border-2 border-[#2f9a4f] rounded-2xl shadow-md text-left transition-all active:scale-98 flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#2f9a4f] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Globe className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-[#1c6a35]">Multiplayer Online</div>
                <div className="text-[11px] text-[#6d5138] leading-tight">
                  Play against friends or random players.
                </div>
              </div>
            </button>

            {/* Mode 2: Play vs Computer */}
            <button
              onClick={() => onSelectMode('cpu')}
              className="w-full p-2.5 sm:p-3 bg-white hover:bg-[#f9f5ea] border-2 border-[#8e44c9] rounded-2xl shadow-md text-left transition-all active:scale-98 flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#8e44c9] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-[#8e44c9]">Play vs Computer</div>
                <div className="text-[11px] text-[#6d5138] leading-tight">
                  Match your skills against virtual opponents.
                </div>
              </div>
            </button>

            {/* Mode 3: Friend(s) Challenge */}
            <button
              onClick={() => onSelectMode('challenge_friend')}
              className="w-full p-2.5 sm:p-3 bg-white hover:bg-[#f9f5ea] border-2 border-[#e58a1f] rounded-2xl shadow-md text-left transition-all active:scale-98 flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#e58a1f] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Swords className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-[#e58a1f]">Friend(s) Challenge</div>
                <div className="text-[11px] text-[#6d5138] leading-tight">
                  Invite a friend to roll head-to-head for coins
                </div>
              </div>
            </button>

            {/* Mode 4: Pass & Play */}
            <button
              onClick={() => onSelectMode('pass_and_play')}
              className="w-full p-2.5 sm:p-3 bg-white hover:bg-[#f9f5ea] border-2 border-[#1f7fd6] rounded-2xl shadow-md text-left transition-all active:scale-98 flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#1f7fd6] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-[#1f7fd6]">Pass &amp; Play</div>
                <div className="text-[11px] text-[#6d5138] leading-tight">
                  Play with players on one device (no internet required)
                </div>
              </div>
            </button>
          </div>

          <button
            onClick={onBack}
            className="mt-4 flex items-center justify-center gap-1 text-xs font-bold text-[#5c442c] hover:text-black transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
