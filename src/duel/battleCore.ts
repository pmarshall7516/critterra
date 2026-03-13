import { computeCritterDerivedProgress } from '@/game/critters/schema';
import type { EquipmentEffectDefinition } from '@/game/equipmentEffects/types';
import {
  resolveEquipmentEffectIdsForItem,
  resolveEquipmentEffectInstancesForItem,
  type EquipmentEffectInstance,
} from '@/game/equipmentEffects/resolver';
import type { GameItemDefinition } from '@/game/items/types';
import type { SkillDefinition, SkillEffectAttachment, SkillEffectType, SkillTargetKindDamage, SkillTargetKindSupport } from '@/game/skills/types';
import {
  MIN_BATTLE_STAT_MODIFIER,
  computeBattleDamage,
  resolveAppliedSkillAttachments,
  resolveRequestedSkillHealAmount,
  resolveRequestedSkillRecoilAmount,
  resolveSkillEffectAttachmentsForRuntime,
} from '@/game/battle/damageAndEffects';
import {
  clampUnitInterval,
  resolveStunSpeedMultiplier,
  resolveToxicTickDamage,
  sanitizeStatusSource,
} from '@/game/battle/statusConditions';
import {
  applyPendingCritChanceBuff,
  consumePendingCritChanceBonus,
  recordActiveEffect,
} from '@/game/battle/effectState';
import { rollGuard } from '@/game/battle/guard';
import { resolveEffectiveSpeed as resolveEffectiveSpeedShared, resolveSkillPriority as resolveSkillPriorityShared } from '@/game/battle/ordering';
import { buildDuelCatalogIndexes } from '@/duel/squadSchema';
import type {
  DuelAction,
  DuelActionSubmission,
  DuelBattleCreateInput,
  DuelBattleCritterState,
  DuelBattleFormat,
  DuelBattleSideState,
  DuelBattleState,
  DuelCatalogIndexes,
  DuelLogEvent,
  DuelSideId,
  DuelSquad,
  DuelSquadMember,
  DuelTurnResolutionAction,
} from '@/duel/types';

const MAX_STAT_MODIFIER = 4;
const DEFAULT_DAMAGE = 20;
const FORFEIT_PRIORITY = 1000;
const SWAP_PRIORITY = 60;
const GUARD_PRIORITY = 40;

import type { ElementChart } from '@/game/skills/types';

interface ResolveContext {
  indexes: DuelCatalogIndexes;
  elementChart: ElementChart;
  elementMultiplierByPair: Map<string, number>;
  rng: () => number;
}

interface OrderedAction {
  side: DuelSideId;
  action: DuelAction;
  priority: number;
  speed: number;
  tieRoll: number;
}

export interface DuelMutationResult {
  ok: boolean;
  error?: string;
  /** When advancing turn resolution, the action that was executed (for UI animation). */
  executedEntry?: DuelTurnResolutionAction;
  /** When the executed action was a skill and the target fainted. */
  knockout?: { side: DuelSideId; memberIndex: number };
  /** When the executed action was a swap (for entry animation on the swapped-in critter). */
  swapOccurred?: { side: DuelSideId; memberIndex: number };
}

export interface DuelBattleController {
  state: DuelBattleState;
  submitLeadSelection: (side: DuelSideId, memberIndices: number[]) => DuelMutationResult;
  submitActions: (submission: DuelActionSubmission) => DuelMutationResult;
  advanceTurnResolution: () => DuelMutationResult;
  resolveTurnImmediately: () => DuelMutationResult;
  submitReplacementSelection: (side: DuelSideId, memberIndices: number[]) => DuelMutationResult;
  listLegalActionsForActor: (side: DuelSideId, actorMemberIndex: number, includeForfeit?: boolean) => DuelAction[];
  chooseRandomLeadSelection: (side: DuelSideId) => number[];
  chooseRandomActions: (side: DuelSideId) => DuelActionSubmission;
  chooseRandomReplacements: (side: DuelSideId) => number[];
}

export function createDuelBattleController(
  input: DuelBattleCreateInput,
  options?: { rng?: () => number },
): DuelBattleController {
  const indexes = buildDuelCatalogIndexes(input.catalogs);
  const elementMultiplierByPair = buildElementMultiplierIndex(input.catalogs.elementChart);
  const rng = options?.rng ?? Math.random;

  const player = createSideState('player', input.playerLabel, input.playerSquad, indexes);
  const opponent = createSideState('opponent', input.opponentLabel, input.opponentSquad, indexes);
  const requiredLeads = getRequiredLeadCount(input.format);
  if (countAlive(player.team) < requiredLeads || countAlive(opponent.team) < requiredLeads) {
    throw new Error('Selected squads do not have enough ready critters for this format.');
  }

  const state: DuelBattleState = {
    id: input.id ?? crypto.randomUUID(),
    format: input.format,
    phase: 'choose-leads',
    turnNumber: 1,
    player,
    opponent,
    winner: null,
    logs: [],
    turnResolution: null,
  };
  pushLog(state, {
    turn: 0,
    kind: 'system',
    text:
      input.format === 'triples'
        ? 'Triples duel started. Each side must select three lead critters.'
        : input.format === 'doubles'
          ? 'Doubles duel started. Each side must select two lead critters.'
          : 'Singles duel started. Each side must select one lead critter.',
  });

  const context: ResolveContext = {
    indexes,
    elementChart: input.catalogs.elementChart,
    elementMultiplierByPair,
    rng,
  };

  return {
    state,
    submitLeadSelection: (side, memberIndices) => submitLeadSelection(state, side, memberIndices),
    submitActions: (submission) => submitActions(state, submission, context),
    advanceTurnResolution: () => advanceTurnResolution(state, context),
    resolveTurnImmediately: () => resolveTurnImmediately(state, context),
    submitReplacementSelection: (side, memberIndices) => submitReplacementSelection(state, side, memberIndices),
    listLegalActionsForActor: (side, actorMemberIndex, includeForfeit = true) =>
      listLegalActionsForActor(state, side, actorMemberIndex, context, includeForfeit),
    chooseRandomLeadSelection: (side) => chooseRandomLeadSelection(state, side, rng),
    chooseRandomActions: (side) => chooseRandomActions(state, side, context, rng),
    chooseRandomReplacements: (side) => chooseRandomReplacements(state, side, rng),
  };
}

function createSideState(
  id: DuelSideId,
  label: string,
  squad: DuelSquad,
  indexes: DuelCatalogIndexes,
): DuelBattleSideState {
  return {
    id,
    label,
    team: squad.members.map((member, memberIndex) => buildBattleCritterState(id, memberIndex, member, indexes)),
    activeMemberIndices: [],
    pendingLeadSelection: null,
    pendingActions: null,
    pendingReplacements: null,
  };
}

function buildBattleCritterState(
  side: DuelSideId,
  memberIndex: number,
  member: DuelSquadMember,
  indexes: DuelCatalogIndexes,
): DuelBattleCritterState {
  const critter = indexes.critterById.get(member.critterId);
  if (!critter) {
    throw new Error(`Critter ${member.critterId} is missing from catalog.`);
  }
  const derived = computeCritterDerivedProgress(critter, member.level);
  const baseStats = derived.effectiveStats;
  const equipmentEffects = collectEquipmentEffectInstances(member.equippedItems, indexes.itemById, indexes.equipmentEffectById);
  const adjustedStats = applyEquipmentEffectsToStats(baseStats, equipmentEffects);
  const equipmentDefensePositiveBonus = Math.max(
    0,
    adjustedStats.defense - baseStats.defense,
  );
  const { effectIds: equipmentEffectIds, sourceById: equipmentEffectSourceById } = collectEquipmentEffectIdsAndSources(
    member.equippedItems,
    indexes.itemById,
    indexes.equipmentEffectById,
  );
  const equippedItemIds = member.equippedItems
    .map((entry) => indexes.itemById.get(entry.itemId))
    .filter((item): item is GameItemDefinition => Boolean(item && item.category === 'equipment'))
    .map((item) => item.id);

  return {
    memberIndex,
    side,
    critterId: critter.id,
    name: critter.name,
    element: critter.element,
    spriteUrl: critter.spriteUrl,
    level: member.level,
    maxHp: Math.max(1, adjustedStats.hp),
    currentHp: Math.max(1, adjustedStats.hp),
    attack: Math.max(1, adjustedStats.attack),
    defense: Math.max(1, adjustedStats.defense),
    speed: Math.max(1, adjustedStats.speed),
    attackModifier: 1,
    defenseModifier: 1,
    speedModifier: 1,
    guardActive: false,
    guardSucceeded: false,
    fainted: false,
    equippedSkillIds: [...member.equippedSkillIds],
    activeEffectIds: [],
    activeEffectSourceById: {},
    activeEffectValueById: {},
    equipmentEffectIds,
    equipmentEffectInstances: equipmentEffects.map((effect) => ({ ...effect })),
    equippedItemIds,
    equipmentEffectSourceById,
    equipmentDefensePositiveBonus,
    pendingCritChanceBonus: 0,
    persistentStatus: null,
    flinch: null,
    persistentHeal: null,
    actedThisTurn: false,
    firstActionableTurnNumber: 1,
    damageSkillUseCountSinceSwitchIn: 0,
    skillUseCountBySkillId: {},
    consecutiveSuccessfulGuardCount: 0,
  };
}

function collectEquipmentEffectIdsAndSources(
  equippedItems: DuelSquadMember['equippedItems'],
  itemById: Map<string, GameItemDefinition>,
  equipmentEffectById: Map<string, EquipmentEffectDefinition>,
): { effectIds: string[]; sourceById: Record<string, string> } {
  const effectIds: string[] = [];
  const sourceById: Record<string, string> = {};
  for (const equipped of equippedItems) {
    const item = itemById.get(equipped.itemId);
    if (!item || item.category !== 'equipment') {
      continue;
    }
    const ids = resolveEquipmentEffectIdsForItem(item, equipmentEffectById);
    const itemName = item.name?.trim() || item.id;
    for (const effectId of ids) {
      const normalized = effectId?.trim?.();
      if (!normalized || !equipmentEffectById.has(normalized)) {
        continue;
      }
      if (!effectIds.includes(normalized)) {
        effectIds.push(normalized);
      }
      if (!sourceById[normalized]) {
        sourceById[normalized] = itemName;
      }
    }
  }
  return { effectIds, sourceById };
}

