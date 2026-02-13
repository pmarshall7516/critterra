# Critterra - Development Plan

## 1. Project Goal
Build a 2.5D creature-capture RPG inspired by Pokemon, implemented as a React app, with features developed in AI-assisted batches.

The first playable slice should include:
- 3 starter creatures (one per type): `Flame`, `Mist`, `Bloom`
- A start/title page with a `Start Game` action
- Player spawns inside their house with their brother NPC
- Brother dialogue directs player to visit a friend's house for a partner Critter
- Player can exit the house into a small enclosed town
- Player can move around town but cannot enter other houses yet

## 2. Core Product Pillars
- Accessible first playable loop in-browser
- Clear modular architecture so AI can safely build feature-by-feature
- Deterministic data models for creatures, NPCs, maps, and saves
- Incremental content expansion without rewriting core systems

## 3. Recommended Tech Stack (React-first)
- Frontend: React + TypeScript + Vite
- 2.5D rendering: Phaser 3 (with React host), OR PixiJS + custom systems
- Movement/collision/map data: Tiled map format (JSON)
- State: Zustand (game/session state) + lightweight finite state conventions
- Routing/UI flow: React Router (title/menu vs in-game screens)
- Local persistence: IndexedDB (Dexie) for saves/settings
- Testing:
  - Unit: Vitest
  - Component: React Testing Library
  - Optional e2e: Playwright

Note: If you prefer pure React rendering first, keep rendering simple (DOM/canvas hybrid), then upgrade world rendering to Phaser once core loops are stable.

## 4. High-Level Architecture
Use a modular folder structure from day one:

```txt
src/
  app/
    routes/
    providers/
  game/
    engine/           # scene manager, tick/update loop adapter
    world/            # maps, collisions, warps, spawn points
    player/           # movement, facing, interaction checks
    npc/              # npc definitions, dialogue, interaction scripts
    creatures/        # species definitions, typing, starter logic
    quests/           # progression flags, objective states
    saves/            # serialization + db adapters
  ui/
    screens/          # title, pause, dialogue overlays
    components/
  data/
    creatures/
    maps/
    npcs/
  shared/
    types/
    constants/
```

## 5. Milestone Roadmap

### Milestone 0 - Project Foundation
- Initialize React + TypeScript project
- Set up linting/formatting and absolute import paths
- Choose rendering path (Phaser recommended)
- Add global game state store and scene routing shell

Definition of done:
- App boots with a placeholder Title screen and empty Game scene
- Build/test scripts run successfully

### Milestone 1 - First Playable Vertical Slice (your current target)
- Implement title screen (`Critterra`) and Start action
- Build interior house map with player spawn
- Add brother NPC + interaction dialogue
- Add house exit transition to enclosed town map
- Add town movement boundaries and blocked house entrances
- Add starter creature data for Flame/Mist/Bloom (data-only is enough here)

Definition of done:
- End-to-end flow works from title -> house -> talk to brother -> exit -> explore town
- Player cannot enter non-target houses

### Milestone 2 - Starter Selection and Ownership
- Add friend house interaction/trigger
- Create starter selection UI with 3 choices
- Persist chosen starter in local save
- Add a minimal party model (1 active creature)

Definition of done:
- New save can choose one starter and reload with same starter

### Milestone 3 - Core RPG Systems
- Creature stats schema (HP, attack, defense, speed, level, exp)
- Type effectiveness matrix for Flame/Mist/Bloom
- Basic battle prototype (single wild encounter)
- Capture flow prototype (simple success formula)

Definition of done:
- One complete battle and capture cycle functions locally

### Milestone 4 - Town Content Expansion
- Add interactable buildings and NPC schedules
- Add quest flags and event gating
- Improve map art, collision polish, and transitions

Definition of done:
- Town feels like a coherent mini hub with progression beats

### Milestone 5 - Save Systems and UX Polish
- Multi-slot saves and settings
- Better dialogue UI, menus, and accessibility options
- Audio pass and performance pass

Definition of done:
- Stable local save/load and smooth basic UX

## 6. Feature Plans (AI Batch Prompts)
Use these as separate prompts stacked on top of your base context.

---

### Feature Plan A - UI Shell + Start Page
Goal:
- Build title/start experience and transition into gameplay.

Scope:
- Title screen with game name `Critterra`
- `Start Game` button
- Route/scene transition into first map
- Minimal HUD shell (optional placeholder)

Inputs AI should rely on:
- Route names and global state conventions
- Screen size/responsive behavior

Acceptance criteria:
- Title appears on launch
- Start button consistently enters game scene
- No console errors

Prompt snippet:
```txt
Implement Feature Plan A from plan.md. Create a title screen for Critterra with a Start Game button. On click, transition to the main game scene. Keep code modular and typed, and include any route/store wiring needed.
```

---

### Feature Plan B - Starting House + Brother NPC
Goal:
- Deliver first narrative interaction.

Scope:
- House interior map and spawn point
- Brother NPC placement
- Interaction trigger when facing and pressing interact key
- Dialogue line: player should leave and visit friend for partner Critter

Acceptance criteria:
- Player spawns inside house
- Interaction only triggers near brother and facing appropriately
- Dialogue can open and close reliably

