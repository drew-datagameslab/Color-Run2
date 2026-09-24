import React from 'react';
import { Play, Store, ClipboardList, BookOpen, Trophy } from 'lucide-react';
import { ColorRunLogo, DGLogo } from './Logo';

interface MainMenuScreenProps {
  onPlay: () => void;
  onOpenShop: () => void;
  onOpenScoreboard: () => void;
  onOpenRules: () => void;
  onOpenTournament: () => void;
}

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  onPlay,
  onOpenShop,
  onOpenScoreboard,
  onOpenRules,
  onOpenTournament,
}) => {
  return (
    <div className="w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto flex flex-col items-center justify-center p-2 sm:p-3 my-auto select-none">
      <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col items-center">
        {/* Color Run Logo increased by 75% */}
        <ColorRunLogo size="xl" className="mb-2" />
        <div className="text-[10px] sm:text-xs font-black tracking-widest text-[#6d5138] uppercase mb-2.5 sm:mb-3 text-center">
          ROLL - MATCH - SURVIVE.
        </div>

        {/* Menu Buttons */}
        <div className="w-full flex flex-col gap-2 sm:gap-2.5">
          {/* Play Button */}
          <button
            onClick={onPlay}
            className="w-full py-2.5 sm:py-3.5 px-4 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-black text-base sm:text-lg rounded-xl sm:rounded-2xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 border-b-4 border-[#1b6b33]"
          >
            <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
            <span>PLAY GAME</span>
          </button>

          {/* Shop */}
          <button
            onClick={onOpenShop}
            className="w-full py-2 sm:py-2.5 px-3.5 bg-[#e58a1f] hover:bg-[#cb7512] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 border-b-3 border-[#ab620e]"
          >
            <Store className="w-4 h-4" />
            <span>Shop &amp; Customization</span>
          </button>

          {/* Scoreboard */}
          <button
            onClick={onOpenScoreboard}
            className="w-full py-2 sm:py-2.5 px-3.5 bg-[#1f7fd6] hover:bg-[#186abb] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 border-b-3 border-[#125496]"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Companion Scoreboard</span>
          </button>

          {/* Rules */}
          <button
            onClick={onOpenRules}
            className="w-full py-1.5 sm:py-2 px-3.5 bg-[#eae0c5] hover:bg-[#ded1af] text-[#4a3622] font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>How to Play</span>
          </button>

          {/* Tournament Mode (Coming Soon) */}
          <button
            id="tournament-play-button"
            onClick={onOpenTournament}
            className="relative w-full py-1.5 px-3 bg-[#2b241c]/10 hover:bg-[#2b241c]/15 text-[#5e4b37] font-semibold text-[11px] sm:text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Tournament Play</span>
            <span className="text-[9px] font-black uppercase tracking-wider bg-[#d64545] text-white px-1.5 py-0.2 rounded-full ml-1">
              Soon
            </span>
          </button>

          {/* App Version */}
          <div id="app-version-display" className="text-center text-[8.5px] sm:text-[9.5px] font-medium text-[#7d654c] tracking-wider pt-0.5 select-text">
            Version 5.3
          </div>
        </div>
      </div>

      {/* Data Games Lab Logo increased by 100% (double size) */}
      <DGLogo className="mt-3" size="menu" textColor="text-white" />
    </div>
  );
};
