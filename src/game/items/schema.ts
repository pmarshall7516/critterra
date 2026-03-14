import {
  HEALING_ITEM_STATUS_CONDITION_KINDS,
  ITEM_CORE_CATEGORIES,
  ITEM_EFFECT_TYPES,
  PLAYER_ITEM_INVENTORY_VERSION,
  type GameItemDefinition,
  type HealingItemStatusConditionKind,
  type ItemCategory,
  type ItemEffectConfig,
  type ItemEffectType,
  type PlayerItemInventory,
} from '@/game/items/types';
import type {
  EquipmentEffectAttachment,
  EquipmentEffectMode,
  EquipmentPersistentHealMode,
} from '@/game/equipmentEffects/types';
import {
  EQUIPMENT_EFFECT_MODES,
  EQUIPMENT_PERSISTENT_HEAL_MODES,
} from '@/game/equipmentEffects/types';

const CORE_CATEGORY_SET = new Set<string>(ITEM_CORE_CATEGORIES);
const EFFECT_TYPE_SET = new Set<string>(ITEM_EFFECT_TYPES);
const HEALING_ITEM_STATUS_KIND_SET = new Set<HealingItemStatusConditionKind>(HEALING_ITEM_STATUS_CONDITION_KINDS);
const EQUIPMENT_EFFECT_MODE_SET = new Set<EquipmentEffectMode>(EQUIPMENT_EFFECT_MODES);
const EQUIPMENT_PERSISTENT_HEAL_MODE_SET = new Set<EquipmentPersistentHealMode>(EQUIPMENT_PERSISTENT_HEAL_MODES);

export function sanitizeItemCatalog(raw: unknown): GameItemDefinition[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed: GameItemDefinition[] = [];
  const seenIds = new Set<string>();
  for (let index = 0; index < raw.length; index += 1) {
    const item = sanitizeItemDefinition(raw[index], index);
    if (!item || seenIds.has(item.id)) {
      continue;
    }
    seenIds.add(item.id);
    parsed.push(item);
  }
  return parsed;
}

export function sanitizeItemDefinition(raw: unknown, index = 0): GameItemDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = sanitizeIdentifier(record.id, `item-${index + 1}`);
  const name = sanitizeText(record.name, `Item ${index + 1}`, 60);
  const category = sanitizeCategory(record.category);
  const effectType = sanitizeEffectType(record.effectType, category);
  const effectConfig = sanitizeEffectConfig(effectType, record.effectConfig);
  const explicitValue = sanitizeOptionalNumber(record.value, -999999, 999999);
  const derivedValue = deriveValueFromEffectConfig(effectType, effectConfig);

  return {
    id,
    name,
    category,
    description: sanitizeText(record.description, '', 300),
    imageUrl: sanitizeText(record.imageUrl, '', 1200),
    misuseText: sanitizeText(record.misuseText, defaultMisuseText(category), 160),
    successText: sanitizeOptionalText(record.successText ?? record.success_text, 200),
    effectType,
    effectConfig,
    value: explicitValue ?? derivedValue,
    consumable:
      typeof record.consumable === 'boolean'
        ? record.consumable
        : defaultConsumableForCategory(category, effectType),
    maxStack: clampInt(record.maxStack, 1, 9999, 99),
    isActive: typeof record.isActive === 'boolean' ? record.isActive : true,
    starterGrantAmount: clampInt(record.starterGrantAmount, 0, 9999, 0),
  };
}

export function createDefaultPlayerItemInventory(
  itemCatalog: GameItemDefinition[] = [],
): PlayerItemInventory {
  const entries = itemCatalog
    .filter((item) => item.starterGrantAmount > 0)
    .map((item) => ({
      itemId: item.id,
      quantity: clampInt(item.starterGrantAmount, 1, item.maxStack, 1),
    }));
  return {
    version: PLAYER_ITEM_INVENTORY_VERSION,
    entries,
  };
}

