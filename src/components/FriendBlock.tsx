import React from 'react';
import { Friend } from '../types/game';

interface FriendBlockProps {
  friend: Friend;
  isSelected?: boolean;
  bubbleMessage?: string | null;
  onClick?: () => void;
  compact?: boolean;
}

export const FriendBlock: React.FC<FriendBlockProps> = ({
  friend,
  isSelected = false,
  bubbleMessage = null,
  onClick,
  compact = false,
}) => {
  const isOnline = friend.status === 'online';

  return (
    <div className="relative shrink-0 flex flex-col items-center">
      {/* Speech bubble over avatar (e.g. "Will join shortly!" or "Can't make it.") */}
      {bubbleMessage && (
        <div className="absolute -top-7 z-30 flex flex-col items-center animate-bounce pointer-events-none">
          <div
            className={`px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-md whitespace-nowrap border border-white/20 ${
              bubbleMessage.includes("Can't")
                ? 'bg-[#c92a2a]'
                : bubbleMessage.includes('shortly')
                ? 'bg-[#d97706]'
                : bubbleMessage.includes('Joined')
                ? 'bg-[#208b3a]'
                : 'bg-[#1f7fd6]'
            }`}
          >
            {bubbleMessage}
          </div>
          <div
            className={`w-1.5 h-1.5 rotate-45 -mt-0.5 ${
              bubbleMessage.includes("Can't")
                ? 'bg-[#c92a2a]'
                : bubbleMessage.includes('shortly')
                ? 'bg-[#d97706]'
                : bubbleMessage.includes('Joined')
                ? 'bg-[#208b3a]'
                : 'bg-[#1f7fd6]'
            }`}
          />
        </div>
      )}

      {/* Rounded rectangle friend block: Red if offline, Green if online, Blue when selected */}
      <button
        type="button"
        onClick={onClick}
        className={`rounded-xl flex flex-col items-center justify-between text-center select-none transition-all duration-200 shadow-md ${
          compact ? 'w-[72px] h-[86px] p-1.5' : 'w-[80px] sm:w-[88px] h-[96px] sm:h-[102px] p-2'
        } ${
          isSelected
            ? 'bg-[#1f7fd6] border-2 border-white ring-2 ring-[#7ec1ff] scale-[1.03] shadow-lg cursor-pointer'
            : isOnline
            ? 'bg-[#208b3a] border border-white/30 hover:scale-[1.02] cursor-pointer'
            : 'bg-[#c92a2a] border border-white/20 opacity-80 cursor-not-allowed'
        }`}
      >
        {/* User avatar at the top inside the block */}
        <div
          className={`${
            compact ? 'w-8 h-8 text-xs' : 'w-9 h-9 sm:w-10 sm:h-10 text-xs sm:text-sm'
          } rounded-full flex items-center justify-center font-black text-white shrink-0 shadow-sm border border-white/40 transition-transform`}
          style={{
            backgroundColor: friend.color || '#e5352f',
            backgroundImage: friend.image ? `url(${friend.image})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!friend.image && friend.name.slice(0, 2).toUpperCase()}
        </div>

        {/* User name under the avatar */}
        <div
          className={`w-full text-center font-black uppercase tracking-wide text-white leading-tight truncate px-0.5 ${
            compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'
          }`}
          title={friend.name}
        >
          {friend.name}
        </div>

        {/* Word Online or Offline in white in a smaller font */}
        <div
          className={`font-bold text-white/95 uppercase tracking-wider ${
            compact ? 'text-[8px]' : 'text-[8.5px] sm:text-[9.5px]'
          }`}
        >
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </button>
    </div>
  );
};
