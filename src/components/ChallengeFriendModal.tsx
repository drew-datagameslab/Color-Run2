import React, { useState } from 'react';
import { Friend, GameSettings, UserAccount, DiceColor } from '../types/game';
import { Swords, X, UserPlus, Check, Sparkles, UserMinus } from 'lucide-react';

interface ChallengeFriendModalProps {
  friends: Friend[];
  initialFriend?: Friend | null;
  user: UserAccount;
  coins: number;
  equippedColors: [DiceColor, DiceColor];
  onStartGame: (settings: GameSettings) => void;
  onRemoveFriend?: (friendId: string) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const ChallengeFriendModal: React.FC<ChallengeFriendModalProps> = ({
  friends,
  initialFriend,
  user,
  coins,
  equippedColors,
  onStartGame,
  onRemoveFriend,
  onClose,
  onToast,
}) => {
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(
    initialFriend || friends[0] || null
  );
  const [buyIn, setBuyIn] = useState<number>(10);
  const [customName, setCustomName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  const userDiceColors: [DiceColor, DiceColor] = user.diceColors || equippedColors;

  const handleLaunchChallenge = () => {
    const opponentName = isAddingNew
      ? customName.trim() || 'Opponent'
      : selectedFriend?.name || 'Friend';

    const opponentColor = isAddingNew ? '#e5352f' : selectedFriend?.color || '#e5352f';

    if (buyIn > 0 && coins < buyIn) {
      onToast(`Not enough coins — you need 🪙 ${buyIn} to play this match!`);
      return;
    }

    const slots: GameSettings['slots'] = [
      {
        name: user.name,
        type: 'human',
        color: user.avatar.color,
        image: user.avatar.image,
        diceColors: userDiceColors,
      },
      {
        name: opponentName,
        type: 'human',
        isOnlinePlayer: true,
        color: opponentColor,
        image: selectedFriend?.image,
        diceColors: ['blue', 'red'],
      },
    ];

    const payouts = buyIn > 0 ? [buyIn * 2, 0] : [0, 0];

    onStartGame({
      playersCount: 2,
      mode: 'challenge_friend',
      threshold: 250,
      buyIn,
      payoutMultiplier: 1,
      payouts,
      colorA: userDiceColors[0],
      colorB: userDiceColors[1],
      slots,
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl p-5 shadow-2xl flex flex-col items-center animate-scale-up"
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
        <div className="w-12 h-12 rounded-2xl bg-[#e58a1f] text-white flex items-center justify-center shadow-md mb-2">
          <Swords className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-black text-[#e58a1f] text-center">Challenge A Friend</h3>
        <p className="text-xs text-[#6e533c] text-center mb-4 font-medium">
          Roll head-to-head in a live 2-player match to 250 points
        </p>

        {/* Friend Selector */}
        <div className="w-full mb-3">
          <div className="flex justify-between items-center mb-1.5 px-0.5">
            <span className="text-xs font-black text-[#4a3622] uppercase tracking-wide">
              Select Opponent
            </span>
            <button
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="text-[11px] font-bold text-[#1f7fd6] hover:underline cursor-pointer"
            >
              {isAddingNew ? 'Choose Saved Friend' : '+ Enter Username'}
            </button>
          </div>

          {isAddingNew ? (
            <input
              type="text"
              placeholder="Friend's Nickname (e.g. LuckyAce)"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#d8c89f] rounded-xl text-[#2e2316] placeholder-[#9c8a74] focus:outline-hidden focus:ring-2 focus:ring-[#e58a1f]"
            />
          ) : (
            <div className="flex gap-2 overflow-x-auto scrollbar-none py-1 px-0.5">
              {friends.map(f => {
                const isSelected = selectedFriend?.id === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFriend(f)}
                    className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-[#fff9ea] border-[#e58a1f] shadow-xs'
                        : 'bg-white border-[#d8c89f] hover:bg-[#faf4e6]'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs"
                      style={{ backgroundColor: f.color }}
                    >
                      {f.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-black text-[#2e2316] leading-tight truncate max-w-[90px]">
                        {f.name}
                      </div>
                      <div className="text-[10px] text-[#735c46] flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            f.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span>{f.status}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
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
                onClick={() => setBuyIn(amount)}
                className={`py-2 px-1 rounded-xl font-black text-xs transition-all flex flex-col items-center justify-center cursor-pointer border ${
                  buyIn === amount
                    ? 'bg-[#e58a1f] text-white border-[#b5670b] shadow-sm scale-[1.02]'
                    : 'bg-white text-[#4a3622] border-[#d8c89f] hover:bg-[#faf5e8]'
                }`}
              >
                <span>{amount === 0 ? 'Free' : `🪙 ${amount}`}</span>
                <span className="text-[9px] opacity-85 font-mono">
                  {amount === 0 ? 'Casual' : `Win ${amount * 2}`}
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
          <span>Challenge &amp; Start Rolling!</span>
        </button>
      </div>
    </div>
  );
};
