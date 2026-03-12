#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Pool } = pg;

const KNOWN_EFFECT_TYPES = new Set([
  'atk_buff',
  'def_buff',
  'speed_buff',
  'crit_buff',
  'persistent_heal',
  'hp_buff',
]);

const STAT_BY_EFFECT_TYPE = {
  atk_buff: 'attack',
  def_buff: 'defense',
  speed_buff: 'speed',
  hp_buff: 'hp',
};

const REQUIRED_EFFECT_TEMPLATES = [
  {
    effect_id: 'equip-atk-buff',
    effect_name: 'Equip Atk Buff',
    effect_type: 'atk_buff',
    description: 'Boosts attack while equipped.',
    modifiers: [{ stat: 'attack', mode: 'percent', value: 0.1 }],
  },
  {
    effect_id: 'equip-speed-buff',
    effect_name: 'Equip Speed Buff',
    effect_type: 'speed_buff',
    description: 'Boosts speed while equipped.',
    modifiers: [{ stat: 'speed', mode: 'percent', value: 0.1 }],
  },
  {
    effect_id: 'equip-crit-buff',
    effect_name: 'Equip Crit Buff',
    effect_type: 'crit_buff',
    description: 'Raises critical hit chance while equipped.',
    modifiers: [],
  },
];

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (!isRecord(value)) {
    return JSON.stringify(value);
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function unwrapEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function readConnectionString() {
  if (typeof process.env.DB_CONNECTION_STRING === 'string' && process.env.DB_CONNECTION_STRING.trim()) {
    return process.env.DB_CONNECTION_STRING.trim();
  }
  const envPath = path.resolve(process.cwd(), '.env');
  const envText = await fs.readFile(envPath, 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*DB_CONNECTION_STRING\s*=\s*(.+)\s*$/);
    if (!match) {
      continue;
    }
    const value = unwrapEnvValue(match[1]);
    if (value) {
      return value;
    }
  }
  throw new Error('DB_CONNECTION_STRING was not found in the environment or .env.');
}

