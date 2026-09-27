import { Die } from '../types/game';
import { scoreDice } from './scoring';

/**
 * "Battle to Survive" tiebreaker, shared by PlayScreen (all game modes:
 * multiplayer, vs CPU, Friends Challenge, Pass & Play) and Companion Scoreboard.
 *
 * Rules:
 * - At the end of an elimination round, players tied for the lowest total enter Battle to Survive.
 * - Instead of one roll, each tied player takes a normal turn (3 rolls to build and match for the best outcome).
 * - Underneath their scoreboards, the word "TIEBREAKER" and their tiebreak score are shown.
 * - When the final player in the tiebreak hits "SCORE IT":
 *   - The winner's board (or in a 3-player tiebreak, the boards of the 2 advancing users)
 *     blinks for 3 seconds.
 *   - Then the closing animation (outro) appears for 4 seconds, announcing the eliminated player.
 * - In a 3-player tiebreak, if 1 user scores the most while the other two tie again:
 *   - The user who scored the most shows "ADVANCE" under their score.
 *   - The score from round one goes back to zero for the two remaining users.
 *   - The two remaining users roll a complete turn again until a winner and eliminated user are defined.
 */

export type TiebreakerPhase = 'intro' | 'rolling' | 'blinking' | 'outro';

export interface TiebreakerState {
  phase: TiebreakerPhase;
  /** All player IDs who entered the tiebreaker */
  initialTiedUnitIds: string[];
  /** Players still rolling in the current roll-off round, in seating order */
  tiedUnitIds: string[];
  /** Index into tiedUnitIds of the player whose turn it is */
  activeTiedIndex: number;
  /** Completed turn scores for the current roll-off round */
  rollScores: Record<string, number>;
  /** Players who have advanced in an earlier round of the tiebreak (e.g. scored highest in 3-way tie) */
  advancedUnitIds: string[];
  /** Roll-off round, starting at 1 */
  roundNumber: number;
  noticeMsg: string | null;
  /** Total of the current player's roll/turn score once recorded, else null */
  lastRollTotal: number | null;
  /** Player IDs whose scoreboards should blink (winner / advancing players) */
  blinkingUnitIds: string[];
  eliminatedUnitId: string | null;
}

/** Players tied for the lowest total, in seating order. Empty when there is no tie. */
export function findLowestTie<T extends { id: string; score: number }>(liveUnits: T[]): T[] {
  if (liveUnits.length < 2) return [];
  const minScore = Math.min(...liveUnits.map(u => u.score));
  const tied = liveUnits.filter(u => u.score === minScore);
  return tied.length > 1 ? tied : [];
}

export function startTiebreaker(tiedUnitIds: string[]): TiebreakerState {
  return {
    phase: 'intro',
    initialTiedUnitIds: [...tiedUnitIds],
    tiedUnitIds: [...tiedUnitIds],
    activeTiedIndex: 0,
    rollScores: {},
    advancedUnitIds: [],
    roundNumber: 1,
    noticeMsg: null,
    lastRollTotal: null,
    blinkingUnitIds: [],
    eliminatedUnitId: null,
  };
}

/**
 * Calculates a player's normal turn score during a tiebreaker:
 * Uses standard Color Run scoring on saved dice. If no sets were saved,
 * falls back to pip sum of the dice to ensure every turn produces a decisive value.
 */
export function tiebreakerRollTotal(dice: Die[]): number {
  const saved = dice.filter(d => d.zone === 'saved');
  const scored = scoreDice(saved.length > 0 ? saved : dice).total;
  if (scored > 0) return scored;
  return dice.reduce((acc, d) => acc + d.value, 0);
}

export function currentTiedUnitId(state: TiebreakerState): string | undefined {
  return state.tiedUnitIds[state.activeTiedIndex];
}

/** Records a player's completed turn score in the tiebreaker */
export function recordTiebreakerTurnScore(
  state: TiebreakerState,
  unitId: string,
  total: number
): TiebreakerState {
  return {
    ...state,
    rollScores: { ...state.rollScores, [unitId]: total },
    lastRollTotal: total,
  };
}

/** Backward compatible roll recorder */
export function recordTiebreakerRoll(state: TiebreakerState, total: number): TiebreakerState {
  const unitId = currentTiedUnitId(state);
  if (!unitId) return state;
  return recordTiebreakerTurnScore(state, unitId, total);
}

/**
 * Moves to the next tied player, or, once everyone in this tiebreak round has scored,
 * resolves the tiebreak round.
 */
export function advanceTiebreaker(
  state: TiebreakerState,
  nameOf: (unitId: string) => string
): TiebreakerState {
  const nextIdx = state.activeTiedIndex + 1;
  if (nextIdx < state.tiedUnitIds.length) {
    return { ...state, activeTiedIndex: nextIdx, lastRollTotal: null };
  }
  return resolveTiebreakerRound(state, state.rollScores, nameOf);
}

/**
 * Resolves a tiebreak round once every participating tied player has completed their turn.
 */
export function resolveTiebreakerRound(
  state: TiebreakerState,
  scores: Record<string, number>,
  nameOf: (unitId: string) => string
): TiebreakerState {
  const ids = state.tiedUnitIds;
  const minScore = Math.min(...ids.map(id => scores[id] ?? 0));
  const maxScore = Math.max(...ids.map(id => scores[id] ?? 0));
  const lowestIds = ids.filter(id => (scores[id] ?? 0) === minScore);
  const advancingIds = ids.filter(id => (scores[id] ?? 0) > minScore);

  // Case 1: Exactly one player has the lowest score -> that player is eliminated!
  // The winner (in 2-player) or the 2 advancing players (in 3-player) blink their boards!
  if (lowestIds.length === 1) {
    const allAdvancing = Array.from(new Set([...state.advancedUnitIds, ...advancingIds]));
    return {
      ...state,
      phase: 'blinking',
      rollScores: scores,
      blinkingUnitIds: allAdvancing.length > 0 ? allAdvancing : advancingIds,
      eliminatedUnitId: lowestIds[0],
      noticeMsg: null,
      lastRollTotal: null,
    };
  }

  // Case 2: In a 3-player (or multi-player) tiebreak, higher users advance while others tie again.
  // Advancing users show "ADVANCE" under score.
  // The score from round one goes back to zero for the remaining users, who roll again.
  if (advancingIds.length > 0 && lowestIds.length > 1) {
    const newAdvanced = Array.from(new Set([...state.advancedUnitIds, ...advancingIds]));

    const noticeMsg = `${advancingIds.map(nameOf).join(', ')} advance! ${lowestIds.map(nameOf).join(' & ')} remain tied and roll again!`;

    return {
      ...state,
      phase: 'rolling',
      tiedUnitIds: lowestIds,
      advancedUnitIds: newAdvanced,
      activeTiedIndex: 0,
      rollScores: {}, // reset to zero for the remaining users
      roundNumber: state.roundNumber + 1,
      noticeMsg,
      blinkingUnitIds: advancingIds,
      lastRollTotal: null,
      eliminatedUnitId: null,
    };
  }

  // Case 3: All participating players tied again (e.g. both rolled 50, or all 3 rolled 60).
  // The scores go back to zero and they roll a complete turn again.
  return {
    ...state,
    phase: 'rolling',
    tiedUnitIds: lowestIds,
    activeTiedIndex: 0,
    rollScores: {}, // reset to zero
    roundNumber: state.roundNumber + 1,
    noticeMsg: `Still tied (${minScore} pts)! Complete another turn to decide!`,
    blinkingUnitIds: [],
    lastRollTotal: null,
    eliminatedUnitId: null,
  };
}
