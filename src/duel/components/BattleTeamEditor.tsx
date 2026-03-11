import { computeCritterDerivedProgress, computeCritterUnlockedEquipSlots } from '@/game/critters/schema';
import type { GameItemDefinition } from '@/game/items/types';
import { getEquipmentTypeKey, type DuelSquadDraft } from '@/duel/squadSchema';
import type { DuelBattleFormat, DuelCatalogContent, DuelCatalogIndexes } from '@/duel/types';

interface BattleTeamEditorProps {
  catalogs: DuelCatalogContent;
  catalogIndexes: DuelCatalogIndexes;
  members: DuelSquadDraft['members'];
  onChange: (members: DuelSquadDraft['members']) => void;
  validationIssuesByPath?: Map<string, string[]>;
  format?: DuelBattleFormat;
  onFormatChange?: (format: DuelBattleFormat) => void;
  maxMembers?: number;
  layout?: 'default' | 'compact';
}

export function BattleTeamEditor({
  catalogs,
  catalogIndexes,
  members,
  onChange,
  validationIssuesByPath,
  format,
  onFormatChange,
  maxMembers = 8,
  layout = 'default',
}: BattleTeamEditorProps) {
  const issueByPath = validationIssuesByPath ?? new Map<string, string[]>();
  const showFormatSelector = typeof format === 'string' && typeof onFormatChange === 'function';
  const isCompact = layout === 'compact';

  const updateMembers = (
    updater: (current: DuelSquadDraft['members']) => DuelSquadDraft['members'],
  ) => {
    onChange(updater(members));
  };

  const moveMember = (memberIndex: number, direction: -1 | 1) => {
    updateMembers((current) => {
      const targetIndex = memberIndex + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const nextMembers = [...current];
      const [moved] = nextMembers.splice(memberIndex, 1);
      if (!moved) {
        return current;
      }
      nextMembers.splice(targetIndex, 0, moved);
      return nextMembers;
    });
  };

  const getIssuesStartingWith = (prefix: string): string[] => {
    const issues: string[] = [];
    issueByPath.forEach((messages, path) => {
      if (path.startsWith(prefix)) {
        issues.push(...messages);
      }
    });
    return issues;
  };

  return (
    <div className={`duel-members${isCompact ? ' duel-members--compact' : ''}`}>
      {showFormatSelector && (
        <label>
          Battle Format
          <select
            value={format}
            onChange={(event) => {
              const value = event.target.value;
              const next: DuelBattleFormat =
                value === 'triples' ? 'triples' : value === 'doubles' ? 'doubles' : 'singles';
              onFormatChange(next);
            }}
          >
            <option value="singles">1v1 Singles</option>
            <option value="doubles">2v2 Doubles</option>
            <option value="triples">3v3 Triples</option>
          </select>
        </label>
      )}

      <div className="duel-members__toolbar">
        <h3>Squad Members ({members.length}/{maxMembers})</h3>
        <button
          type="button"
          className="secondary"
          disabled={members.length >= maxMembers}
          onClick={() => {
            const usedIds = new Set(members.map((entry) => entry.critterId));
            const candidate = catalogs.critters.find((entry) => !usedIds.has(entry.id));
            if (!candidate) {
              return;
            }
            updateMembers((current) => [
              ...current,
              {
                critterId: candidate.id,
                level: 1,
                equippedSkillIds: [null, null, null, null],
                equippedItems: [],
              },
            ]);
          }}
        >
          Add Critter
        </button>
      </div>

      {members.map((member, memberIndex) => {
        const critter = catalogIndexes.critterById.get(member.critterId);
        const maxLevel = critter ? Math.max(1, ...critter.levels.map((row) => row.level)) : 1;
        const derived = critter ? computeCritterDerivedProgress(critter, member.level) : null;
        const unlockedSkills = derived ? new Set(derived.unlockedSkillIds) : new Set<string>();
        const unlockedSkillOptions = catalogs.skills.filter((skill) => unlockedSkills.has(skill.skill_id));
        const equipSlotCount = critter ? computeCritterUnlockedEquipSlots(critter, member.level) : 0;
        const allEquipmentOptions = catalogs.items.filter(
          (item) => item.category === 'equipment' && item.isActive && resolveEquipSize(item) <= Math.max(1, equipSlotCount),
        );
        const usedEquipTypeKeys = new Set(
          member.equippedItems.map((entry) => {
            const def = catalogIndexes.itemById.get(entry.itemId);
            return def ? getEquipmentTypeKey(def) : entry.itemId;
          }),
        );
        const addableEquipmentOptions = allEquipmentOptions.filter(
          (item) => !usedEquipTypeKeys.has(getEquipmentTypeKey(item)),
        );
        const nextAddableEquipment = pickFirstEquipmentPlacement(
          addableEquipmentOptions,
          member.equippedItems,
          catalogIndexes.itemById,
          equipSlotCount,
        );
        const speciesIssues = issueByPath.get(`members.${memberIndex}.critterId`) ?? [];
        const levelIssues = issueByPath.get(`members.${memberIndex}.level`) ?? [];
        const skillIssues = getIssuesStartingWith(`members.${memberIndex}.equippedSkillIds`);
        const equipmentIssues = getIssuesStartingWith(`members.${memberIndex}.equippedItems`);

        return (
          <article key={`draft-member-${memberIndex}`} className={`duel-member-card${isCompact ? ' duel-member-card--compact' : ''}`}>
            <header className="duel-member-card__head">
              <h4>Critter {memberIndex + 1}</h4>
              <div className="title-screen__actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={memberIndex === 0}
                  onClick={() => moveMember(memberIndex, -1)}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={memberIndex >= members.length - 1}
                  onClick={() => moveMember(memberIndex, 1)}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={members.length <= 1}
                  onClick={() => {
                    updateMembers((current) => current.filter((_, index) => index !== memberIndex));
                  }}
                >
                  Remove
                </button>
              </div>
            </header>

            <div className={`duel-member-card__grid${isCompact ? ' duel-member-card__grid--compact' : ''}`}>
              <label>
                Species
                <select
                  value={member.critterId}
                  onChange={(event) => {
                    const nextCritterId = Number.parseInt(event.target.value, 10);
                    updateMembers((current) =>
                      current.map((entry, index) =>
                        index === memberIndex
                          ? {
                              ...entry,
                              critterId: nextCritterId,
                              level: 1,
                              equippedSkillIds: [null, null, null, null],
                              equippedItems: [],
                            }
                          : entry,
                      ),
                    );
                  }}
                >
                  {catalogs.critters
                    .filter((entry) => {
                      if (entry.id === member.critterId) {
                        return true;
                      }
                      return !members.some((check, index) => index !== memberIndex && check.critterId === entry.id);
                    })
                    .map((entry) => (
                      <option key={`member-${memberIndex}-critter-${entry.id}`} value={entry.id}>
                        #{entry.id} {entry.name}
                      </option>
                    ))}
                </select>
              </label>
              {speciesIssues.map((issue, issueIndex) => (
                <p key={`member-${memberIndex}-species-issue-${issueIndex}`} className="duel-field-error">
                  {issue}
                </p>
              ))}

              <label>
                Level
                <input
                  type="number"
                  min={1}
                  max={maxLevel}
                  value={member.level}
                  onChange={(event) => {
                    const nextLevel = Number.parseInt(event.target.value, 10);
                    updateMembers((current) =>
                      current.map((entry, index) =>
                        index === memberIndex
                          ? {
                              ...entry,
                              level: Number.isFinite(nextLevel) ? Math.max(1, Math.min(maxLevel, nextLevel)) : 1,
                            }
                          : entry,
                      ),
                    );
                  }}
                />
              </label>
              {levelIssues.map((issue, issueIndex) => (
                <p key={`member-${memberIndex}-level-issue-${issueIndex}`} className="duel-field-error">
                  {issue}
                </p>
              ))}

              <div className="duel-member-card__metrics">
                <p className="admin-note">
                  {derived
                    ? `Stats: HP ${derived.effectiveStats.hp} | ATK ${derived.effectiveStats.attack} | DEF ${derived.effectiveStats.defense} | SPD ${derived.effectiveStats.speed}`
                    : 'Stats: N/A'}
                </p>
                <p className="admin-note">Equip Slots: {equipSlotCount}</p>
              </div>
            </div>

            <div className={`duel-member-card__detail-grid${isCompact ? ' duel-member-card__detail-grid--compact' : ''}`}>
              <section className="duel-member-card__skills">
                <h5>Skills</h5>
                <div className="duel-member-card__skill-grid">
                  {[0, 1, 2, 3].map((slotIndex) => {
                    const currentSkillId = member.equippedSkillIds[slotIndex] ?? null;
                    const selectableSkills = unlockedSkillOptions.filter((skill) => {
                      if (currentSkillId === skill.skill_id) {
                        return true;
                      }
                      return !member.equippedSkillIds.some(
                        (equippedSkillId, equippedSlotIndex) =>
                          equippedSlotIndex !== slotIndex && equippedSkillId === skill.skill_id,
                      );
                    });
                    return (
                      <label key={`member-${memberIndex}-skill-slot-${slotIndex}`} className="duel-member-card__skill-slot">
                        S{slotIndex + 1}
                        <select
                          value={member.equippedSkillIds[slotIndex] ?? ''}
                          onChange={(event) => {
                            const nextSkillId = event.target.value.trim();
                            updateMembers((current) =>
                              current.map((entry, index) => {
                                if (index !== memberIndex) {
                                  return entry;
                                }
                                const nextSlots = [...entry.equippedSkillIds] as [
                                  string | null,
                                  string | null,
                                  string | null,
                                  string | null,
                                ];
                                nextSlots[slotIndex] = nextSkillId || null;
                                return {
                                  ...entry,
                                  equippedSkillIds: nextSlots,
                                };
                              }),
                            );
                          }}
                        >
                          <option value="">(Empty)</option>
                          {selectableSkills.map((skill) => (
                            <option key={`member-${memberIndex}-skill-${slotIndex}-${skill.skill_id}`} value={skill.skill_id}>
                              {skill.skill_name}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
                {skillIssues.map((issue, issueIndex) => (
                  <p key={`member-${memberIndex}-skill-issue-${issueIndex}`} className="duel-field-error">
                    {issue}
                  </p>
                ))}
              </section>

              <section className="duel-member-card__equipment">
                <div className="duel-member-card__equipment-toolbar">
                  <h5>Equipment</h5>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!nextAddableEquipment}
                    onClick={() => {
                      if (!nextAddableEquipment) {
                        return;
                      }
                      updateMembers((current) =>
                        current.map((entry, index) =>
                          index === memberIndex
                            ? {
                                ...entry,
                                equippedItems: [...entry.equippedItems, nextAddableEquipment],
                              }
                            : entry,
                        ),
                      );
                    }}
                  >
                    Add Item
                  </button>
                </div>

                <div className="duel-equip-slots">
                  {Array.from({ length: Math.max(0, equipSlotCount) }, (_, slotIndex) => {
                    const occupyingItem = member.equippedItems.find((item) => {
                      const itemDef = catalogIndexes.itemById.get(item.itemId);
                      const equipSize = resolveEquipSize(itemDef);
                      return slotIndex >= item.slotIndex && slotIndex < item.slotIndex + equipSize;
                    });
                    const occupyingItemDef = occupyingItem ? catalogIndexes.itemById.get(occupyingItem.itemId) : null;
                    return (
                      <div key={`member-${memberIndex}-equip-slot-${slotIndex}`} className="duel-equip-slot">
                        <span>{slotIndex + 1}</span>
                        <small>{occupyingItemDef?.name ?? 'Empty'}</small>
                      </div>
                    );
                  })}
                  {equipSlotCount <= 0 && <p className="admin-note">No equipment slots available at this level.</p>}
                </div>

                {member.equippedItems.map((equippedItem, itemIndex) => {
                  const itemDef = catalogIndexes.itemById.get(equippedItem.itemId);
                  const equipType = itemDef ? getEquipmentTypeKey(itemDef) : equippedItem.itemId;
                  const equipSize = resolveEquipSize(itemDef);
                  const maxSlotStart = Math.max(0, equipSlotCount - equipSize);
                  const usedTypeKeysExcludingCurrent = new Set(
                    member.equippedItems
                      .filter((_, index) => index !== itemIndex)
                      .map((entry) => {
                        const def = catalogIndexes.itemById.get(entry.itemId);
                        return def ? getEquipmentTypeKey(def) : entry.itemId;
                      }),
                  );
                  const itemOptions = allEquipmentOptions.filter((item) => {
                    const typeKey = getEquipmentTypeKey(item);
                    if (typeKey === equipType) {
                      return true;
                    }
                    return !usedTypeKeysExcludingCurrent.has(typeKey);
                  });
                  return (
                    <div
                      key={`member-${memberIndex}-equipped-item-${itemIndex}`}
                      className={`duel-equip-item-row${isCompact ? ' duel-equip-item-row--compact' : ''}`}
                    >
                      <label>
                        Item
                        <select
                          value={equippedItem.itemId}
                          onChange={(event) => {
                            const nextItemId = event.target.value;
                            const nextItemDef = catalogIndexes.itemById.get(nextItemId);
                            const nextMaxSlotStart = Math.max(0, equipSlotCount - resolveEquipSize(nextItemDef));
                            updateMembers((current) =>
                              current.map((entry, index) => {
                                if (index !== memberIndex) {
                                  return entry;
                                }
                                return {
                                  ...entry,
                                  equippedItems: entry.equippedItems.map((item, eqIndex) =>
                                    eqIndex === itemIndex
                                      ? {
                                          ...item,
                                          itemId: nextItemId,
                                          slotIndex: Math.max(0, Math.min(item.slotIndex, nextMaxSlotStart)),
                                        }
                                      : item,
                                  ),
                                };
                              }),
                            );
                          }}
                        >
                          {itemOptions.map((item) => (
                            <option key={`member-${memberIndex}-item-${item.id}`} value={item.id}>
                              {item.name} ({getEquipmentTypeKey(item)})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        {isCompact ? 'Slot' : 'Slot Index'}
                        <input
                          type="number"
                          min={0}
                          max={maxSlotStart}
                          value={equippedItem.slotIndex}
                          onChange={(event) => {
                            const nextSlot = Number.parseInt(event.target.value, 10);
                            updateMembers((current) =>
                              current.map((entry, index) => {
                                if (index !== memberIndex) {
                                  return entry;
                                }
                                return {
                                  ...entry,
                                  equippedItems: entry.equippedItems.map((item, eqIndex) =>
                                    eqIndex === itemIndex
                                      ? {
                                          ...item,
                                          slotIndex: Number.isFinite(nextSlot)
                                            ? Math.max(0, Math.min(maxSlotStart, nextSlot))
                                            : 0,
                                        }
                                      : item,
                                  ),
                                };
                              }),
                            );
                          }}
                        />
                      </label>

                      {!isCompact && (
                        <div className="duel-equip-item-row__meta">
                          {itemDef?.imageUrl ? (
                            <img src={itemDef.imageUrl} alt={itemDef.name} loading="lazy" decoding="async" />
                          ) : (
                            <div className="duel-equip-item-row__sprite-fallback">No Sprite</div>
                          )}
                          <div>
                            <p className="admin-note">Type: {equipType}</p>
                            <p className="admin-note">{itemDef?.description || 'No item description available.'}</p>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          updateMembers((current) =>
                            current.map((entry, index) => {
                              if (index !== memberIndex) {
                                return entry;
                              }
                              return {
                                ...entry,
                                equippedItems: entry.equippedItems.filter((_, eqIndex) => eqIndex !== itemIndex),
                              };
                            }),
                          );
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                {equipmentIssues.map((issue, issueIndex) => (
                  <p key={`member-${memberIndex}-equip-issue-${issueIndex}`} className="duel-field-error">
                    {issue}
                  </p>
                ))}
              </section>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function resolveEquipSize(item: GameItemDefinition | undefined): number {
  if (!item) {
    return 1;
  }
  const effectConfig = item.effectConfig as { equipSize?: number };
  if (typeof effectConfig.equipSize !== 'number' || !Number.isFinite(effectConfig.equipSize)) {
    return 1;
  }
  return Math.max(1, Math.min(8, Math.floor(effectConfig.equipSize)));
}

function buildEquipOccupancy(
  equippedItems: Array<{ itemId: string; slotIndex: number }>,
  itemById: Map<string, GameItemDefinition>,
  slotCount: number,
  skipIndex: number | null = null,
): boolean[] {
  const occupancy = Array.from({ length: Math.max(0, slotCount) }, () => false);
  equippedItems.forEach((entry, index) => {
    if (skipIndex !== null && index === skipIndex) {
      return;
    }
    const itemDef = itemById.get(entry.itemId);
    const equipSize = resolveEquipSize(itemDef);
    const start = Math.max(0, Math.floor(entry.slotIndex));
    const end = Math.min(slotCount, start + equipSize);
    for (let slot = start; slot < end; slot += 1) {
      occupancy[slot] = true;
    }
  });
  return occupancy;
}

function findFirstContiguousEquipSlot(occupancy: boolean[], equipSize: number): number {
  if (occupancy.length <= 0 || equipSize <= 0 || equipSize > occupancy.length) {
    return -1;
  }
  for (let start = 0; start <= occupancy.length - equipSize; start += 1) {
    let blocked = false;
    for (let offset = 0; offset < equipSize; offset += 1) {
      if (occupancy[start + offset]) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      return start;
    }
  }
  return -1;
}

function pickFirstEquipmentPlacement(
  options: GameItemDefinition[],
  equippedItems: Array<{ itemId: string; slotIndex: number }>,
  itemById: Map<string, GameItemDefinition>,
  slotCount: number,
): { itemId: string; slotIndex: number } | null {
  if (slotCount <= 0) {
    return null;
  }
  const occupancy = buildEquipOccupancy(equippedItems, itemById, slotCount);
  for (const item of options) {
    const equipSize = resolveEquipSize(item);
    const slotIndex = findFirstContiguousEquipSlot(occupancy, equipSize);
    if (slotIndex < 0) {
      continue;
    }
    return {
      itemId: item.id,
      slotIndex,
    };
  }
  return null;
}
