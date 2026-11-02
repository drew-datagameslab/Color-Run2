import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DiceColor, Die } from '../../types/game';
import { scoreDice } from '../../lib/scoring';
import { DIAMOND, SPADE, practiceRollValues } from '../../lib/tutorial';
import { playSfx, playRollDiceSound } from '../../lib/audio';
import { RollArea } from '../RollArea';
import { SavedBoard } from '../SavedBoard';
import { CoachMark } from './CoachMark';
import { preloadDiceImages } from '../DieComponent';

interface TutorialPracticeProps {
  playerName: string;
  diceColors: [DiceColor, DiceColor];
  onFinished: () => void;
  onSkip: () => void;
}

function startingDice(a: DiceColor, b: DiceColor): Die[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    color: i < 6 ? a : b,
    value: (i % 6) + 1,
    zone: 'active' as const,
    selected: false,
    slotIndex: i,
  }));
}

const ROLL_MS = 1100;

/**
 * Tutorial practice turn: the player alone, three scripted rolls (see PRACTICE_ROLLS) with a
 * coach bubble for every step, ending in a Color Run and 180 points.
 */
export const TutorialPractice: React.FC<TutorialPracticeProps> = ({ playerName, diceColors, onFinished, onSkip }) => {
  const [colorA, colorB] = diceColors;
  const [dice, setDice] = useState<Die[]>(() => startingDice(colorA, colorB));
  const [rollsUsed, setRollsUsed] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [banked, setBanked] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const [hint, setHint] = useState('');

  useEffect(() => preloadDiceImages([colorA, colorB]), [colorA, colorB]);

  const saved = dice.filter(d => d.zone === 'saved');
  const active = dice.filter(d => d.zone === 'active');
  const score = useMemo(() => scoreDice(saved), [saved]);
  const savedOf = (v: number) => saved.filter(d => d.value === v).length;
  const activeOf = (v: number) => active.filter(d => d.value === v).length;

  // What the player should do next
  const needToSave = [SPADE, DIAMOND].filter(v => activeOf(v) > 0 && savedOf(v) + activeOf(v) >= 3);
  const step =
    banked !== null
      ? 'done'
      : isRolling
        ? 'rolling'
        : rollsUsed === 0
          ? 'roll1'
          : needToSave.length > 0
            ? 'save'
            : rollsUsed < 3
              ? 'rollNext'
              : 'score';

  const roll = () => {
    if (isRolling || rollsUsed >= 3 || step === 'save' || banked !== null) return;
    const values = practiceRollValues(rollsUsed, active, colorA);
    let slot = 0;
    setDice(prev =>
      prev.map(d => (d.zone === 'active' ? { ...d, value: values.get(d.id) ?? d.value, slotIndex: slot++, selected: false } : d))
    );
    setIsRolling(true);
    setHint('');
    playRollDiceSound();
    setTimeout(() => {
      setIsRolling(false);
      setRollsUsed(r => r + 1);
    }, ROLL_MS);
  };

  const tapDie = (id: number) => {
    if (isRolling || rollsUsed === 0) return;
    const die = dice.find(d => d.id === id);
    if (!die) return;
    if (die.value !== SPADE && die.value !== DIAMOND) {
      setHint(rollsUsed === 1 ? 'Tap a spade ♠ to collect your spades.' : 'Tap a spade ♠ or a diamond ♦.');
      return;
    }
    if (savedOf(die.value) + activeOf(die.value) < 3) return;
    const next = dice.map(d => (d.zone === 'active' && d.value === die.value ? { ...d, zone: 'saved' as const, selected: false } : d));
    setDice(next);
    setHint('');
    playSfx('add');
    // Six of one color and symbol: a Color Run!
    const blueSpades = next.filter(d => d.zone === 'saved' && d.value === SPADE && d.color === colorA).length;
    if (blueSpades >= 6 && !celebrated) {
      setCelebrated(true);
      setCelebrate(true);
    }
  };

  const bank = () => {
    if (step !== 'score') return;
    playSfx('fanfare');
    setBanked(score.total);
  };

  const coach = (() => {
    switch (step) {
      case 'roll1':
        return {
          targetId: 'tut-roll-button',
          title: `Welcome to the table, ${playerName}!`,
          text: 'Each turn you get 3 rolls of 12 dice: 6 of each of your two colors. Tap ROLL to start.',
        };
      case 'save':
        if (rollsUsed === 1) {
          return {
            targetId: 'tut-roll-area',
            title: 'You rolled 4 spades!',
            text: 'Collect 3 or more of the same symbol to score. You have 3 blue and 1 red spade. Tap a spade to save them all.',
          };
        }
        if (rollsUsed === 2) {
          return {
            targetId: 'tut-roll-area',
            title: 'More matches!',
            text: (
              <>
                2 more blue spades and 3 red diamonds. Tap a spade to add them to your spades, then tap a diamond to start a
                new set.
              </>
            ),
          };
        }
        return {
          targetId: 'tut-roll-area',
          title: 'The last blue spade!',
          text: 'That makes 6 blue spades: a COLOR RUN! Tap the spade, then the diamond.',
        };
      case 'rollNext':
        return {
          targetId: 'tut-roll-button',
          title: rollsUsed === 1 ? 'Saved!' : 'Nice collecting!',
          text:
            rollsUsed === 1
              ? 'Saved dice are safe for the rest of your turn. Each die is worth 5 points. Roll the dice that are left.'
              : 'Matching colors earn bonus points: 3 of one color +10, 4 +25, 5 +50, 6 +100. One roll left: tap ROLL.',
        };
      case 'score':
        return {
          targetId: 'tut-score-button',
          title: `${score.total} points!`,
          text: '7 spades with 6 blue (35 + 100 bonus) and 4 red diamonds (20 + 25 bonus). Tap SCORE IT to bank your points.',
        };
      default:
        return null;
    }
  })();

  return (
    <div className="fixed inset-0 z-[240] flex flex-col bg-[#3a2a1a] bg-wood wood">
      <div className="w-full max-w-md mx-auto flex-1 min-h-0 flex flex-col gap-2 p-3">
        {/* Player card */}
        <div className="shrink-0 rounded-2xl bg-[#1c1c1c] text-white px-4 py-2.5 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#f2c14e]">Practice turn</div>
            <div className="text-lg font-black">{playerName}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-white/70">Rolls left</div>
            <div className="text-xl font-black">{3 - rollsUsed}</div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col justify-center relative">
          <SavedBoard
            savedDice={saved}
            scoreResult={score}
            onTapSavedDie={() => {}}
            isCPU
            showSixCelebration={celebrate}
            onDismissSixCelebration={() => setCelebrate(false)}
          />
        </div>

        <div id="tut-roll-area" className="shrink-0">
          <RollArea
            dice={dice}
            rollsUsed={rollsUsed}
            rollSlotsCount={rollsUsed === 0 ? 12 : active.length}
            isCPU={false}
            isHumanOwner
            playerName={playerName}
            isRolling={isRolling}
            onTapActiveDie={tapDie}
            onDoRoll={roll}
          />
        </div>
        {hint && <p className="shrink-0 text-center text-xs font-black text-[#f2c14e]">{hint}</p>}

        <div className="shrink-0 grid grid-cols-2 gap-2">
          <button
            id="tut-roll-button"
            onClick={roll}
            disabled={!(step === 'roll1' || step === 'rollNext')}
            className="py-3 rounded-xl bg-[#2f9a4f] disabled:opacity-40 text-white font-black shadow-md cursor-pointer active:scale-98"
          >
            🎲 ROLL
          </button>
          <button
            id="tut-score-button"
            onClick={bank}
            disabled={step !== 'score'}
            className="py-3 rounded-xl bg-[#e58a1f] disabled:opacity-40 text-white font-black shadow-md cursor-pointer active:scale-98"
          >
            SCORE IT · {score.total}
          </button>
        </div>
      </div>

      {coach && !celebrate && <CoachMark {...coach} onSkip={onSkip} />}

      {/* Ready for battle */}
      <AnimatePresence>
        {step === 'done' && (
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 20 }}
            className="fixed inset-x-0 top-0 z-[270] flex justify-center p-3"
          >
            <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1c6a35] to-[#145025] border-2 border-[#f2c14e] shadow-2xl p-5 text-center text-white">
              <div className="text-4xl">⚔️</div>
              <h2 className="mt-1 text-2xl font-black text-[#f2c14e]">You're ready for battle!</h2>
              <p className="mt-1 text-sm">
                You banked <strong>{banked} points</strong> with a Color Run. Now take on a computer player. Reach 250 points,
                then survive the elimination round to win!
              </p>
              <button
                onClick={onFinished}
                className="mt-4 w-full py-3 rounded-xl bg-[#f2c14e] text-[#3a2205] font-black shadow-md cursor-pointer active:scale-98"
              >
                Start the Battle
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
