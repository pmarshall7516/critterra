Original prompt: Build a classic pokemon first town demo based on this current repo using the Develop Web Game skill

## 2026-02-11
- Initialized progress tracking for this turn.
- Confirmed `develop-web-game` skill instructions and local Playwright client/action payload paths.
- Context gathered: runtime movement/dialogue/warp system, current maps, tile legend, and UI flow.

### TODO
- Rebuild first-town map content and add a lab interior map.
- Expand dialogue scripts to feel like a classic first-town intro.
- Add `window.render_game_to_text` and deterministic `window.advanceTime(ms)` in the game view.
- Add fullscreen toggle (`f`) and keep existing controls stable.
- Run Playwright client, inspect screenshots + state JSON + console errors, and iterate.
- Rebuilt map content for a more classic first-town flow:
  - Updated `player-house` layout and swapped intro NPC to Mom.
  - Reworked `starter-town` as Willowbrook Town with signs, locked houses, NPCs, and lab entrance.
  - Added new `rowan-lab` map with professor/rival NPCs and interaction points.
- Updated map registry and dialogue scripts to support the new town arc.
- Added runtime/UI support for the develop-web-game test loop:
  - `RuntimeSnapshot` now includes a live objective.
  - Implemented `runtime.renderGameToText()` with map/player/dialogue/NPC/interaction state.
  - Added deterministic stepping support via `window.advanceTime(ms)` in `GameView`.
  - Added global `window.render_game_to_text` bridge in `GameView`.
  - Added fullscreen toggle on `f` with `Esc` fullscreen exit handling.
- Updated controls modal and HUD objective banner for clearer gameplay guidance.
- Enabled automation-friendly startup by pre-filling the trainer name with `Player` on the New Game screen.
- First Playwright run exposed a runtime crash: `rowan-lab` had one row with width 17 instead of 18.
- Fixed malformed row in `src/game/data/maps/rowanLab.ts`.
- Installed `playwright` and Chromium browser for automated validation runs.
- Verified automated startup into gameplay works and `state-0.json` is produced with `render_game_to_text` output.
- Verified objective progression updates after Mom dialogue (`flags: ["talked_to_mom"]`).

### Remaining TODOs / Next Agent Suggestions
- Improve Playwright action choreography to reliably traverse house -> town -> lab in a single automated run.
- Add dedicated tests or scripted scenarios for:
  - Door warp from `player-house` to `starter-town`.
  - Lab warp + professor dialogue + starter table flag progression.
  - Objective transitions through all early-game states.

## 2026-02-12
- Refreshed intro narrative on request:
  - Home NPC changed from Mom to Brother (`Eli`).
  - `rowan-lab` replaced with `rival-house` (`Kira House`) as the starter location.
  - Starter-giver changed from professor to rival parent (`Aunt Mara`).
- Updated warps/interactions/dialogue/objective text and flags to match the new story arc.
- Renamed map file to `src/game/data/maps/rivalHouse.ts` and updated map registry + map docs.
- Validation:
  - `npm run build` passed.
  - Playwright run captured screenshot + `state-0.json` confirming `Eli` dialogue and updated objective text.

## 2026-02-12 (Admin Tool)
- Original prompt continuation: build an admin tool with a map editor module for creating/editing maps, including warp setup and tileset-driven design.
- Scanned current app architecture and discovered local `example_assets` packs (tileset/sprites/UI) to wire into editor UX.
- Implemented admin shell with module navigation (`Map Editor`, placeholder modules for future tools).
- Added full `MapEditorTool` with:
  - Existing map load + blank map creation + map resize.
  - Tile painting tools (paint/erase/fill/eyedropper) with zoom.
  - Tileset URL/file loading and per-tile atlas index mapping.
  - Warp CRUD with click-placement (`from`/`to`) and edge helper placement.
  - NPC and interaction JSON editing.
  - Export to JSON and TypeScript (`createMap(...)`) plus import from JSON.
  - Basic map validation warnings (bounds and unknown warp target IDs).
- Added admin entrypoint from title screen via `Admin Tools` button.
- Added admin-specific documentation at `src/admin/README_ADMIN_MAP_EDITOR.md`.
- Validation:
  - `npm run build` passed.
  - Playwright visual sanity checks rendered Admin Map Editor screen with no emitted error logs.
- Refactored admin tools to a separate app entrypoint in the same repo:
  - Added `admin.html` + `src/admin/main.tsx` + `src/admin/AdminApp.tsx`.
  - Updated Vite multi-page build inputs for game + admin outputs.
  - Game title now links to `/admin.html` instead of embedding admin in game state.
- Updated admin UI shell for scrollability:
  - Full-height admin screen with independent scrolling regions.
  - Scrollable module content, left/right editor columns, tileset grid, saved paint list, and map canvas.
- Implemented advanced tileset workflow in Map Editor:
  - Default tileset loads and renders as a grid based on user-defined tile width/height.
  - Manual selection of atlas cells from grid.
  - Auto mode to generate default paint tiles.
  - Manual mode to save selected atlas cells into paint tools with custom name + tile code.
  - Saved paint tile management (rename/reassign/remove + remove selected button).
- Updated admin docs to reflect separate app + new tileset/palette workflow.
- Validation:
  - `npm run build` passed with both `dist/index.html` and `dist/admin.html` outputs.
  - Playwright checks against `/admin.html` rendered the standalone admin app with no emitted console error artifacts.
- Updated manual tileset-picker save flow so tile codes are always auto-generated from an available single-character pool and stored on each saved paint tile entry (`SavedPaintTile.code`).
- Code generation now avoids collisions with existing saved paint tile codes and codes already used on the active map, enabling tile IDs beyond the built-in base set.
- Added map warning for custom tile codes not present in `src/game/world/tiles.ts`, so exported maps using generated codes flag required runtime tile-definition follow-up.
- Expanded admin map tile picker to support rectangle selection via click-drag on the atlas grid.
- Saved paint tiles now support multi-cell stamp definitions (`width`, `height`, `cells[]`) instead of only single atlas indices.
- Painting now applies full stamp footprints to the map canvas (all cell offsets in the saved tile), enabling multi-tile structures (e.g., building chunks).
- Admin startup now initializes blank by default:
  - no map loaded,
  - no tileset loaded,
  - empty tile pixel width/height fields,
  - empty JSON editors,
  - no in-memory saved paint tiles.
- Added explicit `Load Saved Tiles` action and IndexedDB persistence for saved paint tiles in `src/admin/indexedDbStore.ts`.
- New/updated/removed saved paint tiles now persist to IndexedDB for future sessions.
- Added migration-compatible tile sanitization so older single-cell saved tile shapes can still be loaded and normalized.
- Updated paint tile and saved tile UI previews to render multi-cell stamps and show stamp dimensions.
- Added map-canvas empty state when no map is loaded.
- Validation:
  - `npm run build` passed after refactor.
  - Playwright screenshot check on `/admin.html` confirms blank-start admin state and no emitted console-error artifacts (`output/admin-map-editor/shot-0.png`).
  - Additional Playwright run confirmed rectangle save metadata as multi-cell (`11x1 | 11 codes`).
- Added direct map file saving from admin via new local API endpoint: `POST /api/admin/maps/save` (Vite plugin middleware in `vite.config.ts`).
- Map save behavior:
  - If editing a loaded existing map, save writes back to that map's original file.
  - If creating/importing a new map, save creates/updates `src/game/data/maps/<derivedFileName>.ts` using existing map format (`createMap({...})` export).
  - Regenerates `src/game/data/maps/index.ts` imports and `WORLD_MAPS` registry order.
- Added bottom panel in Map Editor: `Save To Project` with `Save Map File + Tile IDs` action.
- Added custom tile runtime sync on save:
  - Save operation now writes `src/game/world/customTiles.ts` from saved paint tile cell metadata + map tile usage.
  - Introduced runtime merge of base + custom tile definitions in `src/game/world/tiles.ts`.
  - Runtime now optionally renders custom tiles from a configured tileset atlas (`CUSTOM_TILESET_CONFIG`) and falls back to color rendering if unavailable.
- Relaxed tile code typing to support custom single-character IDs across world types/runtime path.
- Build validation: `npm run build` passed.
- Playwright visual sanity check on `/admin.html` confirms new bottom save panel is visible (`output/admin-map-save/shot-0.png`).
- Added right-click blank-paint behavior in map canvas editing:
  - Right mouse click on a map cell now writes blank tile code `.`.
  - Context menu is suppressed for map-cell right-clicks.
- Added multi-cell stamp hover preview shadow:
  - When selected paint tile is larger than 1x1, hovering map cells shows an opaque placement shadow for all affected cells.
- Added base blank tile definition in runtime tile registry (`BLANK_TILE_CODE = '.'`) and renderer/physics handling:
  - Blank tiles are not rendered in runtime draw pass.
  - Blank tiles are non-walkable.
- Updated save pipeline base tile-code set to treat `.` as built-in (not custom-generated).
- Validation: `npm run build` passed.
- Implemented layered map editing + rotated painting in admin map editor.
- Added new paint tool `Paint Rotated`:
  - randomly rotates placed tiles by 0/90/180/270 degrees,
  - supports multi-cell stamp tiles,
  - preserves right-click blank erase behavior.
- Refactored admin editable map model from single `tiles[]` to `layers[]` with per-layer:
  - `tiles` rows,
  - `rotations` rows (0-3),
  - `visible` and `collision` flags,
  - layer id/name metadata.
- Added layer management UI in Active Map panel:
  - select active layer,
  - add/remove layers,
  - rename layer id/name,
  - toggle visibility + collision.
- Updated map canvas rendering in admin to draw stacked visible layers and highlight active layer content.
- Updated editor JSON/TS export and import to support `layers` while preserving legacy single-layer `tiles` output when possible.
- Updated save API (`vite.config.ts`) to validate and persist layered maps:
  - accepts `map.layers` payload,
  - writes `layers` to map files when needed,
  - writes legacy `tiles` format for simple base-only maps,
  - scans tile codes across all layers for custom tile sync.
- Updated runtime map drawing + collision handling for layers/rotations:
  - renders all visible layers in order,
  - applies per-cell quarter-turn atlas rotation during draw,
  - collision checks only layers marked `collision`.
- CSS updates for stacked tile rendering and active layer emphasis in map cells.

Validation
- `npm run build` passes after layer/rotation refactor.
- Playwright sanity screenshot confirms admin loads with new `Paint Rotated` control.
- Gameplay runtime screenshot sanity captured; no build/runtime crash observed.

Follow-up suggestions
- Add explicit rotation visualization in paint-tile palette (tiny rotation badge) when using `Paint Rotated` hover.
- Add dedicated Playwright action scripts for full admin flows (load map, add layer, paint, save, reload).
- Add map migration helper command to convert legacy `tiles` maps into a two-layer starter format automatically.
- Addressed custom tile warning noise in editor:
  - map validation now treats tile codes present in saved paint tiles as known custom codes,
  - warning text now points to `Save Map File + Tile IDs` for runtime sync.
- Updated manual atlas save flow to immediately persist the new saved tile list (including generated codes) to IndexedDB in one explicit update path.
- Build validation: `npm run build` passed.
- Added per-cell edge collision editing and runtime support.
- World map schema updates:
  - `WorldMapLayerInput.collisionEdges?: string[]`
  - `WorldMapLayer.collisionEdges: number[][]`
- Map parser (`createMap`) now reads hex edge masks (`0-f`) per cell with defaults to `0`.
- Admin editor data model now tracks `collisionEdges` per layer.
- Admin map editor new paint tool: `Collision Edges`:
  - edge side toggles (`Top`, `Right`, `Bottom`, `Left`),
  - add/remove mode,
  - drag-paint support,
  - right-click clears collision edges on hovered cell for active layer,
  - visible edge overlay on map cells.
- Runtime movement now respects edge collisions:
  - blocks movement if source tile has blocking edge in move direction,
  - blocks movement if target tile has opposite-side blocking edge.
- Save/load pipeline updates:
  - map import/export JSON/TS includes `collisionEdges` when non-zero,
  - Vite save middleware validates and persists `collisionEdges` for layer maps.
- Style updates for collision edge overlays in editor canvas.
- Validation: `npm run build` passed after collision-edge integration.
- Addressed reported in-game vertical line artifacts by stabilizing camera-to-screen tile placement math in runtime render:
  - use rounded camera pixel offsets once per frame,
  - derive tile screen positions from integer tile pixel positions minus camera pixel offset.
- Added map-canvas axes in admin editor for coordinate debugging:
  - X-axis labels across top (0-based),
  - Y-axis labels down left (0-based),
  - top-left corner marker `Y\\X`.
- Validation:
  - `npm run build` passed after runtime and editor axis changes.
- Implemented NPC sprite + movement support across editor/runtime.
- World NPC schema now supports optional:
  - inline dialogue (`dialogueLines`, `dialogueSpeaker`, `dialogueSetFlag`),
  - movement (`type: static|loop|random`, `pattern`, `stepIntervalMs`),
  - sprite config (`url`, frame size, per-direction facing frames, optional walking frame sequences).
- Runtime NPC updates:
  - NPCs now use runtime state for position/facing/movement and can wander (`random`) or follow loop patterns.
  - Added sprite-sheet rendering for NPCs with directional idle/walk animation; falls back to block actor draw if sprite missing/unloaded.
  - Player collision now checks live NPC runtime positions.
  - Interact checks now target runtime NPC positions.
- Admin map editor updates for NPC workflow:
  - Added paint tools: `NPC Paint`, `NPC Erase`.
  - Added NPC template builder panel with fields for name/color/dialogue/movement.
  - Added NPC spritesheet loader (URL/file), frame grid preview, and assignment workflow for up/down/left/right idle + optional walk frames.
  - Saved NPC templates now persist via IndexedDB (`map-editor-npc-templates-v1`) and can be reloaded.
  - Painting places template-derived NPC instances on map cells; erasing removes NPC at cell.
  - Map canvas now overlays an NPC badge per occupied NPC cell for quick visual placement feedback.
- Validation:
  - `npm run build` passed.
  - Playwright admin sanity screenshot captured after changes (`output/admin-npc-painter/shot-0.png`).

Follow-up suggestions
- Add direct NPC list table editor (click NPC badge to edit/delete selected NPC instance) to avoid JSON edits for per-instance tweaks.
- Add patrol bounds mode (rectangle) for random movement so NPCs stay in local zones.
- Add optional sprite preview in NPC template list cards.
- Refactored NPC authoring model in admin to support reusable `sprite library` + `character library` split:
  - Character entries now store name/dialogue/movement/(future) battle team ids and reference a sprite by id.
  - Sprite entries store sheet URL, frame size, and directional idle/walk frame assignments.
- Added default NPC catalog in `src/game/world/npcCatalog.ts`:
  - default sprite `teen-boy` uses 4x4 row mapping at 32x32 (`Down`, `Left`, `Right`, `Up`).
  - default character `Eli` references `teen-boy`.
- Updated map NPC paint flow:
  - NPC paint now places selected character template and resolves reusable sprite by `spriteId`.
  - NPC erase unchanged (removes instance at clicked cell).
- Added user-requested 4x4 animation helper:
  - `Auto Fill 4x4 D/L/R/U` button for sprite frame assignments.
  - manual frame assignment by clicking sheet cells per selected direction + idle/walk mode remains.
- Added future-facing NPC data support in world types:
  - `battleTeamIds?: string[]` on `NpcDefinition`.
- Runtime updates:
  - player now renders from dedicated sprite config (`src/game/world/playerSprite.ts`) with idle/walk animation support.
  - fallback to old block actor draw remains if sprite image cannot load.
- Added standalone Player Sprite admin module:
  - new nav tab between Map Editor and Critters.
  - full sheet loader + frame assignment + 4x4 preset for player sprite.
  - save action writes directly to `src/game/world/playerSprite.ts` via new API route.
- Added new admin API endpoint in Vite plugin:
  - `POST /api/admin/player-sprite/save`.
- Map update:
  - seeded Eli (`playerHouse`) with explicit teen-boy sprite config to match new desired default behavior.
- Validation:
  - `npm run build` passed.
  - Admin screenshots captured for map editor + player sprite tab:
    - `output/admin-npc-character-split/shot-0.png`
    - `output/admin-player-sprite-tab/shot-0.png`

Follow-up suggestions
- Add in-UI “Edit Existing” for sprite/character library items (currently flow is save new + remove old).
- Add project-file persistence for NPC sprite/character catalogs (currently IndexedDB + defaults; map files retain resolved sprite config on placed NPCs).
- Add visual row labels directly over sprite grid (`Row 0: Down`, etc.) for faster onboarding.
## 2026-02-12 (White page fix)
- Investigated reported white screen by running Playwright checks on game and admin routes.
- Root cause: map parse crash on unknown tile code during startup:
  - `Error: Map player-house layer base uses unknown tile code: `
- Cause details:
  - `src/game/data/maps/playerHouse.ts` referenced custom tile IDs not currently present in `src/game/world/customTiles.ts`.
  - `createMap` previously threw on first unknown tile code, causing app boot failure (white page).
- Fix implemented:
  - Updated `src/game/world/mapBuilder.ts` to fail-soft on unknown tile codes:
    - unknown tile codes are replaced with `FALLBACK_TILE_CODE` at parse time,
    - warning is logged with the missing code list.
  - This prevents complete app crash/white screen while preserving map loadability.
