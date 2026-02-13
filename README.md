# Critterra

React + TypeScript creature-capture RPG prototype with a data-driven map system.

## Current Playable State
- Title screen with Start/Continue
- Controls icon on title screen
- Fresh save requires player name
- Player movement (Arrow keys / WASD)
- NPC interaction and dialogue (Space)
- Indoor and outdoor maps with building transitions
- Town boundaries and locked house interactions
- `Esc` side menu with manual save/resume/title return
- Local autosave/load via browser storage
- Starter creature data for Flame/Mist/Bloom
- Smooth movement with interpolated tile stepping
- Colored tile-based world rendering
- Colored player/NPC actors
- Brother NPC idle turning animation

## Run
```bash
npm install
npm run dev
```

## Main Files
- `src/game/engine/runtime.ts`: movement, collision, interaction, warps, render loop
- `src/game/data/maps/`: map content
- `src/game/data/dialogues.ts`: dialogue scripts
- `src/game/data/creatures.ts`: starter creature/type data
- `src/game/saves/saveManager.ts`: save/load persistence

## Controls
- Move: Arrow Keys / WASD
- Interact / advance dialogue: Space
- Side menu: Esc

## Map Authoring
See `MAP_EDITING.md` for the tile legend and map workflow.
