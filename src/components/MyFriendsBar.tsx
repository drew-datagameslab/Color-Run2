import React, { useRef } from 'react';
import { Friend } from '../types/game';
import { ChevronRight, ChevronLeft, Swords, UserPlus } from 'lucide-react';

interface MyFriendsBarProps {
  friends: Friend[];
  onSelectFriend: (friend: Friend) => void;
  onAddFriendPrompt?: () => void;
}

export const MyFriendsBar: React.FC<MyFriendsBarProps> = ({
  friends,
  onSelectFriend,
  onAddFriendPrompt,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 140, behavior: 'smooth' });
    }
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -140, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-[#fcf8ee] border-b border-[#d8c89f] px-2 py-2.5 shadow-sm select-none">
      <div className="max-w-xl mx-auto flex flex-col">
        {/* Header matching wireframe */}
        <div className="text-center font-black text-sm text-[#4a3622] tracking-wide mb-1.5 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
          My Friends
        </div>

        {/* Scrollable Friend Avatars Row */}
        <div className="relative flex items-center w-full">
          {/* Friends Container */}
          <div
            ref={scrollRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 px-1 w-full scroll-smooth"
          >
            {friends.length === 0 ? (
              <div className="flex items-center justify-between w-full py-1.5 px-2 bg-amber-50/50 rounded-xl border border-dashed border-[#c9b877]/60 text-xs text-[#7a6047]">
                <span className="text-[11px] font-medium italic">No friends yet. Add players by tapping their avatar during a game!</span>
                {onAddFriendPrompt && (
                  <button
                    onClick={onAddFriendPrompt}
                    className="ml-2 px-2.5 py-1 bg-[#d9ba6d] hover:bg-[#c9a957] border border-[#bfa255] rounded-lg text-[10px] font-black text-white flex items-center gap-1 shrink-0"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                )}
              </div>
            ) : (
              friends.map(friend => {
                const initials = friend.name
                  .split(' ')
                  .map(w => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                const isOnline = friend.status === 'online';

                return (
                  <button
                    key={friend.id}
                    onClick={() => onSelectFriend(friend)}
                    title={`${friend.name} (${friend.status}) - Tap to Challenge`}
                    className="flex flex-col items-center justify-between min-w-[62px] max-w-[66px] h-[72px] p-1.5 bg-[#d9ba6d]/30 hover:bg-[#d9ba6d]/50 active:scale-95 border-2 border-[#bfa255] rounded-xl transition-all cursor-pointer group shadow-xs shrink-0"
                  >
                    {/* Round Avatar Circle with Status Dot */}
                    <div className="relative">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shadow-sm border border-white/80 group-hover:scale-105 transition-transform"
                        style={{
                          backgroundColor: friend.color || '#e5352f',
                          backgroundImage: friend.image ? `url(${friend.image})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        {!friend.image && initials}
                      </div>

                      {/* Online status indicator dot (Green = online, Red/Amber = in game) */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-1.5 border-white shadow-xs ${
                          isOnline ? 'bg-[#10b981]' : 'bg-[#e5352f]'
                        }`}
                      />
                    </div>

                    {/* Friend User Name */}
                    <span className="text-[10px] font-bold text-[#3e2e1e] group-hover:text-black truncate w-full text-center leading-tight">
                      {friend.name}
                    </span>
                  </button>
                );
              })
            )}

            {/* If user has friends and wants to add more */}
            {friends.length > 0 && onAddFriendPrompt && (
              <button
                onClick={onAddFriendPrompt}
                title="Add a friend by username"
                className="flex flex-col items-center justify-center min-w-[62px] h-[72px] p-1.5 bg-[#e8deca]/50 hover:bg-[#e8deca] border-2 border-dashed border-[#bda67a] rounded-xl transition-all cursor-pointer text-[#7a6047] shrink-0"
              >
                <div className="w-8 h-8 rounded-full bg-[#d9ccb4] flex items-center justify-center text-[#5c442c] mb-0.5">
                  <UserPlus className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-extrabold uppercase">Add</span>
              </button>
            )}
          </div>

          {/* Right Chevron Button matching wireframe `>` */}
          <button
            onClick={scrollRight}
            aria-label="Scroll friends list"
            className="shrink-0 ml-1.5 w-7 h-14 bg-[#d9ba6d] hover:bg-[#c9a957] active:bg-[#b59545] border-2 border-[#bfa255] text-white font-black text-base rounded-lg flex items-center justify-center shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};
