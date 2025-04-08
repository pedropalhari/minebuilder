// Texture coordinates are based on a texture atlas where each texture is 16x16 pixels
// The coordinates are specified as the index (starting from 0) of the texture in the atlas

// Define interfaces for block textures
export interface IBlockFaces {
  top: number;
  bottom: number;
  front: number;
  back: number;
  left: number;
  right: number;
}

export interface IBlockDefinition {
  id: string;
  name: string;
  faces: IBlockFaces;
}

// Define common Minecraft block types
export const BLOCK_TYPES: { [key: string]: IBlockDefinition } = {
  STONE_BRICK: {
    id: "stone_brick",
    name: "Stone Brick",
    faces: {
      top: 212,
      bottom: 212,
      front: 212,
      back: 212,
      left: 212,
      right: 212,
    },
  },
  WOOD_BLOCK: {
    id: "wood_block",
    name: "Wood Block",
    faces: {
      top: 1158,
      bottom: 1158,
      front: 1157,
      back: 1157,
      left: 1157,
      right: 1157,
    },
  },
  TNT: {
    id: "tnt",
    name: "TNT Block",
    faces: {
      top: 1794,
      bottom: 1792,
      front: 1793,
      back: 1793,
      left: 1793,
      right: 1793,
    },
  },
  PLANK_BLOCK: {
    id: "plank_block",
    name: "Plank Block",
    faces: {
      top: 1667,
      bottom: 1667,
      front: 1667,
      back: 1667,
      left: 1667,
      right: 1667,
    },
  },
  BRICK_BLOCK: {
    id: "brick_block",
    name: "Brick Block",
    faces: {
      top: 585,
      bottom: 585,
      front: 585,
      back: 585,
      left: 585,
      right: 585,
    },
  },
  BLACK_WOOL_BLOCK: {
    id: "black_wool_block",
    name: "Black Wool Block",
    faces: {
      top: 399,
      bottom: 399,
      front: 399,
      back: 399,
      left: 399,
      right: 399
    }
  },
  GRASS_BLOCK: {
    id: "grass_block",
    name: "Grass Block",
    faces: {
      top: 1099,
      bottom: 907,
      front: 537,
      back: 537,
      left: 537,
      right: 537
    }
  },
};

// Create an array of block types for easier iteration
export const BLOCK_ARRAY = Object.values(BLOCK_TYPES);
