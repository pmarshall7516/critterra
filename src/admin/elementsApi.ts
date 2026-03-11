import { apiFetchJson } from '@/shared/apiClient';

export interface AdminGameElementRow {
  element_id: string;
  display_name: string;
  color_hex: string;
  icon_bucket: string;
  icon_path: string;
  sort_index: number;
}

interface ElementsListResponse {
  ok: boolean;
  elements?: unknown;
  error?: string;
}

function sanitizeAdminElements(raw: unknown): AdminGameElementRow[] {
  if (!Array.isArray(raw)) return [];
  const parsed: AdminGameElementRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i += 1) {
    const entry = raw[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.element_id === 'string' ? record.element_id.trim().toLowerCase() : '';
    if (!id || seen.has(id)) continue;
    parsed.push({
      element_id: id,
      display_name: typeof record.display_name === 'string' ? record.display_name : id,
      color_hex: typeof record.color_hex === 'string' ? record.color_hex : '',
      icon_bucket: typeof record.icon_bucket === 'string' ? record.icon_bucket : 'icons',
      icon_path: typeof record.icon_path === 'string' ? record.icon_path : `${id}-element.png`,
      sort_index: typeof record.sort_index === 'number' ? record.sort_index : i,
    });
    seen.add(id);
  }
  return parsed.sort((a, b) => a.sort_index - b.sort_index || a.element_id.localeCompare(b.element_id));
}

export async function loadAdminGameElements(): Promise<AdminGameElementRow[]> {
  const result = await apiFetchJson<ElementsListResponse>('/api/admin/elements/list');
  if (!result.ok) {
    return [];
  }
  return sanitizeAdminElements(result.data?.elements);
}

