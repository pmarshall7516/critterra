# Admin Map Editor

The admin tools now run as a **separate app** in this repo.

- Game app: `/`
- Admin app: `/admin.html`

## Current Scope

The first module is **Map Editor** and supports:
- Loading existing maps from `WORLD_MAPS`.
- Creating blank maps with width/height/fill tile.
- Painting tiles (paint, erase, fill, eyedropper).
- Configuring warps with click placement + edge helper presets.
- Editing NPCs and interactions via JSON blocks.
- Exporting map data to JSON and TypeScript `createMap(...)` snippet.
- Importing map JSON back into the editor.
- Saving directly into project source files from the admin UI (`Save Map File + Tile IDs`).

## Tileset + Paint Tile Workflow

- Editor starts blank (no map, no tileset, no saved paint tiles loaded into memory).
- Tileset grid is derived from user-defined tile pixel width/height.
- Atlas selection supports click-drag rectangle selection across adjacent cells.
- Two workflows exist:
  1. **Auto mode**: generate one saved paint tile per game tile code (`X/G/T/...`).
  2. **Manual mode**: choose atlas rectangle + custom name, then save it as a multi-cell stamp.
- Saved paint tiles can be:
  - selected for painting,
  - renamed,
  - removed (per-row remove or remove currently selected tile).
- Saved paint tiles persist to IndexedDB and can be loaded with `Load Saved Tiles`.

## Scrolling

- Admin app shell and editor columns are scrollable.
- Tileset atlas grid, saved paint list, and map canvas each scroll independently.

## Integration Notes

- Editor uses your existing `WorldMapInput` schema and tile codes from `TILE_DEFINITIONS`.
- Multi-cell saved stamps generate unique single-character codes per selected atlas cell.
- The save endpoint writes:
  - map file (`src/game/data/maps/*.ts`),
  - map index registry (`src/game/data/maps/index.ts`),
  - custom tile definitions (`src/game/world/customTiles.ts`).
- Existing loaded maps save back to their original file; new maps are saved as new files based on current map id.

## Future Expansion

`AdminView` already includes module placeholders (`Critters`, `Encounters`) so new admin modules can be added without restructuring the app shell.
