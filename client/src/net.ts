// WebSocket networking and synchronization

import {
  ServerMessage,
  ClientMessage,
  Direction,
  Snake,
  GameState,
  StateMessage,
  JoinedMessage,
  LobbyMessage,
  StartMessage,
  EndedMessage,
  ErrorMessage
} from './shared/types';
import { RECONCILIATION_BUFFER_SIZE } from './shared/constants';
import { setCurrentState, setPlayerId, setRoomCode, setGameStatus, playerId, gameStatus } from './main';
import { showError, updateLobby, showCountdown, showEndScreen } from './ui';
import { RNG } from './shared/rng';
import { step, InputMap } from './shared/step';
import { hashState } from './shared/hash';

let ws: WebSocket | null = null;
let sequenceNumber = 0;
let pendingInputs: Array<{ seq: number; dir: Direction; time: number }> = [];
let lastAcknowledgedSeq = 0;
let serverStates: StateMessage[] = [];
let currentTick = 0;
let roomSettings: any = null;
let roomSeed = 0;
let pingStartTime = 0;
let currentPing = 0;

// Predicted state for client-side prediction
let predictedState: GameState | null = null;

export function connect(serverUrl?: string) {
  const url = serverUrl || (import.meta as any).env?.VITE_SERVER_URL || 'ws://134.209.227.100:3005';

  try {
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('Connected to server');
      startPingInterval();
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      showError('Connection error');
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      showError('Disconnected from server');
      ws = null;
    };
  } catch (error) {
    console.error('Failed to connect:', error);
    showError('Failed to connect to server');
  }
}

function handleMessage(message: ServerMessage) {
  switch (message.type) {
    case 'joined':
      handleJoined(message.data as JoinedMessage);
      break;

    case 'roomCreated':
      // Room created, waiting for joined message
      break;

    case 'lobby':
      handleLobby(message.data as LobbyMessage);
      break;

    case 'start':
      handleStart(message.data as StartMessage);
      break;

    case 'state':
      handleState(message.data as StateMessage);
      break;

    case 'ended':
      handleEnded(message.data as EndedMessage);
      break;

    case 'error':
      handleError(message.data as ErrorMessage);
      break;

    case 'pong':
      handlePong();
      break;
  }
}

function handleJoined(data: JoinedMessage) {
  setPlayerId(data.playerId);
  setRoomCode(data.roomCode);
  roomSettings = data.settings;
  roomSeed = data.seed;
  setGameStatus('lobby');
  console.log(`Joined room ${data.roomCode} as player ${data.playerId}`);
}

function handleLobby(data: LobbyMessage) {
  // If we're coming from an ended game, transition back to lobby
  if (gameStatus === 'ended') {
    setGameStatus('lobby');
  }
  updateLobby(data);
}

function handleStart(data: StartMessage) {
  // tickRate = data.tickRate; // Store if needed later
  const countdown = Math.max(0, data.startTime - Date.now());
  showCountdown(countdown);

  setTimeout(() => {
    setGameStatus('playing');
    currentTick = 0;
    serverStates = [];
    pendingInputs = [];
    predictedState = null;
  }, countdown);
}

function handleState(data: StateMessage) {
  // Acknowledge inputs
  lastAcknowledgedSeq = data.seqAck;

  // Remove acknowledged inputs
  pendingInputs = pendingInputs.filter(input => input.seq > lastAcknowledgedSeq);

  // Store server state for interpolation
  serverStates.push(data);
  if (serverStates.length > 10) {
    serverStates.shift();
  }

  // Update current tick
  currentTick = data.tick;

  // Reconstruct full game state
  const gameState: GameState = {
    snakes: new Map(),
    foods: data.foods,
    projectiles: data.projectiles || [],
    events: data.events,
  };

  // Add your snake if exists
  if (data.you && playerId) {
    gameState.snakes.set(playerId, data.you);
  }

  // Add other snakes
  data.others.forEach(snake => {
    gameState.snakes.set(snake.id, snake);
  });

  // Apply client-side prediction
  if (playerId && pendingInputs.length > 0) {
    predictedState = { ...gameState };
    const rng = new RNG(roomSeed + currentTick);

    // Re-apply unacknowledged inputs
    pendingInputs.forEach(input => {
      const inputs: InputMap = { [playerId as string]: input.dir };
      predictedState = step(predictedState!, inputs, roomSettings, rng);
    });

    setCurrentState(predictedState);
  } else {
    setCurrentState(gameState);
    predictedState = gameState;
  }

  // Debug: Check state hash
  if (data.hash) {
    const clientHash = hashState(gameState);
    if (clientHash !== data.hash) {
      console.warn(`State mismatch! Server: ${data.hash}, Client: ${clientHash}`);
    }
  }
}

