import type { NpcSpriteConfig } from '@/game/world/types';

export const PLAYER_SPRITE_CONFIG: NpcSpriteConfig = {
  url: '/example_assets/character_npc_spritesheets/user_char.png',
  frameWidth: 32,
  frameHeight: 32,
  atlasCellWidth: 32,
  atlasCellHeight: 32,
  frameCellsWide: 1,
  frameCellsTall: 1,
  renderWidthTiles: 1,
  renderHeightTiles: 2,
  facingFrames: {
    down: 0,
    left: 4,
    right: 8,
    up: 12,
  },
  walkFrames: {
    down: [1, 2, 3],
    left: [5, 6, 7],
    right: [9, 10, 11],
    up: [13, 14, 15],
  },
};
