// Room management and game logic

import { WebSocket } from 'ws';
import {
  Room,
  Player,
  ClientMessage,
  ServerMessage,
  GameState,
  Snake,
  Direction,
  JoinMessage,
  CreateRoomMessage,
  ReadyMessage,
  InputMessage,
} from './shared/types.js';
import { 
  DEFAULT_SETTINGS,
  COUNTDOWN_DURATION,
  SNAKE_COLORS,
  MAX_INPUT_RATE,
} from './shared/constants.js';
import { RNG, createSeed } from './shared/rng.js';
import { step, initializeSnake, InputMap } from './shared/step.js';
import { hashState } from './shared/hash.js';
import { sendMessage, broadcastToRoom, generateRoomCode, getLobbyData, findClientSocket } from './index.js';

// Input tracking for rate limiting
const inputRates = new Map<string, number[]>();

export function createRoom(hostId: string, hostName: string, settings?: Partial<any>): Room {
  const room: Room = {
    code: generateRoomCode(),
    hostId,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    players: new Map(),
    state: {
      snakes: new Map(),
      foods: [],
      events: [],
    },
    status: 'waiting',
    tick: 0,
    seed: createSeed(),
  };
  
  // Add host as first player
  room.players.set(hostId, {
    id: hostId,
    name: hostName,
    ready: false,
    spectating: false,
  });
  
  return room;
}

export function joinRoom(room: Room, playerId: string, playerName: string): boolean {
  if (room.status !== 'waiting') {
    return false; // Can't join ongoing game
  }
  
  if (room.players.size >= room.settings.maxPlayers) {
    return false; // Room full
  }
  
  room.players.set(playerId, {
    id: playerId,
    name: playerName,
    ready: false,
    spectating: false,
  });
  
  return true;
}

export function handleMessage(
  ws: WebSocket,
  message: ClientMessage,
  client: any,
  rooms: Map<string, Room>,
  clients: Map<WebSocket, any>
) {
  switch (message.type) {
    case 'createRoom':
      handleCreateRoom(ws, message.data, client, rooms);
      break;
      
    case 'join':
      handleJoin(ws, message.data, client, rooms, clients);
      break;
      
    case 'ready':
      handleReady(ws, message.data, client, rooms, clients);
      break;
      
    case 'input':
      handleInput(ws, message.data, client, rooms);
      break;
      
    case 'spectate':
      handleSpectate(ws, client, rooms, clients);
      break;
      
    case 'ping':
      sendMessage(ws, { type: 'pong', data: {} });
      break;
      
    default:
      sendMessage(ws, {
        type: 'error',
        data: {
          code: 'UNKNOWN_MESSAGE',
          message: 'Unknown message type',
        },
      });
  }
}

function handleCreateRoom(
  ws: WebSocket,
  data: CreateRoomMessage,
  client: any,
  rooms: Map<string, Room>
) {
  // Leave current room if in one
  if (client.roomCode) {
    const oldRoom = rooms.get(client.roomCode);
    if (oldRoom) {
      oldRoom.players.delete(client.playerId);
    }
  }
  
  const room = createRoom(client.playerId, 'Player', data.settings);
  rooms.set(room.code, room);
  client.roomCode = room.code;
  
  sendMessage(ws, {
    type: 'roomCreated',
    data: {
      roomCode: room.code,
    },
  });
  
  sendMessage(ws, {
    type: 'joined',
    data: {
      playerId: client.playerId,
      roomCode: room.code,
      seed: room.seed,
      settings: room.settings,
    },
  });
  
  sendMessage(ws, {
    type: 'lobby',
    data: getLobbyData(room),
  });
}

function handleJoin(
  ws: WebSocket,
  data: JoinMessage,
  client: any,
  rooms: Map<string, Room>,
  clients: Map<WebSocket, any>
) {
  const { name, roomCode } = data;
  
  // Update player name
  client.name = name || 'Player';
  
  // If no room code, create new room
  if (!roomCode) {
    handleCreateRoom(ws, {}, client, rooms);
    return;
  }
  
  // Find and join room
  const room = rooms.get(roomCode.toUpperCase());
  
  if (!room) {
    sendMessage(ws, {
      type: 'error',
      data: {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      },
    });
    return;
  }
  
  if (!joinRoom(room, client.playerId, client.name)) {
    sendMessage(ws, {
      type: 'error',
      data: {
        code: 'ROOM_FULL',
        message: 'Room is full or game in progress',
      },
    });
    return;
  }
  
  client.roomCode = room.code;
  
  sendMessage(ws, {
    type: 'joined',
    data: {
      playerId: client.playerId,
      roomCode: room.code,
      seed: room.seed,
      settings: room.settings,
    },
  });
  
  // Broadcast lobby update to all players
  broadcastToRoom(room, {
    type: 'lobby',
    data: getLobbyData(room),
  }, clients);
}

