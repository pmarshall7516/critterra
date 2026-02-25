import { describe, expect, it } from 'vitest';
import {
  canEquipAtSlot,
  removeEquipmentAtSlot,
  resolveEquipmentState,
  type ResolvedEquipmentState,
} from '@/game/critters/equipmentSlots';
import type { EquippedEquipmentAnchor } from '@/game/critters/types';

const sizes: Record<string, number> = {
  helmet: 1,
  armor: 2,
  boots: 1,
  banner: 3,
};

function resolveSize(itemId: string): number {
  return sizes[itemId] ?? 1;
}

function state(anchors: EquippedEquipmentAnchor[], slotCount = 4): ResolvedEquipmentState {
  return resolveEquipmentState(anchors, slotCount, resolveSize);
}

describe('equipmentSlots', () => {
  it('resolves multi-slot occupancy from anchors', () => {
    const resolved = state(
      [
        { itemId: 'armor', slotIndex: 0 },
        { itemId: 'boots', slotIndex: 2 },
      ],
      4,
    );
    expect(resolved.slots.map((slot) => slot?.itemId ?? null)).toEqual(['armor', 'armor', 'boots', null]);
  });

  it('drops invalid anchors that overlap existing occupied slots', () => {
    const resolved = state(
      [
        { itemId: 'armor', slotIndex: 0 },
        { itemId: 'helmet', slotIndex: 1 },
      ],
      4,
    );
    expect(resolved.anchors).toEqual([{ itemId: 'armor', slotIndex: 0 }]);
    expect(resolved.slots.map((slot) => slot?.itemId ?? null)).toEqual(['armor', 'armor', null, null]);
  });

  it('prevents duplicate item ids for the same critter', () => {
    const resolved = state(
      [
        { itemId: 'helmet', slotIndex: 0 },
        { itemId: 'helmet', slotIndex: 1 },
      ],
      4,
    );
    expect(resolved.anchors).toEqual([{ itemId: 'helmet', slotIndex: 0 }]);
  });

  it('requires contiguous free slots for multi-slot equipment', () => {
    const resolved = state([{ itemId: 'helmet', slotIndex: 1 }], 3);
    expect(
      canEquipAtSlot({
        state: resolved,
        slotIndex: 0,
        itemId: 'armor',
        equipSize: 2,
      }),
    ).toBe(false);
    expect(
      canEquipAtSlot({
        state: resolved,
        slotIndex: 1,
        itemId: 'armor',
        equipSize: 2,
      }),
    ).toBe(false);
    expect(
      canEquipAtSlot({
        state: resolved,
        slotIndex: 0,
        itemId: 'boots',
        equipSize: 1,
      }),
    ).toBe(true);
  });

  it('unequips an entire anchored item when removing any occupied slot', () => {
    const resolved = state([{ itemId: 'banner', slotIndex: 0 }], 4);
    const nextAnchors = removeEquipmentAtSlot(resolved, 2);
    expect(nextAnchors).toEqual([]);
  });
});

