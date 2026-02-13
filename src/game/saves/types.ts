import type { Direction } from '@/shared/types';

export interface SaveProfile {
  id: string;
  version: number;
  playerName: string;
  currentMapId: string;
  player: {
    x: number;
    y: number;
    facing: Direction;
  };
  selectedStarterId: string | null;
  flags: Record<string, boolean>;
  updatedAt: string;
}