function collectEquipmentEffectInstances(
  equippedItems: DuelSquadMember['equippedItems'],
  itemById: Map<string, GameItemDefinition>,
  equipmentEffectById: Map<string, EquipmentEffectDefinition>,
): EquipmentEffectInstance[] {
  const effects: EquipmentEffectInstance[] = [];
  for (const equipped of equippedItems) {
    const item = itemById.get(equipped.itemId);
    if (!item || item.category !== 'equipment') {
      continue;
    }
    effects.push(...resolveEquipmentEffectInstancesForItem(item, equipmentEffectById));
  }
  return effects;
}

function applyEquipmentEffectsToStats(
  base: { hp: number; attack: number; defense: number; speed: number },
  effects: EquipmentEffectInstance[],
): { hp: number; attack: number; defense: number; speed: number } {
  const flat = { hp: 0, attack: 0, defense: 0, speed: 0 };
  const percent = { hp: 0, attack: 0, defense: 0, speed: 0 };
  for (const effect of effects) {
    const stat =
      effect.effectType === 'atk_buff'
        ? 'attack'
        : effect.effectType === 'def_buff'
          ? 'defense'
          : effect.effectType === 'speed_buff'
            ? 'speed'
            : effect.effectType === 'hp_buff'
              ? 'hp'
              : null;
    if (!stat) {
      continue;
    }
    const value = typeof effect.value === 'number' && Number.isFinite(effect.value) ? effect.value : 0;
    if (effect.mode === 'flat') {
      flat[stat] += value;
    } else {
      percent[stat] += value;
    }
  }
  return {
    hp: applyStatModifier(base.hp, flat.hp, percent.hp),
    attack: applyStatModifier(base.attack, flat.attack, percent.attack),
    defense: applyStatModifier(base.defense, flat.defense, percent.defense),
    speed: applyStatModifier(base.speed, flat.speed, percent.speed),
  };
}

function applyStatModifier(base: number, flat: number, percent: number): number {
  const withFlat = base + flat;
  const withPercent = withFlat * (1 + percent);
  return Math.max(1, Math.floor(withPercent));
}

function submitLeadSelection(state: DuelBattleState, side: DuelSideId, memberIndices: number[]): DuelMutationResult {
  if (state.phase !== 'choose-leads') {
    return { ok: false, error: 'Lead selection is not active.' };
  }
  const sideState = getSide(state, side);
  const required = getRequiredLeadCount(state.format);
  const validation = validateLeadSelection(sideState, memberIndices, required);
  if (!validation.ok) {
    return validation;
  }
  sideState.pendingLeadSelection = [...memberIndices];
  pushLog(state, {
    turn: 0,
    kind: 'lead',
    text: `${sideState.label} locked lead selection.`,
  });
  if (state.player.pendingLeadSelection && state.opponent.pendingLeadSelection) {
    state.player.activeMemberIndices = [...state.player.pendingLeadSelection];
    state.opponent.activeMemberIndices = [...state.opponent.pendingLeadSelection];
    for (const memberIndex of state.player.activeMemberIndices) {
      const critter = state.player.team[memberIndex];
      if (critter) {
        prepareSwitchInTracking(critter, 1);
      }
    }
    for (const memberIndex of state.opponent.activeMemberIndices) {
      const critter = state.opponent.team[memberIndex];
      if (critter) {
        prepareSwitchInTracking(critter, 1);
      }
    }
    state.player.pendingLeadSelection = null;
    state.opponent.pendingLeadSelection = null;
    state.phase = 'choose-actions';
    pushLog(state, {
      turn: 1,
      kind: 'system',
      text: 'Leads are on the field. Choose actions.',
    });
  }
  return { ok: true };
}

function validateLeadSelection(sideState: DuelBattleSideState, memberIndices: number[], required: number): DuelMutationResult {
  if (!Array.isArray(memberIndices) || memberIndices.length !== required) {
    return { ok: false, error: `You must select exactly ${required} lead critter(s).` };
  }
  const unique = new Set<number>();
  for (const index of memberIndices) {
    if (!Number.isInteger(index) || index < 0 || index >= sideState.team.length) {
      return { ok: false, error: 'Lead selection contains an invalid member index.' };
    }
    const critter = sideState.team[index];
    if (!critter || critter.fainted || critter.currentHp <= 0) {
      return { ok: false, error: 'Lead selection must use alive critters.' };
    }
    if (unique.has(index)) {
      return { ok: false, error: 'Lead selection cannot contain duplicates.' };
    }
    unique.add(index);
  }
  return { ok: true };
}

function submitActions(
  state: DuelBattleState,
  submission: DuelActionSubmission,
  context: ResolveContext,
): DuelMutationResult {
  if (state.phase !== 'choose-actions') {
    return { ok: false, error: 'Action selection is not active.' };
  }
  const sideState = getSide(state, submission.side);
  const opponentState = getOpposingSide(state, submission.side);
  const validation = validateSubmission(state, sideState, opponentState, submission.actions, context);
  if (!validation.ok) {
    return validation;
  }
  sideState.pendingActions = [...submission.actions];
  if (!state.player.pendingActions || !state.opponent.pendingActions) {
    return { ok: true };
  }

  beginTurnResolution(state, context);
  return { ok: true };
}

function validateSubmission(
  state: DuelBattleState,
  sideState: DuelBattleSideState,
  opponentState: DuelBattleSideState,
  actions: DuelAction[],
  context: ResolveContext,
): DuelMutationResult {
  const requiredActors = getActionRequiredActorIndices(state, sideState);
  if (actions.length !== requiredActors.length) {
    return { ok: false, error: 'Each active critter must submit exactly one action.' };
  }
  const seenActors = new Set<number>();
  const seenSwapBenchTargets = new Set<number>();
  for (const action of actions) {
    if (!requiredActors.includes(action.actorMemberIndex)) {
      return { ok: false, error: 'Action actor is invalid for the current field state.' };
    }
    if (seenActors.has(action.actorMemberIndex)) {
      return { ok: false, error: 'A critter cannot submit multiple actions in one turn.' };
    }
    seenActors.add(action.actorMemberIndex);
    const actor = sideState.team[action.actorMemberIndex];
    if (!actor || actor.fainted) {
      return { ok: false, error: 'Cannot submit actions for fainted critters.' };
    }
    if (action.kind === 'swap') {
      if (
        !Number.isInteger(action.benchMemberIndex) ||
        action.benchMemberIndex < 0 ||
        action.benchMemberIndex >= sideState.team.length
      ) {
        return { ok: false, error: 'Swap action references an invalid bench slot.' };
      }
      const next = sideState.team[action.benchMemberIndex];
      if (!next || next.fainted || next.currentHp <= 0) {
        return { ok: false, error: 'Swap target must be alive.' };
      }
      if (sideState.activeMemberIndices.includes(action.benchMemberIndex)) {
        return { ok: false, error: 'Swap target must be on the bench.' };
      }
      if (seenSwapBenchTargets.has(action.benchMemberIndex)) {
        return { ok: false, error: 'Two active critters cannot swap into the same bench target.' };
      }
      seenSwapBenchTargets.add(action.benchMemberIndex);
      continue;
    }
    if (action.kind === 'skill') {
      if (!Number.isInteger(action.skillSlotIndex) || action.skillSlotIndex < 0 || action.skillSlotIndex > 3) {
        return { ok: false, error: 'Skill action slot index is invalid.' };
      }
      const skillId = actor.equippedSkillIds[action.skillSlotIndex];
      if (!skillId || !context.indexes.skillById.has(skillId)) {
        return { ok: false, error: 'Selected skill is unavailable.' };
      }
      const skill = context.indexes.skillById.get(skillId) as SkillDefinition;
      const actorSide: DuelSideId = state.player === sideState ? 'player' : 'opponent';
      const viable = getViableTargetsForSkill(state, actorSide, action.actorMemberIndex, action.skillSlotIndex, context);
      const targetIndices = (action.targetMemberIndices?.length ? action.targetMemberIndices : [action.targetMemberIndex]) as number[];
      const selectionRange = getSkillTargetSelectionRange(skill, state.format, viable.length);
      if (new Set(targetIndices).size !== targetIndices.length) {
        return { ok: false, error: 'Skill targets cannot contain duplicates.' };
      }
      if (targetIndices.length < selectionRange.min || targetIndices.length > selectionRange.max) {
        if (selectionRange.min === selectionRange.max) {
          return {
            ok: false,
            error: selectionRange.min === 1
              ? 'Skill requires 1 target.'
              : `Skill requires ${selectionRange.min} targets.`,
          };
        }
        return {
          ok: false,
          error: `Skill requires between ${selectionRange.min} and ${selectionRange.max} targets.`,
        };
      }
      for (const memberIndex of targetIndices) {
        const isEnemy = skill.type === 'damage';
        const targetSide: DuelSideId = isEnemy ? (actorSide === 'player' ? 'opponent' : 'player') : actorSide;
        const targetState = targetSide === actorSide ? sideState : opponentState;
        const aliveIndices = getAliveActiveIndices(targetState);
        if (!aliveIndices.includes(memberIndex)) {
          return { ok: false, error: isEnemy ? 'Skill target must be an active opponent critter.' : 'Support skill target must be an active ally critter.' };
        }
        const inViable = viable.some((v) => v.side === targetSide && v.memberIndex === memberIndex);
        if (!inViable) {
          return { ok: false, error: 'Selected target is not valid for this skill.' };
        }
      }
      continue;
    }
  }
  return { ok: true };
}

function beginTurnResolution(state: DuelBattleState, context: ResolveContext): void {
  const ordered = collectOrderedActions(state, context);
  clearGuardFlags(state.player);
  clearGuardFlags(state.opponent);
  resetActionAttemptFlags(state.player);
  resetActionAttemptFlags(state.opponent);
  state.phase = 'resolving-turn';
  state.turnResolution = {
    queue: ordered.map((entry) => ({
      side: entry.side,
      action: cloneAction(entry.action),
    })),
    nextActionIndex: 0,
  };
  // No intro log so the first visible line is the first action (UI auto-advances once).
}

