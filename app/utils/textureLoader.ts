import * as THREE from "three";
import { IBlockFaces } from "./blockDefinitions";

// This is the size of each texture in the atlas (in pixels)
const TEXTURE_SIZE = 16;
// Texture atlas dimensions
const ATLAS_WIDTH = 1024;
const ATLAS_HEIGHT = 512;
// Calculate textures per row
const TEXTURES_PER_ROW = ATLAS_WIDTH / TEXTURE_SIZE; // Should be 64

// This function loads a texture atlas and returns a promise that resolves to the loaded texture
function loadTextureAtlas(): Promise<THREE.Texture> {
  return new Promise((resolve) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load("/textures.webp", (texture) => {
      // Configure texture for pixel art
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.needsUpdate = true;
      resolve(texture);
    });
  });
}

// Cache the texture atlas to avoid loading it multiple times
let textureAtlasPromise: Promise<THREE.Texture> | null = null;

// This function returns a promise that resolves to the texture atlas
export function getTextureAtlas(): Promise<THREE.Texture> {
  if (!textureAtlasPromise) {
    textureAtlasPromise = loadTextureAtlas();
  }
  return textureAtlasPromise;
}

// This function creates materials for a block based on the face indices
export async function createBlockMaterials(faces: IBlockFaces): Promise<THREE.MeshLambertMaterial[]> {
  const texture = await getTextureAtlas();
  
  // Create a material for each face
  const faceIndices = [
    faces.right,  // Right face
    faces.left,   // Left face
    faces.top,    // Top face
    faces.bottom, // Bottom face
    faces.front,  // Front face
    faces.back    // Back face
  ];
  
  // Create an array to hold all materials
  const materials: THREE.MeshLambertMaterial[] = [];
  
  // For each face, create a material with the correct UV mapping
  for (let i = 0; i < faceIndices.length; i++) {
    const textureIndex = faceIndices[i];
    
    // Calculate the row and column of the texture in the atlas
    // With 64 textures per row
    const row = Math.floor(textureIndex / TEXTURES_PER_ROW);
    const col = textureIndex % TEXTURES_PER_ROW;
    
    // Create a new texture with adjusted UVs
    const faceTexture = texture.clone();
    
    // Calculate how much of the texture to use
    const textureFractionX = 1 / TEXTURES_PER_ROW;
    const textureFractionY = TEXTURE_SIZE / ATLAS_HEIGHT;
    
    // Set the repeat to only show one texture cell
    faceTexture.repeat.set(textureFractionX, textureFractionY);
    
    // Set the offset to show the correct texture cell
    // The Y coordinate is flipped in threejs (0 is bottom, 1 is top)
    faceTexture.offset.x = col * textureFractionX;
    faceTexture.offset.y = 1 - textureFractionY - row * textureFractionY;
    
    // Create a material for this face
    const material = new THREE.MeshLambertMaterial({
      map: faceTexture,
      transparent: false,
      alphaTest: 0.1,
    });
    
    materials.push(material);
  }
  
  return materials;
} 