# Duel Simulator Battle Core Adapter Contract

This module (`src/duel/battleCore.ts`) is designed to be reusable outside the Duel Simulator UI.

## Input Contract

- `createDuelBattleController(input, options?)` accepts:
- `format`: `'singles' | 'doubles'`
- `playerSquad` / `opponentSquad`: sanitized duel squads with level/skills/equipment already validated
- `catalogs`: critter, skill, item, skill effect, equipment effect, and element chart catalogs
- `playerLabel` / `opponentLabel`: display labels
- `options.rng`: optional deterministic RNG callback for tests/replays

## Controller Contract

- The controller mutates an internal `state` object and exposes:
- `submitLeadSelection`
- `submitActions`
- `submitReplacementSelection`
- `listLegalActionsForActor`
- `chooseRandomLeadSelection`
- `chooseRandomActions`
- `chooseRandomReplacements`

## Story Runtime Migration Path

- Keep story-battle domain state as source of truth for story-specific systems (flags, rewards, mission hooks).
- Build a thin adapter that maps story combatants to `DuelSquad` + catalogs, then forwards actions into `battleCore`.
- Consume `state.logs` and phase transitions to drive current story narration UI.
- Preserve existing story side effects by handling them in adapter callbacks after each resolved turn/result.

This keeps migration incremental: battle order/action resolution can move first, while progression/reward logic remains in story runtime until later phases.
