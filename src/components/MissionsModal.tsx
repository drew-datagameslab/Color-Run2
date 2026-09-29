import React, { useState, useEffect } from 'react';
import { X, Clock, Trophy, Flame, CheckCircle2, Target } from 'lucide-react';
import { MissionGoal, MissionsData, getUnclaimedMissionsCount } from '../lib/missions';

interface MissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionsData: MissionsData;
  initialTab?: 'daily' | 'weekly';
  onClaim: (mission: MissionGoal, buttonRect: DOMRect) => void;
  coins: number;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  isOpen,
  onClose,
  missionsData,
  initialTab = 'daily',
  onClaim,
  coins,
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const { dailyUnclaimed, weeklyUnclaimed } = getUnclaimedMissionsCount(missionsData);
  const missions = activeTab === 'daily' ? missionsData.dailyMissions : missionsData.weeklyMissions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs select-none animate-fade-in">
      <div className="w-full max-w-md bg-[#faf4e6] border-2 border-[#c9b877] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="bg-[#181818] text-white p-3 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 border border-[#f2c14e] flex items-center justify-center text-white shadow-sm">
              <Target className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xs sm:text-sm uppercase tracking-wider text-white">
                Missions &amp; Achievements
              </span>
              <span className="text-[10px] text-[#f2c14e] font-mono font-bold flex items-center gap-1">
                <span>🪙</span>
                <span>{coins.toLocaleString()} Coins</span>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-stone-300 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Daily Missions / Weekly Missions */}
        <div className="p-3 pb-2 shrink-0 bg-[#f4ecdb] border-b border-[#ebdcb9]">
          <div className="grid grid-cols-2 gap-2 bg-[#ebdcb9]/80 p-1 rounded-xl">
            {/* Daily Missions Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className={`relative py-2 px-3 text-xs sm:text-sm font-black rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'daily'
                  ? 'bg-[#1c6a35] text-white shadow-sm scale-101'
                  : 'text-[#5c442d] hover:bg-white/40'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Daily Missions</span>
              {dailyUnclaimed > 0 && (
                <span className="relative flex h-2.5 w-2.5 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 border border-white"></span>
                </span>
              )}
            </button>

            {/* Weekly Missions Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('weekly')}
              className={`relative py-2 px-3 text-xs sm:text-sm font-black rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'weekly'
                  ? 'bg-[#1c6a35] text-white shadow-sm scale-101'
                  : 'text-[#5c442d] hover:bg-white/40'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>Weekly Missions</span>
              {weeklyUnclaimed > 0 && (
                <span className="relative flex h-2.5 w-2.5 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 border border-white"></span>
                </span>
              )}
            </button>
          </div>

          {/* Subheader info: Reset timer / Streak */}
          <div className="flex items-center justify-between px-1 mt-2 text-[11px] text-[#6d5138] font-bold">
            {activeTab === 'daily' ? (
              <>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#8c6b4f]" />
                  <span>Resets daily at midnight</span>
                </span>
                <span className="text-[#1c6a35] font-black">
                  {missionsData.dailyMissions.filter(m => m.completed).length} / {missionsData.dailyMissions.length} Completed
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    Streak: <strong className="text-amber-800 font-black">{missionsData.streakDays} Day{missionsData.streakDays === 1 ? '' : 's'}</strong>
                  </span>
                </span>
                <span className="text-[#1c6a35] font-black">
                  {missionsData.weeklyMissions.filter(m => m.completed).length} / {missionsData.weeklyMissions.length} Completed
                </span>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Missions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
          {missions.map(mission => {
            const isComplete = mission.completed;
            const isClaimed = mission.claimed;
            const progressPct = Math.min(100, Math.round((mission.current / mission.target) * 100));

            return (
              <div
                key={mission.id}
                className={`p-3 rounded-2xl border transition-all ${
                  isClaimed
                    ? 'bg-black/5 border-black/10 opacity-75'
                    : isComplete
                    ? 'bg-amber-50/95 border-amber-300 shadow-sm'
                    : 'bg-white/90 border-[#ebdcb9] shadow-xs'
                }`}
              >
                {/* Header: Icon, Title, Description, Reward */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl select-none leading-none mt-0.5">
                      {mission.icon || '🎯'}
                    </span>
                    <div>
                      <h4 className="font-black text-xs sm:text-sm text-[#2b2219] leading-tight">
                        {mission.title}
                      </h4>
                      <p className="text-[11px] sm:text-xs text-[#6d5138] leading-snug mt-0.5">
                        {mission.description}
                      </p>
                    </div>
                  </div>

                  {/* Reward Badge */}
                  <div className="shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/50 text-[11px] font-mono font-black text-[#855307]">
                    <span>🪙</span>
                    <span>+{mission.rewardCoins}</span>
                  </div>
                </div>

                {/* Sub-goals if present (e.g. 2P, 4P, 6P requirements) */}
                {mission.subGoals && mission.subGoals.length > 0 && (
                  <div className="flex items-center gap-1.5 my-1.5 pl-7">
                    {mission.subGoals.map(sg => (
                      <span
                        key={sg.id}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                          sg.completed
                            ? 'bg-emerald-600/15 border-emerald-500 text-emerald-800'
                            : 'bg-black/5 border-black/10 text-stone-600'
                        }`}
                      >
                        <span>{sg.label}</span>
                        {sg.completed && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />}
                      </span>
                    ))}
                  </div>
                )}

                {/* Progress & Action Row */}
                <div className="flex items-center justify-between gap-3 mt-2 pl-7">
                  {/* Progress Bar & Counter */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#6d5138] mb-1">
                      <span>Progress</span>
                      <span>
                        {mission.current} / {mission.target}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#ded0b2] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isComplete
                            ? 'bg-gradient-to-r from-emerald-500 to-[#1c6a35]'
                            : 'bg-gradient-to-r from-amber-500 to-[#e58a1f]'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Claim Button / Status Action */}
                  <div className="shrink-0">
                    {isClaimed ? (
                      <div className="px-2.5 py-1 bg-emerald-600/15 text-emerald-800 font-bold text-[11px] rounded-xl border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Claimed</span>
                      </div>
                    ) : isComplete ? (
                      /* Orange rounded rectangle with CLAIM! inside */
                      <button
                        type="button"
                        onClick={e => onClaim(mission, e.currentTarget.getBoundingClientRect())}
                        className="px-4 py-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md border border-amber-300 transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-1 animate-pulse"
                        title={`Claim ${mission.rewardCoins} coins!`}
                      >
                        <span>CLAIM!</span>
                      </button>
                    ) : (
                      <div className="text-[10px] font-bold text-[#8c745e] px-2.5 py-1 bg-black/5 rounded-xl border border-black/5">
                        In Progress
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#f4ecdb] border-t border-[#ebdcb9] flex items-center justify-between shrink-0 text-xs">
          <span className="text-[11px] text-[#7d654c] font-medium">
            Complete daily &amp; weekly goals to earn free bonus coins!
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-[#eae0c5] hover:bg-[#ded1af] text-[#4a3622] font-black rounded-xl border border-[#c4b38d] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
