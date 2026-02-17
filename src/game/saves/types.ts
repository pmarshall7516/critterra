import type { Direction } from '@/shared/types';
import type { PlayerCritterProgress } from '@/game/critters/types';

export interface SideMissionProgressEntry {
  progress: number;
  target: number;
  completed: boolean;
  updatedAt: string;
}

export interface SaveProgressTracking {
  mainStory: {
    stageId: string | null;
    flags: Record<string, boolean>;
  };
  sideStory: {
    stageId: string | null;
    flags: Record<string, boolean>;
    missions: Record<string, SideMissionProgressEntry>;
  };
}

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
  playerCritterProgress: PlayerCritterProgress;
  progressTracking: SaveProgressTracking;
  updatedAt: string;
}
