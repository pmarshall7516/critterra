import type { WorldMap } from '@/game/world/types';
import { playerHouseMap } from '@/game/data/maps/playerHouse';
import { starterTownMap } from '@/game/data/maps/starterTown';
import { rivalHouseMap } from '@/game/data/maps/rivalHouse';
import { portlockPondMap } from '@/game/data/maps/portlockPond';

export const WORLD_MAPS: WorldMap[] = [playerHouseMap, starterTownMap, rivalHouseMap, portlockPondMap];

export const WORLD_MAP_REGISTRY = WORLD_MAPS.reduce<Record<string, WorldMap>>(
  (registry, map) => {
    registry[map.id] = map;
    return registry;
  },
  {},
);
