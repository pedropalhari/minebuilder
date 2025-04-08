import { NextRequest, NextResponse } from "next/server";

interface IBlockPosition {
  x: number;
  y: number;
  z: number;
  blockType?: string;
  color?: string;
  id: string;
}

// In-memory store for rooms and their blocks
// For a production app, you would use a database or Redis
const rooms: Map<string, {
  blocks: IBlockPosition[];
  clients: Set<ReadableStreamDefaultController>;
}> = new Map();

// Helper to get or create a room
function getOrCreateRoom(roomId: string) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      blocks: [],
      clients: new Set()
    });
  }
  return rooms.get(roomId)!;
}

// Process client connection for SSE
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  console.log(`New client connecting to room: ${roomId}`);
  
  // Ensure content type for SSE
  const responseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
  };
  
  // Create a room if it doesn't exist
  const room = getOrCreateRoom(roomId);
  console.log(`Room ${roomId} has ${room.blocks.length} blocks and ${room.clients.size} clients`);
  
  // Create a streaming response
  const stream = new ReadableStream({
    start(controller) {
      // Send initial data
      const initialData = JSON.stringify({
        type: "init",
        blocks: room.blocks
      });
      
      const encodedData = new TextEncoder().encode(`data: ${initialData}\n\n`);
      controller.enqueue(encodedData);
      console.log(`Sent initial data with ${room.blocks.length} blocks`);
      
      // Add client to the room
      room.clients.add(controller);
      
      // Remove client when connection closes
      req.signal.addEventListener("abort", () => {
        room.clients.delete(controller);
        console.log(`Client disconnected from room ${roomId}, ${room.clients.size} clients remaining`);
      });
    }
  });
  
  return new NextResponse(stream, {
    headers: responseHeaders,
  });
}

// Process block updates
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  
  try {
    const data = await req.json();
    console.log(`Received ${data.action} action for room ${roomId} from ${data.sender || 'unknown'}`);
    
    const room = getOrCreateRoom(roomId);
    
    switch (data.action) {
      case "add":
        // Add a new block
        room.blocks.push(data.block);
        console.log(`Added block at (${data.block.x}, ${data.block.y}, ${data.block.z}), total blocks: ${room.blocks.length}`);
        
        broadcastToRoom(roomId, {
          type: "add",
          block: data.block,
          sender: data.sender
        });
        break;
        
      case "remove":
        // Remove a block
        const initialCount = room.blocks.length;
        room.blocks = room.blocks.filter(block => block.id !== data.blockId);
        console.log(`Removed block ${data.blockId}, blocks before: ${initialCount}, after: ${room.blocks.length}`);
        
        broadcastToRoom(roomId, {
          type: "remove",
          blockId: data.blockId,
          sender: data.sender
        });
        break;
        
      case "clear":
        // Clear all blocks
        room.blocks = [];
        broadcastToRoom(roomId, {
          type: "clear"
        });
        break;
        
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing block update:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Broadcast updates to all clients in a room
function broadcastToRoom(roomId: string, data: any) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  console.log(`Broadcasting to ${room.clients.size} clients in room ${roomId}: ${JSON.stringify(data).substring(0, 100)}...`);
  
  const message = `data: ${JSON.stringify(data)}\n\n`;
  
  room.clients.forEach(controller => {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      console.error("Error sending message to client:", error);
      // Remove broken connections
      room.clients.delete(controller);
    }
  });
} 