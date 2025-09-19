// Input handling for keyboard and touch

import { sendInput, sendBoost, sendFire } from './net';
import { Direction } from './shared/types';
import { OPPOSITE_DIRECTIONS } from './shared/constants';
import { gameStatus } from './main';

let lastDirection: Direction | null = null;
let inputBuffer: Direction | null = null;
let lastInputTime = 0;
const INPUT_COOLDOWN = 50; // ms between inputs
let isBoostPressed = false;
let lastFireTime = 0;
const FIRE_COOLDOWN = 500; // ms between fires

export function initInput() {
  // Keyboard controls
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('keyup', handleKeyup);
  
  // Touch controls
  initTouchControls();
  
  // Mobile control buttons
  initMobileButtons();
}

function handleKeydown(event: KeyboardEvent) {
  // Only handle input during game
  if (gameStatus !== 'playing') return;
  
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
    case 'Shift':
      if (!isBoostPressed) {
        isBoostPressed = true;
        sendBoost(true);
      }
      event.preventDefault();
      return;
    case ' ':
    case 'Space':
      const now = Date.now();
      if (now - lastFireTime >= FIRE_COOLDOWN) {
        sendFire();
        lastFireTime = now;
      }
      event.preventDefault();
      return;
  }
  
  if (direction) {
    event.preventDefault();
    handleDirectionInput(direction);
  }
}

function handleKeyup(event: KeyboardEvent) {
  if (event.key === 'Shift' && isBoostPressed) {
    isBoostPressed = false;
    sendBoost(false);
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
  
  // Add action buttons
  const actionControls = document.createElement('div');
  actionControls.className = 'mobile-actions';
  actionControls.style.cssText = `
    position: absolute;
    bottom: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
  `;
  actionControls.innerHTML = `
    <button class="action-button boost" id="boostBtn">⚡ Boost</button>
    <button class="action-button fire" id="fireBtn">🔥 Fire</button>
  `;
  
  ui.appendChild(controls);
  ui.appendChild(actionControls);
  
  // Add event listeners for direction buttons
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
  
  // Boost button
  const boostBtn = document.getElementById('boostBtn');
  if (boostBtn) {
    boostBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!isBoostPressed) {
        isBoostPressed = true;
        sendBoost(true);
        boostBtn.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
      }
    });
    
    boostBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (isBoostPressed) {
        isBoostPressed = false;
        sendBoost(false);
        boostBtn.style.backgroundColor = '';
      }
    });
  }
  
  // Fire button
  const fireBtn = document.getElementById('fireBtn');
  if (fireBtn) {
    fireBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastFireTime >= FIRE_COOLDOWN) {
        sendFire();
        lastFireTime = now;
        
        // Visual feedback
        fireBtn.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
        setTimeout(() => {
          fireBtn.style.backgroundColor = '';
        }, 200);
      }
    });
  }
}

// Reset input state
export function resetInput() {
  lastDirection = null;
  inputBuffer = null;
  lastInputTime = 0;
}