- Validation:
  - `npm run build` passed.
  - Playwright checks for `/` and `/admin.html` now render normally with no `errors-0.json` emitted.

## 2026-02-13 (Admin overhaul: routed tabs + multi-window map workspace)
- Refactored admin navigation from in-page module toggles to route-style tabs under `/admin/<section>`:
  - `/admin/maps`
  - `/admin/tiles`
  - `/admin/npcs`
  - `/admin/player-sprite`
  - `/admin/critters`
  - `/admin/encounters`
- Added path parsing + history navigation in `src/admin/AdminView.tsx`, and kept `Critters` + `Encounters` placeholder tabs anchored at bottom of the nav.
- Added `src/admin/MapWorkspaceTool.tsx`:
  - supports multiple concurrent map editor windows,
  - each window has independent map editor state,
  - includes add/remove window and rename window controls.
- Extended `MapEditorTool` with section modes and embedded mode:
  - `section="map"`: map-focused workflow for map windows,
  - `section="tiles"`: dedicated tile library tooling,
  - `section="npcs"`: dedicated NPC studio tooling,
  - `embedded`: compact mode for map workspace cards.
- Map-focused mode now auto-loads saved tiles + NPC catalog for painting workflows and adds quick refresh controls in paint tools.
- Split visibility of large panels by section mode so UI is less cramped and each world-building concern can be used independently.
- Reset local admin catalog key versions to intentionally clear previous saved tile/NPC local data:
  - `map-editor-saved-paint-tiles-v3`
  - `map-editor-npc-sprite-library-v2`
  - `map-editor-npc-character-library-v2`
- Added `Clear NPC Catalog` action in NPC studio mode.
- Updated game title screen admin launch path from `/admin.html` to `/admin/maps`.
- Updated Vite middleware to rewrite `/admin`, `/admin.html`, and `/admin/<section>` requests to `/admin.html` in dev and preview servers so route-style paths work.
- CSS updates:
  - nav bottom spacer support,
  - embedded map editor status row,
  - single-column section layout mode,
  - responsive multi-window map workspace styles.

Validation
- `npm run build` passed.
## 2026-02-18 (Flags Table + Flags Admin Tool + Searchable Flag Dropdowns)
- Added a dedicated database table named `flags` to store global story/progress flag definitions.

Backend/API changes
- `vite.config.ts`
  - Schema bootstrap now creates:
    - `flags(flag_id TEXT PRIMARY KEY, label TEXT, notes TEXT, created_at, updated_at)`.
  - Added automatic flag discovery/sync (`syncDiscoveredFlags`) that scans:
    - `game_maps.map_data`
    - `game_npc_libraries.character_library`
    - `game_critter_catalog.critter_data`
    - `game_encounter_catalog.table_data`
    - `user_saves.save_data`
  - Also seeds core default story flags (`demo-start`, `selected-starter-critter`, `starter-selection-done`, `demo-done`, `jacob-left-house`).
  - Discovery sync now runs during `ensureGlobalCatalogBaseline`, so the `flags` table stays populated with currently used flags.
  - Added admin endpoints:
    - `GET /api/admin/flags/list`
    - `POST /api/admin/flags/save`
  - Save endpoint supports full CRUD behavior from admin UI (edit/add/remove), then re-syncs discovered in-use flags.

New admin tool
- Added `src/admin/FlagsTool.tsx`:
  - list/search/add/edit/remove flag entries
  - save to database via new flags API
  - simple notes field per flag for documentation.
- Added `src/admin/flagsApi.ts` shared client helpers:
  - `loadAdminFlags()`
  - `saveAdminFlags()`
  - sanitizer for consistent typed flag rows.
- Integrated new route/tab in `src/admin/AdminView.tsx`:
  - new nav item: `Flags`
  - new route: `/admin/flags`.

Searchable flag dropdown integration
- `src/admin/MapEditorTool.tsx`
  - loads flag catalog via `loadAdminFlags()`
  - provides datalist-backed searchable dropdown for existing flag fields:
    - `Requires Flag` (instance cards + detailed instance editor)
    - `Set Flag On Complete`
    - `Set Flag On First Interaction`.
- `src/admin/CritterTool.tsx`
  - loads flag catalog via `loadAdminFlags()`
  - `Story Flag ID` mission field now uses searchable datalist of existing flags.

Validation
- `npm run build` passed.
## 2026-02-18 (Reusable NPC Movement Guard System)
- Replaced Ben-specific hardcoded boundary logic with a reusable NPC movement guard system.

Shared model updates
- `src/game/world/types.ts`
  - Added `NpcMovementGuardDefinition` with:
    - `requiresFlag` / `hideIfFlag`
    - coordinate targeting (`x`, `y`) and rectangular targeting (`minX`, `maxX`, `minY`, `maxY`)
    - optional guard dialogue (`dialogueSpeaker`, `dialogueLines`) and `setFlag`.
  - Added `movementGuards?: NpcMovementGuardDefinition[]` to:
    - `NpcDefinition`
    - `NpcStoryStateDefinition`.

Runtime guard system
- `src/game/engine/runtime.ts`
  - Removed `isBenPortlockBoundaryStepAllowed` hardcoded handling.
  - Added generic guard processing in `canStepTo(...)` via `isNpcMovementGuardStepAllowed(...)`.
  - Guard behavior:
    - evaluates active NPCs on current map,
    - filters guards by `requiresFlag` / `hideIfFlag`,
    - blocks movement if target tile matches guard target area,
    - turns the guarding NPC to face the player,
    - shows guard dialogue from the guard config.
  - Extended runtime character/story resolution and sanitization to preserve `movementGuards` from character defaults and story instances.

Ben migrated to data-driven guard config
- `src/game/world/npcCatalog.ts`
  - Updated Ben story instance to include `movementGuards`:
    - `block-north-boundary`: `maxY: 0`, hidden after `demo-done`.
    - `block-ben-tile`: exact guard at `(11,1)`, hidden after `demo-done`.
    - both use Ben warning dialogue.

Admin tool wiring
- `src/admin/MapEditorTool.tsx`
  - Added `Movement Guards JSON` editor field for NPCs/instances.
  - Added parse/sanitize helpers:
    - `parseNpcMovementGuardsInput(...)`
    - `sanitizeNpcMovementGuards(...)`.
  - Wired movement guards through save/load/apply paths for:
    - character templates,
    - character instances,
    - map NPC edits,
    - story state sanitation and persistence.
  - Updated deep clone helpers to preserve guard data.
- `src/admin/mapEditorUtils.ts`
  - Updated `cloneNpc(...)` to deep-clone `movementGuards` on NPCs and story states.

Validation
- `npm run build` passed.

## 2026-02-17 (NPC Instance Timeline System + Admin NPC Studio Update)
- Reworked story NPC flow to use character-instance timelines as source of truth instead of hardcoded map injection:
  - Removed runtime `ensureDefaultStoryNpcs` map-upsert path.
  - Runtime now resolves additional NPCs from `npcCharacterLibrary` by selecting the highest-ordered eligible instance (`storyStates`) per character.
  - Added runtime loading/sanitization of NPC sprite + character libraries from stored world content.
- Added default story character templates/sprites in `src/game/world/npcCatalog.ts`:
  - Uncle Hank (`uncle-hank-story`) static in `uncle-s-house`.
  - Jacob (`jacob-story`) ordered instances:
    1) `uncle-s-house` gated by `starter-selection-done`
    2) `portlock` gated by `demo-done`
  - This keeps story characters running through the shared character-instance system.
- Extended content bootstrap payload to include NPC libraries:
  - `vite.config.ts` `/api/content/bootstrap` now returns `npcSpriteLibrary` + `npcCharacterLibrary`.
  - `src/game/content/worldContentStore.ts` now persists/reads those fields.
- `/admin/npcs` changes in `src/admin/MapEditorTool.tsx`:
  - Auto-loads saved tileset/tile library in NPC Studio too.
  - NPC paint now appends a new ordered placement instance to the selected character timeline (instead of writing only map NPC instances).
  - Right-click erase in NPC Studio removes character instances (and compacts order immediately) or map NPCs if present.
  - Added per-character instance timeline panel with:
    - ordered rows (`#1..N`)
    - map, x, y, requires-flag editing
    - up/down reordering
    - remove (immediate order compaction)
    - edit load into behavior editor
  - Map NPC list now includes both map NPCs and character instances on the active map.
  - Marker rendering now uses circle badges with name/initials and locked-style visuals when an instance requires a flag.

Validation
- `npm run build` passed.
- No Playwright regression run was completed in this pass (environment Chromium launch restrictions still apply in this sandbox).
- Playwright smoke checks (with screenshot capture, no error artifacts emitted):
  - `output/admin-overhaul-maps/shot-0.png`
  - `output/admin-overhaul-tiles/shot-0.png`
  - `output/admin-overhaul-npcs/shot-0.png`
  - `output/admin-overhaul-maps-multi/shot-0.png` (verifies "Add Map Window" flow)
  - `output/admin-overhaul-player-sprite/shot-0.png`

Follow-up suggestions
- Split map editor internals into smaller files/hooks (`useMapEditorState`, panel components) to reduce `MapEditorTool.tsx` size and improve maintainability.
- Add map-window persistence (restore open windows + labels + per-window route state) to IndexedDB.
- Add lightweight tab-level e2e action payloads to automate create/edit/save flows for Tiles, NPC Studio, and multi-window map workflows.

## 2026-02-13 (Follow-up: auto-apply uploaded sheets + more form space)
- Updated file upload behavior to auto-apply object URLs immediately after selecting a file:
  - `src/admin/MapEditorTool.tsx` tileset file picker now sets both `tilesetUrlInput` and `tilesetUrl`.
  - `src/admin/MapEditorTool.tsx` NPC spritesheet file picker now sets both `npcSpriteUrlInput` and `npcSpriteUrl`.
  - `src/admin/PlayerSpriteTool.tsx` player spritesheet file picker now sets both `spriteUrlInput` and `spriteUrl`.
- Updated status messages to reflect immediate apply behavior (`Loaded and applied ...`).
- Expanded form container/layout space for admin tabs/windows:
  - `src/styles.css` map workspace windows now use larger min width (`minmax(980px, 1fr)`) to reduce cramped forms.
  - Added `min-width: 0` safety on map windows/panels for proper overflow behavior.
  - Tuned embedded map editor column distribution for better form+tool space in map windows.

Validation
- `npm run build` passed.
- Playwright screenshot sanity checks:
  - `output/admin-form-space-maps/shot-0.png`
  - `output/admin-form-space-tiles/shot-0.png`
  - `output/admin-form-space-npcs/shot-0.png`

## 2026-02-13 (DB/auth foundation + runtime/admin data sync)
- Added backend database/auth support in `vite.config.ts` using `DB_CONNECTION_STRING` and `pg` + `bcryptjs`.
- Added schema initialization for:
  - `app_users`, `app_sessions`
  - `user_saves`
  - `world_maps`, `tile_libraries`, `npc_libraries`, `player_sprite_configs`, `critter_libraries`
- Added auth endpoints:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `GET /api/auth/session`
  - `POST /api/auth/logout`
- Added game/save/content endpoints:
  - `GET/POST /api/game/save`
  - `POST /api/game/reset` (password required)
  - `GET /api/content/bootstrap`
- Added admin CRUD endpoints:
  - maps: `GET /api/admin/maps/list`, `POST /api/admin/maps/save`
  - tiles: `GET /api/admin/tiles/list`, `POST /api/admin/tiles/save`
  - npc catalogs: `GET /api/admin/npc/list`, `POST /api/admin/npc/save`
  - player sprite: `GET /api/admin/player-sprite/get`, `POST /api/admin/player-sprite/save`
  - critters: `GET /api/admin/critters/list`, `POST /api/admin/critters/save`
- Added shared auth/API helpers:
  - `src/shared/authStorage.ts`
  - `src/shared/apiClient.ts`
- Added account-first title flow (`src/ui/AuthScreen.tsx`, `src/App.tsx`) with sign in/up, logout, and start-over password confirmation.
- Added admin auth gate in `src/admin/AdminView.tsx` so admin routes require a valid session.
- Added world-content bootstrap persistence (`src/game/content/worldContentStore.ts`) and runtime hydration (`src/game/engine/runtime.ts`) so maps/custom tiles/player sprite can come from DB content.
- Updated map builder to accept injected tile definitions (`src/game/world/mapBuilder.ts`) for DB custom tile codes.
- Updated save manager to sync saves to DB and reset save via password (`src/game/saves/saveManager.ts`).
- Updated admin tools (`MapEditorTool`, `PlayerSpriteTool`) to read/write DB endpoints for maps/tiles/npcs/player sprite.

Validation
- `npm run build` passed.

## 2026-02-13 (Follow-up fix: eliminate "Checking Session" hang)
- Root cause: auth/session fetch paths could hang indefinitely on network/DB stalls, leaving admin on `Checking Session` and app on `Loading...`.
- Fixes:
  - `src/shared/apiClient.ts` now applies an 8s request timeout and converts abort/network failures into structured `{ ok: false }` API results.
  - `src/admin/AdminView.tsx` now wraps session verification in guarded try/catch and always resolves to `ok` or `blocked` state.
  - `src/App.tsx` bootstrap flow now catches auth/bootstrap failures and returns users to auth screen instead of hanging.
  - `src/game/saves/saveManager.ts` now preserves local save on transient server failures and migrates local save to DB when server save is empty.
  - `vite.config.ts` DB pool now uses connection/idle timeouts to fail faster on unreachable DB.
- Layout tuning follow-up:
  - `src/styles.css` widened single-tab forms and map-window layouts for better form space in Tiles/NPC/Map windows.

Validation
- `npm run build` passed.
- Playwright screenshots:
  - root auth page renders: `output/db-auth-root-fix/shot-0.png`
  - admin route resolves to blocked state (no perpetual checking): `output/db-auth-admin-fix/shot-0.png`

Follow-up suggestions
- Add explicit admin UI modules for Critters/Encounters wired to `/api/admin/critters/*`.
- Add a first-login migration action to seed DB maps/catalogs from existing local/static content for smoother onboarding.
- Add automated e2e auth test payloads (signup/login/logout/start-over) once DB access is available in CI/dev.
- 2026-02-13 quick tweak: `/admin/tiles` now defaults tile pixel dimensions to `16x16` by initializing `tilePixelWidthInput`/`tilePixelHeightInput` to `16` when `section === 'tiles'` in `src/admin/MapEditorTool.tsx`.
- Validation: `npm run build` passed.
- 2026-02-13 UI cleanup: removed the Tiles tab "Tile Code" field from the manual atlas save form in `src/admin/MapEditorTool.tsx`; tile codes remain auto-generated internally.
- Validation: `npm run build` passed.
- 2026-02-13 DB-only map source + spawn baseline:
  - Admin `MapEditorTool` map source now reads from DB only (removed fallback/merge with static `WORLD_MAPS`).
  - Added DB world baseline migration in `vite.config.ts`:
    - new table `user_world_state` with `map_init_version`.
    - one-time per-user reset (`WORLD_MAP_BASELINE_VERSION=1`) deletes existing `world_maps` rows and inserts only:
      - id: `spawn`
      - name: `Portlock Beach`
      - size: `11x9` blank base layer.
    - baseline enforcement runs before `/api/content/bootstrap` and `/api/admin/maps/list` responses.
  - New-game defaults now start at `spawn` center `(5,4)` in `src/game/saves/saveManager.ts`.
  - Runtime no longer uses static `WORLD_MAP_REGISTRY`; it boots from DB-hydrated content (with local `spawn` safety fallback map only).
- Validation: `npm run build` passed.
- 2026-02-13 map-window canvas visibility fix:
  - Added dedicated map-canvas panel class to `MapEditorTool` (`admin-panel--map-canvas`).
  - Added CSS minimum-height constraints so map canvas cannot collapse in map windows:
    - `.admin-panel--map-canvas { min-height: 420px; }`
    - `.admin-panel--map-canvas .map-grid-wrap { min-height: 340px; max-height: 62vh; }`
  - Goal: when a map is loaded, the full map grid section is visibly rendered in the map window instead of appearing missing/collapsed.
- Validation: `npm run build` passed.
- 2026-02-13 map editor paint transform features:
  - Added new paint tool `Fill Rotated` in `MapEditorTool`.
  - `Fill Rotated` flood-fills the clicked contiguous area and applies a 90-degree rotation progression per cell (based on cell distance from fill origin).
  - Added brush transform controls in Paint Tools:
    - `Rotate Left`
    - `Rotate Right`
    - `Mirror Horizontal`
    - `Mirror Vertical`
  - Transform controls now affect selected stamp painting/preview behavior (non-destructive to saved tile assets).
  - Standard `Fill` now honors current brush rotation quarter for placed tile rotations.
- Validation: `npm run build` passed.
- 2026-02-13 map save/game blank follow-up:
  - Added `ensureWorldBaselineForUser(auth.user.id)` to `/api/admin/maps/save` so save requests are baseline-safe even if they are the first map API call for that user.
  - Updated title-screen transitions in `App.tsx` to refresh world content from DB immediately before entering gameplay (`Continue`, `Start Game`, and after `Start Over`).
  - Goal: eliminate stale/blank map runtime caused by old cached world content or delayed baseline initialization.
