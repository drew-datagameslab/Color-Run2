import React from 'react';
import { X } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#faf4e6] border-2 border-[#c9b877] rounded-2xl p-5 sm:p-6 shadow-2xl text-[#2b2219]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/10 transition-colors"
          aria-label="Close rules"
        >
          <X className="w-5 h-5 text-[#5c4937]" />
        </button>

        <h2 className="text-2xl font-black text-[#1c6a35] mb-4 text-center">
          How to Play Color Run
        </h2>

        <div className="space-y-4 text-sm leading-relaxed">
          <section className="bg-white/70 rounded-xl p-3 border border-[#ebdcb9]">
            <h3 className="font-extrabold text-base text-[#8e2825] mb-1">🎯 Goal</h3>
            <p>
              Score points by collecting matching sets of dice. When someone reaches the threshold (e.g. <b>250 points</b>), elimination begins and the lowest total is knocked out each round. Last one standing wins!
            </p>
          </section>

          <section className="bg-white/70 rounded-xl p-3 border border-[#ebdcb9]">
            <h3 className="font-extrabold text-base text-[#1f7fd6] mb-1">🎲 Your Turn — 3 Rolls</h3>
            <p className="mb-2">
              Tap <b>ROLL</b> to throw 12 dice (6 in one color, 6 in another). Tap matching dice to save a set of the same symbol — a set needs <b>3 or more</b>.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Once 3 matching dice are tapped, they jump up to <b>Saved Dice</b>.</li>
              <li>Saved dice are locked in safely; tap <b>ROLL</b> to re-roll the remaining active dice.</li>
              <li>Colors do not matter for a basic set (e.g., 2 red spades + 1 blue spade = 3 spades).</li>
              <li>Once a set exists, any additional matching dice add straight to it!</li>
              <li>Tap a saved die to pull it back and gamble for a bigger set.</li>
              <li>You get up to 3 rolls, then tap <b>SCORE IT!</b> to bank your points.</li>
            </ul>
          </section>

          <section className="bg-white/70 rounded-xl p-3 border border-[#ebdcb9]">
            <h3 className="font-extrabold text-base text-[#2f9a4f] mb-1">⭐ Scoring &amp; Per-Color Bonuses</h3>
            <p className="mb-2">
              <b>5 points per die</b> in every saved set of 3+. Plus, a same-color bonus when 3 or more dice in that set share the exact same color:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono font-bold mb-2">
              <div className="bg-[#2f9a4f]/10 p-2 rounded border border-[#2f9a4f]/30">
                <div>3 Same Color</div>
                <div className="text-sm text-[#1c6a35]">+10 pts</div>
              </div>
              <div className="bg-[#2f9a4f]/10 p-2 rounded border border-[#2f9a4f]/30">
                <div>4 Same Color</div>
                <div className="text-sm text-[#1c6a35]">+25 pts</div>
              </div>
              <div className="bg-[#2f9a4f]/10 p-2 rounded border border-[#2f9a4f]/30">
                <div>5 Same Color</div>
                <div className="text-sm text-[#1c6a35]">+40 pts</div>
              </div>
              <div className="bg-[#2f9a4f]/10 p-2 rounded border border-[#2f9a4f]/30">
                <div>6 Same Color</div>
                <div className="text-sm text-[#1c6a35]">+100 pts</div>
              </div>
            </div>
            <p className="text-xs text-[#523d2a]">
              <b>Confirmed Summed Rule:</b> Each color scores its own bonus independently, and the bonuses are summed!
              <br />
              • 3 blue + 3 red 2s = <b>50 points</b> (30 base + 10 + 10)
              <br />
              • 4 blue + 3 red 2s = <b>70 points</b> (35 base + 25 + 10)
            </p>
          </section>

          <section className="bg-white/70 rounded-xl p-3 border border-[#ebdcb9]">
            <h3 className="font-extrabold text-base text-[#e58a1f] mb-1">⚔️ Elimination Rounds</h3>
            <p className="text-xs">
              After a player reaches the threshold, everyone plays one more full round, then the lowest cumulative total is eliminated. Ties for last are broken by a 12-dice roll-off! If more than six players started, two are knocked out per round.
            </p>
          </section>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 bg-[#2f9a4f] hover:bg-[#268a48] text-white font-bold rounded-xl shadow-md transition-transform active:scale-98"
        >
          Got it, let's roll!
        </button>
      </div>
    </div>
  );
};
