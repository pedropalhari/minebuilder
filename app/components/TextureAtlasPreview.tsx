"use client";

import { useEffect, useRef, useState } from "react";

interface ITextureAtlasPreviewProps {
  src: string;
  cellSize?: number;
  cols?: number;
  rows?: number;
  onHoverChange?: (index: number | null) => void;
}

function TextureAtlasPreview({
  src,
  cellSize = 16,
  cols = 64, // 1024/16 = 64 textures per row
  rows = 32,  // 512/16 = 32 rows
  onHoverChange
}: ITextureAtlasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState<number>(2); // Starting zoom level (2x by default)
  const [loading, setLoading] = useState<boolean>(true);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{x: number, y: number} | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Handle zoom change
  const handleZoomChange = (newZoom: number) => {
    if (newZoom >= 1 && newZoom <= 10) { // Limit zoom between 1x and 10x
      setZoom(newZoom);
    }
  };

  // Handle mouse movement to highlight cells
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate which cell the mouse is over
    const cellX = Math.floor(x / (cellSize * zoom));
    const cellY = Math.floor(y / (cellSize * zoom));
    
    // Only update if changed to avoid unnecessary redraws
    if (!hoveredCell || hoveredCell.x !== cellX || hoveredCell.y !== cellY) {
      const cellIndex = cellY * cols + cellX;
      
      // Make sure it's within bounds
      if (cellX >= 0 && cellX < cols && cellY >= 0 && cellY < rows) {
        setHoveredCell({ x: cellX, y: cellY });
        setHoveredIndex(cellIndex);
        // Call the callback if provided
        if (onHoverChange) onHoverChange(cellIndex);
      } else {
        setHoveredCell(null);
        setHoveredIndex(null);
        // Call the callback if provided
        if (onHoverChange) onHoverChange(null);
      }
    }
  };
  
  // Handle mouse leave
  const handleMouseLeave = () => {
    setHoveredCell(null);
    setHoveredIndex(null);
    // Call the callback if provided
    if (onHoverChange) onHoverChange(null);
  };

  // Draw the texture atlas with grid and indices
  function drawAtlas(zoomLevel: number) {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set canvas size based on the texture atlas dimensions and zoom
    canvas.width = cellSize * cols * zoomLevel;
    canvas.height = cellSize * rows * zoomLevel;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Enable image smoothing for higher quality when zoomed in
    ctx.imageSmoothingEnabled = false;
    
    // Draw the image with zoom
    ctx.drawImage(
      img, 
      0, 0, img.width, img.height, 
      0, 0, canvas.width, canvas.height
    );
    
    // Draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1;
    
    // Draw vertical grid lines
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize * zoomLevel, 0);
      ctx.lineTo(x * cellSize * zoomLevel, canvas.height);
      ctx.stroke();
    }
    
    // Draw horizontal grid lines
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize * zoomLevel);
      ctx.lineTo(canvas.width, y * cellSize * zoomLevel);
      ctx.stroke();
    }
    
    // Highlight hovered cell if any
    if (hoveredCell) {
      ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
      ctx.fillRect(
        hoveredCell.x * cellSize * zoomLevel,
        hoveredCell.y * cellSize * zoomLevel,
        cellSize * zoomLevel,
        cellSize * zoomLevel
      );
      
      // Draw a stronger border around hovered cell
      ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hoveredCell.x * cellSize * zoomLevel,
        hoveredCell.y * cellSize * zoomLevel,
        cellSize * zoomLevel,
        cellSize * zoomLevel
      );
    }
    
    // Draw texture indices with shadow for better visibility
    // Only if zoom level is sufficient to show text clearly
    if (zoomLevel >= 2) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const index = y * cols + x;
          const centerX = (x * cellSize + cellSize / 2) * zoomLevel;
          const centerY = (y * cellSize + cellSize / 2) * zoomLevel;
          
          // Skip drawing indices beyond a certain point to avoid cluttering
          if (index > 999) continue;
          
          // Adjust font size based on zoom
          const fontSize = Math.max(7, Math.min(12, 7 * zoomLevel / 2));
          
          // Use a different color for hovered index
          const isHovered = hoveredIndex === index;
          
          // Draw text shadow
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            index.toString(),
            centerX + 1 * zoomLevel, 
            centerY + 1 * zoomLevel
          );
          
          // Draw text
          ctx.fillStyle = isHovered ? "rgba(255, 255, 0, 1)" : "rgba(255, 255, 255, 0.9)";
          ctx.fillText(
            index.toString(),
            centerX,
            centerY
          );
        }
      }
    }
  }
  
  // Load the texture atlas
  useEffect(() => {
    setLoading(true);
    const img = new Image();
    img.src = src;
    img.onload = () => {
      imgRef.current = img;
      drawAtlas(zoom);
      setLoading(false);
    };
  }, [src, cellSize, cols, rows]);
  
  // Redraw when zoom changes or hovered cell changes
  useEffect(() => {
    if (imgRef.current) {
      drawAtlas(zoom);
    }
  }, [zoom, hoveredCell]);
  
  return (
    <div className="bg-slate-800 p-4 rounded-lg shadow-lg w-full max-w-[1000px]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-medium">Texture Atlas Preview</h3>
        <div className="flex items-center space-x-3">
          <button 
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-md flex items-center justify-center text-lg font-bold shadow-md"
            onClick={() => handleZoomChange(zoom - 0.5)}
            disabled={zoom <= 1}
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-white text-sm font-medium bg-slate-700 px-2 py-1 rounded min-w-[52px] text-center">
            {zoom.toFixed(1)}×
          </span>
          <button 
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-md flex items-center justify-center text-lg font-bold shadow-md"
            onClick={() => handleZoomChange(zoom + 0.5)}
            disabled={zoom >= 10}
            title="Zoom In"
          >
            +
          </button>
        </div>
      </div>
      
      <div className="relative border border-slate-600 rounded">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-75 z-10 rounded">
            <span className="text-white">Loading texture atlas...</span>
          </div>
        )}
        
        <div className="overflow-auto" style={{ maxHeight: '65vh', maxWidth: '100%' }}>
          <canvas
            ref={canvasRef}
            className="pixelated"
            style={{
              imageRendering: "pixelated"
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        </div>
        
        {/* Floating zoom controls for easier access when scrolled */}
        <div className="absolute bottom-3 right-3 flex items-center space-x-2 bg-slate-800 bg-opacity-80 p-1.5 rounded-md shadow-lg">
          <button 
            className="bg-slate-700 hover:bg-slate-600 text-white w-8 h-8 rounded flex items-center justify-center text-lg"
            onClick={() => handleZoomChange(zoom - 0.5)}
            disabled={zoom <= 1}
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-white text-sm font-medium">{zoom.toFixed(1)}×</span>
          <button 
            className="bg-slate-700 hover:bg-slate-600 text-white w-8 h-8 rounded flex items-center justify-center text-lg"
            onClick={() => handleZoomChange(zoom + 0.5)}
            disabled={zoom >= 10}
            title="Zoom In"
          >
            +
          </button>
        </div>
      </div>
      
      <div className="flex flex-col mt-3 text-xs text-slate-300 space-y-1">
        <p>
          {hoveredIndex !== null 
            ? `Current texture: ${hoveredIndex} (${Math.floor(hoveredIndex / cols)}, ${hoveredIndex % cols})`
            : 'Numbers indicate the texture index (0-2047)'}
        </p>
        <p>Ex: Texture 64 = first texture in second row</p>
        <p>Use the zoom buttons to magnify textures</p>
      </div>
    </div>
  );
}

export default TextureAtlasPreview; 