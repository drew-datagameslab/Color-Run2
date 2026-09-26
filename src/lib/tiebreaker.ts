import { Die } from '../types/game';
import { scoreDice } from './scoring';

/**
 * "Battle to Survive" roll-off tiebreaker, shared by PlayScreen (all game modes,
 * synced through the room in online / Friends Challenge games) and the Companion Scoreboard.
 *
 * Rules:
 * - At the end of an elimination round, players tied for the lowest total roll off.
 * - Each tied player rolls all 12 dice one time, in seating order.
 * - The single lowest roll is eliminated.
 * - Players who roll higher than the lowest roll advance; players tied for the lowest roll again.
 */

export type TiebreakerPhase = 'intro' | 'rolling' | 'outro';

export interface TiebreakerState {
  phase: TiebreakerPhase;
  /** Players still in the roll-off, in seating order */
  tiedUnitIds: string[];
  /** Index into tiedUnitIds of the player whose roll it is */
  activeTiedIndex: number;
  /** Roll totals for the current roll-off round */
  rollScores: Record<string, number>;
  /** Roll-off round, starting at 1 */
  roundNumber: number;
  noticeMsg: string | null;
  /** Total of the current player's roll once they have rolled, else null */
  lastRollTotal: number | null;
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
    tiedUnitIds,
    activeTiedIndex: 0,
    rollScores: {},
    roundNumber: 1,
    noticeMsg: null,
    lastRollTotal: null,
    eliminatedUnitId: null,
  };
}

/** Tiebreaker roll value: points scored by the 12 dice, or the pip sum if nothing scores */
export function tiebreakerRollTotal(dice: Die[]): number {
  const scored = scoreDice(dice).total;
  return scored > 0 ? scored : dice.reduce((acc, d) => acc + d.value, 0);
}

export function currentTiedUnitId(state: TiebreakerState): string | undefined {
  return state.tiedUnitIds[state.activeTiedIndex];
}

/** Records the current player's roll total */
export function recordTiebreakerRoll(state: TiebreakerState, total: number): TiebreakerState {
  const unitId = currentTiedUnitId(state);
  if (!unitId) return state;
  return {
    ...state,
    rollScores: { ...state.rollScores, [unitId]: total },
    lastRollTotal: total,
  };
}

/**
 * Moves to the next tied player, or, once everyone has rolled, resolves the roll-off round:
 * the single lowest is eliminated (phase 'outro'); otherwise the players tied for lowest roll again.
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

/** Resolves a roll-off round once every tied player has a score */
export function resolveTiebreakerRound(
  state: TiebreakerState,
  scores: Record<string, number>,
  nameOf: (unitId: string) => string
): TiebreakerState {
  const ids = state.tiedUnitIds;
  const minRoll = Math.min(...ids.map(id => scores[id]));
  const lowestIds = ids.filter(id => scores[id] === minRoll);

  if (lowestIds.length === 1) {
    return {
      ...state,
      phase: 'outro',
      rollScores: scores,
      eliminatedUnitId: lowestIds[0],
      noticeMsg: null,
    };
  }

  const advancingIds = ids.filter(id => scores[id] > minRoll);
  const noticeMsg = advancingIds.length > 0
    ? `${advancingIds.map(nameOf).join(', ')} advance! ${lowestIds.map(nameOf).join(' & ')} remain tied and roll again!`
    : `Still tied (${minRoll} pts)! Roll again!`;

  return {
    ...state,
    tiedUnitIds: lowestIds,
    activeTiedIndex: 0,
    rollScores: {},
    roundNumber: state.roundNumber + 1,
    noticeMsg,
    lastRollTotal: null,
  };
}
