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

  it('normalizes equipment effect attachments and merges ids', () => {
    const item = sanitizeItemDefinition(
      {
        id: 'hybrid-charm',
        name: 'Hybrid Charm',
        category: 'equipment',
        effectType: 'equip_effect',
        effectConfig: {
          equipSize: 2,
          equipmentEffectIds: ['legacy-def', 'legacy-def'],
          equipmentEffectAttachments: [
            { effectId: 'equip-def-buff', mode: 'percent', value: 9 },
            { effectId: 'equip-atk-buff', mode: 'flat', value: '12.8' },
            { effectId: 'equip-crit-buff', critChanceBonus: 2 },
            { effect_id: 'equip-persistent-heal', persistent_heal_mode: 'flat', persistent_heal_value: -4 },
          ],
        },
      },
      0,
    );

    expect(item).not.toBeNull();
    expect(item?.effectConfig).toMatchObject({
      equipSize: 2,
      equipmentEffectIds: [
        'legacy-def',
        'equip-def-buff',
        'equip-atk-buff',
        'equip-crit-buff',
        'equip-persistent-heal',
      ],
      equipmentEffectAttachments: [
        { effectId: 'equip-def-buff', mode: 'percent', value: 5 },
        { effectId: 'equip-atk-buff', mode: 'flat', value: 12 },
        { effectId: 'equip-crit-buff', critChanceBonus: 1 },
        { effectId: 'equip-persistent-heal', persistentHealMode: 'flat', persistentHealValue: 1 },
      ],
    });
  });

  it('normalizes healing cure status kinds and infers curesStatus from selected kinds', () => {
    const item = sanitizeItemDefinition(
      {
        id: 'status-berry',
        name: 'Status Berry',
        category: 'healing',
        effectType: 'heal_flat',
        effectConfig: {
          healAmount: 14,
          curesStatusKinds: ['stun', 'toxic', 'stun', 'unknown'],
        },
      },
      0,
    );

    expect(item).not.toBeNull();
    expect(item?.effectConfig).toMatchObject({
      healAmount: 14,
      curesStatus: true,
      curesStatusKinds: ['toxic', 'stun'],
    });
  });

  it('supports legacy curesStatus=true without explicit cure kind list', () => {
    const item = sanitizeItemDefinition(
      {
        id: 'legacy-cleanse-berry',
        name: 'Legacy Cleanse Berry',
        category: 'healing',
        effectType: 'heal_percent',
        effectConfig: {
          healPercent: 0.4,
          curesStatus: true,
        },
      },
      0,
    );

    expect(item).not.toBeNull();
    expect(item?.effectConfig).toMatchObject({
      healPercent: 0.4,
      curesStatus: true,
    });
    expect((item?.effectConfig as any).curesStatusKinds).toBeUndefined();
  });
});