function handleReady(
  ws: WebSocket,
  data: ReadyMessage,
  client: any,
  rooms: Map<string, Room>,
  clients: Map<WebSocket, any>
) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  
  const player = room.players.get(client.playerId);
  if (!player) return;
  
  player.ready = data.value;
  
  // Broadcast lobby update
  broadcastToRoom(room, {
    type: 'lobby',
    data: getLobbyData(room),
  }, clients);
  
  // Check if all players are ready (minimum 2)
  const readyCount = Array.from(room.players.values()).filter(p => p.ready).length;
  
  if (readyCount >= 2 && readyCount === room.players.size && room.status === 'waiting') {
    startGame(room, rooms, clients);
  }
}

function startGame(
  room: Room,
  rooms: Map<string, Room>,
  clients: Map<WebSocket, any>
) {
  room.status = 'starting';
  
  // Broadcast countdown start
  broadcastToRoom(room, {
    type: 'start',
    data: {
      startTime: Date.now() + COUNTDOWN_DURATION,
      tickRate: room.settings.tickRate,
    },
  }, clients);
  
  // Initialize game state
  const rng = new RNG(room.seed);
  const playerArray = Array.from(room.players.values());
  
  // Create snakes with starting positions
  room.state.snakes.clear();
  
  playerArray.forEach((player, index) => {
    // Distribute players around the grid
    const angle = (index / playerArray.length) * Math.PI * 2;
    const centerX = Math.floor(room.settings.gridWidth / 2);
    const centerY = Math.floor(room.settings.gridHeight / 2);
    const radius = Math.min(room.settings.gridWidth, room.settings.gridHeight) / 3;
    
    const x = Math.floor(centerX + Math.cos(angle) * radius);
    const y = Math.floor(centerY + Math.sin(angle) * radius);
    
    // Random starting direction
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    const direction = rng.choice(directions);
    
    const snake = initializeSnake(
      player.id,
      { x, y },
      direction,
      SNAKE_COLORS[index % SNAKE_COLORS.length]
    );
    
    room.state.snakes.set(player.id, snake);
    player.snake = snake;
  });
  
  // Initialize food
  room.state.foods = [];
  for (let i = 0; i < room.settings.foodCount; i++) {
    const pos = findEmptyPosition(room, rng);
    if (pos) {
      const isSpecial = rng.next() < room.settings.specialFoodChance;
      room.state.foods.push({
        position: pos,
        type: isSpecial ? 'special' : 'normal',
        value: isSpecial ? 3 : 1,
      });
    }
  }
  
  // Start game loop after countdown
  setTimeout(() => {
    room.status = 'playing';
    room.tick = 0;
    startGameLoop(room, rooms, clients);
  }, COUNTDOWN_DURATION);
}

function startGameLoop(
  room: Room,
  rooms: Map<string, Room>,
  clients: Map<WebSocket, any>
) {
  const tickInterval = 1000 / room.settings.tickRate;
  const rng = new RNG(room.seed + room.tick);
  
  // Store pending inputs
  const pendingInputs = new Map<string, Direction>();
  
  const gameLoop = setInterval(() => {
    if (room.status !== 'playing') {
      clearInterval(gameLoop);
      return;
    }
    
    // Process game step
    const inputs: InputMap = {};
    pendingInputs.forEach((dir, playerId) => {
      inputs[playerId] = dir;
    });
    pendingInputs.clear();
    
    room.state = step(room.state, inputs, room.settings, rng);
    room.tick++;
    
    // Check for game end
    const aliveSnakes = Array.from(room.state.snakes.values()).filter(s => s.alive);
    
    if (aliveSnakes.length <= 1) {
      endGame(room, rooms, clients);
      clearInterval(gameLoop);
      return;
    }
    
    // Broadcast state update
    room.players.forEach((player, playerId) => {
      const ws = findClientSocket(playerId, clients);
      if (!ws) return;
      
      const yourSnake = room.state.snakes.get(playerId);
      const otherSnakes = Array.from(room.state.snakes.values())
        .filter(s => s.id !== playerId);
      
      sendMessage(ws, {
        type: 'state',
        data: {
          tick: room.tick,
          seqAck: player.lastSeq || 0,
          you: yourSnake,
          others: otherSnakes,
          foods: room.state.foods,
          events: room.state.events,
          full: room.tick % 30 === 0, // Send full state every 30 ticks
          hash: hashState(room.state),
        },
      });
    });
    
    // Clear events after broadcasting
    room.state.events = [];
  }, tickInterval);
  
  // Store game loop reference for input handling
  room.gameLoop = gameLoop;
  room.pendingInputs = pendingInputs;
}

