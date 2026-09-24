import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Provides tactile haptic feedback when a user taps a die in Scoreboard mode.
 * Combines Capacitor Haptics API (for native mobile iOS/Android) with
 * HTML5 Navigator Vibration API (for web browsers), wrapped safely to avoid
 * any runtime exceptions on unsupported devices.
 */
export const triggerDieTapHaptic = async (): Promise<void> => {
  // 1. Try Capacitor Native Haptics
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
    return;
  } catch {
    // Falls through to web vibration if Capacitor is not running natively
  }

  // 2. Web Vibration API fallback (e.g., mobile Chrome / Android)
  try {
    if (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      navigator.vibrate(22); // 22ms crisp tactile pulse
    }
  } catch {
    // Graceful fallback: silently continue if vibrations are restricted or unsupported
  }
};

/**
 * Haptic feedback for removing or deselecting a die from the saved board.
 */
export const triggerDieRemoveHaptic = async (): Promise<void> => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
    return;
  } catch {
    // Fall through
  }

  try {
    if (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      navigator.vibrate(15);
    }
  } catch {
    // Ignore
  }
};

/**
 * Celebratory haptic feedback for milestones (e.g. 6-of-a-kind Color Run).
 */
export const triggerCelebrationHaptic = async (): Promise<void> => {
  try {
    await Haptics.notification({ type: NotificationType.Success });
    return;
  } catch {
    // Fall through
  }

  try {
    if (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      navigator.vibrate([35, 45, 65]);
    }
  } catch {
    // Ignore
  }
};
