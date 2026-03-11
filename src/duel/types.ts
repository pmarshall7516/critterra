import type { CritterDefinition } from '@/game/critters/types';
import type { GameItemDefinition } from '@/game/items/types';
import type { SkillDefinition, SkillEffectDefinition, ElementChart } from '@/game/skills/types';
import type { EquipmentEffectDefinition } from '@/game/equipmentEffects/types';

export type DuelBattleFormat = 'singles' | 'doubles' | 'triples';
export type DuelControlMode = 'human' | 'random-agent';
export type DuelSideId = 'player' | 'opponent';
export type DuelPhase = 'choose-leads' | 'choose-actions' | 'resolving-turn' | 'choose-replacements' | 'finished';

export interface DuelSquadItem {
  itemId: string;
  slotIndex: number;
}

export interface DuelSquadMember {
  critterId: number;
  level: number;
  equippedSkillIds: [string | null, string | null, string | null, string | null];
  equippedItems: DuelSquadItem[];
}

export interface DuelSquad {
  id: string;
  name: string;
  sortIndex: number;
  members: DuelSquadMember[];
  createdAt: string;
  updatedAt: string;
}

export interface DuelCatalogContent {
  critters: CritterDefinition[];
  items: GameItemDefinition[];
  skills: SkillDefinition[];
  skillEffects: SkillEffectDefinition[];
  equipmentEffects: EquipmentEffectDefinition[];
  elementChart: ElementChart;
}

export interface DuelCatalogIndexes {
  critterById: Map<number, CritterDefinition>;
  itemById: Map<string, GameItemDefinition>;
  skillById: Map<string, SkillDefinition>;
  skillEffectById: Map<string, SkillEffectDefinition>;
  equipmentEffectById: Map<string, EquipmentEffectDefinition>;
}

export type DuelAction =
  | {
      kind: 'skill';
      actorMemberIndex: number;
      skillSlotIndex: number;
      /** Primary or fallback single target (used when targetMemberIndices is absent). */
      targetMemberIndex: number;
      /** Multiple targets; when non-empty, used instead of targetMemberIndex. */
      targetMemberIndices?: number[];
    }
  | {
      kind: 'guard';
      actorMemberIndex: number;
    }
  | {
      kind: 'swap';
      actorMemberIndex: number;
      benchMemberIndex: number;
    }
  | {
      kind: 'forfeit';
      actorMemberIndex: number;
    };

export interface DuelActionSubmission {
  side: DuelSideId;
  actions: DuelAction[];
}

export interface DuelTurnResolutionAction {
  side: DuelSideId;
  action: DuelAction;
}

export interface DuelTurnResolutionState {
  queue: DuelTurnResolutionAction[];
  nextActionIndex: number;
}

export interface DuelLogEvent {
  turn: number;
  text: string;
  kind:
    | 'system'
    | 'lead'
    | 'action'
    | 'damage'
    | 'heal'
    | 'swap'
    | 'status'
    | 'knockout'
    | 'result';
}

export interface DuelBattleCritterState {
  memberIndex: number;
  side: DuelSideId;
  critterId: number;
  name: string;
  element: string;
  spriteUrl: string;
  level: number;
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  speed: number;
  attackModifier: number;
  defenseModifier: number;
  speedModifier: number;
  guardActive: boolean;
  /** Whether the most recent guard attempt succeeded (used for damage reduction rules). */
  guardSucceeded: boolean;
  fainted: boolean;
  equippedSkillIds: [string | null, string | null, string | null, string | null];
  /** Effect IDs from skills (buffs/debuffs). */
  activeEffectIds: string[];
  /** Source name (e.g. skill name) per effect ID. */
  activeEffectSourceById: Record<string, string>;
  /** Applied buff/debuff value per effect ID (e.g. 0.2 for +20%). */
  activeEffectValueById: Record<string, number>;
  /** Effect IDs from equipped items. */
  equipmentEffectIds: string[];
  /** Equipped item IDs carried into battle UI for icon display and tooltips. */
  equippedItemIds: string[];
  /** Item name per equipment effect ID. */
  equipmentEffectSourceById: Record<string, string>;
  /** Positive defense from equipment (for crit damage formula). Default 0. */
  equipmentDefensePositiveBonus?: number;
  /** Pending crit chance bonus from crit_buff effects (consumed on next attack). 0–1. */
  pendingCritChanceBonus?: number;
  /** Consecutive successful guard streak (RPG-aligned). */
  consecutiveSuccessfulGuardCount: number;
}

export interface DuelBattleSideState {
  id: DuelSideId;
  label: string;
  team: DuelBattleCritterState[];
  activeMemberIndices: number[];
  pendingLeadSelection: number[] | null;
  pendingActions: DuelAction[] | null;
  pendingReplacements: number[] | null;
}

export interface DuelBattleState {
  id: string;
  format: DuelBattleFormat;
  phase: DuelPhase;
  turnNumber: number;
  player: DuelBattleSideState;
  opponent: DuelBattleSideState;
  winner: DuelSideId | 'draw' | null;
  logs: DuelLogEvent[];
  turnResolution: DuelTurnResolutionState | null;
}

export interface DuelBattleCreateInput {
  id?: string;
  format: DuelBattleFormat;
  playerLabel: string;
  opponentLabel: string;
  playerSquad: DuelSquad;
  opponentSquad: DuelSquad;
  catalogs: DuelCatalogContent;
}
