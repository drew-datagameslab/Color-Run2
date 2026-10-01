import React from 'react';
import { Play, Store, ClipboardList, BookOpen, Trophy, Clock } from 'lucide-react';
import { ColorRunLogo, DGLogo } from './Logo';
import { MissionsData, getUnclaimedMissionsCount } from '../lib/missions';

interface MainMenuScreenProps {
  missionsData: MissionsData;
  onOpenMissions: (tab: 'daily' | 'weekly') => void;
  onPlay: () => void;
  onOpenShop: () => void;
  onOpenScoreboard: () => void;
  onOpenRules: () => void;
  onOpenTournament: () => void;
}

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  missionsData,
  onOpenMissions,
  onPlay,
  onOpenShop,
  onOpenScoreboard,
  onOpenRules,
  onOpenTournament,
}) => {
  const { dailyUnclaimed, weeklyUnclaimed } = getUnclaimedMissionsCount(missionsData);

  return (
    <div className="w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto flex flex-col items-center justify-start p-2 sm:p-3 overflow-y-auto max-h-[calc(100dvh-5.2rem)] custom-scrollbar select-none">
      {/* Main Menu Action Card */}
      <div className="w-full bg-[#faf4e6]/95 border-2 border-[#c9b877] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col items-center">
        {/* Color Run Logo */}
        <ColorRunLogo size="xl" className="mb-2" />
        <div className="text-[10px] sm:text-xs font-black tracking-widest text-[#6d5138] uppercase mb-2.5 sm:mb-3 text-center">
          ROLL - MATCH - SURVIVE.
        </div>

        {/* Menu Buttons */}
        <div className="w-full flex flex-col gap-2 sm:gap-2.5">
          {/* Play Button */}
          <button
            onClick={onPlay}
            className="w-full py-2.5 sm:py-3.5 px-4 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-black text-base sm:text-lg rounded-xl sm:rounded-2xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 border-b-4 border-[#1b6b33] cursor-pointer"
          >
            <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
            <span>PLAY GAME</span>
          </button>

          {/* Shop */}
          <button
            onClick={onOpenShop}
            className="w-full py-2 sm:py-2.5 px-3.5 bg-[#e58a1f] hover:bg-[#cb7512] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 border-b-3 border-[#ab620e] cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span>Shop &amp; Customization</span>
          </button>

          {/* Scoreboard */}
          <button
            onClick={onOpenScoreboard}
            className="w-full py-2 sm:py-2.5 px-3.5 bg-[#1f7fd6] hover:bg-[#186abb] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 border-b-3 border-[#125496] cursor-pointer"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Companion Scoreboard</span>
          </button>

          {/* Rules */}
          <button
            onClick={onOpenRules}
            className="w-full py-1.5 sm:py-2 px-3.5 bg-[#eae0c5] hover:bg-[#ded1af] text-[#4a3622] font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>How to Play &amp; Rules</span>
          </button>

          {/* Tournament Mode (Coming Soon) */}
          <button
            id="tournament-play-button"
            onClick={onOpenTournament}
            className="relative w-full py-1.5 px-3 bg-[#2b241c]/10 hover:bg-[#2b241c]/15 text-[#5e4b37] font-semibold text-[11px] sm:text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Tournament Play</span>
            <span className="text-[9px] font-black uppercase tracking-wider bg-[#d64545] text-white px-1.5 py-0.2 rounded-full ml-1">
              Soon
            </span>
          </button>

          {/* Daily & Weekly Mission Buttons (Placed under Tournament Play) */}
          <div className="grid grid-cols-2 gap-2 mt-0.5">
            {/* Daily Missions Button */}
            <button
              id="daily-missions-button"
              type="button"
              onClick={() => onOpenMissions('daily')}
              className="relative py-2 sm:py-2.5 px-2.5 bg-[#f5eddb] hover:bg-[#ebdcb9] text-[#3e2e1e] font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-98 flex items-center justify-center gap-1.5 border border-[#d6c59d] cursor-pointer"
            >
              <Clock className="w-4 h-4 text-[#1c6a35] shrink-0" />
              <span className="truncate">Daily Missions</span>
              {dailyUnclaimed > 0 && (
                <span className="relative flex h-2.5 w-2.5 shrink-0 ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 border border-white"></span>
                </span>
              )}
            </button>

            {/* Weekly Missions Button */}
            <button
              id="weekly-missions-button"
              type="button"
              onClick={() => onOpenMissions('weekly')}
              className="relative py-2 sm:py-2.5 px-2.5 bg-[#f5eddb] hover:bg-[#ebdcb9] text-[#3e2e1e] font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all active:scale-98 flex items-center justify-center gap-1.5 border border-[#d6c59d] cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">Weekly Missions</span>
              {weeklyUnclaimed > 0 && (
                <span className="relative flex h-2.5 w-2.5 shrink-0 ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 border border-white"></span>
                </span>
              )}
            </button>
          </div>

          {/* App Version */}
          <div id="app-version-display" className="text-center text-[8.5px] sm:text-[9.5px] font-medium text-[#7d654c] tracking-wider pt-0.5 select-text">
            Version 6.2.6
          </div>
        </div>
      </div>

      {/* Data Games Lab Logo */}
      <DGLogo className="mt-3 mb-2" size="menu" textColor="text-white" />
    </div>
  );
};
