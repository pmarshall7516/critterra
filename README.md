# Critterra

Critterra is a browser-based creature RPG where you explore a growing region, build a squad, battle wild and story opponents, and shape your run through progression, gear, and item choices.

This repo contains the playable game client.

## Why Critterra Is Fun

Critterra blends cozy exploration with tactical turn-based battles. You are not just collecting critters, you are building a team over time through mission-driven unlocks, story beats, map progression, and resource choices.

From your starter pickup to rival duels, guard battles, fishing sessions, and route encounters, the game keeps feeding you small goals while letting you explore at your own pace.

## Core Player Experience

### 1. Explore a Connected Region

- Travel across interior and exterior maps connected by doors, paths, and warp links.
- Move through towns, houses, forest routes, coastlines, and service hubs.
- Interact with signs, points of interest, and story locations.
- Discover progression-gated routes that open as your story flags advance.

### 2. Start a Story Run

- Sign in, create or continue your run, and start adventuring immediately.
- Meet story characters and follow the early game arc through starter pickup and duels.
- Progress dialogue and NPC states based on what you have already completed.
- Restart your run from the title screen when you want a fresh save.

### 3. Choose and Raise Critters

- Pick a starter during a dedicated story selection sequence.
- Unlock critters through mission requirements.
- Level up through objective-based progression, including:
- Opposing knockout milestones
- Story flag milestones
- Ascension-related requirements
- Gain stats, unlock abilities, unlock skills, and expand equipment capacity as critters grow.

### 4. Build a Real Squad

- Assign unlocked critters into your active squad.
- Expand toward a larger roster over progression (up to 8 squad slots).
- Swap lineup choices based on battle goals and route risk.
- Manage squad health between fights, not just during them.

### 5. Use Collection + Backpack Systems

- Open an in-game side menu for squad, collection, and backpack management.
- Track locked and unlocked critters, mission progress, levels, and skill loadouts.
- Set a specific locked critter as a knockout mission target tracker.
- Use healing items, tools, and equipment from your backpack with proper usage rules.
- Equip and unequip gear with slot-size constraints (including contiguous-slot requirements).

### 6. Battle with Turn-Based Strategy

- Trigger wild battles from encounter zones and challenge story/NPC opponents.
- Choose your lead critter at battle start.
- Take turns with:
- Attack (skill selection)
- Guard
- Swap
- Retreat (wild encounters only)
- Resolve fights with speed order, elemental multipliers, guard success/failure, crits, buffs, and status effects.
- Carry post-battle HP and consequences back into overworld play.

### 7. Encounter + Resource Loops

- Walk into encounter zones to trigger wild battles.
- Fish on valid water tiles using fishing tools:
- Cast line
- Wait for bite timing
- Reel in at the right window
- Catch either critter encounters or item rewards from encounter tables.
- Earn rewards through NPC battles and interactions.
- Spend item costs in shop menus to buy useful entries (including one-time and repeatable behaviors).

### 8. Heal, Recover, and Keep Going

- Use healing interactions to restore your squad.
- Update your effective respawn point through healing services.
- If your squad fully faints, blackout recovery returns you to your healing point.
- Resume exploration with healed critters after recovery.

## What Is Currently in the World

The current game data includes:

- 14 connected maps
- 17 warp links
- Multiple walk encounter zones
- Fishing-enabled areas
- Heal interaction tiles
- Story NPC state transitions and battle gates

## Player Controls

- Move: `WASD` / Arrow Keys
- Interact / Advance dialogue: `Space`
- Open/Close side menu: `Esc` / `E`
- Fishing hotkey: `F`
- Fullscreen toggle: `Y`

## Saves and Progress

- Autosave runs while you play.
- Manual save is available in the side menu.
- Save data persists locally in browser storage.
- Authenticated sessions hydrate and sync save/content with backend endpoints.
- Story flags, squad state, collection progress, inventory, and map position persist across sessions.

## Run Locally

```bash
npm install
npm run dev
```

## Main Game Code Areas

- `src/game/engine/runtime.ts` - movement, interactions, encounters, battle flow, progression, save updates
- `src/game/engine/GameView.tsx` - gameplay UI, overlays, menu views, battle presentation
- `src/game/data/maps/` - map layouts, warps, interactions, encounter groups
- `src/game/world/npcCatalog.ts` - story NPC templates and state-driven placement/behavior
- `src/game/saves/saveManager.ts` - local + remote save lifecycle
- `src/game/content/worldContentStore.ts` - server-hydrated gameplay content (maps, critters, items, shops, skills)
