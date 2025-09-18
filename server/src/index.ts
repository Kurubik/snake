// Main server entry point

import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Room, Player, ClientMessage, ServerMessage } from './shared/types.js';
import { createRoom, joinRoom, handleMessage } from './room.js';
import { HEARTBEAT_INTERVAL } from './shared/constants.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = process.env.HOST || 'localhost';

// Store active rooms and client connections
const rooms = new Map<string, Room>();
const clients = new Map<WebSocket, {
  playerId: string;
  roomCode?: string;
  lastActivity: number;
}>();

// Create HTTP server
const server = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      rooms: rooms.size,
      clients: clients.size 
    }));
    return;
  }
  
  // CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  const playerId = generateId();
  
  clients.set(ws, {
    playerId,
    lastActivity: Date.now(),
  });
  
  console.log(`Player ${playerId} connected`);
  
  // Set up ping/pong for connection health
  ws.on('pong', () => {
    const client = clients.get(ws);
    if (client) {
      client.lastActivity = Date.now();
    }
  });
  
  ws.on('message', (data: Buffer) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      const client = clients.get(ws);
      
      if (!client) return;
      
      client.lastActivity = Date.now();
      
      handleMessage(ws, message, client, rooms, clients);
    } catch (error) {
      console.error('Message handling error:', error);
      sendMessage(ws, {
        type: 'error',
        data: {
          code: 'INVALID_MESSAGE',
          message: 'Invalid message format',
        },
      });
    }
  });
  
  ws.on('close', () => {
    const client = clients.get(ws);
    
    if (client) {
      console.log(`Player ${client.playerId} disconnected`);
      
      // Remove from room if in one
      if (client.roomCode) {
        const room = rooms.get(client.roomCode);
        if (room) {
          room.players.delete(client.playerId);
          
          // Broadcast updated lobby state
          broadcastToRoom(room, {
            type: 'lobby',
            data: getLobbyData(room),
          }, clients);
          
          // Clean up empty rooms
          if (room.players.size === 0) {
            rooms.delete(client.roomCode);
            console.log(`Room ${client.roomCode} closed (empty)`);
          } else if (room.hostId === client.playerId) {
            // Transfer host to another player
            const newHost = room.players.keys().next().value;
            if (newHost) {
              room.hostId = newHost;
              broadcastToRoom(room, {
                type: 'lobby',
                data: getLobbyData(room),
              }, clients);
            }
          }
        }
      }
      
      clients.delete(ws);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Heartbeat to detect stale connections
setInterval(() => {
  const now = Date.now();
  
  wss.clients.forEach((ws) => {
    const client = clients.get(ws);
    
    if (!client) {
      ws.terminate();
      return;
    }
    
    if (now - client.lastActivity > HEARTBEAT_INTERVAL * 2) {
      console.log(`Terminating inactive client ${client.playerId}`);
      ws.terminate();
      clients.delete(ws);
    } else {
      ws.ping();
    }
  });
  
  // Clean up old empty rooms
  rooms.forEach((room, code) => {
    if (room.players.size === 0 && now - room.tick > 60000) {
      rooms.delete(code);
      console.log(`Room ${code} cleaned up`);
    }
  });
}, HEARTBEAT_INTERVAL);

// Helper functions
export function sendMessage(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function broadcastToRoom(
  room: Room,
  message: ServerMessage,
  clients: Map<WebSocket, any>
) {
  room.players.forEach((player, playerId) => {
    const ws = findClientSocket(playerId, clients);
    if (ws) {
      sendMessage(ws, message);
    }
  });
}

export function findClientSocket(
  playerId: string,
  clients: Map<WebSocket, any>
): WebSocket | null {
  for (const [ws, client] of clients) {
    if (client.playerId === playerId) {
      return ws;
    }
  }
  return null;
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getLobbyData(room: Room) {
  return {
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      isHost: p.id === room.hostId,
    })),
    settings: room.settings,
    status: room.status,
  };
}

// Start server
server.listen(PORT, HOST, () => {
  console.log(`🐍 Snake server running on http://${HOST}:${PORT}`);
  console.log(`WebSocket endpoint: ws://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  
  // Close all connections
  wss.clients.forEach(ws => ws.close());
  
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
