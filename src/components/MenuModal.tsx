import React from 'react';
import {
  X,
  LogOut,
  Store,
  Home,
  User,
  BookOpen,
  ClipboardList,
  Volume2,
  VolumeX,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { UserAccount, ShopSettings } from '../types/game';
import { getSoundVolume, setSoundVolume } from '../lib/audio';

interface MenuModalProps {
  isOpen: boolean;
  user: UserAccount;
  coins: number;
  currentScreen: string;
  shopSettings: ShopSettings;
  onClose: () => void;
  onLeaveGame: () => void;
  onGoToShop: () => void;
  onGoToMainMenu: () => void;
  onOpenProfile: () => void;
  onOpenRules: () => void;
  onOpenScoreboard: () => void;
  onLogOut?: () => void;
  onUpdateShop: (shop: ShopSettings) => void;
  onToast: (msg: string) => void;
}

export const MenuModal: React.FC<MenuModalProps> = ({
  isOpen,
  user,
  coins,
  currentScreen,
  shopSettings,
  onClose,
  onLeaveGame,
  onGoToShop,
  onGoToMainMenu,
  onOpenProfile,
  onOpenRules,
  onOpenScoreboard,
  onLogOut,
  onUpdateShop,
  onToast,
}) => {
  if (!isOpen) return null;

  const isPlaying = currentScreen === 'play';
  const volPct = Math.round((getSoundVolume() / 0.7) * 100);

  const handleVolumeChange = (newPct: number) => {
    setSoundVolume(newPct);
    onUpdateShop({
      ...shopSettings,
      volume: newPct,
    });
  };

  const handleLeaveGameClick = () => {
    onClose();
    onLeaveGame();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-2 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-xs bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl shadow-2xl overflow-hidden flex flex-col mt-2 animate-fade-in">
        {/* Menu Header with User Info */}
        <div className="bg-[#181818] text-white p-3 px-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-full border-2 border-[#f2c14e] flex items-center justify-center font-bold text-xs text-white overflow-hidden bg-[#e58a1f]"
              style={{
                backgroundImage: user.avatar.image ? `url(${user.avatar.image})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: user.avatar.color,
              }}
            >
              {!user.avatar.image && (user.name.slice(0, 2).toUpperCase() || 'P1')}
            </div>
            <div className="flex flex-col">
              <span className="text-white font-black text-sm uppercase tracking-wide">
                {user.name}
              </span>
              <span className="text-xs font-mono font-bold text-[#f2c14e] flex items-center gap-1">
                <span>🪙</span>
                <span>{coins.toLocaleString()}</span>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#2a2a2a] hover:bg-[#383838] text-white flex items-center justify-center border border-white/10 cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menu Items List */}
        <div className="p-3 flex flex-col gap-2">
          {/* If currently playing a game: Leave Game button */}
          {isPlaying && (
            <button
              onClick={handleLeaveGameClick}
              className="w-full py-2.5 px-3.5 bg-[#e5352f] hover:bg-[#c9241e] text-white rounded-xl font-black text-xs flex items-center gap-2.5 shadow-md active:scale-98 transition-all cursor-pointer border-b-2 border-[#8c120e]"
            >
              <LogOut className="w-4 h-4" />
              <div className="flex flex-col text-left">
                <span>LEAVE GAME</span>
                <span className="text-[10px] font-normal text-white/90">
                  Return to Main Menu
                </span>
              </div>
            </button>
          )}

          {/* Shop */}
          <button
            onClick={() => {
              onClose();
              onGoToShop();
            }}
            className="w-full py-2.5 px-3.5 bg-[#e58a1f] hover:bg-[#cb7512] text-white rounded-xl font-bold text-xs flex items-center gap-2.5 shadow-xs active:scale-98 transition-all cursor-pointer border-b-2 border-[#ab620e]"
          >
            <Store className="w-4 h-4" />
            <div className="flex flex-col text-left">
              <span>COIN SHOP</span>
              <span className="text-[10px] font-normal text-white/90">
                Get coins &amp; remove ads
              </span>
            </div>
          </button>

          {/* Main Menu (if not already on main menu and not playing) */}
          {!isPlaying && currentScreen !== 'mainmenu' && (
            <button
              onClick={() => {
                onClose();
                onGoToMainMenu();
              }}
              className="w-full py-2 px-3 bg-white hover:bg-[#f5ebd2] text-[#4a3622] rounded-xl font-bold text-xs flex items-center gap-2.5 border border-[#d8c89f] active:scale-98 transition-all cursor-pointer"
            >
              <Home className="w-4 h-4 text-[#1c6a35]" />
              <span>Main Menu</span>
            </button>
          )}

          {/* User Profile & Customization */}
          <button
            onClick={() => {
              onClose();
              onOpenProfile();
            }}
            className="w-full py-2 px-3 bg-white hover:bg-[#f5ebd2] text-[#4a3622] rounded-xl font-bold text-xs flex items-center gap-2.5 border border-[#d8c89f] active:scale-98 transition-all cursor-pointer"
          >
            <User className="w-4 h-4 text-[#2f9a4f]" />
            <div className="flex flex-col text-left">
              <span>Profile &amp; Settings</span>
              <span className="text-[10px] text-[#785b3f] font-normal">
                Volume, dice, backgrounds, avatars
              </span>
            </div>
          </button>

          {/* Rules */}
          <button
            onClick={() => {
              onClose();
              onOpenRules();
            }}
            className="w-full py-2 px-3 bg-white hover:bg-[#f5ebd2] text-[#4a3622] rounded-xl font-bold text-xs flex items-center gap-2.5 border border-[#d8c89f] active:scale-98 transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-[#e58a1f]" />
            <span>How to Play &amp; Rules</span>
          </button>

          {/* Scoreboard */}
          <button
            onClick={() => {
              onClose();
              onOpenScoreboard();
            }}
            className="w-full py-2 px-3 bg-white hover:bg-[#f5ebd2] text-[#4a3622] rounded-xl font-bold text-xs flex items-center gap-2.5 border border-[#d8c89f] active:scale-98 transition-all cursor-pointer"
          >
            <ClipboardList className="w-4 h-4 text-[#1f7fd6]" />
            <span>Companion Scoreboard</span>
          </button>

          {/* Audio Quick Bar */}
          <div className="bg-white/80 p-2.5 rounded-xl border border-[#ebdcb9] flex flex-col gap-1.5 mt-1">
            <div className="flex items-center justify-between text-[11px] font-black text-[#5c442d]">
              <span className="flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Volume</span>
              </span>
              <span className="font-mono text-[#1c6a35]">
                {volPct === 0 ? 'Muted' : `${volPct}%`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volPct}
              onChange={e => handleVolumeChange(parseInt(e.target.value, 10))}
              className="w-full accent-[#1c6a35] h-1.5 bg-[#ebdcb9] rounded-lg cursor-pointer"
            />
          </div>

          {/* Sign Out Button */}
          {onLogOut && (
            <button
              onClick={() => {
                onClose();
                onLogOut();
              }}
              className="w-full py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-stone-300 active:scale-98 transition-all cursor-pointer mt-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out / Switch Account</span>
            </button>
          )}
        </div>

        {/* Footer info */}
        <div className="p-2.5 bg-[#ede3c9] text-center border-t border-[#ebdcb9]">
          <span className="text-[10px] font-bold text-[#7a6047]">
            Color Run™ by Data Games Lab
          </span>
        </div>
      </div>
    </div>
  );
};
