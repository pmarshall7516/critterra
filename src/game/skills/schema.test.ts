import { describe, expect, it } from 'vitest';
import { sanitizeSkillDefinition } from '@/game/skills/schema';

describe('sanitizeSkillDefinition', () => {
  it('preserves explicit healMode/healValue on damage skills and defaults priority', () => {
    const skill = sanitizeSkillDefinition({
      skill_id: 'sap',
      skill_name: 'Sap',
      element: 'bloom',
      type: 'damage',
      damage: 25,
      healMode: 'percent_damage',
      healValue: 0.2,
    });

    expect(skill).toEqual({
      skill_id: 'sap',
      skill_name: 'Sap',
      element: 'bloom',
      type: 'damage',
      priority: 1,
      damage: 25,
      healMode: 'percent_damage',
      healValue: 0.2,
    });
  });

  it('maps legacy healPercent to percent_max_hp healing', () => {
    const skill = sanitizeSkillDefinition({
      skill_id: 'drain-bite',
      skill_name: 'Drain Bite',
      element: 'ember',
      type: 'damage',
      damage: 24,
      healPercent: 0.25,
    });

    expect(skill).toEqual({
      skill_id: 'drain-bite',
      skill_name: 'Drain Bite',
      element: 'ember',
      type: 'damage',
      priority: 1,
      damage: 24,
      healMode: 'percent_max_hp',
      healValue: 0.25,
    });
  });

  it('defaults support skills without heal config to no direct healing', () => {
    const skill = sanitizeSkillDefinition({
      skill_id: 'focus-shout',
      skill_name: 'Focus Shout',
      element: 'spark',
      type: 'support',
    });

    expect(skill).toEqual({
      skill_id: 'focus-shout',
      skill_name: 'Focus Shout',
      element: 'spark',
      type: 'support',
      priority: 1,
    });
  });

  it('preserves explicit effect attachments and clamps buff/proc values', () => {
    const skill = sanitizeSkillDefinition(
      {
        skill_id: 'focus-claw',
        skill_name: 'Focus Claw',
        element: 'normal',
        type: 'support',
        effectAttachments: [
          { effectId: 'atk-buff', buffPercent: 2, procChance: -1 },
          { effectId: 'speed-buff', buffPercent: 0.15, procChance: 0.4 },
        ],
      },
      0,
      new Set(['atk-buff', 'speed-buff']),
      undefined,
      new Map([
        ['atk-buff', 'atk_buff'],
        ['speed-buff', 'speed_buff'],
      ]),
    );

    expect(skill).toMatchObject({
      skill_id: 'focus-claw',
      priority: 1,
      effectAttachments: [
        { effectId: 'atk-buff', buffPercent: 1, procChance: 0 },
        { effectId: 'speed-buff', buffPercent: 0.15, procChance: 0.4 },
      ],
      effectIds: ['atk-buff', 'speed-buff'],
    });
  });

  it('derives effect attachments from legacy effectIds using effect buff fallback values', () => {
    const skill = sanitizeSkillDefinition(
      {
        skill_id: 'flutter',
        skill_name: 'Flutter',
        element: 'bloom',
        type: 'damage',
        damage: 10,
        effectIds: ['speed-buff'],
      },
      0,
      new Set(['speed-buff']),
      new Map([['speed-buff', 0.12]]),
      new Map([['speed-buff', 'speed_buff']]),
    );

    expect(skill).toMatchObject({
      skill_id: 'flutter',
      priority: 1,
      effectAttachments: [{ effectId: 'speed-buff', buffPercent: 0.12, procChance: 1 }],
      effectIds: ['speed-buff'],
    });
  });

  it('defaults recoil fields for recoil effects', () => {
    const skill = sanitizeSkillDefinition(
      {
        skill_id: 'reckless-hit',
        skill_name: 'Reckless Hit',
        element: 'ember',
        type: 'damage',
        damage: 20,
        effectAttachments: [{ effectId: 'recoil', procChance: 0.3 }],
      },
      0,
      new Set(['recoil']),
      undefined,
      new Map([['recoil', 'recoil']]),
    );

    expect(skill).toMatchObject({
      skill_id: 'reckless-hit',
      priority: 1,
      effectAttachments: [
        {
          effectId: 'recoil',
          procChance: 0.3,
          recoilMode: 'percent_max_hp',
          recoilPercent: 0.1,
        },
      ],
    });
  });

  it('clamps recoil config values and priority', () => {
    const skill = sanitizeSkillDefinition(
      {
        skill_id: 'reckless-hit',
        skill_name: 'Reckless Hit',
        element: 'ember',
        type: 'damage',
        damage: 20,
        priority: 9999,
        effectAttachments: [
          {
            effectId: 'recoil',
            procChance: 2,
            recoilMode: 'percent_damage_dealt',
            recoilPercent: -1,
          },
        ],
      },
      0,
      new Set(['recoil']),
      undefined,
      new Map([['recoil', 'recoil']]),
    );

    expect(skill).toMatchObject({
      priority: 999,
      effectAttachments: [
        {
          effectId: 'recoil',
          procChance: 1,
          recoilMode: 'percent_damage_dealt',
          recoilPercent: 0,
        },
      ],
    });
  });

  it('preserves explicit priority when valid', () => {
    const skill = sanitizeSkillDefinition({
      skill_id: 'quick-strike',
      skill_name: 'Quick Strike',
      element: 'normal',
      type: 'damage',
      damage: 30,
      priority: 2,
    });

    expect(skill).toMatchObject({
      skill_id: 'quick-strike',
      priority: 2,
    });
  });
});
