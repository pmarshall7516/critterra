import type { NpcSpriteConfig } from '@/game/world/types';

export const PLAYER_SPRITE_CONFIG: NpcSpriteConfig = {
  url: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/character-spritesheets/main_character_spritesheet.png?v=1772645262891',
  frameWidth: 64,
  frameHeight: 64,
  atlasCellWidth: 64,
  atlasCellHeight: 64,
  frameCellsWide: 1,
  frameCellsTall: 1,
  renderWidthTiles: 1,
  renderHeightTiles: 2,
  animationSets: {
    fish: {
      up: [
        104,
        105,
        106,
        107,
        108,
        109,
        110,
        111
      ],
      down: [
        156,
        157,
        158,
        159,
        160,
        161,
        162,
        163
      ],
      left: [
        130,
        131,
        132,
        133,
        134,
        135,
        136,
        137
      ],
      right: [
        182,
        183,
        184,
        185,
        186,
        187,
        188,
        189
      ]
    },
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