function advanceTurnResolution(state: DuelBattleState, context: ResolveContext): DuelMutationResult {
  if (state.phase !== 'resolving-turn' || !state.turnResolution) {
    return { ok: false, error: 'Turn resolution is not active.' };
  }
  const resolution = state.turnResolution;
  if (resolution.nextActionIndex >= resolution.queue.length) {
    finishTurnResolution(state);
    return { ok: true };
  }

  const entry = resolution.queue[resolution.nextActionIndex];
  resolution.nextActionIndex += 1;
  executeOrderedAction(state, entry.side, entry.action, context);

  let knockout: { side: DuelSideId; memberIndex: number } | undefined;
  let swapOccurred: { side: DuelSideId; memberIndex: number } | undefined;
  if (entry.action.kind === 'skill') {
    const opponentState = getOpposingSide(state, entry.side);
    const target = opponentState.team[entry.action.targetMemberIndex];
    const actor = getSide(state, entry.side).team[entry.action.actorMemberIndex];
    if (target?.fainted) {
      knockout = { side: entry.side === 'player' ? 'opponent' : 'player', memberIndex: entry.action.targetMemberIndex };
    } else if (actor?.fainted) {
      knockout = { side: entry.side, memberIndex: entry.action.actorMemberIndex };
    }
  } else if (entry.action.kind === 'swap') {
    swapOccurred = { side: entry.side, memberIndex: entry.action.benchMemberIndex };
  }

  if (state.phase !== 'resolving-turn') {
    finishTurnResolution(state);
    return { ok: true, executedEntry: entry, knockout, swapOccurred };
  }
  // Do not finish the turn here when this was the last action. Let the UI show this
  // action's logs and animations; the next advance (queue empty) will call us again
  // and we will hit the guard above to run finishTurnResolution.
  return { ok: true, executedEntry: entry, knockout, swapOccurred };
}

function resolveTurnImmediately(state: DuelBattleState, context: ResolveContext): DuelMutationResult {
  if (state.phase !== 'resolving-turn' || !state.turnResolution) {
    return { ok: false, error: 'Turn resolution is not active.' };
  }
  let safety = 32;
  while (state.phase === 'resolving-turn' && safety > 0) {
    const result = advanceTurnResolution(state, context);
    if (!result.ok) {
      return result;
    }
    safety -= 1;
  }
  if (safety <= 0 && state.phase === 'resolving-turn') {
    return { ok: false, error: 'Unable to finish turn resolution.' };
  }
  return { ok: true };
}

function executeOrderedAction(
  state: DuelBattleState,
  side: DuelSideId,
  action: DuelAction,
  context: ResolveContext,
): void {
  if (state.phase === 'finished') {
    return;
  }
  const sideState = getSide(state, side);
  const opponentState = getOpposingSide(state, side);
  const actor = sideState.team[action.actorMemberIndex];
  if (!actor || actor.fainted || !sideState.activeMemberIndices.includes(actor.memberIndex)) {
    return;
  }

  if (action.kind === 'forfeit') {
    actor.actedThisTurn = true;
    const winner: DuelSideId = side === 'player' ? 'opponent' : 'player';
    state.winner = winner;
    state.phase = 'finished';
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'result',
      text: `${sideState.label} forfeited. ${getSide(state, winner).label} wins.`,
    });
    return;
  }

  if (actor.flinch && actor.flinch.turnNumber === state.turnNumber) {
    const source = sanitizeStatusSource(actor.flinch.source, 'an effect');
    actor.flinch = null;
    actor.actedThisTurn = true;
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'status',
      text: `${actor.name} flinched and couldn't act due to ${source}.`,
    });
    return;
  }

  if (actor.persistentStatus?.kind === 'stun') {
    const failChance = clampUnitInterval(actor.persistentStatus.stunFailChance, 0.25);
    if (failChance > 0 && context.rng() < failChance) {
      actor.actedThisTurn = true;
      const verb =
        action.kind === 'guard'
          ? 'guard'
          : action.kind === 'swap'
            ? 'swap'
            : 'use a skill';
      pushLog(state, {
        turn: state.turnNumber,
        kind: 'status',
        text: `${actor.name} is stunned and cannot ${verb}.`,
      });
      return;
    }
  }

  if (action.kind === 'swap') {
    actor.actedThisTurn = true;
    performSwap(state, sideState, action.actorMemberIndex, action.benchMemberIndex);
    return;
  }

  if (action.kind === 'guard') {
    const guard = rollGuard(actor.consecutiveSuccessfulGuardCount, context.rng);
    actor.consecutiveSuccessfulGuardCount = guard.nextConsecutiveSuccessfulCount;
    actor.guardActive = true;
    actor.guardSucceeded = guard.succeeded;
    actor.actedThisTurn = true;
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'action',
      text: `${sideState.label}'s ${actor.name} used Guard.`,
    });
    if (!guard.succeeded) {
      pushLog(state, { turn: state.turnNumber, kind: 'status', text: 'Guard failed!' });
    }
    return;
  }

  actor.actedThisTurn = true;
  resolveSkillAction(state, sideState, opponentState, action, context);
}

function finishTurnResolution(state: DuelBattleState): void {
  state.player.pendingActions = null;
  state.opponent.pendingActions = null;
  state.turnResolution = null;
  clearGuardFlags(state.player);
  clearGuardFlags(state.opponent);
  if (state.phase !== 'finished') {
    applyEndTurnEffects(state);
  }
  cleanupFaintedActiveSlots(state.player);
  cleanupFaintedActiveSlots(state.opponent);
  if (state.phase === 'finished') {
    return;
  }
  resolveOutcomeOrNextPhase(state);
}

function collectOrderedActions(state: DuelBattleState, context: ResolveContext): OrderedAction[] {
  const all = [
    ...(state.player.pendingActions ?? []).map((action) => ({ side: 'player' as const, action })),
    ...(state.opponent.pendingActions ?? []).map((action) => ({ side: 'opponent' as const, action })),
  ];
  const withMeta: OrderedAction[] = [];
  for (const entry of all) {
    const sideState = getSide(state, entry.side);
    const actor = sideState.team[entry.action.actorMemberIndex];
    if (!actor) continue;
    withMeta.push({
      side: entry.side,
      action: entry.action,
      priority: resolveActionPriority(entry.action, actor, context.indexes.skillById),
      speed: resolveEffectiveSpeed(actor),
      tieRoll: context.rng(),
    });
  }
  const forfeits = withMeta.filter((e) => e.action.kind === 'forfeit');
  const swaps = withMeta.filter((e) => e.action.kind === 'swap');
  const guards = withMeta.filter((e) => e.action.kind === 'guard');
  const skills = withMeta.filter((e) => e.action.kind === 'skill');
  const sortBySpeedThenTie = (a: OrderedAction, b: OrderedAction) =>
    b.speed !== a.speed ? b.speed - a.speed : b.tieRoll - a.tieRoll;
  const sortByPrioritySpeedTie = (a: OrderedAction, b: OrderedAction) =>
    b.priority !== a.priority ? b.priority - a.priority : b.speed !== a.speed ? b.speed - a.speed : b.tieRoll - a.tieRoll;
  swaps.sort(sortBySpeedThenTie);
  guards.sort(sortBySpeedThenTie);
  skills.sort(sortByPrioritySpeedTie);
  if (state.format === 'singles') {
    const sortByPrioritySpeedPlayerFirst = (a: OrderedAction, b: OrderedAction) =>
      b.priority !== a.priority
        ? b.priority - a.priority
        : b.speed !== a.speed
          ? b.speed - a.speed
          : a.side === b.side
            ? 0
            : a.side === 'player'
              ? -1
              : 1;
    skills.sort(sortByPrioritySpeedPlayerFirst);
  }
  return [...forfeits, ...swaps, ...guards, ...skills];
}

function resolveActionPriority(
  action: DuelAction,
  actor: DuelBattleCritterState,
  skillById: Map<string, SkillDefinition>,
): number {
  if (action.kind === 'forfeit') {
    return FORFEIT_PRIORITY;
  }
  if (action.kind === 'swap') {
    return SWAP_PRIORITY;
  }
  if (action.kind === 'guard') {
    return GUARD_PRIORITY;
  }
  const skillId = actor.equippedSkillIds[action.skillSlotIndex];
  const skill = skillId ? skillById.get(skillId) : null;
  return resolveSkillPriorityShared(skill?.priority);
}

function resolveEffectiveSpeed(critter: DuelBattleCritterState): number {
  const base = resolveEffectiveSpeedShared(critter.speed, critter.speedModifier);
  if (critter.persistentStatus?.kind !== 'stun') {
    return base;
  }
  return Math.max(1, base * resolveStunSpeedMultiplier(critter.persistentStatus));
}

function performSwap(state: DuelBattleState, side: DuelBattleSideState, actorIndex: number, benchIndex: number): void {
  const activeSlot = side.activeMemberIndices.findIndex((entry) => entry === actorIndex);
  if (activeSlot < 0) {
    return;
  }
  const leaving = side.team[actorIndex];
  const entering = side.team[benchIndex];
  if (!leaving || !entering || entering.fainted) {
    return;
  }
  side.activeMemberIndices[activeSlot] = benchIndex;
  resetVolatileBattleState(leaving);
  prepareSwitchInTracking(entering, state.turnNumber + 1);
  pushLog(state, {
    turn: state.turnNumber,
    kind: 'swap',
    text: `${side.label} swapped ${leaving.name} for ${entering.name}.`,
  });
}

