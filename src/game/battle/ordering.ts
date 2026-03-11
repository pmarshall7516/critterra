import { MIN_BATTLE_STAT_MODIFIER } from '@/game/battle/damageAndEffects';

export function resolveSkillPriority(rawPriority: unknown): number {
  const raw = typeof rawPriority === 'number' && Number.isFinite(rawPriority) ? rawPriority : 1;
  return Math.max(1, Math.floor(raw));
}

export function resolveEffectiveSpeed(speed: number, speedModifier: number): number {
  const base = typeof speed === 'number' && Number.isFinite(speed) ? speed : 1;
  const mod = typeof speedModifier === 'number' && Number.isFinite(speedModifier) ? speedModifier : 1;
  return Math.max(1, base * Math.max(MIN_BATTLE_STAT_MODIFIER, mod));
}

