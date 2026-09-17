import React, { useRef } from 'react';
import { Friend } from '../types/game';
import { ChevronRight, ChevronLeft, Swords, UserPlus, Share2, Sparkles } from 'lucide-react';

interface MyFriendsBarProps {
  friends: Friend[];
  onSelectFriend: (friend: Friend) => void;
  onAddFriendPrompt?: () => void;
  onInviteFriends?: () => void;
}

export const MyFriendsBar: React.FC<MyFriendsBarProps> = ({
  friends,
  onSelectFriend,
  onAddFriendPrompt,
  onInviteFriends,
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
    <div className="w-full bg-[#fcf8ee] border-t border-[#d8c89f] px-2 py-2 shadow-md select-none">
      <div className="max-w-xl mx-auto flex flex-col">
        {/* Header bar matching wireframe, plus challenge friend bonus CTA */}
        <div className="flex items-center justify-between px-1 mb-1.5">
          <div className="font-black text-xs text-[#4a3622] tracking-wide drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] flex items-center gap-1.5">
            <span>My Friends</span>
            <span className="text-[10px] font-bold text-[#8c745e] bg-amber-100/70 px-1.5 py-0.2 rounded-full border border-amber-200">
              {friends.length}
            </span>
          </div>

          {onInviteFriends && (
            <button
              onClick={onInviteFriends}
              className="px-2 py-0.5 bg-[#2f9a4f] hover:bg-[#268a48] border border-[#1b6b33] rounded-lg text-[10px] font-black text-white flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Send a text link to invite your friends and get 300 coins!"
            >
              <Share2 className="w-3 h-3 text-amber-200" />
              <span>Challenge Friend (+300 🪙)</span>
            </button>
          )}
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
                <span className="text-[11px] font-medium italic">
                  No friends yet. Challenge friends by SMS for 300 coins or add in-game!
                </span>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {onInviteFriends && (
                    <button
                      onClick={onInviteFriends}
                      className="px-2 py-1 bg-[#2f9a4f] hover:bg-[#268a48] border border-[#1b6b33] rounded-lg text-[10px] font-black text-white flex items-center gap-1"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Invite SMS</span>
                    </button>
                  )}
                  {onAddFriendPrompt && (
                    <button
                      onClick={onAddFriendPrompt}
                      className="px-2 py-1 bg-[#d9ba6d] hover:bg-[#c9a957] border border-[#bfa255] rounded-lg text-[10px] font-black text-white flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
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

            {/* If user has friends and wants to invite more */}
            {friends.length > 0 && onInviteFriends && (
              <button
                onClick={onInviteFriends}
                title="Send a text link to invite another friend"
                className="flex flex-col items-center justify-center min-w-[62px] h-[72px] p-1.5 bg-emerald-50 hover:bg-emerald-100 border-2 border-dashed border-emerald-500/60 rounded-xl transition-all cursor-pointer text-emerald-800 shrink-0"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center mb-0.5 shadow-xs">
                  <Share2 className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-extrabold uppercase">Invite</span>
              </button>
            )}

            {/* If user has friends and wants to add more by username */}
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
