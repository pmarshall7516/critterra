import type { Vector2 } from '@/shared/types';

export interface EncounterTableCritterEntry {
  kind: 'critter';
  critterId: number;
  weight: number;
  minLevel?: number | null;
  maxLevel?: number | null;
}

export interface EncounterTableItemEntry {
  kind: 'item';
  itemId: string;
  weight: number;
  minAmount?: number | null;
  maxAmount?: number | null;
}

export type EncounterTableEntry = EncounterTableCritterEntry | EncounterTableItemEntry;

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