- Validation: `npm run build` passed.
- 2026-02-13 blank-map render fallback fix:
  - Runtime tileset draw now validates atlas bounds (`atlasIndex < tilesetCellCount`) before drawing from tilesheet.
  - Added `tilesetRows` + `tilesetCellCount` tracking in runtime loader.
  - If atlas index is out of bounds, renderer now falls back to color tile rendering instead of silent no-op (blank tile).
- Validation: `npm run build` passed.
- 2026-02-13 baseline behavior correction:
  - Updated `ensureWorldBaselineForUser` to stop destructive map resets.
  - New behavior:
    - If user has no maps, seed blank `spawn`.
    - If user already has maps (including a created `spawn`), do not overwrite/delete them.
    - Still records baseline version in `user_world_state`.
  - This prevents game start/bootstrap from replacing user-authored maps with a fresh blank `spawn`.
- Validation: `npm run build` passed.
- 2026-02-13 runtime terrain visibility hardening:
  - Updated map render pipeline to always draw fallback tile color first, then overlay tileset atlas art.
  - This prevents full-map blank visuals when atlas cells are transparent or misaligned for saved custom tile IDs.
  - Combined with atlas bounds checks, map tile placement remains visible based on saved tile IDs/positions even when sprite-sheet sampling fails.
- Validation: `npm run build` passed.
- 2026-02-13 tileset persistence fix for runtime rendering:
  - Tiles tab file upload now converts selected tileset image to a persistent `data:` URL instead of temporary `blob:` URL.
  - Saved map/tileset data now keeps a runtime-loadable tileset URL across reloads/sessions.
  - Updated `loadExampleTileset` to report missing bundled example tileset instead of setting an invalid path.
- Validation: `npm run build` passed.
- 2026-02-13 DB tile-library source of truth:
  - `/api/content/bootstrap` now returns raw `savedPaintTiles` from tile library table.
  - `worldContentStore` now persists `savedPaintTiles` in local world-content cache.
  - Runtime now rebuilds custom tile definitions directly from `savedPaintTiles` (code + atlasIndex), then merges them into active tile definitions.
  - This makes map tile rendering explicitly sourced from saved tiles DB records.
- Validation: `npm run build` passed.
- 2026-02-13 DB schema mismatch fix for fallback-only terrain rendering:
  - Ran live Supabase SQL probes (via `DB_CONNECTION_STRING`) and confirmed:
    - `world_maps` has `spawn` for the active user with non-blank tile content (99 non-blank cells).
    - `tile_libraries.saved_tiles` has 47 tile stamps / 248 atlas cells.
    - all tile codes used in `spawn` exist in `saved_tiles` (0 missing codes).
    - `tile_libraries.tileset_config` stores dimensions as `tilePixelWidth/tilePixelHeight`.
  - Identified client/runtime mismatch: runtime expects `CustomTilesetConfig` as `tileWidth/tileHeight`, so atlas draw path never activated and map showed fallback colors only.
  - Patched `src/game/content/worldContentStore.ts`:
    - added `sanitizeCustomTilesetConfig(raw)` that accepts either shape (`tileWidth/tileHeight` or `tilePixelWidth/tilePixelHeight`) and normalizes to runtime shape.
    - applied sanitizer in both `readStoredWorldContent` and `hydrateWorldContentFromServer`.
- Validation: `npm run build` passed.
- 2026-02-13 layer overlay render fix:
  - Updated runtime terrain draw order in `src/game/engine/runtime.ts` so each cell now tries atlas draw first and only falls back to color when atlas draw fails.
  - This preserves transparency on higher layers, allowing lower-layer tiles to show through in the same cell.
- Validation: `npm run build` passed.
- 2026-02-13 runtime z-depth pass for actor vs overhead tiles:
  - Added a depth-sorted draw queue in `src/game/engine/runtime.ts` that combines actors and overhead tile overlays.
  - Overhead candidates: tiles on non-base layers (`layerIndex > 0`) or tiles with `height > 0`.
  - Sorting key uses `depthY` (tile/actor foot Y), so actor appears in front when lower on screen (higher y), and behind when above (lower y).
  - Tie-break keeps overlay before actor at equal Y, and lower layers before higher layers.
- Validation: `npm run build` passed.
- 2026-02-13 z-depth tuning fix (tree/building front-back inversion):
  - Updated runtime tile pass to avoid duplicate drawing of overhead tiles.
  - New behavior:
    - ground tiles (`layerIndex === 0` and `tile.height === 0`) draw in base pass,
    - overhead tiles (`layerIndex > 0` or `tile.height > 0`) draw only in depth queue.
  - Changed depth tie-break at equal Y so `actor` draws before `overlay`.
    - Result: actor in same cell as overhead tile appears behind it.
    - Actor in the cell below appears in front (higher Y wins).
- Validation: `npm run build` passed.
- 2026-02-13 UI tweak: removed the in-game Objective banner from `src/game/engine/GameView.tsx`.
- Validation: `npm run build` passed.
- 2026-02-13 gameplay-only HUD update + fixed camera viewport:
  - Removed top HUD bar (name/location/save/time) from `src/game/engine/GameView.tsx`.
  - Kept dialogue and pause menu overlays.
  - Set default render camera to fixed `19x15` tiles (`TILE_SIZE * 19` by `TILE_SIZE * 15`) in `GameView`.
  - Updated canvas resize behavior to keep fixed camera resolution and scale display in viewport.
  - Updated runtime camera centering in `src/game/engine/runtime.ts` so maps larger than the viewport keep the player centered (no edge clamp).
  - Updated `src/styles.css` viewport layout to center the scaled fixed-resolution canvas.
- Validation: `npm run build` passed.
- 2026-02-13 warp proximity popup:
  - Added runtime warp hint state (`warpHintLabel`) in `src/game/engine/runtime.ts`.
  - Added `updateWarpHint()` to detect nearby labeled warps and expose popup text when within 1 tile (including facing-tile checks for interact-only warps).
  - Added `warpHint` to `RuntimeSnapshot` and `render_game_to_text` payload.
  - Added UI overlay in `src/game/engine/GameView.tsx` to display warp label popup when near a warp.
  - Added `.warp-popup` styling in `src/styles.css`.
- Validation: `npm run build` passed.
- 2026-02-13 in-game menu expansion (Squad first pass):
  - Added side menu entries: `Collection (Soon)`, `Squad`, `Backpack (Soon)` in `src/game/engine/GameView.tsx`.
  - Added side-menu subview state (`root` / `squad`) and reset-to-root on menu close.
  - Implemented `Squad` panel UI with 8 pill slots in a 2x4 grid:
    - top row (2 slots) unlocked and shown as `Empty`,
    - remaining 6 slots shown as `Locked`.
  - Added new menu styles in `src/styles.css` for section/actions layout and squad pill grid.
- Validation: `npm run build` passed.
- 2026-02-14 map tweak: Updated `uncle-hank` NPC sprite in `src/game/data/maps/uncleSHouse.ts` from `ow3.png` to `ow7.png`.
- Validation: `npm run build` passed.
- 2026-02-14 runtime map hydration patch: added `ensureDefaultStoryNpcs` in `src/game/engine/runtime.ts` to inject `Uncle Hank` into `uncle-s-house` when DB/stored map content is missing him (prevents static-file vs DB map drift).
- Validation: `npm run build` passed.
- 2026-02-14 NPC/data reset + sprite animation extensibility:
  - Executed DB reset script using `DB_CONNECTION_STRING` to purge current NPC content:
    - `world_maps`: set `map_data.npcs = []` for all rows (`mapsUpdated: 4`).
    - `npc_libraries`: cleared `sprite_library` + `character_library` (`npcLibrariesCleared: 1`).
    - `player_sprite_configs`: deleted rows (`playerSpriteConfigsDeleted: 0`, none existed).
  - Removed all source-map NPC arrays from:
    - `src/game/data/maps/portlock.ts`
    - `src/game/data/maps/starterTown.ts`
    - `src/game/data/maps/rivalHouse.ts`
    - `src/game/data/maps/uncleSHouse.ts`
  - Removed runtime NPC auto-injection fallback in `src/game/engine/runtime.ts` so NPC population is fully data-driven.
  - Emptied default NPC sprite/character catalogs in `src/game/world/npcCatalog.ts` for a clean overhaul baseline.
  - Added extensible sprite animation schema support:
    - `NpcSpriteConfig.animationSets` (named directional frame sets)
    - `NpcSpriteConfig.defaultIdleAnimation` / `defaultMoveAnimation`
    - `NpcDefinition.idleAnimation` / `moveAnimation` (character-level animation selection)
    - Files updated: `src/game/world/types.ts`, `src/game/engine/runtime.ts`, `vite.config.ts`, `src/admin/mapEditorUtils.ts`, `src/admin/MapEditorTool.tsx`.
  - Updated player sprite workflow to emit named animation sets (`idle`, `walk`) while preserving existing frame fields:
    - `src/game/world/playerSprite.ts`
    - `src/admin/PlayerSpriteTool.tsx`
  - Bumped local NPC catalog IndexedDB keys to prevent stale local NPC catalogs from rehydrating server-cleared data:
    - `map-editor-npc-sprite-library-v3`
    - `map-editor-npc-character-library-v3`
- Validation:
  - `npm run build` passed after all changes.
  - Playwright smoke script reached auth screen only (no authenticated session in headless run), so gameplay-level visual verification requires signed-in test run.
- 2026-02-14 admin animation-authoring pass (multi-animation support):
  - Extended NPC Studio UI (`src/admin/MapEditorTool.tsx`) to support arbitrary named directional animation sets:
    - Added editable `Animation Sets JSON` field for sprite entries.
    - Added sprite defaults: `Default Idle Animation`, `Default Move Animation`.
    - Atlas assignment + 4x4 autofill now keep `idle`/`walk` sets synchronized inside the JSON draft while preserving extra custom sets.
    - Sprite save now validates JSON/default animation names before persisting.
  - Extended Character Template UI in NPC Studio:
    - Added per-character animation selectors: `Character Idle Animation`, `Character Move Animation`.
    - Character save validates selected animation names exist on the chosen sprite.
    - Template load/use now restores these animation names.
  - Extended Player Sprite admin tool (`src/admin/PlayerSpriteTool.tsx`) with the same animation-set workflow:
    - Added `Animation Sets JSON`, `Default Idle Animation`, and `Default Move Animation` controls.
    - Save endpoint payload now persists custom animation sets/default names (not just hardcoded idle/walk).
    - Atlas assignment + 4x4 autofill sync the `idle`/`walk` sets in draft JSON while preserving extras.
  - Added shared parsing/sanitization helpers in both admin tools for robust JSON handling and fallback generation from legacy `facingFrames`/`walkFrames`.
- Validation:
  - `npm run build` passed after UI + parser updates.

## 2026-02-14 (Admin Animation UI)
- Refactored NPC sprite animation editing in `/src/admin/MapEditorTool.tsx`:
  - Added list-based animation management (add, rename, delete animations).
  - Added per-direction frame management (add selected frame, remove frame, clear direction).
  - Removed user-facing animation JSON editing from NPC sprite workflow.
  - Kept file-based sheet loading flow and removed URL/example-button path from NPC studio UI.
  - Updated sprite "Use" action to restore animation data and auto-select a valid current animation.
  - Fixed save validation/status text and corrected JSX tag mismatches.
  - Added legacy `facingFrames`/`walkFrames` derivation from chosen default idle/move animations.
- Refactored player sprite animation editing in `/src/admin/PlayerSpriteTool.tsx`:
  - Removed URL/default-example editing controls from UI and kept file upload workflow.
  - Replaced idle/walk assign-mode controls with the same list-based animation editor used for NPC sprites.
  - Added frame removal controls and direction clearing.
  - Removed user-facing animation JSON textarea.
  - Save now validates default animation names against animation sets and derives legacy `facingFrames`/`walkFrames` from animation sets for compatibility.
- Validation:
  - `npm run build` passed.
  - Playwright admin smoke run succeeded technically, but UI verification was blocked by auth gate (`Sign In Required` page, 401 on admin data endpoint), so no authenticated admin screenshot was captured in this run.

### Follow-up
- After signing in, re-run the admin Playwright/screenshot pass to visually confirm the new animation controls in both Player Sprite and NPC Studio panels.
- 2026-02-14 player sprite persistence fix:
  - Diagnosed missing in-game sprite rendering as temporary `blob:` URLs being persisted for player sprites.
  - Updated `/src/admin/PlayerSpriteTool.tsx` file upload flow to convert selected images to persistent `data:` URLs before save.
  - Added server-side safety in `/vite.config.ts`:
    - reject saving `blob:` URLs in `/api/admin/player-sprite/save`.
    - sanitize loaded player sprite config (ignore blob-based rows) for both `/api/admin/player-sprite/get` and `/api/content/bootstrap`.
  - Replaced broken blob URL in `/src/game/world/playerSprite.ts` with stable project asset path `/example_assets/character_npc_spritesheets/main_character_spritesheet.png`.
  - Validation: `npm run build` passed.
- 2026-02-14 follow-up sprite rendering reliability fixes:
  - Added client-side player sprite config sanitizer in `src/game/content/worldContentStore.ts` to ignore stale/invalid `blob:` sprite URLs from local cache.
  - Added defensive `persistWorldContent` fallback: if localStorage quota write fails, retry without `playerSpriteConfig` so world content hydration still succeeds.
  - Updated NPC file upload in `src/admin/MapEditorTool.tsx` to use persistent data URLs (no temporary object URLs).
  - Validation: `npm run build` passed.
- 2026-02-14 NPC admin performance stabilization:
  - Added atlas preview cell cap (`MAX_ATLAS_PREVIEW_CELLS = 4096`) to NPC and player sprite editors to prevent rendering huge tens-of-thousands-cell grids that lock the UI.
  - NPC Studio now shows a warning when preview is truncated and advises increasing atlas cell size.
  - Removed duplicate NPC URL state assignment to reduce memory churn during sheet load.
- 2026-02-14 source bundle bloat fix:
  - Prevented `data:` player sprite URLs from being written into `src/game/world/playerSprite.ts` during save (DB keeps full URL; source file keeps stable fallback URL).
  - Restored `src/game/world/playerSprite.ts` URL to project asset path.
  - Validation: `npm run build` passed and bundle size returned to normal range.
- 2026-02-14 default sprite cell size update:
  - Set NPC atlas cell width/height admin defaults to `64x64` in `src/admin/MapEditorTool.tsx`.
  - Updated NPC sprite sanitize fallbacks to `64x64` when frame size fields are missing.
  - Updated player-sprite save API fallback frame width/height to `64x64` in `vite.config.ts`.
  - Validation: `npm run build` passed.
- 2026-02-14 animation add/save persistence fix:
  - Root cause: empty animations were being removed by animation-set sanitization, so newly added animations vanished from dropdowns.
  - Updated animation-set sanitization in both admin tools to preserve animation names even when direction frame arrays are empty.
  - Updated parse validation messaging to require at least one animation name (not at least one populated frame list).
  - Updated player-sprite backend parser in `vite.config.ts` to preserve empty animations/directions when saving to DB/source payload.
  - Result: new animations now appear immediately in dropdowns, remain selected for editing, and persist across save/load.
  - Validation: `npm run build` passed.
- 2026-02-14 Supabase spritesheet bucket integration:
  - Completed Supabase storage wiring in `vite.config.ts`:
    - `createAdminMapApiPlugin` now receives `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` config via `normalizeSupabaseStorageConfig(...)`.
    - Enabled authenticated `GET /api/admin/spritesheets/list` usage with bucket/prefix support for PNG discovery.
  - Added searchable Supabase spritesheet browsers in both admin sprite workflows:
    - `src/admin/PlayerSpriteTool.tsx`:
      - New Bucket/Prefix/Search controls.
      - Alphabetized scrollable list of PNG objects from Supabase.
      - One-click `Load` applies selected spritesheet public URL as active player sheet.
    - `src/admin/MapEditorTool.tsx` (NPC Studio):
      - Same Bucket/Prefix/Search + alphabetical scrollable list.
      - One-click `Load` applies selected spritesheet URL to NPC sheet and optionally seeds label from filename.
  - Added shared list styling in `src/styles.css` (`spritesheet-browser*` classes).
  - Validation:
    - `npm run build` passed.
    - Playwright smoke (`output/admin-supabase-picker/shot-0.png`) reached unauthenticated admin gate (`Sign In Required`), so logged-in picker UI verification is pending an authenticated run.
- 2026-02-14 NPC Studio UI cleanup:
  - Removed `Clear NPC Catalog` button from NPC Studio controls (`src/admin/MapEditorTool.tsx`).
  - Removed NPC `Auto Fill 4x4 D/L/R/U` button and related note text.
  - Sprite label behavior is now fully manual in NPC Studio:
    - no auto-label assignment from file upload,
    - no auto-label assignment from Supabase sheet selection,
    - added explicit note that sprite label saves exactly as entered.
  - Validation: `npm run build` passed.
- 2026-02-14 Supabase bucket connection fix:
  - Diagnosed empty picker root cause as bucket-name typo mismatch:
    - empty bucket checked by app default: `character-spirtesheets` (0 PNGs)
    - actual populated bucket: `character-spritesheets` (7 PNGs)
  - Updated default Supabase bucket fallback in:
    - `src/admin/PlayerSpriteTool.tsx`
    - `src/admin/MapEditorTool.tsx`
    - `vite.config.ts` (`sanitizeStorageBucketName` default)
  - Validation: `npm run build` passed.
