import { getSkillValueDisplayNumber, type SkillDefinition, type SkillEffectAttachment, type SkillEffectType } from '@/game/skills/types';

export interface AdminSkillEffectOption {
  id: string;
  name: string;
  effectType: SkillEffectType;
  description?: string;
  buffPercent?: number;
  iconUrl?: string;
}

interface AdminSkillCellContentProps {
  skill: SkillDefinition;
  effectList: AdminSkillEffectOption[];
  iconsBucketRoot: string | null;
}

function buildElementLogoUrlFromIconsBucket(element: string, iconsBucketRoot: string | null): string | null {
  if (!iconsBucketRoot) {
    return null;
  }
  return `${iconsBucketRoot}/${encodeURIComponent(`${element}-element.png`)}`;
}

function effectUsesPersistentHealConfig(effectType: SkillEffectType | undefined): boolean {
  return effectType === 'persistent_heal';
}

function formatImmediateHealTooltip(skill: Pick<SkillDefinition, 'healMode' | 'healValue'>): string | null {
  if (!skill.healMode || skill.healValue == null) {
    return null;
  }
  if (skill.healMode === 'flat') {
    return `Heals: ${Math.max(1, Math.floor(skill.healValue))} HP after use`;
  }
  if (skill.healMode === 'percent_damage') {
    return `Heals: ${Math.round(skill.healValue * 100)}% of damage dealt`;
  }
  return `Heals: ${Math.round(skill.healValue * 100)}% HP after use`;
}

function formatPersistentHealAttachmentTooltip(
  attachment: Pick<SkillEffectAttachment, 'persistentHealMode' | 'persistentHealValue' | 'persistentHealDurationTurns'>,
): string {
  const mode = attachment.persistentHealMode === 'flat' ? 'flat' : 'percent_max_hp';
  const value = mode === 'flat'
    ? Math.max(1, Math.floor(attachment.persistentHealValue ?? 1))
    : Math.max(0, Math.round((attachment.persistentHealValue ?? 0.05) * 100));
  const turns = Math.max(1, Math.floor(attachment.persistentHealDurationTurns ?? 1));
  if (mode === 'flat') {
    return `End of turn: ${value} HP for ${turns} turns`;
  }
  return `End of turn: ${value}% max HP for ${turns} turns`;
}

function formatAttachmentDescription(
  effect: AdminSkillEffectOption,
  attachment: SkillEffectAttachment,
): string {
  const effectDescription = typeof effect.description === 'string' ? effect.description.trim() : '';
  if (!effectDescription) {
    return effect.name;
  }
  const buffLabel = Math.round(((attachment.buffPercent ?? effect.buffPercent ?? 0.1) ?? 0) * 100);
  const recoilLabel = Math.round(((attachment.recoilPercent ?? 0.1) ?? 0) * 100);
  const recoilModeLabel = attachment.recoilMode === 'percent_damage_dealt' ? 'damage dealt' : 'max HP';
  const persistentMode = attachment.persistentHealMode === 'flat' ? 'HP' : 'max HP';
  const persistentValue = attachment.persistentHealMode === 'flat'
    ? Math.max(1, Math.floor(attachment.persistentHealValue ?? 1))
    : Math.round((attachment.persistentHealValue ?? 0.05) * 100);
  const persistentTurns = Math.max(1, Math.floor(attachment.persistentHealDurationTurns ?? 1));
  const toxicBase = Math.round((attachment.toxicPotencyBase ?? 0.05) * 100);
  const toxicRamp = Math.round((attachment.toxicPotencyPerTurn ?? 0.05) * 100);
  const stunFail = Math.round((attachment.stunFailChance ?? 0.25) * 100);
  const stunSlow = Math.round((attachment.stunSlowdown ?? 0.5) * 100);
  return effectDescription
    .replace(/<buff>/g, String(buffLabel))
    .replace(/<recoil>/g, String(recoilLabel))
    .replace(/<mode>/g, recoilModeLabel)
    .replace(/<heal>/g, String(persistentValue))
    .replace(/<heal_value>/g, String(persistentValue))
    .replace(/<heal_mode>/g, persistentMode)
    .replace(/<turns>/g, String(persistentTurns))
    .replace(/<duration>/g, String(persistentTurns))
    .replace(/<toxic_base>/g, String(toxicBase))
    .replace(/<toxic_ramp>/g, String(toxicRamp))
    .replace(/<stun>/g, String(stunFail))
    .replace(/<stun_fail>/g, String(stunFail))
    .replace(/<stun_slow>/g, String(stunSlow))
    .replace(/<stun_slowdown>/g, String(stunSlow));
}

