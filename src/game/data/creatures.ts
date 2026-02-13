import type { CreatureSpecies, ElementType } from '@/shared/types';

export const STARTER_CREATURES: CreatureSpecies[] = [
  {
    id: 'cindercub',
    name: 'Cindercub',
    type: 'Flame',
    baseStats: {
      hp: 22,
      attack: 12,
      defense: 9,
      speed: 11,
    },
    moves: ['Ember Swipe', 'Growl'],
  },
  {
    id: 'mistling',
    name: 'Mistling',
    type: 'Mist',
    baseStats: {
      hp: 24,
      attack: 10,
      defense: 10,
      speed: 10,
    },
    moves: ['Bubble Burst', 'Soothing Drip'],
  },
  {
    id: 'budsprout',
    name: 'Budsprout',
    type: 'Bloom',
    baseStats: {
      hp: 23,
      attack: 11,
      defense: 11,
      speed: 9,
    },
    moves: ['Vine Tap', 'Pollen Puff'],
  },
];

export const TYPE_EFFECTIVENESS: Record<ElementType, Record<ElementType, number>> = {
  Flame: {
    Flame: 1,
    Mist: 0.5,
    Bloom: 2,
  },
  Mist: {
    Flame: 2,
    Mist: 1,
    Bloom: 0.5,
  },
  Bloom: {
    Flame: 0.5,
    Mist: 2,
    Bloom: 1,
  },
};
