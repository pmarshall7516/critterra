import { describe, expect, it } from 'vitest';
import {
  getActionablePayMissions,
  resolveFixedStepAdvance,
  resolveGameViewKeyIntent,
  resolvePinnedLockedKnockoutTrackerState,
  shouldShowLockedKnockoutTargetButton,
} from '@/game/engine/GameView';

describe('resolveGameViewKeyIntent', () => {
  it('uses Y for fullscreen toggle', () => {
    const lower = resolveGameViewKeyIntent({
      key: 'y',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: false,
    });
    const upper = resolveGameViewKeyIntent({
      key: 'Y',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: false,
    });
    expect(lower).toBe('toggle-fullscreen');
    expect(upper).toBe('toggle-fullscreen');
  });

  it('keeps Escape focused on battle cancel when battle is active', () => {
    const result = resolveGameViewKeyIntent({
      key: 'Escape',
      battleActive: true,
      storyInputLocked: false,
      menuOpen: false,
    });
    expect(result).toBe('battle-cancel');
  });

  it('uses Escape for menu toggle when gameplay input is available', () => {
    const result = resolveGameViewKeyIntent({
      key: 'Escape',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: false,
    });
    expect(result).toBe('toggle-menu');
  });

  it('uses E for menu toggle when gameplay input is available', () => {
    const lower = resolveGameViewKeyIntent({
      key: 'e',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: false,
    });
    const upper = resolveGameViewKeyIntent({
      key: 'E',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: false,
    });
    expect(lower).toBe('toggle-menu');
    expect(upper).toBe('toggle-menu');
  });

  it('blocks Escape menu toggling while story input is locked', () => {
    const result = resolveGameViewKeyIntent({
      key: 'Escape',
      battleActive: false,
      storyInputLocked: true,
      menuOpen: false,
    });
    expect(result).toBe('block-for-menu');
  });

  it('blocks E menu toggling while story input is locked', () => {
    const result = resolveGameViewKeyIntent({
      key: 'E',
      battleActive: false,
      storyInputLocked: true,
      menuOpen: false,
    });
    expect(result).toBe('block-for-menu');
  });

  it('does not forward gameplay input while side menu is open', () => {
    const result = resolveGameViewKeyIntent({
      key: 'w',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: true,
    });
    expect(result).toBe('block-for-menu');
  });

  it('forwards gameplay keys during normal exploration', () => {
    const result = resolveGameViewKeyIntent({
      key: 'w',
      battleActive: false,
      storyInputLocked: false,
      menuOpen: false,
    });
    expect(result).toBe('forward-to-runtime');
  });
});

describe('resolveFixedStepAdvance', () => {
  it('advances exactly one fixed step at 60 FPS', () => {
    expect(
      resolveFixedStepAdvance({
        elapsedMs: 1000 / 60,
        carryMs: 0,
      }),
    ).toMatchObject({
      stepCount: 1,
      carryMs: 0,
    });
  });

  it('accumulates partial frame time until a fixed step is available', () => {
    const first = resolveFixedStepAdvance({
      elapsedMs: 8,
      carryMs: 0,
    });
    expect(first.stepCount).toBe(0);
    const second = resolveFixedStepAdvance({
      elapsedMs: 9,
      carryMs: first.carryMs,
    });
    expect(second.stepCount).toBe(1);
    expect(second.carryMs).toBeLessThan(8);
  });

  it('caps long frames to a bounded catch-up window', () => {
    const result = resolveFixedStepAdvance({
      elapsedMs: 1000,
      carryMs: 0,
    });
    expect(result.stepCount).toBe(4);
    expect(result.carryMs).toBe(0);
  });
});

describe('locked knockout tracker UI helpers', () => {
  it('shows collection target button only for locked eligible entries', () => {
    expect(
      shouldShowLockedKnockoutTargetButton({
        unlocked: false,
        lockedKnockoutTargetEligible: true,
      }),
    ).toBe(true);
    expect(
      shouldShowLockedKnockoutTargetButton({
        unlocked: true,
        lockedKnockoutTargetEligible: true,
      }),
    ).toBe(false);
    expect(
      shouldShowLockedKnockoutTargetButton({
        unlocked: false,
        lockedKnockoutTargetEligible: false,
      }),
    ).toBe(false);
  });

  it('resolves pinned tracker states for selected, unselected, and hidden states', () => {
    expect(
      resolvePinnedLockedKnockoutTrackerState({
        lockedKnockoutTracker: {
          selectedCritterId: 3,
          selectedCritterName: 'Buddo',
          eligibleCritterIds: [3, 5],
          missionRows: [],
        },
      } as any),
    ).toBe('selected-target');
    expect(
      resolvePinnedLockedKnockoutTrackerState({
        lockedKnockoutTracker: {
          selectedCritterId: null,
          selectedCritterName: null,
          eligibleCritterIds: [3],
          missionRows: [],
        },
      } as any),
    ).toBe('no-target');
    expect(
      resolvePinnedLockedKnockoutTrackerState({
        lockedKnockoutTracker: {
          selectedCritterId: null,
          selectedCritterName: null,
          eligibleCritterIds: [],
          missionRows: [],
        },
      } as any),
    ).toBe('hidden');
  });
});

describe('pay mission UI helpers', () => {
  it('returns only incomplete pay missions from the active requirement', () => {
    expect(
      getActionablePayMissions({
        activeRequirement: {
          level: 2,
          targetLevel: 2,
          requiredMissionCount: 1,
          completedMissionCount: 0,
          completed: false,
          missions: [
            {
              id: 'pay-1',
              type: 'pay_item',
              targetValue: 50,
              currentValue: 0,
              completed: false,
              requiredPaymentItemId: 'lume',
              requiredPaymentItemName: 'Lume',
              requiredPaymentOwnedQuantity: 25,
              requiredPaymentAffordable: false,
            },
            {
              id: 'ko-1',
              type: 'opposing_knockouts',
              targetValue: 3,
              currentValue: 0,
              completed: false,
            },
            {
              id: 'pay-done',
              type: 'pay_item',
              targetValue: 10,
              currentValue: 10,
              completed: true,
              requiredPaymentItemId: 'lume',
              requiredPaymentItemName: 'Lume',
              requiredPaymentOwnedQuantity: 10,
              requiredPaymentAffordable: true,
            },
          ],
        },
      } as any).map((mission: any) => mission.id),
    ).toEqual(['pay-1']);
  });
});
