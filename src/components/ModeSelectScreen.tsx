import React from 'react';
import { Users, Swords, ArrowLeft, Globe, Bot } from 'lucide-react';
import { Friend } from '../types/game';
import { MyFriendsBar } from './MyFriendsBar';

interface ModeSelectScreenProps {
  friends: Friend[];
  onSelectMode: (mode: 'online' | 'cpu' | 'challenge_friend' | 'pass_and_play') => void;
  onSelectFriend: (friend: Friend) => void;
  onInviteFriends?: () => void;
  onBack: () => void;
}

export const ModeSelectScreen: React.FC<ModeSelectScreenProps> = ({
  friends,
  onSelectMode,
  onSelectFriend,
  onInviteFriends,
  onBack,
}) => {
  return (
    <div className="w-full min-h-[calc(100vh-65px)] flex flex-col justify-between items-center select-none">
      {/* 1. Main Select Game Mode Card (centered) */}
      <div className="w-full max-w-sm mx-auto px-4 my-auto py-4 flex flex-col items-center">
        <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col items-center">
          <h2 className="text-xl font-black text-[#1c6a35] mb-1 text-center">
            Select Game Mode
          </h2>
          <p className="text-xs text-[#6e533c] text-center mb-5 font-medium">
            Choose how you want to play Color Run
          </p>

          <div className="w-full flex flex-col gap-3">
            {/* Mode 1: Multiplayer Online */}
            <button
              onClick={() => onSelectMode('online')}
              className="w-full p-3.5 bg-white hover:bg-[#f9f5ea] border-2 border-[#2f9a4f] rounded-2xl shadow-md text-left transition-all active:scale-98 flex items-center gap-3.5 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-[#2f9a4f] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Globe className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-[#1c6a35]">Multiplayer Online</div>
                <div className="text-[11px] text-[#6d5138]">
                  Match your skills against others.
                </div>
              </div>
            </button>

            {/* Mode 2: Play vs Computer */}
            <button
              onClick={() => onSelectMode('cpu')}
              className="w-full p-3.5 bg-white hover:bg-[#f9f5ea] border-2 border-[#8e44c9] rounded-2xl shadow-md text-left transition-all active:scale-98 flex items-center gap-3.5 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-[#8e44c9] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Bot className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-[#8e44c9]">Play vs Computer</div>
                <div className="text-[11px] text-[#6d5138]">
                  Match your skills against virtual opponents.
                </div>
              </div>
            </button>

            {/* Mode 3: Challenge A Friend */}
            <button
              onClick={() => onSelectMode('challenge_friend')}
              className="w-full p-3.5 bg-white hover:bg-[#f9f5ea] border-2 border-[#e58a1f] rounded-2xl shadow-md text-left transition-all active:scale-98 flex items-center gap-3.5 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-[#e58a1f] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Swords className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-[#e58a1f]">Challenge A Friend</div>
                <div className="text-[11px] text-[#6d5138]">
                  Invite a friend to roll head-to-head for coins
                </div>
              </div>
            </button>

            {/* Mode 4: Pass & Play (2P) */}
            <button
              onClick={() => onSelectMode('pass_and_play')}
              className="w-full p-3.5 bg-white hover:bg-[#f9f5ea] border-2 border-[#1f7fd6] rounded-2xl shadow-md text-left transition-all active:scale-98 flex items-center gap-3.5 group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-[#1f7fd6] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black text-[#1f7fd6]">Pass &amp; Play (2P)</div>
                <div className="text-[11px] text-[#6d5138]">
                  Two players take turns rolling on the same screen
                </div>
              </div>
            </button>
          </div>

          <button
            onClick={onBack}
            className="mt-6 flex items-center justify-center gap-1 text-xs font-bold text-[#5c442c] hover:text-black transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </button>
        </div>
      </div>

      {/* 2. Friends Bar moved to the bottom over the bottom ad */}
      <div className="w-full mt-auto">
        <MyFriendsBar
          friends={friends}
          onSelectFriend={onSelectFriend}
          onInviteFriends={onInviteFriends}
        />
      </div>
    </div>
  );
};