function handleInput(
  ws: WebSocket,
  data: InputMessage,
  client: any,
  rooms: Map<string, Room>
) {
  const room = rooms.get(client.roomCode);
  if (!room || room.status !== 'playing') return;
  
  const player = room.players.get(client.playerId);
  if (!player) return;
  
  // Rate limiting
  const now = Date.now();
  const rates = inputRates.get(client.playerId) || [];
  const recentRates = rates.filter(t => now - t < 1000);
  
  if (recentRates.length >= MAX_INPUT_RATE) {
    return; // Drop input if rate limit exceeded
  }
  
  recentRates.push(now);
  inputRates.set(client.playerId, recentRates);
  
  // Store input for next tick
  if (room.pendingInputs) {
    room.pendingInputs.set(client.playerId, data.dir);
  }
  
  // Track sequence for acknowledgment
  player.lastSeq = data.seq;
}

function handleSpectate(
  ws: WebSocket,
  client: any,
  rooms: Map<string, Room>,
  clients: Map<WebSocket, any>
) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  
  const player = room.players.get(client.playerId);
  if (!player) return;
  
  player.spectating = true;
  player.ready = false;
  
  // Broadcast lobby update if in waiting state
  if (room.status === 'waiting') {
    broadcastToRoom(room, {
      type: 'lobby',
      data: getLobbyData(room),
    }, clients);
  }
}

function endGame(
  room: Room,
  rooms: Map<string, Room>,
  clients: Map<WebSocket, any>
) {
  room.status = 'ended';
  
  // Calculate leaderboard
  const leaderboard = Array.from(room.players.values())
    .map(player => {
      const snake = room.state.snakes.get(player.id);
      return {
        id: player.id,
        name: player.name,
        score: snake ? snake.score : 0,
        survived: snake && snake.alive ? room.tick : 0,
      };
    })
    .sort((a, b) => {
      // Sort by survival time first, then score
      if (a.survived !== b.survived) {
        return b.survived - a.survived;
      }
      return b.score - a.score;
    });
  
  const winner = leaderboard[0]?.id;
  
  // Broadcast game end
  broadcastToRoom(room, {
    type: 'ended',
    data: {
      leaderboard,
      winner,
    },
  }, clients);
  
  // Reset room after delay
  setTimeout(() => {
    room.status = 'waiting';
    room.tick = 0;
    room.state = {
      snakes: new Map(),
      foods: [],
      events: [],
    };
    
    // Reset player states
    room.players.forEach(player => {
      player.ready = false;
      player.snake = undefined;
    });
    
    // Broadcast lobby state
    broadcastToRoom(room, {
      type: 'lobby',
      data: getLobbyData(room),
    }, clients);
  }, 5000);
}

function findEmptyPosition(room: Room, rng: RNG) {
  const occupied = new Set<string>();
  
  room.state.snakes.forEach(snake => {
    snake.body.forEach(seg => {
      occupied.add(`${seg.x},${seg.y}`);
    });
  });
  
  room.state.foods.forEach(food => {
    occupied.add(`${food.position.x},${food.position.y}`);
  });
  
  const empty = [];
  for (let x = 0; x < room.settings.gridWidth; x++) {
    for (let y = 0; y < room.settings.gridHeight; y++) {
      if (!occupied.has(`${x},${y}`)) {
        empty.push({ x, y });
      }
    }
  }
  
  return empty.length > 0 ? rng.choice(empty) : null;
}

// Add these type extensions to Room
declare module './shared/types' {
  interface Room {
    gameLoop?: NodeJS.Timeout;
    pendingInputs?: Map<string, Direction>;
  }
  
  interface Player {
    lastSeq?: number;
  }
}
