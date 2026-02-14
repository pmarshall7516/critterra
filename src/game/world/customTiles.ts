import type { TileDefinition } from '@/game/world/types';

export interface CustomTilesetConfig {
  url: string;
  tileWidth: number;
  tileHeight: number;
}

export const CUSTOM_TILESET_CONFIG: CustomTilesetConfig | null = {
  url: '/example_assets/tileset/tileset.png',
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
    atlasIndex: 994
  },
  '': {
    code: '',
    label: 'palm_tree1 ',
    walkable: true,
    color: '#539b3b',
    accentColor: '#64c47d',
    height: 0,
    atlasIndex: 995
  },
  '': {
    code: '',
    label: 'palm_tree1 ',
    walkable: true,
    color: '#519b3b',
    accentColor: '#64c47f',
    height: 0,
    atlasIndex: 1046
  },
  '': {
    code: '',
    label: 'palm_tree1 ',
    walkable: true,
    color: '#509b3b',
    accentColor: '#64c481',
    height: 0,
    atlasIndex: 1047
  },
  '': {
    code: '',
    label: 'palm_tree1 ',
    walkable: true,
    color: '#4e9b3b',
    accentColor: '#64c482',
    height: 0,
    atlasIndex: 1098
  },
  '': {
    code: '',
    label: 'palm_tree1 ',
    walkable: true,
    color: '#4d9b3b',
    accentColor: '#64c484',
    height: 0,
    atlasIndex: 1099
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#4b9b3b',
    accentColor: '#64c485',
    height: 0,
    atlasIndex: 1150
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#499b3b',
    accentColor: '#64c487',
    height: 0,
    atlasIndex: 1151
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#489b3b',
    accentColor: '#64c489',
    height: 0,
    atlasIndex: 1202
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#469b3b',
    accentColor: '#64c48a',
    height: 0,
    atlasIndex: 1203
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#459b3b',
    accentColor: '#64c48c',
    height: 0,
    atlasIndex: 1254
  },
  '': {
    code: '',
    label: 'palm_tree2 ',
    walkable: true,
    color: '#439b3b',
    accentColor: '#64c48d',
    height: 0,
    atlasIndex: 1255
  },
  '': {
    code: '',
    label: 'palm_bush ',
    walkable: true,
    color: '#419b3b',
    accentColor: '#64c48f',
    height: 0,
    atlasIndex: 1048
  },
  '': {
    code: '',
    label: 'palm_bush ',
    walkable: true,
    color: '#409b3b',
    accentColor: '#64c491',
    height: 0,
    atlasIndex: 1100
  },
  '': {
    code: '',
    label: 'grass_3_red_flower ',
    walkable: true,
    color: '#3e9b3b',
    accentColor: '#64c492',
    height: 0,
    atlasIndex: 1101
  },
  '': {
    code: '',
    label: 'grass_3_blue_flower ',
    walkable: true,
    color: '#3d9b3b',
    accentColor: '#64c494',
    height: 0,
    atlasIndex: 1102
  },
  '': {
    code: '',
    label: 'grass_3_yellow_flower ',
    walkable: true,
    color: '#3b9b3b',
    accentColor: '#64c496',
    height: 0,
    atlasIndex: 1103
  },
  '': {
    code: '',
    label: 'beach_water_top_left ',
    walkable: true,
    color: '#3b9b3d',
    accentColor: '#64c497',
    height: 0,
    atlasIndex: 682
  },
  '': {
    code: '',
    label: 'beach_water_top ',
    walkable: true,
    color: '#3b9b3e',
    accentColor: '#64c499',
    height: 0,
    atlasIndex: 683
  },
  '': {
    code: '',
    label: 'beach_water_top_right ',
    walkable: true,
    color: '#3b9b40',
    accentColor: '#64c49a',
    height: 0,
    atlasIndex: 684
  },
  '': {
    code: '',
    label: 'beach_water_right ',
    walkable: true,
    color: '#3b9b41',
    accentColor: '#64c49c',
    height: 0,
    atlasIndex: 736
  },
  '': {
    code: '',
    label: 'beach_water_bottom_right ',
    walkable: true,
    color: '#3b9b43',
    accentColor: '#64c49e',
    height: 0,
    atlasIndex: 788
  },
  '': {
    code: '',
    label: 'beach_water_bottom ',
    walkable: true,
    color: '#3b9b45',
    accentColor: '#64c49f',
    height: 0,
    atlasIndex: 787
  },
  '': {
    code: '',
    label: 'beach_water_bottom_left ',
    walkable: true,
    color: '#3b9b46',
    accentColor: '#64c4a1',
    height: 0,
    atlasIndex: 786
  },
  '': {
    code: '',
    label: 'beach_water_left ',
    walkable: true,
    color: '#3b9b48',
    accentColor: '#64c4a2',
    height: 0,
    atlasIndex: 734
  },
  '': {
    code: '',
    label: 'beach_corner ',
    walkable: true,
    color: '#3b9b49',
    accentColor: '#64c4a4',
    height: 0,
    atlasIndex: 635
  },
  '': {
    code: '',
    label: 'grass_path_left ',
    walkable: true,
    color: '#3b9b4b',
    accentColor: '#64c4a6',
    height: 0,
    atlasIndex: 104
  },
  '': {
    code: '',
    label: 'wood_floor ',
    walkable: true,
    color: '#3b9b4d',
    accentColor: '#64c4a7',
    height: 0,
    atlasIndex: 615
  },
  '': {
    code: '',
    label: 'wood_floor_back ',
    walkable: true,
    color: '#3b9b4e',
    accentColor: '#64c4a9',
    height: 0,
    atlasIndex: 563
  },
  '': {
    code: '',
    label: 'right_wall ',
    walkable: true,
    color: '#3b9b50',
    accentColor: '#64c4aa',
    height: 0,
    atlasIndex: 616
  },
  '': {
    code: '',
    label: 'right_wall_back ',
    walkable: true,
    color: '#3b9b51',
    accentColor: '#64c4ac',
    height: 0,
    atlasIndex: 564
  },
  '': {
    code: '',
    label: 'left_wall ',
    walkable: true,
    color: '#3b9b53',
    accentColor: '#64c4ae',
    height: 0,
    atlasIndex: 614
  },
  '': {
    code: '',
    label: 'left_wall_back ',
    walkable: true,
    color: '#3b9b55',
    accentColor: '#64c4af',
    height: 0,
    atlasIndex: 562
  },
  '': {
    code: '',
    label: 'back_wall_bottom ',
    walkable: true,
    color: '#3b9b56',
    accentColor: '#64c4b1',
    height: 0,
    atlasIndex: 511
  },
  '': {
    code: '',
    label: 'back_wall_top ',
    walkable: true,
    color: '#3b9b58',
    accentColor: '#64c4b2',
    height: 0,
    atlasIndex: 459
  },
  '': {
    code: '',
    label: 'blue_wall_window ',
    walkable: true,
    color: '#3b9b59',
    accentColor: '#64c4b4',
    height: 0,
    atlasIndex: 722
  },
  '': {
    code: '',
    label: 'blue_wall_window ',
    walkable: true,
    color: '#3b9b5b',
    accentColor: '#64c4b6',
    height: 0,
    atlasIndex: 723
  },
  '': {
    code: '',
    label: 'blue_wall_window ',
    walkable: true,
    color: '#3b9b5d',
    accentColor: '#64c4b7',
    height: 0,
    atlasIndex: 774
  },
  '': {
    code: '',
    label: 'blue_wall_window ',
    walkable: true,
    color: '#3b9b5e',
    accentColor: '#64c4b9',
    height: 0,
    atlasIndex: 775
  },
  '': {
    code: '',
    label: 'table ',
    walkable: true,
    color: '#3b9b60',
    accentColor: '#64c4ba',
    height: 0,
    atlasIndex: 718
  },
  '': {
    code: '',
    label: 'table ',
    walkable: true,
    color: '#3b9b61',
    accentColor: '#64c4bc',
    height: 0,
    atlasIndex: 719
  },
  '': {
    code: '',
    label: 'table ',
    walkable: true,
    color: '#3b9b63',
    accentColor: '#64c4be',
    height: 0,
    atlasIndex: 770
  },
  '': {
    code: '',
    label: 'table ',
    walkable: true,
    color: '#3b9b65',
    accentColor: '#64c4bf',
    height: 0,
    atlasIndex: 771
  },
  '': {
    code: '',
    label: 'chair ',
    walkable: true,
    color: '#3b9b66',
    accentColor: '#64c4c1',
    height: 0,
    atlasIndex: 721
  },
  '': {
    code: '',
    label: 'houseplant ',
    walkable: true,
    color: '#3b9b68',
    accentColor: '#64c4c2',
    height: 0,
    atlasIndex: 720
  },
  '': {
    code: '',
    label: 'houseplant ',
    walkable: true,
    color: '#3b9b69',
    accentColor: '#64c4c4',
    height: 0,
    atlasIndex: 772
  },
  '': {
    code: '',
    label: 'white_chair ',
    walkable: true,
    color: '#3b9b6b',
    accentColor: '#64c2c4',
    height: 0,
    atlasIndex: 825
  },
  '': {
    code: '',
    label: 'wall_bottom_right ',
    walkable: true,
    color: '#3b9b6d',
    accentColor: '#64c1c4',
    height: 0,
    atlasIndex: 668
  },
  '': {
    code: '',
    label: 'wall_bottom_left ',
    walkable: true,
    color: '#3b9b6e',
    accentColor: '#64bfc4',
    height: 0,
    atlasIndex: 666
  },
  '': {
    code: '',
    label: 'wall_bottom ',
    walkable: true,
    color: '#3b9b70',
    accentColor: '#64bec4',
    height: 0,
    atlasIndex: 667
  },
  '': {
    code: '',
    label: 'wall_top ',
    walkable: true,
    color: '#3b9b72',
    accentColor: '#64bcc4',
    height: 0,
    atlasIndex: 407
  },
  '': {
    code: '',
    label: 'wall_top_left ',
    walkable: true,
    color: '#3b9b73',
    accentColor: '#64bac4',
    height: 0,
    atlasIndex: 406
  },
  '': {
    code: '',
    label: 'wall_top_right ',
    walkable: true,
    color: '#3b9b75',
    accentColor: '#64b9c4',
    height: 0,
    atlasIndex: 408
  },
  '': {
    code: '',
    label: 'tall_grass ',
    walkable: true,
    color: '#3b9b76',
    accentColor: '#64b7c4',
    height: 0,
    atlasIndex: 3
  },
  '': {
    code: '',
    label: 'sand_tall_grass ',
    walkable: true,
    color: '#3b9b78',
    accentColor: '#64b6c4',
    height: 0,
    atlasIndex: 4
  },
  '': {
    code: '',
    label: 'teal_tall_grass ',
    walkable: true,
    color: '#3b9b7a',
    accentColor: '#64b4c4',
    height: 0,
    atlasIndex: 5
  },
  '': {
    code: '',
    label: 'tall_grass2 ',
    walkable: true,
    color: '#3b9b7b',
    accentColor: '#64b2c4',
    height: 0,
    atlasIndex: 6
  },
  '': {
    code: '',
    label: 'grass ',
    walkable: true,
    color: '#3b9b8e',
    accentColor: '#649fc4',
    height: 0,
    atlasIndex: 0
  },
  '': {
    code: '',
    label: 'sand ',
    walkable: true,
    color: '#3b9b90',
    accentColor: '#649ec4',
    height: 0,
    atlasIndex: 1
  },
  '': {
    code: '',
    label: 'snow ',
    walkable: true,
    color: '#3b9b92',
    accentColor: '#649cc4',
    height: 0,
    atlasIndex: 2
  },
  '': {
    code: '',
    label: 'grass_path_top_left ',
    walkable: true,
    color: '#3b9b93',
    accentColor: '#649ac4',
    height: 0,
    atlasIndex: 52
  },
  '': {
    code: '',
    label: 'grass_path_top ',
    walkable: true,
    color: '#3b9b95',
    accentColor: '#6499c4',
    height: 0,
    atlasIndex: 53
  },
  '': {
    code: '',
    label: 'grass_path_top_right ',
    walkable: true,
    color: '#3b9b96',
    accentColor: '#6497c4',
    height: 0,
    atlasIndex: 54
  },
  '': {
    code: '',
    label: 'grass_path_right ',
    walkable: true,
    color: '#3b9b98',
    accentColor: '#6496c4',
    height: 0,
    atlasIndex: 106
  },
  '': {
    code: '',
    label: 'grass_path_bottom_right ',
    walkable: true,
    color: '#3b9b9a',
    accentColor: '#6494c4',
    height: 0,
    atlasIndex: 158
  },
  '': {
    code: '',
    label: 'grass_path_bottom ',
    walkable: true,
    color: '#3b989b',
    accentColor: '#648fc4',
    height: 0,
    atlasIndex: 157
  },
  '': {
    code: '',
    label: 'grass_path_bottom_left ',
    walkable: true,
    color: '#3b969b',
    accentColor: '#648dc4',
    height: 0,
    atlasIndex: 156
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b889b',
    accentColor: '#647fc4',
    height: 0,
    atlasIndex: 498
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b869b',
    accentColor: '#647dc4',
    height: 0,
    atlasIndex: 499
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b859b',
    accentColor: '#647cc4',
    height: 0,
    atlasIndex: 500
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b839b',
    accentColor: '#647ac4',
    height: 0,
    atlasIndex: 501
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b829b',
    accentColor: '#6479c4',
    height: 0,
    atlasIndex: 502
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b809b',
    accentColor: '#6477c4',
    height: 0,
    atlasIndex: 550
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b7e9b',
    accentColor: '#6475c4',
    height: 0,
    atlasIndex: 551
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b7d9b',
    accentColor: '#6474c4',
    height: 0,
    atlasIndex: 552
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b7b9b',
    accentColor: '#6472c4',
    height: 0,
    atlasIndex: 553
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b7a9b',
    accentColor: '#6471c4',
    height: 0,
    atlasIndex: 554
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b789b',
    accentColor: '#646fc4',
    height: 0,
    atlasIndex: 602
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b769b',
    accentColor: '#646dc4',
    height: 0,
    atlasIndex: 603
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b759b',
    accentColor: '#646cc4',
    height: 0,
    atlasIndex: 604
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b739b',
    accentColor: '#646ac4',
    height: 0,
    atlasIndex: 605
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b729b',
    accentColor: '#6469c4',
    height: 0,
    atlasIndex: 606
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b709b',
    accentColor: '#6467c4',
    height: 0,
    atlasIndex: 654
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b6e9b',
    accentColor: '#6465c4',
    height: 0,
    atlasIndex: 655
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b6d9b',
    accentColor: '#6464c4',
    height: 0,
    atlasIndex: 656
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b6b9b',
    accentColor: '#6564c4',
    height: 0,
    atlasIndex: 657
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b699b',
    accentColor: '#6764c4',
    height: 0,
    atlasIndex: 658
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b689b',
    accentColor: '#6964c4',
    height: 0,
    atlasIndex: 706
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b669b',
    accentColor: '#6a64c4',
    height: 0,
    atlasIndex: 707
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b659b',
    accentColor: '#6c64c4',
    height: 0,
    atlasIndex: 708
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b639b',
    accentColor: '#6d64c4',
    height: 0,
    atlasIndex: 709
  },
  '': {
    code: '',
    label: 'small_green_house ',
    walkable: true,
    color: '#3b619b',
    accentColor: '#6f64c4',
    height: 0,
    atlasIndex: 710
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b609b',
    accentColor: '#7164c4',
    height: 0,
    atlasIndex: 862
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b5e9b',
    accentColor: '#7264c4',
    height: 0,
    atlasIndex: 863
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b5d9b',
    accentColor: '#7464c4',
    height: 0,
    atlasIndex: 864
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b5b9b',
    accentColor: '#7564c4',
    height: 0,
    atlasIndex: 865
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b599b',
    accentColor: '#7764c4',
    height: 0,
    atlasIndex: 866
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b589b',
    accentColor: '#7964c4',
    height: 0,
    atlasIndex: 914
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b569b',
    accentColor: '#7a64c4',
    height: 0,
    atlasIndex: 915
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b559b',
    accentColor: '#7c64c4',
    height: 0,
    atlasIndex: 916
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b539b',
    accentColor: '#7d64c4',
    height: 0,
    atlasIndex: 917
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b519b',
    accentColor: '#7f64c4',
    height: 0,
    atlasIndex: 918
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b509b',
    accentColor: '#8164c4',
    height: 0,
    atlasIndex: 966
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b4e9b',
    accentColor: '#8264c4',
    height: 0,
    atlasIndex: 967
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b4d9b',
    accentColor: '#8464c4',
    height: 0,
    atlasIndex: 968
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b4b9b',
    accentColor: '#8564c4',
    height: 0,
    atlasIndex: 969
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b499b',
    accentColor: '#8764c4',
    height: 0,
    atlasIndex: 970
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b489b',
    accentColor: '#8964c4',
    height: 0,
    atlasIndex: 1018
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b469b',
    accentColor: '#8a64c4',
    height: 0,
    atlasIndex: 1019
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b459b',
    accentColor: '#8c64c4',
    height: 0,
    atlasIndex: 1020
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b439b',
    accentColor: '#8d64c4',
    height: 0,
    atlasIndex: 1021
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b419b',
    accentColor: '#8f64c4',
    height: 0,
    atlasIndex: 1022
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b409b',
    accentColor: '#9164c4',
    height: 0,
    atlasIndex: 1070
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b3e9b',
    accentColor: '#9264c4',
    height: 0,
    atlasIndex: 1071
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b3d9b',
    accentColor: '#9464c4',
    height: 0,
    atlasIndex: 1072
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3b3b9b',
    accentColor: '#9664c4',
    height: 0,
    atlasIndex: 1073
  },
  '': {
    code: '',
    label: 'small_purple_house ',
    walkable: true,
    color: '#3d3b9b',
    accentColor: '#9764c4',
    height: 0,
    atlasIndex: 1074
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#3e3b9b',
    accentColor: '#9964c4',
    height: 0,
    atlasIndex: 763
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#403b9b',
    accentColor: '#9a64c4',
    height: 0,
    atlasIndex: 764
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#413b9b',
    accentColor: '#9c64c4',
    height: 0,
    atlasIndex: 765
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#433b9b',
    accentColor: '#9e64c4',
    height: 0,
    atlasIndex: 766
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#453b9b',
    accentColor: '#9f64c4',
    height: 0,
    atlasIndex: 767
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#463b9b',
    accentColor: '#a164c4',
    height: 0,
    atlasIndex: 768
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#483b9b',
    accentColor: '#a264c4',
    height: 0,
    atlasIndex: 769
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#493b9b',
    accentColor: '#a464c4',
    height: 0,
    atlasIndex: 815
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#4b3b9b',
    accentColor: '#a664c4',
    height: 0,
    atlasIndex: 816
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#4d3b9b',
    accentColor: '#a764c4',
    height: 0,
    atlasIndex: 817
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#4e3b9b',
    accentColor: '#a964c4',
    height: 0,
    atlasIndex: 818
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#503b9b',
    accentColor: '#aa64c4',
    height: 0,
    atlasIndex: 819
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#513b9b',
    accentColor: '#ac64c4',
    height: 0,
    atlasIndex: 820
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#533b9b',
    accentColor: '#ae64c4',
    height: 0,
    atlasIndex: 821
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#553b9b',
    accentColor: '#af64c4',
    height: 0,
    atlasIndex: 867
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#563b9b',
    accentColor: '#b164c4',
    height: 0,
    atlasIndex: 868
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#583b9b',
    accentColor: '#b264c4',
    height: 0,
    atlasIndex: 869
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#593b9b',
    accentColor: '#b464c4',
    height: 0,
    atlasIndex: 870
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#5b3b9b',
    accentColor: '#b664c4',
    height: 0,
    atlasIndex: 871
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#5d3b9b',
    accentColor: '#b764c4',
    height: 0,
    atlasIndex: 872
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#5e3b9b',
    accentColor: '#b964c4',
    height: 0,
    atlasIndex: 873
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#603b9b',
    accentColor: '#ba64c4',
    height: 0,
    atlasIndex: 919
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#613b9b',
    accentColor: '#bc64c4',
    height: 0,
    atlasIndex: 920
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#633b9b',
    accentColor: '#be64c4',
    height: 0,
    atlasIndex: 921
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#653b9b',
    accentColor: '#bf64c4',
    height: 0,
    atlasIndex: 922
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#663b9b',
    accentColor: '#c164c4',
    height: 0,
    atlasIndex: 923
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#683b9b',
    accentColor: '#c264c4',
    height: 0,
    atlasIndex: 924
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#693b9b',
    accentColor: '#c464c4',
    height: 0,
    atlasIndex: 925
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#6b3b9b',
    accentColor: '#c464c2',
    height: 0,
    atlasIndex: 971
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#6d3b9b',
    accentColor: '#c464c1',
    height: 0,
    atlasIndex: 972
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#6e3b9b',
    accentColor: '#c464bf',
    height: 0,
    atlasIndex: 973
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#703b9b',
    accentColor: '#c464be',
    height: 0,
    atlasIndex: 974
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#723b9b',
    accentColor: '#c464bc',
    height: 0,
    atlasIndex: 975
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#733b9b',
    accentColor: '#c464ba',
    height: 0,
    atlasIndex: 976
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#753b9b',
    accentColor: '#c464b9',
    height: 0,
    atlasIndex: 977
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#763b9b',
    accentColor: '#c464b7',
    height: 0,
    atlasIndex: 1023
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#783b9b',
    accentColor: '#c464b6',
    height: 0,
    atlasIndex: 1024
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#7a3b9b',
    accentColor: '#c464b4',
    height: 0,
    atlasIndex: 1025
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#7b3b9b',
    accentColor: '#c464b2',
    height: 0,
    atlasIndex: 1026
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#7d3b9b',
    accentColor: '#c464b1',
    height: 0,
    atlasIndex: 1027
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#7e3b9b',
    accentColor: '#c464af',
    height: 0,
    atlasIndex: 1028
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#803b9b',
    accentColor: '#c464ae',
    height: 0,
    atlasIndex: 1029
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#823b9b',
    accentColor: '#c464ac',
    height: 0,
    atlasIndex: 1075
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#833b9b',
    accentColor: '#c464aa',
    height: 0,
    atlasIndex: 1076
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#853b9b',
    accentColor: '#c464a9',
    height: 0,
    atlasIndex: 1077
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#863b9b',
    accentColor: '#c464a7',
    height: 0,
    atlasIndex: 1078
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#883b9b',
    accentColor: '#c464a6',
    height: 0,
    atlasIndex: 1079
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#8a3b9b',
    accentColor: '#c464a4',
    height: 0,
    atlasIndex: 1080
  },
  '': {
    code: '',
    label: 'large_green_house ',
    walkable: true,
    color: '#8b3b9b',
    accentColor: '#c464a2',
    height: 0,
    atlasIndex: 1081
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#8d3b9b',
    accentColor: '#c464a1',
    height: 0,
    atlasIndex: 399
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#8e3b9b',
    accentColor: '#c4649f',
    height: 0,
    atlasIndex: 400
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#903b9b',
    accentColor: '#c4649e',
    height: 0,
    atlasIndex: 401
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#923b9b',
    accentColor: '#c4649c',
    height: 0,
    atlasIndex: 402
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#933b9b',
    accentColor: '#c4649a',
    height: 0,
    atlasIndex: 403
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#953b9b',
    accentColor: '#c46499',
    height: 0,
    atlasIndex: 404
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#963b9b',
    accentColor: '#c46497',
    height: 0,
    atlasIndex: 405
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#983b9b',
    accentColor: '#c46496',
    height: 0,
    atlasIndex: 451
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9a3b9b',
    accentColor: '#c46494',
    height: 0,
    atlasIndex: 452
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b9b',
    accentColor: '#c46492',
    height: 0,
    atlasIndex: 453
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b9a',
    accentColor: '#c46491',
    height: 0,
    atlasIndex: 454
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b98',
    accentColor: '#c4648f',
    height: 0,
    atlasIndex: 455
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b96',
    accentColor: '#c4648d',
    height: 0,
    atlasIndex: 456
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b95',
    accentColor: '#c4648c',
    height: 0,
    atlasIndex: 457
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b93',
    accentColor: '#c4648a',
    height: 0,
    atlasIndex: 503
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b92',
    accentColor: '#c46489',
    height: 0,
    atlasIndex: 504
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b90',
    accentColor: '#c46487',
    height: 0,
    atlasIndex: 505
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b8e',
    accentColor: '#c46485',
    height: 0,
    atlasIndex: 506
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b8d',
    accentColor: '#c46484',
    height: 0,
    atlasIndex: 507
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b8b',
    accentColor: '#c46482',
    height: 0,
    atlasIndex: 508
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b8a',
    accentColor: '#c46481',
    height: 0,
    atlasIndex: 509
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b88',
    accentColor: '#c4647f',
    height: 0,
    atlasIndex: 555
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b86',
    accentColor: '#c4647d',
    height: 0,
    atlasIndex: 556
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b85',
    accentColor: '#c4647c',
    height: 0,
    atlasIndex: 557
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b83',
    accentColor: '#c4647a',
    height: 0,
    atlasIndex: 558
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b82',
    accentColor: '#c46479',
    height: 0,
    atlasIndex: 559
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b80',
    accentColor: '#c46477',
    height: 0,
    atlasIndex: 560
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b7e',
    accentColor: '#c46475',
    height: 0,
    atlasIndex: 561
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b7d',
    accentColor: '#c46474',
    height: 0,
    atlasIndex: 607
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b7b',
    accentColor: '#c46472',
    height: 0,
    atlasIndex: 608
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b7a',
    accentColor: '#c46471',
    height: 0,
    atlasIndex: 609
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b78',
    accentColor: '#c4646f',
    height: 0,
    atlasIndex: 610
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b76',
    accentColor: '#c4646d',
    height: 0,
    atlasIndex: 611
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b75',
    accentColor: '#c4646c',
    height: 0,
    atlasIndex: 612
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b73',
    accentColor: '#c4646a',
    height: 0,
    atlasIndex: 613
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b72',
    accentColor: '#c46469',
    height: 0,
    atlasIndex: 659
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b70',
    accentColor: '#c46467',
    height: 0,
    atlasIndex: 660
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b6e',
    accentColor: '#c46465',
    height: 0,
    atlasIndex: 661
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b6d',
    accentColor: '#c46464',
    height: 0,
    atlasIndex: 662
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b6b',
    accentColor: '#c46564',
    height: 0,
    atlasIndex: 663
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b69',
    accentColor: '#c46764',
    height: 0,
    atlasIndex: 664
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b68',
    accentColor: '#c46964',
    height: 0,
    atlasIndex: 665
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b66',
    accentColor: '#c46a64',
    height: 0,
    atlasIndex: 711
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b65',
    accentColor: '#c46c64',
    height: 0,
    atlasIndex: 712
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b63',
    accentColor: '#c46d64',
    height: 0,
    atlasIndex: 713
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b61',
    accentColor: '#c46f64',
    height: 0,
    atlasIndex: 714
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b60',
    accentColor: '#c47164',
    height: 0,
    atlasIndex: 715
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b5e',
    accentColor: '#c47264',
    height: 0,
    atlasIndex: 716
  },
  '': {
    code: '',
    label: 'large_purple_house ',
    walkable: true,
    color: '#9b3b5d',
    accentColor: '#c47464',
    height: 0,
    atlasIndex: 717
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b5b',
    accentColor: '#c47564',
    height: 0,
    atlasIndex: 856
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b59',
    accentColor: '#c47764',
    height: 0,
    atlasIndex: 857
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b58',
    accentColor: '#c47964',
    height: 0,
    atlasIndex: 858
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b56',
    accentColor: '#c47a64',
    height: 0,
    atlasIndex: 859
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b55',
    accentColor: '#c47c64',
    height: 0,
    atlasIndex: 860
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b53',
    accentColor: '#c47d64',
    height: 0,
    atlasIndex: 908
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b51',
    accentColor: '#c47f64',
    height: 0,
    atlasIndex: 909
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b50',
    accentColor: '#c48164',
    height: 0,
    atlasIndex: 910
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b4e',
    accentColor: '#c48264',
    height: 0,
    atlasIndex: 911
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b4d',
    accentColor: '#c48464',
    height: 0,
    atlasIndex: 912
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b4b',
    accentColor: '#c48564',
    height: 0,
    atlasIndex: 960
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b49',
    accentColor: '#c48764',
    height: 0,
    atlasIndex: 961
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b48',
    accentColor: '#c48964',
    height: 0,
    atlasIndex: 962
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b46',
    accentColor: '#c48a64',
    height: 0,
    atlasIndex: 963
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b45',
    accentColor: '#c48c64',
    height: 0,
    atlasIndex: 964
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b43',
    accentColor: '#c48d64',
    height: 0,
    atlasIndex: 1012
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b41',
    accentColor: '#c48f64',
    height: 0,
    atlasIndex: 1013
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b40',
    accentColor: '#c49164',
    height: 0,
    atlasIndex: 1014
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b3e',
    accentColor: '#c49264',
    height: 0,
    atlasIndex: 1015
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b3d',
    accentColor: '#c49464',
    height: 0,
    atlasIndex: 1016
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3b3b',
    accentColor: '#c49664',
    height: 0,
    atlasIndex: 1064
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3d3b',
    accentColor: '#c49764',
    height: 0,
    atlasIndex: 1065
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b3e3b',
    accentColor: '#c49964',
    height: 0,
    atlasIndex: 1066
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b403b',
    accentColor: '#c49a64',
    height: 0,
    atlasIndex: 1067
  },
  '': {
    code: '',
    label: 'small_shop ',
    walkable: true,
    color: '#9b413b',
    accentColor: '#c49c64',
    height: 0,
    atlasIndex: 1068
  },
  '': {
    code: '',
    label: 'water1 ',
    walkable: true,
    color: '#9b433b',
    accentColor: '#c49e64',
    height: 0,
    atlasIndex: 7
  },
  '': {
    code: '',
    label: 'water2 ',
    walkable: true,
    color: '#9b453b',
    accentColor: '#c49f64',
    height: 0,
    atlasIndex: 8
  },
  '': {
    code: '',
    label: 'water3 ',
    walkable: true,
    color: '#9b463b',
    accentColor: '#c4a164',
    height: 0,
    atlasIndex: 9
  },
  '': {
    code: '',
    label: 'ice ',
    walkable: true,
    color: '#9b483b',
    accentColor: '#c4a264',
    height: 0,
    atlasIndex: 11
  },
  '': {
    code: '',
    label: 'rock1 ',
    walkable: true,
    color: '#9b493b',
    accentColor: '#c4a464',
    height: 0,
    atlasIndex: 12
  },
  '': {
    code: '',
    label: 'rock2 ',
    walkable: true,
    color: '#9b4b3b',
    accentColor: '#c4a664',
    height: 0,
    atlasIndex: 13
  },
  '': {
    code: '',
    label: 'rock3 ',
    walkable: true,
    color: '#9b4d3b',
    accentColor: '#c4a764',
    height: 0,
    atlasIndex: 15
  },
  '': {
    code: '',
    label: 'rock4 ',
    walkable: true,
    color: '#9b4e3b',
    accentColor: '#c4a964',
    height: 0,
    atlasIndex: 17
  },
  '': {
    code: '',
    label: 'grass_red_flowers ',
    walkable: true,
    color: '#9b503b',
    accentColor: '#c4aa64',
    height: 0,
    atlasIndex: 997
  },
  '': {
    code: '',
    label: 'grass_blue_flowers ',
    walkable: true,
    color: '#9b513b',
    accentColor: '#c4ac64',
    height: 0,
    atlasIndex: 998
  },
  '': {
    code: '',
    label: 'grass_yellow_flowers ',
    walkable: true,
    color: '#9b533b',
    accentColor: '#c4ae64',
    height: 0,
    atlasIndex: 999
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b553b',
    accentColor: '#c4af64',
    height: 0,
    atlasIndex: 988
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b563b',
    accentColor: '#c4b164',
    height: 0,
    atlasIndex: 989
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b583b',
    accentColor: '#c4b264',
    height: 0,
    atlasIndex: 1040
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b593b',
    accentColor: '#c4b464',
    height: 0,
    atlasIndex: 1041
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b5b3b',
    accentColor: '#c4b664',
    height: 0,
    atlasIndex: 1092
  },
  '': {
    code: '',
    label: 'large_fern ',
    walkable: true,
    color: '#9b5d3b',
    accentColor: '#c4b764',
    height: 0,
    atlasIndex: 1093
  },
  '': {
    code: '',
    label: 'small_fern ',
    walkable: true,
    color: '#9b5e3b',
    accentColor: '#c4b964',
    height: 0,
    atlasIndex: 1144
  },
  '': {
    code: '',
    label: 'small_fern ',
    walkable: true,
    color: '#9b603b',
    accentColor: '#c4ba64',
    height: 0,
    atlasIndex: 1196
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b613b',
    accentColor: '#c4bc64',
    height: 0,
    atlasIndex: 990
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b633b',
    accentColor: '#c4be64',
    height: 0,
    atlasIndex: 991
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b653b',
    accentColor: '#c4bf64',
    height: 0,
    atlasIndex: 1042
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b663b',
    accentColor: '#c4c164',
    height: 0,
    atlasIndex: 1043
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b683b',
    accentColor: '#c4c264',
    height: 0,
    atlasIndex: 1094
  },
  '': {
    code: '',
    label: 'large_teal_fern ',
    walkable: true,
    color: '#9b693b',
    accentColor: '#c4c464',
    height: 0,
    atlasIndex: 1095
  },
  '': {
    code: '',
    label: 'small_teal_fern ',
    walkable: true,
    color: '#9b6b3b',
    accentColor: '#c2c464',
    height: 0,
    atlasIndex: 1147
  },
  '': {
    code: '',
    label: 'small_teal_fern ',
    walkable: true,
    color: '#9b6d3b',
    accentColor: '#c1c464',
    height: 0,
    atlasIndex: 1199
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b6e3b',
    accentColor: '#bfc464',
    height: 0,
    atlasIndex: 1145
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b703b',
    accentColor: '#bec464',
    height: 0,
    atlasIndex: 1146
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b723b',
    accentColor: '#bcc464',
    height: 0,
    atlasIndex: 1197
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b733b',
    accentColor: '#bac464',
    height: 0,
    atlasIndex: 1198
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b753b',
    accentColor: '#b9c464',
    height: 0,
    atlasIndex: 1249
  },
  '': {
    code: '',
    label: 'large_forest_tree ',
    walkable: true,
    color: '#9b763b',
    accentColor: '#b7c464',
    height: 0,
    atlasIndex: 1250
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b783b',
    accentColor: '#b6c464',
    height: 0,
    atlasIndex: 1148
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b7a3b',
    accentColor: '#b4c464',
    height: 0,
    atlasIndex: 1149
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b7b3b',
    accentColor: '#b2c464',
    height: 0,
    atlasIndex: 1200
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b7d3b',
    accentColor: '#b1c464',
    height: 0,
    atlasIndex: 1201
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b7e3b',
    accentColor: '#afc464',
    height: 0,
    atlasIndex: 1252
  },
  '': {
    code: '',
    label: 'large_teal_forest_tree ',
    walkable: true,
    color: '#9b803b',
    accentColor: '#aec464',
    height: 0,
    atlasIndex: 1253
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
  cells: SavedPaintTileDatabaseCell[];
}

