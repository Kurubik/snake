// Shared types for multiplayer snake game

export interface Position {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Snake {
  id: string;
  body: Position[];
  direction: Direction;
  nextDirection?: Direction;
  alive: boolean;
  score: number;
  color: string;
}

export interface Food {
  position: Position;
  type: 'normal' | 'special';
  value: number;
}

export interface Player {
  id: string;
  name: string;
  ready: boolean;
  spectating: boolean;
  snake?: Snake;
  ping?: number;
}

export interface RoomSettings {
  gridWidth: number;
  gridHeight: number;
  wrapEnabled: boolean;
  tickRate: number;
  maxPlayers: number;
  foodCount: number;
  specialFoodChance: number;
}

export interface Room {
  code: string;
  hostId: string;
  settings: RoomSettings;
  players: Map<string, Player>;
  state: GameState;
  status: 'waiting' | 'starting' | 'playing' | 'ended';
  tick: number;
  seed: number;
}

export interface GameState {
  snakes: Map<string, Snake>;
  foods: Food[];
  events: GameEvent[];
}

export interface GameEvent {
  type: 'eat' | 'death' | 'spawn';
  playerId?: string;
  position?: Position;
  data?: any;
}

// Network messages
export interface ClientMessage {
  type: 'join' | 'createRoom' | 'ready' | 'input' | 'spectate' | 'ping';
  data: any;
}

export interface ServerMessage {
  type: 'joined' | 'lobby' | 'start' | 'state' | 'ended' | 'error' | 'pong' | 'roomCreated';
  data: any;
}

// Specific message payloads
export interface JoinMessage {
  name: string;
  roomCode?: string;
}

export interface CreateRoomMessage {
  settings?: Partial<RoomSettings>;
}

export interface ReadyMessage {
  value: boolean;
}

export interface InputMessage {
  seq: number;
  dir: Direction;
  clientTime: number;
}

export interface JoinedMessage {
  playerId: string;
  roomCode: string;
  seed: number;
  settings: RoomSettings;
}

export interface LobbyMessage {
  players: Array<{
    id: string;
    name: string;
    ready: boolean;
    isHost: boolean;
  }>;
  settings: RoomSettings;
  status: string;
}

export interface StartMessage {
  startTime: number;
  tickRate: number;
}

export interface StateMessage {
  tick: number;
  seqAck: number;
  you?: Snake;
  others: Snake[];
  foods: Food[];
  events: GameEvent[];
  full?: boolean;
  hash?: string;
}

export interface EndedMessage {
  leaderboard: Array<{
    id: string;
    name: string;
    score: number;
    survived: number;
  }>;
  winner?: string;
}

export interface ErrorMessage {
  code: string;
  message: string;
}