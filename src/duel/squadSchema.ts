import { computeCritterDerivedProgress, computeCritterUnlockedEquipSlots } from '@/game/critters/schema';
import type { CritterDefinition } from '@/game/critters/types';
import type { GameItemDefinition } from '@/game/items/types';
import type { SkillDefinition } from '@/game/skills/types';
import type { DuelCatalogContent, DuelCatalogIndexes, DuelSquad, DuelSquadMember } from '@/duel/types';

export interface DuelValidationIssue {
  path: string;
  message: string;
}

export interface DuelSquadDraft {
  id?: string;
  name: string;
  sortIndex?: number;
  members: Array<{
    critterId: number;
    level: number;
    equippedAbilityId: string | null;
    equippedSkillIds: Array<string | null>;
    equippedItems: Array<{
      itemId: string;
      slotIndex: number;
    }>;
  }>;
}

export interface DuelSquadValidationResult {
  ok: boolean;
  issues: DuelValidationIssue[];
  squad?: {
    id?: string;
    name: string;
    sortIndex?: number;
    members: DuelSquadMember[];
  };
}

export function buildDuelCatalogIndexes(catalogs: DuelCatalogContent): DuelCatalogIndexes {
  return {
    critterById: new Map(catalogs.critters.map((entry) => [entry.id, entry] as const)),
    abilityById: new Map(catalogs.abilities.map((entry) => [entry.id, entry] as const)),
    itemById: new Map(catalogs.items.map((entry) => [entry.id, entry] as const)),
    skillById: new Map(catalogs.skills.map((entry) => [entry.skill_id, entry] as const)),
    skillEffectById: new Map(catalogs.skillEffects.map((entry) => [entry.effect_id, entry] as const)),
    equipmentEffectById: new Map(catalogs.equipmentEffects.map((entry) => [entry.effect_id, entry] as const)),
  };
}

export function getEquipmentTypeKey(item: GameItemDefinition): string {
  const effectConfig = item.effectConfig as { slot?: string };
  const rawSlot = typeof effectConfig.slot === 'string' ? effectConfig.slot.trim().toLowerCase() : '';
  return rawSlot || item.id;
}

export function toSavedSquadPayload(squad: DuelSquadDraft, indexes: DuelCatalogIndexes): DuelSquadValidationResult {
  const issues: DuelValidationIssue[] = [];
  const trimmedName = squad.name.trim();
  if (!trimmedName) {
    issues.push({ path: 'name', message: 'Squad name is required.' });
  }
  if (squad.members.length < 1 || squad.members.length > 8) {
    issues.push({ path: 'members', message: 'Squad must contain between 1 and 8 critters.' });
  }

  const seenCritterIds = new Set<number>();
  const normalizedMembers: DuelSquadMember[] = [];
  squad.members.forEach((member, memberIndex) => {
    const critterPath = `members.${memberIndex}`;
    const critter = indexes.critterById.get(member.critterId);
    if (!critter) {
      issues.push({ path: `${critterPath}.critterId`, message: 'Critter does not exist.' });
      return;
    }
    if (seenCritterIds.has(member.critterId)) {
      issues.push({ path: `${critterPath}.critterId`, message: 'Duplicate critter species is not allowed.' });
      return;
    }
    seenCritterIds.add(member.critterId);

    const maxLevel = resolveCritterMaxLevel(critter);
    const level = Math.max(1, Math.floor(member.level));
    if (level < 1 || level > maxLevel || level !== member.level) {
      issues.push({
        path: `${critterPath}.level`,
        message: `Level must be an integer between 1 and ${maxLevel}.`,
      });
      return;
    }

    const derived = computeCritterDerivedProgress(critter, level);
    const unlockedSkills = new Set(derived.unlockedSkillIds);
    const unlockedAbilities = new Set(derived.unlockedAbilityIds);
    const normalizedAbilityId = normalizeAbilityId(
      member.equippedAbilityId,
      critterPath,
      unlockedAbilities,
      indexes.abilityById,
      issues,
    );
    const normalizedSkillSlots = normalizeSkillSlots(member.equippedSkillIds, critterPath, unlockedSkills, indexes.skillById, issues);

    const equipSlotCount = computeCritterUnlockedEquipSlots(critter, level);
    const normalizedItems = normalizeEquippedItems(
      member.equippedItems,
      critterPath,
      equipSlotCount,
      indexes.itemById,
      issues,
    );

    if (issues.some((issue) => issue.path.startsWith(critterPath))) {
      return;
    }

    normalizedMembers.push({
      critterId: member.critterId,
      level,
      equippedAbilityId: normalizedAbilityId,
      equippedSkillIds: normalizedSkillSlots,
      equippedItems: normalizedItems,
    });
  });

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
    };
  }

  return {
    ok: true,
    issues: [],
    squad: {
      ...(squad.id ? { id: squad.id } : {}),
      name: trimmedName.slice(0, 40),
      ...(typeof squad.sortIndex === 'number' && Number.isFinite(squad.sortIndex)
        ? { sortIndex: Math.max(0, Math.floor(squad.sortIndex)) }
        : {}),
      members: normalizedMembers,
    },
  };
}

