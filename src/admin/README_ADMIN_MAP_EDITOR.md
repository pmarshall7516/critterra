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

- Admin tabs are intended to scroll as a single page container.
- Avoid nested form/list scrollers to keep long editing sessions linear.
- The map canvas may still scroll internally for large maps.

## Tileset source (database and Supabase)

- The **tileset image URL** is stored in `game_tiles` (fields: `tileset_url`, `tile_pixel_width`, `tile_pixel_height`). Run `node scripts/backfill-game-tiles-tileset.mjs` to set them for rows that have NULL.
- **Admin** loads it when you open Tiles or Maps and click "Load Saved Tiles" (or on first load): it comes from `GET /api/admin/tiles/list`.
- **Game runtime** gets it from `GET /api/content/bootstrap` (after login); that content is stored in localStorage and used to draw tiles. So the game reads from whatever URL is in the database.
- To use **your Supabase tileset image**:
  1. In admin go to **Tiles**, under "Supabase Tilesets" set bucket (e.g. `tilesets`), click "Reload Bucket", click your image so its public URL is applied, then **Save Tile Library**. That writes the Supabase URL into `game_tiles` (updates all tiles without a tileset_url).
  2. Or seed the DB on first run: set env `CRITTERRA_DEFAULT_TILESET_URL` to your image’s full public URL (e.g. `https://<project>.supabase.co/storage/v1/object/public/tilesets/your.png`), and optionally `CRITTERRA_DEFAULT_TILESET_TILE_WIDTH` / `CRITTERRA_DEFAULT_TILESET_TILE_HEIGHT` (default 16). New databases will backfill `game_tiles` with this tileset.
- Saving a map from admin with a tileset URL set also writes that URL into `src/game/world/customTiles.ts` as `CUSTOM_TILESET_CONFIG`, which the game uses as a fallback when no bootstrap content is present.

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
