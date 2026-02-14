import { createMap } from '@/game/world/mapBuilder';

export const uncleSHouseMap = createMap({
  id: 'uncle-s-house',
  name: 'Uncle Hank\'s House',
  layers: [
    {
      id: 'base',
      name: 'Base',
      tiles: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ],
      collisionEdges: [
        '2000000000008',
        '2000000000008',
        '644444444444c',
        '2000000000008',
        '2000000000008',
        '2000000000008',
        '2000000000008',
        '2000000000008',
        '2000000000008',
        '2000000000008',
        '2000000000008',
        '2000000000008',
        '3111134911119'
      ]
    }
  ],
  warps: [
    {
      id: 'uncle_s_house_warp_1',
      to: {
        x: 2,
        y: 5
      },
      from: {
        x: 6,
        y: 12
      },
      label: 'To Portlock',
      toMapId: 'portlock',
      toPositions: [
        {
          x: 2,
          y: 5
        }
      ],
      fromPositions: [
        {
          x: 6,
          y: 12
        }
      ],
      requiredFacing: 'down',
      requireInteract: true
    }
  ]
});
