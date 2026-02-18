import type { WorldMap } from '@/game/world/types';
import { playerHouseMap } from '@/game/data/maps/playerHouse';
import { starterTownMap } from '@/game/data/maps/starterTown';
import { rivalHouseMap } from '@/game/data/maps/rivalHouse';
import { portlockPondMap } from '@/game/data/maps/portlockPond';
import { spawnMap } from '@/game/data/maps/spawn';
import { portlockMap } from '@/game/data/maps/portlock';
import { userHouseMap } from '@/game/data/maps/userHouse';
import { uncleSHouseMap } from '@/game/data/maps/uncleSHouse';
import { portlockTrailMap } from '@/game/data/maps/portlockTrail';
import { darkForestMap } from '@/game/data/maps/darkForest';

export const WORLD_MAPS: WorldMap[] = [playerHouseMap, starterTownMap, rivalHouseMap, portlockPondMap, spawnMap, portlockMap, userHouseMap, uncleSHouseMap, portlockTrailMap, darkForestMap];

export const WORLD_MAP_REGISTRY = WORLD_MAPS.reduce<Record<string, WorldMap>>(
  (registry, map) => {
    registry[map.id] = map;
    return registry;
  },
  {},
);
