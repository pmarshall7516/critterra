import type { Direction, Vector2 } from '@/shared/types';

export type TileCode =
  string;

export interface TileDefinition {
  code: TileCode;
  label: string;
  walkable: boolean;
  color: string;
  accentColor?: string;
  height: number;
  atlasIndex?: number;
}

export interface NpcSpriteConfig {
  url: string;
  frameWidth: number;
  frameHeight: number;
  atlasCellWidth?: number;
  atlasCellHeight?: number;
  frameCellsWide?: number;
  frameCellsTall?: number;
  renderWidthTiles?: number;
  renderHeightTiles?: number;
  facingFrames: Record<Direction, number>;
  walkFrames?: Partial<Record<Direction, number[]>>;
}

export interface NpcMovementDefinition {
  type: 'static' | 'loop' | 'random';
  pattern?: Direction[];
  stepIntervalMs?: number;
}

export interface NpcDefinition {
  id: string;
  name: string;
  position: Vector2;
  color: string;
  dialogueId: string;
  dialogueLines?: string[];
  dialogueSpeaker?: string;
  dialogueSetFlag?: string;
  battleTeamIds?: string[];
  movement?: NpcMovementDefinition;
  sprite?: NpcSpriteConfig;
}

export interface WarpDefinition {
  id: string;
  from: Vector2;
  fromPositions?: Vector2[];
  toMapId: string;
  to: Vector2;
  toPositions?: Vector2[];
  toFacing?: Direction;
  requireInteract?: boolean;
  requiredFacing?: Direction;
  label?: string;
}

export interface InteractionDefinition {
  id: string;
  position: Vector2;
  lines: string[];
  speaker?: string;
  requiresFlag?: string;
  hideIfFlag?: string;
  setFlag?: string;
}

export interface WorldMapLayerInput {
  id: string;
  name?: string;
  tiles: string[];
  rotations?: string[];
  collisionEdges?: string[];
  visible?: boolean;
  collision?: boolean;
}

export interface WorldMapInput {
  id: string;
  name: string;
  tiles?: string[];
  layers?: WorldMapLayerInput[];
  npcs?: NpcDefinition[];
  warps?: WarpDefinition[];
  interactions?: InteractionDefinition[];
}

export interface WorldMapLayer {
  id: string;
  name: string;
  tiles: TileCode[][];
  rotations: number[][];
  collisionEdges: number[][];
  visible: boolean;
  collision: boolean;
}

export interface WorldMap {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: WorldMapLayer[];
  tiles: TileCode[][];
  npcs: NpcDefinition[];
  warps: WarpDefinition[];
  interactions: InteractionDefinition[];
}
