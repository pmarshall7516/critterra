import { describe, expect, it } from 'vitest';
import { createDuelBattleController, getRequiredLeadCount } from '@/duel/battleCore';
import type {
  DuelAction,
  DuelBattleCreateInput,
  DuelBattleFormat,
  DuelCatalogContent,
  DuelSquad,
  DuelSquadMember,
} from '@/duel/types';
import type { CritterDefinition } from '@/game/critters/types';
import type { EquipmentEffectDefinition } from '@/game/equipmentEffects/types';
import type { GameItemDefinition } from '@/game/items/types';
import type { ElementChart, SkillDefinition, SkillEffectDefinition } from '@/game/skills/types';

const EMPTY_STATS = {
  hp: 0,
  attack: 0,
  defense: 0,
  speed: 0,
};

function createSkill(input: {
  id: string;
  name: string;
  priority?: number;
  damage?: number;
  effectAttachments?: SkillDefinition['effectAttachments'];
}): SkillDefinition {
  return {
    skill_id: input.id,
    skill_name: input.name,
    element: 'normal',
    type: 'damage',
    priority: input.priority ?? 1,
    damage: input.damage ?? 30,
    effectAttachments: input.effectAttachments,
  };
}

function createCritter(input: {
  id: number;
  name: string;
  hp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  unlockedSkillIds: string[];
}): CritterDefinition {
  return {
    id: input.id,
    name: input.name,
    element: 'normal',
    rarity: 'common',
    description: '',
    spriteUrl: '',
    baseStats: {
      hp: input.hp ?? 120,
      attack: input.attack ?? 30,
      defense: input.defense ?? 20,
      speed: input.speed ?? 20,
    },
    abilities: [],
    levels: [
      {
        level: 1,
        missions: [],
        requiredMissionCount: 0,
        statDelta: { ...EMPTY_STATS },
        unlockEquipSlots: 0,
        abilityUnlockIds: [],
        skillUnlockIds: input.unlockedSkillIds,
      },
    ],
  };
}

