import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '@/game/engine/runtime';
import type { AbilityDefinition } from '@/game/abilities/types';
import type { CritterDefinition, PlayerCritterCollectionEntry, PlayerCritterProgress } from '@/game/critters/types';
import { PLAYER_CRITTER_PROGRESS_VERSION } from '@/game/critters/types';
import { buildDefaultElementChart } from '@/game/skills/schema';

const EMPTY_STATS = {
  hp: 0,
  attack: 0,
  defense: 0,
  speed: 0,
} as const;

function createCritter(): CritterDefinition {
  return {
    id: 1,
    name: 'Buddo',
    element: 'bloom',
    rarity: 'common',
    description: '',
    spriteUrl: '',
    baseStats: { hp: 30, attack: 12, defense: 10, speed: 8 },
    abilities: [],
    levels: [
      {
        level: 1,
        missions: [],
        requiredMissionCount: 0,
        statDelta: { ...EMPTY_STATS },
        unlockEquipSlots: 1,
        abilityUnlockIds: ['guard-thorns', 'last-stand'],
        skillUnlockIds: [],
      },
    ],
  };
}

function createCollectionEntry(overrides?: Partial<PlayerCritterCollectionEntry>): PlayerCritterCollectionEntry {
  return {
    critterId: 1,
    unlocked: true,
    seen: true,
    unlockedAt: null,
    unlockSource: 'missions',
    level: 1,
    currentHp: 30,
    missionProgress: {},
    statBonus: { ...EMPTY_STATS },
    effectiveStats: { hp: 30, attack: 12, defense: 10, speed: 8 },
    unlockedAbilityIds: ['guard-thorns', 'last-stand'],
    equippedAbilityId: null,
    equippedSkillIds: [null, null, null, null],
    equippedEquipmentAnchors: [],
    lastProgressAt: null,
    ...overrides,
  };
}

function createBattleCritter(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slotIndex: 0,
    critterId: 1,
    name: 'Buddo',
    element: 'bloom',
    spriteUrl: '',
    level: 10,
    maxHp: 30,
    currentHp: 30,
    attack: 12,
    defense: 10,
    speed: 8,
    equipmentDefensePositiveBonus: 0,
    fainted: false,
    knockoutProgressCounted: false,
    attackModifier: 1,
    defenseModifier: 1,
    speedModifier: 1,
    pendingCritChanceBonus: 0,
    activeEffectIds: [],
    activeEffectValueById: {},
    activeEffectSourceById: {},
    equipmentEffectIds: [],
    equipmentEffectInstances: [],
    equippedItemIds: [],
    equipmentEffectSourceById: {},
    persistentStatus: null,
    flinch: null,
    persistentHeal: null,
    actedThisTurn: false,
    firstActionableTurnNumber: 1,
    damageSkillUseCountSinceSwitchIn: 0,
    skillUseCountBySkillId: {},
    consecutiveSuccessfulGuardCount: 0,
    guardActive: false,
    guardSucceeded: false,
    equippedSkillIds: [null, null, null, null],
    equippedAbilityId: null,
    equippedAbility: null,
    damagedBuffDamageTriggerReady: false,
    damagedBuffEffectTriggerReady: false,
    ...overrides,
  };
}

function createRuntimeHarness(entry: PlayerCritterCollectionEntry, abilities: AbilityDefinition[]) {
  const critter = createCritter();
  const runtime = Object.create(GameRuntime.prototype) as any;
  runtime.critterLookup = { [critter.id]: critter };
  runtime.playerCritterProgress = {
    version: PLAYER_CRITTER_PROGRESS_VERSION,
    unlockedSquadSlots: 8,
    squad: [critter.id, null, null, null, null, null, null, null],
    collection: [entry],
    lockedKnockoutTargetCritterId: null,
    lockedDamageTargetCritterId: null,
  } as PlayerCritterProgress;
  runtime.abilityLookupById = abilities.reduce<Record<string, AbilityDefinition>>((registry, ability) => {
    registry[ability.id] = ability;
    return registry;
  }, {});
  runtime.skillEffectLookupById = {
    focus: {
      effect_id: 'focus',
      effect_name: 'Focus',
      effect_type: 'def_buff',
      buffPercent: 0.25,
      description: '',
    },
  };
  runtime.elementChart = buildDefaultElementChart();
  runtime.markProgressDirty = vi.fn();
  runtime.getRng = () => () => 0;
  return runtime;
}