export function buildAdminSkillTooltip(skill: SkillDefinition, effectList: AdminSkillEffectOption[]): string {
  const lines = [
    skill.skill_name,
    `${skill.type === 'damage' ? 'Damage' : 'Support'} • ${skill.element} • Priority ${Math.max(1, Math.floor(skill.priority ?? 1))}`,
  ];
  if (skill.type === 'damage' && skill.damage != null) {
    lines.push(`Power: ${skill.damage}`);
  }
  const immediateHealLine = formatImmediateHealTooltip(skill);
  if (immediateHealLine) {
    lines.push(immediateHealLine);
  }
  const effectById = new Map(effectList.map((effect) => [effect.id, effect]));
  const effectAttachments =
    Array.isArray(skill.effectAttachments) && skill.effectAttachments.length > 0
      ? skill.effectAttachments
      : (skill.effectIds ?? []).map((effectId) => {
          const effect = effectById.get(effectId);
          if (effect?.effectType === 'recoil') {
            return {
              effectId,
              procChance: 1,
              recoilMode: 'percent_max_hp' as const,
              recoilPercent: 0.1,
            };
          }
          if (effect?.effectType === 'persistent_heal') {
            return {
              effectId,
              procChance: 1,
              persistentHealMode: 'percent_max_hp' as const,
              persistentHealValue: 0.05,
              persistentHealDurationTurns: 1,
            };
          }
          if (effect?.effectType === 'inflict_toxic') {
            return {
              effectId,
              procChance: 1,
              toxicPotencyBase: 0.05,
              toxicPotencyPerTurn: 0.05,
            };
          }
          if (effect?.effectType === 'inflict_stun') {
            return {
              effectId,
              procChance: 1,
              stunFailChance: 0.25,
              stunSlowdown: 0.5,
            };
          }
          if (effect?.effectType === 'flinch_chance') {
            return {
              effectId,
              procChance: 1,
              flinchFirstUseOnly: false,
              flinchFirstOverallOnly: false,
            };
          }
          return {
            effectId,
            buffPercent: effectById.get(effectId)?.buffPercent ?? 0.1,
            procChance: 1,
          };
        });
  const effectLines = effectAttachments
    .map((attachment) => {
      const effect = effectById.get(attachment.effectId);
      const procLabel = Math.round((attachment.procChance ?? 1) * 100);
      if (!effect) {
        return `${attachment.effectId} (${procLabel}% chance)`;
      }
      if (effectUsesPersistentHealConfig(effect.effectType)) {
        const formatted = formatAttachmentDescription(effect, attachment);
        const text = formatted === effect.name ? formatPersistentHealAttachmentTooltip(attachment) : formatted;
        return `${text} (${procLabel}% chance)`;
      }
      return `${formatAttachmentDescription(effect, attachment)} (${procLabel}% chance)`;
    });
  for (const effectLine of effectLines) {
    if (effectLine.trim()) {
      lines.push(`Effect: ${effectLine.trim()}`);
    }
  }
  return lines.join('\n');
}

export function AdminSkillCellContent({ skill, effectList, iconsBucketRoot }: AdminSkillCellContentProps) {
  const elementLogoUrl = buildElementLogoUrlFromIconsBucket(skill.element, iconsBucketRoot);
  const typeLabel = skill.type === 'damage' ? 'D' : 'S';
  const value = getSkillValueDisplayNumber(skill);
  const effectAttachments =
    Array.isArray(skill.effectAttachments) && skill.effectAttachments.length > 0
      ? skill.effectAttachments
      : (skill.effectIds ?? []).map((effectId) => ({ effectId, procChance: 1, buffPercent: 0.1 }));
  const effectIconUrls = effectAttachments
    .map((attachment) => {
      const effect = effectList.find((entry) => entry.id === attachment.effectId);
      return effect?.iconUrl;
    })
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
  return (
    <>
      {elementLogoUrl && (
        <img src={elementLogoUrl} alt={skill.element} className="skill-cell__element-logo" />
      )}
      <span className="skill-cell__name">{skill.skill_name}</span>
      <span className="skill-cell__spacer"> </span>
      <span className="skill-cell__type">{typeLabel}</span>
      {value != null && <span className="skill-cell__value">{value}</span>}
      {effectIconUrls.length > 0 && (
        <>
          {effectIconUrls.map((url, index) => (
            <img key={`${url}-${index}`} src={url} alt="" className="skill-cell__effect-icon" />
          ))}
        </>
      )}
    </>
  );
}
