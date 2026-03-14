import { describe, expect, it } from 'vitest';
import { createDuelBattleController } from '@/duel/battleCore';
import type { AbilityDefinition } from '@/game/abilities/types';
import type { CritterDefinition } from '@/game/critters/types';
import type { DuelBattleCreateInput, DuelCatalogContent, DuelSquad, DuelSquadMember } from '@/duel/types';
import type { ElementChart, SkillDefinition, SkillEffectDefinition } from '@/game/skills/types';

const EMPTY_STATS = {
  hp: 0,
  attack: 0,
  defense: 0,
  speed: 0,
} as const;

function createCritter(input: {
  id: number;
  name: string;
  unlockedSkillIds: string[];
  unlockedAbilityIds?: string[];
}): CritterDefinition {
  return {
    id: input.id,
    name: input.name,
    element: 'normal',
    rarity: 'common',
    description: '',
    spriteUrl: '',
    baseStats: {
      hp: 80,
      attack: 20,
      defense: 16,
      speed: 14,
    },
    abilities: [],
    levels: [
      {
        level: 1,
        missions: [],
        requiredMissionCount: 0,
        statDelta: { ...EMPTY_STATS },
        unlockEquipSlots: 0,
        abilityUnlockIds: input.unlockedAbilityIds ?? [],
        skillUnlockIds: input.unlockedSkillIds,
      },
    ],
  };
}

function createSkill(id: string, name: string, damage: number): SkillDefinition {
  return {
    skill_id: id,
    skill_name: name,
    element: 'normal',
    type: 'damage',
    priority: 1,
    damage,
  };
}

function createMember(
  critterId: number,
  skillId: string,
  equippedAbilityId: string | null,
): DuelSquadMember {
  return {
    critterId,
    level: 1,
    equippedAbilityId,
    equippedSkillIds: [skillId, null, null, null],
    equippedItems: [],
  };
}

function createSquad(id: string, members: DuelSquadMember[]): DuelSquad {
  return {
    id,
    name: id,
    sortIndex: 0,
    members,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function startBattle(catalogs: DuelCatalogContent, playerSquad: DuelSquad, opponentSquad: DuelSquad) {
  const input: DuelBattleCreateInput = {
    format: 'singles',
    playerLabel: 'Player',
    opponentLabel: 'Opponent',
    playerSquad,
    opponentSquad,
    catalogs,
  };
  const controller = createDuelBattleController(input, { rng: () => 0 });
  expect(controller.submitLeadSelection('player', [0]).ok).toBe(true);
  expect(controller.submitLeadSelection('opponent', [0]).ok).toBe(true);
  return controller;
}

describe('duel passive abilities', () => {
  it('applies guard-buff recoil after a successful guard hit', () => {
    const abilities: AbilityDefinition[] = [
      {
        id: 'guard-thorns',
        name: 'Guard Thorns',
        element: 'normal',
        description: '',
        templateAttachments: [
          {
            templateType: 'guard-buff',
            mode: 'recoil',
            recoilMode: 'flat',
            recoilValue: 5,
          },
        ],
      },
    ];
    const strike = createSkill('strike', 'Strike', 20);
    const catalogs: DuelCatalogContent = {
      critters: [
        createCritter({ id: 1, name: 'Guardian', unlockedSkillIds: ['strike'], unlockedAbilityIds: ['guard-thorns'] }),
        createCritter({ id: 2, name: 'Raider', unlockedSkillIds: ['strike'] }),
      ],
      abilities,
      skills: [strike],
      skillEffects: [] as SkillEffectDefinition[],
      equipmentEffects: [],
      elementChart: [] as ElementChart,
      items: [],
    };
    const controller = startBattle(
      catalogs,
      createSquad('player', [createMember(1, 'strike', 'guard-thorns')]),
      createSquad('opponent', [createMember(2, 'strike', null)]),
    );

    expect(controller.submitActions({ side: 'player', actions: [{ kind: 'guard', actorMemberIndex: 0 }] }).ok).toBe(true);
    expect(
      controller.submitActions({
        side: 'opponent',
        actions: [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
      }).ok,
    ).toBe(true);
    expect(controller.resolveTurnImmediately().ok).toBe(true);

    const attacker = controller.state.opponent.team[0];
    expect(attacker?.currentHp).toBe(75);
    expect(controller.state.logs.some((entry) => entry.text.includes('struck back for 5 damage'))).toBe(true);
  });

  it('applies guard-buff recoil based on attacker max HP when configured', () => {
    const abilities: AbilityDefinition[] = [
      {
        id: 'thorny-shield',
        name: 'Thorny Shield',
        element: 'normal',
        description: '',
        templateAttachments: [
          {
            templateType: 'guard-buff',
            mode: 'recoil',
            recoilMode: 'percent_attacker_max_hp',
            recoilValue: 0.1,
          },
        ],
      },
    ];
    const strike = createSkill('strike', 'Strike', 20);
    const catalogs: DuelCatalogContent = {
      critters: [
        createCritter({ id: 1, name: 'Guardian', unlockedSkillIds: ['strike'], unlockedAbilityIds: ['thorny-shield'] }),
        createCritter({ id: 2, name: 'Raider', unlockedSkillIds: ['strike'] }),
      ],
      abilities,
      skills: [strike],
      skillEffects: [] as SkillEffectDefinition[],
      equipmentEffects: [],
      elementChart: [] as ElementChart,
      items: [],
    };
    const controller = startBattle(
      catalogs,
      createSquad('player', [createMember(1, 'strike', 'thorny-shield')]),
      createSquad('opponent', [createMember(2, 'strike', null)]),
    );

    expect(controller.submitActions({ side: 'player', actions: [{ kind: 'guard', actorMemberIndex: 0 }] }).ok).toBe(true);
    expect(
      controller.submitActions({
        side: 'opponent',
        actions: [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
      }).ok,
    ).toBe(true);
    expect(controller.resolveTurnImmediately().ok).toBe(true);

    const attacker = controller.state.opponent.team[0];
    expect(attacker?.currentHp).toBe(72);
    expect(controller.state.logs.some((entry) => entry.text.includes('struck back for 8 damage'))).toBe(true);
  });
});
