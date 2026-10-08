import React from 'react';
import { FriendRequest } from '../types/game';
import { UserCheck, X } from 'lucide-react';
import { playSfx } from '../lib/audio';

interface FriendRequestBannerProps {
  request: FriendRequest | null;
  onAccept: (request: FriendRequest) => void;
  onDismiss: (request: FriendRequest) => void;
}

export const FriendRequestBanner: React.FC<FriendRequestBannerProps> = ({
  request,
  onAccept,
  onDismiss,
}) => {
  if (!request) return null;

  const handleAccept = () => {
    playSfx('fanfare');
    onAccept(request);
  };

  const handleDismiss = () => {
    playSfx('add');
    onDismiss(request);
  };

  return (
    <div
      id="friend-request-notification-banner"
      className="fixed top-2 sm:top-3 left-1/2 -translate-x-1/2 z-[150] w-[95%] max-w-md animate-slide-down select-none shadow-2xl"
    >
      <div className="bg-[#231a12]/95 backdrop-blur-md border-2 border-[#2f9a4f] rounded-2xl p-2.5 sm:p-3 shadow-2xl flex items-center justify-between gap-2 text-white">
        {/* User Avatar */}
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-xs sm:text-sm text-white shrink-0 shadow-md border-2 border-white/60"
          style={{
            backgroundColor: request.fromColor || '#2f9a4f',
            backgroundImage: request.fromImage ? `url(${request.fromImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!request.fromImage && request.fromName.slice(0, 2).toUpperCase()}
        </div>

        {/* Message Text */}
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-[#faf4e6] leading-tight font-medium">
            <span className="font-black text-[#f2c14e]">{request.fromName}</span> is requesting to be a friend.
          </p>
        </div>

        {/* Action Buttons: Accept & Dismiss */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleAccept}
            className="py-1.5 px-3 bg-[#2f9a4f] hover:bg-[#258241] text-white font-black text-xs rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer flex items-center gap-1"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Accept</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="py-1.5 px-2.5 bg-white/10 hover:bg-white/20 text-[#e6d7ba] border border-white/20 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Dismiss</span>
          </button>
        </div>
      </div>
    </div>
  );
};