function normalizeId(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function parseNumeric(raw, fallback = Number.NaN) {
  const parsed = typeof raw === 'number' && Number.isFinite(raw)
    ? raw
    : typeof raw === 'string' && raw.trim().length > 0
      ? Number.parseFloat(raw)
      : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampInt(raw, min, max, fallback) {
  const parsed = typeof raw === 'number' && Number.isFinite(raw)
    ? Math.floor(raw)
    : typeof raw === 'string' && raw.trim().length > 0
      ? Number.parseInt(raw, 10)
      : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeTemplateModifiers(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed = [];
  for (const entry of raw) {
    if (!isRecord(entry)) {
      continue;
    }
    const statRaw = typeof entry.stat === 'string' ? entry.stat.trim().toLowerCase() : '';
    const modeRaw = typeof entry.mode === 'string' ? entry.mode.trim().toLowerCase() : '';
    if (!['hp', 'attack', 'defense', 'speed'].includes(statRaw)) {
      continue;
    }
    if (modeRaw !== 'flat' && modeRaw !== 'percent') {
      continue;
    }
    const value = modeRaw === 'flat'
      ? Math.floor(clamp(parseNumeric(entry.value, 0), -999, 999))
      : clamp(parseNumeric(entry.value, 0), -5, 5);
    parsed.push({
      stat: statRaw,
      mode: modeRaw,
      value,
    });
    if (parsed.length >= 24) {
      break;
    }
  }
  return parsed;
}

function sanitizePersistentHealConfig(rawRecord) {
  if (!isRecord(rawRecord)) {
    return undefined;
  }
  const nested = isRecord(rawRecord.persistentHeal) ? rawRecord.persistentHeal : null;
  const modeRaw = typeof (nested?.mode ?? rawRecord.persistentHealMode ?? rawRecord.persistent_heal_mode) === 'string'
    ? String(nested?.mode ?? rawRecord.persistentHealMode ?? rawRecord.persistent_heal_mode).trim().toLowerCase()
    : '';
  if (modeRaw !== 'flat' && modeRaw !== 'percent_max_hp') {
    return undefined;
  }
  const rawValue = nested?.value ?? rawRecord.persistentHealValue ?? rawRecord.persistent_heal_value;
  const value = modeRaw === 'flat'
    ? Math.max(1, Math.floor(clamp(parseNumeric(rawValue, 1), 1, 9999)))
    : clamp(parseNumeric(rawValue, 0.05), 0, 1);
  return {
    mode: modeRaw,
    value,
  };
}

function inferEffectType(rawType, effectId, effectName, modifiers, persistentHeal) {
  const explicit = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';
  if (KNOWN_EFFECT_TYPES.has(explicit)) {
    return explicit;
  }
  if (persistentHeal) {
    return 'persistent_heal';
  }
  const firstModifierStat = modifiers[0]?.stat;
  if (firstModifierStat === 'attack') {
    return 'atk_buff';
  }
  if (firstModifierStat === 'defense') {
    return 'def_buff';
  }
  if (firstModifierStat === 'speed') {
    return 'speed_buff';
  }
  if (firstModifierStat === 'hp') {
    return 'hp_buff';
  }
  const haystack = `${effectId} ${effectName}`.toLowerCase();
  if (haystack.includes('crit')) {
    return 'crit_buff';
  }
  if (haystack.includes('atk') || haystack.includes('attack')) {
    return 'atk_buff';
  }
  if (haystack.includes('speed') || haystack.includes('spd')) {
    return 'speed_buff';
  }
  if (haystack.includes('hp')) {
    return 'hp_buff';
  }
  return 'def_buff';
}

function sanitizeEquipmentTemplateRow(effectIdFromRow, rawData) {
  const source = isRecord(rawData) ? { ...rawData } : {};
  const effect_id = normalizeId(source.effect_id ?? source.effectId ?? effectIdFromRow);
  if (!effect_id) {
    return null;
  }
  const effect_name =
    typeof source.effect_name === 'string' && source.effect_name.trim()
      ? source.effect_name.trim().slice(0, 80)
      : typeof source.effectName === 'string' && source.effectName.trim()
        ? source.effectName.trim().slice(0, 80)
        : effect_id;
  const modifiers = sanitizeTemplateModifiers(source.modifiers);
  const persistentHeal = sanitizePersistentHealConfig(source);
  const effect_type = inferEffectType(
    source.effect_type ?? source.effectType,
    effect_id,
    effect_name,
    modifiers,
    persistentHeal,
  );
  const description = typeof source.description === 'string' ? source.description.trim().slice(0, 240) : '';
  const iconUrl =
    typeof source.iconUrl === 'string' && source.iconUrl.trim()
      ? source.iconUrl.trim()
      : typeof source.icon_url === 'string' && source.icon_url.trim()
        ? source.icon_url.trim()
        : undefined;

  const next = {
    ...source,
    effect_id,
    effect_name,
    effect_type,
    description,
    modifiers,
    ...(persistentHeal ? { persistentHeal } : {}),
    ...(iconUrl ? { iconUrl } : {}),
  };
  delete next.effectId;
  delete next.effectName;
  delete next.effectType;
  delete next.icon_url;
  delete next.persistentHealMode;
  delete next.persistentHealValue;
  delete next.persistent_heal_mode;
  delete next.persistent_heal_value;
  if (!persistentHeal) {
    delete next.persistentHeal;
  }
  if (!iconUrl) {
    delete next.iconUrl;
  }
  return {
    effect_id,
    effect_data: next,
  };
}

function normalizeRequiredTemplate(seed) {
  const normalized = sanitizeEquipmentTemplateRow(seed.effect_id, seed);
  if (!normalized) {
    throw new Error(`Invalid required equipment effect template: ${seed.effect_id}`);
  }
  return normalized;
}

function parseEffectIds(rawConfig) {
  const raw = Array.isArray(rawConfig.equipmentEffectIds)
    ? rawConfig.equipmentEffectIds
    : Array.isArray(rawConfig.equipment_effect_ids)
      ? rawConfig.equipment_effect_ids
      : [];
  const deduped = [];
  const seen = new Set();
  for (const entry of raw) {
    const effectId = normalizeId(entry);
    if (!effectId || seen.has(effectId)) {
      continue;
    }
    seen.add(effectId);
    deduped.push(effectId);
  }
  return deduped.slice(0, 16);
}

function inferAttachmentEffectType(effectId, templateById) {
  const template = templateById.get(effectId);
  if (template && KNOWN_EFFECT_TYPES.has(template.effect_type)) {
    return template.effect_type;
  }
  return inferEffectType('', effectId, effectId, [], undefined);
}

function getTemplateModifierFallback(template) {
  if (!isRecord(template)) {
    return null;
  }
  const effectType = typeof template.effect_type === 'string' ? template.effect_type : '';
  const stat = STAT_BY_EFFECT_TYPE[effectType];
  if (!stat || !Array.isArray(template.modifiers)) {
    return null;
  }
  const match = template.modifiers.find((entry) => isRecord(entry) && entry.stat === stat);
  if (!match) {
    return null;
  }
  const mode = match.mode === 'flat' ? 'flat' : 'percent';
  const value = mode === 'flat'
    ? Math.floor(clamp(parseNumeric(match.value, 1), -999, 999))
    : clamp(parseNumeric(match.value, 0.1), -5, 5);
  return { mode, value };
}

function buildAttachmentForTemplate(effectId, templateById) {
  const template = templateById.get(effectId);
  const effectType = inferAttachmentEffectType(effectId, templateById);

  if (effectType === 'crit_buff') {
    const templateRecord = isRecord(template) ? template : {};
    const critChanceBonus = clamp(
      parseNumeric(templateRecord.critChanceBonus ?? templateRecord.crit_chance_bonus, 0.05),
      0,
      1,
    );
    return { effectId, critChanceBonus };
  }

  if (effectType === 'persistent_heal') {
    const persistent = sanitizePersistentHealConfig(template ?? {});
    const mode = persistent?.mode === 'flat' ? 'flat' : 'percent_max_hp';
    const value = mode === 'flat'
      ? Math.max(1, Math.floor(clamp(parseNumeric(persistent?.value, 1), 1, 9999)))
      : clamp(parseNumeric(persistent?.value, 0.05), 0, 1);
    return {
      effectId,
      persistentHealMode: mode,
      persistentHealValue: value,
    };
  }

  const modifierFallback = getTemplateModifierFallback(template);
  const mode = modifierFallback?.mode ?? 'percent';
  const value = mode === 'flat'
    ? Math.floor(clamp(parseNumeric(modifierFallback?.value, 1), -999, 999))
    : clamp(parseNumeric(modifierFallback?.value, 0.1), -5, 5);
  return {
    effectId,
    mode,
    value,
  };
}

function sanitizeAttachment(rawAttachment, templateById) {
  if (!isRecord(rawAttachment)) {
    return null;
  }
  const effectId = normalizeId(rawAttachment.effectId ?? rawAttachment.effect_id);
  if (!effectId) {
    return null;
  }
  const fallback = buildAttachmentForTemplate(effectId, templateById);
  const effectType = inferAttachmentEffectType(effectId, templateById);

  if (effectType === 'crit_buff') {
    return {
      effectId,
      critChanceBonus: clamp(
        parseNumeric(rawAttachment.critChanceBonus ?? rawAttachment.crit_chance_bonus, fallback.critChanceBonus ?? 0.05),
        0,
        1,
      ),
    };
  }

  if (effectType === 'persistent_heal') {
    const modeRaw = typeof (rawAttachment.persistentHealMode ?? rawAttachment.persistent_heal_mode) === 'string'
      ? String(rawAttachment.persistentHealMode ?? rawAttachment.persistent_heal_mode).trim().toLowerCase()
      : '';
    const mode = modeRaw === 'flat' || modeRaw === 'percent_max_hp'
      ? modeRaw
      : fallback.persistentHealMode === 'flat'
        ? 'flat'
        : 'percent_max_hp';
    const value = mode === 'flat'
      ? Math.max(
          1,
          Math.floor(
            clamp(
              parseNumeric(rawAttachment.persistentHealValue ?? rawAttachment.persistent_heal_value, fallback.persistentHealValue ?? 1),
              1,
              9999,
            ),
          ),
        )
      : clamp(
          parseNumeric(rawAttachment.persistentHealValue ?? rawAttachment.persistent_heal_value, fallback.persistentHealValue ?? 0.05),
          0,
          1,
        );
    return {
      effectId,
      persistentHealMode: mode,
      persistentHealValue: value,
    };
  }

  const modeRaw = typeof rawAttachment.mode === 'string' ? rawAttachment.mode.trim().toLowerCase() : '';
  const mode = modeRaw === 'flat' || modeRaw === 'percent'
    ? modeRaw
    : fallback.mode === 'flat'
      ? 'flat'
      : 'percent';
  const value = mode === 'flat'
    ? Math.floor(clamp(parseNumeric(rawAttachment.value, fallback.value ?? 1), -999, 999))
    : clamp(parseNumeric(rawAttachment.value, fallback.value ?? 0.1), -5, 5);
  return {
    effectId,
    mode,
    value,
  };
}

function parseAttachments(rawConfig, templateById) {
  const raw = Array.isArray(rawConfig.equipmentEffectAttachments)
    ? rawConfig.equipmentEffectAttachments
    : Array.isArray(rawConfig.equipment_effect_attachments)
      ? rawConfig.equipment_effect_attachments
      : [];
  const parsed = [];
  const seen = new Set();
  for (const entry of raw) {
    const attachment = sanitizeAttachment(entry, templateById);
    if (!attachment || seen.has(attachment.effectId)) {
      continue;
    }
    seen.add(attachment.effectId);
    parsed.push(attachment);
    if (parsed.length >= 16) {
      break;
    }
  }
  return parsed;
}

function isEquipmentItem(itemData) {
  if (!isRecord(itemData)) {
    return false;
  }
  if (itemData.category === 'equipment') {
    return true;
  }
  return itemData.effectType === 'equip_effect' || itemData.effectType === 'equip_stub';
}

async function main() {
  const connectionString = await readConnectionString();
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const summary = {
    templatesScanned: 0,
    templatesInserted: 0,
    templatesUpdated: 0,
    templatesDeleted: 0,
    templatesRewritten: false,
    itemsScanned: 0,
    equipmentItemsScanned: 0,
    equipmentItemsUpdated: 0,
    attachmentsSynthesizedFromLegacyIds: 0,
    equipmentItemsWithSynthesizedAttachments: 0,
  };

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const effectsResult = await client.query(
        'SELECT effect_id, effect_data FROM game_equipment_effects_catalog ORDER BY effect_id ASC',
      );
      summary.templatesScanned = effectsResult.rows.length;

      const currentById = new Map();
      for (const row of effectsResult.rows) {
        const normalized = sanitizeEquipmentTemplateRow(row.effect_id, row.effect_data);
        if (!normalized) {
          continue;
        }
        currentById.set(normalized.effect_id, normalized.effect_data);
      }

      const targetById = new Map(currentById);
      for (const seed of REQUIRED_EFFECT_TEMPLATES) {
        const required = normalizeRequiredTemplate(seed);
        const existing = targetById.get(required.effect_id);
        if (!existing) {
          targetById.set(required.effect_id, required.effect_data);
          continue;
        }
        const normalizedExisting = sanitizeEquipmentTemplateRow(required.effect_id, existing);
        if (!normalizedExisting) {
          targetById.set(required.effect_id, required.effect_data);
          continue;
        }
        if (
          normalizedExisting.effect_data.effect_type !== required.effect_data.effect_type ||
          (required.effect_data.effect_type === 'atk_buff' && normalizedExisting.effect_data.modifiers.length === 0) ||
          (required.effect_data.effect_type === 'speed_buff' && normalizedExisting.effect_data.modifiers.length === 0)
        ) {
          targetById.set(required.effect_id, {
            ...normalizedExisting.effect_data,
            effect_type: required.effect_data.effect_type,
            modifiers:
              normalizedExisting.effect_data.modifiers.length > 0
                ? normalizedExisting.effect_data.modifiers
                : required.effect_data.modifiers,
          });
        }
      }

      const currentRows = Array.from(currentById.entries())
        .map(([effect_id, effect_data]) => ({ effect_id, effect_data }))
        .sort((a, b) => a.effect_id.localeCompare(b.effect_id));
      const targetRows = Array.from(targetById.entries())
        .map(([effect_id, effect_data]) => ({ effect_id, effect_data }))
        .sort((a, b) => a.effect_id.localeCompare(b.effect_id));

      for (const row of targetRows) {
        if (!currentById.has(row.effect_id)) {
          summary.templatesInserted += 1;
          continue;
        }
        if (stableStringify(currentById.get(row.effect_id)) !== stableStringify(row.effect_data)) {
          summary.templatesUpdated += 1;
        }
      }
      for (const row of currentRows) {
        if (!targetById.has(row.effect_id)) {
          summary.templatesDeleted += 1;
        }
      }

      if (stableStringify(currentRows) !== stableStringify(targetRows)) {
        await client.query('DELETE FROM game_equipment_effects_catalog');
        for (const row of targetRows) {
          await client.query(
            `
              INSERT INTO game_equipment_effects_catalog (effect_id, effect_data, updated_at)
              VALUES ($1, $2::jsonb, NOW())
            `,
            [row.effect_id, JSON.stringify(row.effect_data)],
          );
        }
        summary.templatesRewritten = true;
      }

      const normalizedTemplateById = new Map(targetRows.map((row) => [row.effect_id, row.effect_data]));
      const itemsResult = await client.query(
        'SELECT item_id, item_data FROM game_items ORDER BY item_id ASC',
      );
      summary.itemsScanned = itemsResult.rows.length;

      for (const row of itemsResult.rows) {
        const currentItemData = isRecord(row.item_data) ? row.item_data : {};
        if (!isEquipmentItem(currentItemData)) {
          continue;
        }
        summary.equipmentItemsScanned += 1;

        const currentConfig = isRecord(currentItemData.effectConfig) ? { ...currentItemData.effectConfig } : {};
        const nextConfig = { ...currentConfig };
        nextConfig.equipSize = clampInt(currentConfig.equipSize ?? currentConfig.equip_size, 1, 8, 1);

        const legacyIds = parseEffectIds(currentConfig);
        const parsedAttachments = parseAttachments(currentConfig, normalizedTemplateById);
        const attachmentById = new Map(parsedAttachments.map((entry) => [entry.effectId, entry]));
        let synthesizedForItem = 0;
        for (const effectId of legacyIds) {
          if (attachmentById.has(effectId)) {
            continue;
          }
          const synthesized = buildAttachmentForTemplate(effectId, normalizedTemplateById);
          attachmentById.set(effectId, synthesized);
          synthesizedForItem += 1;
        }

        const nextAttachments = Array.from(attachmentById.values()).slice(0, 16);
        const nextIds = [...legacyIds, ...nextAttachments.map((entry) => entry.effectId)]
          .filter((entry, index, values) => values.indexOf(entry) === index)
          .slice(0, 16);

        if (nextAttachments.length > 0) {
          nextConfig.equipmentEffectAttachments = nextAttachments;
        } else {
          delete nextConfig.equipmentEffectAttachments;
        }
        nextConfig.equipmentEffectIds = nextIds;
        delete nextConfig.equipment_effect_attachments;
        delete nextConfig.equipment_effect_ids;
        delete nextConfig.equip_size;

        const nextItemData = {
          ...currentItemData,
          effectConfig: nextConfig,
        };

        if (stableStringify(currentItemData) !== stableStringify(nextItemData)) {
          await client.query(
            `
              UPDATE game_items
              SET item_data = $2::jsonb, updated_at = NOW()
              WHERE item_id = $1
            `,
            [row.item_id, JSON.stringify(nextItemData)],
          );
          summary.equipmentItemsUpdated += 1;
        }
        if (synthesizedForItem > 0) {
          summary.equipmentItemsWithSynthesizedAttachments += 1;
          summary.attachmentsSynthesizedFromLegacyIds += synthesizedForItem;
        }
      }

      await client.query('COMMIT');
      console.log('Equipment effect template migration complete.');
      console.log(JSON.stringify(summary, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to migrate equipment effect templates.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
