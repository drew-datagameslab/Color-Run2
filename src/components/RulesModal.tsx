import React, { useState } from 'react';
import { X, BookOpen, Trophy, Sparkles, Award, Shield, CheckCircle2, AlertTriangle, Crown, Target } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'rules' | 'levels';
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose, initialTab = 'rules' }) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'levels'>(initialTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg max-h-[88vh] flex flex-col bg-[#faf4e6] border-2 border-[#c9b877] rounded-2xl shadow-2xl text-[#2b2219] overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 pb-3 border-b border-[#ebdcb9] relative bg-[#f3ecda]/70">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full hover:bg-black/10 transition-colors text-[#5c4937]"
            aria-label="Close rules"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-xl sm:text-2xl font-black text-[#1c6a35] text-center tracking-tight">
            How to Play &amp; Rules
          </h2>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-2 gap-2 mt-3 bg-[#ebdcb9]/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('rules')}
              className={`py-2 px-3 text-xs sm:text-sm font-black rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'rules'
                  ? 'bg-[#1c6a35] text-white shadow-sm'
                  : 'text-[#5c442d] hover:bg-white/40'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Game Rules</span>
            </button>

            <button
              onClick={() => setActiveTab('levels')}
              className={`py-2 px-3 text-xs sm:text-sm font-black rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'levels'
                  ? 'bg-[#1c6a35] text-white shadow-sm'
                  : 'text-[#5c442d] hover:bg-white/40'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>Levels &amp; XP Guide</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm leading-relaxed">
          {activeTab === 'rules' ? (
            <>
              <section className="bg-white/80 rounded-xl p-3.5 border border-[#ebdcb9] shadow-xs">
                <h3 className="font-extrabold text-base text-[#8e2825] mb-1 flex items-center gap-1.5">
                  <span>🎯</span> Goal &amp; Threshold
                </h3>
                <p className="text-xs sm:text-sm text-[#443526]">
                  Score points by collecting matching sets of dice. When someone reaches the threshold (e.g. <b>250 points</b>), elimination rounds trigger. The lowest cumulative total is knocked out each round until the last player standing wins!
                </p>
              </section>

              <section className="bg-white/80 rounded-xl p-3.5 border border-[#ebdcb9] shadow-xs">
                <h3 className="font-extrabold text-base text-[#1f7fd6] mb-1 flex items-center gap-1.5">
                  <span>🎲</span> Your Turn — 3 Rolls
                </h3>
                <p className="mb-2 text-xs sm:text-sm text-[#443526]">
                  Tap <b>ROLL</b> to throw 12 dice (6 in one color, 6 in another). Tap matching dice to save a set of the same symbol — a set needs <b>3 or more</b> matching dice.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-[#523d2a]">
                  <li>Once 3 matching dice are tapped, they jump to <b>Saved Dice</b>.</li>
                  <li>Saved dice are locked in safely; tap <b>ROLL</b> to re-roll the remaining active dice.</li>
                  <li>Colors do not matter for a basic set (e.g. 2 red spades + 1 blue spade = 3 spades).</li>
                  <li>Once a set exists, any additional matching dice add straight to it!</li>
                  <li>Tap any saved die to pull it back and gamble for a bigger set.</li>
                  <li>You get up to 3 rolls, then tap <b>SCORE IT!</b> to bank your points.</li>
                </ul>
              </section>

              <section className="bg-white/80 rounded-xl p-3.5 border border-[#ebdcb9] shadow-xs">
                <h3 className="font-extrabold text-base text-[#2f9a4f] mb-1 flex items-center gap-1.5">
                  <span>⭐</span> Scoring &amp; Per-Color Bonuses
                </h3>
                <p className="mb-2 text-xs sm:text-sm text-[#443526]">
                  <b>5 points per die</b> in every saved set of 3+. Plus, huge same-color bonuses when 3 or more dice in that set share the exact same color:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono font-bold mb-2">
                  <div className="bg-[#2f9a4f]/10 p-2 rounded-lg border border-[#2f9a4f]/30">
                    <div className="text-[11px] text-[#2b2219]">3 Same Color</div>
                    <div className="text-sm text-[#1c6a35] font-black">+10 pts</div>
                  </div>
                  <div className="bg-[#2f9a4f]/10 p-2 rounded-lg border border-[#2f9a4f]/30">
                    <div className="text-[11px] text-[#2b2219]">4 Same Color</div>
                    <div className="text-sm text-[#1c6a35] font-black">+25 pts</div>
                  </div>
                  <div className="bg-[#2f9a4f]/10 p-2 rounded-lg border border-[#2f9a4f]/30">
                    <div className="text-[11px] text-[#2b2219]">5 Same Color</div>
                    <div className="text-sm text-[#1c6a35] font-black">+40 pts</div>
                  </div>
                  <div className="bg-[#2f9a4f]/10 p-2 rounded-lg border border-[#2f9a4f]/30">
                    <div className="text-[11px] text-[#2b2219]">6 Same Color</div>
                    <div className="text-sm text-[#1c6a35] font-black">+100 pts</div>
                  </div>
                </div>
                <p className="text-xs text-[#523d2a] bg-[#faf4e6] p-2 rounded-lg border border-[#ebdcb9]">
                  <b>Independent Summed Rule:</b> Each color scores its own bonus independently, and both are summed!
                  <br />
                  • 3 blue + 3 red = <b>50 points</b> (30 base + 10 + 10)
                  <br />
                  • 4 blue + 3 red = <b>70 points</b> (35 base + 25 + 10)
                </p>
              </section>

              <section className="bg-white/80 rounded-xl p-3.5 border border-[#ebdcb9] shadow-xs">
                <h3 className="font-extrabold text-base text-[#e58a1f] mb-1 flex items-center gap-1.5">
                  <span>⚔️</span> Elimination Rounds
                </h3>
                <p className="text-xs sm:text-sm text-[#443526]">
                  After any player reaches the threshold, everyone plays one final equalizing round. Then, the lowest cumulative total is eliminated. Ties for last are decided by a 12-dice roll-off! Survived elimination rounds earn bonus coins and XP.
                </p>
              </section>
            </>
          ) : (
            /* Levels & XP Tab */
            <>
              {/* Introduction Card */}
              <section className="bg-gradient-to-r from-[#1c6a35]/10 via-[#2f9a4f]/10 to-[#e58a1f]/10 rounded-xl p-3.5 border border-[#c9b877] shadow-xs">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-1.5 bg-[#1c6a35] text-white rounded-lg">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-[#1c6a35] leading-tight">
                      Player Levels &amp; Prestige
                    </h3>
                    <p className="text-[11px] text-[#6b533d] font-semibold">
                      Climb from Level 1 to 50 to unlock exclusive dice skins, themes, and Ranked Mode!
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#443526] mt-2">
                  Every game you play awards Experience Points (XP). Level up to earn free cosmetic items, coin bonuses, custom name colors, and prestigious titles!
                </p>
              </section>

              {/* How to Earn XP Section */}
              <section className="bg-white/80 rounded-xl p-3.5 border border-[#ebdcb9] shadow-xs">
                <h3 className="font-extrabold text-base text-[#8e2825] mb-2 flex items-center gap-1.5">
                  <span>⚡</span> How to Earn XP
                </h3>
                <p className="text-xs text-[#523d2a] mb-2.5">
                  XP is earned at the end of each game based on your gameplay performance:
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9]">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏁</span>
                      <div>
                        <div className="font-bold text-[#2b2219]">Finish a Match</div>
                        <div className="text-[10px] text-[#705844]">Play through the game to completion</div>
                      </div>
                    </div>
                    <span className="font-mono font-black text-[#1c6a35] text-sm bg-[#1c6a35]/10 px-2 py-0.5 rounded">
                      +20 XP
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9]">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#1f7fd6]" />
                      <div>
                        <div className="font-bold text-[#2b2219]">Survive Elimination Rounds</div>
                        <div className="text-[10px] text-[#705844]">+5 XP per each round you survive</div>
                      </div>
                    </div>
                    <span className="font-mono font-black text-[#1f7fd6] text-sm bg-[#1f7fd6]/10 px-2 py-0.5 rounded">
                      +5 XP/round
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9]">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-500" />
                      <div>
                        <div className="font-bold text-[#2b2219]">Victory Placement</div>
                        <div className="text-[10px] text-[#705844]">1st Place: +30 XP • 2nd: +20 XP • 3rd: +10 XP</div>
                      </div>
                    </div>
                    <span className="font-mono font-black text-amber-600 text-sm bg-amber-500/10 px-2 py-0.5 rounded">
                      Up to +30 XP
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9]">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎨</span>
                      <div>
                        <div className="font-bold text-[#2b2219]">Color Bonus Points</div>
                        <div className="text-[10px] text-[#705844]">Earn 1 XP per 10 color bonus points scored</div>
                      </div>
                    </div>
                    <span className="font-mono font-black text-[#2f9a4f] text-sm bg-[#2f9a4f]/10 px-2 py-0.5 rounded">
                      Up to +20 XP
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/80 border border-amber-200">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌟</span>
                      <div>
                        <div className="font-bold text-amber-900">First Win of the Day</div>
                        <div className="text-[10px] text-amber-700">Bonus on your first 1st-place victory each day</div>
                      </div>
                    </div>
                    <span className="font-mono font-black text-amber-700 text-sm bg-amber-500/15 px-2 py-0.5 rounded">
                      +50 XP
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50/80 border border-purple-200">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-purple-600" />
                      <div>
                        <div className="font-bold text-purple-950">Daily &amp; Weekly Missions</div>
                        <div className="text-[10px] text-purple-700">Claim from your Profile Level &amp; Missions tab</div>
                      </div>
                    </div>
                    <span className="font-mono font-black text-purple-700 text-sm bg-purple-500/15 px-2 py-0.5 rounded">
                      +50 to +200 XP
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-1.5 p-2 rounded-lg bg-amber-100/70 border border-amber-300 text-[11px] text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <b>Fair Play Notice:</b> Quitting or abandoning matches early yields <b>0 XP</b> and 0 coins. Play to completion or use "Speed to finish" if eliminated!
                  </span>
                </div>
              </section>

              {/* Level Milestones & Unlock Road */}
              <section className="bg-white/80 rounded-xl p-3.5 border border-[#ebdcb9] shadow-xs">
                <h3 className="font-extrabold text-base text-[#1f7fd6] mb-2 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[#1f7fd6]" />
                  <span>Road to Level 50 Milestones</span>
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-blue-50/90 border border-blue-200 flex items-start gap-2.5">
                    <div className="bg-blue-600 text-white font-black text-xs px-2 py-1 rounded-md shrink-0">
                      Lv. 10
                    </div>
                    <div>
                      <div className="font-black text-blue-950 text-xs">🏆 RANKED MATCHMAKING UNLOCKED</div>
                      <p className="text-[11px] text-blue-800 mt-0.5">
                        Compete in verified matchmaking against higher-skilled players with strict level filters.
                      </p>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1c6a35]">Lv. 2–4</span>
                      <span className="text-[#523d2a]">Free Dice Skins (Golden Ember, Emerald, Frozen Frost)</span>
                    </div>
                    <span className="text-base">🎲</span>
                  </div>

                  <div className="p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1c6a35]">Lv. 5</span>
                      <span className="text-[#523d2a]">Custom Player Name Colors unlocked</span>
                    </div>
                    <span className="text-base">🎨</span>
                  </div>

                  <div className="p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1c6a35]">Lv. 15</span>
                      <span className="text-[#523d2a]">Cyber Neon Dice Skin</span>
                    </div>
                    <span className="text-base">🟣</span>
                  </div>

                  <div className="p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1c6a35]">Lv. 20</span>
                      <span className="text-[#523d2a]">Retro Synthwave Board Theme</span>
                    </div>
                    <span className="text-base">🌆</span>
                  </div>

                  <div className="p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1c6a35]">Lv. 25</span>
                      <span className="text-[#523d2a]">Custom Profile Banners &amp; Exclusive Titles</span>
                    </div>
                    <span className="text-base">👑</span>
                  </div>

                  <div className="p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1c6a35]">Lv. 30–45</span>
                      <span className="text-[#523d2a]">Imperial Palace Theme, Midnight Dice, Electric Trail</span>
                    </div>
                    <span className="text-base">⚡</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-300 flex items-start gap-2.5">
                    <div className="bg-amber-500 text-white font-black text-xs px-2 py-1 rounded-md shrink-0">
                      Lv. 50
                    </div>
                    <div>
                      <div className="font-black text-amber-950 text-xs">🌈 Animated Prismatic Dice &amp; Prestige Access</div>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Color-shifting animated dice skin + access to Prestige rank reset with permanent ⭐ badge.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Prestige System Explanation */}
              <section className="bg-white/80 rounded-xl p-3.5 border border-[#ebdcb9] shadow-xs">
                <h3 className="font-extrabold text-base text-[#2f9a4f] mb-1.5 flex items-center gap-1.5">
                  <span>⭐</span> The Prestige System
                </h3>
                <p className="text-xs sm:text-sm text-[#443526] mb-2">
                  Once you reach <b>Level 50</b>, you have proved your mastery! You can activate <b>Prestige</b> from your Profile:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9] flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1c6a35] shrink-0 mt-0.5" />
                    <span><b>Keep Everything:</b> All unlocked dice, themes, colors, and titles remain yours forever.</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9] flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1c6a35] shrink-0 mt-0.5" />
                    <span><b>Prestige Star Badge:</b> Your avatar displays a permanent star icon (e.g. ⭐ Lv. 1).</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9] flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1c6a35] shrink-0 mt-0.5" />
                    <span><b>Glowing Avatar Ring:</b> Enjoy a radiant golden prestige border across all games.</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#faf4e6] border border-[#ebdcb9] flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1c6a35] shrink-0 mt-0.5" />
                    <span><b>Earn Coin Rewards Again:</b> Re-earn milestone coin payouts as you climb again!</span>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-3 border-t border-[#ebdcb9] bg-[#f3ecda]/70 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-[10px] text-[#7d654c] font-medium">
            Color Run • Version 6.2.4
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-bold text-sm rounded-xl shadow-md transition-transform active:scale-98 cursor-pointer"
          >
            {activeTab === 'rules' ? "Got it, let's roll!" : "Back to Game"}
          </button>
        </div>
      </div>
    </div>
  );
};
