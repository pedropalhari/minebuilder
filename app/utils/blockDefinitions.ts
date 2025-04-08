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
  GRASS: {
    id: "grass",
    name: "Grass Block",
    faces: {
      top: 10, // Grass top texture (index 0 in atlas)
      bottom: 10, // Dirt texture (index 2 in atlas)
      front: 10, // Grass side texture (index 1 in atlas)
      back: 10, // Grass side texture
      left: 10, // Grass side texture
      right: 10, // Grass side texture
    },
  },
  DIRT: {
    id: "dirt",
    name: "Dirt",
    faces: {
      top: 2,
      bottom: 2,
      front: 2,
      back: 2,
      left: 2,
      right: 2,
    },
  },
  STONE: {
    id: "stone",
    name: "Stone",
    faces: {
      top: 576,
      bottom: 576,
      front: 576,
      back: 576,
      left: 576,
      right: 576,
    },
  },
  WOOD: {
    id: "wood",
    name: "Oak Wood",
    faces: {
      top: 4,
      bottom: 4,
      front: 5,
      back: 5,
      left: 5,
      right: 5,
    },
  },
  COBBLESTONE: {
    id: "cobblestone",
    name: "Cobblestone",
    faces: {
      top: 6,
      bottom: 6,
      front: 6,
      back: 6,
      left: 6,
      right: 6,
    },
  },
  SAND: {
    id: "sand",
    name: "Sand",
    faces: {
      top: 7,
      bottom: 7,
      front: 7,
      back: 7,
      left: 7,
      right: 7,
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
};

// Create an array of block types for easier iteration
export const BLOCK_ARRAY = Object.values(BLOCK_TYPES);
