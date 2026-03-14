import { describe, expect, it } from 'vitest';
import { sanitizeAbilityDefinition, sanitizeAbilityLibrary } from '@/game/abilities/schema';

describe('ability schema', () => {
  it('sanitizes mixed legacy fields and keeps duplicate template attachments in order', () => {
    const abilities = sanitizeAbilityLibrary(
      [
        {
          ability_id: 'thorn-shell',
          ability_name: 'Thorn Shell',
          element: 'bloom',
          description: 'Retaliates while guarding.',
          template_attachments: [
            {
              template_type: 'guard-buff',
              mode: 'recoil',
              recoil_mode: 'percent_incoming_damage',
              recoil_value: 0.5,
            },
            {
              template_type: 'guard-buff',
              mode: 'proc',
              proc_target: 'self',
              proc_effect_attachment: {
                effectId: 'focus',
                procChance: 1,
                buffPercent: 0.2,
              },
            },
            {
              template_type: 'damaged-buff',
              trigger_type: 'effect',
              trigger_families: ['def_debuff', 'invalid-family', 'def_debuff'],
              reward_effect_attachment: {
                effectId: 'focus',
                procChance: 1,
                buffPercent: 0.2,
              },
            },
          ],
        },
      ],
      new Set(['focus']),
      new Map([['focus', 0.2]]),
      new Map([['focus', 'crit_buff']]),
      ['bloom', 'normal'],
    );

    expect(abilities).toHaveLength(1);
    expect(abilities[0]).toMatchObject({
      id: 'thorn-shell',
      name: 'Thorn Shell',
      element: 'bloom',
    });
    expect(abilities[0].templateAttachments).toHaveLength(3);
    expect(abilities[0].templateAttachments[0]).toMatchObject({
      templateType: 'guard-buff',
      mode: 'recoil',
      recoilMode: 'percent_incoming_damage',
      recoilValue: 0.5,
    });
    expect(abilities[0].templateAttachments[1]).toMatchObject({
      templateType: 'guard-buff',
      mode: 'proc',
      procTarget: 'self',
      procEffectAttachment: {
        effectId: 'focus',
      },
    });
    expect(abilities[0].templateAttachments[2]).toMatchObject({
      templateType: 'damaged-buff',
      triggerType: 'effect',
      triggerFamilies: ['def_debuff'],
    });
  });

  it('drops invalid elements and unknown reward effects to safe defaults', () => {
    const ability = sanitizeAbilityDefinition(
      {
        id: 'last-stand',
        name: 'Last Stand',
        element: 'mystery',
        templateAttachments: [
          {
            templateType: 'damaged-buff',
            triggerType: 'damage',
            belowPercent: 2,
            rewardEffectAttachment: {
              effectId: 'missing',
              procChance: 1,
            },
          },
        ],
      },
      0,
      new Set(['known-effect']),
      new Map(),
      new Map(),
      ['normal', 'stone'],
    );

    expect(ability).not.toBeNull();
    expect(ability).toMatchObject({
      id: 'last-stand',
      element: 'normal',
    });
    expect(ability?.templateAttachments[0]).toMatchObject({
      templateType: 'damaged-buff',
      triggerType: 'damage',
      belowPercent: 1,
      rewardEffectAttachment: null,
    });
  });
});
