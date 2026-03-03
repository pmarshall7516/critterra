import type { EquippedSkillSlots } from '@/game/critters/types';

export function equipSkillInUniqueSlot(
  equippedSkillIds: EquippedSkillSlots,
  slotIndex: number,
  skillId: string | null,
): EquippedSkillSlots {
  const next = [...equippedSkillIds] as EquippedSkillSlots;
  if (slotIndex < 0 || slotIndex >= next.length) {
    return next;
  }

  if (skillId === null) {
    next[slotIndex] = null;
    return next;
  }

  for (let index = 0; index < next.length; index += 1) {
    if (index !== slotIndex && next[index] === skillId) {
      next[index] = null;
    }
  }
  next[slotIndex] = skillId;
  return next;
}

export function autoEquipSkillsInOpenSlots(
  equippedSkillIds: EquippedSkillSlots,
  skillIds: string[],
): EquippedSkillSlots {
  let next = [...equippedSkillIds] as EquippedSkillSlots;
  for (const skillId of skillIds) {
    if (!skillId || next.includes(skillId)) {
      continue;
    }
    const openSlotIndex = next.findIndex((id) => id === null);
    if (openSlotIndex < 0) {
      break;
    }
    next = equipSkillInUniqueSlot(next, openSlotIndex, skillId);
  }
  return next;
}

export function areEquippedSkillSlotsEqual(
  left: EquippedSkillSlots,
  right: EquippedSkillSlots,
): boolean {
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}