function resolveSkillAction(
  state: DuelBattleState,
  side: DuelBattleSideState,
  opponent: DuelBattleSideState,
  action: Extract<DuelAction, { kind: 'skill' }>,
  context: ResolveContext,
): void {
  const actor = side.team[action.actorMemberIndex];
  if (!actor || actor.fainted) {
    return;
  }
  const skillId = actor.equippedSkillIds[action.skillSlotIndex];
  const skill = skillId ? context.indexes.skillById.get(skillId) : null;
  const resolvedSkill = skill ?? createFallbackSkill();
  const resolvedSkillId = typeof resolvedSkill.skill_id === 'string' && resolvedSkill.skill_id.trim().length > 0
    ? resolvedSkill.skill_id.trim()
    : (skillId ?? createFallbackSkill().skill_id);
  const targetIndices = resolveExecutionTargetMemberIndices(
    state,
    side.id,
    action,
    resolvedSkill,
    context,
  );
  if (targetIndices.length > 0) {
    action.targetMemberIndex = targetIndices[0] ?? action.targetMemberIndex;
  }
  if (targetIndices.length > 1) {
    action.targetMemberIndices = [...targetIndices];
  } else {
    delete action.targetMemberIndices;
  }
  const targets: DuelBattleCritterState[] = [];
  const targetSideState = resolvedSkill.type === 'damage' ? opponent : side;
  for (const memberIndex of targetIndices) {
    const target = targetSideState.team[memberIndex] ?? null;
    if (target && !target.fainted && target.currentHp > 0) {
      targets.push(target);
    }
  }
  if (resolvedSkill.type === 'damage' && targets.length === 0) {
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'action',
      text: `${side.label}'s ${actor.name} used ${resolvedSkill.skill_name}, but no target was available.`,
    });
    recordSkillUsage(actor, resolvedSkillId, true);
    return;
  }

  const targetNames = targets.map((t) => t.name).join(' and ');
  const actionLine =
    targets.length > 0
      ? `${side.label}'s ${actor.name} used ${resolvedSkill.skill_name} on ${targetNames}.`
      : `${side.label}'s ${actor.name} used ${resolvedSkill.skill_name}.`;
  pushLog(state, {
    turn: state.turnNumber,
    kind: 'action',
    text: actionLine,
  });

  const skillEffectLookup = Object.fromEntries(context.indexes.skillEffectById.entries());
  const resolvedAttachments = resolveSkillEffectAttachmentsForRuntime(resolvedSkill, skillEffectLookup);
  const appliedAttachments = resolvedAttachments.filter(
    (a) => a.procChance >= 1 || context.rng() < a.procChance,
  );
  const attachmentResolution = resolveAppliedSkillAttachments(appliedAttachments, skillEffectLookup);

  for (const target of targets) {
    let dealtDamage = 0;
    if (resolvedSkill.type === 'damage') {
      dealtDamage = applySkillDamage(state, actor, target, resolvedSkill, context);
    }
    applySkillHealing(state, actor, target, resolvedSkill, dealtDamage);
    applySkillEffectsFromResolution(
      state,
      actor,
      target,
      resolvedSkill,
      context,
      attachmentResolution,
      dealtDamage,
    );
    applyOnHitStatusEffects(
      state,
      actor,
      target,
      resolvedSkill,
      context,
      appliedAttachments,
      dealtDamage,
    );
  }
  recordSkillUsage(actor, resolvedSkillId, resolvedSkill.type === 'damage');
}

function resolveExecutionTargetMemberIndices(
  state: DuelBattleState,
  side: DuelSideId,
  action: Extract<DuelAction, { kind: 'skill' }>,
  skill: SkillDefinition,
  context: ResolveContext,
): number[] {
  const viable = getViableTargetsForSkill(state, side, action.actorMemberIndex, action.skillSlotIndex, context);
  if (viable.length <= 0) {
    return [];
  }
  const viableIndices = Array.from(
    new Set(
      viable
        .map((entry) => entry.memberIndex)
        .filter((memberIndex) => Number.isInteger(memberIndex) && memberIndex >= 0),
    ),
  );
  if (viableIndices.length <= 0) {
    return [];
  }

  const requestedIndices = action.targetMemberIndices?.length ? action.targetMemberIndices : [action.targetMemberIndex];
  const selected: number[] = [];
  const selectionRange = getSkillTargetSelectionRange(skill, state.format, viableIndices.length);
  if (selectionRange.max <= 0) {
    return [];
  }
  requestedIndices.forEach((memberIndex) => {
    if (selected.length >= selectionRange.max) {
      return;
    }
    if (!viableIndices.includes(memberIndex)) {
      return;
    }
    if (selected.includes(memberIndex)) {
      return;
    }
    selected.push(memberIndex);
  });

  const candidatePool = viableIndices.filter((memberIndex) => !selected.includes(memberIndex));
  while (selected.length < selectionRange.min && candidatePool.length > 0) {
    const picked =
      state.format === 'doubles' && candidatePool.length === 1
        ? candidatePool[0] ?? null
        : pickRandomEntry(candidatePool, context.rng);
    if (picked == null) {
      break;
    }
    selected.push(picked);
    const poolIndex = candidatePool.indexOf(picked);
    if (poolIndex >= 0) {
      candidatePool.splice(poolIndex, 1);
    }
  }

  return selected;
}

function applySkillDamage(
  state: DuelBattleState,
  attacker: DuelBattleCritterState,
  defender: DuelBattleCritterState,
  skill: SkillDefinition,
  context: ResolveContext,
): number {
  const consumedCritBonus = Math.max(
    0,
    Math.min(
      1,
      consumePendingCritChanceBonus(attacker, context.indexes.skillEffectById) + getEquipmentCritChanceBonus(attacker),
    ),
  );
  const result = computeBattleDamage({
    attacker: {
      level: attacker.level,
      attack: attacker.attack,
      attackModifier: attacker.attackModifier,
      element: attacker.element,
    },
    defender: {
      defense: defender.defense,
      defenseModifier: defender.defenseModifier,
      guardActive: defender.guardActive,
      equipmentDefensePositiveBonus: defender.equipmentDefensePositiveBonus,
      element: defender.element,
      currentHp: defender.currentHp,
    },
    skill: { damage: skill.damage, element: skill.element },
    elementChart: context.elementChart,
    rng: context.rng,
    consumedCritBonus,
    defenderGuarded: defender.guardActive,
    guardSucceeded: defender.guardSucceeded,
  });
  const { damage, damageDealt, isCrit, typeMult } = result;
  defender.currentHp = Math.max(0, defender.currentHp - damage);
  pushLog(state, {
    turn: state.turnNumber,
    kind: 'damage',
    text: `${defender.name} took ${damage} damage.`,
  });
  if (isCrit) {
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'status',
      text: 'It was a crit!',
    });
  }
  if (typeMult >= 2) {
    pushLog(state, { turn: state.turnNumber, kind: 'status', text: "It's super effective!" });
  } else if (typeMult >= 1.1) {
    pushLog(state, { turn: state.turnNumber, kind: 'status', text: "It's effective!" });
  } else if (typeMult > 0 && typeMult < 1) {
    pushLog(state, { turn: state.turnNumber, kind: 'status', text: "It's not very effective..." });
  } else if (typeMult === 0) {
    pushLog(state, { turn: state.turnNumber, kind: 'status', text: "It had no effect." });
  }
  if (defender.currentHp <= 0 && !defender.fainted) {
    defender.fainted = true;
    defender.flinch = null;
    defender.persistentStatus = null;
    clearPersistentHealState(defender);
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'knockout',
      text: `${defender.name} was knocked out.`,
    });
  }
  return damageDealt;
}

function applySkillHealing(
  state: DuelBattleState,
  actor: DuelBattleCritterState,
  target: DuelBattleCritterState | null,
  skill: SkillDefinition,
  dealtDamage: number,
): void {
  const healRecipient =
    skill.type === 'support' && target && target.side === actor.side && !target.fainted
      ? target
      : actor;
  const healAmount = resolveRequestedSkillHealAmount(skill, healRecipient.maxHp, dealtDamage);
  if (healAmount <= 0) {
    return;
  }
  const before = healRecipient.currentHp;
  healRecipient.currentHp = Math.min(healRecipient.maxHp, healRecipient.currentHp + healAmount);
  const healed = Math.max(0, healRecipient.currentHp - before);
  if (healed <= 0) {
    return;
  }
  pushLog(state, {
    turn: state.turnNumber,
    kind: 'heal',
    text: `${healRecipient.name} healed ${healed} HP.`,
  });
}

function applySkillEffectsFromResolution(
  state: DuelBattleState,
  actor: DuelBattleCritterState,
  target: DuelBattleCritterState | null,
  skill: SkillDefinition,
  context: ResolveContext,
  resolution: {
    attackerEffectAttachments: SkillEffectAttachment[];
    defenderEffectAttachments: SkillEffectAttachment[];
    recoilAttachments: SkillEffectAttachment[];
    persistentHealAttachments: SkillEffectAttachment[];
    attackerCritChanceBuffAttachments: SkillEffectAttachment[];
    attackerCritChanceBuffPercent: number;
  },
  dealtDamage: number,
): void {
  const skillEffectLookup = Object.fromEntries(context.indexes.skillEffectById.entries());
  const supportTarget =
    skill.type === 'support' && target && target.side === actor.side && !target.fainted
      ? target
      : actor;

  for (const attachment of resolution.attackerEffectAttachments) {
    const effect = skillEffectLookup[attachment.effectId];
    if (!effect) continue;
    const buffPercent =
      typeof attachment.buffPercent === 'number' && Number.isFinite(attachment.buffPercent)
        ? attachment.buffPercent
        : typeof effect.buffPercent === 'number'
          ? effect.buffPercent
          : 0.1;
    if (effect.effect_type === 'crit_buff') {
      continue;
    }
    if (effect.effect_type === 'atk_buff') {
      supportTarget.attackModifier = clampBattleModifier(supportTarget.attackModifier + buffPercent);
      recordActiveEffect(supportTarget, attachment.effectId, skill.skill_name, buffPercent);
      pushLog(state, { turn: state.turnNumber, kind: 'status', text: `${supportTarget.name}'s attack rose.` });
      continue;
    }
    if (effect.effect_type === 'def_buff') {
      supportTarget.defenseModifier = clampBattleModifier(supportTarget.defenseModifier + buffPercent);
      recordActiveEffect(supportTarget, attachment.effectId, skill.skill_name, buffPercent);
      pushLog(state, { turn: state.turnNumber, kind: 'status', text: `${supportTarget.name}'s defense rose.` });
      continue;
    }
    if (effect.effect_type === 'speed_buff') {
      supportTarget.speedModifier = clampBattleModifier(supportTarget.speedModifier + buffPercent);
      recordActiveEffect(supportTarget, attachment.effectId, skill.skill_name, buffPercent);
      pushLog(state, { turn: state.turnNumber, kind: 'status', text: `${supportTarget.name}'s speed rose.` });
      continue;
    }
    if (effect.effect_type === 'self_atk_debuff') {
      actor.attackModifier = clampBattleModifier(actor.attackModifier - Math.abs(buffPercent));
      recordActiveEffect(actor, attachment.effectId, skill.skill_name, buffPercent);
      pushLog(state, { turn: state.turnNumber, kind: 'status', text: `${actor.name}'s attack fell.` });
      continue;
    }
    if (effect.effect_type === 'self_def_debuff') {
      actor.defenseModifier = clampBattleModifier(actor.defenseModifier - Math.abs(buffPercent));
      recordActiveEffect(actor, attachment.effectId, skill.skill_name, buffPercent);
      pushLog(state, { turn: state.turnNumber, kind: 'status', text: `${actor.name}'s defense fell.` });
      continue;
    }
    if (effect.effect_type === 'self_speed_debuff') {
      actor.speedModifier = clampBattleModifier(actor.speedModifier - Math.abs(buffPercent));
      recordActiveEffect(actor, attachment.effectId, skill.skill_name, buffPercent);
      pushLog(state, { turn: state.turnNumber, kind: 'status', text: `${actor.name}'s speed fell.` });
    }
  }

  if (resolution.attackerCritChanceBuffPercent > 0) {
    for (const attachment of resolution.attackerCritChanceBuffAttachments) {
      const effect = skillEffectLookup[attachment.effectId];
      if (!effect || effect.effect_type !== 'crit_buff') {
        continue;
      }
      const buffPercent =
        typeof attachment.buffPercent === 'number' && Number.isFinite(attachment.buffPercent)
          ? attachment.buffPercent
          : typeof effect.buffPercent === 'number'
            ? effect.buffPercent
            : 0.1;
      applyPendingCritChanceBuff(actor, attachment.effectId, skill.skill_name, buffPercent);
    }
  }

  for (const attachment of resolution.defenderEffectAttachments) {
    if (!target) continue;
    const effect = skillEffectLookup[attachment.effectId];
    if (!effect) continue;
    const buffPercent =
      typeof attachment.buffPercent === 'number' && Number.isFinite(attachment.buffPercent)
        ? attachment.buffPercent
        : typeof effect.buffPercent === 'number'
          ? effect.buffPercent
          : 0.1;
    const amount = Math.abs(buffPercent);
    if (effect.effect_type === 'target_atk_debuff') {
      target.attackModifier = clampBattleModifier(target.attackModifier - amount);
      recordActiveEffect(target, attachment.effectId, skill.skill_name, amount);
      pushLog(state, { turn: state.turnNumber, kind: 'status', text: `${target.name}'s attack fell.` });
      continue;
    }
    if (effect.effect_type === 'target_def_debuff') {
      target.defenseModifier = clampBattleModifier(target.defenseModifier - amount);
      recordActiveEffect(target, attachment.effectId, skill.skill_name, amount);
      pushLog(state, { turn: state.turnNumber, kind: 'status', text: `${target.name}'s defense fell.` });
      continue;
    }
    if (effect.effect_type === 'target_speed_debuff') {
      target.speedModifier = clampBattleModifier(target.speedModifier - amount);
      recordActiveEffect(target, attachment.effectId, skill.skill_name, amount);
      pushLog(state, { turn: state.turnNumber, kind: 'status', text: `${target.name}'s speed fell.` });
    }
  }

  for (const attachment of resolution.persistentHealAttachments) {
    const recipient =
      skill.type === 'support' && target && target.side === actor.side && !target.fainted
        ? target
        : skill.type === 'damage' && target && target.side !== actor.side && !target.fainted
          ? target
          : actor;
    const persistent = resolvePersistentHealStateFromAttachment(attachment, skill.skill_name);
    if (!persistent) {
      continue;
    }
    applyPersistentHealState(recipient, persistent);
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'status',
      text: `${recipient.name} gained end-of-turn healing for ${persistent.remainingTurns} turns.`,
    });
  }

  const recoilAmount = resolveRequestedSkillRecoilAmount(
    resolution.recoilAttachments,
    actor.maxHp,
    dealtDamage,
  );
  if (recoilAmount > 0 && !actor.fainted && actor.currentHp > 0) {
    actor.currentHp = Math.max(0, actor.currentHp - recoilAmount);
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'damage',
      text: `${actor.name} took ${recoilAmount} recoil damage.`,
    });
    if (actor.currentHp <= 0 && !actor.fainted) {
      actor.fainted = true;
      actor.flinch = null;
      actor.persistentStatus = null;
      clearPersistentHealState(actor);
      pushLog(state, {
        turn: state.turnNumber,
        kind: 'knockout',
        text: `${actor.name} was knocked out.`,
      });
    }
  }
}

