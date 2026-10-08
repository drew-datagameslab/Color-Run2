import React, { useState } from 'react';
import { GameInvite } from '../lib/invites';
import { Swords, X, Check, Clock, AlertTriangle } from 'lucide-react';

interface GameInviteOverlayProps {
  invite: GameInvite | null;
  isInActiveGame: boolean;
  onAcceptAndJoin: (invite: GameInvite) => void;
  onJoinWhenDone: (invite: GameInvite) => void;
  onDismiss: (invite: GameInvite) => void;
}

export const GameInviteOverlay: React.FC<GameInviteOverlayProps> = ({
  invite,
  isInActiveGame,
  onAcceptAndJoin,
  onJoinWhenDone,
  onDismiss,
}) => {
  const [showInGamePrompt, setShowInGamePrompt] = useState(false);

  if (!invite) return null;

  const handleJoinClick = () => {
    if (isInActiveGame) {
      setShowInGamePrompt(true);
    } else {
      onAcceptAndJoin(invite);
    }
  };

  const handleJoinNow = () => {
    setShowInGamePrompt(false);
    onAcceptAndJoin(invite);
  };

  const handleWillJoinWhenDone = () => {
    setShowInGamePrompt(false);
    onJoinWhenDone(invite);
  };

  const handleDismiss = () => {
    setShowInGamePrompt(false);
    onDismiss(invite);
  };

  return (
    <>
      {/* Top of screen message overlay banner */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-md animate-slide-down select-none">
        <div className="bg-[#241a10]/95 backdrop-blur-md border-2 border-[#e58a1f] rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-2.5 text-white">
          {/* Host Avatar / Icon */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#e58a1f] to-[#b3630a] text-white flex items-center justify-center shrink-0 shadow-md">
            <Swords className="w-5 h-5" />
          </div>

          {/* Invitation Text */}
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-black text-[#faf4e6] leading-tight">
              You are invited to <span className="text-[#f2c14e] font-extrabold">{invite.hostName}</span> {invite.buyIn} coins challenge game.
            </div>
            <div className="text-[10px] text-[#c9b877] mt-0.5 font-medium flex items-center gap-1">
              <span>🪙 Wager: {invite.buyIn > 0 ? `${invite.buyIn} Coins` : 'Casual Free'}</span>
            </div>
          </div>

          {/* Action Buttons: Join and Dismiss */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleJoinClick}
              className="px-3 py-1.5 bg-gradient-to-b from-[#208b3a] to-[#146026] hover:from-[#25a244] hover:to-[#17722d] text-white text-xs font-black rounded-xl shadow-md border-b-2 border-[#0e441b] active:scale-95 transition-all cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Join</span>
            </button>
            <button
              onClick={handleDismiss}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-[#d8c8a7] hover:text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      </div>

      {/* Second Prompt Modal if user is actively in a game */}
      {showInGamePrompt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in select-none">
          <div className="w-full max-w-sm bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl p-5 shadow-2xl flex flex-col items-center animate-scale-up text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md mb-2">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-[#4a3622] mb-1">
              Active Game In Progress
            </h3>

            <p className="text-xs text-[#6e533c] mb-4 font-medium px-2">
              You are currently rolling in an active game! Would you like to leave now to join{' '}
              <span className="font-bold text-[#e58a1f]">{invite.hostName}</span>, or finish your current game first?
            </p>

            <div className="w-full flex flex-col gap-2">
              {/* Button 1: Join Now */}
              <button
                onClick={handleJoinNow}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-[#e5352f] to-[#b3201b] hover:from-[#f3433d] hover:to-[#c42520] text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Join Now</span>
                <span className="text-[10px] opacity-80">(Leave current match)</span>
              </button>

              {/* Button 2: Will Join When Done w/ this Game */}
              <button
                onClick={handleWillJoinWhenDone}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-[#1f7fd6] to-[#1664ab] hover:from-[#2a8eeb] hover:to-[#1a6ec0] text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Will Join When Done w/ this Game</span>
              </button>

              {/* Button 3: Cancel / Dismiss */}
              <button
                onClick={() => setShowInGamePrompt(false)}
                className="mt-1 py-1.5 text-xs font-bold text-[#735c46] hover:text-[#2b170a] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
