// Main entry point for the client

import { initScene, render, updateScene } from './scene';
import { initUI, updateUI } from './ui';
import { initInput } from './input';
import { GameState } from './shared/types';

// Global state
export let currentState: GameState | null = null;
export let playerId: string | null = null;
export let roomCode: string | null = null;
export let gameStatus: string = 'menu';

// Initialize everything
export function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }

  // Initialize Three.js scene
  initScene(canvas);
  
  // Initialize UI
  initUI();
  
  // Initialize input handling
  initInput();
  
  // Start render loop
  requestAnimationFrame(gameLoop);
}

// Game loop
let lastTime = 0;
function gameLoop(time: number) {
  const deltaTime = time - lastTime;
  lastTime = time;
  
  // Update scene (interpolation, animations)
  updateScene(deltaTime);
  
  // Update UI
  updateUI();
  
  // Render
  render();
  
  requestAnimationFrame(gameLoop);
}

// Handle resize
window.addEventListener('resize', () => {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
});

// Export setters for global state
export function setCurrentState(state: GameState | null) {
  currentState = state;
}

export function setPlayerId(id: string | null) {
  playerId = id;
}

export function setRoomCode(code: string | null) {
  roomCode = code;
}

export function setGameStatus(status: string) {
  gameStatus = status;
}

// Start the app
init();