function applyOnHitStatusEffects(
  state: DuelBattleState,
  actor: DuelBattleCritterState,
  target: DuelBattleCritterState,
  skill: SkillDefinition,
  context: ResolveContext,
  appliedSkillAttachments: SkillEffectAttachment[],
  dealtDamage: number,
): void {
  if (skill.type !== 'damage' || dealtDamage <= 0 || target.fainted || target.currentHp <= 0) {
    return;
  }
  const skillEffectLookup = Object.fromEntries(context.indexes.skillEffectById.entries());

  const applyToxic = (sourceName: string, potencyBase: number, potencyPerTurn: number, statusEffectId?: string): void => {
    if (target.persistentStatus) {
      return;
    }
    target.persistentStatus = {
      kind: 'toxic',
      potencyBase: clampUnitInterval(potencyBase, 0.05),
      potencyPerTurn: clampUnitInterval(potencyPerTurn, 0.05),
      turnCount: 0,
      source: sanitizeStatusSource(sourceName, skill.skill_name),
      ...(typeof statusEffectId === 'string' && statusEffectId.trim().length > 0 ? { effectId: statusEffectId.trim() } : {}),
    };
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'status',
      text: `${target.name} was afflicted with Toxic!`,
    });
  };

  const applyStun = (sourceName: string, stunFailChance: number, stunSlowdown: number, statusEffectId?: string): void => {
    if (target.persistentStatus) {
      return;
    }
    target.persistentStatus = {
      kind: 'stun',
      stunFailChance: clampUnitInterval(stunFailChance, 0.25),
      stunSlowdown: clampUnitInterval(stunSlowdown, 0.5),
      source: sanitizeStatusSource(sourceName, skill.skill_name),
      ...(typeof statusEffectId === 'string' && statusEffectId.trim().length > 0 ? { effectId: statusEffectId.trim() } : {}),
    };
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'status',
      text: `${target.name} was stunned!`,
    });
  };

  const applyFlinch = (sourceName: string, statusEffectId?: string): void => {
    if (target.actedThisTurn) {
      return;
    }
    target.flinch = {
      turnNumber: state.turnNumber,
      source: sanitizeStatusSource(sourceName, skill.skill_name),
      ...(typeof statusEffectId === 'string' && statusEffectId.trim().length > 0 ? { effectId: statusEffectId.trim() } : {}),
    };
  };

  const canApplyFirstUseFlinch = (firstUseOnlyRaw: unknown, firstOverallOnlyRaw: unknown, priorUseCountRaw: unknown): boolean => {
    const firstUseOnly = firstUseOnlyRaw === true;
    if (!firstUseOnly) {
      return true;
    }
    const priorUseCount = typeof priorUseCountRaw === 'number' && Number.isFinite(priorUseCountRaw)
      ? Math.max(0, Math.floor(priorUseCountRaw))
      : 0;
    if (priorUseCount > 0) {
      return false;
    }
    const firstOverallOnly = firstOverallOnlyRaw === true;
    if (firstOverallOnly && state.turnNumber !== Math.max(1, Math.floor(actor.firstActionableTurnNumber))) {
      return false;
    }
    return true;
  };

  for (const attachment of appliedSkillAttachments) {
    const effect = skillEffectLookup[attachment.effectId];
    if (!effect) {
      continue;
    }
    if (effect.effect_type === 'inflict_toxic') {
      applyToxic(
        skill.skill_name,
        attachment.toxicPotencyBase ?? 0.05,
        attachment.toxicPotencyPerTurn ?? 0.05,
        attachment.effectId,
      );
    } else if (effect.effect_type === 'inflict_stun') {
      applyStun(
        skill.skill_name,
        attachment.stunFailChance ?? 0.25,
        attachment.stunSlowdown ?? 0.5,
        attachment.effectId,
      );
    } else if (effect.effect_type === 'flinch_chance') {
      const skillUseCount = actor.skillUseCountBySkillId[skill.skill_id] ?? 0;
      if (!canApplyFirstUseFlinch(attachment.flinchFirstUseOnly, attachment.flinchFirstOverallOnly, skillUseCount)) {
        continue;
      }
      applyFlinch(skill.skill_name, attachment.effectId);
    }
  }

  for (const effect of actor.equipmentEffectInstances ?? []) {
    if (
      effect.effectType !== 'apply_toxic' &&
      effect.effectType !== 'apply_stun' &&
      effect.effectType !== 'flinch_chance'
    ) {
      continue;
    }
    if (
      effect.effectType === 'flinch_chance' &&
      !canApplyFirstUseFlinch(
        effect.flinchFirstUseOnly,
        effect.flinchFirstOverallOnly,
        actor.damageSkillUseCountSinceSwitchIn,
      )
    ) {
      continue;
    }
    const procChance = clampUnitInterval(effect.procChance ?? 0.2, 0.2);
    if (procChance <= 0 || context.rng() >= procChance) {
      continue;
    }
    const sourceName = sanitizeStatusSource(actor.equipmentEffectSourceById[effect.effectId], effect.effectId);
    if (effect.effectType === 'apply_toxic') {
      applyToxic(sourceName, effect.toxicPotencyBase ?? 0.05, effect.toxicPotencyPerTurn ?? 0.05, effect.effectId);
    } else if (effect.effectType === 'apply_stun') {
      applyStun(sourceName, effect.stunFailChance ?? 0.25, effect.stunSlowdown ?? 0.5, effect.effectId);
    } else {
      applyFlinch(sourceName, effect.effectId);
    }
  }
}

function resolvePersistentHealStateFromAttachment(
  attachment: SkillEffectAttachment,
  sourceName: string,
): DuelBattleCritterState['persistentHeal'] {
  const mode = attachment.persistentHealMode === 'flat' ? 'flat' : 'percent_max_hp';
  const value = mode === 'flat'
    ? Math.max(1, Math.floor(attachment.persistentHealValue ?? 1))
    : Math.max(0, Math.min(1, attachment.persistentHealValue ?? 0.05));
  const remainingTurns = Math.max(1, Math.floor(attachment.persistentHealDurationTurns ?? 1));
  if (value <= 0 || !attachment.effectId) {
    return null;
  }
  return {
    effectId: attachment.effectId,
    sourceName,
    mode,
    value,
    remainingTurns,
  };
}

function applyPersistentHealState(
  critter: DuelBattleCritterState,
  next: NonNullable<DuelBattleCritterState['persistentHeal']>,
): void {
  clearPersistentHealState(critter);
  critter.persistentHeal = { ...next };
  if (!critter.activeEffectIds.includes(next.effectId)) {
    critter.activeEffectIds.push(next.effectId);
  }
  critter.activeEffectSourceById[next.effectId] = next.sourceName;
  critter.activeEffectValueById[next.effectId] = next.value;
}

function clearPersistentHealState(critter: DuelBattleCritterState): void {
  if (!critter.persistentHeal) {
    return;
  }
  const effectId = critter.persistentHeal.effectId;
  critter.persistentHeal = null;
  if (effectId) {
    critter.activeEffectIds = critter.activeEffectIds.filter((entry) => entry !== effectId);
    delete critter.activeEffectSourceById[effectId];
    delete critter.activeEffectValueById[effectId];
  }
}

