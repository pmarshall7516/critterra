import { describe, expect, it } from 'vitest';
import { sanitizeItemDefinition } from '@/game/items/schema';

describe('sanitizeItemDefinition', () => {
  it('defaults equipment category to equip_effect and parses equipment fields', () => {
    const item = sanitizeItemDefinition(
      {
        id: 'simple-helmet',
        name: 'Simple Helmet',
        category: 'equipment',
        effectConfig: {
          equipSize: 2,
          equipmentEffectIds: ['def-up-flat', 'def-up-flat', 'def-up-percent'],
        },
      },
      0,
    );

    expect(item).not.toBeNull();
    expect(item?.effectType).toBe('equip_effect');
    expect(item?.consumable).toBe(false);
    expect(item?.effectConfig).toMatchObject({
      equipSize: 2,
      equipmentEffectIds: ['def-up-flat', 'def-up-percent'],
    });
  });

  it('keeps legacy equip_stub and normalizes equipment fields', () => {
    const item = sanitizeItemDefinition(
      {
        id: 'legacy-armor',
        name: 'Legacy Armor',
        category: 'equipment',
        effectType: 'equip_stub',
        effectConfig: {
          equip_size: 3,
          equipment_effect_ids: ['bulk-up'],
        },
      },
      0,
    );

    expect(item).not.toBeNull();
    expect(item?.effectType).toBe('equip_stub');
    expect(item?.effectConfig).toMatchObject({
      equipSize: 3,
      equipmentEffectIds: ['bulk-up'],
    });
  });
});

