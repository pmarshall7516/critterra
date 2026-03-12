import { describe, expect, it } from 'vitest';
import { resolveEquipmentEffectInstancesForItem } from '@/game/equipmentEffects/resolver';
import type { EquipmentEffectDefinition } from '@/game/equipmentEffects/types';
import type { GameItemDefinition } from '@/game/items/types';

function buildLookup(effects: EquipmentEffectDefinition[]): Map<string, EquipmentEffectDefinition> {
  return new Map(effects.map((entry) => [entry.effect_id, entry] as const));
}

describe('resolveEquipmentEffectInstancesForItem', () => {
  it('uses item attachment values as the primary source', () => {
    const lookup = buildLookup([
      {
        effect_id: 'equip-def-buff',
        effect_name: 'Equip Def Buff',
        effect_type: 'def_buff',
        description: '',
        modifiers: [{ stat: 'defense', mode: 'flat', value: 1 }],
      },
    ]);
    const item: Pick<GameItemDefinition, 'category' | 'effectType' | 'effectConfig'> = {
      category: 'equipment',
      effectType: 'equip_effect',
      effectConfig: {
        equipmentEffectIds: ['equip-def-buff'],
        equipmentEffectAttachments: [{ effectId: 'equip-def-buff', mode: 'flat', value: 4 }],
      },
    };

    const instances = resolveEquipmentEffectInstancesForItem(item, lookup);
    expect(instances).toEqual([
      {
        effectId: 'equip-def-buff',
        effectType: 'def_buff',
        mode: 'flat',
        value: 4,
      },
    ]);
  });

  it('synthesizes attachment instances from legacy id-only equipment config', () => {
    const lookup = buildLookup([
      {
        effect_id: 'equip-atk-buff',
        effect_name: 'Equip Atk Buff',
        effect_type: 'atk_buff',
        description: '',
        modifiers: [{ stat: 'attack', mode: 'percent', value: 0.2 }],
      },
      {
        effect_id: 'equip-persistent-heal',
        effect_name: 'Equip Persistent Heal',
        effect_type: 'persistent_heal',
        description: '',
        modifiers: [],
        persistentHeal: {
          mode: 'flat',
          value: 3,
        },
      },
    ]);
    const item: Pick<GameItemDefinition, 'category' | 'effectType' | 'effectConfig'> = {
      category: 'equipment',
      effectType: 'equip_effect',
      effectConfig: {
        equipmentEffectIds: ['equip-atk-buff', 'equip-persistent-heal'],
      },
    };

    const instances = resolveEquipmentEffectInstancesForItem(item, lookup);
    expect(instances).toEqual([
      {
        effectId: 'equip-atk-buff',
        effectType: 'atk_buff',
        mode: 'percent',
        value: 0.2,
      },
      {
        effectId: 'equip-persistent-heal',
        effectType: 'persistent_heal',
        persistentHealMode: 'flat',
        persistentHealValue: 3,
      },
    ]);
  });

  it('sanitizes and clamps attachment values by effect type', () => {
    const lookup = buildLookup([
      {
        effect_id: 'equip-speed-buff',
        effect_name: 'Equip Speed Buff',
        effect_type: 'speed_buff',
        description: '',
        modifiers: [{ stat: 'speed', mode: 'percent', value: 0.1 }],
      },
      {
        effect_id: 'equip-crit-buff',
        effect_name: 'Equip Crit Buff',
        effect_type: 'crit_buff',
        description: '',
        modifiers: [],
      },
      {
        effect_id: 'equip-persistent-heal',
        effect_name: 'Equip Persistent Heal',
        effect_type: 'persistent_heal',
        description: '',
        modifiers: [],
      },
    ]);
    const item: Pick<GameItemDefinition, 'category' | 'effectType' | 'effectConfig'> = {
      category: 'equipment',
      effectType: 'equip_effect',
      effectConfig: {
        equipmentEffectAttachments: [
          { effectId: 'equip-speed-buff', mode: 'percent', value: 99 },
          { effectId: 'equip-crit-buff', critChanceBonus: -3 },
          { effectId: 'equip-persistent-heal', persistentHealMode: 'flat', persistentHealValue: -5 },
        ],
      },
    };

    const instances = resolveEquipmentEffectInstancesForItem(item, lookup);
    expect(instances).toEqual([
      {
        effectId: 'equip-speed-buff',
        effectType: 'speed_buff',
        mode: 'percent',
        value: 5,
      },
      {
        effectId: 'equip-crit-buff',
        effectType: 'crit_buff',
        critChanceBonus: 0,
      },
      {
        effectId: 'equip-persistent-heal',
        effectType: 'persistent_heal',
        persistentHealMode: 'flat',
        persistentHealValue: 1,
      },
    ]);
  });
});
