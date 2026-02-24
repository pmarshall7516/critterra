export const ITEM_CORE_CATEGORIES = ['tool', 'equipment', 'healing', 'material', 'other'] as const;
export type CoreItemCategory = (typeof ITEM_CORE_CATEGORIES)[number];
export type ItemCategory = CoreItemCategory | (string & {});

export const ITEM_EFFECT_TYPES = ['tool_action', 'equip_stub', 'heal_flat', 'heal_percent', 'other_stub'] as const;
export type ItemEffectType = (typeof ITEM_EFFECT_TYPES)[number];

export interface ToolItemEffectConfig {
  actionId: string;
  power?: number;
  requiresFacingTileKeyword?: string[];
  successText?: string;
}

export interface EquipmentItemEffectConfig {
  slot?: string;
}

export interface HealingItemEffectConfig {
  healAmount?: number;
  healPercent?: number;
  curesStatus?: boolean;
}

export interface OtherItemEffectConfig {
  actionId?: string;
  successText?: string;
}

export type ItemEffectConfig =
  | ToolItemEffectConfig
  | EquipmentItemEffectConfig
  | HealingItemEffectConfig
  | OtherItemEffectConfig;

export interface GameItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  imageUrl: string;
  misuseText: string;
  successText?: string;
  effectType: ItemEffectType;
  effectConfig: ItemEffectConfig;
  /** Optional generic numeric value interpreted by effectType/category (e.g. heal power, tool power). */
  value?: number;
  consumable: boolean;
  maxStack: number;
  isActive: boolean;
  starterGrantAmount: number;
}

export interface PlayerItemInventoryEntry {
  itemId: string;
  quantity: number;
}

export interface PlayerItemInventory {
  version: number;
  entries: PlayerItemInventoryEntry[];
}

export const PLAYER_ITEM_INVENTORY_VERSION = 1;
