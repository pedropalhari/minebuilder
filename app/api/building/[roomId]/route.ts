import { NextRequest, NextResponse } from "next/server";

interface IBlockPosition {
  x: number;
  y: number;
  z: number;
  blockType?: string;
  color?: string;
  id: string;
}

interface IPlayerPosition {
  x: number;
  y: number;
  z: number;
  name: string;
}

// In-memory store for rooms and their blocks
// For a production app, you would use a database or Redis
const rooms: Map<string, {
  blocks: IBlockPosition[];
  clients: Set<ReadableStreamDefaultController>;
  players: Map<string, IPlayerPosition>; // Track connected players by name
}> = new Map();

// Helper to get or create a room
function getOrCreateRoom(roomId: string) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      blocks: [],
      clients: new Set(),
      players: new Map()
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
  // Get player name from query string
  const playerName = req.nextUrl.searchParams.get('name') || 'Anonymous';
  console.log(`New client connecting to room: ${roomId}, player: ${playerName}`);
  
  // Ensure content type for SSE
  const responseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
  };
  
  // Create a room if it doesn't exist
  const room = getOrCreateRoom(roomId);
  
  // Add player to the room
  if (!room.players.has(playerName)) {
    room.players.set(playerName, {
      x: 0,
      y: 0,
      z: 0,
      name: playerName
    });
    
    // Notify other clients about new player
    broadcastToRoom(roomId, {
      type: "player_joined",
      name: playerName,
      playerCount: room.players.size
    });
  }
  
  console.log(`Room ${roomId} has ${room.blocks.length} blocks and ${room.players.size} players`);
  
  // Create a streaming response
  const stream = new ReadableStream({
    start(controller) {
      // Send initial data
      const initialData = JSON.stringify({
        type: "init",
        blocks: room.blocks,
        players: Array.from(room.players.values())
      });
      
      const encodedData = new TextEncoder().encode(`data: ${initialData}\n\n`);
      controller.enqueue(encodedData);
      console.log(`Sent initial data with ${room.blocks.length} blocks and ${room.players.size} players`);
      
      // Add client to the room
      room.clients.add(controller);
      
      // Remove client when connection closes
      req.signal.addEventListener("abort", () => {
        room.clients.delete(controller);
        room.players.delete(playerName);
        
        console.log(`Client disconnected from room ${roomId}, ${room.players.size} players remaining`);
        
        // Notify other clients about player leaving
        broadcastToRoom(roomId, {
          type: "player_left",
          name: playerName,
          playerCount: room.players.size
        });
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
        
      case "update_position":
        // Update player preview position
        if (data.sender && data.position) {
          if (room.players.has(data.sender)) {
            const player = room.players.get(data.sender)!;
            player.x = data.position.x;
            player.y = data.position.y;
            player.z = data.position.z;
            
            broadcastToRoom(roomId, {
              type: "player_moved",
              name: data.sender,
              position: data.position
            });
          }
        }
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