export function sanitizePlayerItemInventory(
  raw: unknown,
  itemCatalog: GameItemDefinition[],
): PlayerItemInventory {
  const defaults = createDefaultPlayerItemInventory(itemCatalog);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults;
  }

  const allowedIds = new Set(itemCatalog.map((item) => item.id));
  const record = raw as Record<string, unknown>;
  const rawEntries = Array.isArray(record.entries) ? record.entries : [];
  const parsedEntries: PlayerItemInventory['entries'] = [];
  const seenIds = new Set<string>();

  for (const entry of rawEntries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const entryRecord = entry as Record<string, unknown>;
    const itemId = sanitizeIdentifier(entryRecord.itemId, '');
    if (!itemId || seenIds.has(itemId) || !allowedIds.has(itemId)) {
      continue;
    }
    const item = itemCatalog.find((candidate) => candidate.id === itemId);
    if (!item) {
      continue;
    }
    const quantity = clampInt(entryRecord.quantity, 0, item.maxStack, 0);
    if (quantity <= 0) {
      continue;
    }
    seenIds.add(itemId);
    parsedEntries.push({
      itemId,
      quantity,
    });
  }

  if (parsedEntries.length === 0) {
    return defaults;
  }

  return {
    version: PLAYER_ITEM_INVENTORY_VERSION,
    entries: parsedEntries,
  };
}

export function getItemInventoryQuantity(inventory: PlayerItemInventory, itemId: string): number {
  const found = inventory.entries.find((entry) => entry.itemId === itemId);
  return found ? Math.max(0, found.quantity) : 0;
}

export function setItemInventoryQuantity(
  inventory: PlayerItemInventory,
  itemCatalog: GameItemDefinition[],
  itemId: string,
  quantity: number,
): PlayerItemInventory {
  const item = itemCatalog.find((entry) => entry.id === itemId);
  if (!item) {
    return inventory;
  }
  const nextQuantity = clampInt(quantity, 0, item.maxStack, 0);
  const filtered = inventory.entries.filter((entry) => entry.itemId !== itemId);
  if (nextQuantity > 0) {
    filtered.push({ itemId, quantity: nextQuantity });
  }
  return {
    version: PLAYER_ITEM_INVENTORY_VERSION,
    entries: filtered.sort((left, right) => left.itemId.localeCompare(right.itemId)),
  };
}

function sanitizeCategory(raw: unknown): ItemCategory {
  const value = sanitizeIdentifier(raw, 'other');
  if (!value) {
    return 'other';
  }
  if (CORE_CATEGORY_SET.has(value)) {
    return value;
  }
  return value;
}

function sanitizeEffectType(raw: unknown, category: ItemCategory): ItemEffectType {
  const value = sanitizeIdentifier(raw, '');
  if (value && EFFECT_TYPE_SET.has(value)) {
    return value as ItemEffectType;
  }
  if (category === 'tool') return 'tool_action';
  if (category === 'equipment') return 'equip_effect';
  if (category === 'healing') return 'heal_flat';
  return 'other_stub';
}

function sanitizeEffectConfig(effectType: ItemEffectType, raw: unknown): ItemEffectConfig {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  if (effectType === 'tool_action') {
    const normalizedActionId = sanitizeIdentifier(record.actionId, 'tool-action');
    return {
      actionId: normalizedActionId === 'fish' ? 'fishing' : normalizedActionId,
      power: sanitizeOptionalNumber(record.power, 0, 1),
      requiresFacingTileKeyword: Array.isArray(record.requiresFacingTileKeyword)
        ? record.requiresFacingTileKeyword
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim().toLowerCase())
            .filter((entry, index, values) => entry.length > 0 && values.indexOf(entry) === index)
            .slice(0, 20)
        : undefined,
      successText: sanitizeOptionalText(record.successText, 160),
    };
  }
  if (effectType === 'equip_effect' || effectType === 'equip_stub') {
    const equipSize =
      typeof record.equipSize === 'number'
        ? record.equipSize
        : typeof record.equip_size === 'number'
          ? record.equip_size
          : 1;
    const equipmentEffectAttachments = sanitizeEquipmentEffectAttachments(
      record.equipmentEffectAttachments ?? record.equipment_effect_attachments,
    );
    const equipmentEffectIds = Array.isArray(record.equipmentEffectIds)
      ? record.equipmentEffectIds
      : Array.isArray(record.equipment_effect_ids)
        ? record.equipment_effect_ids
        : [];
    const dedupedEquipmentEffectIds = [
      ...equipmentEffectIds
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => sanitizeIdentifier(entry, ''))
        .filter((entry, index, values) => entry.length > 0 && values.indexOf(entry) === index),
      ...equipmentEffectAttachments
        .map((entry) => sanitizeIdentifier(entry.effectId, ''))
        .filter((entry, index, values) => entry.length > 0 && values.indexOf(entry) === index),
    ]
      .filter((entry, index, values) => values.indexOf(entry) === index)
      .slice(0, 16);
    return {
      equipSize: clampInt(equipSize, 1, 8, 1),
      ...(equipmentEffectAttachments.length > 0 && { equipmentEffectAttachments }),
      equipmentEffectIds: dedupedEquipmentEffectIds,
      slot: sanitizeOptionalText(record.slot, 40),
    };
  }
  if (effectType === 'heal_flat') {
    const curesStatusKinds = sanitizeHealingStatusKinds(record.curesStatusKinds ?? record.cures_status_kinds);
    const curesStatus =
      Boolean(record.curesStatus ?? record.cures_status) || curesStatusKinds.length > 0;
    return {
      healAmount: clampInt(record.healAmount, 1, 9999, 20),
      curesStatus,
      ...(curesStatusKinds.length > 0 && { curesStatusKinds }),
    };
  }
  if (effectType === 'heal_percent') {
    const curesStatusKinds = sanitizeHealingStatusKinds(record.curesStatusKinds ?? record.cures_status_kinds);
    const curesStatus =
      Boolean(record.curesStatus ?? record.cures_status) || curesStatusKinds.length > 0;
    return {
      healPercent: clampNumber(record.healPercent, 0.01, 1, 0.25),
      curesStatus,
      ...(curesStatusKinds.length > 0 && { curesStatusKinds }),
    };
  }
  return {
    actionId: sanitizeIdentifier(record.actionId, 'other-action'),
    successText: sanitizeOptionalText(record.successText, 160),
  };
}