- 2026-02-14 NPC sprite library DB update (jacob mapping clone):
  - Read `npc_libraries.sprite_library` and used `jacob-sprite` as template mapping source.
  - Added sprite-library entries in DB for:
    - `boy-1-sprite` -> `boy_1_spritesheet.png`
    - `boy-2-sprite` -> `boy_2_spritesheet.png`
    - `girl-1-sprite` -> `girl_1_spritesheet.png`
    - `girl-2-sprite` -> `girl_2_spritesheet.png`
    - `hank-sprite` -> `uncle_hank.png`
  - Kept atlas/animation mapping identical to `jacob-sprite` (verified each new entry matches Jacob config aside from URL).
- 2026-02-14 critter system foundation implementation (data + player progress + admin tooling):
  - Added formal critter domain models in:
    - `src/game/critters/types.ts`
    - `src/game/critters/baseDatabase.ts`
    - `src/game/critters/schema.ts`
  - New model covers:
    - critter definitions (element, rarity, base stats),
    - adoption-lottery metadata scaffold (`lotteryPoolId`, `lotteryWeight`, optional story gate),
    - mission-based level goal scaffold for future progression,
    - player critter progress (`collection`, unlocked squad slots, squad assignment array).
  - Save/profile integration:
    - extended `SaveProfile` with `playerCritterProgress` in `src/game/saves/types.ts`.
    - updated `src/game/saves/saveManager.ts`:
      - new saves initialize critter progress defaults,
      - save version bumped to `3`,
      - legacy saves are sanitized/migrated by loading default critter progress when missing.
  - World content integration:
    - `src/game/content/worldContentStore.ts` now stores typed critter definitions and sanitizes/falls back to base critter DB when server data is missing/invalid.
  - Runtime integration (`src/game/engine/runtime.ts`):
    - runtime now hydrates critter database from world content,
    - runtime tracks sanitized player critter progress from save data,
    - `RuntimeSnapshot` now includes critter summary data:
      - unlocked count,
      - total count,
      - unlocked squad slots,
      - squad slot view model,
      - collection view model.
    - `render_game_to_text` now includes critter summary block for automation/state validation.
    - save persistence now writes critter progress back into profile.
  - In-game UI integration (`src/game/engine/GameView.tsx`):
    - enabled real `Collection` view in side menu,
    - squad view now uses real runtime critter/squad data instead of hardcoded 2/8 placeholder,
    - collection list now displays lock state and level.
  - Admin tooling:
    - added new `src/admin/CritterTool.tsx` and wired route in `src/admin/AdminView.tsx`.
    - Critter tab is now active (not placeholder).
    - features:
      - load critter DB from `/api/admin/critters/list`,
      - draft/create/edit/remove critter definitions,
      - apply draft locally,
      - save full critter DB to `/api/admin/critters/save`.
    - editor fields include stat, rarity/element, lottery metadata, mission tags, and level-goal scaffolding.
  - Backend hardening (`vite.config.ts`):
    - added critter parsing/sanitization helpers (`parseCritterLibrary`, etc.),
    - `/api/content/bootstrap`, `/api/admin/critters/list`, and `/api/admin/critters/save` now use sanitized critter payloads.

Validation
- `npm run build` passed.
- Playwright smoke run executed via `scripts/web_game_playwright_client.js` against local dev server.
  - Screenshot captured: `output/critter-system-smoke/shot-0.png`.
  - Run reached auth gate (`Sign In`), so gameplay/admin in-session interaction verification remains pending authenticated scripted run.

Follow-up suggestions
- Add a lightweight player-facing critter assignment action (assign/unassign critter to squad slots) in the side menu.
- Build combat-domain primitives next:
  - move definitions,
  - turn order resolver,
  - damage resolver using current `baseStats`.
- Add `player_critter_progress` table only if critter progression should be decoupled from `user_saves` JSON in future.
- 2026-02-14 critter system v2 migration (numeric IDs + dynamic level table + account-name start flow):
  - Critter data model refactor (`src/game/critters/types.ts`, `src/game/critters/schema.ts`, `src/game/critters/baseDatabase.ts`):
    - critter IDs are now numeric dex-style IDs (`id: number`).
    - removed old critter progression fields (`missionTagHints`, `levelGoals`, `storyGateFlag` path).
    - added dynamic level requirement table model:
      - `levels[]` rows keyed by target level,
      - each row stores `missions[]`, `requiredMissionCount`, per-stat deltas (`hp/attack/defense/speed`), and `abilityUnlockIds`.
      - mission types now start with `opposing_knockouts` and mission `targetValue`.
    - added ability section model (`abilities[]`, passive/active kind).
    - added mission progress key system (`missionProgressKey(level, missionId)`) for per-mission progression tracking.
  - Base critter seed updated:
    - `BASE_CRITTER_DATABASE` now starts with one outline critter (`#1 Spriglet`) and empty:
      - lottery pools,
      - abilities,
      - level requirement rows/challenges.
  - Player progress tracking overhaul:
    - `PlayerCritterProgress` now stores numeric squad IDs and full collection entries for all known critters.
    - collection entries store per-mission `missionProgress` records (no legacy mission-tag counters).
    - sanitizer now:
      - ensures every critter in DB has a collection entry for each user,
      - merges mission progress templates when level rows/missions change,
      - clamps squad usage to unlocked slots and unlocked critters only.
  - Runtime/save integration (`src/game/engine/runtime.ts`, `src/game/saves/saveManager.ts`):
    - save version bumped to `4`.
    - runtime now hydrates and persists new critter progress shape.
    - runtime summary mission completion count is derived dynamically from mission progress vs mission targets.
  - Backend critter validation (`vite.config.ts`):
    - critter payload parser now validates new schema (`lotteryPools`, `abilities`, `levels`, nested missions).
    - strict duplicate-ID rejection on `/api/admin/critters/save`.
    - list/bootstrap still sanitize existing data safely.
  - Admin Critter tool rewrite (`src/admin/CritterTool.tsx`):
    - numeric critter ID editor with duplicate ID blocking.
    - level table editor with:
      - add/remove levels,
      - add/remove missions per level,
      - `requiredMissionCount` guard,
      - per-level stat delta columns,
      - per-level ability unlock ID mapping.
    - ability section editor (for passive now, active-ready structure).
    - lottery pools moved to simple comma-list input; empty by default.
  - Player name/new game flow update:
    - removed manual naming step from app flow (`src/App.tsx` no longer routes through `NewGameSetup`).
    - new game now starts with signed-in account `displayName` as player name.
    - title actions now align with requested UX:
      - `Start` (no save)
      - `Continue` (has save)
      - `Restart` (password-confirmed reset)
    - title copy/button text updated in `src/ui/TitleScreen.tsx`.

Validation
- `npm run build` passed.
- Playwright smoke checks:
  - game route screenshot: `output/critter-system-v2-game-smoke/shot-0.png`
  - admin critter route screenshot: `output/critter-system-v2-admin-smoke/shot-0.png`
  - admin errors log: `output/critter-system-v2-admin-smoke/errors-0.json` (`401 Unauthorized` expected due unauthenticated run).
- 2026-02-14 live critter DB normalization (post-schema migration):
  - Inspected `critter_libraries` and confirmed one row for active user still used legacy critter shape (`id` string + `adoption/progression`).
  - Updated row to new schema baseline with one critter:
    - `id: 1`
    - empty `lotteryPools`
    - empty `levels`
    - empty `abilities`
  - Resulting DB payload now matches v2 critter model used by admin/runtime.
- 2026-02-14 player-name binding follow-up:
  - Updated continue flow to pass authenticated `displayName` into runtime startup (`src/App.tsx`).
  - Runtime now enforces provided account display name onto loaded save profile and persists immediately when it differs (`src/game/engine/runtime.ts`).
  - Validation: `npm run build` passed.
- 2026-02-14 critter schema cleanup (removed lottery pools from critter data/forms):
  - Removed `lotteryPools` from critter model and sanitization:
    - `src/game/critters/types.ts`
    - `src/game/critters/schema.ts`
    - `src/game/critters/baseDatabase.ts`
  - Removed all lottery-pool UI/editing from Critter Admin tool:
    - deleted `lotteryPoolsInput` draft field and related form controls in `src/admin/CritterTool.tsx`.
  - Removed lottery-pool parsing from backend critter sanitizer in `vite.config.ts` so saved critter payloads only include intrinsic critter attributes and progression/ability structures.
  - Live DB normalization:
    - removed legacy `lotteryPools` key from `critter_libraries.critters` row(s) in database.
  - Validation: `npm run build` passed.
- 2026-02-14 critter tracking hardening (effective stats + non-lossy save handling):
  - Added explicit derived tracking on each player collection critter entry:
    - `statBonus`
    - `effectiveStats` (base + unlocked level deltas, clamped >= 1)
    - `unlockedAbilityIds`
  - Added `computeCritterDerivedProgress(...)` in `src/game/critters/schema.ts` and used it during critter progress sanitization/migration.
  - Runtime critter snapshot now includes per-critter:
    - base stats,
    - stat bonus,
    - effective stats,
    - unlocked ability IDs,
    - per-level mission completion progress summary.
  - `render_game_to_text` now includes full critter collection tracking payload (not only squad summary).
  - Save schema version bumped to `5` in runtime/save creation for migration persistence.
  - Fixed a data-loss edge case in `loadSave()`:
    - save manager now preserves raw `playerCritterProgress` payload,
    - runtime performs final sanitization against hydrated DB critter catalog (prevents dropping critters not in local fallback base DB).
  - Validation: `npm run build` passed.
- 2026-02-14 critter editor level UX update:
  - Critter admin `New Critter` now starts with one blank `Level 1` block by default.
  - Removed editable `Target Level` field from level rows in `src/admin/CritterTool.tsx`.
  - Level row headers now display as `Level X` based on row position/order.
  - Kept level row internals unchanged per request:
    - missions,
    - missions required count,
    - stat delta fields,
    - ability unlock IDs.
  - Updated level semantics in core schema/runtime:
    - row `Level N` now means requirements for advancing from `N` to `N+1`.
    - stat deltas/ability unlocks are applied once the critter reaches the next level (rows with `N < currentLevel`).
    - max configured level is now derived as `max(row.level + 1)`.
  - Backend critter parser now accepts level rows starting at `1` (was previously minimum `2`).
  - Validation: `npm run build` passed.

## 2026-02-14 (Tileset + Critter Sprite Buckets, Collection UI Overhaul)
- Implemented bucket-backed asset browsing for tilesets in `MapEditorTool`:
  - Added default tileset bucket support (`tilesets`) with bucket/prefix/search controls.
  - Added Supabase tileset browser list and direct `Load` into active tileset URL state.
  - Reused existing `/api/admin/spritesheets/list` endpoint (PNG listing) for tileset assets.
- Implemented bucket-backed critter sprite selection in `CritterTool`:
  - Added critter `spriteUrl` support in editor draft and persisted critter payload.
  - Added default `critter-sprites` bucket browser (bucket/prefix/search/reload/select).
  - Critter rows now indicate whether a sprite is linked.
- Extended critter schema/runtime/backend parsing to store sprite URL safely:
  - `src/game/critters/types.ts`: `CritterDefinition.spriteUrl`.
  - `src/game/critters/schema.ts`: sanitize + backward compatibility for legacy `sprite.url` payloads.
  - `vite.config.ts`: server-side critter parsing now includes sanitized `spriteUrl`.
  - `src/game/critters/baseDatabase.ts`: base entry includes blank `spriteUrl`.
- Overhauled in-game collection view UI (neon-tokyo style pass for collection page only):
  - Added search by name/ID and sort toggle (ID/Name).
  - Added 4-column scrollable card grid (responsive to 2/1 columns on smaller screens).
  - Card layout now shows ID+name, sprite preview, locked/unlocked state, stats, and mission progress.
  - Locked cards render greyed-out; unlocked cards use element accent color.
  - Added active mission requirement rendering from runtime data (unlock/next-level mission block).
- Runtime snapshot improvements for collection cards:
  - Collection entries now include `spriteUrl` and per-mission progress (`currentValue`, `targetValue`, completion).
  - Added `activeRequirement` object for the currently relevant progression step.

Validation
- `npm run build` passes after all changes.
- Playwright smoke run completed (`output/critter-collection-overhaul-2/shot-0.png`) but app is still auth-gated at Sign In in automation, so collection page could not be visually exercised in this run.

Follow-up suggestion
- Add a deterministic automation test account/login step (or bypass flag for local dev) so Playwright can reach in-game menu/collection and capture post-login gameplay screenshots.
- 2026-02-14 UI pass: replaced yellow/large button system with tighter neon-retro styling.
  - Updated global button sizing (smaller padding/font) and added neon cyan/magenta glow states.
  - Updated `.admin-screen__back` to match neon secondary styling (removed yellow gradient).
  - Build validation passed after button style refactor.
- 2026-02-14 neon-retro full-system pass:
  - Tightened buttons further (slimmer, uppercase micro labels, harder cyan/magenta glow states).
  - Applied unified neon visual system across title/auth modals, game HUD/menus/dialogue overlays, and admin shell/panels/forms/lists/map-grid surfaces.
  - Converted remaining warm/yellow accents (including dialogue/map-anchor highlights) to cyan/magenta neon palette.
  - Added global input/select/textarea focus glow treatment for consistency.
  - Build validation passed; screenshot captured at `output/neon-full-system-pass/shot-0.png`.
- 2026-02-14 collection layout adjustment:
  - Collection panel now spans full viewport width (`100vw`).
  - Collection cards shortened (reduced min-height and sprite area).
  - Added placeholder blank cards so collection always renders at least 4 rows x 4 columns (16 tiles), and always row-aligned in groups of 4.
  - Build validation passed.
- 2026-02-14 collection element logo overlay:
  - Added automatic element logo rendering on collection cards (top-left).
  - Logo URL is derived from Supabase public bucket root from critter sprite URLs and resolves to `<element>-element.png`.
  - Locked cards render element logos greyed out.
  - Build validation passed.
- 2026-02-14 collection sizing/header update:
  - Collection grid now uses 3 columns.
  - Minimum always-filled collection area reduced to 3 rows (9 tiles), still row-aligned with blanks.
  - Card header redesigned and enlarged to show element logo + critter ID + name prominently.
  - Placeholder cards now use the same header structure.
  - Build validation passed.

## 2026-02-14 (Encounter Tables + Map Encounter Groups + Map Tool UX)
- Added encounter data model and sanitization primitives:
  - `src/game/encounters/types.ts`
  - `src/game/encounters/schema.ts`
- Extended world map schema to persist encounter groups on maps:
  - `WorldMapInput.encounterGroups?`
  - `WorldMap.encounterGroups`
  - `createMap(...)` now sanitizes `encounterGroups` per map dimensions.
- Extended map editor model/serialization for encounter groups:
  - `EditableMap.encounterGroups`
  - JSON import/export + TS export include `encounterGroups`.
- Added backend encounter library persistence in `vite.config.ts`:
  - new table `encounter_libraries` (`owner_user_id`, `encounter_tables`, `updated_at`)
  - new endpoints:
    - `GET /api/admin/encounters/list`
    - `POST /api/admin/encounters/save`
  - bootstrap now returns `encounterTables` in `/api/content/bootstrap`.
  - save-time validation enforces encounter table uniqueness and total weight `=== 1.0`.
  - auto-seeding on first load: `starter-critter` table with Buddo (if present) else first critter at `weight: 1.0`.
- Added new Encounters admin tool:
  - `src/admin/EncounterTool.tsx`
  - full CRUD for encounter pools/tables.
  - critter search by name or id.
  - duplicate critter prevention per pool.
  - default add weight `0.00`.
  - save guard requiring each table weights sum to exactly `1.0`.
- Admin navigation updates:
  - `Encounters` moved from placeholder to active route in `src/admin/AdminView.tsx`.
- Map editor encounter-group authoring added (`src/admin/MapEditorTool.tsx`):
  - Encounter Tools panel with:
    - group select/new/remove,
    - `Set Encounter` apply button,
    - walk/fish encounter pool selectors (default None),
    - walk/fish frequency sliders (%),
    - non-empty tile selection workflow,
    - manual `Add Tile Index` (X/Y),
    - selected tile list and map-badge overlays.
  - map cell overlays/badges for encounter assignments.
- Runtime encounter logic added (`src/game/engine/runtime.ts`):
  - loads/sanitizes encounter tables from hydrated world content.
  - on completed walk step, checks map encounter group at player tile.
  - applies walk frequency chance and weighted critter sampling.
  - emits encounter message (`Encounter! <CritterName>`) and stores `lastEncounter` snapshot/text-state metadata.
- Map tool UX changes in `src/admin/MapEditorTool.tsx`:
  - grouped tool layout by functionality (selection/paint, tile edits, stamp orientation, NPC tools).
  - added persistent `Select` tool for non-destructive cell selection.
  - rotate/mirror tools are now active paint tools that transform an occupied clicked tile.
  - tool toggles now persist until explicitly toggled off (clicking selected tool returns to `Select`).
  - removed auto tool switching on unrelated actions (tile selection, tile generation, NPC template save, etc.).

