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
 * Haptic vibration feedback whenever the user taps or hits buttons on the gameplay screen.
 */
export const triggerButtonHaptic = async (): Promise<void> => {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
    return;
  } catch {
    // Fall through to web vibration if Capacitor is not running natively
  }

  try {
    if (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      navigator.vibrate(28); // 28ms tactile button pulse
    }
  } catch {
    // Ignore
  }
};

/**
 * Vibration feedback when it becomes the user's turn in Multiplayer, vs Computer, or Friends Challenge.
 */
export const triggerTurnHaptic = async (): Promise<void> => {
  try {
    await Haptics.notification({ type: NotificationType.Warning });
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
      navigator.vibrate([40, 60, 40]); // Distinct double pulse alerting user's turn
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
