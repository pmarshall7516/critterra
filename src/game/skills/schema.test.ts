import { describe, expect, it } from 'vitest';
import { sanitizeSkillDefinition } from '@/game/skills/schema';

describe('sanitizeSkillDefinition', () => {
  it('preserves explicit healMode/healValue on damage skills', () => {
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
      damage: 24,
      healMode: 'percent_max_hp',
      healValue: 0.25,
    });
  });

  it('migrates legacy support healPercent to percent_max_hp heal config', () => {
    const skill = sanitizeSkillDefinition({
      skill_id: 'calm-song',
      skill_name: 'Calm Song',
      element: 'bloom',
      type: 'support',
      healPercent: 0.25,
    });

    expect(skill).toMatchObject({
      skill_id: 'calm-song',
      type: 'support',
      healMode: 'percent_max_hp',
      healValue: 0.25,
    });
  });

  it('allows support skills to explicitly disable direct healing', () => {
    const skill = sanitizeSkillDefinition({
      skill_id: 'iron-wall',
      skill_name: 'Iron Wall',
      element: 'stone',
      type: 'support',
      healMode: 'none',
    });

    expect(skill).toEqual({
      skill_id: 'iron-wall',
      skill_name: 'Iron Wall',
      element: 'stone',
      type: 'support',
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
    });
  });

  it('preserves explicit damage heal modes', () => {
    const skill = sanitizeSkillDefinition({
      skill_id: 'drain-bite',
      skill_name: 'Drain Bite',
      element: 'shade',
      type: 'damage',
      damage: 30,
      healMode: 'percent_damage',
      healValue: 0.5,
    });

    expect(skill).toMatchObject({
      skill_id: 'drain-bite',
      type: 'damage',
      damage: 30,
      healMode: 'percent_damage',
      healValue: 0.5,
    });
  });

  it('normalizes support percent-damage healing to percent_max_hp', () => {
    const skill = sanitizeSkillDefinition({
      skill_id: 'focus-rest',
      skill_name: 'Focus Rest',
      element: 'bloom',
      type: 'support',
      healMode: 'percent_damage',
      healValue: 0.3,
    });

    expect(skill).toEqual({
      skill_id: 'focus-rest',
      skill_name: 'Focus Rest',
      element: 'bloom',
      type: 'support',
      healMode: 'percent_max_hp',
      healValue: 0.3,
    });
  });

  it('preserves persistent healing fields', () => {
    const skill = sanitizeSkillDefinition({
      skill_id: 'aqua-ring',
      skill_name: 'Aqua Ring',
      element: 'tide',
      type: 'support',
      persistentHealMode: 'flat',
      persistentHealValue: 3,
      persistentHealDurationTurns: 3,
    });

    expect(skill).toMatchObject({
      skill_id: 'aqua-ring',
      type: 'support',
      persistentHealMode: 'flat',
      persistentHealValue: 3,
      persistentHealDurationTurns: 3,
    });
  });

  it('drops invalid persistent healing modes when no percent fallback applies', () => {
    const skill = sanitizeSkillDefinition({
      skill_id: 'broken-ring',
      skill_name: 'Broken Ring',
      element: 'tide',
      type: 'damage',
      damage: 20,
      persistentHealMode: 'percent_damage',
      persistentHealValue: 3,
      persistentHealDurationTurns: 2,
    });

    expect(skill).toMatchObject({
      skill_id: 'broken-ring',
      type: 'damage',
      damage: 20,
    });
    expect(skill).not.toHaveProperty('persistentHealMode');
    expect(skill).not.toHaveProperty('persistentHealValue');
    expect(skill).not.toHaveProperty('persistentHealDurationTurns');
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
    );

    expect(skill).toMatchObject({
      skill_id: 'focus-claw',
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
    );

    expect(skill).toMatchObject({
      skill_id: 'flutter',
      effectAttachments: [{ effectId: 'speed-buff', buffPercent: 0.12, procChance: 1 }],
      effectIds: ['speed-buff'],
    });
  });
});
