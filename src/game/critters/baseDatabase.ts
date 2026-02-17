import type { CritterDefinition } from '@/game/critters/types';

export const BASE_CRITTER_DATABASE: CritterDefinition[] = [
  {
    id: 1,
    name: 'Spriglet',
    element: 'bloom',
    rarity: 'common',
    description: 'A starter critter template. Configure levels, missions, and abilities in Critter Admin.',
    spriteUrl: '',
    baseStats: {
      hp: 14,
      attack: 9,
      defense: 9,
      speed: 10,
    },
    abilities: [],
    levels: [],
  },
];
