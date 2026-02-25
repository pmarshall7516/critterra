import type { EquippedEquipmentAnchor } from '@/game/critters/types';

export interface EquippedEquipmentSlot {
  itemId: string;
  anchorSlotIndex: number;
  spanIndex: number;
  equipSize: number;
}

export interface ResolvedEquipmentState {
  anchors: EquippedEquipmentAnchor[];
  slots: Array<EquippedEquipmentSlot | null>;
}

export function normalizeEquipSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(8, Math.floor(value)));
}

export function resolveEquipmentState(
  anchors: EquippedEquipmentAnchor[],
  equipSlotCount: number,
  resolveEquipSize: (itemId: string) => number,
): ResolvedEquipmentState {
  const slotCount = Math.max(0, Math.min(8, Math.floor(equipSlotCount)));
  const slots: Array<EquippedEquipmentSlot | null> = Array.from({ length: slotCount }, () => null);
  if (!Array.isArray(anchors) || anchors.length === 0 || slotCount <= 0) {
    return {
      anchors: [],
      slots,
    };
  }

  const sortedAnchors = [...anchors].sort(
    (left, right) => left.slotIndex - right.slotIndex || left.itemId.localeCompare(right.itemId),
  );
  const validAnchors: EquippedEquipmentAnchor[] = [];
  const seenItems = new Set<string>();

  for (const anchor of sortedAnchors) {
    if (!anchor || typeof anchor !== 'object') {
      continue;
    }
    const itemId = typeof anchor.itemId === 'string' ? anchor.itemId.trim() : '';
    const slotIndex = Number.isFinite(anchor.slotIndex) ? Math.floor(anchor.slotIndex) : -1;
    if (!itemId || slotIndex < 0 || slotIndex >= slotCount || seenItems.has(itemId)) {
      continue;
    }
    const equipSize = normalizeEquipSize(resolveEquipSize(itemId));
    const slotEnd = slotIndex + equipSize;
    if (slotEnd > slotCount) {
      continue;
    }
    let blocked = false;
    for (let i = slotIndex; i < slotEnd; i += 1) {
      if (slots[i] !== null) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      continue;
    }
    seenItems.add(itemId);
    validAnchors.push({
      itemId,
      slotIndex,
    });
    for (let i = slotIndex; i < slotEnd; i += 1) {
      slots[i] = {
        itemId,
        anchorSlotIndex: slotIndex,
        spanIndex: i - slotIndex,
        equipSize,
      };
    }
  }

  return {
    anchors: validAnchors,
    slots,
  };
}

export interface CanEquipAtSlotInput {
  state: ResolvedEquipmentState;
  slotIndex: number;
  itemId: string;
  equipSize: number;
}

export function canEquipAtSlot(input: CanEquipAtSlotInput): boolean {
  const slotIndex = Math.floor(input.slotIndex);
  const equipSize = normalizeEquipSize(input.equipSize);
  if (!input.itemId.trim()) {
    return false;
  }
  if (slotIndex < 0 || slotIndex + equipSize > input.state.slots.length) {
    return false;
  }
  if (input.state.anchors.some((anchor) => anchor.itemId === input.itemId)) {
    return false;
  }
  for (let i = slotIndex; i < slotIndex + equipSize; i += 1) {
    if (input.state.slots[i] !== null) {
      return false;
    }
  }
  return true;
}

export function removeEquipmentAtSlot(state: ResolvedEquipmentState, slotIndex: number): EquippedEquipmentAnchor[] {
  const slot = state.slots[Math.floor(slotIndex)];
  if (!slot) {
    return state.anchors;
  }
  return state.anchors.filter(
    (anchor) => !(anchor.itemId === slot.itemId && anchor.slotIndex === slot.anchorSlotIndex),
  );
}

