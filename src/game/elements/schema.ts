import type { GameElementDefinition } from '@/game/elements/types';

function sanitizeId(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().toLowerCase();
  return trimmed.replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-+/g, '').replace(/-+$/g, '');
}

function sanitizeHex(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const v = raw.trim();
  if (!v) return '';
  const withHash = v.startsWith('#') ? v : `#${v}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : '';
}

export function sanitizeGameElements(raw: unknown): GameElementDefinition[] {
  if (!Array.isArray(raw)) return [];
  const parsed: GameElementDefinition[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = sanitizeId(record.element_id ?? record.id);
    if (!id || seen.has(id)) continue;
    const displayNameRaw = typeof record.display_name === 'string'
      ? record.display_name
      : typeof record.displayName === 'string'
        ? record.displayName
        : typeof record.name === 'string'
          ? record.name
          : '';
    const displayName = displayNameRaw.trim() || id;
    const colorHex = sanitizeHex(record.color_hex ?? record.colorHex ?? record.color);
    const iconBucket = (typeof record.icon_bucket === 'string' ? record.icon_bucket : typeof record.iconBucket === 'string' ? record.iconBucket : 'icons').trim() || 'icons';
    const iconPath = (typeof record.icon_path === 'string' ? record.icon_path : typeof record.iconPath === 'string' ? record.iconPath : '').trim();
    const sortIndexRaw = typeof record.sort_index === 'number' ? record.sort_index : typeof record.sortIndex === 'number' ? record.sortIndex : i;
    const sortIndex = Number.isFinite(sortIndexRaw) ? Math.max(0, Math.floor(sortIndexRaw)) : i;
    parsed.push({ id, displayName, colorHex, iconBucket, iconPath, sortIndex });
    seen.add(id);
  }
  return parsed.sort((a, b) => a.sortIndex - b.sortIndex || a.id.localeCompare(b.id));
}

