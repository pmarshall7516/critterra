import { createMap } from '@/game/world/mapBuilder';

export const portlockTrailMap = createMap({
  id: 'portlock-trail',
  name: 'Portlock Trail',
  layers: [
    {
      id: 1,
      name: 'Base',
      tiles: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ],
      rotations: [
        '0230030000203',
        '3212100000000',
        '2010000110221',
        '1000003000000',
        '1021300003111',
        '1030000020023',
        '2020310311332',
        '2020023300221',
        '0030222112121'
      ],
      collisionEdges: [
        '4444444444444',
        '0000000000000',
        '0000000000000',
        '0000000000000',
        '0000000000000',
        '0000000000000',
        '0000000000000',
        '0000000000000',
        '0000000000000'
      ]
    },
    {
      id: 2,
      name: 'Flowers',
      tiles: [
        '..........',
        '............',
        '............',
        '............',
        '.............',
        '...........',
        '.............',
        '...........',
        '............'
      ],
      collision: false,
      rotations: [
        '0000000000200',
        '0100000000000',
        '0000200000000',
        '0000000000000',
        '0000000000000',
        '0000000020010',
        '0000000000000',
        '0000001020000',
        '0000000001000'
      ]
    },
    {
      id: 3,
      name: 'NPC',
      tiles: [
        '.............',
        '.............',
        '.............',
        '.............',
        '.............',
        '.............',
        '.............',
        '.............',
        '.............'
      ],
      collision: false
    },
    {
      id: 4,
      name: 'Tall Grass',
      tiles: [
        '.............',
        '...........',
        '...........',
        '.............',
        '.............',
        '............',
        '..........',
        '............',
        '.............'
      ]
    },
    {
      id: 5,
      name: 'Trees',
      tiles: [
        '.....',
        '.............',
        '.............',
        '.............',
        '.............',
        '.............',
        '...........',
        '..........',
        '..........'
      ],
      collisionEdges: [
        'ff0ff0ffff000',
        '0000000000000',
        '0000000000000',
        '0000000000000',
        '0000000000000',
        '0000000000000',
        '0000000000000',
        '00000000000ff',
        'f0000000000ff'
      ]
    }
  ],
  warps: [
    {
      id: 'to-portlock',
      to: {
        x: 12,
        y: 1
      },
      from: {
        x: 1,
        y: 8
      },
      label: 'To Portlock',
      toMapId: 'portlock',
      toFacing: 'down',
      toPositions: [
        {
          x: 12,
          y: 1
        },
        {
          x: 13,
          y: 1
        },
        {
          x: 14,
          y: 1
        }
      ],
      fromPositions: [
        {
          x: 1,
          y: 8
        },
        {
          x: 2,
          y: 8
        },
        {
          x: 3,
          y: 8
        }
      ],
      requiredFacing: 'down',
      requireInteract: false
    },
    {
      id: 'portlock_trail_warp_2',
      from: {
        x: 12,
        y: 1
      },
      fromPositions: [
        {
          x: 12,
          y: 1
        },
        {
          x: 12,
          y: 2
        },
        {
          x: 12,
          y: 3
        }
      ],
      toMapId: 'dark-forest',
      to: {
        x: 1,
        y: 1
      },
      toPositions: [
        {
          x: 1,
          y: 1
        },
        {
          x: 1,
          y: 2
        },
        {
          x: 1,
          y: 3
        }
      ],
      requireInteract: false,
      label: 'To the Dark Forest'
    }
  ],
  encounterGroups: [
    {
      id: 'moo',
      tilePositions: [
        {
          x: 2,
          y: 1
        },
        {
          x: 3,
          y: 1
        },
        {
          x: 3,
          y: 2
        },
        {
          x: 2,
          y: 2
        }
      ],
      walkEncounterTableId: 'first',
      fishEncounterTableId: null,
      walkFrequency: 0.25,
      fishFrequency: 0
    },
    {
      id: 'test',
      tilePositions: [
        {
          x: 10,
          y: 5
        },
        {
          x: 10,
          y: 6
        },
        {
          x: 9,
          y: 6
        },
        {
          x: 10,
          y: 7
        },
        {
          x: 11,
          y: 6
        }
      ],
      walkEncounterTableId: 'starter-critter',
      fishEncounterTableId: null,
      walkFrequency: 0.25,
      fishFrequency: 0
    }
  ]
});
