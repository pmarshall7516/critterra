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
        ''
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
      to: {
        x: 17,
        y: 17
      },
      from: {
        x: 4,
        y: 8
      },
      label: 'To Germania',
      toMapId: 'germania',
      toFacing: 'down',
      toPositions: [
        {
          x: 17,
          y: 17
        }
      ],
      fromPositions: [
        {
          x: 4,
          y: 8
        }
      ],
      requiredFacing: 'down',
      requireInteract: false
    }
  ]
});
