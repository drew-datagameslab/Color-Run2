import React, { useState } from 'react';
import { PlayerUnit, UserAccount, Friend } from '../types/game';
import { UserPlus, UserCheck, X, Sparkles, UserMinus, Swords } from 'lucide-react';
import { playSfx } from '../lib/audio';

interface PlayerProfileModalProps {
  player: PlayerUnit;
  user: UserAccount;
  isFriend: boolean;
  onAddFriend: (player: PlayerUnit) => void;
  onRemoveFriend?: (playerName: string) => void;
  onChallengeFriend?: (player: PlayerUnit) => void;
  onClose: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  user,
  isFriend,
  onAddFriend,
  onRemoveFriend,
  onChallengeFriend,
  onClose,
}) => {
  const [justAdded, setJustAdded] = useState(false);
  const isSelf = player.name === user.name;

  const handleAdd = () => {
    playSfx('add');
    setJustAdded(true);
    onAddFriend(player);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xs bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl p-5 shadow-2xl flex flex-col items-center animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-[#6d5138] hover:bg-[#ebdcba] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Player Avatar */}
        <div className="relative mb-2">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl text-white shadow-md border-2 border-white/80"
            style={{
              backgroundColor: player.color,
              backgroundImage: player.image ? `url(${player.image})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!player.image && player.name.slice(0, 2).toUpperCase()}
          </div>
          {/* Status Dot */}
          <span
            className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-[#faf4e6] ${
              player.isCPU ? 'bg-amber-500' : 'bg-green-500'
            }`}
            title={player.isCPU ? 'Computer Player' : 'Live Player Online'}
          />
        </div>

        {/* Player Name */}
        <h3 className="text-base font-black text-[#2e2316] mb-0.5 text-center flex items-center gap-1">
          <span>{player.name}</span>
          {player.isOwner && <span className="text-[11px] font-bold text-[#1c6a35]">(You)</span>}
        </h3>

        {/* Player Badge / Type */}
        <div className="text-[11px] font-semibold text-[#826a52] mb-3 flex items-center gap-1.5">
          {player.isCPU ? (
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
              🤖 Computer Player
            </span>
          ) : (
            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full border border-green-300">
              🟢 Live Player Online
            </span>
          )}
        </div>

        {/* Current Game Stats Preview */}
        <div className="w-full bg-[#f3ecda] rounded-xl p-2.5 mb-4 flex justify-around items-center border border-[#dfceaa] text-center">
          <div>
            <div className="text-[10px] uppercase font-bold text-[#7f654b]">Game Score</div>
            <div className="text-sm font-mono font-black text-[#1c6a35]">{player.score} pts</div>
          </div>
          <div className="w-px h-6 bg-[#dfceaa]" />
          <div>
            <div className="text-[10px] uppercase font-bold text-[#7f654b]">Status</div>
            <div className="text-xs font-bold text-[#2e2316]">
              {player.active ? 'Active Roller' : 'Eliminated'}
            </div>
          </div>
        </div>

        {/* Interaction Buttons */}
        {isSelf ? (
          <div className="text-xs text-[#6e533c] font-medium text-center py-1">
            This is your avatar profile.
          </div>
        ) : justAdded ? (
          <div className="w-full py-2.5 bg-[#2f9a4f] text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 animate-bounce">
            <UserCheck className="w-4 h-4" />
            <span>Friend Added!</span>
          </div>
        ) : isFriend ? (
          <div className="w-full flex flex-col gap-2">
            <div className="py-2 bg-[#2f9a4f]/15 border border-[#2f9a4f]/40 text-[#1c6a35] font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#2f9a4f]" />
              <span>Already in Your Friends</span>
            </div>

            {onChallengeFriend && (
              <button
                onClick={() => {
                  onChallengeFriend(player);
                  onClose();
                }}
                className="w-full py-2 bg-[#e58a1f] hover:bg-[#cb7512] text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Swords className="w-4 h-4" />
                <span>Challenge to 1v1</span>
              </button>
            )}

            {onRemoveFriend && (
              <button
                onClick={() => {
                  onRemoveFriend(player.name);
                  onClose();
                }}
                className="text-[11px] text-[#8a5353] hover:text-red-700 underline text-center cursor-pointer mt-1"
              >
                Remove Friend
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={handleAdd}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#2f9a4f] to-[#1c6a35] hover:from-[#35ad59] hover:to-[#227b3e] text-white font-black text-sm rounded-2xl shadow-lg border-b-3 border-[#155229] transition-transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Friend</span>
          </button>
        )}
      </div>
    </div>
  );
};