export function toDuelDraftFromSavedSquad(squad: DuelSquad): DuelSquadDraft {
  return {
    id: squad.id,
    name: squad.name,
    sortIndex: squad.sortIndex,
    members: squad.members.map((member) => ({
      critterId: member.critterId,
      level: member.level,
      equippedAbilityId: member.equippedAbilityId ?? null,
      equippedSkillIds: [...member.equippedSkillIds],
      equippedItems: member.equippedItems.map((item) => ({
        itemId: item.itemId,
        slotIndex: item.slotIndex,
      })),
    })),
  };
}

function resolveCritterMaxLevel(critter: CritterDefinition): number {
  const maxConfigured = critter.levels.reduce((max, row) => Math.max(max, row.level), 1);
  return Math.max(1, maxConfigured);
}

function normalizeSkillSlots(
  rawSkillSlots: Array<string | null>,
  critterPath: string,
  unlockedSkills: Set<string>,
  skillById: Map<string, SkillDefinition>,
  issues: DuelValidationIssue[],
): [string | null, string | null, string | null, string | null] {
  if (rawSkillSlots.length > 4) {
    issues.push({ path: `${critterPath}.equippedSkillIds`, message: 'A critter can equip up to 4 skills.' });
  }
  const normalized: [string | null, string | null, string | null, string | null] = [null, null, null, null];
  const seenSkillIds = new Set<string>();
  for (let slot = 0; slot < 4; slot += 1) {
    const value = rawSkillSlots[slot];
    if (!value) {
      normalized[slot] = null;
      continue;
    }
    const skillId = normalizeCatalogId(value);
    if (!skillId || !skillById.has(skillId)) {
      issues.push({
        path: `${critterPath}.equippedSkillIds.${slot}`,
        message: 'Selected skill does not exist.',
      });
      continue;
    }
    if (!unlockedSkills.has(skillId)) {
      issues.push({
        path: `${critterPath}.equippedSkillIds.${slot}`,
        message: 'Selected skill is not unlocked at this level.',
      });
      continue;
    }
    if (seenSkillIds.has(skillId)) {
      issues.push({
        path: `${critterPath}.equippedSkillIds.${slot}`,
        message: 'Duplicate equipped skills are not allowed.',
      });
      continue;
    }
    seenSkillIds.add(skillId);
    normalized[slot] = skillId;
  }
  return normalized;
}

