import { apiFetchJson } from '@/shared/apiClient';

export interface AdminFlagEntry {
  flagId: string;
  label: string;
  notes: string;
  updatedAt: string;
}

interface AdminFlagsListResponse {
  ok: boolean;
  flags?: unknown;
  error?: string;
}

function sanitizeFlagId(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function sanitizeOptionalText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

export function sanitizeAdminFlags(raw: unknown): AdminFlagEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const deduped = new Map<string, AdminFlagEntry>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const flagId = sanitizeFlagId(record.flagId);
    if (!flagId) {
      continue;
    }
    deduped.set(flagId, {
      flagId,
      label: sanitizeOptionalText(record.label),
      notes: sanitizeOptionalText(record.notes),
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
    });
  }
  return [...deduped.values()].sort((left, right) =>
    left.flagId.localeCompare(right.flagId, undefined, { sensitivity: 'base' }),
  );
}

export async function loadAdminFlags(): Promise<AdminFlagEntry[]> {
  const result = await apiFetchJson<AdminFlagsListResponse>('/api/admin/flags/list');
  if (!result.ok) {
    throw new Error(result.error ?? result.data?.error ?? 'Unable to load flags.');
  }
  return sanitizeAdminFlags(result.data?.flags);
}

export async function saveAdminFlags(flags: AdminFlagEntry[]): Promise<AdminFlagEntry[]> {
  const result = await apiFetchJson<AdminFlagsListResponse>('/api/admin/flags/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      flags: flags.map((entry) => ({
        flagId: entry.flagId,
        label: entry.label,
        notes: entry.notes,
      })),
    }),
  });
  if (!result.ok) {
    throw new Error(result.error ?? result.data?.error ?? 'Unable to save flags.');
  }
  return sanitizeAdminFlags(result.data?.flags);
}
