"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BLOCK_ARRAY, BLOCK_TYPES, IBlockDefinition } from "../utils/blockDefinitions";
import { createBlockMaterials } from "../utils/textureLoader";
import TextureAtlasPreview from "./TextureAtlasPreview";
import BlockDefinitionTool from "./BlockDefinitionTool";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

interface IBlock {
  position: THREE.Vector3;
  color?: string;
  id: string;
  blockType?: string; // ID of the block type
}

interface IBlockPosition {
  x: number;
  y: number;
  z: number;
  blockType?: string;
  color?: string;
  id: string;
}

interface IColorOption {
  name: string;
  value: string;
}

function MinecraftBuilder() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<IBlock[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>("red");
  const [selectedBlockType, setSelectedBlockType] = useState<string>("grass");
  const [blockMaterialsCache, setBlockMaterialsCache] = useState<{ [key: string]: THREE.MeshLambertMaterial[] }>({});
  const [showTextureAtlas, setShowTextureAtlas] = useState<boolean>(false);
  const [showBlockDefinitionTool, setShowBlockDefinitionTool] = useState<boolean>(false);
  const [customBlocks, setCustomBlocks] = useState<IBlockDefinition[]>([]);
  const [roomId, setRoomId] = useState<string>("");
  const [isCollaborative, setIsCollaborative] = useState<boolean>(false);
  const [showShareDialog, setShowShareDialog] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>("");
  const sseClientRef = useRef<EventSource | null>(null);
  const syncingRef = useRef<boolean>(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get room ID from URL on initial load
  useEffect(() => {
    const roomParam = searchParams.get("room");
    if (roomParam) {
      setRoomId(roomParam);
      setIsCollaborative(true);
      
      // Ask for user name if not set
      const storedUserName = localStorage.getItem("minecraft_builder_username");
      if (storedUserName) {
        setUserName(storedUserName);
      } else {
        const name = prompt("Enter your name for collaborative building:", "Builder");
        if (name) {
          setUserName(name);
          localStorage.setItem("minecraft_builder_username", name);
        }
      }
    } else {
      // Generate a new room ID for potential sharing
      setRoomId(uuidv4().substring(0, 8));
    }
  }, [searchParams]);
  
  // Connect to SSE when in collaborative mode
  useEffect(() => {
    if (!isCollaborative || !roomId) return;
    
    console.log(`Connecting to room: ${roomId}`);
    
    // Create SSE connection
    const sseUrl = `/api/building/${roomId}`;
    const eventSource = new EventSource(sseUrl);
    sseClientRef.current = eventSource;
    
    // Handle incoming events
    eventSource.onmessage = (event) => {
      try {
        console.log(`Received SSE event: ${event.data.substring(0, 100)}...`);
        const data = JSON.parse(event.data);
        handleSseEvent(data);
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };
    
    eventSource.onopen = () => {
      console.log("SSE connection opened");
    };
    
    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (sseClientRef.current) {
          sseClientRef.current.close();
          sseClientRef.current = new EventSource(sseUrl);
        }
      }, 3000);
    };
    
    return () => {
      if (sseClientRef.current) {
        sseClientRef.current.close();
        sseClientRef.current = null;
      }
    };
  }, [roomId, isCollaborative]);
  
  // Handle SSE events
  function handleSseEvent(data: any) {
    syncingRef.current = true;
    
    const scene = sceneRef.current;
    if (!scene) {
      syncingRef.current = false;
      return;
    }
    
    switch (data.type) {
      case "init":
        // Load initial blocks
        const initialBlocks = data.blocks.map((blockPos: IBlockPosition) => ({
          position: new THREE.Vector3(blockPos.x, blockPos.y, blockPos.z),
          color: blockPos.color,
          blockType: blockPos.blockType,
          id: blockPos.id
        }));
        
        // Clear existing blocks
        blocks.forEach(block => {
          const blockMesh = scene.children.find(
            obj => obj.userData.id === block.id
          ) as THREE.Mesh;
          if (blockMesh) scene.remove(blockMesh);
        });
        
        // Add initial blocks
        initialBlocks.forEach((block: IBlock) => {
          addBlockToScene(block);
        });
        
        setBlocks(initialBlocks);
        break;
        
      case "add":
        // Skip if we're the sender to avoid duplicates
        if (data.sender === userName) {
          syncingRef.current = false;
          return;
        }
        
        // Add a new block
        const newBlock = {
          position: new THREE.Vector3(data.block.x, data.block.y, data.block.z),
          color: data.block.color,
          blockType: data.block.blockType,
          id: data.block.id
        };
        
        // Check if the block already exists
        if (!blocks.some(b => b.id === newBlock.id)) {
          addBlockToScene(newBlock);
          setBlocks(prev => [...prev, newBlock]);
        }
        break;
        
      case "remove":
        // Skip if we're the sender
        if (data.sender === userName) {
          syncingRef.current = false;
          return;
        }
        
        // Remove a block
        const blockToRemove = scene.children.find(
          obj => obj.userData.id === data.blockId
        ) as THREE.Mesh;
        
        if (blockToRemove) {
          scene.remove(blockToRemove);
          setBlocks(prev => prev.filter(b => b.id !== data.blockId));
        }
        break;
        
      case "clear":
        // Clear all blocks
        blocks.forEach(block => {
          const blockMesh = scene.children.find(
            obj => obj.userData.id === block.id
          ) as THREE.Mesh;
          if (blockMesh) scene.remove(blockMesh);
        });
        
        setBlocks([]);
        break;
    }
    
    syncingRef.current = false;
  }
  
  // Add a block to the scene
  function addBlockToScene(block: IBlock) {
    const scene = sceneRef.current;
    if (!scene) return;
    
    let blockMesh: THREE.Mesh;
    
    if (block.blockType && blockMaterialsCache[block.blockType]) {
      // Create a textured block
      const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
      blockMesh = new THREE.Mesh(blockGeometry, blockMaterialsCache[block.blockType]);
    } else if (block.color) {
      // Create a colored block
      const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
      const blockMaterial = new THREE.MeshLambertMaterial({
        color: block.color,
      });
      blockMesh = new THREE.Mesh(blockGeometry, blockMaterial);
    } else {
      // Default red block as fallback
      const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
      const blockMaterial = new THREE.MeshLambertMaterial({
        color: "red",
      });
      blockMesh = new THREE.Mesh(blockGeometry, blockMaterial);
    }
    
    blockMesh.position.copy(block.position);
    blockMesh.userData = { 
      isBlock: true, 
      id: block.id,
      blockType: block.blockType 
    };
    
    scene.add(blockMesh);
  }
  
  // Send block update to the server
  async function sendBlockUpdate(action: string, data: any) {
    if (!isCollaborative || syncingRef.current) return;
    
    try {
      await fetch(`/api/building/${roomId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...data,
          sender: userName
        }),
      });
    } catch (error) {
      console.error("Error sending block update:", error);
    }
  }
  
  // Start sharing this build
  function startSharing() {
    setIsCollaborative(true);
    setShowShareDialog(true);
    
    // Ask for user name if not set
    if (!userName) {
      const name = prompt("Enter your name for collaborative building:", "Builder");
      if (name) {
        setUserName(name);
        localStorage.setItem("minecraft_builder_username", name);
      }
    }
    
    // Update URL with room ID without refreshing page
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    window.history.pushState({}, "", url.toString());
  }
  
  // Copy share link to clipboard
  function copyShareLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    
    navigator.clipboard.writeText(url.toString())
      .then(() => {
        alert("Share link copied to clipboard!");
      })
      .catch(err => {
        console.error("Failed to copy link: ", err);
        alert("Failed to copy link. Please try again.");
      });
  }

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const previewRef = useRef<THREE.Mesh | null>(null);
  const previewWireframeRef = useRef<THREE.LineSegments | null>(null);
  const hoveredBlockRef = useRef<THREE.Mesh | null>(null);

  // Color options (legacy)
  const colorOptions: IColorOption[] = [
    { name: "Red", value: "red" },
    { name: "Blue", value: "blue" },
    { name: "Yellow", value: "yellow" },
    { name: "White", value: "white" },
  ];

  // Preload all block materials
  useEffect(() => {
    async function preloadMaterials() {
      const cache: { [key: string]: THREE.MeshLambertMaterial[] } = {};
      
      // Load materials for each block type
      for (const blockType of BLOCK_ARRAY) {
        const materials = await createBlockMaterials(blockType.faces);
        cache[blockType.id] = materials;
      }
      
      setBlockMaterialsCache(cache);
    }
    
    preloadMaterials();
  }, []);

  // Create a textured block mesh
  function createBlockMesh(position: THREE.Vector3, blockType: string): THREE.Mesh {
    const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
    const blockId = Date.now().toString();
    
    let blockMesh: THREE.Mesh;
    
    // If we have materials for this block type, use them
    if (blockMaterialsCache[blockType]) {
      blockMesh = new THREE.Mesh(blockGeometry, blockMaterialsCache[blockType]);
    } else {
      // Fallback to color-based material
      const blockMaterial = new THREE.MeshLambertMaterial({
        color: selectedColor,
      });
      blockMesh = new THREE.Mesh(blockGeometry, blockMaterial);
    }
    
    blockMesh.position.copy(position);
    blockMesh.userData = { isBlock: true, id: blockId, blockType };
    
    return blockMesh;
  }

  // Update preview box to show the right material
  function updatePreviewMaterial() {
    const previewBox = previewRef.current;
    if (!previewBox) return;
    
    if (selectedBlockType && blockMaterialsCache[selectedBlockType]) {
      // Use the textured materials for the preview
      previewBox.material = blockMaterialsCache[selectedBlockType];
    } else {
      // Use the color-based material for the preview
      previewBox.material = new THREE.MeshBasicMaterial({
        color: selectedColor,
        opacity: 0.6,
        transparent: true,
      });
    }
  }

  // Initialize the scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Ensure we clean up any previous renderer before creating a new one
    if (
      rendererRef.current &&
      mountRef.current.contains(rendererRef.current.domElement)
    ) {
      mountRef.current.removeChild(rendererRef.current.domElement);
    }

    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x87ceeb); // Sky blue background

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(15, 15, 15);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create orbit controls - Use left mouse button for rotation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      // RIGHT not defined - this disables it
    };
    controls.enableZoom = true; // Enable zoom with mouse wheel only
    controlsRef.current = controls;

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Create 20x20 green base
    const baseGeometry = new THREE.BoxGeometry(20, 1, 20);
    const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x00aa00 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = -0.5; // Position the base so its top face is at y=0
    base.userData = { isBase: true };
    scene.add(base);

    // Grid helper - aligned with integer coordinates (lines run between cells)
    const gridHelper = new THREE.GridHelper(20, 20);
    // Center the grid at integer coordinates so cells are between lines
    gridHelper.position.set(0, 0, 0);
    scene.add(gridHelper);

    // Add coordinate axes helper
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Create preview box
    const previewGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01); // Slightly larger to avoid z-fighting
    const previewMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: false,
      opacity: 0.6,
      transparent: true,
    });
    const previewBox = new THREE.Mesh(previewGeometry, previewMaterial);
    previewBox.visible = false;
    previewRef.current = previewBox;
    scene.add(previewBox);

    // Add wireframe to preview box
    const wireframeGeometry = new THREE.EdgesGeometry(previewGeometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({ 
      color: 0xffffff,
      linewidth: 1
    });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    previewBox.add(wireframe);
    previewWireframeRef.current = wireframe;

    // Handle window resize
    function handleResize() {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", handleResize);

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    }
    animate();

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (rendererRef.current && mountRef.current) {
        if (mountRef.current.contains(rendererRef.current.domElement)) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
      }
      // Cancel animation frame
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
    };
  }, []);

  // Update the preview material when the selection changes
  useEffect(() => {
    updatePreviewMaterial();
  }, [selectedBlockType, selectedColor, blockMaterialsCache]);

  // Event handlers for mouse interactions
  useEffect(() => {
    if (
      !mountRef.current ||
      !sceneRef.current ||
      !cameraRef.current ||
      !rendererRef.current
    )
      return;

    function handleMouseMove(event: MouseEvent) {
      // Calculate mouse position relative to the canvas element
      const rect = rendererRef.current?.domElement.getBoundingClientRect();
      if (rect) {
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y =
          -((event.clientY - rect.top) / rect.height) * 2 + 1;
      }

      // Update preview box position
      updatePreviewPosition();
    }

    function updatePreviewPosition() {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const previewBox = previewRef.current;

      if (!scene || !camera || !previewBox) return;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Reset hovered block reference
      hoveredBlockRef.current = null;

      // Filter out preview box and non-placeable objects
      const objectsToCheck = scene.children.filter((obj) => {
        return (
          obj !== previewBox &&
          (obj.userData.isBase === true || obj.userData.isBlock === true)
        );
      });

      const intersects = raycasterRef.current.intersectObjects(
        objectsToCheck,
        false
      );

      if (intersects.length > 0) {
        const intersect = intersects[0];

        // If we're hovering over a block (not the base), store reference to it
        if (intersect.object.userData.isBlock) {
          hoveredBlockRef.current = intersect.object as THREE.Mesh;
        }

        // Calculate position for the preview box with more precision
        const position = new THREE.Vector3();

        // Special case for placing blocks directly on the green base
        if (intersect.object.userData.isBase) {
          // Convert to grid cell coordinates (center of cells)
          position.x = Math.floor(intersect.point.x) + 0.5;
          position.z = Math.floor(intersect.point.z) + 0.5;
          position.y = 0.5; // Place half a block above the base
        } else {
          // For placing on other blocks
          const normal =
            intersect.face?.normal.clone() ?? new THREE.Vector3(0, 1, 0);
          normal.transformDirection(intersect.object.matrixWorld);

          // Calculate new position based on the face normal
          position.copy(intersect.point).add(normal.multiplyScalar(0.5));

          // Snap to grid cell centers
          position.x = Math.floor(position.x) + 0.5;
          position.y = Math.floor(position.y) + 0.5;
          position.z = Math.floor(position.z) + 0.5;
        }

        // Check if position is within bounds (20x20 grid)
        if (
          position.x >= -9.5 &&
          position.x <= 9.5 &&
          position.z >= -9.5 &&
          position.z <= 9.5 &&
          position.y >= 0 &&
          position.y < 20
        ) {
          // Check if there's already a block at this position
          const blockExists = blocks.some(
            (block) =>
              Math.abs(block.position.x - position.x) < 0.1 &&
              Math.abs(block.position.y - position.y) < 0.1 &&
              Math.abs(block.position.z - position.z) < 0.1
          );

          if (!blockExists) {
            previewBox.position.copy(position);
            previewBox.visible = true;
            return;
          }
        }
      }

      previewBox.visible = false;
    }

    function handleMouseClick(event: MouseEvent) {
      // Use right click to place blocks
      if (event.button !== 2) return;
      event.preventDefault();

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const previewBox = previewRef.current;

      if (!scene || !camera || !previewBox || !previewBox.visible) return;

      // Just use the preview box position since we already calculated it
      const position = previewBox.position.clone();

      // Check if there's already a block at this position (for extra safety)
      const blockExists = blocks.some(
        (block) =>
          block.position.x === position.x &&
          block.position.y === position.y &&
          block.position.z === position.z
      );

      if (blockExists) return;

      // Create a unique ID for the block
      const blockId = Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9);

      // Create and add a new block (textured or colored based on selection)
      let block: THREE.Mesh;
      
      const newBlock: IBlock = { 
        position, 
        color: selectedBlockType ? undefined : selectedColor, 
        blockType: selectedBlockType,
        id: blockId 
      };
      
      if (selectedBlockType && blockMaterialsCache[selectedBlockType]) {
        // Create a textured block
        block = createBlockMesh(position, selectedBlockType);
        block.userData.id = blockId;
      } else {
        // Create a colored block (legacy behavior)
        const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
        const blockMaterial = new THREE.MeshLambertMaterial({
          color: selectedColor,
        });
        block = new THREE.Mesh(blockGeometry, blockMaterial);
        block.position.copy(position);
        block.userData = { isBlock: true, id: blockId };
      }
      
      scene.add(block);

      // Update state
      setBlocks([...blocks, newBlock]);
      
      // Send update if in collaborative mode
      if (isCollaborative) {
        const blockPosition: IBlockPosition = {
          x: position.x,
          y: position.y,
          z: position.z,
          color: selectedBlockType ? undefined : selectedColor,
          blockType: selectedBlockType,
          id: blockId
        };
        
        sendBlockUpdate("add", { block: blockPosition });
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      // Delete block when 'z' is pressed and hovering over a block
      if (event.key.toLowerCase() === "z" && hoveredBlockRef.current) {
        const scene = sceneRef.current;
        if (!scene) return;

        const blockToRemove = hoveredBlockRef.current;
        const blockId = blockToRemove.userData.id;

        // Remove the block from the scene
        scene.remove(blockToRemove);

        // Update state to remove the block
        setBlocks(
          blocks.filter((block) => {
            // If we have an ID, use it for comparison
            if (blockId && block.id) {
              return block.id !== blockId;
            }

            // Fallback to position comparison if no ID
            return !(
              Math.abs(block.position.x - blockToRemove.position.x) < 0.1 &&
              Math.abs(block.position.y - blockToRemove.position.y) < 0.1 &&
              Math.abs(block.position.z - blockToRemove.position.z) < 0.1
            );
          })
        );

        // Reset hover reference
        hoveredBlockRef.current = null;
        
        // Send update if in collaborative mode
        if (isCollaborative && blockId) {
          sendBlockUpdate("remove", { blockId });
        }
      }
    }

    function handleContextMenu(event: MouseEvent) {
      event.preventDefault(); // Prevent context menu
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mousedown", handleMouseClick);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleMouseClick);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [blocks, selectedColor, selectedBlockType, blockMaterialsCache, isCollaborative]);

  // Handle saving a new block definition
  function handleSaveBlockDefinition(newBlock: IBlockDefinition) {
    // Add the new block to custom blocks
    setCustomBlocks(prev => [...prev, newBlock]);
    
    // Close the block definition tool
    setShowBlockDefinitionTool(false);
    
    // Set the new block type as selected
    setSelectedBlockType(newBlock.id);
    
    // Reload block materials
    preloadBlockMaterials([newBlock]);
  }
  
  // Preload materials for custom blocks
  async function preloadBlockMaterials(blocks: IBlockDefinition[]) {
    const cache = { ...blockMaterialsCache };
    
    // Load materials for each block
    for (const block of blocks) {
      const materials = await createBlockMaterials(block.faces);
      cache[block.id] = materials;
    }
    
    setBlockMaterialsCache(cache);
  }

  // Combine built-in and custom block types for the UI
  const allBlockTypes = [...BLOCK_ARRAY, ...customBlocks];

  return (
    <div className="relative w-full h-screen">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* Texture atlas preview */}
      {showTextureAtlas && (
        <div className="absolute top-4 right-4 z-10">
          <TextureAtlasPreview src="/textures.webp" />
        </div>
      )}
      
      {/* Block definition tool */}
      {showBlockDefinitionTool && (
        <BlockDefinitionTool 
          onClose={() => setShowBlockDefinitionTool(false)}
          onSave={handleSaveBlockDefinition}
        />
      )}
      
      {/* Share dialog */}
      {showShareDialog && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-800 p-6 rounded-lg shadow-lg z-50">
          <h3 className="text-white font-medium mb-4">Share Your Build</h3>
          <p className="text-slate-300 mb-4">Send this link to your friends to build together:</p>
          
          <div className="flex mb-4">
            <input 
              type="text" 
              value={`${window.location.origin}?room=${roomId}`}
              readOnly
              className="flex-grow px-3 py-2 bg-slate-700 text-white rounded-l"
            />
            <button
              onClick={copyShareLink}
              className="bg-blue-600 text-white px-4 rounded-r hover:bg-blue-700"
            >
              Copy
            </button>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={() => setShowShareDialog(false)}
              className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* Controls */}
      <div className="absolute top-4 left-4 flex space-x-2 flex-wrap gap-2">
        <button
          className="px-3 py-1 bg-slate-700 text-white rounded-md hover:bg-slate-600 text-sm"
          onClick={() => setShowTextureAtlas(!showTextureAtlas)}
        >
          {showTextureAtlas ? "Hide" : "Show"} Texture Atlas
        </button>
        
        <button
          className="px-3 py-1 bg-slate-700 text-white rounded-md hover:bg-slate-600 text-sm"
          onClick={() => setShowBlockDefinitionTool(true)}
        >
          Create New Block
        </button>
        
        {!isCollaborative ? (
          <button
            className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            onClick={startSharing}
          >
            Share & Collaborate
          </button>
        ) : (
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            onClick={() => setShowShareDialog(true)}
          >
            Copy Share Link
          </button>
        )}
        
        <div className="px-3 py-1 bg-slate-700 text-white rounded-md text-sm">
          Right-click: Place block • Z key: Delete block
        </div>
        
        {isCollaborative && (
          <div className="px-3 py-1 bg-purple-600 text-white rounded-md text-sm">
            Room: {roomId} • {blocks.length} blocks
          </div>
        )}
      </div>
      
      {/* Block selection UI */}
      <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center">
        <div className="mb-2 bg-slate-800 bg-opacity-70 text-white px-3 py-1 rounded-md text-sm">
          {selectedBlockType 
            ? (BLOCK_TYPES[selectedBlockType.toUpperCase()] || customBlocks.find(b => b.id === selectedBlockType))?.name || "Custom Block"
            : `${selectedColor.charAt(0).toUpperCase()}${selectedColor.slice(1)} Block`}
        </div>
        
        <div className="flex justify-center">
          {/* Color options */}
          <div className="flex space-x-2 mr-4 bg-slate-800 bg-opacity-70 p-2 rounded-lg">
            <div className="text-white text-xs mr-2 self-center">Colors:</div>
            {colorOptions.map((option) => (
              <button
                key={option.value}
                className={`w-10 h-10 rounded-lg transition-all transform ${
                  selectedBlockType === "" && selectedColor === option.value 
                    ? "ring-2 ring-white scale-110"
                    : "hover:scale-105"
                }`}
                style={{ backgroundColor: option.value }}
                onClick={() => {
                  setSelectedColor(option.value);
                  setSelectedBlockType(""); // Deselect block type
                }}
                title={option.name}
              />
            ))}
          </div>
          
          {/* Block type options */}
          <div className="flex space-x-2 bg-slate-800 bg-opacity-70 p-2 rounded-lg overflow-x-auto max-w-[60vw]">
            <div className="text-white text-xs mr-2 self-center">Blocks:</div>
            {allBlockTypes.map((blockType) => {
              // Calculate texture atlas coordinates for this texture
              const textureIndex = blockType.faces.top; // Use top face for preview
              const texturesPerRow = 64; // Use 64 textures per row (1024/16)
              const row = Math.floor(textureIndex / texturesPerRow);
              const col = textureIndex % texturesPerRow;
              
              return (
                <button
                  key={blockType.id}
                  className={`w-10 h-10 rounded-lg border border-gray-600 transition-all transform overflow-hidden flex items-center justify-center ${
                    selectedBlockType === blockType.id 
                      ? "ring-2 ring-white scale-110" 
                      : "hover:scale-105"
                  } ${customBlocks.some(b => b.id === blockType.id) ? "ring-1 ring-yellow-500" : ""}`}
                  onClick={() => setSelectedBlockType(blockType.id)}
                  title={blockType.name}
                >
                  <div
                    style={{
                      width: "40px", // 2.4x the texture size (16px)
                      height: "40px", // 2.4x the texture size (16px)
                      backgroundImage: `url('/textures.webp')`,
                      backgroundSize: `${64 * 16 * 2.4}px`, // 2.4x scaling
                      backgroundPosition: `-${col * 16 * 2.4}px -${row * 16 * 2.4}px`,
                      backgroundRepeat: "no-repeat",
                      imageRendering: "pixelated"
                    }}
                  />
                </button>
              );
            })}
            
            {/* Add new block button */}
            <button
              className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-500 flex items-center justify-center hover:border-white transition-colors"
              onClick={() => setShowBlockDefinitionTool(true)}
              title="Create New Block"
            >
              <span className="text-gray-400 text-xl">+</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MinecraftBuilder;
