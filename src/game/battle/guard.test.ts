import { describe, expect, it } from 'vitest';
import { getGuardSuccessChance, rollGuard } from '@/game/battle/guard';

describe('battle guard', () => {
  it('computes canonical guard success chance (0.5^streak)', () => {
    expect(getGuardSuccessChance(0)).toBe(1);
    expect(getGuardSuccessChance(1)).toBe(0.5);
    expect(getGuardSuccessChance(2)).toBe(0.25);
    expect(getGuardSuccessChance(3)).toBe(0.125);
  });

  it('increments streak on success and resets on failure', () => {
    const success = rollGuard(2, () => 0); // always < chance
    expect(success.succeeded).toBe(true);
    expect(success.nextConsecutiveSuccessfulCount).toBe(3);

    const fail = rollGuard(2, () => 0.99); // always >= chance
    expect(fail.succeeded).toBe(false);
    expect(fail.nextConsecutiveSuccessfulCount).toBe(0);
  });
});