function defaultMisuseText(category: ItemCategory): string {
  if (category === 'tool') {
    return 'You cannot use that tool right now.';
  }
  if (category === 'equipment') {
    return 'No valid critter can equip that right now.';
  }
  if (category === 'healing') {
    return 'Choose a squad critter to heal.';
  }
  if (category === 'material') {
    return 'Materials are used for crafting or shopping.';
  }
  return 'That item cannot be used right now.';
}

function defaultConsumableForCategory(category: ItemCategory, effectType: ItemEffectType): boolean {
  if (effectType === 'heal_flat' || effectType === 'heal_percent') {
    return true;
  }
  if (category === 'tool' || category === 'equipment' || category === 'material') {
    return false;
  }
  return true;
}

function sanitizeIdentifier(raw: unknown, fallback: string): string {
  const normalized =
    typeof raw === 'string'
      ? raw
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+/g, '')
          .replace(/-+$/g, '')
      : '';
  return normalized || fallback;
}

function sanitizeText(raw: unknown, fallback: string, maxLength: number): string {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.slice(0, maxLength);
}

function sanitizeOptionalText(raw: unknown, maxLength: number): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeHealingStatusKinds(raw: unknown): HealingItemStatusConditionKind[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed = raw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry, index, values) => entry.length > 0 && values.indexOf(entry) === index)
    .filter((entry): entry is HealingItemStatusConditionKind => HEALING_ITEM_STATUS_KIND_SET.has(entry as HealingItemStatusConditionKind));
  return HEALING_ITEM_STATUS_CONDITION_KINDS.filter((kind) => parsed.includes(kind));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeOptionalNumber(raw: unknown, min: number, max: number): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return undefined;
  }
  return Math.max(min, Math.min(max, raw));
}

function parseBooleanFlag(raw: unknown): boolean {
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw !== 0;
  }
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }
  return false;
}