function createSquad(id: string, name: string, members: DuelSquadMember[]): DuelSquad {
  return {
    id,
    name,
    sortIndex: 0,
    members,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createMember(critterId: number, equippedSkillIds: [string | null, string | null, string | null, string | null]): DuelSquadMember {
  return {
    critterId,
    level: 1,
    equippedSkillIds,
    equippedItems: [],
  };
}

function sequenceRng(values: number[], fallback = 0.5): () => number {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    return typeof value === 'number' ? value : fallback;
  };
}

function createCatalogs(input: {
  critters: CritterDefinition[];
  skills: SkillDefinition[];
  skillEffects?: SkillEffectDefinition[];
}): DuelCatalogContent {
  return {
    critters: input.critters,
    skills: input.skills,
    skillEffects: input.skillEffects ?? ([] as SkillEffectDefinition[]),
    equipmentEffects: [] as EquipmentEffectDefinition[],
    elementChart: [] as ElementChart,
    items: [] as GameItemDefinition[],
  };
}

function startBattle(input: {
  format: DuelBattleFormat;
  playerSquad: DuelSquad;
  opponentSquad: DuelSquad;
  catalogs: DuelCatalogContent;
  rngValues?: number[];
  rngFallback?: number;
}) {
  const createInput: DuelBattleCreateInput = {
    format: input.format,
    playerLabel: 'Player',
    opponentLabel: 'Opponent',
    playerSquad: input.playerSquad,
    opponentSquad: input.opponentSquad,
    catalogs: input.catalogs,
  };
  const controller = createDuelBattleController(createInput, {
    rng: sequenceRng(input.rngValues ?? [0.5], input.rngFallback ?? 0.5),
  });
  const required = getRequiredLeadCount(input.format);
  const playerLead = Array.from({ length: required }, (_, index) => index);
  const opponentLead = Array.from({ length: required }, (_, index) => index);
  expect(controller.submitLeadSelection('player', playerLead).ok).toBe(true);
  expect(controller.submitLeadSelection('opponent', opponentLead).ok).toBe(true);
  return controller;
}

function submitTurn(controller: ReturnType<typeof createDuelBattleController>, playerActions: DuelAction[], opponentActions: DuelAction[]) {
  expect(controller.submitActions({ side: 'player', actions: playerActions }).ok).toBe(true);
  expect(controller.submitActions({ side: 'opponent', actions: opponentActions }).ok).toBe(true);
  if (controller.state.phase === 'resolving-turn') {
    expect(controller.resolveTurnImmediately().ok).toBe(true);
  }
}

describe('duel battle core - singles', () => {
  it('advances one ordered action per resolution step', () => {
    const quick = createSkill({ id: 'quick', name: 'Quick', priority: 2, damage: 20 });
    const slow = createSkill({ id: 'slow', name: 'Slow', priority: 0, damage: 20 });
    const catalogs = createCatalogs({
      critters: [
        createCritter({ id: 1, name: 'PlayerMon', speed: 20, unlockedSkillIds: ['quick'] }),
        createCritter({ id: 2, name: 'OpponentMon', speed: 20, unlockedSkillIds: ['slow'] }),
      ],
      skills: [quick, slow],
    });
    const controller = startBattle({
      format: 'singles',
      playerSquad: createSquad('p', 'Player', [createMember(1, ['quick', null, null, null])]),
      opponentSquad: createSquad('o', 'Opponent', [createMember(2, ['slow', null, null, null])]),
      catalogs,
      rngValues: [0.5, 0.5, 0.5, 0.5],
    });

    expect(
      controller.submitActions({
        side: 'player',
        actions: [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
      }).ok,
    ).toBe(true);
    expect(
      controller.submitActions({
        side: 'opponent',
        actions: [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
      }).ok,
    ).toBe(true);
    expect(controller.state.phase).toBe('resolving-turn');

    expect(controller.advanceTurnResolution().ok).toBe(true);
    const turnOneActionLogs = controller.state.logs.filter((entry) => entry.turn === 1 && entry.kind === 'action');
    expect(turnOneActionLogs.length).toBe(1);
    expect(turnOneActionLogs[0]?.text).toContain("Player's PlayerMon used Quick");
    expect(controller.state.phase).toBe('resolving-turn');

    expect(controller.advanceTurnResolution().ok).toBe(true);
    const turnOneActionLogsAfterSecondStep = controller.state.logs.filter((entry) => entry.turn === 1 && entry.kind === 'action');
    expect(turnOneActionLogsAfterSecondStep.length).toBe(2);
    expect(turnOneActionLogsAfterSecondStep[1]?.text).toContain("Opponent's OpponentMon used Slow");
    expect(controller.state.phase).toBe('resolving-turn');
    // One more advance with queue exhausted finishes the turn so the UI can show the last action's logs first.
    expect(controller.advanceTurnResolution().ok).toBe(true);
    expect(controller.state.phase).toBe('choose-actions');
  });

  it('resolves by priority before speed', () => {
    const quick = createSkill({ id: 'quick', name: 'Quick Strike', priority: 2, damage: 20 });
    const strike = createSkill({ id: 'strike', name: 'Heavy Strike', priority: 1, damage: 20 });
    const catalogs = createCatalogs({
      critters: [
        createCritter({ id: 1, name: 'Alpha', speed: 10, unlockedSkillIds: ['quick'] }),
        createCritter({ id: 2, name: 'Bravo', speed: 90, unlockedSkillIds: ['strike'] }),
      ],
      skills: [quick, strike],
    });
    const controller = startBattle({
      format: 'singles',
      playerSquad: createSquad('p', 'Player', [createMember(1, ['quick', null, null, null])]),
      opponentSquad: createSquad('o', 'Opponent', [createMember(2, ['strike', null, null, null])]),
      catalogs,
      rngValues: [0.5, 0.5, 0.5, 0.5],
    });

    submitTurn(
      controller,
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
    );

    const actionLogs = controller.state.logs.filter((entry) => entry.turn === 1 && entry.kind === 'action');
    expect(actionLogs[0]?.text).toContain("Player's Alpha used Quick Strike");
  });

  it('applies guard damage reduction and resolves swap before attacks', () => {
    const strike = createSkill({ id: 'strike', name: 'Strike', priority: 1, damage: 30 });
    const catalogs = createCatalogs({
      critters: [
        createCritter({ id: 1, name: 'Guarder', speed: 10, unlockedSkillIds: ['strike'] }),
        createCritter({ id: 2, name: 'BenchMon', speed: 30, unlockedSkillIds: ['strike'] }),
        createCritter({ id: 3, name: 'Attacker', speed: 40, unlockedSkillIds: ['strike'] }),
      ],
      skills: [strike],
    });

    const guarded = startBattle({
      format: 'singles',
      playerSquad: createSquad('p1', 'Player', [createMember(1, ['strike', null, null, null])]),
      opponentSquad: createSquad('o1', 'Opponent', [createMember(3, ['strike', null, null, null])]),
      catalogs,
      rngValues: [0.5, 0.5, 0.5, 0.5],
    });
    submitTurn(
      guarded,
      [{ kind: 'guard', actorMemberIndex: 0 }],
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
    );
    const guardedHp = guarded.state.player.team[0]?.currentHp ?? 0;

    const baseline = startBattle({
      format: 'singles',
      playerSquad: createSquad('p2', 'Player', [createMember(1, ['strike', null, null, null])]),
      opponentSquad: createSquad('o2', 'Opponent', [createMember(3, ['strike', null, null, null])]),
      catalogs,
      rngValues: [0.5, 0.5, 0.5, 0.5],
    });
    submitTurn(
      baseline,
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
    );
    const baselineHp = baseline.state.player.team[0]?.currentHp ?? 0;

    expect(guardedHp).toBeGreaterThan(baselineHp);

    const swapBattle = startBattle({
      format: 'singles',
      playerSquad: createSquad('p3', 'Player', [
        createMember(1, ['strike', null, null, null]),
        createMember(2, ['strike', null, null, null]),
      ]),
      opponentSquad: createSquad('o3', 'Opponent', [createMember(3, ['strike', null, null, null])]),
      catalogs,
      rngValues: [0.5, 0.5, 0.5, 0.5],
    });
    const firstMaxHp = swapBattle.state.player.team[0].maxHp;
    const benchMaxHp = swapBattle.state.player.team[1].maxHp;
    submitTurn(
      swapBattle,
      [{ kind: 'swap', actorMemberIndex: 0, benchMemberIndex: 1 }],
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
    );
    expect(swapBattle.state.player.activeMemberIndices).toEqual([1]);
    expect(swapBattle.state.player.team[0].currentHp).toBe(firstMaxHp);
    expect(swapBattle.state.player.team[1].currentHp).toBeLessThan(benchMaxHp);
  });

  it('breaks equal priority/speed ties player-first (RPG-aligned) and handles forfeit', () => {
    const strike = createSkill({ id: 'strike', name: 'Strike', priority: 1, damage: 15 });
    const catalogs = createCatalogs({
      critters: [
        createCritter({ id: 1, name: 'Alpha', speed: 30, unlockedSkillIds: ['strike'] }),
        createCritter({ id: 2, name: 'Bravo', speed: 30, unlockedSkillIds: ['strike'] }),
      ],
      skills: [strike],
    });

    const tieBattle = startBattle({
      format: 'singles',
      playerSquad: createSquad('p', 'Player', [createMember(1, ['strike', null, null, null])]),
      opponentSquad: createSquad('o', 'Opponent', [createMember(2, ['strike', null, null, null])]),
      catalogs,
      rngValues: [0.1, 0.9, 0.5, 0.5],
    });
    submitTurn(
      tieBattle,
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
    );
    const actionLogs = tieBattle.state.logs.filter((entry) => entry.turn === 1 && entry.kind === 'action');
    expect(actionLogs[0]?.text).toContain("Player's Alpha used Strike");

    const forfeitBattle = startBattle({
      format: 'singles',
      playerSquad: createSquad('p2', 'Player', [createMember(1, ['strike', null, null, null])]),
      opponentSquad: createSquad('o2', 'Opponent', [createMember(2, ['strike', null, null, null])]),
      catalogs,
    });
    submitTurn(
      forfeitBattle,
      [{ kind: 'forfeit', actorMemberIndex: 0 }],
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
    );
    expect(forfeitBattle.state.phase).toBe('finished');
    expect(forfeitBattle.state.winner).toBe('opponent');
  });

  it('accumulates stacked skill effect values for tooltip totals', () => {
    const focus = createSkill({
      id: 'focus',
      name: 'Focus',
      priority: 1,
      damage: 10,
      effectAttachments: [{ effectId: 'focus-atk', procChance: 1, buffPercent: 0.2 }],
    });
    const focusEffect: SkillEffectDefinition = {
      effect_id: 'focus-atk',
      effect_name: 'Focus Attack',
      effect_type: 'atk_buff',
      description: '+<buff>% ATK',
    };
    const catalogs = createCatalogs({
      critters: [
        createCritter({ id: 1, name: 'PlayerMon', hp: 220, unlockedSkillIds: ['focus'] }),
        createCritter({ id: 2, name: 'OpponentMon', hp: 220, defense: 30, unlockedSkillIds: [] }),
      ],
      skills: [focus],
      skillEffects: [focusEffect],
    });
    const battle = startBattle({
      format: 'singles',
      playerSquad: createSquad('p', 'Player', [createMember(1, ['focus', null, null, null])]),
      opponentSquad: createSquad('o', 'Opponent', [createMember(2, [null, null, null, null])]),
      catalogs,
      rngValues: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    });

    submitTurn(
      battle,
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
      [{ kind: 'guard', actorMemberIndex: 0 }],
    );
    submitTurn(
      battle,
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
      [{ kind: 'guard', actorMemberIndex: 0 }],
    );

    const player = battle.state.player.team[0];
    expect(player.attackModifier).toBeCloseTo(1.4, 5);
    expect(player.activeEffectValueById['focus-atk']).toBeCloseTo(0.4, 5);
    expect(player.activeEffectSourceById['focus-atk']).toBe('Focus');
  });

  it('uses chance-based guard (RPG-aligned) and only reduces damage on success', () => {
    const strike = createSkill({ id: 'strike', name: 'Strike', priority: 1, damage: 50 });
    const catalogs = createCatalogs({
      critters: [
        createCritter({ id: 1, name: 'Alpha', speed: 10, defense: 10, unlockedSkillIds: ['strike'] }),
        createCritter({ id: 2, name: 'Bravo', speed: 10, attack: 20, unlockedSkillIds: ['strike'] }),
      ],
      skills: [strike],
    });

    const successBattle = startBattle({
      format: 'singles',
      playerSquad: createSquad('p', 'Player', [createMember(1, [null, null, null, null])]),
      opponentSquad: createSquad('o', 'Opponent', [createMember(2, ['strike', null, null, null])]),
      catalogs,
      // RNG order (for this turn): guard roll, crit roll, variance roll.
      rngValues: [0, 0.99, 0.5],
    });
    const hpBeforeSuccess = successBattle.state.player.team[0].currentHp;
    submitTurn(
      successBattle,
      [{ kind: 'guard', actorMemberIndex: 0 }],
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
    );
    const hpAfterSuccess = successBattle.state.player.team[0].currentHp;
    expect(successBattle.state.player.team[0].guardActive).toBe(false); // cleared at end of turn
    expect(successBattle.state.player.team[0].consecutiveSuccessfulGuardCount).toBe(1);

    const failBattle = startBattle({
      format: 'singles',
      playerSquad: createSquad('p2', 'Player', [createMember(1, [null, null, null, null])]),
      opponentSquad: createSquad('o2', 'Opponent', [createMember(2, ['strike', null, null, null])]),
      catalogs,
      rngValues: [0.99, 0.99, 0.5],
    });
    // First guard is guaranteed (chance 1). Set streak so failure is possible.
    failBattle.state.player.team[0].consecutiveSuccessfulGuardCount = 1;
    const hpBeforeFail = failBattle.state.player.team[0].currentHp;
    submitTurn(
      failBattle,
      [{ kind: 'guard', actorMemberIndex: 0 }],
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
    );
    const hpAfterFail = failBattle.state.player.team[0].currentHp;
    expect(failBattle.state.player.team[0].consecutiveSuccessfulGuardCount).toBe(0);

    const damageOnSuccess = Math.max(0, hpBeforeSuccess - hpAfterSuccess);
    const damageOnFail = Math.max(0, hpBeforeFail - hpAfterFail);
    expect(damageOnFail).toBeGreaterThan(damageOnSuccess);
  });
});

describe('duel battle core - doubles and replacements', () => {
  it('applies manual doubles targets to the selected opposing critters', () => {
    const chip = createSkill({ id: 'chip', name: 'Chip', priority: 1, damage: 20 });
    const catalogs = createCatalogs({
      critters: [
        createCritter({ id: 1, name: 'P1', speed: 50, unlockedSkillIds: ['chip'] }),
        createCritter({ id: 2, name: 'P2', speed: 40, unlockedSkillIds: ['chip'] }),
        createCritter({ id: 3, name: 'O1', speed: 30, unlockedSkillIds: ['chip'] }),
        createCritter({ id: 4, name: 'O2', speed: 20, unlockedSkillIds: ['chip'] }),
      ],
      skills: [chip],
    });
    const controller = startBattle({
      format: 'doubles',
      playerSquad: createSquad('p', 'Player', [createMember(1, ['chip', null, null, null]), createMember(2, ['chip', null, null, null])]),
      opponentSquad: createSquad('o', 'Opponent', [createMember(3, ['chip', null, null, null]), createMember(4, ['chip', null, null, null])]),
      catalogs,
      rngValues: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    });

    submitTurn(
      controller,
      [
        { kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 1 },
        { kind: 'skill', actorMemberIndex: 1, skillSlotIndex: 0, targetMemberIndex: 0 },
      ],
      [
        { kind: 'guard', actorMemberIndex: 0 },
        { kind: 'guard', actorMemberIndex: 1 },
      ],
    );

    expect(controller.state.opponent.team[0].currentHp).toBeLessThan(controller.state.opponent.team[0].maxHp);
    expect(controller.state.opponent.team[1].currentHp).toBeLessThan(controller.state.opponent.team[1].maxHp);
  });

  it('auto-retargets doubles skills when the selected target faints earlier in turn order', () => {
    const burst = createSkill({ id: 'burst', name: 'Burst', priority: 1, damage: 450 });
    const chip = createSkill({ id: 'chip', name: 'Chip', priority: 1, damage: 30 });
    const tap = createSkill({ id: 'tap', name: 'Tap', priority: 1, damage: 1 });
    const catalogs = createCatalogs({
      critters: [
        createCritter({ id: 11, name: 'P1', speed: 90, unlockedSkillIds: ['burst'] }),
        createCritter({ id: 12, name: 'P2', speed: 80, unlockedSkillIds: ['chip'] }),
        createCritter({ id: 13, name: 'O1', hp: 150, defense: 25, speed: 20, unlockedSkillIds: ['tap'] }),
        createCritter({ id: 14, name: 'O2', hp: 40, defense: 6, speed: 10, unlockedSkillIds: ['tap'] }),
      ],
      skills: [burst, chip, tap],
    });
    const controller = startBattle({
      format: 'doubles',
      playerSquad: createSquad('p', 'Player', [
        createMember(11, ['burst', null, null, null]),
        createMember(12, ['chip', null, null, null]),
      ]),
      opponentSquad: createSquad('o', 'Opponent', [
        createMember(13, ['tap', null, null, null]),
        createMember(14, ['tap', null, null, null]),
      ]),
      catalogs,
      rngValues: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    });

    submitTurn(
      controller,
      [
        { kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 1 },
        { kind: 'skill', actorMemberIndex: 1, skillSlotIndex: 0, targetMemberIndex: 1 },
      ],
      [
        { kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 },
        { kind: 'skill', actorMemberIndex: 1, skillSlotIndex: 0, targetMemberIndex: 0 },
      ],
    );

    expect(controller.state.opponent.team[1].fainted).toBe(true);
    expect(controller.state.opponent.team[0].currentHp).toBeLessThan(controller.state.opponent.team[0].maxHp);
    const p2ActionLog = controller.state.logs.find(
      (entry) => entry.kind === 'action' && entry.text.includes("Player's P2 used Chip"),
    );
    expect(p2ActionLog?.text).toContain('on O1');
  });

  it('auto-retargets triples skills to a random remaining valid target', () => {
    const burst = createSkill({ id: 'burst', name: 'Burst', priority: 1, damage: 500 });
    const chip = createSkill({ id: 'chip', name: 'Chip', priority: 1, damage: 30 });
    const tap = createSkill({ id: 'tap', name: 'Tap', priority: 1, damage: 1 });
    const catalogs = createCatalogs({
      critters: [
        createCritter({ id: 21, name: 'P1', speed: 95, unlockedSkillIds: ['burst'] }),
        createCritter({ id: 22, name: 'P2', speed: 85, unlockedSkillIds: ['chip'] }),
        createCritter({ id: 23, name: 'P3', speed: 75, unlockedSkillIds: [] }),
        createCritter({ id: 24, name: 'O1', hp: 150, defense: 22, speed: 30, unlockedSkillIds: ['tap'] }),
        createCritter({ id: 25, name: 'O2', hp: 40, defense: 6, speed: 20, unlockedSkillIds: ['tap'] }),
        createCritter({ id: 26, name: 'O3', hp: 150, defense: 22, speed: 10, unlockedSkillIds: ['tap'] }),
      ],
      skills: [burst, chip, tap],
    });
    const alwaysHighRngValues = Array.from({ length: 64 }, () => 0.99);
    const controller = startBattle({
      format: 'triples',
      playerSquad: createSquad('p', 'Player', [
        createMember(21, ['burst', null, null, null]),
        createMember(22, ['chip', null, null, null]),
        createMember(23, [null, null, null, null]),
      ]),
      opponentSquad: createSquad('o', 'Opponent', [
        createMember(24, ['tap', null, null, null]),
        createMember(25, ['tap', null, null, null]),
        createMember(26, ['tap', null, null, null]),
      ]),
      catalogs,
      rngValues: alwaysHighRngValues,
      rngFallback: 0.99,
    });

    submitTurn(
      controller,
      [
        { kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 1 },
        { kind: 'skill', actorMemberIndex: 1, skillSlotIndex: 0, targetMemberIndex: 1 },
        { kind: 'guard', actorMemberIndex: 2 },
      ],
      [
        { kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 },
        { kind: 'skill', actorMemberIndex: 1, skillSlotIndex: 0, targetMemberIndex: 0 },
        { kind: 'skill', actorMemberIndex: 2, skillSlotIndex: 0, targetMemberIndex: 0 },
      ],
    );

    expect(controller.state.opponent.team[1].fainted).toBe(true);
    expect(controller.state.opponent.team[0].currentHp).toBe(controller.state.opponent.team[0].maxHp);
    expect(controller.state.opponent.team[2].currentHp).toBeLessThan(controller.state.opponent.team[2].maxHp);
    const p2ActionLog = controller.state.logs.find(
      (entry) => entry.kind === 'action' && entry.text.includes("Player's P2 used Chip"),
    );
    expect(p2ActionLog?.text).toContain('on O3');
  });

  it('cancels pending actions for actors fainted earlier in doubles turn order', () => {
    const chip = createSkill({ id: 'chip', name: 'Chip', priority: 1, damage: 20 });
    const burst = createSkill({ id: 'burst', name: 'Burst', priority: 1, damage: 400 });
    const catalogs = createCatalogs({
      critters: [
        createCritter({ id: 1, name: 'SlowMon', speed: 10, hp: 25, defense: 8, unlockedSkillIds: ['chip'] }),
        createCritter({ id: 2, name: 'Partner', speed: 20, unlockedSkillIds: ['chip'] }),
        createCritter({ id: 3, name: 'FastKO', speed: 80, unlockedSkillIds: ['burst'] }),
        createCritter({ id: 4, name: 'TargetB', speed: 30, unlockedSkillIds: ['chip'] }),
      ],
      skills: [chip, burst],
    });
    const controller = startBattle({
      format: 'doubles',
      playerSquad: createSquad('p', 'Player', [createMember(1, ['chip', null, null, null]), createMember(2, ['chip', null, null, null])]),
      opponentSquad: createSquad('o', 'Opponent', [createMember(3, ['burst', null, null, null]), createMember(4, ['chip', null, null, null])]),
      catalogs,
      rngValues: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    });

    submitTurn(
      controller,
      [
        { kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 1 },
        { kind: 'skill', actorMemberIndex: 1, skillSlotIndex: 0, targetMemberIndex: 0 },
      ],
      [
        { kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 },
        { kind: 'guard', actorMemberIndex: 1 },
      ],
    );

    const playerSlowMon = controller.state.player.team[0];
    expect(playerSlowMon.fainted).toBe(true);
    const logsFromSlowMon = controller.state.logs.filter((entry) => entry.text.includes("Player's SlowMon used"));
    expect(logsFromSlowMon.length).toBe(0);

    expect(controller.state.opponent.team[0].currentHp).toBeLessThan(controller.state.opponent.team[0].maxHp);
    expect(controller.state.opponent.team[1].currentHp).toBe(controller.state.opponent.team[1].maxHp);
  });

  it('requires replacement selection before next turn and supports draw on simultaneous all-faint via recoil', () => {
    const burst = createSkill({ id: 'burst', name: 'Burst', priority: 1, damage: 500 });
    const recoil = createSkill({
      id: 'reckless',
      name: 'Reckless',
      priority: 1,
      damage: 500,
      effectAttachments: [
        {
          effectId: 'recoil',
          procChance: 1,
          recoilMode: 'percent_max_hp',
          recoilPercent: 1,
        },
      ],
    });
    const recoilEffect: SkillEffectDefinition = {
      effect_id: 'recoil',
      effect_name: 'Recoil',
      effect_type: 'recoil',
      description: '',
    };

    const replacementCatalogs = createCatalogs({
      critters: [
        createCritter({ id: 1, name: 'Lead', hp: 30, defense: 10, speed: 10, unlockedSkillIds: ['burst'] }),
        createCritter({ id: 2, name: 'Bench', hp: 120, unlockedSkillIds: ['burst'] }),
        createCritter({ id: 3, name: 'Enemy', attack: 60, speed: 50, unlockedSkillIds: ['burst'] }),
      ],
      skills: [burst],
    });
    const replacementBattle = startBattle({
      format: 'singles',
      playerSquad: createSquad('p', 'Player', [createMember(1, ['burst', null, null, null]), createMember(2, ['burst', null, null, null])]),
      opponentSquad: createSquad('o', 'Opponent', [createMember(3, ['burst', null, null, null])]),
      catalogs: replacementCatalogs,
      rngValues: [0.5, 0.5, 0.5, 0.5],
    });
    submitTurn(
      replacementBattle,
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
    );
    expect(replacementBattle.state.phase).toBe('choose-replacements');
    expect(replacementBattle.state.player.pendingReplacements).toBeNull();
    expect(replacementBattle.submitReplacementSelection('player', [1]).ok).toBe(true);
    expect(replacementBattle.state.phase).toBe('choose-actions');
    expect(replacementBattle.state.player.activeMemberIndices).toEqual([1]);

    const drawCatalogs = createCatalogs({
      critters: [
        createCritter({ id: 11, name: 'DrawA', hp: 100, attack: 80, unlockedSkillIds: ['reckless'] }),
        createCritter({ id: 12, name: 'DrawB', hp: 100, attack: 80, unlockedSkillIds: ['reckless'] }),
      ],
      skills: [recoil],
      skillEffects: [recoilEffect],
    });
    const drawBattle = startBattle({
      format: 'singles',
      playerSquad: createSquad('p2', 'Player', [createMember(11, ['reckless', null, null, null])]),
      opponentSquad: createSquad('o2', 'Opponent', [createMember(12, ['reckless', null, null, null])]),
      catalogs: drawCatalogs,
      rngValues: [0.5, 0.5, 0.5, 0.5],
    });
    submitTurn(
      drawBattle,
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
      [{ kind: 'skill', actorMemberIndex: 0, skillSlotIndex: 0, targetMemberIndex: 0 }],
    );
    expect(drawBattle.state.phase).toBe('finished');
    expect(drawBattle.state.winner).toBe('draw');
  });
});
