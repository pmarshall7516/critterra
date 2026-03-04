import { describe, expect, it } from 'vitest';
import { sanitizeSkillDefinition } from '@/game/skills/schema';

describe('sanitizeSkillDefinition', () => {
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
});