Validation
- `npm run build` passed.
- Playwright smoke run executed:
  - command: `node scripts/web_game_playwright_client.js --url http://127.0.0.1:4176/admin.html --iterations 1 --pause-ms 250 --click 120,120 --screenshot-dir output/encounter-admin-map-smoke`
  - screenshot: `output/encounter-admin-map-smoke/shot-0.png`
  - errors log: `output/encounter-admin-map-smoke/errors-0.json` (`401 Unauthorized` expected because session was unauthenticated).

Follow-up suggestions
- Run an authenticated admin Playwright pass to visually verify Encounter Tool + map encounter-group panel interactions end-to-end.
- Add a quick in-game debug panel or scripted route for forced tile stepping to validate encounter frequency/weight behavior interactively.

## 2026-02-16 (Critter Ascension + Critter Tool UI cleanup)
- Added Ascension mission support through critter authoring and runtime display/evaluation.
- Critter mission model updates:
  - `src/game/critters/types.ts`: mission types now include `ascension`, with optional `ascendsFromCritterId`.
  - `src/game/critters/schema.ts`: mission sanitizer now preserves `ascendsFromCritterId` for ascension missions.
  - `vite.config.ts` parser now accepts/saves `ascension` mission type and `ascendsFromCritterId`.
- Runtime collection + mission logic updates:
  - `src/game/engine/runtime.ts`: mission snapshots now include `ascendsFromCritterId` + source name.
  - Added mission current-value resolver so ascension missions evaluate from the source critter's current level.
  - Completed mission counting now uses the resolved mission current value.
  - `src/game/engine/GameView.tsx`: collection mission labels now format ascension requirements as `Ascension: <source> Lv.<required>`.
- Refactored `src/admin/CritterTool.tsx`:
  - Added ascension mission authoring fields (`Type=Ascension`, `Ascends From Critter`, required level).
  - Added draft validation for ascension links (required source critter, no self-reference, known source ID).
  - Removed top-level `Remove` button from database toolbar.
  - Added compact critter database cards with tighter text and 2x2 stat display (HP/ATK/DEF/SPD).
  - Added per-critter `Remove` -> `Undo` toggle with pending-delete behavior.
  - Save now persists only non-pending critters; pending removals are committed only on save.
  - Reorganized editor UI into grouped sections (Basic Info, Base Stats, Collection Sprite, Abilities, Level Requirements).
- Styling updates in `src/styles.css`:
  - New critter admin layout sizing (`admin-layout--critter-tool`) and compact list/card styles.
  - Added grouped editor styling and mission-row layout.
  - Extended shared admin input styles to include `textarea`.

Validation
- `npm run build` passed.
- Playwright smoke run against `/admin.html`:
  - Command: `node scripts/web_game_playwright_client.js --url http://127.0.0.1:4176/admin.html --click 80,80 --iterations 2 --pause-ms 250 --screenshot-dir output/critter-ascension-admin`
  - Screenshot captured: `output/critter-ascension-admin/shot-0.png`
  - Console errors file: `output/critter-ascension-admin/errors-0.json`
  - Observed expected unauthenticated admin 401 resource error while signed out.

Follow-up suggestions
- Add an authenticated Playwright admin flow (sign in first) to verify the new critter list/editor interactions visually.
- Add explicit unit tests for ascension mission resolution to prevent regressions in completion logic.

## 2026-02-16 (Mission filters + unlock/level-up collection flow)
- Expanded critter mission model and parsing to support knockout filters and unlock-at-level-1 progression:
  - `src/game/critters/types.ts`:
    - `CritterLevelMissionRequirement` now supports `knockoutElements` and `knockoutCritterIds`.
    - Bumped `PLAYER_CRITTER_PROGRESS_VERSION` to 4.
  - `src/game/critters/schema.ts`:
    - Added sanitize support for knockout mission filters.
    - Enforced mutually-exclusive filter behavior at sanitize-time (`knockoutCritterIds` takes priority if both are present).
    - Updated progression semantics to support locked level `0`:
      - default collection entries now start at level `0` while locked,
      - player progress sanitize now clamps locked critters to level `0`,
      - derived stat calculation now supports level `0`.
    - Updated max configured level helper to align with level-row-as-target-level semantics.
  - `vite.config.ts` critter mission parser now accepts and normalizes:
    - `knockoutElements: string[]`
    - `knockoutCritterIds: number[]`

- Refined Critter Admin mission editor UX in `src/admin/CritterTool.tsx`:
  - Renamed mission type label from `Opposing Critter Knockouts` to `Knock-out Critters`.
  - Dynamic mission value labels:
    - knockout mission uses `Amount`,
    - ascension mission uses `Level` + required `Critter`.
  - Added knockout mission filter controls:
    - `Filter`: Any Critter / Element(s) / Critter(s),
    - multi-select inputs for elements or critters,
    - mutual exclusivity enforced in draft validation.
  - Added mission draft serialization/deserialization for new filter fields.

- Added in-game mission progression + unlock/level-up actions in `src/game/engine/runtime.ts`:
  - Added `tryAdvanceCritter(critterId)` runtime action:
    - unlocks locked critter (level 0 -> 1) when active requirement is complete,
    - levels unlocked critter (N -> N+1) when active requirement is complete,
    - recomputes stat bonuses/effective stats/unlocked abilities,
    - marks save dirty and emits user-facing message.
  - Added knockout progress tracking pipeline:
    - `recordOpposingKnockoutProgress(opposingCritterId)` increments mission progress keys for active knockout missions only,
    - supports `Any`, `Element(s)`, and `Critter(s)` mission filters,
    - keeps mission progress independent per mission key (`L<level>:M<id>`).
  - Hooked knockout progress tracking into encounter trigger flow (temporary combat-less progression path).
  - Added 5-second readiness notices:
    - `<Critter> can be Unlocked!` for level 0 -> 1 readiness,
    - `<Critter> can Level Up!` for standard progression readiness.

- Updated collection snapshot payload in runtime:
  - each critter now includes:
    - `level` (0 if locked),
    - `maxLevel`,
    - `canAdvance`,
    - `advanceActionLabel` (`Unlock`/`Level Up`),
    - full ability metadata with unlock state,
    - mission filter metadata (`knockoutElements`, `knockoutCritterIds`, `knockoutCritterNames`).

- Updated Collection UI in `src/game/engine/GameView.tsx`:
  - mission labels:
    - `Opposing Knockouts (Bloom, Ember)` / `Opposing Knockouts (Buddo)`
    - `Ascends from <Critter> at Level <Level>`
  - added per-critter green action button (`Unlock` / `Level Up`) when requirements are complete.
  - stats box now displays total stats by default; on hover for unlocked critters shows `<base> +/-<delta>`.
  - added `Abilities` box between `Stats` and `Missions` when abilities exist.
  - added top-right level path indicator `X/Y` where `X` is current level (0 locked) and `Y` is total max configured level.

- Collection/Critter styling updates in `src/styles.css`:
  - element logo sizing aligned with placeholder circle size,
  - removed oversized element-logo scaling,
  - removed boxed sprite frame container styling,
  - tightened stats/missions box density,
  - added styles for ability box and green advance button,
  - improved mission editor row alignment for new multi-select controls.

Validation
- `npm run build` passed.
- Playwright smoke runs:
  - Game route: `output/critter-missions-game-smoke/shot-0.png`, `shot-1.png`
  - Admin route: `output/critter-missions-admin-smoke/shot-0.png`
- Admin screenshot still shows expected signed-out 401 gate (`output/critter-missions-admin-smoke/errors-0.json`).
- Game route screenshot currently lands on sign-in screen in this environment, so signed-in collection interaction validation remains pending.

## 2026-02-16 (Global catalog refactor + admin role)
- Refactored backend data ownership so game content is global (shared across all players) while save/progress remains per-user.

### Auth / Roles
- Added `is_admin` support in auth/user model:
  - DB schema: `app_users.is_admin BOOLEAN NOT NULL DEFAULT FALSE`.
  - Added `ALTER TABLE ... ADD COLUMN IF NOT EXISTS is_admin` migration-safe step.
  - Signup now always creates users with `is_admin = FALSE` by default.
  - Login/session responses now include `user.isAdmin`.
- Frontend auth type updated:
  - `src/shared/authStorage.ts` `AuthUser` now includes `isAdmin: boolean`.
- Admin UI access gate updated:
  - `src/admin/AdminView.tsx` now requires signed-in session with `isAdmin === true`.
  - Blocked state text updated to explicit admin-access requirement.

### Global Catalog Tables
- Added global catalog tables in API schema setup (`vite.config.ts`):
  - `game_catalog_state`
  - `game_maps`
  - `game_tile_libraries`
  - `game_npc_libraries`
  - `game_player_sprite_configs`
  - `game_critter_catalog` (row-per-critter, keyed by `name`, unique `critter_id`)
  - `game_encounter_catalog` (row-per-encounter table, keyed by `table_id`)
- Legacy per-user content tables were preserved for compatibility/backfill (not dropped yet).

### Backfill / Migration Behavior
- Added `ensureGlobalCatalogBaseline()`:
  - Ensures schema exists.
  - Backfills empty global catalogs from existing per-user tables (latest data) once.
  - Seeds spawn map only when global map catalog is empty.
  - Writes global baseline version state.
- Critter backfill dedupes by both `name` and `id`.
- Encounter backfill dedupes by table id.

### API Read/Write Cutover
- `/api/content/bootstrap` now reads from global catalog tables (shared content).
- Admin endpoints now require admin auth (`requireAdminAuth`) and read/write global tables:
  - maps, tiles, npc libraries, player sprite config, critters, encounters.
- Added helper methods in API plugin for global catalog IO:
  - `readGlobalCritterCatalog` / `writeGlobalCritterCatalog`
  - `readGlobalEncounterCatalog` / `writeGlobalEncounterCatalog`
- Critter admin save now enforces unique IDs and unique names (`strictUniqueNames`).

Validation
- `npm run build` passed.
- Playwright smoke:
  - game: `output/global-catalog-game-smoke/shot-0.png`, `shot-1.png`
  - admin: `output/global-catalog-admin-smoke/shot-0.png`
  - admin expected 401 while signed out: `output/global-catalog-admin-smoke/errors-0.json`
- Verified admin route now displays explicit admin access requirement in signed-out/unauthorized state.

Follow-up suggestions
- Add a small owner-only SQL admin bootstrap script (or API tool) to set one account `is_admin = true` quickly after signup.
- After production verification, remove legacy per-user catalog tables and migration fallback logic.

## 2026-02-16 (Legacy table cleanup + route verification)
- Completed global-catalog migration hardening in `vite.config.ts`:
  - Added one-time `migrateLegacyCatalogData(...)` that backfills global tables from legacy tables only when needed.
  - Added `dropLegacyCatalogTables(...)` and now drops:
    - `world_maps`
    - `user_world_state`
    - `tile_libraries`
    - `npc_libraries`
    - `player_sprite_configs`
    - `critter_libraries`
    - `encounter_libraries`
  - `ensureSchema()` now runs migration + legacy table drop in a transaction before setting schema ready.
- Removed legacy reads from `ensureGlobalCatalogBaseline()`.
  - Baseline now only ensures global defaults (`game_maps`, `game_catalog_state`, singleton rows for tile/npc/player sprite catalogs).
- Fixed remaining old admin response label:
  - tiles save fallback now reports `database:game_tile_libraries` (removed `database:tile_libraries`).

Verification
- `npm run build` passed.
- Code-level SQL target audit confirms:
  - game/admin runtime reads and writes target `game_*` catalog tables.
  - legacy table names appear only inside one-time migration reads.
- User confirmed old tables are already gone in DB.

## 2026-02-16 (Autosave progression + squad picker + card info button)
- Implemented immediate autosave for player progression changes in runtime:
  - Added `markProgressDirty()` in `src/game/engine/runtime.ts` to mark dirty + persist immediately.
  - Progress events now call immediate save:
    - critter unlock/level up (`tryAdvanceCritter`),
    - story/dialogue flag completion (`advanceDialogue` setFlag),
    - mission progress increments (`recordOpposingKnockoutProgress`).
- Added squad assignment runtime API:
  - `assignCritterToSquadSlot(slotIndex, critterId)` in `src/game/engine/runtime.ts`.
  - Enforces slot bounds/unlocked/empty and critter unlocked checks.
  - Prevents duplicate squad entries by removing an existing placement before assigning.
  - Triggers immediate persistence and toast message on success.

- Added Squad customization UI in `src/game/engine/GameView.tsx`:
  - Squad view now supports selecting an empty unlocked slot to open a left-side picker popup.
  - Popup includes:
    - top-row search input (`name`/`ID` filtering),
    - `X` close button,
    - unlocked critter cards rendered with the same card component as collection.
  - Clicking a critter card assigns it to the selected slot and updates snapshot (persist handled in runtime).
  - Filled squad slots now render full critter cards (not just text labels).

- Refactored collection/squad cards to shared card renderer in `GameView`:
  - Added `CritterCard` component used by Collection, Squad slots, and Squad popup.
  - Removed hover-based stat breakdown behavior.
  - Added top-right `i` circle toggle button to switch stats between:
    - total stat view,
    - `<base>+<delta>` breakdown view.
  - Moved level path display to under sprite and above Stats (`X/Y`).

- Updated styling in `src/styles.css` for:
  - squad panel layout + left popup,
  - squad slot selected/empty states,
  - info toggle button,
  - inline level-path position,
  - selectable card state,
  - responsive squad/popup grid behavior.

Validation
- `npm run build` passed.
- Playwright smoke run executed:
  - `output/squad-autosave-smoke/shot-0.png`
  - `output/squad-autosave-smoke/shot-1.png`
- Smoke environment remained on sign-in screen, so authenticated in-game squad/collection interaction testing is still pending.
- Updated critter level display in game cards (collection + squad + squad picker):
  - Replaced plain `X/Y` text with a pill-shaped progress bar labeled `Level X/Y`.
  - Fill amount now reflects current level progress toward max level.
  - Fill color behavior:
    - blue while below max,
    - dark blood red at max level.
- Files:
  - `src/game/engine/GameView.tsx`
  - `src/styles.css`
- Validation: `npm run build` passed.
- Fixed critter level pill rendering issue:
  - removed duplicate bar render and kept only the bar under the sprite.
  - moved level fill CSS variables directly onto the progress bar element (instead of inheriting from card).
  - switched level fill colors to opaque values so max-level and in-progress states read as fully filled, not outline-only.
- Validation: `npm run build` passed.
- Squad UX update:
  - Left-click any unlocked squad slot (empty or occupied) now opens the critter picker popup.
  - Right-click an occupied unlocked slot now removes that critter from squad.
  - Unlocked squad slot hover now shows a stronger green glow.
  - In picker popup, critters already in squad are greyed out and unclickable.
- Runtime:
  - Added `clearSquadSlot(slotIndex)` in `src/game/engine/runtime.ts` with immediate persistence.
  - `assignCritterToSquadSlot(...)` now rejects selecting critters that are already in squad.
- Validation: `npm run build` passed.

## 2026-02-16
- Save profile schema refactor in progress completed for runtime compatibility:
  - Added structured `progressTracking` on save data with separate `mainStory` and `sideStory` sections.
  - Added migration support in `saveManager` to map legacy top-level `flags` into `progressTracking.mainStory.flags`.
  - Bumped save version to `6` and updated runtime persistence/migration checks accordingly.
- Updated top-left transient location/message popup rendering in `GameRuntime.render(...)` so the background box width now auto-sizes to the displayed text length (instead of fixed width).
- Validation: `npm run build` passed.

## 2026-02-16 (Encounter selection scope + new-group draft fix + responsive scaling pass)
- Map editor encounter-selection flow updated in `src/admin/MapEditorTool.tsx`:
  - Added a dedicated tool mode: `encounter-select`.
  - Encounter cell selection/removal is now handled only when `encounter-select` is active.
  - The regular paint `Select` tool no longer edits encounter tile selection.
  - Encounter panel `Select Cells` now toggles `encounter-select`.
- Fixed "New Encounter Group gets stuck" behavior:
  - Adjusted encounter-group auto-selection effect to preserve explicit draft mode (`selectedEncounterGroupId === ''`).
  - `New Encounter Group` now enters draft mode cleanly and keeps it active.
  - Encounter group dropdown selecting `Draft New Group` now calls draft reset behavior.
- Encounter UX refinement:
  - Entering draft mode now auto-switches tool to `encounter-select`.
  - Encounter selection helper copy updated to reference `Encounter Tools > Select Cells`.

- Responsive layout cleanup in `src/styles.css` for game/admin scaling:
  - Collection grid now uses adaptive `auto-fit` columns instead of fixed 4-column layout.
  - Collection cards now enforce overflow containment and `min-width: 0` behavior to prevent content spill.
  - Mission/ability row text now truncates safely to avoid stat/label overflow outside cards.
  - Admin layouts switched to more flexible minmax sizing and collapse to single-column at <=1280px.
  - Admin map workspace + 2-column form grids now use adaptive sizing for smaller windows.
  - Collection side menu padding now scales via `clamp(...)`.