export const SAVED_PAINT_TILE_DATABASE: SavedPaintTileDatabaseEntry[] = [
  {
    id: 'grass-1',
    name: 'grass',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'grass-path-top-left-1',
    name: 'grass_path_top_left',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'grass-path-top-right-1',
    name: 'grass_path_top_right',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'grass-path-right-1',
    name: 'grass_path_right',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'grass-path-bottom-right-1',
    name: 'grass_path_bottom_right',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'grass-path-bottom-1',
    name: 'grass_path_bottom',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'grass-path-bottom-left-1',
    name: 'grass_path_bottom_left',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'grass-path-left-1',
    name: 'grass_path_left',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'small-green-house-1',
    name: 'small_green_house',
    primaryCode: '',
    width: 5,
    height: 5,
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
    id: 'small-purple-house-1',
    name: 'small_purple_house',
    primaryCode: '',
    width: 5,
    height: 5,
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
    id: 'large-green-house-1',
    name: 'large_green_house',
    primaryCode: '',
    width: 7,
    height: 7,
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
    id: 'large-purple-house-1',
    name: 'large_purple_house',
    primaryCode: '',
    width: 7,
    height: 7,
    cells: [
      {
        code: '',
        atlasIndex: 399,
        dx: 0,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 400,
        dx: 1,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 401,
        dx: 2,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 402,
        dx: 3,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 403,
        dx: 4,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 404,
        dx: 5,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 405,
        dx: 6,
        dy: 0
      },
      {
        code: '',
        atlasIndex: 451,
        dx: 0,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 452,
        dx: 1,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 453,
        dx: 2,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 454,
        dx: 3,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 455,
        dx: 4,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 456,
        dx: 5,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 457,
        dx: 6,
        dy: 1
      },
      {
        code: '',
        atlasIndex: 503,
        dx: 0,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 504,
        dx: 1,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 505,
        dx: 2,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 506,
        dx: 3,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 507,
        dx: 4,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 508,
        dx: 5,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 509,
        dx: 6,
        dy: 2
      },
      {
        code: '',
        atlasIndex: 555,
        dx: 0,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 556,
        dx: 1,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 557,
        dx: 2,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 558,
        dx: 3,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 559,
        dx: 4,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 560,
        dx: 5,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 561,
        dx: 6,
        dy: 3
      },
      {
        code: '',
        atlasIndex: 607,
        dx: 0,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 608,
        dx: 1,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 609,
        dx: 2,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 610,
        dx: 3,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 611,
        dx: 4,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 612,
        dx: 5,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 613,
        dx: 6,
        dy: 4
      },
      {
        code: '',
        atlasIndex: 659,
        dx: 0,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 660,
        dx: 1,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 661,
        dx: 2,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 662,
        dx: 3,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 663,
        dx: 4,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 664,
        dx: 5,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 665,
        dx: 6,
        dy: 5
      },
      {
        code: '',
        atlasIndex: 711,
        dx: 0,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 712,
        dx: 1,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 713,
        dx: 2,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 714,
        dx: 3,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 715,
        dx: 4,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 716,
        dx: 5,
        dy: 6
      },
      {
        code: '',
        atlasIndex: 717,
        dx: 6,
        dy: 6
      }
    ]
  },
  {
    id: 'small-shop-1',
    name: 'small_shop',
    primaryCode: '',
    width: 5,
    height: 5,
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
    id: 'water1-1',
    name: 'water1',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'water2-1',
    name: 'water2',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'water3-1',
    name: 'water3',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'rock3-1',
    name: 'rock3',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'grass-red-flowers-1',
    name: 'grass_red_flowers',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'grass-blue-flowers-1',
    name: 'grass_blue_flowers',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'grass-yellow-flowers-1',
    name: 'grass_yellow_flowers',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'large-fern-1',
    name: 'large_fern',
    primaryCode: '',
    width: 2,
    height: 3,
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
    id: 'small-fern-1',
    name: 'small_fern',
    primaryCode: '',
    width: 1,
    height: 2,
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
    id: 'small-teal-fern-1',
    name: 'small_teal_fern',
    primaryCode: '',
    width: 1,
    height: 2,
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
    id: 'large-forest-tree-1',
    name: 'large_forest_tree',
    primaryCode: '',
    width: 2,
    height: 3,
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
    id: 'large-teal-forest-tree-1',
    name: 'large_teal_forest_tree',
    primaryCode: '',
    width: 2,
    height: 3,
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
  },
  {
    id: 'palm-tree1-1',
    name: 'palm_tree1',
    primaryCode: '',
    width: 2,
    height: 3,
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
    id: 'palm-tree2-1',
    name: 'palm_tree2',
    primaryCode: '',
    width: 2,
    height: 3,
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
    id: 'grass-3-blue-flower-1',
    name: 'grass_3_blue_flower',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'grass-3-yellow-flower-1',
    name: 'grass_3_yellow_flower',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'beach-water-top-1',
    name: 'beach_water_top',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'beach-water-top-right-1',
    name: 'beach_water_top_right',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'beach-water-right-1',
    name: 'beach_water_right',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'beach-water-bottom-1',
    name: 'beach_water_bottom',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'beach-water-bottom-left-1',
    name: 'beach_water_bottom_left',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'beach-water-left-1',
    name: 'beach_water_left',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'beach-corner-1',
    name: 'beach_corner',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'wood-floor-1',
    name: 'wood_floor',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'wood-floor-back-1',
    name: 'wood_floor_back',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'right-wall-1',
    name: 'right_wall',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'right-wall-back-1',
    name: 'right_wall_back',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'left-wall-1',
    name: 'left_wall',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'left-wall-back-1',
    name: 'left_wall_back',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'back-wall-bottom-1',
    name: 'back_wall_bottom',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'back-wall-top-1',
    name: 'back_wall_top',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'blue-wall-window-1',
    name: 'blue_wall_window',
    primaryCode: '',
    width: 2,
    height: 2,
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
    id: 'table-1',
    name: 'table',
    primaryCode: '',
    width: 2,
    height: 2,
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
    id: 'chair-1',
    name: 'chair',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'houseplant-1',
    name: 'houseplant',
    primaryCode: '',
    width: 1,
    height: 2,
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
    id: 'white-chair-1',
    name: 'white_chair',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'wall-bottom-right-1',
    name: 'wall_bottom_right',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'wall-bottom-left-1',
    name: 'wall_bottom_left',
    primaryCode: '',
    width: 1,
    height: 1,
    cells: [
      {
        code: '',
        atlasIndex: 666,
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
    id: 'wall-top-left-1',
    name: 'wall_top_left',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'tall-grass-1',
    name: 'tall_grass',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'sand-tall-grass-1',
    name: 'sand_tall_grass',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'teal-tall-grass-1',
    name: 'teal_tall_grass',
    primaryCode: '',
    width: 1,
    height: 1,
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
    id: 'tall-grass2-1',
    name: 'tall_grass2',
    primaryCode: '',
    width: 1,
    height: 1,
    cells: [
      {
        code: '',
        atlasIndex: 6,
        dx: 0,
        dy: 0
      }
    ]
  }
];
