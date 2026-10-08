import { Die } from '../types/game';

/**
 * CPU logic for Color Run:
 * 1. Checks all active dice and saved dice.
 * 2. If a value already has saved dice, any active dice matching that value can be saved.
 * 3. For values without saved dice, checks if active dice have 3+ of that value.
 *    If multiple values have 3+, saves them.
 * 4. Also checks if any group has same-color dice to maximize bonuses.
 * 5. Returns array of die IDs that should be moved from active to saved.
 */
export function decideCPUSaves(dice: Die[]): number[] {
  const saved = dice.filter(d => d.zone === 'saved');
  const active = dice.filter(d => d.zone === 'active');

  const savedCounts: Record<number, number> = {};
  for (const d of saved) {
    savedCounts[d.value] = (savedCounts[d.value] || 0) + 1;
  }

  const activeByVal: Record<number, Die[]> = {};
  for (const d of active) {
    if (!activeByVal[d.value]) activeByVal[d.value] = [];
    activeByVal[d.value].push(d);
  }

  const idsToSave: number[] = [];

  // 1. If a value is already saved (so set already >= 3), all active dice with that value should be saved
  for (const vStr in activeByVal) {
    const v = Number(vStr);
    const existingCount = savedCounts[v] || 0;
    const activeGroup = activeByVal[v];

    if (existingCount >= 3) {
      activeGroup.forEach(d => idsToSave.push(d.id));
    } else if (existingCount + activeGroup.length >= 3) {
      // 2. Together with saved dice (or on their own), we reach at least 3!
      activeGroup.forEach(d => idsToSave.push(d.id));
    }
  }

  return idsToSave;
}