function sanitizeEquipmentEffectAttachments(raw: unknown): EquipmentEffectAttachment[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed: EquipmentEffectAttachment[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const effectId = sanitizeIdentifier(record.effectId ?? record.effect_id, '');
    if (!effectId || seen.has(effectId)) {
      continue;
    }

    const modeRaw = typeof record.mode === 'string' ? record.mode.trim().toLowerCase() : '';
    const mode = EQUIPMENT_EFFECT_MODE_SET.has(modeRaw as EquipmentEffectMode)
      ? (modeRaw as EquipmentEffectMode)
      : undefined;
    const hasValue = typeof record.value === 'number' || (typeof record.value === 'string' && record.value.trim().length > 0);
    const parsedValue = parseOptionalNumeric(record.value);
    const value = hasValue || mode
      ? mode === 'flat'
        ? Math.floor(clampNumber(parsedValue ?? 1, -999, 999, 1))
        : clampNumber(parsedValue ?? 0.1, -5, 5, 0.1)
      : undefined;

    const parsedCrit = parseOptionalNumeric(record.critChanceBonus ?? record.crit_chance_bonus);
    const critChanceBonus = parsedCrit == null ? undefined : clampNumber(parsedCrit, 0, 1, 0.05);

    const parsedProcChance = parseOptionalNumeric(record.procChance ?? record.proc_chance);
    const procChance = parsedProcChance == null ? undefined : clampNumber(parsedProcChance, 0, 1, 0.2);

    const persistentModeRaw =
      typeof (record.persistentHealMode ?? record.persistent_heal_mode) === 'string'
        ? String(record.persistentHealMode ?? record.persistent_heal_mode).trim().toLowerCase()
        : '';
    const persistentHealMode = EQUIPMENT_PERSISTENT_HEAL_MODE_SET.has(persistentModeRaw as EquipmentPersistentHealMode)
      ? (persistentModeRaw as EquipmentPersistentHealMode)
      : undefined;
    const parsedPersistentValue = parseOptionalNumeric(record.persistentHealValue ?? record.persistent_heal_value);
    const persistentHealValue =
      persistentHealMode == null && parsedPersistentValue == null
        ? undefined
        : persistentHealMode === 'flat'
          ? Math.max(1, Math.floor(clampNumber(parsedPersistentValue ?? 1, 1, 9999, 1)))
          : clampNumber(parsedPersistentValue ?? 0.05, 0, 1, 0.05);

    const parsedToxicBase = parseOptionalNumeric(record.toxicPotencyBase ?? record.toxic_potency_base);
    const parsedToxicRamp = parseOptionalNumeric(record.toxicPotencyPerTurn ?? record.toxic_potency_per_turn);
    const toxicPotencyBase =
      parsedToxicBase == null && parsedToxicRamp == null
        ? undefined
        : clampNumber(parsedToxicBase ?? 0.05, 0, 1, 0.05);
    const toxicPotencyPerTurn =
      parsedToxicBase == null && parsedToxicRamp == null
        ? undefined
        : clampNumber(parsedToxicRamp ?? 0.05, 0, 1, 0.05);
    const parsedStunFailChance = parseOptionalNumeric(record.stunFailChance ?? record.stun_fail_chance);
    const stunFailChance = parsedStunFailChance == null ? undefined : clampNumber(parsedStunFailChance, 0, 1, 0.25);
    const parsedStunSlowdown = parseOptionalNumeric(record.stunSlowdown ?? record.stun_slowdown);
    const stunSlowdown = parsedStunSlowdown == null ? undefined : clampNumber(parsedStunSlowdown, 0, 1, 0.5);
    const flinchFirstUseOnly = parseBooleanFlag(record.flinchFirstUseOnly ?? record.flinch_first_use_only);
    const flinchFirstOverallOnly = flinchFirstUseOnly && parseBooleanFlag(
      record.flinchFirstOverallOnly ?? record.flinch_first_overall_only,
    );

    parsed.push({
      effectId,
      ...(typeof procChance === 'number' && { procChance }),
      ...(mode && { mode }),
      ...(value != null && { value }),
      ...(typeof critChanceBonus === 'number' && { critChanceBonus }),
      ...(persistentHealMode && { persistentHealMode }),
      ...(typeof persistentHealValue === 'number' && { persistentHealValue }),
      ...(typeof toxicPotencyBase === 'number' && { toxicPotencyBase }),
      ...(typeof toxicPotencyPerTurn === 'number' && { toxicPotencyPerTurn }),
      ...(typeof stunFailChance === 'number' && { stunFailChance }),
      ...(typeof stunSlowdown === 'number' && { stunSlowdown }),
      ...(flinchFirstUseOnly && { flinchFirstUseOnly }),
      ...(flinchFirstOverallOnly && { flinchFirstOverallOnly }),
    });
    seen.add(effectId);
    if (parsed.length >= 16) {
      break;
    }
  }
  return parsed;
}

function parseOptionalNumeric(raw: unknown): number | undefined {
  const parsed =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : typeof raw === 'string' && raw.trim().length > 0
        ? Number.parseFloat(raw)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function deriveValueFromEffectConfig(effectType: ItemEffectType, effectConfig: ItemEffectConfig): number | undefined {
  if (effectType === 'heal_flat') {
    const config = effectConfig as { healAmount?: number };
    return typeof config.healAmount === 'number' && Number.isFinite(config.healAmount)
      ? Math.max(1, Math.floor(config.healAmount))
      : undefined;
  }
  if (effectType === 'tool_action') {
    const config = effectConfig as { power?: number };
    return typeof config.power === 'number' && Number.isFinite(config.power)
      ? clampNumber(config.power, 0, 1, 0)
      : undefined;
  }
  return undefined;
}
