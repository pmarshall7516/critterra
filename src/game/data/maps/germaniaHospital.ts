import { createMap } from '@/game/world/mapBuilder';

export const germaniaHospitalMap = createMap({
  id: 'germania-hospital',
  name: 'Germania Hospital',
  layers: [
    {
      id: 1,
      name: 'Base',
      tiles: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ],
      rotations: [
        '0000000000',
        '0000000004',
        '0000000004',
        '0000000004',
        '0000000004',
        '0000000004',
        '0000000004',
        '0000000004',
        '0000000004',
        '0000000000'
      ],
      collisionEdges: [
        'ffffffffff',
        'ffffffffff',
        'ffffffffff',
        'f00ffff00f',
        'f00ffff00f',
        'f00000000f',
        'f00000000f',
        'f00000000f',
        'f00000000f',
        'ffff00ffff'
      ]
    },
    {
      id: 2,
      name: 'NPC',
      tiles: [
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........'
      ],
      collision: false
    },
    {
      id: 3,
      name: 'Furniture',
      tiles: [
        '..........',
        '......',
        '......',
        '......',
        '......',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........'
      ]
    }
  ],
  warps: [
    {
      id: 'germania_hospital_warp_1',
      to: {
        x: 17,
        y: 9
      },
      from: {
        x: 4,
        y: 9
      },
      label: 'To Germania',
      toMapId: 'germania',
      toFacing: 'down',
      toPositions: [
        {
          x: 17,
          y: 9
        },
        {
          x: 18,
          y: 9
        }
      ],
      fromPositions: [
        {
          x: 4,
          y: 9
        },
        {
          x: 5,
          y: 9
        }
      ],
      requiredFacing: 'down',
      requireInteract: false
    }
  ],
  interactions: [
    {
      id: 'heal-tile-4-4',
      kind: 'heal_tile',
      lines: [
        'Would you like to heal your Critters?'
      ],
      speaker: 'Healer',
      position: {
        x: 4,
        y: 4
      }
    },
    {
      id: 'heal-tile-3-4',
      kind: 'heal_tile',
      lines: [
        'Would you like to heal your Critters?'
      ],
      speaker: 'Healer',
      position: {
        x: 3,
        y: 4
      }
    },
    {
      id: 'heal-tile-3-3',
      kind: 'heal_tile',
      lines: [
        'Would you like to heal your Critters?'
      ],
      speaker: 'Healer',
      position: {
        x: 3,
        y: 3
      }
    },
    {
      id: 'heal-tile-5-4',
      kind: 'heal_tile',
      lines: [
        'Would you like to heal your Critters?'
      ],
      speaker: 'Healer',
      position: {
        x: 5,
        y: 4
      }
    },
    {
      id: 'heal-tile-6-4',
      kind: 'heal_tile',
      lines: [
        'Would you like to heal your Critters?'
      ],
      speaker: 'Healer',
      position: {
        x: 6,
        y: 4
      }
    },
    {
      id: 'heal-tile-6-3',
      kind: 'heal_tile',
      lines: [
        'Would you like to heal your Critters?'
      ],
      speaker: 'Healer',
      position: {
        x: 6,
        y: 3
      }
    }
  ]
});