Validation
- `npm run build` passed.
- Playwright smoke against `/admin.html` executed (`output/encounter-ui-responsive-admin/shot-0.png`) but remained blocked at session validation due unauthorized state (`errors-0.json` shows 401), so authenticated admin/game interaction validation is still pending in this environment.

Follow-up suggestion
- Re-run Playwright checks while signed in (game + admin) to visually verify:
  - encounter draft flow end-to-end,
  - collection card spacing on small-window breakpoints,
  - admin panel behavior around 1280px and below.

## 2026-02-16 (Collection grid adaptive columns + row-height behavior)
- Updated collection grid behavior in `src/game/engine/GameView.tsx` and `src/styles.css`.
- Collection cards are now rendered as a direct filtered list (removed padding/placeholder card alignment logic).
- Grid columns now adapt by window width while defaulting to 4 columns:
  - default: 4 columns
  - <= 1400px: 3 columns
  - <= 1040px: 2 columns
  - <= 680px: 1 column
- Row height behavior now follows CSS grid auto-row sizing with card stretch:
  - each row expands to match the tallest card in that row.
- Validation: `npm run build` passed.

## 2026-02-16 (Collection card proportions + details panel widths)
- Updated collection-page card sizing in `src/styles.css` to be narrower and taller by default:
  - Added scoped rule for `.collection-grid .collection-card` with `width: min(100%, 220px)` and `min-height: 23rem`.
- Adjusted collection-page detail panel sizing to sit just wider than the progress bar:
  - `.collection-grid .collection-card__level-progress` set to `width: min(78%, 170px)`.
  - `.collection-grid .collection-card__stats`, `.collection-card__missions`, `.collection-card__abilities` set to `width: min(84%, 186px)` and centered.
- Validation: `npm run build` passed.

## 2026-02-16 (Collection card internal scaling + tighter content organization)
- Reworked collection-card internals in `src/styles.css` with collection-scoped container sizing (`container-type: inline-size`) so content scales with card size.
- Top section improvements:
  - Header spacing/min-height scales with card width.
  - ID/name typography scales up; name supports two-line clamp for longer names.
  - Element icon and info button scale with card size.
- Middle section improvements:
  - Sprite and fallback box now scale with card/container size (`clamp(..., cqw, ...)`).
  - Progress bar width/height and label font now scale with card/container size.
- Bottom section improvements:
  - Stats/Missions/Abilities boxes remain slightly wider than the progress bar and centered.
  - Tightened inner spacing (heading margins, list gaps, mission row padding, summary spacing) so panels hug content more closely.
- Validation: `npm run build` passed.

## 2026-02-16
- Implemented numeric layer-ID ordering across runtime, map parser, admin editor, and map save pipeline:
  - Layer IDs now normalize to positive integers (Base defaults to `1`).
  - Layer rendering/composition order now follows ID order (higher ID renders above lower ID).
  - Admin map layer controls now use numeric IDs and keep layers sorted by ID.
- Added per-tile actor Y-sort control for custom tiles:
  - New tile definition field: `ySortWithActors?: boolean`.
  - Admin saved paint tiles now include a `Y-Sort With Actors` toggle and persist this metadata.
  - Server-side custom tile generation and runtime saved-tile hydration now preserve this metadata.
- Updated runtime overhead sorting behavior:
  - Default behavior still supports overhead rendering on higher layers.
  - Added flat-ground keyword fallback (e.g. grass/path/floor/sand/water) so tall-grass style tiles do not automatically occlude the player when no explicit override is set.
- Build/test validation:
  - `npm run build` passes.
  - Ran Playwright client capture to `output/layer-order-check`.
  - Gameplay traversal validation was blocked by auth-gated start screen (automation landed on Sign In screen, so in-world grass overlap could not be directly replayed in that run).

### Follow-up
- If needed, log into a local test account during Playwright runs (or provide a non-auth dev bypass) to fully automate in-map render-order validation scenarios.

## 2026-02-16 (Encounter-to-battle screen implementation)
- Replaced walk-encounter popup flow with a battle pipeline in `src/game/engine/runtime.ts`:
  - Wild grass encounters now start a real battle instead of calling transient corner popup text.
  - Added battle state machine with phases: `transition`, `choose-starter`, `player-turn`, `choose-swap`, `result`.
  - Added 3 random transition effects (`scanline`, `radial-burst`, `shutter-slice`) selected per encounter.
  - Added turn simulation actions: `Attack`, `Guard`, `Swap`, `Retreat` (retreat currently wild-only).
  - Added active HP/damage/faint handling and post-faint forced swap logic.
  - Moved opposing knockout mission progression to actual battle knockouts (instead of triggering immediately on encounter start).
  - Added reusable battle snapshot model intended to support future NPC battle sources.
- Updated `src/game/engine/GameView.tsx`:
  - Added full battle overlay UI and transition view.
  - Added starter selection from squad before first action.
  - Added action buttons and swap picker flow with back/cancel for optional swaps.
  - Added active critter cards with sprite, level, HP bar, and core stats.
  - Battle-active input gating now prevents opening side menu during battle.
- Updated `src/styles.css` with battle-specific styling:
  - Battle screen layout, active critter panels, HP bars, action panel, squad picker, and transition animations.
  - Responsive behavior for smaller viewports.

Validation
- `npm run build` passed.
- Playwright smoke run executed with `node scripts/web_game_playwright_client.js` against local Vite dev server.
- Smoke capture output: `output/encounter-battle-smoke/shot-0.png`.
- In-world battle traversal remained blocked in this environment by auth-gated sign-in screen, so runtime battle interactions could not be end-to-end replayed via automation here.

Follow-up suggestion
- Run the same Playwright burst while authenticated (or with a local dev auth bypass) and script movement into `portlock-trail` grass to capture:
  - transition effect variety,
  - starter selection interaction,
  - attack/swap turn flow,
  - win/loss result states.

## 2026-02-16 (Battle UX pass: side positioning, sequential turn text, attack animation)
- Updated battle layout and interaction flow for readability and turn clarity.

Runtime updates (`src/game/engine/runtime.ts`)
- Added narration queue + explicit progression controls for battle turns:
  - New battle runtime fields for queued narration events, active narration, and active attack animation state.
  - Added `battleAdvanceNarration()` public API to step one narration event at a time.
- Battle actions now gate on narration state:
  - Attack/Guard/Swap/Retreat are disabled while narration is active.
  - Swap selection/cancel also blocked during active narration.
- Turn resolution now emits one narration event per move in order:
  - If faster critter acts first, first narration describes that attack; the second move appears only after `Next`.
  - Guard now emits its own narration event before the opposing attack narration.
- Attack text now uses trainer-context phrasing:
  - Wild example: `Your <critter> attacked the wild <critter> and dealt X damage.`
  - NPC-ready phrasing uses `<source label>'s <critter>` for opposing trainer teams.
- Added lightweight attack animation signaling in battle snapshot (`activeAnimation`) and `canAdvanceNarration` state.

UI updates (`src/game/engine/GameView.tsx`)
- Reordered battle field panels:
  - Player critter now renders on the left.
  - Opponent critter now renders on the right.
- Added `Next` button flow:
  - Appears when narration is active (`canAdvanceNarration`).
  - Advances to the next move message/event.
- Action buttons and swap picker now hide while narration is active so move order is explicit.
- Continue-after-result button now appears only when narration queue is fully advanced.
- Hooked animation snapshot state into critter panel rendering.

Style updates (`src/styles.css`)
- Increased player/opponent card border thickness and saturation:
  - stronger green and red outline treatment for active battle boxes.
- Added player sprite horizontal flip (`scaleX(-1)`) for left-side orientation.
- Added attack lunge animations:
  - player sprite nudges right then returns,
  - opponent sprite nudges left then returns,
  - triggered from runtime attack animation state.

Validation
- `npm run build` passed.
- Playwright smoke run executed to `output/encounter-battle-sequencing/shot-0.png`.
- Automated in-world encounter traversal remains blocked in this environment by auth-gated sign-in, so message sequencing was validated through code path/build rather than a full live grass encounter replay.
- Follow-up polish: knockout narration now explicitly includes battle outcome text (`You won the battle.` / `You blacked out.`) in queued turn narration.
- Revalidated with `npm run build` (pass).

## 2026-02-16 (Tiles rendering fallback fix)
- Investigated regression where map tiles rendered only color fallback.
- Root cause handled in runtime: if a saved tileset URL is invalid/unloadable (common with stale `blob:` URLs), atlas loading failed and never retried a valid fallback.
- Runtime fix in `src/game/engine/runtime.ts`:
  - Added resilient tileset candidate loading (`custom config` first, then bundled `CUSTOM_TILESET_CONFIG`).
  - Added `activeTilesetConfig` so draw uses the config that actually loaded.
  - Added sequential load attempts with fallback on image load error/invalid dimensions.
- Storage sanitization fix in `src/game/content/worldContentStore.ts`:
  - `sanitizeCustomTilesetConfig` now rejects `blob:` URLs for persisted runtime config.
- Validation:
  - `npm run build` passed.
  - Playwright smoke capture saved to `output/tileset-fallback-fix/shot-0.png`; environment remained auth-gated at sign-in screen, so in-map visual confirmation still requires an authenticated run.

## 2026-02-16 (Encounter level-range support)
- Added per-entry encounter level range fields across the encounter model:
  - `src/game/encounters/types.ts`: `EncounterTableEntry` now supports optional `minLevel` / `maxLevel`.
  - `src/game/encounters/schema.ts`: encounter table sanitization now parses and normalizes level ranges (swap if min > max, clamp 1-99, allow null/auto).
- Updated runtime wild encounter generation (`src/game/engine/runtime.ts`):
  - Encounter roll now samples a full table entry (not just critter ID) so range metadata is available.
  - Wild level selection now prefers the selected entry's range and samples only from that critter's implemented levels within Min/Max.
  - If no valid implemented level exists in the configured range, runtime falls back to the prior auto-level logic.
  - `lastEncounter` snapshot now records encountered level.
- Updated encounter admin editor (`src/admin/EncounterTool.tsx`):
  - Added `Min Lv` / `Max Lv` inputs per table entry.
  - Draft parser now validates and persists optional level-range fields.
  - Added note clarifying that blank values keep automatic scaling.
- Updated backend encounter catalog parsing (`vite.config.ts`):
  - `/api/admin/encounters/save` / list/bootstrap parsing now accepts, normalizes, and round-trips entry level ranges.

Validation
- `npm run build` passed.
- Playwright smoke run executed via `node scripts/web_game_playwright_client.js` with output `output/web-game-encounter-level-range/shot-0.png`.
- No Playwright `errors-0.json` was produced.
- This environment remained auth-gated at sign-in, so gameplay-state JSON (`state-0.json`) and live grass encounter traversal were not available in this run.

Follow-up suggestion
- In admin Encounter Tables, set table entries (for example Moolnir in `first`) to `Min Lv = 1`, `Max Lv = 3`, save, then run an authenticated in-map encounter pass to verify observed wild levels match the configured range.
- Follow-up fix: corrected encounter-range sampling to use an integer index when selecting from implemented levels.
- Revalidated after fix:
  - `npm run build` passed.
  - Re-ran Playwright smoke capture to `output/web-game-encounter-level-range/shot-0.png` with no `errors-0.json` output.

## 2026-02-16 (Encounter admin layout refresh: compact entries + critter card grid)
- Updated `/src/admin/EncounterTool.tsx` UI behavior and layout for encounter pool editing:
  - Current encounter entries now render as compact cards in a responsive grid (instead of full-width rows).
  - Current entry cards now show only: critter name/ID, weight field, min level field, max level field, and remove button.
  - Added selected-critter filtering so critters already in the current draft table are hidden from the addable critter list.
  - Replaced addable critter button list with a searchable, scrollable grid of collection-style critter cards.
  - Addable critter cards include sprite/stat summary and `Add To Table` action.
- Added scoped styling in `/src/styles.css`:
  - New classes for compact encounter entry grid/cards and tighter form controls.
  - New scrollable addable critter card grid tuned for admin layout while preserving collection-card visual language.
  - Responsive adjustments for mobile breakpoints.

Validation
- `npm run build` passed.
- Playwright smoke run executed for admin page:
  - command: `node scripts/web_game_playwright_client.js --url http://127.0.0.1:5173/admin.html ...`
  - output: `output/encounter-admin-grid-ui/shot-0.png`
  - no `errors-0.json` generated.
- Environment remained auth/session-gated (`Checking Session`) during screenshot capture, so the encounter module UI requires authenticated run for end-to-end visual confirmation in this environment.
- Encounter admin candidate-card cleanup pass:
  - Replaced dense reused collection-card styling with dedicated encounter candidate card layout in `src/admin/EncounterTool.tsx` + `src/styles.css`.
  - Cards now prioritize key info only (element badge, id/name/rarity, sprite, level range, base stats, add action) with larger spacing and footprint.
  - Added explicit element badge labels (`BL/EM/TI/GU/ST/SP/SH`) for visibility.
  - Add-to-table defaults updated: `Min Lv` now `1` and `Max Lv` now the critter's highest implemented level.
- Validation:
  - `npm run build` passed.
  - Playwright admin smoke output: `output/encounter-admin-card-cleanup/shot-0.png`.
  - Console artifact showed `401 Unauthorized` while unauthenticated on admin route (`output/encounter-admin-card-cleanup/errors-0.json`); environment is admin-auth-gated so module-level visual confirmation still requires signed-in admin session.

## 2026-02-16 (Knockout mission progression fix)
- Updated knockout mission progression handling in `src/game/engine/runtime.ts`:
  - `recordOpposingKnockoutProgress` now increments only on confirmed opponent knockout events (existing call-site retained in battle knockout path) and clamps mission increments to mission target values.
  - Added challenge tracking sync for knockout level-up missions via new helper `syncKnockoutChallengeProgress(...)`:
    - writes side-story mission tracking entries keyed as `critter-<id>-level-<level>-mission-<missionId>`.
    - stores normalized `progress`, `target`, `completed`, and `updatedAt` values.
  - Uses one shared timestamp per knockout event for coherent mission/challenge updates.
- Outcome: mission progress is now knockout-driven and challenge tracking is persisted consistently instead of drifting beyond target.

Validation
- `npm run build` passed.
- Playwright smoke run executed: `output/knockout-mission-progress-fix/shot-0.png`.
- No `errors-0.json` emitted.
- Environment remained auth-gated at sign-in screen during smoke run; live combat knockout replay still requires authenticated session.

## 2026-02-16 (Critter knockout mission criteria picker crash + UX fix)
- Updated critter mission editor UI in `src/admin/CritterTool.tsx` for `opposing_knockouts` filters:
  - Replaced multi-select element picker with explicit toggle chips for each element.
  - Replaced multi-select critter picker with a searchable, scrollable toggle-pill list of critters.
  - This removes dependency on multi-select selectedOptions handling in this flow.
- Added robust token toggling helper (`toggleTokenInList`) to keep selected criteria arrays unique and stable.
- Added mission criteria picker styling in `src/styles.css` (`critter-mission-filter-*` and `critter-mission-critter-*` classes) for clearer interaction and readability.

Validation
- `npm run build` passed.
- Playwright admin smoke run executed: `output/critter-mission-filter-ui-fix/shot-0.png`.
- Run emitted expected auth-gated console error (`401 Unauthorized`) at admin route in this environment (`output/critter-mission-filter-ui-fix/errors-0.json`), so in-editor runtime interaction still requires authenticated admin session for direct reproduction.

## 2026-02-16 (First unlock auto-squad + minimum squad membership)
- Updated squad invariants in `src/game/engine/runtime.ts`:
  - On runtime load, `ensureMinimumSquadCritterAssignment()` now auto-repairs save data so players with unlocked critters always have at least one assigned squad critter.
  - On first critter unlock via `tryAdvanceCritter(...)`, `tryAutoAssignFirstUnlockedCritter(...)` now auto-places that first unlocked critter into squad slot 1 (index 0) when squad is otherwise empty.
  - `clearSquadSlot(...)` now blocks removing the last assigned squad critter when the player has unlocked critters, and shows `Your squad must keep at least one critter.`.
  - Unlock toast text now reflects auto-assignment (`<Critter> unlocked and joined your squad!`) when applicable.

Validation
- `npm run build` passed.
- Playwright smoke run executed: `output/squad-minimum-enforcement/shot-0.png`.
- Smoke screenshot remained auth-gated on sign-in screen in this environment, so live in-game squad interaction still requires authenticated playthrough verification.

## 2026-02-16 (Last-squad removal feedback UX)
- Updated squad removal feedback in `src/game/engine/GameView.tsx`:
  - When a remove attempt is blocked because it would leave the player with zero squad critters, the affected slot now enters a short shake state.
  - Added a slot-local popup message for 2 seconds: `You need at least 1 Critter!`.
  - Repeated blocked attempts re-trigger shake animation using alternating keyframes.
- Added matching visual styles in `src/styles.css`:
  - `squad-slot` removal-blocked animation class and keyframes.
  - centered inline popup styling (`.squad-slot__blocked-popup`) layered over the slot content.

Validation
- `npm run build` passed.
- Playwright smoke run executed: `output/squad-last-critter-popup/shot-0.png`.
- Environment remained auth-gated at sign-in screen during smoke run, so in-game right-click squad interaction still requires authenticated session verification.

