import { describe, expect, it } from 'vitest';
import { sanitizeEquipmentEffectDefinition } from '@/game/equipmentEffects/schema';

describe('sanitizeEquipmentEffectDefinition', () => {
  it('infers stat buff types from legacy modifiers', () => {
    const effect = sanitizeEquipmentEffectDefinition(
      {
        effect_id: 'legacy-atk',
        effect_name: 'Legacy Atk',
        modifiers: [{ stat: 'attack', mode: 'percent', value: 0.25 }],
      },
      0,
    );
    expect(effect).not.toBeNull();
    expect(effect?.effect_type).toBe('atk_buff');
  });

  it('infers persistent heal type from legacy heal fields', () => {
    const effect = sanitizeEquipmentEffectDefinition(
      {
        effect_id: 'legacy-regen',
        effect_name: 'Legacy Regen',
        persistentHealMode: 'flat',
        persistentHealValue: 4,
      },
      0,
    );
    expect(effect).not.toBeNull();
    expect(effect?.effect_type).toBe('persistent_heal');
    expect(effect?.persistentHeal).toEqual({
      mode: 'flat',
      value: 4,
    });
  });

  it('infers crit buff from id/name hints when no stat metadata exists', () => {
    const effect = sanitizeEquipmentEffectDefinition(
      {
        effect_id: 'crit-booster',
        effect_name: 'Critical Booster',
        description: 'Raises crit chance while equipped.',
      },
      0,
    );
    expect(effect).not.toBeNull();
    expect(effect?.effect_type).toBe('crit_buff');
  });
});