function getEquipmentPersistentHealConfigs(
  critter: DuelBattleCritterState,
): Array<{ mode: 'flat' | 'percent_max_hp'; value: number; sourceName: string }> {
  const configs: Array<{ mode: 'flat' | 'percent_max_hp'; value: number; sourceName: string }> = [];
  for (const effect of critter.equipmentEffectInstances ?? []) {
    if (effect.effectType !== 'persistent_heal') {
      continue;
    }
    const mode = effect.persistentHealMode === 'flat' ? 'flat' : 'percent_max_hp';
    const value = mode === 'flat'
      ? Math.max(1, Math.floor(effect.persistentHealValue ?? 1))
      : Math.max(0, Math.min(1, effect.persistentHealValue ?? 0));
    if (value <= 0) {
      continue;
    }
    configs.push({
      mode,
      value,
      sourceName: (critter.equipmentEffectSourceById[effect.effectId] ?? effect.effectId).trim(),
    });
  }
  return configs;
}

function getEquipmentCritChanceBonus(critter: DuelBattleCritterState): number {
  let total = 0;
  for (const effect of critter.equipmentEffectInstances ?? []) {
    if (effect.effectType !== 'crit_buff') {
      continue;
    }
    total += Math.max(0, Math.min(1, effect.critChanceBonus ?? 0));
  }
  return Math.max(0, Math.min(1, total));
}

function resolvePersistentHealAmount(
  maxHp: number,
  heal: { mode: 'flat' | 'percent_max_hp'; value: number },
): number {
  if (heal.mode === 'flat') {
    return Math.max(1, Math.floor(heal.value));
  }
  return Math.max(0, Math.floor(Math.max(1, maxHp) * Math.max(0, Math.min(1, heal.value))));
}

function collectEndTurnCrittersInSpeedOrder(state: DuelBattleState): DuelBattleCritterState[] {
  const ordered: DuelBattleCritterState[] = [];
  const sides: DuelBattleSideState[] = [state.player, state.opponent];
  for (const side of sides) {
    for (const memberIndex of getAliveActiveIndices(side)) {
      const critter = side.team[memberIndex];
      if (!critter || critter.fainted || critter.currentHp <= 0) {
        continue;
      }
      ordered.push(critter);
    }
  }
  ordered.sort((left, right) => {
    const speedDelta = resolveEffectiveSpeed(right) - resolveEffectiveSpeed(left);
    if (speedDelta !== 0) {
      return speedDelta;
    }
    if (left.side !== right.side) {
      return left.side === 'player' ? -1 : 1;
    }
    return left.memberIndex - right.memberIndex;
  });
  return ordered;
}

function applyEndTurnEffects(state: DuelBattleState): void {
  const sides: DuelBattleSideState[] = [state.player, state.opponent];
  for (const side of sides) {
    for (const entry of side.team) {
      entry.flinch = null;
    }
  }
  for (const critter of collectEndTurnCrittersInSpeedOrder(state)) {
    if (critter.fainted || critter.currentHp <= 0) {
      continue;
    }
    if (critter.persistentStatus?.kind === 'toxic') {
      const toxicDamage = resolveToxicTickDamage(critter.maxHp, critter.persistentStatus).damage;
      if (toxicDamage > 0) {
        const beforeHp = critter.currentHp;
        critter.currentHp = Math.max(0, critter.currentHp - toxicDamage);
        const dealtDamage = Math.max(0, beforeHp - critter.currentHp);
        if (dealtDamage > 0) {
          pushLog(state, {
            turn: state.turnNumber,
            kind: 'damage',
            text: `${critter.name} took ${dealtDamage} damage from Toxic.`,
          });
        }
        if (critter.currentHp <= 0) {
          critter.fainted = true;
          critter.flinch = null;
          critter.persistentStatus = null;
          clearPersistentHealState(critter);
          pushLog(state, {
            turn: state.turnNumber,
            kind: 'knockout',
            text: `${critter.name} was knocked out.`,
          });
          continue;
        }
      }
      if (critter.persistentStatus?.kind === 'toxic') {
        critter.persistentStatus.turnCount = Math.max(0, Math.floor(critter.persistentStatus.turnCount) + 1);
      }
    }
    let requestedHeal = 0;
    const healSourceNames: string[] = [];
    if (critter.persistentHeal) {
      requestedHeal += resolvePersistentHealAmount(critter.maxHp, critter.persistentHeal);
      if (critter.persistentHeal.sourceName.trim()) {
        healSourceNames.push(critter.persistentHeal.sourceName.trim());
      }
      critter.persistentHeal.remainingTurns = Math.max(0, critter.persistentHeal.remainingTurns - 1);
      if (critter.persistentHeal.remainingTurns <= 0) {
        clearPersistentHealState(critter);
      }
    }
    const equipmentPersistentHeals = getEquipmentPersistentHealConfigs(critter);
    for (const healConfig of equipmentPersistentHeals) {
      requestedHeal += resolvePersistentHealAmount(critter.maxHp, healConfig);
      if (healConfig.sourceName.trim()) {
        healSourceNames.push(healConfig.sourceName.trim());
      }
    }
    if (requestedHeal <= 0) {
      continue;
    }
    const beforeHp = critter.currentHp;
    critter.currentHp = Math.min(critter.maxHp, critter.currentHp + requestedHeal);
    const actualHeal = Math.max(0, critter.currentHp - beforeHp);
    if (actualHeal <= 0) {
      continue;
    }
    const sourceLabel = healSourceNames.filter((entry, index, values) => values.indexOf(entry) === index).join(', ') || 'end-of-turn effects';
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'heal',
      text: `${critter.name} was healed +${actualHeal} HP by ${sourceLabel}.`,
    });
  }
}

function resolveTargetCritter(
  side: DuelBattleSideState,
  opponent: DuelBattleSideState,
  actor: DuelBattleCritterState,
  skill: SkillDefinition,
  requestedTargetIndex: number,
  rng: () => number,
): DuelBattleCritterState | null {
  if (skill.type === 'damage') {
    const aliveTargets = getAliveActiveIndices(opponent);
    if (aliveTargets.length === 0) {
      return null;
    }
    if (aliveTargets.includes(requestedTargetIndex)) {
      return opponent.team[requestedTargetIndex] ?? null;
    }
    const fallbackTargetIndex = aliveTargets[Math.floor(rng() * aliveTargets.length)] ?? aliveTargets[0];
    if (fallbackTargetIndex == null) {
      return null;
    }
    return opponent.team[fallbackTargetIndex] ?? null;
  }
  const aliveTargets = getAliveActiveIndices(side);
  if (aliveTargets.length === 0) {
    return actor;
  }
  if (aliveTargets.includes(requestedTargetIndex)) {
    return side.team[requestedTargetIndex] ?? actor;
  }
  const fallbackTargetIndex = aliveTargets[Math.floor(rng() * aliveTargets.length)] ?? aliveTargets[0];
  if (fallbackTargetIndex == null) {
    return actor;
  }
  return side.team[fallbackTargetIndex] ?? actor;
}

function resolveOutcomeOrNextPhase(state: DuelBattleState): void {
  const playerAlive = countAlive(state.player.team);
  const opponentAlive = countAlive(state.opponent.team);
  if (playerAlive <= 0 && opponentAlive <= 0) {
    state.winner = 'draw';
    state.phase = 'finished';
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'result',
      text: 'Both sides are out of critters. The duel ends in a draw.',
    });
    return;
  }
  if (playerAlive <= 0) {
    state.winner = 'opponent';
    state.phase = 'finished';
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'result',
      text: `${state.opponent.label} wins the duel.`,
    });
    return;
  }
  if (opponentAlive <= 0) {
    state.winner = 'player';
    state.phase = 'finished';
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'result',
      text: `${state.player.label} wins the duel.`,
    });
    return;
  }

  const playerNeeds = getReplacementCountNeeded(state, state.player);
  const opponentNeeds = getReplacementCountNeeded(state, state.opponent);
  if (playerNeeds > 0 || opponentNeeds > 0) {
    cleanupFaintedActiveSlots(state.player);
    cleanupFaintedActiveSlots(state.opponent);
    state.phase = 'choose-replacements';
    state.player.pendingReplacements = playerNeeds === 0 ? [] : null;
    state.opponent.pendingReplacements = opponentNeeds === 0 ? [] : null;
    pushLog(state, {
      turn: state.turnNumber,
      kind: 'system',
      text: 'Replacement selection required before the next turn.',
    });
    return;
  }

  state.turnNumber += 1;
  state.phase = 'choose-actions';
  pushLog(state, {
    turn: state.turnNumber,
    kind: 'system',
    text: `Turn ${state.turnNumber}: choose actions.`,
  });
}

function submitReplacementSelection(
  state: DuelBattleState,
  side: DuelSideId,
  memberIndices: number[],
): DuelMutationResult {
  if (state.phase !== 'choose-replacements') {
    return { ok: false, error: 'Replacement selection is not active.' };
  }
  const sideState = getSide(state, side);
  const needed = getReplacementCountNeeded(state, sideState);
  if (needed === 0) {
    sideState.pendingReplacements = [];
  } else {
    const validation = validateReplacementSelection(sideState, memberIndices, needed);
    if (!validation.ok) {
      return validation;
    }
    sideState.pendingReplacements = [...memberIndices];
  }

  if (state.player.pendingReplacements === null || state.opponent.pendingReplacements === null) {
    return { ok: true };
  }

  const requiredActiveCount = getRequiredLeadCount(state.format);
  const nextTurnNumber = state.turnNumber + 1;
  applyReplacementSelection(state.player, requiredActiveCount, nextTurnNumber);
  applyReplacementSelection(state.opponent, requiredActiveCount, nextTurnNumber);
  state.player.pendingReplacements = null;
  state.opponent.pendingReplacements = null;

  const playerStillNeeds = getReplacementCountNeeded(state, state.player);
  const opponentStillNeeds = getReplacementCountNeeded(state, state.opponent);
  if (playerStillNeeds > 0 || opponentStillNeeds > 0) {
    state.phase = 'choose-replacements';
    state.player.pendingReplacements = playerStillNeeds === 0 ? [] : null;
    state.opponent.pendingReplacements = opponentStillNeeds === 0 ? [] : null;
    return { ok: true };
  }

  state.turnNumber += 1;
  state.phase = 'choose-actions';
  pushLog(state, {
    turn: state.turnNumber,
    kind: 'system',
    text: `Turn ${state.turnNumber}: replacements complete, choose actions.`,
  });
  return { ok: true };
}

