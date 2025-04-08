"use client";

import { useState, useEffect, useRef } from "react";
import { IBlockFaces, IBlockDefinition } from "../utils/blockDefinitions";
import TextureAtlasPreview from "./TextureAtlasPreview";

interface IBlockDefinitionToolProps {
  onClose: () => void;
  onSave: (newBlock: IBlockDefinition) => void;
}

function BlockDefinitionTool({ onClose, onSave }: IBlockDefinitionToolProps) {
  const [blockId, setBlockId] = useState<string>("");
  const [blockName, setBlockName] = useState<string>("");
  const [selectedFace, setSelectedFace] = useState<keyof IBlockFaces | null>(null);
  const [hoveredTextureIndex, setHoveredTextureIndex] = useState<number | null>(null);
  const [blockFaces, setBlockFaces] = useState<IBlockFaces>({
    top: 0,
    bottom: 0,
    front: 0,
    back: 0,
    left: 0,
    right: 0
  });
  
  // Constants for texture atlas
  const CELL_SIZE = 16;
  const COLS = 64;
  const ROWS = 32;
  const TEXTURE_SRC = "/textures.webp";
  
  // Handle face selection with hovered texture
  function handleSelectTextureForFace(textureIndex: number) {
    if (selectedFace) {
      // Update the block faces with the selected texture
      setBlockFaces(prev => ({
        ...prev,
        [selectedFace]: textureIndex
      }));
    }
  }
  
  // Generate code for blockDefinitions.ts
  function generateBlockCode(): string {
    if (!blockId || !blockName) {
      alert("Please enter block ID and name");
      return "";
    }
    
    const blockCode = `  ${blockId.toUpperCase()}: {
    id: "${blockId.toLowerCase()}",
    name: "${blockName}",
    faces: {
      top: ${blockFaces.top},
      bottom: ${blockFaces.bottom},
      front: ${blockFaces.front},
      back: ${blockFaces.back},
      left: ${blockFaces.left},
      right: ${blockFaces.right}
    }
  },`;
    
    return blockCode;
  }
  
  // Copy block definition code to clipboard
  function handleExportToClipboard() {
    const code = generateBlockCode();
    if (!code) return;
    
    navigator.clipboard.writeText(code)
      .then(() => {
        alert("Block definition code copied to clipboard! Paste it in blockDefinitions.ts");
      })
      .catch(err => {
        console.error("Failed to copy to clipboard: ", err);
        alert("Failed to copy to clipboard. Please try again.");
      });
  }
  
  // Handle set same texture for all faces
  function handleSetAllFaces() {
    if (hoveredTextureIndex === null) {
      alert("Please hover over a texture first");
      return;
    }
    
    setBlockFaces({
      top: hoveredTextureIndex,
      bottom: hoveredTextureIndex,
      front: hoveredTextureIndex,
      back: hoveredTextureIndex,
      left: hoveredTextureIndex,
      right: hoveredTextureIndex
    });
  }

  // Handle save button
  function handleSave() {
    if (!blockId || !blockName) {
      alert("Please enter block ID and name");
      return;
    }
    
    const newBlock: IBlockDefinition = {
      id: blockId.toLowerCase(),
      name: blockName,
      faces: blockFaces
    };
    
    onSave(newBlock);
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-lg p-6 w-[98vw] max-w-7xl max-h-[98vh] overflow-auto">
        <div className="flex justify-between mb-4">
          <h2 className="text-white text-xl font-bold">Block Definition Tool</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-500"
          >
            ✕
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side - Block properties */}
          <div className="space-y-4">
            <div>
              <label className="block text-white text-sm mb-1">Block ID (for code)</label>
              <input
                type="text"
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                placeholder="E.g., grass_block"
                className="w-full px-3 py-2 bg-slate-700 text-white rounded"
              />
            </div>
            
            <div>
              <label className="block text-white text-sm mb-1">Block Name (for display)</label>
              <input
                type="text"
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                placeholder="E.g., Grass Block"
                className="w-full px-3 py-2 bg-slate-700 text-white rounded"
              />
            </div>
            
            <div>
              <label className="block text-white text-sm mb-1">Select Face to Edit</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(blockFaces) as Array<keyof IBlockFaces>).map((face) => (
                  <button
                    key={face}
                    onClick={() => setSelectedFace(face)}
                    className={`py-2 px-3 rounded text-sm capitalize ${
                      selectedFace === face
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-white hover:bg-slate-600"
                    }`}
                  >
                    {face} ({blockFaces[face]})
                  </button>
                ))}
              </div>
            </div>
            
            <div className="pt-4">
              <button
                onClick={handleSetAllFaces}
                className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded"
                disabled={hoveredTextureIndex === null}
              >
                Set All Faces to Hovered Texture ({hoveredTextureIndex !== null ? hoveredTextureIndex : "None"})
              </button>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-600">
              <h3 className="text-white font-medium mb-2">Block Preview</h3>
              <div className="flex flex-wrap gap-4">
                {(Object.keys(blockFaces) as Array<keyof IBlockFaces>).map((face) => {
                  const index = blockFaces[face];
                  const col = index % COLS;
                  const row = Math.floor(index / COLS);
                  
                  return (
                    <div key={face} className="text-center">
                      <div 
                        className={`w-16 h-16 border border-slate-600 rounded overflow-hidden flex items-center justify-center ${
                          selectedFace === face ? 'ring-2 ring-blue-500' : ''
                        }`}
                        style={{
                          position: "relative"
                        }}
                        onClick={() => setSelectedFace(face)}
                      >
                        <div 
                          style={{
                            position: "absolute",
                            width: "64px", // 4x the texture size (16px)
                            height: "64px", // 4x the texture size (16px)
                            backgroundImage: `url('${TEXTURE_SRC}')`,
                            backgroundSize: `${COLS * CELL_SIZE * 4}px`, // 4x scaling
                            backgroundPosition: `-${col * CELL_SIZE * 4}px -${row * CELL_SIZE * 4}px`,
                            backgroundRepeat: "no-repeat",
                            imageRendering: "pixelated"
                          }}
                        />
                      </div>
                      <div className="text-white text-xs mt-1 capitalize">{face}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="pt-6 flex space-x-4">
              <button
                onClick={handleSave}
                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded"
              >
                Save Block Definition
              </button>
              <button
                onClick={handleExportToClipboard}
                className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded"
              >
                Export to Clipboard
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 bg-slate-600 hover:bg-slate-700 text-white rounded"
              >
                Cancel
              </button>
            </div>
            
            <div className="text-xs text-slate-400 mt-2">
              <p>Tip: Click on a texture in the atlas to assign it to the selected face.</p>
              <p>Hovered texture: {hoveredTextureIndex !== null ? hoveredTextureIndex : "None"}</p>
            </div>
          </div>
          
          {/* Right side - Enhanced Texture Atlas */}
          <div>
            <label className="block text-white text-sm mb-1">
              Texture Atlas ({selectedFace ? `Click to set ${selectedFace} face` : "Select a face first"})
            </label>
            <div 
              className="mb-2 cursor-pointer"
              onClick={() => {
                if (selectedFace !== null && hoveredTextureIndex !== null) {
                  handleSelectTextureForFace(hoveredTextureIndex);
                }
              }}
            >
              <TextureAtlasPreview 
                src={TEXTURE_SRC} 
                cellSize={16}
                cols={64}
                rows={32}
                onHoverChange={(index) => setHoveredTextureIndex(index)}
              />
            </div>
            
            {selectedFace && (
              <div className="bg-slate-700 p-2 rounded text-white text-sm mt-2">
                <p>Currently editing: <span className="font-bold capitalize">{selectedFace}</span> face</p>
                <p>Click on any texture in the atlas above to assign it to the {selectedFace} face.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BlockDefinitionTool; 