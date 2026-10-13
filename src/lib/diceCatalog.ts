import { DiceColor } from '../types/game';

/**
 * Every dice color in the game, used by the shop, the profile and the avatar screen.
 * Dice images live in public/assets/dice/<id>/1-6.png; the gradient sets are made by
 * scripts/generate-gradient-dice.mjs (keep its colors in step with GRADIENT_DICE below).
 */
export interface DiceColorOption {
  id: DiceColor;
  name: string;
  /** CSS background for small swatches (a color or a gradient) */
  swatch: string;
  /** Shop price in coins (0 = starter color everyone owns) */
  price: number;
  gradient: boolean;
}

export const CLASSIC_DICE: DiceColorOption[] = [
  { id: 'blue', name: 'Blue', swatch: '#1f7fd6', price: 0, gradient: false },
  { id: 'red', name: 'Red', swatch: '#e5352f', price: 0, gradient: false },
  { id: 'green', name: 'Green', swatch: '#2f9a4f', price: 75, gradient: false },
  { id: 'purple', name: 'Purple', swatch: '#8e44c9', price: 75, gradient: false },
  { id: 'black', name: 'Midnight', swatch: '#222222', price: 75, gradient: false },
  { id: 'lblue', name: 'Sky Blue', swatch: '#45aaf2', price: 75, gradient: false },
  { id: 'orange', name: 'Amber', swatch: '#fa8231', price: 75, gradient: false },
  { id: 'pink', name: 'Neon Pink', swatch: '#fd79a8', price: 75, gradient: false },
];

export const GRADIENT_DICE_PRICE = 100;

const gradient = (...stops: string[]) => `linear-gradient(135deg, ${stops.join(', ')})`;

export const GRADIENT_DICE: DiceColorOption[] = [
  { id: 'sunset', name: 'Sunset', swatch: gradient('#fbbf24', '#f97316', '#db2777') },
  { id: 'ember', name: 'Ember', swatch: gradient('#facc15', '#ea580c', '#7f1d1d') },
  { id: 'desert', name: 'Desert', swatch: gradient('#f5d08a', '#d97742', '#7c2d12') },
  { id: 'gold', name: 'Gold', swatch: gradient('#fde68a', '#d4a017', '#8a6508') },
  { id: 'lagoon', name: 'Lagoon', swatch: gradient('#a3e635', '#14b8a6', '#1d4ed8') },
  { id: 'aurora', name: 'Aurora', swatch: gradient('#34d399', '#06b6d4', '#7c3aed') },
  { id: 'ocean', name: 'Ocean', swatch: gradient('#22d3ee', '#1e3a8a') },
  { id: 'silver', name: 'Silver', swatch: gradient('#f1f5f9', '#a3adb8', '#5b6470') },
  { id: 'cottoncandy', name: 'Cotton Candy', swatch: gradient('#f472b6', '#a78bfa', '#3b82f6') },
  { id: 'twilight', name: 'Twilight', swatch: gradient('#f472b6', '#9333ea', '#1e1b4b') },
  { id: 'galaxy', name: 'Galaxy', swatch: gradient('#7c3aed', '#312e81', '#0b1026') },
  {
    id: 'rainbow',
    name: 'Rainbow',
    swatch: gradient('#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'),
  },
].map(d => ({ ...d, id: d.id as DiceColor, price: GRADIENT_DICE_PRICE, gradient: true }));

export const ALL_DICE_OPTIONS: DiceColorOption[] = [...CLASSIC_DICE, ...GRADIENT_DICE];

export function diceOption(id: DiceColor): DiceColorOption | undefined {
  return ALL_DICE_OPTIONS.find(d => d.id === id);
}

/** Starter colors are always owned; others once bought or unlocked with a coupon */
export function ownsDiceColor(unlockedColors: string[] | undefined, id: DiceColor): boolean {
  return diceOption(id)?.price === 0 || !!unlockedColors?.includes(id);
}
