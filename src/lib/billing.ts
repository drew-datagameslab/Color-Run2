export interface AdFreePlanOption {
  id: 'monthly' | 'yearly';
  name: string;
  price: string;
  period: string;
  priceNumber: number;
  billingCycle: string;
  badge?: string;
  description: string;
}

export const AD_FREE_PLANS: Record<'monthly' | 'yearly', AdFreePlanOption> = {
  monthly: {
    id: 'monthly',
    name: 'Go Ad-Free Monthly',
    price: '$2.99 USD',
    period: '1 Month',
    priceNumber: 2.99,
    billingCycle: 'Recurring monthly charge',
    description: 'Ad-Free gameplay billed monthly. Cancel anytime.',
  },
  yearly: {
    id: 'yearly',
    name: 'Go Ad-Free for a Year',
    price: '$29.99 USD',
    period: '1 Year',
    priceNumber: 29.99,
    billingCycle: 'Recurring annual charge',
    badge: 'Best Value',
    description: 'Full year of uninterrupted Ad-Free gameplay. Save ~16% compared to monthly.',
  },
};

/**
 * Exact statement required by Color Run terms:
 */
export const RECURRING_AGREEMENT_STATEMENT =
  'I agree to this being a recurring charge, and the date will be on the same date of the following month or year. If I sign up on the 31st of August, I will be charged the 30th of September (last day and not 31st option in Sept.) For yearly, If I sign up on Aug 31, 2026, I would be billed Aug 31, 2027.';

/**
 * Compute the next recurring billing date based on start date and plan.
 * Handles month-end clamping (e.g. Aug 31 -> Sept 30, Jan 31 -> Feb 28/29)
 * and leap years (e.g. Feb 29 -> Feb 28).
 */
export function computeNextBillingDate(startDate: Date, plan: 'monthly' | 'yearly'): Date {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth(); // 0-indexed (0 = Jan, 7 = Aug, 8 = Sept)
  const startDay = startDate.getDate();

  if (plan === 'monthly') {
    // Target month is the following month
    const targetMonthRaw = startMonth + 1;
    const targetYear = startYear + Math.floor(targetMonthRaw / 12);
    const targetMonth = targetMonthRaw % 12;

    // Day 0 of targetMonth + 1 gives the last day of targetMonth
    const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    // Clamp to last day of target month if day does not exist in target month
    // Example: Aug 31 -> Sept has 30 days -> clamped to Sept 30
    const targetDay = Math.min(startDay, maxDaysInTargetMonth);

    return new Date(targetYear, targetMonth, targetDay, startDate.getHours(), startDate.getMinutes());
  } else {
    // Target year is the following year, same month
    const targetYear = startYear + 1;
    const maxDaysInTargetMonth = new Date(targetYear, startMonth + 1, 0).getDate();

    // Example: Aug 31, 2026 -> Aug 31, 2027
    // Leap year edge case: Feb 29, 2024 -> Feb 28, 2025
    const targetDay = Math.min(startDay, maxDaysInTargetMonth);

    return new Date(targetYear, startMonth, targetDay, startDate.getHours(), startDate.getMinutes());
  }
}

/**
 * Helper to format date in readable US format: "Month Day, Year"
 */
export function formatBillingDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
