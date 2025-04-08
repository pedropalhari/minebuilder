"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface IBlock {
  position: THREE.Vector3;
  color: string;
  id?: string; // Add optional id for identifying blocks
}

interface IColorOption {
  name: string;
  value: string;
}

function MinecraftBuilder() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<IBlock[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>("red");
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const previewRef = useRef<THREE.Mesh | null>(null);
  const hoveredBlockRef = useRef<THREE.Mesh | null>(null);

  const colorOptions: IColorOption[] = [
    { name: "Red", value: "red" },
    { name: "Blue", value: "blue" },
    { name: "Yellow", value: "yellow" },
    { name: "White", value: "white" },
  ];

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

    // Create preview wireframe box
    const previewGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01); // Slightly larger to avoid z-fighting
    const previewMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: false,
      opacity: 0.1,
      transparent: true,
    });
    const previewBox = new THREE.Mesh(previewGeometry, previewMaterial);
    previewBox.visible = false;
    previewRef.current = previewBox;
    scene.add(previewBox);

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
      const blockId = Date.now().toString();

      // Create and add a new block
      const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
      const blockMaterial = new THREE.MeshLambertMaterial({
        color: selectedColor,
      });
      const block = new THREE.Mesh(blockGeometry, blockMaterial);
      block.position.copy(position);
      block.userData = { isBlock: true, id: blockId };
      scene.add(block);

      // Update state
      setBlocks([...blocks, { position, color: selectedColor, id: blockId }]);
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
  }, [blocks, selectedColor]);

  return (
    <div className="relative w-full h-screen">
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
        {colorOptions.map((option) => (
          <button
            key={option.value}
            className={`w-12 h-12 rounded-lg ${
              selectedColor === option.value ? "ring-4 ring-white" : ""
            }`}
            style={{ backgroundColor: option.value }}
            onClick={() => setSelectedColor(option.value)}
            title={option.name}
          />
        ))}
      </div>
    </div>
  );
}

export default MinecraftBuilder;
