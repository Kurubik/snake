// Input handling for keyboard and touch

import { sendInput } from './net';
import { Direction } from './shared/types';
import { OPPOSITE_DIRECTIONS } from './shared/constants';

let lastDirection: Direction | null = null;
let inputBuffer: Direction | null = null;
let lastInputTime = 0;
const INPUT_COOLDOWN = 50; // ms between inputs

export function initInput() {
  // Keyboard controls
  window.addEventListener('keydown', handleKeyboard);
  
  // Touch controls
  initTouchControls();
  
  // Mobile control buttons
  initMobileButtons();
}

function handleKeyboard(event: KeyboardEvent) {
  let direction: Direction | null = null;
  
  switch (event.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      direction = 'up';
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      direction = 'down';
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      direction = 'left';
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      direction = 'right';
      break;
  }
  
  if (direction) {
    event.preventDefault();
    handleDirectionInput(direction);
  }
}

function handleDirectionInput(direction: Direction) {
  const now = Date.now();
  
  // Rate limit inputs
  if (now - lastInputTime < INPUT_COOLDOWN) {
    inputBuffer = direction;
    return;
  }
  
  // Prevent opposite direction
  if (lastDirection && OPPOSITE_DIRECTIONS[direction] === lastDirection) {
    return;
  }
  
  // Send input
  sendInput(direction);
  lastDirection = direction;
  lastInputTime = now;
  
  // Process buffered input after cooldown
  if (inputBuffer) {
    const buffered = inputBuffer;
    inputBuffer = null;
    setTimeout(() => {
      handleDirectionInput(buffered);
    }, INPUT_COOLDOWN);
  }
}

// Touch/swipe controls
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

function initTouchControls() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  
  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
  }, { passive: true });
  
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });
  
  canvas.addEventListener('touchend', (e) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;
    
    // Require minimum swipe distance and max time
    const minDistance = 30;
    const maxTime = 500;
    
    if (deltaTime > maxTime) return;
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    if (absX < minDistance && absY < minDistance) return;
    
    // Determine swipe direction
    if (absX > absY) {
      // Horizontal swipe
      handleDirectionInput(deltaX > 0 ? 'right' : 'left');
    } else {
      // Vertical swipe
      handleDirectionInput(deltaY > 0 ? 'down' : 'up');
    }
  }, { passive: true });
}

// Mobile button controls
function initMobileButtons() {
  // Create mobile control buttons if on touch device
  if (!('ontouchstart' in window)) return;
  
  const ui = document.getElementById('ui');
  if (!ui) return;
  
  const controls = document.createElement('div');
  controls.className = 'mobile-controls';
  controls.innerHTML = `
    <button class="control-button up" data-dir="up">↑</button>
    <button class="control-button left" data-dir="left">←</button>
    <button class="control-button right" data-dir="right">→</button>
    <button class="control-button down" data-dir="down">↓</button>
  `;
  
  ui.appendChild(controls);
  
  // Add event listeners
  controls.querySelectorAll('.control-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const dir = (e.target as HTMLElement).dataset.dir as Direction;
      if (dir) {
        handleDirectionInput(dir);
      }
    });
    
    // Prevent double tap zoom
    button.addEventListener('touchend', (e) => {
      e.preventDefault();
    });
  });
}

// Reset input state
export function resetInput() {
  lastDirection = null;
  inputBuffer = null;
  lastInputTime = 0;
}
