import { describe, expect, it } from 'vitest';
import { areEquippedSkillSlotsEqual, equipSkillInUniqueSlot } from '@/game/critters/equippedSkills';
import type { EquippedSkillSlots } from '@/game/critters/types';

describe('equipSkillInUniqueSlot', () => {
  it('moves an already-equipped skill into the new slot and clears the old slot', () => {
    const current: EquippedSkillSlots = ['spark-bite', 'tackle', null, null];
    const next = equipSkillInUniqueSlot(current, 2, 'spark-bite');
    expect(next).toEqual([null, 'tackle', 'spark-bite', null]);
  });

  it('equips a new skill into target slot', () => {
    const current: EquippedSkillSlots = ['spark-bite', 'tackle', null, null];
    const next = equipSkillInUniqueSlot(current, 2, 'water-pulse');
    expect(next).toEqual(['spark-bite', 'tackle', 'water-pulse', null]);
  });

  it('clears target slot when skillId is null', () => {
    const current: EquippedSkillSlots = ['spark-bite', 'tackle', 'water-pulse', null];
    const next = equipSkillInUniqueSlot(current, 1, null);
    expect(next).toEqual(['spark-bite', null, 'water-pulse', null]);
  });
});

describe('areEquippedSkillSlotsEqual', () => {
  it('detects equal and non-equal equipped slots', () => {
    const a: EquippedSkillSlots = ['spark-bite', null, null, null];
    const b: EquippedSkillSlots = ['spark-bite', null, null, null];
    const c: EquippedSkillSlots = [null, 'spark-bite', null, null];
    expect(areEquippedSkillSlotsEqual(a, b)).toBe(true);
    expect(areEquippedSkillSlotsEqual(a, c)).toBe(false);
  });
});
