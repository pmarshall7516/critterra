import { createMap } from '@/game/world/mapBuilder';

export const userHouseMap = createMap({
  id: 'user-house',
  name: 'Home',
  layers: [
    {
      id: 'base',
      name: 'Base',
      tiles: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ],
      collisionEdges: [
        '20000000008',
        '20000000008',
        '6444444444c',
        '20000000008',
        '20000000008',
        '20000000008',
        '20000000008',
        '20000000008',
        '20000000008',
        '20000000008',
        '31113491119'
      ]
    }
  ],
  warps: [
    {
      id: 'user_house_warp_1',
      to: {
        x: 14,
        y: 8
      },
      from: {
        x: 5,
        y: 10
      },
      label: 'To Portlock',
      toMapId: 'portlock',
      toPositions: [
        {
          x: 14,
          y: 8
        }
      ],
      fromPositions: [
        {
          x: 5,
          y: 10
        }
      ],
      requireInteract: true
    }
  ]
});
