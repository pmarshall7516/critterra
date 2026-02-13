import { createMap } from '@/game/world/mapBuilder';

export const starterTownMap = createMap({
  id: 'starter-town',
  name: 'Portlock Town',
  layers: [
    {
      id: 'base',
      name: 'Base',
      tiles: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ],
      rotations: [
        '000000000000000000000000',
        '011202321001203331311220',
        '023000220210302210320010',
        '013000011211112102133110',
        '021000211013322113000000',
        '030033120330122313000000',
        '001322331133020033000000',
        '010133000310020220000200',
        '003331020320303202000020',
        '021222000311333102000010',
        '030222030222122100032120',
        '000100010001100022211020',
        '010100010001113330110230',
        '033310010001131212323210',
        '020310020000000020121000',
        '011232030000003123130020',
        '003110000000000031020100',
        '000000000000000000000000'
      ],
      collisionEdges: [
        '64444444444444444444444c',
        '200000000800020000000008',
        '200913000800020000000008',
        '20080200080002000000000c',
        '200c46000800020000000000',
        '200000000c44460000000000',
        '200000000000000000000000',
        '200000000000000000000009',
        '200000000009111300000008',
        '200000000008000200000008',
        '200000000008000200000008',
        '200000000008000200000008',
        '20000000000c444600000008',
        '200000000000000000000008',
        '200000000000000000000008',
        '200000000000000000000008',
        '200000000000000000000008',
        '311111111111111111111119'
      ]
    },
    {
      id: 'layer',
      name: 'Layer 2',
      tiles: [
        '........................',
        '...................',
        '...................',
        '...................',
        '...................',
        '...................',
        '........................',
        '........................',
        '...................',
        '...................',
        '...................',
        '.................',
        '.................',
        '....................',
        '.....................',
        '....................',
        '.......................',
        '........................'
      ],
      collisionEdges: [
        '000000000000000000000000',
        '000000000000000000000000',
        '000000000000000000000000',
        '000000000000000000000000',
        '000000000000000000000000',
        '000000000000000000000000',
        '000000000000000000000000',
        '000000000000000000000000',
        '000000000000000000000000',
        '000000000000000000000000',
        '000000000000000000000000',
        '0000000009b0000000000000',
        '0000000008a0000000000000',
        '009300000ee0000000000000',
        '008230000000000000000000',
        '00e66000000000000000b000',
        '00000000000000000000e000',
        '000000000000000000000000'
      ]
    }
  ],
  npcs: [
    {
      id: 'hank-1',
      name: 'Hank',
      position: {
        x: 18,
        y: 15
      },
      color: '#4d80c8',
      dialogueId: 'custom-npc-dialogue',
      dialogueLines: [
        'Better get to your aunt\'s house quick.',
        'You don\'t want to miss Critter pickup!'
      ],
      movement: {
        type: 'static'
      },
      sprite: {
        url: '/example_assets/character_npc_spritesheets/ow1.png',
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
          up: 12
        },
        walkFrames: {
          up: [
            13,
            14,
            15
          ],
          down: [
            1,
            2,
            3
          ],
          left: [
            5,
            6,
            7
          ],
          right: [
            9,
            10,
            11
          ]
        }
      }
    },
    {
      id: 'edmund-1',
      name: 'Edmund',
      position: {
        x: 19,
        y: 6
      },
      color: '#c84cb7',
      dialogueId: 'custom_npc_dialogue',
      dialogueLines: [
        'What a nice town...',
        'I don\'t recall ever coming here before'
      ],
      movement: {
        type: 'random',
        stepIntervalMs: 1500
      },
      sprite: {
        url: '/example_assets/character_npc_spritesheets/ow8.png',
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
          up: 12
        },
        walkFrames: {
          up: [
            13,
            14,
            15
          ],
          down: [
            1,
            2,
            3
          ],
          left: [
            5,
            6,
            7
          ],
          right: [
            9,
            10,
            11
          ]
        }
      }
    }
  ],
  warps: [
    {
      id: 'town_to_house_right',
      from: {
        x: 12,
        y: 12
      },
      toMapId: 'player-house',
      to: {
        x: 6,
        y: 9
      },
      toFacing: 'up',
      requireInteract: true,
      requiredFacing: 'up',
      label: 'Enter House'
    },
    {
      id: 'town_to_rival_house_left',
      from: {
        x: 10,
        y: 5
      },
      toMapId: 'rival-house',
      to: {
        x: 8,
        y: 10
      },
      toFacing: 'up',
      requireInteract: true,
      requiredFacing: 'up',
      label: 'Enter Kira House'
    },
    {
      id: 'portlock-to-pond',
      from: {
        x: 23,
        y: 4
      },
      toMapId: 'portlock-pond',
      to: {
        x: 1,
        y: 4
      },
      requireInteract: false,
      requiredFacing: 'right',
      label: 'portlock-to-pond',
      fromPositions: [
        {
          x: 23,
          y: 4
        },
        {
          x: 23,
          y: 5
        },
        {
          x: 23,
          y: 6
        }
      ],
      toPositions: [
        {
          x: 1,
          y: 4
        },
        {
          x: 1,
          y: 5
        },
        {
          x: 1,
          y: 6
        }
      ]
    }
  ],
  interactions: [
    {
      id: 'town_sign_center',
      position: {
        x: 2,
        y: 13
      },
      speaker: 'Town Sign',
      lines: [
        'Willowbrook Town',
        'A quiet place where every journey begins.'
      ]
    },
    {
      id: 'rival_house_sign',
      position: {
        x: 6,
        y: 8
      },
      speaker: 'Sign',
      lines: [
        'Kira Family House',
        'Starters today. Trainers welcome.'
      ]
    },
    {
      id: 'north_route_sign',
      position: {
        x: 17,
        y: 8
      },
      speaker: 'Sign',
      lines: [
        'Route 1 North',
        'Tall grass ahead. Keep your Critter close.'
      ]
    },
    {
      id: 'west_house_locked_left',
      position: {
        x: 4,
        y: 12
      },
      speaker: 'Door',
      lines: [
        'Nobody home right now. Everyone is at Kira\'s place.'
      ]
    },
    {
      id: 'west_house_locked_right',
      position: {
        x: 5,
        y: 12
      },
      speaker: 'Door',
      lines: [
        'Nobody home right now. Everyone is at Kira\'s place.'
      ]
    },
    {
      id: 'east_house_locked_left',
      position: {
        x: 18,
        y: 12
      },
      speaker: 'Door',
      lines: [
        'No one answers. The lights are still on.'
      ]
    },
    {
      id: 'east_house_locked_right',
      position: {
        x: 19,
        y: 12
      },
      speaker: 'Door',
      lines: [
        'No one answers. The lights are still on.'
      ]
    },
    {
      id: 'north_exit_blocked',
      position: {
        x: 11,
        y: 1
      },
      speaker: 'Narrator',
      lines: [
        'The wind is strong to the north.',
        'You should visit Kira\'s family first.'
      ]
    },
    {
      id: 'north_exit_blocked_right',
      position: {
        x: 12,
        y: 1
      },
      speaker: 'Narrator',
      lines: [
        'The wind is strong to the north.',
        'You should visit Kira\'s family first.'
      ]
    }
  ]
});
