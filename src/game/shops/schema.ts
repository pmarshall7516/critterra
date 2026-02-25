import type {
  ShopCostDefinition,
  ShopCritterEntryDefinition,
  ShopDefinition,
  ShopEntryDefinition,
  ShopItemEntryDefinition,
} from '@/game/shops/types';

interface ParseShopCatalogOptions {
  strictUnique?: boolean;
  strictEntryUnique?: boolean;
}

const SHOP_ENTRY_KIND_SET = new Set(['item', 'critter']);

export function sanitizeShopCatalog(raw: unknown): ShopDefinition[] {
  return parseShopCatalog(raw);
}

export function parseShopCatalog(raw: unknown, options?: ParseShopCatalogOptions): ShopDefinition[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const strictUnique = Boolean(options?.strictUnique);
  const strictEntryUnique = options?.strictEntryUnique === undefined ? strictUnique : Boolean(options?.strictEntryUnique);
  const parsed: ShopDefinition[] = [];
  const seenShopIds = new Set<string>();
  for (let index = 0; index < raw.length; index += 1) {
    const shop = parseShopDefinition(raw[index], index, {
      strictUnique,
      strictEntryUnique,
    });
    if (!shop) {
      continue;
    }
    if (seenShopIds.has(shop.id)) {
      if (strictUnique) {
        throw new Error(`Duplicate shop ID "${shop.id}" is not allowed.`);
      }
      continue;
    }
    seenShopIds.add(shop.id);
    parsed.push(shop);
  }
  return parsed;
}

interface ParseShopDefinitionOptions {
  strictUnique: boolean;
  strictEntryUnique: boolean;
}

function parseShopDefinition(
  raw: unknown,
  index: number,
  options: ParseShopDefinitionOptions,
): ShopDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = sanitizeIdentifier(record.id, `shop-${index + 1}`);
  const name = sanitizeText(record.name, `Shop ${index + 1}`, 80);

  const entriesRaw = Array.isArray(record.entries) ? record.entries : [];
  const entries: ShopEntryDefinition[] = [];
  const seenEntryIds = new Set<string>();
  for (let entryIndex = 0; entryIndex < entriesRaw.length; entryIndex += 1) {
    const parsedEntry = parseShopEntryDefinition(entriesRaw[entryIndex], entryIndex, options.strictUnique);
    if (!parsedEntry) {
      continue;
    }
    if (seenEntryIds.has(parsedEntry.id)) {
      if (options.strictEntryUnique) {
        throw new Error(`Shop "${id}" contains duplicate entry ID "${parsedEntry.id}".`);
      }
      continue;
    }
    seenEntryIds.add(parsedEntry.id);
    entries.push(parsedEntry);
  }

  return {
    id,
    name,
    entries,
  };
}

function parseShopEntryDefinition(raw: unknown, index: number, strict: boolean): ShopEntryDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const kind = sanitizeIdentifier(record.kind, '');
  if (!SHOP_ENTRY_KIND_SET.has(kind)) {
    return null;
  }

  const id = sanitizeIdentifier(record.id, `entry-${index + 1}`);
  const costs = parseShopCosts(record.costs);
  if (costs.length === 0) {
    if (strict) {
      throw new Error(`Shop entry "${id}" must include at least one valid cost.`);
    }
    return null;
  }

  if (kind === 'item') {
    const itemId = sanitizeIdentifier(record.itemId, '');
    if (!itemId) {
      if (strict) {
        throw new Error(`Shop item entry "${id}" is missing itemId.`);
      }
      return null;
    }
    return {
      id,
      kind: 'item',
      itemId,
      quantity: clampInt(record.quantity, 1, 9999, 1),
      repeatable: typeof record.repeatable === 'boolean' ? record.repeatable : true,
      costs,
    } satisfies ShopItemEntryDefinition;
  }

  const critterId = clampInt(record.critterId, 1, 999999, -1);
  if (critterId <= 0) {
    if (strict) {
      throw new Error(`Shop critter entry "${id}" is missing critterId.`);
    }
    return null;
  }
  const unlockFlagId = sanitizeIdentifier(record.unlockFlagId, '');
  if (!unlockFlagId) {
    if (strict) {
      throw new Error(`Shop critter entry "${id}" requires unlockFlagId.`);
    }
    return null;
  }
  return {
    id,
    kind: 'critter',
    critterId,
    unlockFlagId,
    costs,
  } satisfies ShopCritterEntryDefinition;
}

function parseShopCosts(raw: unknown): ShopCostDefinition[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const merged = new Map<string, number>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const itemId = sanitizeIdentifier(record.itemId, '');
    if (!itemId) {
      continue;
    }
    const quantity = clampInt(record.quantity, 1, 9999, 1);
    merged.set(itemId, (merged.get(itemId) ?? 0) + quantity);
  }
  return [...merged.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
}

function sanitizeIdentifier(raw: unknown, fallback: string): string {
  const normalized =
    typeof raw === 'string'
      ? raw
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+/g, '')
          .replace(/-+$/g, '')
      : '';
  return normalized || fallback;
}

function sanitizeText(raw: unknown, fallback: string, maxLength: number): string {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.slice(0, maxLength);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(min, Math.min(max, parsed));
}
