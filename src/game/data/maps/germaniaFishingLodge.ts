import { createMap } from '@/game/world/mapBuilder';

export const germaniaFishingLodgeMap = createMap({
  id: 'germania-fishing-lodge',
  name: 'Fishing Lodge',
  layers: [
    {
      id: 1,
      name: 'Base',
      tiles: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
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
    },
    {
      id: 2,
      name: 'NPC',
      tiles: [
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........'
      ],
      collision: false
    }
  ],
  warps: [
    {
      id: 'germania_fishing_lodge_warp_1',
      from: {
        x: 5,
        y: 10
      },
      fromPositions: [
        {
          x: 5,
          y: 10
        }
      ],
      toMapId: 'germania',
      to: {
        x: 9,
        y: 9
      },
      toPositions: [
        {
          x: 9,
          y: 9
        }
      ],
      requireInteract: false,
      requiredFacing: 'down',
      label: 'To Germania',
      toFacing: 'down'
    }
  ]
});
