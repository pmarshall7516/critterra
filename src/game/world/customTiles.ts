import type { TileDefinition } from '@/game/world/types';

export interface CustomTilesetConfig {
  url: string;
  tileWidth: number;
  tileHeight: number;
}

export const CUSTOM_TILESET_CONFIG: CustomTilesetConfig | null = {
  url: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
  tileWidth: 16,
  tileHeight: 16
};

export const CUSTOM_TILE_DEFINITIONS: Record<string, TileDefinition> = {
  '': {
    code: '',
    label: 'palm_tree1 ',
    walkable: true,
    color: '#559b3b',
    accentColor: '#64c47c',
    height: 0,
    atlasIndex: 994,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_tree1 ',
    walkable: true,
    color: '#539b3b',
    accentColor: '#64c47d',
    height: 0,
    atlasIndex: 995,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_tree1 ',
    walkable: true,
    color: '#519b3b',
    accentColor: '#64c47f',
    height: 0,
    atlasIndex: 1046,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_tree1 ',
    walkable: true,
    color: '#509b3b',
    accentColor: '#64c481',
    height: 0,
    atlasIndex: 1047,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_tree1 ',
    walkable: true,
    color: '#4e9b3b',
    accentColor: '#64c482',
    height: 0,
    atlasIndex: 1098,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_tree1 ',
    walkable: true,
    color: '#4d9b3b',
    accentColor: '#64c484',
    height: 0,
    atlasIndex: 1099,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#4b9b3b',
    accentColor: '#64c485',
    height: 0,
    atlasIndex: 1150,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#499b3b',
    accentColor: '#64c487',
    height: 0,
    atlasIndex: 1151,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#489b3b',
    accentColor: '#64c489',
    height: 0,
    atlasIndex: 1202,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#469b3b',
    accentColor: '#64c48a',
    height: 0,
    atlasIndex: 1203,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#459b3b',
    accentColor: '#64c48c',
    height: 0,
    atlasIndex: 1254,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#439b3b',
    accentColor: '#64c48d',
    height: 0,
    atlasIndex: 1255,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_bush ',
    walkable: true,
    color: '#419b3b',
    accentColor: '#64c48f',
    height: 0,
    atlasIndex: 1048,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'palm_bush ',
    walkable: true,
    color: '#409b3b',
    accentColor: '#64c491',
    height: 0,
    atlasIndex: 1100,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_3_red_flower ',
    walkable: true,
    color: '#3e9b3b',
    accentColor: '#64c492',
    height: 0,
    atlasIndex: 1101,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_3_blue_flower ',
    walkable: true,
    color: '#3d9b3b',
    accentColor: '#64c494',
    height: 0,
    atlasIndex: 1102,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_3_yellow_flower ',
    walkable: true,
    color: '#3b9b3b',
    accentColor: '#64c496',
    height: 0,
    atlasIndex: 1103,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'beach_water_top_left ',
    walkable: true,
    color: '#3b9b3d',
    accentColor: '#64c497',
    height: 0,
    atlasIndex: 682,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'beach_water_top ',
    walkable: true,
    color: '#3b9b3e',
    accentColor: '#64c499',
    height: 0,
    atlasIndex: 683,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'beach_water_top_right ',
    walkable: true,
    color: '#3b9b40',
    accentColor: '#64c49a',
    height: 0,
    atlasIndex: 684,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'beach_water_right ',
    walkable: true,
    color: '#3b9b41',
    accentColor: '#64c49c',
    height: 0,
    atlasIndex: 736,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'beach_water_bottom_right ',
    walkable: true,
    color: '#3b9b43',
    accentColor: '#64c49e',
    height: 0,
    atlasIndex: 788,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'beach_water_bottom ',
    walkable: true,
    color: '#3b9b45',
    accentColor: '#64c49f',
    height: 0,
    atlasIndex: 787,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'beach_water_bottom_left ',
    walkable: true,
    color: '#3b9b46',
    accentColor: '#64c4a1',
    height: 0,
    atlasIndex: 786,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'beach_water_left ',
    walkable: true,
    color: '#3b9b48',
    accentColor: '#64c4a2',
    height: 0,
    atlasIndex: 734,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'beach_corner ',
    walkable: true,
    color: '#3b9b49',
    accentColor: '#64c4a4',
    height: 0,
    atlasIndex: 635,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_path_left ',
    walkable: true,
    color: '#3b9b4b',
    accentColor: '#64c4a6',
    height: 0,
    atlasIndex: 104,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'wood_floor ',
    walkable: true,
    color: '#3b9b4d',
    accentColor: '#64c4a7',
    height: 0,
    atlasIndex: 615,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'wood_floor_back ',
    walkable: true,
    color: '#3b9b4e',
    accentColor: '#64c4a9',
    height: 0,
    atlasIndex: 563,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'right_wall ',
    walkable: true,
    color: '#3b9b50',
    accentColor: '#64c4aa',
    height: 0,
    atlasIndex: 616,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'right_wall_back ',
    walkable: true,
    color: '#3b9b51',
    accentColor: '#64c4ac',
    height: 0,
    atlasIndex: 564,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'left_wall ',
    walkable: true,
    color: '#3b9b53',
    accentColor: '#64c4ae',
    height: 0,
    atlasIndex: 614,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'left_wall_back ',
    walkable: true,
    color: '#3b9b55',
    accentColor: '#64c4af',
    height: 0,
    atlasIndex: 562,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'back_wall_bottom ',
    walkable: true,
    color: '#3b9b56',
    accentColor: '#64c4b1',
    height: 0,
    atlasIndex: 511,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'back_wall_top ',
    walkable: true,
    color: '#3b9b58',
    accentColor: '#64c4b2',
    height: 0,
    atlasIndex: 459,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'blue_wall_window ',
    walkable: true,
    color: '#3b9b59',
    accentColor: '#64c4b4',
    height: 0,
    atlasIndex: 722,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'blue_wall_window ',
    walkable: true,
    color: '#3b9b5b',
    accentColor: '#64c4b6',
    height: 0,
    atlasIndex: 723,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'blue_wall_window ',
    walkable: true,
    color: '#3b9b5d',
    accentColor: '#64c4b7',
    height: 0,
    atlasIndex: 774,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'blue_wall_window ',
    walkable: true,
    color: '#3b9b5e',
    accentColor: '#64c4b9',
    height: 0,
    atlasIndex: 775,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'table ',
    walkable: true,
    color: '#3b9b60',
    accentColor: '#64c4ba',
    height: 0,
    atlasIndex: 718,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'table ',
    walkable: true,
    color: '#3b9b61',
    accentColor: '#64c4bc',
    height: 0,
    atlasIndex: 719,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'table ',
    walkable: true,
    color: '#3b9b63',
    accentColor: '#64c4be',
    height: 0,
    atlasIndex: 770,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'table ',
    walkable: true,
    color: '#3b9b65',
    accentColor: '#64c4bf',
    height: 0,
    atlasIndex: 771,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'chair ',
    walkable: true,
    color: '#3b9b66',
    accentColor: '#64c4c1',
    height: 0,
    atlasIndex: 721,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'houseplant ',
    walkable: true,
    color: '#3b9b68',
    accentColor: '#64c4c2',
    height: 0,
    atlasIndex: 720,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'houseplant ',
    walkable: true,
    color: '#3b9b69',
    accentColor: '#64c4c4',
    height: 0,
    atlasIndex: 772,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'white_chair ',
    walkable: true,
    color: '#3b9b6b',
    accentColor: '#64c2c4',
    height: 0,
    atlasIndex: 825,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'wall_bottom_right ',
    walkable: true,
    color: '#3b9b6d',
    accentColor: '#64c1c4',
    height: 0,
    atlasIndex: 668,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#3b9b6e',
    accentColor: '#64bfc4',
    height: 0,
    atlasIndex: 0,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'wall_bottom ',
    walkable: true,
    color: '#3b9b70',
    accentColor: '#64bec4',
    height: 0,
    atlasIndex: 667,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'wall_top ',
    walkable: true,
    color: '#3b9b72',
    accentColor: '#64bcc4',
    height: 0,
    atlasIndex: 407,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'wall_top_left ',
    walkable: true,
    color: '#3b9b73',
    accentColor: '#64bac4',
    height: 0,
    atlasIndex: 406,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'wall_top_right ',
    walkable: true,
    color: '#3b9b75',
    accentColor: '#64b9c4',
    height: 0,
    atlasIndex: 408,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'tall_grass ',
    walkable: true,
    color: '#3b9b76',
    accentColor: '#64b7c4',
    height: 0,
    atlasIndex: 3,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'sand_tall_grass ',
    walkable: true,
    color: '#3b9b78',
    accentColor: '#64b6c4',
    height: 0,
    atlasIndex: 4,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'teal_tall_grass ',
    walkable: true,
    color: '#3b9b7a',
    accentColor: '#64b4c4',
    height: 0,
    atlasIndex: 5,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'tall_grass2 ',
    walkable: true,
    color: '#3b9b7b',
    accentColor: '#64b2c4',
    height: 0,
    atlasIndex: 6,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Base ',
    walkable: true,
    color: '#3b9b7d',
    accentColor: '#64b1c4',
    height: 0,
    atlasIndex: 1249,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Base ',
    walkable: true,
    color: '#3b9b7e',
    accentColor: '#64afc4',
    height: 0,
    atlasIndex: 1250,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Middle ',
    walkable: true,
    color: '#3b9b80',
    accentColor: '#64aec4',
    height: 0,
    atlasIndex: 1197,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Middle ',
    walkable: true,
    color: '#3b9b82',
    accentColor: '#64acc4',
    height: 0,
    atlasIndex: 1198,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Top ',
    walkable: true,
    color: '#3b9b83',
    accentColor: '#64aac4',
    height: 0,
    atlasIndex: 1145,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Top ',
    walkable: true,
    color: '#3b9b85',
    accentColor: '#64a9c4',
    height: 0,
    atlasIndex: 1146,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Top Left ',
    walkable: true,
    color: '#3b9b86',
    accentColor: '#64a7c4',
    height: 0,
    atlasIndex: 1145,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Top Right ',
    walkable: true,
    color: '#3b9b88',
    accentColor: '#64a6c4',
    height: 0,
    atlasIndex: 1146,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Middle Left ',
    walkable: true,
    color: '#3b9b8a',
    accentColor: '#64a4c4',
    height: 0,
    atlasIndex: 1197,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Middle Right ',
    walkable: true,
    color: '#3b9b8b',
    accentColor: '#64a2c4',
    height: 0,
    atlasIndex: 1198,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Base Right ',
    walkable: true,
    color: '#3b9b8d',
    accentColor: '#64a1c4',
    height: 0,
    atlasIndex: 1250,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass ',
    walkable: true,
    color: '#3b9b8e',
    accentColor: '#649fc4',
    height: 0,
    atlasIndex: 0,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'sand ',
    walkable: true,
    color: '#3b9b90',
    accentColor: '#649ec4',
    height: 0,
    atlasIndex: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'snow ',
    walkable: true,
    color: '#3b9b92',
    accentColor: '#649cc4',
    height: 0,
    atlasIndex: 2,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_path_top_left ',
    walkable: true,
    color: '#3b9b93',
    accentColor: '#649ac4',
    height: 0,
    atlasIndex: 52,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_path_top ',
    walkable: true,
    color: '#3b9b95',
    accentColor: '#6499c4',
    height: 0,
    atlasIndex: 53,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_path_top_right ',
    walkable: true,
    color: '#3b9b96',
    accentColor: '#6497c4',
    height: 0,
    atlasIndex: 54,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_path_right ',
    walkable: true,
    color: '#3b9b98',
    accentColor: '#6496c4',
    height: 0,
    atlasIndex: 106,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_path_bottom_right ',
    walkable: true,
    color: '#3b9b9a',
    accentColor: '#6494c4',
    height: 0,
    atlasIndex: 158,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'Forest Tree Base Left ',
    walkable: true,
    color: '#3b9b9b',
    accentColor: '#6492c4',
    height: 0,
    atlasIndex: 1249,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#3b9a9b',
    accentColor: '#6491c4',
    height: 0,
    atlasIndex: 0,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'grass_path_bottom ',
    walkable: true,
    color: '#3b989b',
    accentColor: '#648fc4',
    height: 0,
    atlasIndex: 157,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_path_bottom_left ',
    walkable: true,
    color: '#3b969b',
    accentColor: '#648dc4',
    height: 0,
    atlasIndex: 156,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'path ',
    walkable: true,
    color: '#3b959b',
    accentColor: '#648cc4',
    height: 0,
    atlasIndex: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#3b939b',
    accentColor: '#648ac4',
    height: 0,
    atlasIndex: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#3b929b',
    accentColor: '#6489c4',
    height: 0,
    atlasIndex: 2,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#3b909b',
    accentColor: '#6487c4',
    height: 0,
    atlasIndex: 3,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#3b8e9b',
    accentColor: '#6485c4',
    height: 0,
    atlasIndex: 4,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#3b8d9b',
    accentColor: '#6484c4',
    height: 0,
    atlasIndex: 5,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#3b8b9b',
    accentColor: '#6482c4',
    height: 0,
    atlasIndex: 6,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#3b8a9b',
    accentColor: '#6481c4',
    height: 0,
    atlasIndex: 7,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b889b',
    accentColor: '#647fc4',
    height: 0,
    atlasIndex: 498,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b869b',
    accentColor: '#647dc4',
    height: 0,
    atlasIndex: 499,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b859b',
    accentColor: '#647cc4',
    height: 0,
    atlasIndex: 500,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b839b',
    accentColor: '#647ac4',
    height: 0,
    atlasIndex: 501,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b829b',
    accentColor: '#6479c4',
    height: 0,
    atlasIndex: 502,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b809b',
    accentColor: '#6477c4',
    height: 0,
    atlasIndex: 550,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b7e9b',
    accentColor: '#6475c4',
    height: 0,
    atlasIndex: 551,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b7d9b',
    accentColor: '#6474c4',
    height: 0,
    atlasIndex: 552,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b7b9b',
    accentColor: '#6472c4',
    height: 0,
    atlasIndex: 553,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b7a9b',
    accentColor: '#6471c4',
    height: 0,
    atlasIndex: 554,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b789b',
    accentColor: '#646fc4',
    height: 0,
    atlasIndex: 602,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b769b',
    accentColor: '#646dc4',
    height: 0,
    atlasIndex: 603,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b759b',
    accentColor: '#646cc4',
    height: 0,
    atlasIndex: 604,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b739b',
    accentColor: '#646ac4',
    height: 0,
    atlasIndex: 605,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b729b',
    accentColor: '#6469c4',
    height: 0,
    atlasIndex: 606,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b709b',
    accentColor: '#6467c4',
    height: 0,
    atlasIndex: 654,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b6e9b',
    accentColor: '#6465c4',
    height: 0,
    atlasIndex: 655,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b6d9b',
    accentColor: '#6464c4',
    height: 0,
    atlasIndex: 656,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b6b9b',
    accentColor: '#6564c4',
    height: 0,
    atlasIndex: 657,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b699b',
    accentColor: '#6764c4',
    height: 0,
    atlasIndex: 658,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b689b',
    accentColor: '#6964c4',
    height: 0,
    atlasIndex: 706,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b669b',
    accentColor: '#6a64c4',
    height: 0,
    atlasIndex: 707,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b659b',
    accentColor: '#6c64c4',
    height: 0,
    atlasIndex: 708,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b639b',
    accentColor: '#6d64c4',
    height: 0,
    atlasIndex: 709,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b619b',
    accentColor: '#6f64c4',
    height: 0,
    atlasIndex: 710,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b609b',
    accentColor: '#7164c4',
    height: 0,
    atlasIndex: 862,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b5e9b',
    accentColor: '#7264c4',
    height: 0,
    atlasIndex: 863,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b5d9b',
    accentColor: '#7464c4',
    height: 0,
    atlasIndex: 864,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b5b9b',
    accentColor: '#7564c4',
    height: 0,
    atlasIndex: 865,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b599b',
    accentColor: '#7764c4',
    height: 0,
    atlasIndex: 866,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b589b',
    accentColor: '#7964c4',
    height: 0,
    atlasIndex: 914,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b569b',
    accentColor: '#7a64c4',
    height: 0,
    atlasIndex: 915,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b559b',
    accentColor: '#7c64c4',
    height: 0,
    atlasIndex: 916,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b539b',
    accentColor: '#7d64c4',
    height: 0,
    atlasIndex: 917,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b519b',
    accentColor: '#7f64c4',
    height: 0,
    atlasIndex: 918,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b509b',
    accentColor: '#8164c4',
    height: 0,
    atlasIndex: 966,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b4e9b',
    accentColor: '#8264c4',
    height: 0,
    atlasIndex: 967,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b4d9b',
    accentColor: '#8464c4',
    height: 0,
    atlasIndex: 968,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b4b9b',
    accentColor: '#8564c4',
    height: 0,
    atlasIndex: 969,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b499b',
    accentColor: '#8764c4',
    height: 0,
    atlasIndex: 970,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b489b',
    accentColor: '#8964c4',
    height: 0,
    atlasIndex: 1018,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b469b',
    accentColor: '#8a64c4',
    height: 0,
    atlasIndex: 1019,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b459b',
    accentColor: '#8c64c4',
    height: 0,
    atlasIndex: 1020,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b439b',
    accentColor: '#8d64c4',
    height: 0,
    atlasIndex: 1021,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b419b',
    accentColor: '#8f64c4',
    height: 0,
    atlasIndex: 1022,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b409b',
    accentColor: '#9164c4',
    height: 0,
    atlasIndex: 1070,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b3e9b',
    accentColor: '#9264c4',
    height: 0,
    atlasIndex: 1071,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b3d9b',
    accentColor: '#9464c4',
    height: 0,
    atlasIndex: 1072,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b3b9b',
    accentColor: '#9664c4',
    height: 0,
    atlasIndex: 1073,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3d3b9b',
    accentColor: '#9764c4',
    height: 0,
    atlasIndex: 1074,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#3e3b9b',
    accentColor: '#9964c4',
    height: 0,
    atlasIndex: 763,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#403b9b',
    accentColor: '#9a64c4',
    height: 0,
    atlasIndex: 764,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#413b9b',
    accentColor: '#9c64c4',
    height: 0,
    atlasIndex: 765,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#433b9b',
    accentColor: '#9e64c4',
    height: 0,
    atlasIndex: 766,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#453b9b',
    accentColor: '#9f64c4',
    height: 0,
    atlasIndex: 767,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#463b9b',
    accentColor: '#a164c4',
    height: 0,
    atlasIndex: 768,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#483b9b',
    accentColor: '#a264c4',
    height: 0,
    atlasIndex: 769,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#493b9b',
    accentColor: '#a464c4',
    height: 0,
    atlasIndex: 815,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#4b3b9b',
    accentColor: '#a664c4',
    height: 0,
    atlasIndex: 816,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#4d3b9b',
    accentColor: '#a764c4',
    height: 0,
    atlasIndex: 817,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#4e3b9b',
    accentColor: '#a964c4',
    height: 0,
    atlasIndex: 818,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#503b9b',
    accentColor: '#aa64c4',
    height: 0,
    atlasIndex: 819,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#513b9b',
    accentColor: '#ac64c4',
    height: 0,
    atlasIndex: 820,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#533b9b',
    accentColor: '#ae64c4',
    height: 0,
    atlasIndex: 821,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#553b9b',
    accentColor: '#af64c4',
    height: 0,
    atlasIndex: 867,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#563b9b',
    accentColor: '#b164c4',
    height: 0,
    atlasIndex: 868,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#583b9b',
    accentColor: '#b264c4',
    height: 0,
    atlasIndex: 869,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#593b9b',
    accentColor: '#b464c4',
    height: 0,
    atlasIndex: 870,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#5b3b9b',
    accentColor: '#b664c4',
    height: 0,
    atlasIndex: 871,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#5d3b9b',
    accentColor: '#b764c4',
    height: 0,
    atlasIndex: 872,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#5e3b9b',
    accentColor: '#b964c4',
    height: 0,
    atlasIndex: 873,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#603b9b',
    accentColor: '#ba64c4',
    height: 0,
    atlasIndex: 919,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#613b9b',
    accentColor: '#bc64c4',
    height: 0,
    atlasIndex: 920,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#633b9b',
    accentColor: '#be64c4',
    height: 0,
    atlasIndex: 921,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#653b9b',
    accentColor: '#bf64c4',
    height: 0,
    atlasIndex: 922,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#663b9b',
    accentColor: '#c164c4',
    height: 0,
    atlasIndex: 923,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#683b9b',
    accentColor: '#c264c4',
    height: 0,
    atlasIndex: 924,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#693b9b',
    accentColor: '#c464c4',
    height: 0,
    atlasIndex: 925,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#6b3b9b',
    accentColor: '#c464c2',
    height: 0,
    atlasIndex: 971,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#6d3b9b',
    accentColor: '#c464c1',
    height: 0,
    atlasIndex: 972,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#6e3b9b',
    accentColor: '#c464bf',
    height: 0,
    atlasIndex: 973,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#703b9b',
    accentColor: '#c464be',
    height: 0,
    atlasIndex: 974,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#723b9b',
    accentColor: '#c464bc',
    height: 0,
    atlasIndex: 975,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#733b9b',
    accentColor: '#c464ba',
    height: 0,
    atlasIndex: 976,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#753b9b',
    accentColor: '#c464b9',
    height: 0,
    atlasIndex: 977,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#763b9b',
    accentColor: '#c464b7',
    height: 0,
    atlasIndex: 1023,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#783b9b',
    accentColor: '#c464b6',
    height: 0,
    atlasIndex: 1024,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#7a3b9b',
    accentColor: '#c464b4',
    height: 0,
    atlasIndex: 1025,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#7b3b9b',
    accentColor: '#c464b2',
    height: 0,
    atlasIndex: 1026,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#7d3b9b',
    accentColor: '#c464b1',
    height: 0,
    atlasIndex: 1027,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#7e3b9b',
    accentColor: '#c464af',
    height: 0,
    atlasIndex: 1028,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#803b9b',
    accentColor: '#c464ae',
    height: 0,
    atlasIndex: 1029,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#823b9b',
    accentColor: '#c464ac',
    height: 0,
    atlasIndex: 1075,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#833b9b',
    accentColor: '#c464aa',
    height: 0,
    atlasIndex: 1076,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#853b9b',
    accentColor: '#c464a9',
    height: 0,
    atlasIndex: 1077,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#863b9b',
    accentColor: '#c464a7',
    height: 0,
    atlasIndex: 1078,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#883b9b',
    accentColor: '#c464a6',
    height: 0,
    atlasIndex: 1079,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#8a3b9b',
    accentColor: '#c464a4',
    height: 0,
    atlasIndex: 1080,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#8b3b9b',
    accentColor: '#c464a2',
    height: 0,
    atlasIndex: 1081,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#8d3b9b',
    accentColor: '#c464a1',
    height: 0,
    atlasIndex: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#8e3b9b',
    accentColor: '#c4649f',
    height: 0,
    atlasIndex: 2,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#903b9b',
    accentColor: '#c4649e',
    height: 0,
    atlasIndex: 3,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#923b9b',
    accentColor: '#c4649c',
    height: 0,
    atlasIndex: 4,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#933b9b',
    accentColor: '#c4649a',
    height: 0,
    atlasIndex: 5,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#953b9b',
    accentColor: '#c46499',
    height: 0,
    atlasIndex: 6,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#963b9b',
    accentColor: '#c46497',
    height: 0,
    atlasIndex: 7,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#983b9b',
    accentColor: '#c46496',
    height: 0,
    atlasIndex: 8,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9a3b9b',
    accentColor: '#c46494',
    height: 0,
    atlasIndex: 9,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b9b',
    accentColor: '#c46492',
    height: 0,
    atlasIndex: 10,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b9a',
    accentColor: '#c46491',
    height: 0,
    atlasIndex: 11,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b98',
    accentColor: '#c4648f',
    height: 0,
    atlasIndex: 12,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b96',
    accentColor: '#c4648d',
    height: 0,
    atlasIndex: 13,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b95',
    accentColor: '#c4648c',
    height: 0,
    atlasIndex: 14,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b93',
    accentColor: '#c4648a',
    height: 0,
    atlasIndex: 15,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b92',
    accentColor: '#c46489',
    height: 0,
    atlasIndex: 16,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b90',
    accentColor: '#c46487',
    height: 0,
    atlasIndex: 17,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b8e',
    accentColor: '#c46485',
    height: 0,
    atlasIndex: 18,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b8d',
    accentColor: '#c46484',
    height: 0,
    atlasIndex: 19,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b8b',
    accentColor: '#c46482',
    height: 0,
    atlasIndex: 20,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b8a',
    accentColor: '#c46481',
    height: 0,
    atlasIndex: 21,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b88',
    accentColor: '#c4647f',
    height: 0,
    atlasIndex: 22,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b86',
    accentColor: '#c4647d',
    height: 0,
    atlasIndex: 23,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b85',
    accentColor: '#c4647c',
    height: 0,
    atlasIndex: 24,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b83',
    accentColor: '#c4647a',
    height: 0,
    atlasIndex: 25,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b82',
    accentColor: '#c46479',
    height: 0,
    atlasIndex: 26,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b80',
    accentColor: '#c46477',
    height: 0,
    atlasIndex: 27,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b7e',
    accentColor: '#c46475',
    height: 0,
    atlasIndex: 28,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b7d',
    accentColor: '#c46474',
    height: 0,
    atlasIndex: 29,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b7b',
    accentColor: '#c46472',
    height: 0,
    atlasIndex: 30,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b7a',
    accentColor: '#c46471',
    height: 0,
    atlasIndex: 31,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b78',
    accentColor: '#c4646f',
    height: 0,
    atlasIndex: 32,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b76',
    accentColor: '#c4646d',
    height: 0,
    atlasIndex: 33,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b75',
    accentColor: '#c4646c',
    height: 0,
    atlasIndex: 34,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b73',
    accentColor: '#c4646a',
    height: 0,
    atlasIndex: 35,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b72',
    accentColor: '#c46469',
    height: 0,
    atlasIndex: 36,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b70',
    accentColor: '#c46467',
    height: 0,
    atlasIndex: 37,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b6e',
    accentColor: '#c46465',
    height: 0,
    atlasIndex: 38,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b6d',
    accentColor: '#c46464',
    height: 0,
    atlasIndex: 39,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b6b',
    accentColor: '#c46564',
    height: 0,
    atlasIndex: 40,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'lodge-2 ',
    walkable: true,
    color: '#9b3b69',
    accentColor: '#c46764',
    height: 0,
    atlasIndex: 41,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96
  },
  '': {
    code: '',
    label: 'wall_bottom_left ',
    walkable: true,
    color: '#9b3b68',
    accentColor: '#c46964',
    height: 0,
    atlasIndex: 666,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#9b3b66',
    accentColor: '#c46a64',
    height: 0,
    atlasIndex: 544,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#9b3b65',
    accentColor: '#c46c64',
    height: 0,
    atlasIndex: 545,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#9b3b63',
    accentColor: '#c46d64',
    height: 0,
    atlasIndex: 546,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#9b3b61',
    accentColor: '#c46f64',
    height: 0,
    atlasIndex: 547,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#9b3b60',
    accentColor: '#c47164',
    height: 0,
    atlasIndex: 548,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#9b3b5e',
    accentColor: '#c47264',
    height: 0,
    atlasIndex: 549,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#9b3b5d',
    accentColor: '#c47464',
    height: 0,
    atlasIndex: 596,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b5b',
    accentColor: '#c47564',
    height: 0,
    atlasIndex: 856,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b59',
    accentColor: '#c47764',
    height: 0,
    atlasIndex: 857,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b58',
    accentColor: '#c47964',
    height: 0,
    atlasIndex: 858,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b56',
    accentColor: '#c47a64',
    height: 0,
    atlasIndex: 859,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b55',
    accentColor: '#c47c64',
    height: 0,
    atlasIndex: 860,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b53',
    accentColor: '#c47d64',
    height: 0,
    atlasIndex: 908,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b51',
    accentColor: '#c47f64',
    height: 0,
    atlasIndex: 909,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b50',
    accentColor: '#c48164',
    height: 0,
    atlasIndex: 910,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b4e',
    accentColor: '#c48264',
    height: 0,
    atlasIndex: 911,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b4d',
    accentColor: '#c48464',
    height: 0,
    atlasIndex: 912,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b4b',
    accentColor: '#c48564',
    height: 0,
    atlasIndex: 960,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b49',
    accentColor: '#c48764',
    height: 0,
    atlasIndex: 961,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b48',
    accentColor: '#c48964',
    height: 0,
    atlasIndex: 962,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b46',
    accentColor: '#c48a64',
    height: 0,
    atlasIndex: 963,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b45',
    accentColor: '#c48c64',
    height: 0,
    atlasIndex: 964,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b43',
    accentColor: '#c48d64',
    height: 0,
    atlasIndex: 1012,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b41',
    accentColor: '#c48f64',
    height: 0,
    atlasIndex: 1013,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b40',
    accentColor: '#c49164',
    height: 0,
    atlasIndex: 1014,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b3e',
    accentColor: '#c49264',
    height: 0,
    atlasIndex: 1015,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b3d',
    accentColor: '#c49464',
    height: 0,
    atlasIndex: 1016,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b3b',
    accentColor: '#c49664',
    height: 0,
    atlasIndex: 1064,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3d3b',
    accentColor: '#c49764',
    height: 0,
    atlasIndex: 1065,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3e3b',
    accentColor: '#c49964',
    height: 0,
    atlasIndex: 1066,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b403b',
    accentColor: '#c49a64',
    height: 0,
    atlasIndex: 1067,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b413b',
    accentColor: '#c49c64',
    height: 0,
    atlasIndex: 1068,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'water1 ',
    walkable: true,
    color: '#9b433b',
    accentColor: '#c49e64',
    height: 0,
    atlasIndex: 7,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'water2 ',
    walkable: true,
    color: '#9b453b',
    accentColor: '#c49f64',
    height: 0,
    atlasIndex: 8,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'water3 ',
    walkable: true,
    color: '#9b463b',
    accentColor: '#c4a164',
    height: 0,
    atlasIndex: 9,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'ice ',
    walkable: true,
    color: '#9b483b',
    accentColor: '#c4a264',
    height: 0,
    atlasIndex: 11,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'rock1 ',
    walkable: true,
    color: '#9b493b',
    accentColor: '#c4a464',
    height: 0,
    atlasIndex: 12,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'rock2 ',
    walkable: true,
    color: '#9b4b3b',
    accentColor: '#c4a664',
    height: 0,
    atlasIndex: 13,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'rock3 ',
    walkable: true,
    color: '#9b4d3b',
    accentColor: '#c4a764',
    height: 0,
    atlasIndex: 15,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'rock4 ',
    walkable: true,
    color: '#9b4e3b',
    accentColor: '#c4a964',
    height: 0,
    atlasIndex: 17,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_red_flowers ',
    walkable: true,
    color: '#9b503b',
    accentColor: '#c4aa64',
    height: 0,
    atlasIndex: 997,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_blue_flowers ',
    walkable: true,
    color: '#9b513b',
    accentColor: '#c4ac64',
    height: 0,
    atlasIndex: 998,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'grass_yellow_flowers ',
    walkable: true,
    color: '#9b533b',
    accentColor: '#c4ae64',
    height: 0,
    atlasIndex: 999,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b553b',
    accentColor: '#c4af64',
    height: 0,
    atlasIndex: 988,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b563b',
    accentColor: '#c4b164',
    height: 0,
    atlasIndex: 989,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b583b',
    accentColor: '#c4b264',
    height: 0,
    atlasIndex: 1040,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b593b',
    accentColor: '#c4b464',
    height: 0,
    atlasIndex: 1041,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b5b3b',
    accentColor: '#c4b664',
    height: 0,
    atlasIndex: 1092,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b5d3b',
    accentColor: '#c4b764',
    height: 0,
    atlasIndex: 1093,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_fern ',
    walkable: true,
    color: '#9b5e3b',
    accentColor: '#c4b964',
    height: 0,
    atlasIndex: 1144,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_fern ',
    walkable: true,
    color: '#9b603b',
    accentColor: '#c4ba64',
    height: 0,
    atlasIndex: 1196,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b613b',
    accentColor: '#c4bc64',
    height: 0,
    atlasIndex: 990,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b633b',
    accentColor: '#c4be64',
    height: 0,
    atlasIndex: 991,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b653b',
    accentColor: '#c4bf64',
    height: 0,
    atlasIndex: 1042,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b663b',
    accentColor: '#c4c164',
    height: 0,
    atlasIndex: 1043,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b683b',
    accentColor: '#c4c264',
    height: 0,
    atlasIndex: 1094,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b693b',
    accentColor: '#c4c464',
    height: 0,
    atlasIndex: 1095,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_teal_fern ',
    walkable: true,
    color: '#9b6b3b',
    accentColor: '#c2c464',
    height: 0,
    atlasIndex: 1147,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'small_teal_fern ',
    walkable: true,
    color: '#9b6d3b',
    accentColor: '#c1c464',
    height: 0,
    atlasIndex: 1199,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b6e3b',
    accentColor: '#bfc464',
    height: 0,
    atlasIndex: 1145,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b703b',
    accentColor: '#bec464',
    height: 0,
    atlasIndex: 1146,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b723b',
    accentColor: '#bcc464',
    height: 0,
    atlasIndex: 1197,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b733b',
    accentColor: '#bac464',
    height: 0,
    atlasIndex: 1198,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b753b',
    accentColor: '#b9c464',
    height: 0,
    atlasIndex: 1249,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b763b',
    accentColor: '#b7c464',
    height: 0,
    atlasIndex: 1250,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b783b',
    accentColor: '#b6c464',
    height: 0,
    atlasIndex: 1148,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b7a3b',
    accentColor: '#b4c464',
    height: 0,
    atlasIndex: 1149,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b7b3b',
    accentColor: '#b2c464',
    height: 0,
    atlasIndex: 1200,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b7d3b',
    accentColor: '#b1c464',
    height: 0,
    atlasIndex: 1201,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b7e3b',
    accentColor: '#afc464',
    height: 0,
    atlasIndex: 1252,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b803b',
    accentColor: '#aec464',
    height: 0,
    atlasIndex: 1253,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b823b',
    accentColor: '#acc464',
    height: 0,
    atlasIndex: 8,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b833b',
    accentColor: '#aac464',
    height: 0,
    atlasIndex: 9,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b853b',
    accentColor: '#a9c464',
    height: 0,
    atlasIndex: 10,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b863b',
    accentColor: '#a7c464',
    height: 0,
    atlasIndex: 11,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b883b',
    accentColor: '#a6c464',
    height: 0,
    atlasIndex: 12,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b8a3b',
    accentColor: '#a4c464',
    height: 0,
    atlasIndex: 13,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b8b3b',
    accentColor: '#a2c464',
    height: 0,
    atlasIndex: 14,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b8d3b',
    accentColor: '#a1c464',
    height: 0,
    atlasIndex: 15,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b8e3b',
    accentColor: '#9fc464',
    height: 0,
    atlasIndex: 16,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b903b',
    accentColor: '#9ec464',
    height: 0,
    atlasIndex: 17,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b923b',
    accentColor: '#9cc464',
    height: 0,
    atlasIndex: 18,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b933b',
    accentColor: '#9ac464',
    height: 0,
    atlasIndex: 19,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b953b',
    accentColor: '#99c464',
    height: 0,
    atlasIndex: 20,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b963b',
    accentColor: '#97c464',
    height: 0,
    atlasIndex: 21,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'water4 ',
    walkable: true,
    color: '#9b983b',
    accentColor: '#96c464',
    height: 0,
    atlasIndex: 10,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b9a3b',
    accentColor: '#94c464',
    height: 0,
    atlasIndex: 22,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9b9b3b',
    accentColor: '#92c464',
    height: 0,
    atlasIndex: 23,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#9a9b3b',
    accentColor: '#91c464',
    height: 0,
    atlasIndex: 24,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#989b3b',
    accentColor: '#8fc464',
    height: 0,
    atlasIndex: 25,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#969b3b',
    accentColor: '#8dc464',
    height: 0,
    atlasIndex: 26,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#959b3b',
    accentColor: '#8cc464',
    height: 0,
    atlasIndex: 27,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#939b3b',
    accentColor: '#8ac464',
    height: 0,
    atlasIndex: 28,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#929b3b',
    accentColor: '#89c464',
    height: 0,
    atlasIndex: 29,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#909b3b',
    accentColor: '#87c464',
    height: 0,
    atlasIndex: 30,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#8e9b3b',
    accentColor: '#85c464',
    height: 0,
    atlasIndex: 31,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#8d9b3b',
    accentColor: '#84c464',
    height: 0,
    atlasIndex: 32,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#8b9b3b',
    accentColor: '#82c464',
    height: 0,
    atlasIndex: 33,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#8a9b3b',
    accentColor: '#81c464',
    height: 0,
    atlasIndex: 34,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'lodge ',
    walkable: true,
    color: '#889b3b',
    accentColor: '#7fc464',
    height: 0,
    atlasIndex: 35,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#869b3b',
    accentColor: '#7dc464',
    height: 0,
    atlasIndex: 597,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#859b3b',
    accentColor: '#7cc464',
    height: 0,
    atlasIndex: 598,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#839b3b',
    accentColor: '#7ac464',
    height: 0,
    atlasIndex: 599,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#829b3b',
    accentColor: '#79c464',
    height: 0,
    atlasIndex: 600,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#809b3b',
    accentColor: '#77c464',
    height: 0,
    atlasIndex: 601,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#7e9b3b',
    accentColor: '#75c464',
    height: 0,
    atlasIndex: 648,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#7d9b3b',
    accentColor: '#74c464',
    height: 0,
    atlasIndex: 649,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#7b9b3b',
    accentColor: '#72c464',
    height: 0,
    atlasIndex: 650,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#7a9b3b',
    accentColor: '#71c464',
    height: 0,
    atlasIndex: 651,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#789b3b',
    accentColor: '#6fc464',
    height: 0,
    atlasIndex: 652,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#769b3b',
    accentColor: '#6dc464',
    height: 0,
    atlasIndex: 653,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#759b3b',
    accentColor: '#6cc464',
    height: 0,
    atlasIndex: 700,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#739b3b',
    accentColor: '#6ac464',
    height: 0,
    atlasIndex: 701,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#729b3b',
    accentColor: '#69c464',
    height: 0,
    atlasIndex: 702,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#709b3b',
    accentColor: '#67c464',
    height: 0,
    atlasIndex: 703,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#6e9b3b',
    accentColor: '#65c464',
    height: 0,
    atlasIndex: 704,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#6d9b3b',
    accentColor: '#64c464',
    height: 0,
    atlasIndex: 705,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#6b9b3b',
    accentColor: '#64c465',
    height: 0,
    atlasIndex: 752,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#699b3b',
    accentColor: '#64c467',
    height: 0,
    atlasIndex: 753,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#689b3b',
    accentColor: '#64c469',
    height: 0,
    atlasIndex: 754,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#669b3b',
    accentColor: '#64c46a',
    height: 0,
    atlasIndex: 755,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#659b3b',
    accentColor: '#64c46c',
    height: 0,
    atlasIndex: 756,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#639b3b',
    accentColor: '#64c46d',
    height: 0,
    atlasIndex: 757,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#619b3b',
    accentColor: '#64c46f',
    height: 0,
    atlasIndex: 804,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#609b3b',
    accentColor: '#64c471',
    height: 0,
    atlasIndex: 805,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#5e9b3b',
    accentColor: '#64c472',
    height: 0,
    atlasIndex: 806,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#5d9b3b',
    accentColor: '#64c474',
    height: 0,
    atlasIndex: 807,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#5b9b3b',
    accentColor: '#64c475',
    height: 0,
    atlasIndex: 808,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'hospital ',
    walkable: true,
    color: '#599b3b',
    accentColor: '#64c477',
    height: 0,
    atlasIndex: 809,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3e9b3b',
    accentColor: '#64c492',
    height: 0,
    atlasIndex: 0,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3d9b3b',
    accentColor: '#64c494',
    height: 0,
    atlasIndex: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b3b',
    accentColor: '#64c496',
    height: 0,
    atlasIndex: 2,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b3d',
    accentColor: '#64c497',
    height: 0,
    atlasIndex: 3,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b3e',
    accentColor: '#64c499',
    height: 0,
    atlasIndex: 4,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b40',
    accentColor: '#64c49a',
    height: 0,
    atlasIndex: 5,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b41',
    accentColor: '#64c49c',
    height: 0,
    atlasIndex: 6,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b43',
    accentColor: '#64c49e',
    height: 0,
    atlasIndex: 7,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b45',
    accentColor: '#64c49f',
    height: 0,
    atlasIndex: 8,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b46',
    accentColor: '#64c4a1',
    height: 0,
    atlasIndex: 9,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b48',
    accentColor: '#64c4a2',
    height: 0,
    atlasIndex: 10,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b49',
    accentColor: '#64c4a4',
    height: 0,
    atlasIndex: 11,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b4b',
    accentColor: '#64c4a6',
    height: 0,
    atlasIndex: 12,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b4d',
    accentColor: '#64c4a7',
    height: 0,
    atlasIndex: 13,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b4e',
    accentColor: '#64c4a9',
    height: 0,
    atlasIndex: 14,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  },
  '': {
    code: '',
    label: 'healer ',
    walkable: true,
    color: '#3b9b50',
    accentColor: '#64c4aa',
    height: 0,
    atlasIndex: 15,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160
  }
};