## 2026-02-16 (Squad HP bar + persistent battle damage + healthy-only squad swaps)
- Updated critter progress model to track persistent HP in `src/game/critters/types.ts` and `src/game/critters/schema.ts`:
  - Added `currentHp` to each `PlayerCritterCollectionEntry`.
  - Sanitization now migrates legacy saves by defaulting unlocked critters to full HP when `currentHp` is missing.
- Updated battle persistence and squad constraints in `src/game/engine/runtime.ts`:
  - Player battle team now initializes from saved `currentHp` instead of always full HP.
  - Battles now sync player team HP back to saved critter progress on battle result (win/loss/escape), so damage carries into later battles.
  - `retreat` now uses shared battle-result path so escape also persists damage.
  - Squad remove/replace now blocks when the slotted critter is not at full HP, with message `Only fully healthy critters can leave the squad.`.
  - Squad slot snapshot now includes `currentHp` and `maxHp`.
  - Unlock/level-up flow now maintains HP coherently:
    - first unlock starts at full HP,
    - later level-ups clamp existing HP to new max.
- Updated squad card UI in `src/game/engine/GameView.tsx` + `src/styles.css`:
  - Squad critter cards now show an HP progress bar (styled similarly to level progress) with `HP current/max`.
  - HP bar color shifts by health tier (healthy / warning / critical).
  - Last-slot shake popup now triggers only for the minimum-squad rule, not when removal is blocked due to missing HP.

Validation
- `npm run build` passed.
- Playwright smoke run executed: `output/squad-health-persistence/shot-0.png`.
- Environment remained auth-gated at sign-in screen during smoke run, so live in-game battle/squad interaction verification still requires authenticated playthrough.

## 2026-02-16 (Maintenance script: heal all user squads)
- Added one-off DB maintenance script: `scripts/heal_all_user_squads.js`.
  - Reads all rows from `user_saves`.
  - Finds critters currently assigned in each user's squad.
  - Sets those critters' `currentHp` to full (`effectiveStats.hp`) in `save_data.playerCritterProgress.collection`.
  - Updates `lastProgressAt` for healed entries.
  - Supports dry-run by default and `--apply` for persistence.
  - Supports optional `--user-id <id>` targeting.

Validation
- `node scripts/heal_all_user_squads.js --help` passed.
- Script now resolves `DB_CONNECTION_STRING` from `.env` when not present in process env.
- 2026-02-17 story-mode phase 1 (critter mission foundation):
  - Added new critter mission type `story_flag` in `src/game/critters/types.ts`.
  - Extended mission payload shape with optional `storyFlagId` and `label` fields.
  - Updated critter schema sanitizer (`src/game/critters/schema.ts`):
    - parses/sanitizes `story_flag` mission metadata,
    - enforces `targetValue=1` for `story_flag` missions,
    - mission evaluation now supports story flags through runtime integration,
    - added Buddo default mission transform so Buddo level 1 mission is forced to:
      - type: `story_flag`
      - storyFlagId: `selected-bloom-starter`
      - label: `Select Bloom Partner Critter`
  - Updated runtime mission evaluation in `src/game/engine/runtime.ts`:
    - `getMissionCurrentValue` now resolves `story_flag` by `mainStory.flags[storyFlagId]`.
    - runtime critter mission snapshot payload now includes `storyFlagId` + `label`.
  - Updated critter card mission text renderer in `src/game/engine/GameView.tsx`:
    - `story_flag` displays custom label first, then fallback story flag label.
  - Updated Critter Admin mission authoring (`src/admin/CritterTool.tsx`):
    - mission type selector now supports `Story Flag`,
    - added Story Flag ID + Mission Label inputs,
    - draft/save/load/validation paths now persist and validate these fields.
  - Updated backend critter parser (`vite.config.ts`) for `story_flag` support and mirrored Buddo mission normalization.
- Validation:
  - `npm run build` passed.
- 2026-02-17 story-mode phase 2 (NPC story-state behavior model):
  - Added story-state support to NPC core types (`src/game/world/types.ts`):
    - `NpcStoryStateDefinition` with flag gate + map/position/facing/dialogue/battle/movement/animation overrides.
    - `NpcDefinition` now supports optional `facing` and ordered `storyStates`.
  - Extended NPC character template model (`src/game/world/npcCatalog.ts`) with `facing` and `storyStates`.
  - Extended map editor NPC template workflow (`src/admin/MapEditorTool.tsx`):
    - character form now includes facing selector,
    - added `Story States JSON` editor (ordered timeline states),
    - added JSON parse/sanitize helpers for story states,
    - template save/load now persists/restores story states,
    - NPC painting from template now writes `facing` + `storyStates` into map NPC instances.
  - Extended map editor clone/snapshot behavior (`src/admin/mapEditorUtils.ts`) to deep-clone NPC `facing` + `storyStates` payloads.
  - Runtime story-state resolution implemented (`src/game/engine/runtime.ts`):
    - NPCs are now resolved dynamically from all maps each frame using ordered story states,
    - most-recent matching state wins for map/position and other overrides,
    - map rendering/interaction/movement now uses resolved NPC set per current map,
    - NPC runtime state keys are now stable per character (`sourceMapId:npcId`) so map relocation works cleanly.
- Validation:
  - `npm run build` passed.

## 2026-02-17 (Story Mode + Critter Story Flag)
- Continued implementation for story progression tooling and starter demo sequence.
- Fixed compile issue in runtime by importing `isInsideMap` from mapBuilder.
- Added and validated `story_flag` mission support end-to-end:
  - mission type support in runtime mission progress, card labeling, and admin mission editor.
  - Buddo level 1 mission normalized to story flag:
    - `storyFlagId: selected-bloom-starter`
    - `label: Select Bloom Partner Critter`
- Added NPC story-state behavior infrastructure for map/location/dialogue/movement/battle overrides by flags, with last matching state winning.
- Added default story NPC bootstrapping and story cutscene flow:
  - Uncle Hank starter prompt and selection overlay.
  - starter confirmation dialogue + flag unlocks (`selected-starter-critter`, `selected-<element>-starter`).
  - first critter unlock auto-assign to squad.
  - `starter-selection-done` -> Jacob entrance + duel trigger.
  - Jacob duel completion -> `demo-done`, post-duel dialogue, Jacob exit, and portlock wandering relocation.
- Added starter selection UI overlay with hover prompt and confirm Yes/No panel.
- Extended map editor/NPC template tooling for story-state JSON authoring and facing/story persistence.

### Story-mode Playwright automation
- Added script: `scripts/story_mode_playwright.js`
  - Logs in with configured test account.
  - Resets save for deterministic run.
  - Executes starter story flow through Jacob duel and post-duel relocation.
  - Captures high-frequency screenshots and `render_game_to_text` snapshots at each phase.
  - Writes run status + checks into `status.json`.
- Successful full run output:
  - `output/story-mode/run-20260217-133032/`
  - `status.json` shows:
    - login success
    - selected starter flags set
    - `starter-selection-done` set
    - `demo-done` set
    - `jacob-left-house` set
    - Jacob seen in Portlock
  - 32 screenshots + matching JSON state snapshots captured across sequence.

### Validation
- `npm run build` passes.
- Playwright run completed with no console/page errors in successful run (`status.ok: true`).

### Follow-up suggestions
- If you want three visible starter cards in every fresh environment, ensure the `starter-critter` encounter table contains three entries (current successful run had one starter option due active encounter catalog content).
- Consider exposing a small in-game debug overlay toggle for current story flags and cutscene phase while authoring future storylines.

## 2026-02-17 (Story Mode Follow-up Fixes)
- Implemented requested story-sequence behavior refinements in `src/game/engine/runtime.ts`:
  - Removed auto-triggered Uncle Hank dialogue on entering `uncle-s-house`; intro now starts only when interacting with Hank.
  - Added `demo-start` flag assignment when first talking to Uncle Hank during starter pickup.
  - Added movement leash while `demo-start` is set and `demo-done` is not set: player cannot move beyond Manhattan distance 6 from Hank; blocked movement shows Hank dialogue: `Don't leave yet! Unlock your Partner Critter first!`.
  - Kept player input locked during Jacob cutscene phases and until Jacob exit completes.
  - Moved `demo-done` unlock to Jacob exit completion (instead of immediately after battle result).
  - Added story NPC upsert/dedup logic to prevent duplicate Uncle Hank/Jacob entries from mixed map data.
  - Corrected story NPC sprite sizing config so Uncle Hank renders as one NPC instance at proper 2-tile visual scale (`frameCellsTall: 1`, `renderHeightTiles: 2`).
  - Reworked Jacob intro/exit cutscene routing to obstacle-aware BFS (`buildNpcPath`) so Jacob can reliably run from the door to the player’s location instead of failing on doorway/wall geometry.
- Enhanced Playwright coverage in `scripts/story_mode_playwright.js`:
  - Added explicit leash guard verification snapshot/assertion.
  - Added unlock-from-offset position flow (not directly in front of Hank) to validate Jacob reaching the player from arbitrary in-house positions.
  - Added checks for player freeze after closing Collection (`playerFrozenAfterCollectionClose`) and Jacob arrival near player before battle (`jacobReachedPlayerPosition`).
  - Hardened post-demo exit routine with multiple door alignment attempts so return warp to `portlock` is reliable in automation.
- Validation performed:
  - `npm run build` passed after runtime updates.
  - Story mode Playwright run passed with all checks true:
    - `output/story-mode/run-20260217-142152/status.json` (`ok: true`)
    - Includes full screenshot/state sequence under `output/story-mode/run-20260217-142152/`.

### Remaining TODOs / Suggestions
- Consider replacing the simple `moveTo` helper in Playwright with a tile-aware pathfinder to reduce retries around one-way/collision-edge door tiles.
- If needed later, expose sprite render metadata in `render_game_to_text` NPC snapshots to make automated render-size assertions explicit (instead of screenshot-only verification).

## 2026-02-17 (NPC Movement + Admin Separation)
- Updated demo leash behavior in runtime to a **vertical-only boundary** of 6 tiles from Uncle Hank (horizontal boundary line behavior), instead of Manhattan-radius leash.
- Extended NPC movement model in `src/game/world/types.ts`:
  - New canonical types: `static`, `static-turning`, `wander`, `path`.
  - Legacy compatibility retained for `loop`/`random` reads.
  - Added movement options: `pathMode` (`loop` or `pingpong`) and `leashRadius` (wander-only optional leash).
- Runtime NPC behavior updates in `src/game/engine/runtime.ts`:
  - `static` now remains fixed facing (no random turning).
  - `static-turning` rotates through configured direction pattern over interval.
  - `wander` moves randomly with optional leash from NPC anchor/start position.
  - `path` supports loop and back-and-forth (`pingpong`) path traversal.
  - Added movement-type normalization so old `random`/`loop` data still works.
  - Interaction-facing behavior preserved and tightened: NPC now explicitly faces player on dialogue start.
- Admin tool separation implemented in `src/admin/AdminView.tsx` + `src/admin/MapEditorTool.tsx`:
  - Added dedicated routes/tabs:
    - `/admin/npc-sprites` (NPC Sprite Studio)
    - `/admin/npc-characters` (NPC Character Studio)
    - existing `/admin/npcs` retained as combined NPC Studio.
  - `MapEditorTool` section support expanded to `npc-sprites` and `npc-characters`.
  - NPC panel now conditionally renders sprite editor and character editor independently by section.
- NPC Character behavior UI expanded in `src/admin/MapEditorTool.tsx`:
  - Movement options now: Static / Static Turning / Wander / Path.
  - Added Path Mode selector (`Loop` / `Back and Forth`).
  - Added Wander Leash Radius input.
  - Pattern input now shown contextually for `path` and `static-turning`.
  - Story-state placeholder updated to use canonical `wander` movement shape.
  - Save/load character template paths map legacy movement types into canonical editor values.
  - Movement sanitizer upgraded to canonicalize old movement data and persist new fields safely.

Validation
- `npm run build` passed.
- Story sequence regression run passed after runtime changes:
  - `output/story-mode/run-20260217-144049/status.json` (`ok: true`)
  - confirms starter flow, leash guard trigger, Jacob duel/exit, and post-demo Jacob in portlock.
- 2026-02-17 jacob sprite refresh fix:
  - Updated story NPC upsert merge logic in `runtime.ts` to preserve existing mapped Jacob/Uncle sprite + animation overrides while still applying missing story defaults and deduping duplicates.
  - This prevents custom Jacob sprite animation config from being overwritten at runtime by fallback story bootstrap defaults.
  - Validation: `npm run build` passed.

## 2026-02-17 (Story Authoring + Cache Busting)
- Added editable NPC interaction cutscene scripting primitives so story sequencing is now admin-authored instead of only hardcoded:
  - New NPC action schema in world types:
    - `dialogue` (speaker/lines/setFlag)
    - `set_flag`
    - `move_to_player`
    - `move_path` (direction list)
    - `face_player`
    - `wait` (durationMs)
  - Added `interactionScript` to both `NpcDefinition` and `NpcStoryStateDefinition`.
  - Runtime now supports executing these scripted actions while locking player control during scene execution.
  - NPC autonomous AI pauses during scripted scenes (movement interpolation still runs), enabling clean cutscene motion.
  - NPC dialogue interaction now checks `interactionScript` and runs scene instead of normal dialogue when present.
- Extended admin NPC tooling to expose interaction cutscene authoring:
  - `NpcCharacterTemplateEntry` now includes `interactionScript` and `cacheVersion`.
  - NPC Character UI now includes `Interaction Cutscene JSON` field.
  - Save/load/sanitize/placement flows preserve and apply interaction scripts.
  - Map editor clone paths preserve interaction scripts on NPCs and story states.
- Strengthened admin tool separation for NPC workflows:
  - `/admin/npc-sprites` = sprite sheet and animation authoring.
  - `/admin/npc-characters` = character behavior/story authoring.
  - `/admin/npcs` = NPC-focused map painter/studio route (map editing enabled for NPC placement).
- Implemented cache-buster tagging strategy on save for asset-driven entities:
  - NPC Sprite save now appends/updates `?v=<timestamp>` on sprite URL.
  - Critter save now appends/updates `?v=<timestamp>` on `spriteUrl`.
  - Player Sprite save now appends/updates `?v=<timestamp>` on `url`.
  - NPC Character save now stamps `cacheVersion` and map placement applies that version to embedded NPC sprite URL.
- Added URL-normalization comparisons in Critter admin so sprite bucket matching still works even when cache-buster query params are present.

Validation
- `npm run build` passed after all changes.
- Note: attempted Playwright run in this environment hit Chromium sandbox permission error (`bootstrap_check_in ... Permission denied`), so only build verification was completed for this pass.

## 2026-02-17 (NPC Studio Existing-Map Workflow Pass)
- Tightened `/admin/npcs` behavior in `src/admin/MapEditorTool.tsx` to match existing-map NPC authoring flow:
  - NPC Studio now hides sprite-sheet editor content (`showNpcSpriteStudio` no longer includes `npcs` route).
  - NPC Studio tools are restricted to NPC placement/removal (`npc-paint` / `npc-erase`), with automatic fallback to `npc-paint` when entering the route.
  - Updated NPC Studio header copy to clarify existing-map placement and map-specific story behavior editing intent.
- Confirmed map-grid right-click behavior in NPC Studio is NPC-only:
  - Right-click removes NPC instance at the clicked cell.
  - Right-click on empty cells does nothing (no tile erase side effects in `/admin/npcs`).
- Map NPC card panel remains active under the map canvas for per-instance management:
  - Edit card button loads selected map NPC into behavior editor.
  - Remove card button removes that NPC instance from the map.
  - Supports editing movement/dialogue/battle teams/story states/interaction script and applying changes back to selected map NPC.

Validation
- `npm run build` passed.
- Attempted Playwright rerun for regression (`node scripts/story_mode_playwright.js`) failed in this environment due Chromium launch permission (`bootstrap_check_in ... Permission denied`), so this pass was validated via build only.

## 2026-02-17 (Critter Progression HP Restore)
- Updated `tryAdvanceCritter` in `src/game/engine/runtime.ts` so both unlock and level-up events fully restore critter HP to max HP.
- This now applies uniformly to collection and squad views because both derive from the same per-critter `currentHp` progress entry.

Validation
- `npm run build` passed.

## 2026-02-17 (Character-Instance Authority Cleanup)
- Enforced character-instance data as the single source of truth for runtime/editor NPC story placement selection:
  - `src/game/engine/runtime.ts`
    - Removed forced merge of `DEFAULT_STORY_*` NPC libraries in runtime sanitizers.
    - Runtime NPC sprite/character libraries now initialize from empty base defaults and use only stored NPC library content.
  - `src/admin/MapEditorTool.tsx`
    - Removed forced merge of `DEFAULT_STORY_*` NPC libraries during NPC Studio load.
    - NPC Studio now merges local cache + server catalogs with server entries taking precedence by id.
- Existing instance-order behavior remains:
  - runtime chooses the highest eligible ordered story-state entry (last eligible array entry).
  - deletion paths compact instance ordering immediately via `compactCharacterPlacementOrder`.
  - NPC Studio side instance list remains available for selected character timeline management.

Validation
- `npm run build` passed.
- Story mode Playwright regression run passed:
  - `output/story-mode/run-20260217-162237/status.json` (`ok: true`)
  - confirms login success and story checks including starter selection flags, leash guard, Jacob duel flow, and post-demo Jacob presence.
