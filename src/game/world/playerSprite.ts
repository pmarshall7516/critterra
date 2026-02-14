import type { NpcSpriteConfig } from '@/game/world/types';

export const PLAYER_SPRITE_CONFIG: NpcSpriteConfig = {
  url: '/example_assets/character_npc_spritesheets/main_character_spritesheet.png',
  frameWidth: 64,
  frameHeight: 64,
  atlasCellWidth: 64,
  atlasCellHeight: 64,
  frameCellsWide: 1,
  frameCellsTall: 1,
  renderWidthTiles: 1,
  renderHeightTiles: 2,
  animationSets: {
    idle: {
      up: [
        208
      ],
      down: [
        260
      ],
      left: [
        234
      ],
      right: [
        286
      ]
    },
    walk: {
      up: [
        208,
        209,
        210,
        211,
        212,
        213,
        214,
        215,
        216
      ],
      down: [
        260,
        261,
        262,
        263,
        264,
        265,
        266,
        267,
        268
      ],
      left: [
        234,
        235,
        236,
        237,
        238,
        239,
        240,
        241,
        242
      ],
      right: [
        286,
        287,
        288,
        289,
        290,
        291,
        292,
        293,
        294
      ]
    }
  },
  defaultIdleAnimation: 'idle',
  defaultMoveAnimation: 'walk',
  facingFrames: {
    down: 260,
    left: 234,
    right: 286,
    up: 208
  },
  walkFrames: {
    down: [
      260,
      261,
      262,
      263,
      264,
      265,
      266,
      267,
      268
    ],
    left: [
      234,
      235,
      236,
      237,
      238,
      239,
      240,
      241,
      242
    ],
    right: [
      286,
      287,
      288,
      289,
      290,
      291,
      292,
      293,
      294
    ],
    up: [
      208,
      209,
      210,
      211,
      212,
      213,
      214,
      215,
      216
    ]
  }
};