function handleEnded(data: EndedMessage) {
  setGameStatus('ended');
  showEndScreen(data);
}

function handleError(data: ErrorMessage) {
  showError(data.message);
  console.error('Server error:', data);
}

function handlePong() {
  currentPing = Date.now() - pingStartTime;
}

export function sendMessage(message: ClientMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function joinRoom(name: string, code?: string) {
  connect();

  // Wait for connection
  const checkConnection = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      clearInterval(checkConnection);
      sendMessage({
        type: 'join',
        data: { name, roomCode: code }
      });
    }
  }, 100);
}

export function createRoom(name: string) {
  connect();

  // Wait for connection
  const checkConnection = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      clearInterval(checkConnection);
      sendMessage({
        type: 'createRoom',
        data: {}
      });

      // Then join with name
      setTimeout(() => {
        sendMessage({
          type: 'join',
          data: { name }
        });
      }, 100);
    }
  }, 100);
}

export function setReady(ready: boolean) {
  sendMessage({
    type: 'ready',
    data: { value: ready }
  });
}

export function sendInput(direction: Direction) {
  if (!playerId) return;

  // Check if opposite direction
  const currentSnake = predictedState?.snakes.get(playerId);
  if (currentSnake) {
    const opposite = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left'
    };

    if (opposite[direction] === currentSnake.direction) {
      return; // Ignore opposite direction
    }
  }

  sequenceNumber++;
  const input = {
    seq: sequenceNumber,
    dir: direction,
    time: Date.now()
  };

  // Store for prediction
  pendingInputs.push(input);
  if (pendingInputs.length > RECONCILIATION_BUFFER_SIZE) {
    pendingInputs.shift();
  }

  // Send to server
  sendMessage({
    type: 'input',
    data: {
      seq: input.seq,
      dir: direction,
      clientTime: input.time
    }
  });

  // Apply prediction immediately
  if (predictedState && roomSettings) {
    const inputs: InputMap = { [playerId as string]: direction };
    const rng = new RNG(roomSeed + currentTick + 1);
    predictedState = step(predictedState, inputs, roomSettings, rng);
    setCurrentState(predictedState);
  }
}

export function sendBoost(active: boolean) {
  sendMessage({
    type: 'boost',
    data: { active }
  });
}

export function sendFire() {
  if (!playerId) return;
  
  sendMessage({
    type: 'fire',
    data: { playerId }
  });
}

function startPingInterval() {
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      pingStartTime = Date.now();
      sendMessage({ type: 'ping', data: {} });
    }
  }, 5000);
}

export function getPing(): number {
  return currentPing;
}

// Interpolation for other players
export function getInterpolatedState(): GameState | null {
  if (serverStates.length < 2) return null;

  // const now = Date.now() - INTERPOLATION_DELAY;

  // Find two states to interpolate between
  let state1: StateMessage | null = null;
  let state2: StateMessage | null = null;

  for (let i = 0; i < serverStates.length - 1; i++) {
    if (serverStates[i].tick <= currentTick && serverStates[i + 1].tick > currentTick) {
      state1 = serverStates[i];
      state2 = serverStates[i + 1];
      break;
    }
  }

  if (!state1 || !state2) return null;

  // Calculate interpolation factor
  const tickDiff = state2.tick - state1.tick;
  const t = Math.min(1, (currentTick - state1.tick) / tickDiff);

  // Create interpolated state
  const interpolated: GameState = {
    snakes: new Map(),
    foods: state2.foods, // Use latest food positions
    projectiles: state2.projectiles || [],
    events: []
  };

  // Interpolate other players' positions
  state2.others.forEach(snake2 => {
    const snake1 = state1!.others.find(s => s.id === snake2.id);
    if (!snake1) {
      interpolated.snakes.set(snake2.id, snake2);
      return;
    }

    // Interpolate snake segments
    const interpolatedSnake: Snake = {
      ...snake2,
      body: snake2.body.map((seg2, i) => {
        if (i >= snake1.body.length) return seg2;
        const seg1 = snake1.body[i];
        return {
          x: seg1.x + (seg2.x - seg1.x) * t,
          y: seg1.y + (seg2.y - seg1.y) * t
        };
      })
    };

    interpolated.snakes.set(snake2.id, interpolatedSnake);
  });

  // Add your predicted snake
  if (playerId && predictedState) {
    const yourSnake = predictedState.snakes.get(playerId);
    if (yourSnake) {
      interpolated.snakes.set(playerId, yourSnake);
    }
  }

  return interpolated;
}
