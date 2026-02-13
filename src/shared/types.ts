export type Direction = 'up' | 'down' | 'left' | 'right';

export type ElementType = 'Flame' | 'Mist' | 'Bloom';

export interface Vector2 {
  x: number;
  y: number;
}

export interface CreatureSpecies {
  id: string;
  name: string;
  type: ElementType;
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  };
  moves: string[];
}