- Post-patch story-mode rerun notes:
  - First retry (`output/story-mode/run-20260217-162430`) failed due traversal flake (`Expected map portlock, got spawn`).
  - Immediate rerun succeeded end-to-end: `output/story-mode/run-20260217-162502/status.json` (`ok: true`, all story checks true).
## 2026-02-17 (Admin NPC Save Atlas Persistence Fix)
- Fixed atlas/tileset disappearing after save in `/admin/npcs`:
  - `src/admin/MapEditorTool.tsx`: map-save request now omits `tileset` entirely when tile-size inputs are not set, instead of sending `null`.
  - `vite.config.ts` (`/api/admin/maps/save`): tile library upsert now preserves existing `saved_tiles` and `tileset_config` unless those fields are explicitly provided in the request body.
- This prevents map saves in NPC Studio from unintentionally clearing stored atlas configuration.

Validation
- `npm run build` passed.
## 2026-02-17 (NPC Facing + Animation + Dialogue Validation Pass)
- Fixed NPC facing override bug in runtime:
  - `src/game/engine/runtime.ts` `getNpcRuntimeState` no longer reapplies `npc.facing` every frame.
  - Facing is now applied on spawn and anchor reset only, so `face_player` and movement-direction facing persist correctly.
- Enforced character-library authority at runtime for ids matching character templates:
  - `getNpcsForMap` now skips map-level NPC entries whose `id` matches a character-library id, preventing stale duplicate story NPC variants from overriding story behavior/animations.
- Improved sprite frame selection fallback for moving NPCs:
  - `getSpriteFrameIndex` now prioritizes move animation set, then walk frames, then idle-set frame cycling when moving.
  - Prevents moving NPCs from getting stuck on idle-first fallback.
  - Added case-insensitive animation-set name lookup in `getDirectionalAnimationFrames`.
- Added NPC animation/facing debug output for Playwright/state verification:
  - `renderGameToText` NPC payload now includes `moving`, `idleAnimation`, `moveAnimation`, and `frameIndex`.
- Restored explicit Uncle Hank starter intro lines (2-line dialogue) for starter pickup branch to avoid incorrect post-duel line being shown at intro when character base dialogue differs.
- Enhanced story Playwright script (`scripts/story_mode_playwright.js`) with new checks:
  - `uncleFacesPlayerOnInteract`
  - `jacobMoveFramesObserved`
  - `jacobExitDownMoveObserved`
  - `jacobInteractedInPortlock`
  - `jacobFacesPlayerInPortlock`
  - Added portlock Jacob interaction sequence captures (`portlock-jacob-interact-attempt-*`).

Validation
- `npm run build` passed.
- Playwright runs:
  - `output/story-mode/run-20260217-164955/status.json` failed one timing-sensitive check (`jacobExitDownMoveObserved`) while all other checks passed.
  - immediate rerun succeeded fully: `output/story-mode/run-20260217-165038/status.json` (`ok: true`, all story checks true).
- Verified dialogue + facing/animation evidence in captured state:
  - Starter intro now 2 lines: `009-uncle-intro-triggered.json` (`totalLines: 2`, text begins `Hey <player-name>...`).
  - Uncle faces player on interact (`facing: down` while player faces up).
  - Jacob moving/frames observed in cutscene and wander snapshots (e.g. `019-*`, `028-*`, `034-*`).
  - Portlock interaction shows Jacob dialogue and facing toward player in `039-portlock-jacob-interact-attempt-3.json`.

## 2026-02-17 (NPC Character Instance Studio pass)
- Implemented richer NPC instance management support for `/admin/npc-characters` and aligned related NPC/sprite editor UX.
- `MapEditorTool` updates:
  - Added `EditorNpcMovementType` normalization helper (`toEditorNpcMovementType`) and shared movement builder for instance editing (`buildPlacementMovement`).
  - Added `loadNpcCharacterTemplateIntoEditor(...)` helper and switched character `Use` actions + selector loading to it.
  - Added generic `addCharacterPlacementInstance(characterId, mapId, position)` and reused it from NPC paint placement.
  - Added live story-state JSON sync in `updateCharacterTemplateById(...)` so instance edits are reflected in the editor draft.
  - `/admin/npc-characters` now loads map IDs from source maps for instance targeting.
  - Added a dedicated instance management panel in `/admin/npc-characters`:
    - add/remove/reorder instances,
    - edit map ID, position, requiresFlag,
    - quick-edit instance selection feeding full per-instance edits through the main character form.
  - Expanded `/admin/npcs` instance panel to support full per-instance fields directly (dialogue/map/position/team/movement/animation fields).
  - Enabled `Apply To Selected Character Instance` action from `/admin/npc-characters` (not only `/admin/npcs`).
- `/admin/npc-sprites` UX update:
  - Added sprite usage panel showing which characters currently use the selected sprite, with quick open into character editor state.
- Styling:
  - Added `.npc-instance-list` / `.npc-instance-card` classes in `src/styles.css` for readable multi-field instance cards.

Validation:
- `npm run build` passed.
- Playwright captures saved to:
  - `output/story-mode/admin-npc-characters-ui/shot-0.png`
  - `output/story-mode/admin-npc-sprites-ui/shot-0.png`
- Note: these Playwright admin captures hit auth guard (`401 Unauthorized`) in this run, so UI runtime interaction on authenticated admin pages could not be visually verified in that capture session.
## 2026-02-17 (Admin Inline Sign-In + Auth-Unblock Verification)
- Added inline sign-in on blocked admin page so `/admin/*` can authenticate in-place without bouncing back to game:
  - `src/admin/AdminView.tsx`
    - added small auth form on `Admin Access Required` state (`email` + `password` + submit).
    - wired submit to `/api/auth/login`, stores token via `setAuthToken`, and immediately unlocks admin tools when returned user is admin.
    - keeps blocked state with clear message if login succeeds but account is not admin.
- Added styling for inline admin auth controls:
  - `src/styles.css`
    - `.admin-inline-auth`, label/input/status styles.

Validation
- `npm run build` passed.
- Story regression still passes (post-change):
  - `output/story-mode/run-20260217-173907/status.json` (`ok: true`, all story checks true including Jacob move/exit/facing checks).
- Admin auth unblock capture (Playwright):
  - `output/story-mode/admin-auth-npc-characters/status.json`
  - `blockedBefore: true`, then successful inline sign-in and `adminLoaded: true`.
  - screenshots: `001-admin-initial.png`, `002-admin-after-signin-attempt.png`, `003-admin-npc-characters.png`.
## 2026-02-17 (NPC Step Interval Unbounded in Studio)
- Removed fixed `180..4000ms` clamping for NPC step interval in editor paths:
  - `src/admin/MapEditorTool.tsx`
    - character save path now uses raw parsed value (fallback `850` if blank/invalid)
    - map NPC apply path now uses raw parsed value (fallback `850`)
    - instance movement builder now preserves provided value (floored), no hard cap window
    - movement sanitizer now keeps finite numeric `stepIntervalMs` as-is (floored), no hard cap window
- Updated runtime handling to honor unbounded configured intervals:
  - `src/game/engine/runtime.ts`
    - `clampNpcStepInterval` now only enforces finite positive integer (`>=1`) with fallback `850`; removed old `180..4000` cap.

Validation
- `npm run build` passed.
## 2026-02-17 (Admin Form Layout Single-Scroll Cleanup)
- Reworked admin layout scrolling behavior so each admin tab uses one page-level scroll container instead of nested scroll panes.
- CSS updates in `src/styles.css`:
  - kept `admin-shell__content` as the single tab scroll surface (`overflow-y: auto`).
  - removed nested scrolling from `admin-layout__left`, `admin-layout__center`, and form/list containers (`saved-paint-list`, `npc-instance-list`, `spritesheet-browser`, `paint-tile-grid`, critter/encounter list panels, etc.).
  - removed map-canvas max-height clamp from `.admin-panel--map-canvas .map-grid-wrap`; map canvas still supports internal scrolling when needed.
- Refactored duplicated NPC movement form parsing in `src/admin/MapEditorTool.tsx`:
  - added `buildNpcMovementFromEditorInputs()` and reused it in both `saveNpcTemplate()` and `applyNpcEditorToSelectedMapNpc()`.
  - keeps behavior identical while removing duplicated validation/build logic.
- Updated doc note in `src/admin/README_ADMIN_MAP_EDITOR.md` to describe single-page admin scrolling model.

Validation
- `npm run build` passed.
- Playwright admin audit (auto-login + screenshots per tab) saved to:
  - `output/story-mode/admin-single-scroll-20260217/`
- Scroll audit status:
  - `output/story-mode/admin-single-scroll-20260217/status.json`
  - each tab reports a single scrollable container and `disallowedScrollableCount: 0`.
## 2026-02-17 (Dialogue Input Lock: No Move/Menu Until Space Through Text)
- Implemented strict dialogue input lock so NPC text boxes must be advanced with `Space` and player cannot move/open menu while dialogue is active.

Code changes
- `src/game/engine/runtime.ts`
  - `keyDown`: added early `this.dialogue` guard to ignore movement keys and only process interact key (`Space`) during dialogue.
  - `keyUp`: clears held directions and exits early when dialogue is active.
  - `startDialogue`: clears `heldDirections` to prevent queued movement immediately after text closes.
  - `isPlayerControlLocked`: now includes `this.dialogue` in lock state.
- `src/game/engine/GameView.tsx`
  - `storyInputLockedRef` now also treats active dialogue as input-locked.
  - added effect to force-close side menu if dialogue appears.

Validation
- `npm run build` passed.
- Existing full story Playwright regression script remains flaky in this environment (intermittent unrelated route/animation/login timing notes), so this change was validated primarily through runtime/input-path code verification plus build.
## 2026-02-17 (Portlock Guard NPC: Ben + North Boundary Gate)
- Added Ben as a story-character instance (not hardcoded map NPC) so it follows the same NPC character timeline system used by story characters.

Data model / catalog changes
- `src/game/world/npcCatalog.ts`
  - Added core story character `ben-story`:
    - `npcName`: `Ben`
    - `spriteId`: `boy-1-sprite`
    - default `facing`: `down`
    - default dialogue: `You do not have a Critter yet, please turn around it is not safe beyond here.`
    - default story instance at `mapId: portlock`, `position: { x: 11, y: 1 }`.
  - Extended core-story normalization to include Ben (same pattern as Uncle Hank/Jacob):
    - dedupes Ben variants by id/name,
    - keeps latest Ben character with default fallback if missing.

Runtime movement gate
- `src/game/engine/runtime.ts`
  - Added `BEN_NPC_ID = 'ben-story'`.
  - Added `isBenPortlockBoundaryStepAllowed(targetX, targetY)` and invoked it from `canStepTo(...)`.
  - Behavior when `demo-done` is NOT unlocked and player is in `portlock`:
    - blocks stepping into `y <= 0` (north boundary/trail gate),
    - blocks stepping directly onto Ben’s tile,
    - triggers Ben dialogue via `startNpcDialogue(ben)` so Ben automatically faces the player and speaks the warning.
  - After `demo-done` unlocks, this boundary guard no longer blocks movement.

Validation
- `npm run build` passed.

## 2026-02-18 (Camera implementation: per-map viewport, editor tools, boundary clamping, small-camera buffer)

Per-map camera size and optional camera point; map editor tools to visualize and set them; runtime camera clamped to map bounds; when the camera is smaller than the reference viewport, canvas stays at reference size with a buffer around the game view.

Data model
- `src/game/world/types.ts`: Added `CameraSize` and `CameraPoint`; `WorldMapInput` and `WorldMap` now have `cameraSize` (default 19×15 tiles) and `cameraPoint` (optional center for initial/editor view).
- `src/game/world/mapBuilder.ts`: `createMap` normalizes and defaults `cameraSize` / `cameraPoint`; `sanitizeCameraSize` and `sanitizeCameraPoint` ensure valid ranges.
- `src/admin/mapEditorUtils.ts`: `EditableMap` includes `cameraSize` and `cameraPoint`; `createBlankEditableMap` and legacy parsing default to 19×15 and null; `toWorldMapInput` and `parseEditableMapJson` read/write camera fields.
- Static map files under `src/game/data/maps/` and `scripts/migrate-game-maps-npc-layer.js` were updated earlier for the NPC layer; camera fields are applied via mapBuilder defaults when omitted.

Map editor (admin/maps)
- **Show camera** tool: Toggles a blue viewport rectangle (4px border) on the map canvas representing the player’s camera size; centered on Camera Point if set, else map center.
- **Select Camera Point** tool: Click a cell to set the map’s camera point and center the blue rectangle there; other paint tools are deselected while this is active.
- **Camera Size (tiles)**: Per-map width×height inputs (1–64); default 19×15. Stored on the map and used at runtime for canvas/viewport size.
- **Camera Point**: Optional x,y tile coordinates plus Clear; used to center the camera view (e.g. initial view or editor preview).
- Camera overlay is clamped so it never draws off the map: when the chosen camera point would push the view off an edge, the blue square is clamped against the map boundary (same behavior as in-game camera).

Runtime (game)
- **Camera clamping**: Camera position is clamped so the view never shows space outside the map. For maps larger than the view: `cameraX` in `[0, map.width - viewTilesX]`, `cameraY` in `[0, map.height - viewTilesY]`. Player can still move when the camera is at the edge; camera moves again when the player moves away from the border.
- **Viewport size**: `GameRuntime.getViewportSize()` returns pixel dimensions from the current map’s `cameraSize`. `GameView` uses this to size the canvas (on init and when the map changes).
- **Small-camera buffer**: When the map’s camera is smaller than the reference viewport (19×15 tiles), the canvas stays at the reference size. The game view is drawn centered with background `#101419` filling the rest (no zoom; tile size remains `TILE_SIZE`). Implemented via `REFERENCE_VIEWPORT_TILES` in runtime, `getViewportSize()` returning `max(reference, mapCameraSize)` per axis, and `render()` using `map.cameraSize` for logical viewport with translate + clip so the smaller view is centered.

Vite / admin payload
- `vite.config.ts`: `EditableMapPayload` and `parseEditableMapPayload` include `cameraSize` and `cameraPoint` so save/load and DB payloads preserve them.

Validation
- `npm run build` passed.

## 2026-02-18 (Combat system: turn-based battle, skills, elements, guard, swap)

Turn-based battle flow with phases, skill-based damage/support, element chart, guard action, squad swap (including forced swap on knockout), and narration-driven UI.

Battle flow and phases
- **Phases** (`BattlePhase`): `transition` (entry effect), `choose-starter` (pick first critter), `player-turn` (attack/guard/swap/retreat), `choose-swap` (swap after knockout or voluntarily), `result` (won/lost/escaped).
- **Results** (`BattleResult`): `ongoing`, `won`, `lost`, `escaped`. Escape is available during player-turn and ends the battle.
- **Turn order**: Player chooses action (skill, guard, swap, retreat). Opponent turn is resolved with skill selection and damage/heal; narration queue drives message and damage application so HP bars update in attack order. Knockouts trigger forced swap when applicable.

Skills and damage
- **Skill types**: Damage (power-based) and support (e.g. heal percent of max HP). Skills have element, optional effect IDs, and are defined in the skill catalog.
- **Damage formula** (in `executeBattleSkillWithSkill`): Level term, attacker attack, defender defense (with modifiers), base power, element chart multiplier, same-type attack bonus (STAB 1.2), critical (2×, ~1.55% chance), guard multiplier (successful guard heavily reduces damage), and 0.85–1.15 variance. Final damage is floored and at least 1.
- **Element chart**: `getElementChartMultiplier(attackerElement, defenderElement)` returns multipliers (e.g. super effective, not very effective, no effect). Narration includes “It’s super effective!”, “It’s not very effective…”, “It had no effect.”, and “Critical hit!” as appropriate.
- **Skill effects**: Applied to attacker/defender via `applySkillEffectsToAttacker`; battle snapshot exposes `activeEffectIds`, `activeEffectIconUrls`, `activeEffectDescriptions` for UI.

Guard and swap
- **Guard**: Player can choose Guard during player-turn; success reduces incoming damage (guard multiplier 0.02 when successful). Consecutive successful guards can be tracked; guard state is part of battle critter state.
- **Swap**: During player-turn the player can open the squad and choose another critter (or cancel). When the active critter faints, phase moves to `choose-swap` with `pendingForcedSwap` if the squad has another living critter; player must select a replacement. `canSwap`, `canCancelSwap`, and `requiresSwapSelection` drive the battle overlay UI.

Battle UI and snapshot
- **RuntimeBattleSnapshot**: Exposes phase, result, transition state, turn number, log line, player/opponent teams (with slot, stats, HP, fainted, active effects), active indices, and flags: `canAttack`, `canGuard`, `canSwap`, `canRetreat`, `canCancelSwap`, `canAdvanceNarration`, `playerActiveSkillSlots` (for Attack sub-menu), `requiresStarterSelection`, `requiresSwapSelection`.
- **BattleOverlay** (GameView): Renders transition, battle field (player/opponent active panels with attack animation token), console log, and action buttons (Attack, Guard, Swap, Retreat) or skill list and swap/continue flows as dictated by phase and snapshot.

Validation
- Combat is exercised in-game via wild encounters and story/guard battles; build and runtime behavior verified.