function normalizeAbilityId(
  rawAbilityId: string | null | undefined,
  critterPath: string,
  unlockedAbilities: Set<string>,
  abilityById: Map<string, { id: string }>,
  issues: DuelValidationIssue[],
): string | null {
  if (!rawAbilityId) {
    return null;
  }
  const abilityId = normalizeCatalogId(rawAbilityId);
  if (!abilityId || !abilityById.has(abilityId)) {
    issues.push({
      path: `${critterPath}.equippedAbilityId`,
      message: 'Selected ability does not exist.',
    });
    return null;
  }
  if (!unlockedAbilities.has(abilityId)) {
    issues.push({
      path: `${critterPath}.equippedAbilityId`,
      message: 'Selected ability is not unlocked at this level.',
    });
    return null;
  }
  return abilityId;
}

function normalizeEquippedItems(
  rawItems: Array<{ itemId: string; slotIndex: number }>,
  critterPath: string,
  slotCount: number,
  itemById: Map<string, GameItemDefinition>,
  issues: DuelValidationIssue[],
): Array<{ itemId: string; slotIndex: number }> {
  if (slotCount <= 0 && rawItems.length > 0) {
    issues.push({
      path: `${critterPath}.equippedItems`,
      message: 'This critter has no unlocked equipment slots at this level.',
    });
    return [];
  }

  const seenItemIds = new Set<string>();
  const seenTypeKeys = new Set<string>();
  const occupancy = Array.from({ length: Math.max(0, slotCount) }, () => false);
  const normalized: Array<{ itemId: string; slotIndex: number; equipSize: number }> = [];

  for (let index = 0; index < rawItems.length; index += 1) {
    const entry = rawItems[index];
    const itemId = normalizeCatalogId(entry.itemId);
    const slotIndex = Number.isFinite(entry.slotIndex) ? Math.floor(entry.slotIndex) : -1;
    const item = itemById.get(itemId);

    if (!item || item.category !== 'equipment' || !item.isActive) {
      issues.push({
        path: `${critterPath}.equippedItems.${index}`,
        message: 'Only active equipment items can be equipped.',
      });
      continue;
    }

    if (seenItemIds.has(itemId)) {
      issues.push({
        path: `${critterPath}.equippedItems.${index}`,
        message: 'Duplicate equipped item is not allowed.',
      });
      continue;
    }

    const typeKey = getEquipmentTypeKey(item);
    if (seenTypeKeys.has(typeKey)) {
      issues.push({
        path: `${critterPath}.equippedItems.${index}`,
        message: 'Only one item of each equipment type can be equipped.',
      });
      continue;
    }

    const equipSize = resolveEquipSize(item);
    if (slotIndex < 0 || slotIndex >= slotCount || slotIndex + equipSize > slotCount) {
      issues.push({
        path: `${critterPath}.equippedItems.${index}.slotIndex`,
        message: 'Equipment slot placement is outside unlocked slots.',
      });
      continue;
    }

    let overlaps = false;
    for (let i = slotIndex; i < slotIndex + equipSize; i += 1) {
      if (occupancy[i]) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) {
      issues.push({
        path: `${critterPath}.equippedItems.${index}.slotIndex`,
        message: 'Equipment slots overlap with another equipped item.',
      });
      continue;
    }

    for (let i = slotIndex; i < slotIndex + equipSize; i += 1) {
      occupancy[i] = true;
    }
    seenItemIds.add(itemId);
    seenTypeKeys.add(typeKey);
    normalized.push({ itemId, slotIndex, equipSize });
  }

  normalized.sort((left, right) => left.slotIndex - right.slotIndex || left.itemId.localeCompare(right.itemId));
  return normalized.map((entry) => ({
    itemId: entry.itemId,
    slotIndex: entry.slotIndex,
  }));
}

function resolveEquipSize(item: GameItemDefinition): number {
  const effect = item.effectConfig as { equipSize?: number };
  if (typeof effect.equipSize !== 'number' || !Number.isFinite(effect.equipSize)) {
    return 1;
  }
  return Math.max(1, Math.min(8, Math.floor(effect.equipSize)));
}

function normalizeCatalogId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}
