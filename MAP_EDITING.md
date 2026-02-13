# Map Editing Guide

Critterra maps are plain text arrays in:
- `src/game/data/maps/playerHouse.ts`
- `src/game/data/maps/starterTown.ts`
- `src/game/data/maps/rivalHouse.ts`

Each map row is a string. Every row must have the same length.

## Tile Legend
- `X` boundary wall (blocked)
- `G` grass (walkable)
- `T` tree (blocked)
- `P` path (walkable)
- `H` house wall (blocked)
- `Q` roof (blocked)
- `U` window (blocked)
- `D` door tile (blocked, used for interaction targets)
- `W` interior wall (blocked)
- `F` interior floor (walkable)
- `R` rug (walkable)
- `B` furniture (blocked)
- `C` decoration (blocked)

## How To Add A New Map
1. Create a file in `src/game/data/maps/`.
2. Use `createMap({...})` with `id`, `name`, and `tiles`.
3. Add `warps`, `npcs`, and `interactions` as needed.
4. Export it from `src/game/data/maps/index.ts` and add it to `WORLD_MAPS`.

## Warps (Building In/Out)
Warps connect maps using tile coordinates.

Example:
```ts
{
  id: 'town_to_house',
  from: { x: 4, y: 12 },
  toMapId: 'player-house',
  to: { x: 5, y: 8 },
  toFacing: 'up',
  requireInteract: true,
  requiredFacing: 'up',
  label: 'Enter House',
}
```

Notes:
- `from` is usually the door tile (`D`) the player is facing before warping.
- `requireInteract: true` means warp only happens on interact key.
- `requiredFacing` can enforce facing the door.

## NPCs and Interactions
- NPCs use `dialogueId` from `src/game/data/dialogues.ts`.
- `interactions` are map-specific inspect points (like locked doors).

## Region Building Workflow
1. Duplicate `starterTown.ts` into a new map file.
2. Block boundaries first with `X`.
3. Paint roads and landmarks with `P`, `H`, `T`.
4. Add warps between areas.
5. Add NPCs and interaction points.
6. Test movement and collisions.