Prompt snippet:
```txt
Implement Feature Plan B from plan.md. Add a house interior spawn scene with a brother NPC. Add interact logic and dialogue telling the player to visit a friend's house to get their partner Critter.
```

---

### Feature Plan C - Town Map + Movement Boundaries
Goal:
- Create an explorable starter town with clear constraints.

Scope:
- Exit warp from house interior to town map
- Enclosed town collision boundaries
- Other house doors are non-enterable for now
- Smooth spawn placement when entering town

Acceptance criteria:
- Player can leave house into town
- Player can walk around town within boundaries
- Other houses cannot be entered

Prompt snippet:
```txt
Implement Feature Plan C from plan.md. Add a town map connected to the starting house. Keep town enclosed with collision boundaries, and block entering all other houses.
```

---

### Feature Plan D - Starter Creatures Data (Flame/Mist/Bloom)
Goal:
- Establish foundational creature data model.

Scope:
- Define creature schema: id, name, type, baseStats, moves (placeholder)
- Add 3 starter creatures:
  - Flame type starter
  - Mist type starter
  - Bloom type starter
- Add type enum and effectiveness table scaffolding

Acceptance criteria:
- Creatures are typed and loadable from a central data source
- Data can be consumed by UI or battle modules later

Prompt snippet:
```txt
Implement Feature Plan D from plan.md. Create typed creature models and seed three starter creatures with types Flame, Mist, and Bloom. Include a basic type/effectiveness scaffold for future battle logic.
```

---

### Feature Plan E - NPC System Foundation
Goal:
- Support reusable NPC interactions beyond brother.

Scope:
- Generic NPC definition format (id, position, sprite, dialogueId, interactionRules)
- Dialogue registry keyed by ids
- Interaction state hooks (once, repeatable, quest-gated)

Acceptance criteria:
- Brother uses shared NPC system (not hardcoded special case)
- Easy to add new NPC entries without engine rewrites

Prompt snippet:
```txt
Implement Feature Plan E from plan.md. Generalize NPC handling so brother uses a reusable NPC + dialogue system with typed definitions and interaction rules.
```

---

### Feature Plan F - Local Database + Save State
Goal:
- Persist progress and starter choices locally.

Scope:
- Dexie/IndexedDB setup
- Save schema: player position, current map, dialogue flags, selected starter, timestamp
- Auto-save on key transitions (map change, starter selection)
- Load-from-save on game start when save exists

Acceptance criteria:
- Save persists across reloads
- Save versioning field exists for migrations

Prompt snippet:
```txt
Implement Feature Plan F from plan.md. Add IndexedDB persistence for game saves including map, player position, progression flags, and selected starter. Load existing save on start and autosave on map transitions.
```

## 7. Data Contracts (v1)

### Creature type
```ts
type ElementType = 'Flame' | 'Mist' | 'Bloom';

type CreatureSpecies = {
  id: string;
  name: string;
  type: ElementType;
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  };
  moves: string[];
};
```

### Save profile
```ts
type SaveProfile = {
  id: string;
  version: number;
  currentMapId: string;
  player: {
    x: number;
    y: number;
    facing: 'up' | 'down' | 'left' | 'right';
  };
  selectedStarterId: string | null;
  flags: Record<string, boolean>;
  updatedAt: string;
};
```

## 8. Initial Content Backlog
- Name and design the three starter species (final names/art)
- Add friend house and partner selection event
- Add first route outside town
- Add first wild encounter zone
- Add one simple quest chain and reward

## 9. Implementation Order (Recommended)
1. Milestone 0 setup
2. Feature A (UI shell)
3. Feature B (house + brother)
4. Feature C (town + bounds)
5. Feature D (starter data)
6. Feature F (save db)
7. Feature E (generalize NPCs if not already done)

Reasoning:
- This order gets a visible playable loop early, then secures data and persistence before scaling content.

## 10. Base Prompt You Can Reuse With AI
```txt
You are helping implement Critterra, a React + TypeScript 2.5D creature-capture RPG. Follow plan.md as source of truth. Keep architecture modular and typed. Do not break existing systems. Prefer small composable modules and explicit data contracts. Add tests for pure logic where practical. For map/NPC features, use data-driven configs rather than hardcoded behavior.
```

## 11. Quality Gates for Every Feature Batch
- Builds without errors
- No new TypeScript type regressions
- Existing player flow still works
- New feature has clear acceptance checks
- Data models are documented and reusable

## 12. Risks and Mitigations
- Risk: Premature complexity in rendering stack
  - Mitigation: Lock one rendering approach early and defer fancy effects
- Risk: Hardcoded scripts that block scaling
  - Mitigation: Keep NPC/map/creature content data-driven
- Risk: Save format drift during rapid AI iteration
  - Mitigation: Add save `version` now and migrate intentionally

## 13. Next Immediate Build Target
Implement Milestone 1 completely before expanding scope:
- Title screen
- House spawn
- Brother dialogue
- Town exit/entry
- Enclosed movement
- Blocked other house entries
- 3 starter creature data models (`Flame`, `Mist`, `Bloom`)