export interface SavedPaintTileDatabaseCell {
  code: string;
  atlasIndex: number;
  dx: number;
  dy: number;
}

export interface SavedPaintTileDatabaseEntry {
  id: string;
  name: string;
  primaryCode: string;
  width: number;
  height: number;
  ySortWithActors: boolean;
  tilesetUrl?: string;
  tilePixelWidth?: number;
  tilePixelHeight?: number;
  cells: SavedPaintTileDatabaseCell[];
}

export const SAVED_PAINT_TILE_DATABASE: SavedPaintTileDatabaseEntry[] = [
  {
    id: 'blue-wall-window-1',
    name: 'blue_wall_window',
    primaryCode: '',
    width: 2,
    height: 2,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 722,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 723,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 774,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 775,
        dx: 1,
        dy: 1
      }
    ]
  },
  {
    id: 'small-teal-fern-1',
    name: 'small_teal_fern',
    primaryCode: '',
    width: 1,
    height: 2,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1147,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1199,
        dx: 0,
        dy: 1
      }
    ]
  },
  {
    id: 'beach-water-right-1',
    name: 'beach_water_right',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 736,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'beach-water-bottom-right-1',
    name: 'beach_water_bottom_right',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 788,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'wood-floor-1',
    name: 'wood_floor',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 615,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'back-wall-top-1',
    name: 'back_wall_top',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 459,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'tall-grass-1',
    name: 'tall_grass',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 3,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'rock3-1',
    name: 'rock3',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 15,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'rock4-1',
    name: 'rock4',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 17,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'grass-blue-flowers-1',
    name: 'grass_blue_flowers',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 998,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'small-fern-1',
    name: 'small_fern',
    primaryCode: '',
    width: 1,
    height: 2,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1144,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1196,
        dx: 0,
        dy: 1
      }
    ]
  },
  {
    id: 'large-teal-fern-1',
    name: 'large_teal_fern',
    primaryCode: '',
    width: 2,
    height: 3,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 990,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 991,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1042,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1043,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1094,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 1095,
        dx: 1,
        dy: 2
      }
    ]
  },
  {
    id: 'water1-1',
    name: 'water1',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 7,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'water3-1',
    name: 'water3',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 9,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'ice-1',
    name: 'ice',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 11,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'rock1-1',
    name: 'rock1',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 12,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'rock2-1',
    name: 'rock2',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 13,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'grass-red-flowers-1',
    name: 'grass_red_flowers',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 997,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'beach-water-top-right-1',
    name: 'beach_water_top_right',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 684,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'beach-water-bottom-1',
    name: 'beach_water_bottom',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 787,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'forest-tree-middle-1',
    name: 'Forest Tree Middle',
    primaryCode: '',
    width: 2,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1197,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1198,
        dx: 1,
        dy: 0
      }
    ]
  },
  {
    id: 'palm-tree1-1',
    name: 'palm_tree1',
    primaryCode: '',
    width: 2,
    height: 3,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 994,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 995,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1046,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1047,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1098,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 1099,
        dx: 1,
        dy: 2
      }
    ]
  },
  {
    id: 'grass-1',
    name: 'grass',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 0,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'sand-1',
    name: 'sand',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'snow-1',
    name: 'snow',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 2,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'hospital-1',
    name: 'hospital',
    primaryCode: '',
    width: 6,
    height: 6,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 544,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 545,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 546,
        dx: 2,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 547,
        dx: 3,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 548,
        dx: 4,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 549,
        dx: 5,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 596,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 597,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 598,
        dx: 2,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 599,
        dx: 3,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 600,
        dx: 4,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 601,
        dx: 5,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 648,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 649,
        dx: 1,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 650,
        dx: 2,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 651,
        dx: 3,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 652,
        dx: 4,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 653,
        dx: 5,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 700,
        dx: 0,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 701,
        dx: 1,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 702,
        dx: 2,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 703,
        dx: 3,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 704,
        dx: 4,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 705,
        dx: 5,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 752,
        dx: 0,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 753,
        dx: 1,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 754,
        dx: 2,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 755,
        dx: 3,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 756,
        dx: 4,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 757,
        dx: 5,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 804,
        dx: 0,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 805,
        dx: 1,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 806,
        dx: 2,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 807,
        dx: 3,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 808,
        dx: 4,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 809,
        dx: 5,
        dy: 5
      }
    ]
  },
  {
    id: 'healer-1',
    name: 'healer',
    primaryCode: '',
    width: 4,
    height: 4,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/heal.png',
    tilePixelWidth: 160,
    tilePixelHeight: 160,
    cells: [
      {
        code: '',
        atlasIndex: 0,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 2,
        dx: 2,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 3,
        dx: 3,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 4,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 5,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 6,
        dx: 2,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 7,
        dx: 3,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 8,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 9,
        dx: 1,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 10,
        dx: 2,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 11,
        dx: 3,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 12,
        dx: 0,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 13,
        dx: 1,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 14,
        dx: 2,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 15,
        dx: 3,
        dy: 3
      }
    ]
  },
  {
    id: 'water2-1',
    name: 'water2',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 8,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'grass-yellow-flowers-1',
    name: 'grass_yellow_flowers',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 999,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'large-forest-tree-1',
    name: 'large_forest_tree',
    primaryCode: '',
    width: 2,
    height: 3,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1145,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1146,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1197,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1198,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1249,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 1250,
        dx: 1,
        dy: 2
      }
    ]
  },
  {
    id: 'grass-3-blue-flower-1',
    name: 'grass_3_blue_flower',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1102,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'beach-water-left-1',
    name: 'beach_water_left',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 734,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'wall-bottom-left-1',
    name: 'wall_bottom_left',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 666,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'grass-3-yellow-flower-1',
    name: 'grass_3_yellow_flower',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1103,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'beach-water-top-left-1',
    name: 'beach_water_top_left',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 682,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'beach-water-bottom-left-1',
    name: 'beach_water_bottom_left',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 786,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'beach-corner-1',
    name: 'beach_corner',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 635,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'left-wall-1',
    name: 'left_wall',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 614,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'back-wall-bottom-1',
    name: 'back_wall_bottom',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 511,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'lodge-1',
    name: 'lodge',
    primaryCode: '',
    width: 6,
    height: 6,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/throwaway.png',
    tilePixelWidth: 112,
    tilePixelHeight: 112,
    cells: [
      {
        code: '',
        atlasIndex: 0,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 2,
        dx: 2,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 3,
        dx: 3,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 4,
        dx: 4,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 5,
        dx: 5,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 6,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 7,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 8,
        dx: 2,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 9,
        dx: 3,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 10,
        dx: 4,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 11,
        dx: 5,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 12,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 13,
        dx: 1,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 14,
        dx: 2,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 15,
        dx: 3,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 16,
        dx: 4,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 17,
        dx: 5,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 18,
        dx: 0,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 19,
        dx: 1,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 20,
        dx: 2,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 21,
        dx: 3,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 22,
        dx: 4,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 23,
        dx: 5,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 24,
        dx: 0,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 25,
        dx: 1,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 26,
        dx: 2,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 27,
        dx: 3,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 28,
        dx: 4,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 29,
        dx: 5,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 30,
        dx: 0,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 31,
        dx: 1,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 32,
        dx: 2,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 33,
        dx: 3,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 34,
        dx: 4,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 35,
        dx: 5,
        dy: 5
      }
    ]
  },
  {
    id: 'right-wall-1',
    name: 'right_wall',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 616,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'chair-1',
    name: 'chair',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 721,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'wall-bottom-1',
    name: 'wall_bottom',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 667,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'wall-top-1',
    name: 'wall_top',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 407,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'water4-1',
    name: 'water4',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 10,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'grass-path-bottom-right-1',
    name: 'grass_path_bottom_right',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 158,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'grass-path-bottom-left-1',
    name: 'grass_path_bottom_left',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 156,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'large-fern-1',
    name: 'large_fern',
    primaryCode: '',
    width: 2,
    height: 3,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 988,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 989,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1040,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1041,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1092,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 1093,
        dx: 1,
        dy: 2
      }
    ]
  },
  {
    id: 'teal-tall-grass-1',
    name: 'teal_tall_grass',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 5,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'grass-path-bottom-1',
    name: 'grass_path_bottom',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 157,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'grass-path-top-right-1',
    name: 'grass_path_top_right',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 54,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'right-wall-back-1',
    name: 'right_wall_back',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 564,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'white-chair-1',
    name: 'white_chair',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 825,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'forest-tree-middle-left-1',
    name: 'Forest Tree Middle Left',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1197,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'forest-tree-middle-right-1',
    name: 'Forest Tree Middle Right',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1198,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'forest-tree-top-1',
    name: 'Forest Tree Top',
    primaryCode: '',
    width: 2,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1145,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1146,
        dx: 1,
        dy: 0
      }
    ]
  },
  {
    id: 'forest-tree-top-left-1',
    name: 'Forest Tree Top Left',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1145,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'forest-tree-top-right-1',
    name: 'Forest Tree Top Right',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1146,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'forest-tree-base-right-1',
    name: 'Forest Tree Base Right',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1250,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'forest-tree-base-left-1',
    name: 'Forest Tree Base Left',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1249,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'sand-tall-grass-1',
    name: 'sand_tall_grass',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 4,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'tall-grass2-1',
    name: 'tall_grass2',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 6,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'forest-tree-base-1',
    name: 'Forest Tree Base',
    primaryCode: '',
    width: 2,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1249,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1250,
        dx: 1,
        dy: 0
      }
    ]
  },
  {
    id: 'large-green-house-1',
    name: 'large_green_house',
    primaryCode: '',
    width: 7,
    height: 7,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 763,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 764,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 765,
        dx: 2,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 766,
        dx: 3,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 767,
        dx: 4,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 768,
        dx: 5,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 769,
        dx: 6,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 815,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 816,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 817,
        dx: 2,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 818,
        dx: 3,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 819,
        dx: 4,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 820,
        dx: 5,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 821,
        dx: 6,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 867,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 868,
        dx: 1,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 869,
        dx: 2,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 870,
        dx: 3,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 871,
        dx: 4,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 872,
        dx: 5,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 873,
        dx: 6,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 919,
        dx: 0,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 920,
        dx: 1,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 921,
        dx: 2,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 922,
        dx: 3,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 923,
        dx: 4,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 924,
        dx: 5,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 925,
        dx: 6,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 971,
        dx: 0,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 972,
        dx: 1,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 973,
        dx: 2,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 974,
        dx: 3,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 975,
        dx: 4,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 976,
        dx: 5,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 977,
        dx: 6,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 1023,
        dx: 0,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 1024,
        dx: 1,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 1025,
        dx: 2,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 1026,
        dx: 3,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 1027,
        dx: 4,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 1028,
        dx: 5,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 1029,
        dx: 6,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 1075,
        dx: 0,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 1076,
        dx: 1,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 1077,
        dx: 2,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 1078,
        dx: 3,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 1079,
        dx: 4,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 1080,
        dx: 5,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 1081,
        dx: 6,
        dy: 6
      }
    ]
  },
  {
    id: 'path-1',
    name: 'path',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'grass-path-left-1',
    name: 'grass_path_left',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 104,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'small-purple-house-1',
    name: 'small_purple_house',
    primaryCode: '',
    width: 5,
    height: 5,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 862,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 863,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 864,
        dx: 2,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 865,
        dx: 3,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 866,
        dx: 4,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 914,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 915,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 916,
        dx: 2,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 917,
        dx: 3,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 918,
        dx: 4,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 966,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 967,
        dx: 1,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 968,
        dx: 2,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 969,
        dx: 3,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 970,
        dx: 4,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 1018,
        dx: 0,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 1019,
        dx: 1,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 1020,
        dx: 2,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 1021,
        dx: 3,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 1022,
        dx: 4,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 1070,
        dx: 0,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 1071,
        dx: 1,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 1072,
        dx: 2,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 1073,
        dx: 3,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 1074,
        dx: 4,
        dy: 4
      }
    ]
  },
  {
    id: 'table-1',
    name: 'table',
    primaryCode: '',
    width: 2,
    height: 2,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 718,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 719,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 770,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 771,
        dx: 1,
        dy: 1
      }
    ]
  },
  {
    id: 'grass-path-right-1',
    name: 'grass_path_right',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 106,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'small-shop-1',
    name: 'small_shop',
    primaryCode: '',
    width: 5,
    height: 5,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 856,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 857,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 858,
        dx: 2,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 859,
        dx: 3,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 860,
        dx: 4,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 908,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 909,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 910,
        dx: 2,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 911,
        dx: 3,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 912,
        dx: 4,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 960,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 961,
        dx: 1,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 962,
        dx: 2,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 963,
        dx: 3,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 964,
        dx: 4,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 1012,
        dx: 0,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 1013,
        dx: 1,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 1014,
        dx: 2,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 1015,
        dx: 3,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 1016,
        dx: 4,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 1064,
        dx: 0,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 1065,
        dx: 1,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 1066,
        dx: 2,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 1067,
        dx: 3,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 1068,
        dx: 4,
        dy: 4
      }
    ]
  },
  {
    id: 'palm-tree2-1',
    name: 'palm_tree2',
    primaryCode: '',
    width: 2,
    height: 3,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1150,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1151,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1202,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1203,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1254,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 1255,
        dx: 1,
        dy: 2
      }
    ]
  },
  {
    id: 'palm-bush-1',
    name: 'palm_bush',
    primaryCode: '',
    width: 1,
    height: 2,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1048,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1100,
        dx: 0,
        dy: 1
      }
    ]
  },
  {
    id: 'grass-3-red-flower-1',
    name: 'grass_3_red_flower',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1101,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'houseplant-1',
    name: 'houseplant',
    primaryCode: '',
    width: 1,
    height: 2,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 720,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 772,
        dx: 0,
        dy: 1
      }
    ]
  },
  {
    id: 'wall-top-left-1',
    name: 'wall_top_left',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 406,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'wall-top-right-1',
    name: 'wall_top_right',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 408,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'lodge-2-1',
    name: 'lodge-2',
    primaryCode: '',
    width: 6,
    height: 7,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/lodge-house2.png',
    tilePixelWidth: 160,
    tilePixelHeight: 96,
    cells: [
      {
        code: '',
        atlasIndex: 0,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 2,
        dx: 2,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 3,
        dx: 3,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 4,
        dx: 4,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 5,
        dx: 5,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 6,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 7,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 8,
        dx: 2,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 9,
        dx: 3,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 10,
        dx: 4,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 11,
        dx: 5,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 12,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 13,
        dx: 1,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 14,
        dx: 2,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 15,
        dx: 3,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 16,
        dx: 4,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 17,
        dx: 5,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 18,
        dx: 0,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 19,
        dx: 1,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 20,
        dx: 2,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 21,
        dx: 3,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 22,
        dx: 4,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 23,
        dx: 5,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 24,
        dx: 0,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 25,
        dx: 1,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 26,
        dx: 2,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 27,
        dx: 3,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 28,
        dx: 4,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 29,
        dx: 5,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 30,
        dx: 0,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 31,
        dx: 1,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 32,
        dx: 2,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 33,
        dx: 3,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 34,
        dx: 4,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 35,
        dx: 5,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 36,
        dx: 0,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 37,
        dx: 1,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 38,
        dx: 2,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 39,
        dx: 3,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 40,
        dx: 4,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 41,
        dx: 5,
        dy: 6
      }
    ]
  },
  {
    id: 'small-green-house-1',
    name: 'small_green_house',
    primaryCode: '',
    width: 5,
    height: 5,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 498,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 499,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 500,
        dx: 2,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 501,
        dx: 3,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 502,
        dx: 4,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 550,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 551,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 552,
        dx: 2,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 553,
        dx: 3,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 554,
        dx: 4,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 602,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 603,
        dx: 1,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 604,
        dx: 2,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 605,
        dx: 3,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 606,
        dx: 4,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 654,
        dx: 0,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 655,
        dx: 1,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 656,
        dx: 2,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 657,
        dx: 3,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 658,
        dx: 4,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 706,
        dx: 0,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 707,
        dx: 1,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 708,
        dx: 2,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 709,
        dx: 3,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 710,
        dx: 4,
        dy: 4
      }
    ]
  },
  {
    id: 'beach-water-top-1',
    name: 'beach_water_top',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 683,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'wood-floor-back-1',
    name: 'wood_floor_back',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 563,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'left-wall-back-1',
    name: 'left_wall_back',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 562,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'grass-path-top-left-1',
    name: 'grass_path_top_left',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 52,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'grass-path-top-1',
    name: 'grass_path_top',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: false,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 53,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'wall-bottom-right-1',
    name: 'wall_bottom_right',
    primaryCode: '',
    width: 1,
    height: 1,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 668,
        dx: 0,
        dy: 0
      }
    ]
  },
  {
    id: 'large-teal-forest-tree-1',
    name: 'large_teal_forest_tree',
    primaryCode: '',
    width: 2,
    height: 3,
    ySortWithActors: true,
    tilesetUrl: 'https://sxwyfkeallkiwgxjuenw.supabase.co/storage/v1/object/public/tilesets/tileset.png',
    tilePixelWidth: 16,
    tilePixelHeight: 16,
    cells: [
      {
        code: '',
        atlasIndex: 1148,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1149,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 1200,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1201,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 1252,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 1253,
        dx: 1,
        dy: 2
      }
    ]
  }
];