function validateReplacementSelection(
  sideState: DuelBattleSideState,
  memberIndices: number[],
  needed: number,
): DuelMutationResult {
  if (memberIndices.length !== needed) {
    return { ok: false, error: `You must select exactly ${needed} replacement critter(s).` };
  }
  const activeSet = new Set(sideState.activeMemberIndices);
  const seen = new Set<number>();
  for (const memberIndex of memberIndices) {
    if (!Number.isInteger(memberIndex) || memberIndex < 0 || memberIndex >= sideState.team.length) {
      return { ok: false, error: 'Replacement selection includes an invalid team member.' };
    }
    if (seen.has(memberIndex)) {
      return { ok: false, error: 'Replacement selection cannot include duplicates.' };
    }
    if (activeSet.has(memberIndex)) {
      return { ok: false, error: 'Replacement must come from the bench.' };
    }
    const critter = sideState.team[memberIndex];
    if (!critter || critter.fainted || critter.currentHp <= 0) {
      return { ok: false, error: 'Replacement critter must be alive.' };
    }
    seen.add(memberIndex);
  }
  return { ok: true };
}

function applyReplacementSelection(
  side: DuelBattleSideState,
  requiredActiveCount: number,
  firstActionableTurnNumber: number,
): void {
  if (!side.pendingReplacements || side.pendingReplacements.length === 0) {
    return;
  }
  const aliveActiveCount = getAliveActiveIndices(side).length;
  const missingSlots = Math.max(0, requiredActiveCount - aliveActiveCount);
  if (missingSlots <= 0) {
    return;
  }
  const activeSet = new Set(side.activeMemberIndices);
  for (const memberIndex of side.pendingReplacements) {
    if (side.activeMemberIndices.length >= requiredActiveCount) {
      break;
    }
    if (activeSet.has(memberIndex)) {
      continue;
    }
    const critter = side.team[memberIndex];
    if (!critter || critter.fainted || critter.currentHp <= 0) {
      continue;
    }
    prepareSwitchInTracking(critter, firstActionableTurnNumber);
    side.activeMemberIndices.push(memberIndex);
    activeSet.add(memberIndex);
  }
}

function listLegalActionsForActor(
  state: DuelBattleState,
  side: DuelSideId,
  actorMemberIndex: number,
  context: ResolveContext,
  includeForfeit: boolean,
): DuelAction[] {
  const sideState = getSide(state, side);
  const opponent = getOpposingSide(state, side);
  if (!sideState.activeMemberIndices.includes(actorMemberIndex)) {
    return [];
  }
  const actor = sideState.team[actorMemberIndex];
  if (!actor || actor.fainted) {
    return [];
  }

  const actions: DuelAction[] = [];
  for (let slotIndex = 0; slotIndex < 4; slotIndex += 1) {
    const skillId = actor.equippedSkillIds[slotIndex];
    if (!skillId) {
      continue;
    }
    const skill = context.indexes.skillById.get(skillId);
    if (!skill) {
      continue;
    }
    const viable = getViableTargetsForSkill(state, side, actorMemberIndex, slotIndex, context);
    const targetKindD = (skill.targetKind ?? 'select_enemies') as SkillTargetKindDamage;
    const targetKindS = (skill.targetKind ?? 'select_allies') as SkillTargetKindSupport;

    if (skill.type === 'damage') {
      const enemyViable = viable.filter((v) => v.side !== side).map((v) => v.memberIndex);
      const selectionRange = getSkillTargetSelectionRange(skill, state.format, enemyViable.length);
      if (targetKindD === 'target_all_enemies' || targetKindD === 'target_all') {
        if (enemyViable.length > 0 || targetKindD === 'target_all') {
          const allIndices = viable.map((v) => v.memberIndex);
          actions.push({
            kind: 'skill',
            actorMemberIndex,
            skillSlotIndex: slotIndex,
            targetMemberIndex: allIndices[0] ?? 0,
            targetMemberIndices: allIndices,
          });
        }
        continue;
      }
      for (let targetCount = selectionRange.min; targetCount <= selectionRange.max; targetCount += 1) {
        if (targetCount === 1) {
          enemyViable.forEach((targetMemberIndex) => {
            actions.push({
              kind: 'skill',
              actorMemberIndex,
              skillSlotIndex: slotIndex,
              targetMemberIndex,
            });
          });
          continue;
        }
        combinations(enemyViable, targetCount).forEach((indices) => {
          actions.push({
            kind: 'skill',
            actorMemberIndex,
            skillSlotIndex: slotIndex,
            targetMemberIndex: indices[0] ?? 0,
            targetMemberIndices: indices,
          });
        });
      }
      continue;
    }
    const allyViable = viable.filter((v) => v.side === side).map((v) => v.memberIndex);
    const selectionRange = getSkillTargetSelectionRange(skill, state.format, allyViable.length);
    if (targetKindS === 'target_self' || targetKindS === 'target_team') {
      if (allyViable.length > 0) {
        actions.push({
          kind: 'skill',
          actorMemberIndex,
          skillSlotIndex: slotIndex,
          targetMemberIndex: allyViable[0] ?? 0,
          targetMemberIndices: allyViable,
        });
      }
      continue;
    }
    for (let targetCount = selectionRange.min; targetCount <= selectionRange.max; targetCount += 1) {
      if (targetCount === 1) {
        allyViable.forEach((targetMemberIndex) => {
          actions.push({
            kind: 'skill',
            actorMemberIndex,
            skillSlotIndex: slotIndex,
            targetMemberIndex,
          });
        });
        continue;
      }
      combinations(allyViable, targetCount).forEach((indices) => {
        actions.push({
          kind: 'skill',
          actorMemberIndex,
          skillSlotIndex: slotIndex,
          targetMemberIndex: indices[0] ?? 0,
          targetMemberIndices: indices,
        });
      });
    }
  }

  actions.push({
    kind: 'guard',
    actorMemberIndex,
  });

  sideState.team.forEach((candidate) => {
    if (candidate.memberIndex === actorMemberIndex) {
      return;
    }
    if (sideState.activeMemberIndices.includes(candidate.memberIndex)) {
      return;
    }
    if (candidate.fainted || candidate.currentHp <= 0) {
      return;
    }
    actions.push({
      kind: 'swap',
      actorMemberIndex,
      benchMemberIndex: candidate.memberIndex,
    });
  });

  if (includeForfeit) {
    actions.push({
      kind: 'forfeit',
      actorMemberIndex,
    });
  }

  return actions;
}

function combinations(arr: number[], k: number): number[][] {
  if (k <= 0 || k > arr.length) return [];
  if (k === 1) return arr.map((a) => [a]);
  const result: number[][] = [];
  for (let i = 0; i <= arr.length - k; i += 1) {
    const rest = combinations(arr.slice(i + 1), k - 1);
    rest.forEach((tail) => result.push([arr[i], ...tail]));
  }
  return result;
}

function chooseRandomLeadSelection(state: DuelBattleState, side: DuelSideId, rng: () => number): number[] {
  const sideState = getSide(state, side);
  const required = getRequiredLeadCount(state.format);
  const candidates = sideState.team
    .filter((entry) => !entry.fainted && entry.currentHp > 0)
    .map((entry) => entry.memberIndex);
  return pickRandomDistinct(candidates, required, rng);
}

function chooseRandomActions(
  state: DuelBattleState,
  side: DuelSideId,
  context: ResolveContext,
  rng: () => number,
): DuelActionSubmission {
  const sideState = getSide(state, side);
  const requiredActors = getActionRequiredActorIndices(state, sideState);
  const actions: DuelAction[] = [];
  const usedBenchTargets = new Set<number>();
  for (const actorMemberIndex of requiredActors) {
    const legal = listLegalActionsForActor(state, side, actorMemberIndex, context, false);
    let filtered = legal;
    if (usedBenchTargets.size > 0) {
      filtered = legal.filter((action) => action.kind !== 'swap' || !usedBenchTargets.has(action.benchMemberIndex));
      if (filtered.length === 0) {
        filtered = legal;
      }
    }
    const selected = pickRandomEntry(filtered, rng);
    if (selected) {
      if (selected.kind === 'swap') {
        usedBenchTargets.add(selected.benchMemberIndex);
      }
      actions.push(selected);
      continue;
    }
    actions.push({
      kind: 'guard',
      actorMemberIndex,
    });
  }
  return {
    side,
    actions,
  };
}

function chooseRandomReplacements(state: DuelBattleState, side: DuelSideId, rng: () => number): number[] {
  const sideState = getSide(state, side);
  const needed = getReplacementCountNeeded(state, sideState);
  if (needed <= 0) {
    return [];
  }
  const activeSet = new Set(sideState.activeMemberIndices);
  const candidates = sideState.team
    .filter((entry) => !entry.fainted && entry.currentHp > 0 && !activeSet.has(entry.memberIndex))
    .map((entry) => entry.memberIndex);
  return pickRandomDistinct(candidates, needed, rng);
}

function getActionRequiredActorIndices(state: DuelBattleState, side: DuelBattleSideState): number[] {
  const required = getRequiredLeadCount(state.format);
  const aliveActive = side.activeMemberIndices.filter((memberIndex) => {
    const critter = side.team[memberIndex];
    return Boolean(critter && !critter.fainted && critter.currentHp > 0);
  });
  return aliveActive.slice(0, required);
}

function getReplacementCountNeeded(state: DuelBattleState, side: DuelBattleSideState): number {
  const required = getRequiredLeadCount(state.format);
  const aliveActive = side.activeMemberIndices.filter((memberIndex) => {
    const critter = side.team[memberIndex];
    return Boolean(critter && !critter.fainted && critter.currentHp > 0);
  });
  return Math.max(0, required - aliveActive.length);
}

function getAliveActiveIndices(side: DuelBattleSideState): number[] {
  return side.activeMemberIndices.filter((memberIndex) => {
    const critter = side.team[memberIndex];
    return Boolean(critter && !critter.fainted && critter.currentHp > 0);
  });
}

function cleanupFaintedActiveSlots(side: DuelBattleSideState): void {
  side.activeMemberIndices = side.activeMemberIndices.filter((memberIndex) => {
    const critter = side.team[memberIndex];
    return Boolean(critter && !critter.fainted && critter.currentHp > 0);
  });
}

function cleanupFaintedActiveSlot(side: DuelBattleSideState, memberIndex: number): void {
  side.activeMemberIndices = side.activeMemberIndices.filter((entry) => entry !== memberIndex);
}

