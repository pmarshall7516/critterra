import type { Vector2 } from '@/shared/types';

export interface EncounterTableEntry {
  critterId: number;
  weight: number;
  minLevel?: number | null;
  maxLevel?: number | null;
}

export interface EncounterTableDefinition {
  id: string;
  entries: EncounterTableEntry[];
}

export interface MapEncounterGroupDefinition {
  id: string;
  tilePositions: Vector2[];
  walkEncounterTableId?: string | null;
  fishEncounterTableId?: string | null;
  walkFrequency: number;
  fishFrequency: number;
}
