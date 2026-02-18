import type { Direction, Vector2 } from '@/shared/types';
import type { MapEncounterGroupDefinition } from '@/game/encounters/types';

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
  ySortWithActors?: boolean;
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
  animationSets?: Partial<Record<string, Partial<Record<Direction, number[]>>>>;
  defaultIdleAnimation?: string;
  defaultMoveAnimation?: string;
  facingFrames: Record<Direction, number>;
  walkFrames?: Partial<Record<Direction, number[]>>;
}

export interface NpcMovementDefinition {
  // `loop` and `random` remain for legacy compatibility with older saved data.
  type: 'static' | 'static-turning' | 'wander' | 'path' | 'loop' | 'random';
  pattern?: Direction[];
  stepIntervalMs?: number;
  pathMode?: 'loop' | 'pingpong';
  leashRadius?: number;
}

export interface NpcMovementGuardDefinition {
  id?: string;
  requiresFlag?: string;
  hideIfFlag?: string;
  x?: number;
  y?: number;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  dialogueSpeaker?: string;
  dialogueLines?: string[];
  setFlag?: string;
  /** Set when player wins the guard battle; guard becomes inactive. Battle uses the NPC instance's battle team. */
  defeatedFlag?: string;
  /** After defeat, show this dialogue on interact instead of instance dialogue. */
  postDuelDialogueSpeaker?: string;
  postDuelDialogueLines?: string[];
}

export type NpcInteractionActionDefinition =
  | {
      type: 'dialogue';
      speaker?: string;
      lines: string[];
      setFlag?: string;
    }
  | {
      type: 'set_flag';
      flag: string;
    }
  | {
      type: 'move_to_player';
    }
  | {
      type: 'move_path';
      directions: Direction[];
    }
  | {
      type: 'face_player';
    }
  | {
      type: 'wait';
      durationMs: number;
    };

export interface NpcStoryStateDefinition {
  id?: string;
  requiresFlag?: string;
  firstInteractionSetFlag?: string;
  firstInteractBattle?: boolean;
  healer?: boolean;
  mapId?: string;
  position?: Vector2;
  facing?: Direction;
  dialogueId?: string;
  dialogueLines?: string[];
  dialogueSpeaker?: string;
  dialogueSetFlag?: string;
  battleTeamIds?: string[];
  movement?: NpcMovementDefinition;
  idleAnimation?: string;
  moveAnimation?: string;
  sprite?: NpcSpriteConfig;
  movementGuards?: NpcMovementGuardDefinition[];
  interactionScript?: NpcInteractionActionDefinition[];
}

export interface NpcDefinition {
  id: string;
  name: string;
  position: Vector2;
  facing?: Direction;
  color: string;
  requiresFlag?: string;
  hideIfFlag?: string;
  firstInteractionSetFlag?: string;
  firstInteractBattle?: boolean;
  healer?: boolean;
  dialogueId: string;
  dialogueLines?: string[];
  dialogueSpeaker?: string;
  dialogueSetFlag?: string;
  battleTeamIds?: string[];
  movement?: NpcMovementDefinition;
  idleAnimation?: string;
  moveAnimation?: string;
  sprite?: NpcSpriteConfig;
  movementGuards?: NpcMovementGuardDefinition[];
  storyStates?: NpcStoryStateDefinition[];
  interactionScript?: NpcInteractionActionDefinition[];
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
  id: string | number;
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
  encounterGroups?: MapEncounterGroupDefinition[];
}

export interface WorldMapLayer {
  id: string;
  orderId: number;
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
  encounterGroups: MapEncounterGroupDefinition[];
}
