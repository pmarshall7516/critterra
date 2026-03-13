export const STATUS_CONDITION_KINDS = ['toxic', 'stun', 'flinch'] as const;
export type StatusConditionKind = (typeof STATUS_CONDITION_KINDS)[number];

export interface ToxicPersistentStatusCondition {
  kind: 'toxic';
  potencyBase: number;
  potencyPerTurn: number;
  turnCount: number;
  source?: string;
  effectId?: string;
}

export interface StunPersistentStatusCondition {
  kind: 'stun';
  stunFailChance: number;
  /** Portion of speed removed while stunned (0.5 = speed halved). */
  stunSlowdown: number;
  source?: string;
  effectId?: string;
}

export type PersistentStatusCondition =
  | ToxicPersistentStatusCondition
  | StunPersistentStatusCondition;

export interface FlinchStatusCondition {
  turnNumber: number;
  source: string;
  effectId?: string;
}

export interface StatusConditionPresentation {
  name: string;
  iconUrl: string;
  description: string;
}

export function clampUnitInterval(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number.parseFloat(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Math.min(1, fallback));
  }
  return Math.max(0, Math.min(1, parsed));
}

export function clampNonNegativeInt(value: unknown, fallback: number, max = 9999): number {
  const parsed =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.floor(value)
      : typeof value === 'string' && value.trim().length > 0
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Math.min(max, Math.floor(fallback)));
  }
  return Math.max(0, Math.min(max, parsed));
}

export function sanitizePersistentStatusCondition(raw: unknown): PersistentStatusCondition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const kindRaw = typeof record.kind === 'string' ? record.kind.trim().toLowerCase() : '';
  const source = sanitizeStatusSource(record.source);
  const effectId = sanitizeStatusEffectId(record.effectId ?? record.effect_id);
  if (kindRaw === 'toxic') {
    return {
      kind: 'toxic',
      potencyBase: clampUnitInterval(record.potencyBase ?? record.potency_base, 0.05),
      potencyPerTurn: clampUnitInterval(record.potencyPerTurn ?? record.potency_per_turn, 0.05),
      turnCount: clampNonNegativeInt(record.turnCount ?? record.turn_count, 0, 999999),
      ...(source && { source }),
      ...(effectId && { effectId }),
    };
  }
  if (kindRaw === 'stun') {
    return {
      kind: 'stun',
      stunFailChance: clampUnitInterval(record.stunFailChance ?? record.stun_fail_chance, 0.25),
      stunSlowdown: clampUnitInterval(record.stunSlowdown ?? record.stun_slowdown, 0.5),
      ...(source && { source }),
      ...(effectId && { effectId }),
    };
  }
  return null;
}

function sanitizeStatusEffectId(raw: unknown): string | undefined {
  const effectId = typeof raw === 'string' ? raw.trim() : '';
  return effectId.length > 0 ? effectId.slice(0, 120) : undefined;
}

export function sanitizeStatusSource(raw: unknown, fallback = ''): string {
  const source = typeof raw === 'string' ? raw.trim() : '';
  if (source.length > 0) {
    return source.slice(0, 120);
  }
  return fallback;
}

export function clonePersistentStatusCondition(
  status: PersistentStatusCondition | null | undefined,
): PersistentStatusCondition | null {
  if (!status) {
    return null;
  }
  if (status.kind === 'toxic') {
    return {
      kind: 'toxic',
      potencyBase: clampUnitInterval(status.potencyBase, 0.05),
      potencyPerTurn: clampUnitInterval(status.potencyPerTurn, 0.05),
      turnCount: clampNonNegativeInt(status.turnCount, 0, 999999),
      ...(status.source ? { source: sanitizeStatusSource(status.source) } : {}),
      ...(status.effectId ? { effectId: sanitizeStatusEffectId(status.effectId) } : {}),
    };
  }
  return {
    kind: 'stun',
    stunFailChance: clampUnitInterval(status.stunFailChance, 0.25),
    stunSlowdown: clampUnitInterval(status.stunSlowdown, 0.5),
    ...(status.source ? { source: sanitizeStatusSource(status.source) } : {}),
    ...(status.effectId ? { effectId: sanitizeStatusEffectId(status.effectId) } : {}),
  };
}

export function resolveStunSpeedMultiplier(status: Pick<StunPersistentStatusCondition, 'stunSlowdown'>): number {
  const slowdown = clampUnitInterval(status.stunSlowdown, 0.5);
  return Math.max(0, Math.min(1, 1 - slowdown));
}

export function resolveToxicTickDamage(
  maxHp: number,
  status: Pick<ToxicPersistentStatusCondition, 'potencyBase' | 'potencyPerTurn' | 'turnCount'>,
): { potency: number; damage: number } {
  const safeMaxHp = Math.max(1, Math.floor(maxHp));
  const potency = clampUnitInterval(
    clampUnitInterval(status.potencyBase, 0) + clampUnitInterval(status.potencyPerTurn, 0) * clampNonNegativeInt(status.turnCount, 0),
    0,
  );
  if (potency <= 0) {
    return { potency, damage: 0 };
  }
  const scaled = Math.floor(safeMaxHp * potency);
  return {
    potency,
    damage: Math.max(1, scaled),
  };
}

function createStatusIconDataUrl(fill: string, label: string): string {
  const safeFill = fill.trim() || '#777777';
  const safeLabel = label.trim().slice(0, 3) || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="${safeFill}" stroke="#111111" stroke-width="4"/><text x="32" y="39" text-anchor="middle" font-size="23" font-family="Verdana, sans-serif" font-weight="700" fill="#ffffff">${safeLabel}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const STATUS_CONDITION_PRESENTATION: Record<StatusConditionKind, StatusConditionPresentation> = {
  toxic: {
    name: 'Toxic',
    iconUrl: createStatusIconDataUrl('#2f9e44', 'TX'),
    description: 'Toxic damage increases each end of turn.',
  },
  stun: {
    name: 'Stun',
    iconUrl: createStatusIconDataUrl('#f59f00', 'ST'),
    description: 'Stunned critters may fail actions.',
  },
  flinch: {
    name: 'Flinch',
    iconUrl: createStatusIconDataUrl('#d9480f', 'FL'),
    description: 'Flinch can cancel the next action this turn.',
  },
};