function clearGuardFlags(side: DuelBattleSideState): void {
  side.team.forEach((entry) => {
    entry.guardActive = false;
    entry.guardSucceeded = false;
  });
}

function resetActionAttemptFlags(side: DuelBattleSideState): void {
  side.team.forEach((entry) => {
    entry.actedThisTurn = false;
  });
}

function resetVolatileBattleState(critter: DuelBattleCritterState): void {
  clearPersistentHealState(critter);
  critter.attackModifier = 1;
  critter.defenseModifier = 1;
  critter.speedModifier = 1;
  critter.guardActive = false;
  critter.guardSucceeded = false;
  critter.flinch = null;
  critter.activeEffectIds = [];
  critter.activeEffectSourceById = {};
  critter.activeEffectValueById = {};
  critter.pendingCritChanceBonus = 0;
  critter.actedThisTurn = false;
  critter.consecutiveSuccessfulGuardCount = 0;
  critter.damageSkillUseCountSinceSwitchIn = 0;
  critter.skillUseCountBySkillId = {};
  critter.firstActionableTurnNumber = 1;
}

function prepareSwitchInTracking(critter: DuelBattleCritterState, firstActionableTurnNumber: number): void {
  critter.flinch = null;
  critter.actedThisTurn = false;
  critter.damageSkillUseCountSinceSwitchIn = 0;
  critter.skillUseCountBySkillId = {};
  critter.firstActionableTurnNumber = Math.max(1, Math.floor(firstActionableTurnNumber));
}

function recordSkillUsage(
  critter: DuelBattleCritterState,
  skillId: string,
  isDamageSkill: boolean,
): void {
  const key = typeof skillId === 'string' ? skillId.trim() : '';
  if (!key) {
    return;
  }
  const priorRaw = critter.skillUseCountBySkillId[key];
  const prior = typeof priorRaw === 'number' && Number.isFinite(priorRaw)
    ? Math.max(0, Math.floor(priorRaw))
    : 0;
  critter.skillUseCountBySkillId[key] = prior + 1;
  if (!isDamageSkill) {
    return;
  }
  const priorDamage = Number.isFinite(critter.damageSkillUseCountSinceSwitchIn)
    ? Math.max(0, Math.floor(critter.damageSkillUseCountSinceSwitchIn))
    : 0;
  critter.damageSkillUseCountSinceSwitchIn = priorDamage + 1;
}

function getRequiredLeadCount(format: DuelBattleFormat): number {
  if (format === 'triples') return 3;
  if (format === 'doubles') return 2;
  return 1;
}

export { getRequiredLeadCount };

export interface ViableTargetSlot {
  side: DuelSideId;
  memberIndex: number;
}

export interface SkillTargetSelectionRange {
  min: number;
  max: number;
}

/**
 * Returns the list of board slots that are valid targets for a skill when used by the given actor.
 * Used for UI highlighting and validation.
 */
export function getViableTargetsForSkill(
  state: DuelBattleState,
  side: DuelSideId,
  actorMemberIndex: number,
  skillSlotIndex: number,
  context: ResolveContext,
): ViableTargetSlot[] {
  const sideState = getSide(state, side);
  const opponentState = getOpposingSide(state, side);
  const actor = sideState.team[actorMemberIndex];
  if (!actor || actor.fainted) {
    return [];
  }
  const skillId = actor.equippedSkillIds[skillSlotIndex];
  const skill = skillId ? context.indexes.skillById.get(skillId) : null;
  const resolvedSkill = skill ?? createFallbackSkill();
  const targetKindDamage = (resolvedSkill.targetKind ?? 'select_enemies') as SkillTargetKindDamage;
  const targetKindSupport = (resolvedSkill.targetKind ?? 'select_allies') as SkillTargetKindSupport;
  const targetSelectCount = resolvedSkill.targetSelectCount ?? 1;

  if (resolvedSkill.type === 'damage') {
    const aliveEnemies = getAliveActiveIndices(opponentState);
    if (targetKindDamage === 'target_all_enemies' || targetKindDamage === 'target_all') {
      return aliveEnemies.map((memberIndex) => ({ side: side === 'player' ? 'opponent' : 'player', memberIndex }));
    }
    return aliveEnemies.map((memberIndex) => ({ side: side === 'player' ? 'opponent' : 'player', memberIndex }));
  }

  const aliveAllies = getAliveActiveIndices(sideState);
  if (targetKindSupport === 'target_self') {
    return [{ side, memberIndex: actorMemberIndex }];
  }
  if (targetKindSupport === 'target_team') {
    const opt = resolvedSkill.targetTeamOption ?? 'user_only';
    if (opt === 'user_only') {
      return [{ side, memberIndex: actorMemberIndex }];
    }
    if (opt === 'partner_only') {
      return aliveAllies
        .filter((memberIndex) => memberIndex !== actorMemberIndex)
        .map((memberIndex) => ({ side, memberIndex }));
    }
    return aliveAllies.map((memberIndex) => ({ side, memberIndex }));
  }
  return aliveAllies.map((memberIndex) => ({ side, memberIndex }));
}

/** Returns the expected number of targets for a skill (for validation and UI). */
export function getSkillTargetCount(
  skill: SkillDefinition,
  format: DuelBattleFormat,
): number {
  return getSkillTargetSelectionRange(skill, format).max;
}

export function getSkillTargetSelectionRange(
  skill: SkillDefinition,
  format: DuelBattleFormat,
  viableTargetCount?: number,
): SkillTargetSelectionRange {
  let min = 0;
  let max = 0;
  if (skill.type === 'damage') {
    const kind = (skill.targetKind ?? 'select_enemies') as SkillTargetKindDamage;
    if (kind === 'target_all' || kind === 'target_all_enemies') {
      const required = getRequiredLeadCount(format);
      min = required;
      max = required;
    } else {
      min = 1;
      max = skill.targetSelectCount ?? 1;
    }
  } else {
    const kind = (skill.targetKind ?? 'select_allies') as SkillTargetKindSupport;
    if (kind === 'target_self') {
      min = 1;
      max = 1;
    } else if (kind === 'target_team') {
      const opt = skill.targetTeamOption ?? 'user_only';
      const required = getRequiredLeadCount(format);
      if (opt === 'user_only') {
        min = 1;
        max = 1;
      } else if (opt === 'partner_only') {
        min = Math.max(0, required - 1);
        max = Math.max(0, required - 1);
      } else {
        min = required;
        max = required;
      }
    } else {
      min = 1;
      max = skill.targetSelectCount ?? 1;
    }
  }
  const normalizedMax = Math.max(0, Math.floor(max));
  const normalizedMin = Math.max(0, Math.floor(min));
  if (typeof viableTargetCount === 'number' && Number.isFinite(viableTargetCount)) {
    const cappedMax = Math.max(0, Math.min(normalizedMax, Math.floor(viableTargetCount)));
    return {
      min: cappedMax <= 0 ? 0 : Math.min(normalizedMin, cappedMax),
      max: cappedMax,
    };
  }
  return { min: normalizedMin, max: normalizedMax };
}

function getSide(state: DuelBattleState, side: DuelSideId): DuelBattleSideState {
  return side === 'player' ? state.player : state.opponent;
}

function getOpposingSide(state: DuelBattleState, side: DuelSideId): DuelBattleSideState {
  return side === 'player' ? state.opponent : state.player;
}

function countAlive(team: DuelBattleCritterState[]): number {
  return team.reduce((count, entry) => count + (entry.fainted || entry.currentHp <= 0 ? 0 : 1), 0);
}

function createFallbackSkill(): SkillDefinition {
  return {
    skill_id: 'duel-tackle',
    skill_name: 'Tackle',
    element: 'normal',
    type: 'damage',
    priority: 1,
    damage: DEFAULT_DAMAGE,
  };
}

export function buildElementMultiplierIndex(chart: Array<{ attacker: string; defender: string; multiplier: number }>): Map<string, number> {
  const map = new Map<string, number>();
  chart.forEach((entry) => {
    const attacker = normalizeCatalogId(entry.attacker);
    const defender = normalizeCatalogId(entry.defender);
    if (!attacker || !defender) {
      return;
    }
    const multiplier =
      typeof entry.multiplier === 'number' && Number.isFinite(entry.multiplier)
        ? Math.max(0, Math.min(4, entry.multiplier))
        : 1;
    map.set(`${attacker}::${defender}`, multiplier);
  });
  return map;
}

function getElementMultiplier(index: Map<string, number>, attacker: string, defender: string): number {
  const key = `${normalizeCatalogId(attacker)}::${normalizeCatalogId(defender)}`;
  const multiplier = index.get(key);
  return typeof multiplier === 'number' && Number.isFinite(multiplier) ? multiplier : 1;
}

/** Battle stat modifier floor (RPG-aligned). Used when applying effect buffs/debuffs. */
function clampBattleModifier(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(MIN_BATTLE_STAT_MODIFIER, Math.min(MAX_STAT_MODIFIER, value));
}

function normalizeCatalogId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function pickRandomEntry<T>(values: T[], rng: () => number): T | null {
  if (values.length === 0) {
    return null;
  }
  const index = Math.max(0, Math.min(values.length - 1, Math.floor(rng() * values.length)));
  return values[index] ?? null;
}

function pickRandomDistinct(values: number[], count: number, rng: () => number): number[] {
  const pool = [...values];
  const picked: number[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.max(0, Math.min(pool.length - 1, Math.floor(rng() * pool.length)));
    const [value] = pool.splice(index, 1);
    if (typeof value === 'number') {
      picked.push(value);
    }
  }
  return picked;
}

function cloneAction(action: DuelAction): DuelAction {
  if (action.kind === 'skill') {
    return {
      kind: 'skill',
      actorMemberIndex: action.actorMemberIndex,
      skillSlotIndex: action.skillSlotIndex,
      targetMemberIndex: action.targetMemberIndex,
      ...(action.targetMemberIndices?.length
        ? { targetMemberIndices: [...action.targetMemberIndices] }
        : {}),
    };
  }
  if (action.kind === 'swap') {
    return {
      kind: 'swap',
      actorMemberIndex: action.actorMemberIndex,
      benchMemberIndex: action.benchMemberIndex,
    };
  }
  if (action.kind === 'guard') {
    return {
      kind: 'guard',
      actorMemberIndex: action.actorMemberIndex,
    };
  }
  return {
    kind: 'forfeit',
    actorMemberIndex: action.actorMemberIndex,
  };
}

function pushLog(state: DuelBattleState, entry: DuelLogEvent): void {
  state.logs = [...state.logs, entry];
}
