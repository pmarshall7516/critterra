export interface GuardRollResult {
  successChance: number;
  succeeded: boolean;
  nextConsecutiveSuccessfulCount: number;
}

export function getGuardSuccessChance(consecutiveSuccessfulGuardCount: number): number {
  const streak = Number.isFinite(consecutiveSuccessfulGuardCount)
    ? Math.max(0, Math.floor(consecutiveSuccessfulGuardCount))
    : 0;
  // Canonical RPG rule: 50% base, halves each consecutive success.
  const chance = Math.pow(0.5, streak);
  if (!Number.isFinite(chance)) {
    return 0;
  }
  return Math.max(0, Math.min(1, chance));
}

export function rollGuard(
  consecutiveSuccessfulGuardCount: number,
  rng: () => number,
): GuardRollResult {
  const successChance = getGuardSuccessChance(consecutiveSuccessfulGuardCount);
  const roll = rng();
  const succeeded = roll < successChance;
  return {
    successChance,
    succeeded,
    nextConsecutiveSuccessfulCount: succeeded ? Math.max(0, Math.floor(consecutiveSuccessfulGuardCount)) + 1 : 0,
  };
}

