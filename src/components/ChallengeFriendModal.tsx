import React, { useState, useMemo } from 'react';
import { Friend, GameSettings, UserAccount, DiceColor } from '../types/game';
import { Swords, X, Users, AlertCircle } from 'lucide-react';
import { FriendBlock } from './FriendBlock';

interface ChallengeFriendModalProps {
  friends: Friend[];
  initialFriend?: Friend | null;
  user: UserAccount;
  coins: number;
  equippedColors: [DiceColor, DiceColor];
  onStartChallengeRoom: (selectedFriends: Friend[], buyIn: number) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const ChallengeFriendModal: React.FC<ChallengeFriendModalProps> = ({
  friends,
  initialFriend,
  user,
  coins,
  equippedColors,
  onStartChallengeRoom,
  onClose,
  onToast,
}) => {
  // Sort friends: Online friends to the left-hand side first, Offline friends to the right
  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      const aOnline = a.status === 'online' ? 1 : 0;
      const bOnline = b.status === 'online' ? 1 : 0;
      return bOnline - aOnline;
    });
  }, [friends]);

  // Initial selection: if initialFriend is provided and online, select them; else select first online friend
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>(() => {
    if (initialFriend && initialFriend.status === 'online') {
      return [initialFriend.id];
    }
    const firstOnline = sortedFriends.find(f => f.status === 'online');
    return firstOnline ? [firstOnline.id] : [];
  });

  const [buyIn, setBuyIn] = useState<number>(10);

  const handleToggleFriend = (friend: Friend) => {
    if (friend.status !== 'online') {
      onToast(`${friend.name} is offline. Only online friends can be invited.`);
      return;
    }

    setSelectedFriendIds(prev => {
      if (prev.includes(friend.id)) {
        return prev.filter(id => id !== friend.id);
      } else {
        return [...prev, friend.id];
      }
    });
  };

  const handleLaunchChallenge = () => {
    if (selectedFriendIds.length === 0) {
      onToast('Please select at least one online friend to challenge.');
      return;
    }

    if (buyIn > 0 && coins < buyIn) {
      onToast(`Not enough coins — you need 🪙 ${buyIn} to play this match!`);
      return;
    }

    const selectedFriends = sortedFriends.filter(f => selectedFriendIds.includes(f.id));
    onStartChallengeRoom(selectedFriends, buyIn);
    onClose();
  };

  const onlineCount = sortedFriends.filter(f => f.status === 'online').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm sm:max-w-md bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col items-center animate-scale-up max-h-[92vh] overflow-y-auto custom-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-[#6d5138] hover:bg-[#ebdcba] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="w-11 h-11 rounded-2xl bg-[#e58a1f] text-white flex items-center justify-center shadow-md mb-1.5">
          <Swords className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-black text-[#e58a1f] text-center">Friend(s) Challenge</h3>
        <p className="text-xs text-[#6e533c] text-center mb-3 font-medium">
          Select friends to invite to a live challenge match
        </p>

        {/* Select Opponent(s) Section */}
        <div className="w-full mb-3.5">
          <div className="flex justify-between items-center mb-1.5 px-0.5">
            <span className="text-xs font-black text-[#4a3622] uppercase tracking-wide flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#e58a1f]" />
              <span>Select Opponent(s)</span>
            </span>
            <span className="text-[11px] font-bold text-[#1f7fd6]">
              {selectedFriendIds.length} Selected ({onlineCount} Online)
            </span>
          </div>

          {/* Horizontal scroll container with scrollbar underneath */}
          <div className="w-full bg-[#f4ebd6] p-2.5 rounded-2xl border border-[#d8c89f] shadow-inner">
            <div className="w-full flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
              {sortedFriends.map(friend => {
                const isSelected = selectedFriendIds.includes(friend.id);
                return (
                  <FriendBlock
                    key={friend.id}
                    friend={friend}
                    isSelected={isSelected}
                    onClick={() => handleToggleFriend(friend)}
                  />
                );
              })}
            </div>
            <div className="text-[10px] text-[#7d6045] font-semibold text-center mt-1 flex items-center justify-center gap-1">
              <span>Scroll sideways to view all friends • Online friends appear first</span>
            </div>
          </div>
        </div>

        {/* Buy-in Selector */}
        <div className="w-full mb-4">
          <div className="text-xs font-black text-[#4a3622] uppercase tracking-wide mb-1.5 px-0.5">
            Wager / Buy-In
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 10, 20, 50].map(amount => (
              <button
                key={amount}
                type="button"
                onClick={() => setBuyIn(amount)}
                className={`py-2 px-1 rounded-xl font-black text-xs transition-all flex flex-col items-center justify-center cursor-pointer border ${
                  buyIn === amount
                    ? 'bg-[#e58a1f] text-white border-[#b5670b] shadow-sm scale-[1.02]'
                    : 'bg-white text-[#4a3622] border-[#d8c89f] hover:bg-[#faf5e8]'
                }`}
              >
                <span>{amount === 0 ? 'Free' : `🪙 ${amount}`}</span>
                <span className="text-[9px] opacity-85 font-mono">
                  {amount === 0 ? 'Casual' : `Win ${amount * (selectedFriendIds.length + 1 || 2)}`}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleLaunchChallenge}
          className="w-full py-3 px-4 bg-gradient-to-r from-[#e58a1f] to-[#cb7512] hover:from-[#f0952a] hover:to-[#da7f1b] text-white font-black text-sm rounded-2xl shadow-lg border-b-3 border-[#9c570b] transition-transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Swords className="w-4 h-4" />
          <span>Challenge and Start Rolling!</span>
        </button>
      </div>
    </div>
  );
};