describe('GameRuntime passive abilities', () => {
  it('equips and clears unlocked abilities in critter progress', () => {
    const abilities: AbilityDefinition[] = [
      {
        id: 'guard-thorns',
        name: 'Guard Thorns',
        element: 'bloom',
        description: '',
        templateAttachments: [],
      },
    ];
    const entry = createCollectionEntry();
    const runtime = createRuntimeHarness(entry, abilities);

    expect(runtime.setEquippedAbility(1, 'guard-thorns')).toBe(true);
    expect(entry.equippedAbilityId).toBe('guard-thorns');
    expect(runtime.markProgressDirty).toHaveBeenCalledTimes(1);

    expect(runtime.setEquippedAbility(1, null)).toBe(true);
    expect(entry.equippedAbilityId).toBeNull();
  });

  it('allows guard-buff self procs even when damage has no attacker source', () => {
    const ability: AbilityDefinition = {
      id: 'guard-thorns',
      name: 'Guard Thorns',
      element: 'bloom',
      description: '',
      templateAttachments: [
        {
          templateType: 'guard-buff',
          mode: 'proc',
          recoilMode: 'flat',
          recoilValue: 0,
          procTarget: 'self',
          procEffectAttachment: {
            effectId: 'focus',
            procChance: 1,
            buffPercent: 0.25,
          },
        },
      ],
    };
    const runtime = createRuntimeHarness(createCollectionEntry(), [ability]);
    const defender = createBattleCritter({
      name: 'Defender',
      guardActive: true,
      guardSucceeded: true,
      equippedAbilityId: 'guard-thorns',
      equippedAbility: ability,
    });

    runtime.getActiveBattleCritter = vi.fn(() => defender);

    const events = runtime.applyGuardBuffOnSuccessfulGuardHit({} as never, null, 'player', 8);

    expect(defender.defenseModifier).toBe(1.25);
    expect(defender.activeEffectIds).toContain('focus');
    expect(events.length).toBeGreaterThan(0);
  });

  it('marks guard as active/succeeded during guard turns so guard-buff logic can trigger', () => {
    const runtime = createRuntimeHarness(createCollectionEntry(), []);
    const player = createBattleCritter({ name: 'Defender' });
    const opponent = createBattleCritter({ name: 'Attacker' });
    const battle = {
      phase: 'player-turn',
      result: 'ongoing',
      turnNumber: 1,
      pendingEndTurnResolution: false,
    } as any;

    runtime.getActiveBattleCritter = vi.fn((_: unknown, team: 'player' | 'opponent') =>
      team === 'player' ? player : opponent,
    );
    runtime.consumePreActionStatusCancellation = vi
      .fn()
      .mockReturnValueOnce({ blocked: false })
      .mockReturnValueOnce({ blocked: false });
    runtime.incrementSimpleCritterMissionProgress = vi.fn(() => false);
    runtime.executeBattleSkill = vi.fn(() => ({ narrationEvents: [], defenderFainted: false }));
    runtime.startBattleNarration = vi.fn();

    runtime.resolvePlayerTurnAction(battle, 'guard');

    expect(player.guardActive).toBe(true);
    expect(player.guardSucceeded).toBe(true);
    expect(runtime.executeBattleSkill).toHaveBeenCalledWith(battle, 'opponent', true, true);
  });

  it('applies guard-buff recoil based on attacker max HP in RPG battles', () => {
    const ability: AbilityDefinition = {
      id: 'thorny-shield',
      name: 'Thorny Shield',
      element: 'bloom',
      description: '',
      templateAttachments: [
        {
          templateType: 'guard-buff',
          mode: 'recoil',
          recoilMode: 'percent_attacker_max_hp',
          recoilValue: 0.1,
        },
      ],
    };
    const runtime = createRuntimeHarness(createCollectionEntry(), [ability]);
    const defender = createBattleCritter({
      name: 'Defender',
      guardActive: true,
      guardSucceeded: true,
      equippedAbilityId: 'thorny-shield',
      equippedAbility: ability,
    });
    const attacker = createBattleCritter({
      name: 'Attacker',
      maxHp: 80,
      currentHp: 80,
    });

    runtime.getActiveBattleCritter = vi.fn(() => defender);

    const events = runtime.applyGuardBuffOnSuccessfulGuardHit({} as never, attacker, 'player', 12);

    expect(attacker.currentHp).toBe(72);
    expect(events.some((event: { message: string }) => event.message.includes('struck back for 8 damage'))).toBe(true);
  });

  it('re-arms damaged-buff threshold triggers after healing above the threshold', () => {
    const ability: AbilityDefinition = {
      id: 'last-stand',
      name: 'Last Stand',
      element: 'bloom',
      description: '',
      templateAttachments: [
        {
          templateType: 'damaged-buff',
          triggerType: 'damage',
          belowPercent: 0.5,
          rewardEffectAttachment: {
            effectId: 'focus',
            procChance: 1,
            buffPercent: 0.25,
          },
        },
      ],
    };
    const runtime = createRuntimeHarness(createCollectionEntry(), [ability]);
    const target = createBattleCritter({
      name: 'Defender',
      maxHp: 20,
      currentHp: 9,
      equippedAbilityId: 'last-stand',
      equippedAbility: ability,
      damagedBuffDamageTriggerReady: true,
    });

    const firstEvents = runtime.applyDamagedBuffDamageTriggerIfNeeded(target, 20);
    expect(target.defenseModifier).toBe(1.25);
    expect(firstEvents.length).toBeGreaterThan(0);
    expect(target.damagedBuffDamageTriggerReady).toBe(false);

    expect(runtime.applyBattleHeal(target, 3)).toBe(3);
    expect(target.currentHp).toBe(12);
    expect(target.damagedBuffDamageTriggerReady).toBe(true);

    target.currentHp = 9;
    const secondEvents = runtime.applyDamagedBuffDamageTriggerIfNeeded(target, 12);
    expect(target.defenseModifier).toBe(1.5);
    expect(secondEvents.length).toBeGreaterThan(0);
  });
});
