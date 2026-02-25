export interface ShopCostDefinition {
  itemId: string;
  quantity: number;
}

interface ShopEntryBaseDefinition {
  id: string;
  costs: ShopCostDefinition[];
}

export interface ShopItemEntryDefinition extends ShopEntryBaseDefinition {
  kind: 'item';
  itemId: string;
  quantity: number;
  repeatable?: boolean;
}

export interface ShopCritterEntryDefinition extends ShopEntryBaseDefinition {
  kind: 'critter';
  critterId: number;
  unlockFlagId: string;
}

export type ShopEntryDefinition = ShopItemEntryDefinition | ShopCritterEntryDefinition;

export interface ShopDefinition {
  id: string;
  name: string;
  entries: ShopEntryDefinition[];
}
