import { describe, expect, it } from 'vitest';
import {
  BASE_CRIT_CHANCE,
  computeBattleDamage,
  type ComputeBattleDamageParams,
} from '@/game/battle/damageAndEffects';
import { buildDefaultElementChart } from '@/game/skills/schema';

const elementChart = buildDefaultElementChart();

function baseParams(overrides?: Partial<ComputeBattleDamageParams>): ComputeBattleDamageParams {
  return {
    attacker: { level: 25, attack: 20, attackModifier: 1, element: 'normal' },
    defender: {
      defense: 15,
      defenseModifier: 1,
      guardActive: false,
      element: 'normal',
      currentHp: 100,
    },
    skill: { damage: 40, element: 'normal' },
    elementChart,
    rng: () => 0.5,
    ...overrides,
  };
}

describe('computeBattleDamage', () => {
  it('uses base + additive bonus for crit chance (e.g. 0.5 = +50%)', () => {
    const rngAlwaysCrit = () => 0;

    const noBonus = computeBattleDamage({
      ...baseParams({ rng: rngAlwaysCrit }),
      consumedCritBonus: 0,
    });
    expect(noBonus.isCrit).toBe(true);

    const withHalfBonus = computeBattleDamage({
      ...baseParams({ rng: rngAlwaysCrit }),
      consumedCritBonus: 0.5,
    });
    expect(withHalfBonus.isCrit).toBe(true);

    const rngJustAboveBase = () => BASE_CRIT_CHANCE + 0.001;
    const noBonusNoCrit = computeBattleDamage({
      ...baseParams({ rng: rngJustAboveBase }),
      consumedCritBonus: 0,
    });
    expect(noBonusNoCrit.isCrit).toBe(false);

    const withBonusCrit = computeBattleDamage({
      ...baseParams({ rng: rngJustAboveBase }),
      consumedCritBonus: 0.5,
    });
    expect(withBonusCrit.isCrit).toBe(true);
  });

  it('on crit, ignores defense buffs but still applies defense debuffs', () => {
    const forceCritRng = () => 0;

    const defenderNoBuff = baseParams({
      defender: {
        defense: 20,
        defenseModifier: 1,
        guardActive: false,
        element: 'normal',
        currentHp: 200,
      },
      rng: forceCritRng,
      consumedCritBonus: 1,
    });

    const defenderWithBuff = baseParams({
      defender: {
        defense: 20,
        defenseModifier: 1.5,
        guardActive: false,
        element: 'normal',
        currentHp: 200,
      },
      rng: forceCritRng,
      consumedCritBonus: 1,
    });

    const defenderWithDebuff = baseParams({
      defender: {
        defense: 20,
        defenseModifier: 0.5,
        guardActive: false,
        element: 'normal',
        currentHp: 200,
      },
      rng: forceCritRng,
      consumedCritBonus: 1,
    });

    const resultNoBuff = computeBattleDamage(defenderNoBuff);
    const resultWithBuff = computeBattleDamage(defenderWithBuff);
    const resultWithDebuff = computeBattleDamage(defenderWithDebuff);

    expect(resultNoBuff.isCrit).toBe(true);
    expect(resultWithBuff.isCrit).toBe(true);
    expect(resultNoBuff.damage).toBe(resultWithBuff.damage);
    expect(resultWithDebuff.isCrit).toBe(true);
    expect(resultWithDebuff.damage).toBeGreaterThan(resultNoBuff.damage);
  });

  it('on non-crit, defender defense modifier still affects damage', () => {
    const noCritRng = () => 1;

    const noBuff = computeBattleDamage(
      baseParams({
        defender: { defense: 20, defenseModifier: 1, guardActive: false, element: 'normal', currentHp: 200 },
        rng: noCritRng,
      }),
    );
    const withBuff = computeBattleDamage(
      baseParams({
        defender: { defense: 20, defenseModifier: 1.5, guardActive: false, element: 'normal', currentHp: 200 },
        rng: noCritRng,
      }),
    );

    expect(noBuff.isCrit).toBe(false);
    expect(withBuff.isCrit).toBe(false);
    expect(noBuff.damage).toBeGreaterThan(withBuff.damage);
  });
});
