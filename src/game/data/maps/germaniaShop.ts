import { createMap } from '@/game/world/mapBuilder';

export const germaniaShopMap = createMap({
  id: 'germania-shop',
  name: 'Germania Market',
  layers: [
    {
      id: 1,
      name: 'Base',
      tiles: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ],
      rotations: [
        '000000000',
        '400000000',
        '400000000',
        '400000000',
        '400000000',
        '400000000',
        '400000000',
        '400000000',
        '000000000'
      ],
      collisionEdges: [
        'fffffffff',
        'fffffffff',
        'fffffffff',
        'f0000000f',
        'f0000000f',
        'f0000000f',
        'f0000000f',
        'f0000000f',
        'ffff0ffff'
      ]
    },
    {
      id: 2,
      name: 'NPC',
      tiles: [
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........',
        '.........'
      ],
      collision: false
    }
  ],
  warps: [
    {
      id: 'germania_shop_warp_1',
      from: {
        x: 4,
        y: 8
      },
      fromPositions: [
        {
          x: 4,
          y: 8
        }
      ],
      toMapId: 'germania',
      to: {
        x: 17,
        y: 17
      },
      toPositions: [
        {
          x: 17,
          y: 17
        }
      ],
      requireInteract: false,
      requiredFacing: 'down',
      label: 'To Germania',
      toFacing: 'down'
    }
  ]
});
