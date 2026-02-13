import { createMap } from '@/game/world/mapBuilder';

export const playerHouseMap = createMap({
  id: 'player-house',
  name: 'Player House',
  layers: [
    {
      id: 'base',
      name: 'Base',
      tiles: [
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ],
      collisionEdges: [
        '64444444444444c',
        '200000000000008',
        '200000000000008',
        '200000000000008',
        '200000000000008',
        '200000000000008',
        '200000000000008',
        '200000000000008',
        '200000000000008',
        '200000000000008',
        '311113091111119'
      ]
    }
  ],
  warps: [
    {
      id: 'house_to_town_left_door',
      from: {
        x: 6,
        y: 10
      },
      toMapId: 'starter-town',
      to: {
        x: 12,
        y: 13
      },
      toFacing: 'down',
      requireInteract: true,
      requiredFacing: 'down',
      label: 'Leave House'
    }
  ]
});
