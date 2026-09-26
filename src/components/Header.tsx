import React from 'react';
import { Menu, ArrowLeft } from 'lucide-react';
import { UserAccount } from '../types/game';
import { triggerButtonHaptic } from '../lib/haptics';

interface HeaderProps {
  user: UserAccount;
  coins: number;
  currentScreen?: string;
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  coins,
  currentScreen,
  onOpenMenu,
  onOpenProfile,
  onBack,
}) => {
  const showBackButton = !!onBack && currentScreen !== 'mainmenu';

  return (
    <header className="sticky top-0 z-40 w-full px-2 sm:px-3 pt-2 pb-1 select-none pointer-events-auto">
      <div className="w-full mx-auto bg-[#141414] text-white rounded-2xl p-2 px-3 sm:px-4 shadow-xl border border-white/10 flex items-center justify-between">
        {/* Left: User Profile Icon & Details */}
        <button
          id="header-user-bar"
          onClick={() => {
            triggerButtonHaptic();
            onOpenProfile();
          }}
          className="flex items-center gap-3 group text-left cursor-pointer transition-transform active:scale-98"
          title="Profile & Customization: Volume, Dice, Backgrounds, Avatars"
        >
          {/* Avatar Icon */}
          <div
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-[#f2c14e] shadow-md flex items-center justify-center font-bold text-sm text-white overflow-hidden bg-[#e58a1f] shrink-0 group-hover:ring-2 group-hover:ring-[#f2c14e]/50 transition-all"
            style={{
              backgroundImage: user.avatar.image ? `url(${user.avatar.image})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: user.avatar.color,
            }}
          >
            {!user.avatar.image && (user.name.slice(0, 2).toUpperCase() || 'P1')}
          </div>

          {/* User Name + Coins Below */}
          <div id="header-user-coins" className="flex flex-col leading-tight">
            <span className="text-white font-black text-sm sm:text-base uppercase tracking-wide truncate max-w-[120px] sm:max-w-[180px] group-hover:text-[#f2c14e] transition-colors">
              {user.name}
            </span>
            <span className="text-xs font-bold text-[#f2c14e] flex items-center gap-1 font-mono">
              <span>🪙</span>
              <span>{coins.toLocaleString()}</span>
            </span>
          </div>
        </button>

        {/* Right: Actions (Back button if applicable + Cheeseburger Menu) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {showBackButton && (
            <button
              onClick={() => {
                triggerButtonHaptic();
                onBack();
              }}
              className="w-8 h-8 rounded-xl bg-[#262626] hover:bg-[#333333] active:scale-95 text-white flex items-center justify-center transition-all border border-white/10 shadow-xs cursor-pointer"
              title="Go Back"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {/* Cheeseburger Menu Button */}
          <button
            onClick={() => {
              triggerButtonHaptic();
              onOpenMenu();
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#262626] hover:bg-[#333333] active:scale-95 text-white flex items-center justify-center transition-all border border-white/10 shadow-xs cursor-pointer"
            title="Menu: Leave game, Shop, Settings"
            aria-label="Open cheeseburger menu"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
