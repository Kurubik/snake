// UI management and updates

import { joinRoom, createRoom, setReady, getPing } from './net';
import { gameStatus, playerId, roomCode, currentState } from './main';
import { LobbyMessage, EndedMessage } from './shared/types';
import { updateGridSize } from './scene';

let uiContainer: HTMLElement | null = null;
let currentLobbyData: LobbyMessage | null = null;

export function initUI() {
  uiContainer = document.getElementById('ui');
  if (!uiContainer) {
    console.error('UI container not found');
    return;
  }
  
  showMainMenu();
}

export function updateUI() {
  // Update HUD if in game
  if (gameStatus === 'playing' && currentState) {
    updateHUD();
  }
}

function showMainMenu() {
  if (!uiContainer) return;
  
  uiContainer.innerHTML = `
    <div class="menu">
      <h1>🐍 Multiplayer Snake</h1>
      
      <div class="form-group">
        <label>Your Name</label>
        <input type="text" id="playerName" placeholder="Enter your name" maxlength="20" value="${localStorage.getItem('playerName') || ''}">
      </div>
      
      <button class="button primary" id="createRoomBtn">Create Room</button>
      
      <div style="text-align: center; margin: 1rem 0; color: rgba(255,255,255,0.5);">
        — OR —
      </div>
      
      <div class="form-group">
        <label>Room Code</label>
        <input type="text" id="roomCode" placeholder="Enter room code" maxlength="6" style="text-transform: uppercase;">
      </div>
      
      <button class="button" id="joinRoomBtn">Join Room</button>
      
      <div id="errorMsg" class="error-message"></div>
    </div>
  `;
  
  // Add event listeners
  const createBtn = document.getElementById('createRoomBtn');
  const joinBtn = document.getElementById('joinRoomBtn');
  const nameInput = document.getElementById('playerName') as HTMLInputElement;
  const codeInput = document.getElementById('roomCode') as HTMLInputElement;
  
  createBtn?.addEventListener('click', () => {
    const name = nameInput?.value.trim() || 'Player';
    localStorage.setItem('playerName', name);
    createRoom(name);
  });
  
  joinBtn?.addEventListener('click', () => {
    const name = nameInput?.value.trim() || 'Player';
    const code = codeInput?.value.trim().toUpperCase();
    
    if (!code) {
      showError('Please enter a room code');
      return;
    }
    
    localStorage.setItem('playerName', name);
    joinRoom(name, code);
  });
  
  // Enter key handling
  nameInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      createBtn?.click();
    }
  });
  
  codeInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      joinBtn?.click();
    }
  });
}

export function updateLobby(data: LobbyMessage) {
  currentLobbyData = data;
  
  if (!uiContainer || gameStatus !== 'lobby') return;
  
  // Update grid size from settings
  if (data.settings) {
    updateGridSize(data.settings.gridWidth, data.settings.gridHeight);
  }
  
  const isHost = data.players.find(p => p.id === playerId)?.isHost || false;
  const myPlayer = data.players.find(p => p.id === playerId);
  
  uiContainer.innerHTML = `
    <div class="menu">
      <h2>Game Lobby</h2>
      
      <div class="room-code-display">
        <div class="label">Room Code</div>
        <div class="code">${roomCode}</div>
      </div>
      
      <div style="margin: 1.5rem 0;">
        <h3 style="color: #00ffff; margin-bottom: 1rem;">Players (${data.players.length}/${data.settings.maxPlayers})</h3>
        ${data.players.map(player => `
          <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
            <span style="flex: 1;">${player.name}</span>
            ${player.isHost ? '<span style="color: #ffff00; margin: 0 0.5rem;">👑</span>' : ''}
            ${player.ready ? '<span style="color: #00ff00;">✓ Ready</span>' : '<span style="color: #666;">Not ready</span>'}
          </div>
        `).join('')}
      </div>
      
      <button class="button ${myPlayer?.ready ? 'ready' : ''}" id="readyBtn">
        ${myPlayer?.ready ? 'Not Ready' : 'Ready'}
      </button>
      
      ${isHost && data.players.filter(p => p.ready).length >= 2 ? `
        <button class="button primary" id="startBtn">Start Game</button>
      ` : ''}
      
      <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
        <h4 style="color: rgba(255,255,255,0.7); margin-bottom: 0.5rem;">Settings</h4>
        <div style="font-size: 0.9rem; color: rgba(255,255,255,0.5);">
          Grid: ${data.settings.gridWidth}x${data.settings.gridHeight}<br>
          Wrap: ${data.settings.wrapEnabled ? 'On' : 'Off'}<br>
          Speed: ${data.settings.tickRate} ticks/sec
        </div>
      </div>
    </div>
  `;
  
  // Add event listeners
  const readyBtn = document.getElementById('readyBtn');
  readyBtn?.addEventListener('click', () => {
    const isReady = myPlayer?.ready || false;
    setReady(!isReady);
  });
  
  const startBtn = document.getElementById('startBtn');
  startBtn?.addEventListener('click', () => {
    // Host can force start
    setReady(true);
  });
}

export function showCountdown(duration: number) {
  if (!uiContainer) return;
  
  let remaining = Math.ceil(duration / 1000);
  
  const updateCountdown = () => {
    if (remaining > 0) {
      uiContainer!.innerHTML = `
        <div class="countdown">${remaining}</div>
      `;
      remaining--;
      setTimeout(updateCountdown, 1000);
    } else {
      uiContainer!.innerHTML = '';
      showGameHUD();
    }
  };
  
  updateCountdown();
}

function showGameHUD() {
  if (!uiContainer) return;
  
  uiContainer.innerHTML = `
    <div class="hud">
      <div class="hud-item">
        <span class="hud-label">Room</span>
        <span class="hud-value">${roomCode}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Score</span>
        <span class="hud-value" id="score">0</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Alive</span>
        <span class="hud-value" id="alive">0</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Ping</span>
        <span class="hud-value" id="ping">-</span>
      </div>
    </div>
    
    <div class="players-list">
      <h3>Players</h3>
      <div id="playersList"></div>
    </div>
  `;
}

function updateHUD() {
  if (!currentState || !playerId) return;
  
  // Update score
  const scoreElement = document.getElementById('score');
  const mySnake = currentState.snakes.get(playerId);
  if (scoreElement && mySnake) {
    scoreElement.textContent = mySnake.score.toString();
  }
  
  // Update alive count
  const aliveElement = document.getElementById('alive');
  if (aliveElement) {
    const aliveCount = Array.from(currentState.snakes.values()).filter(s => s.alive).length;
    aliveElement.textContent = aliveCount.toString();
  }
  
  // Update ping
  const pingElement = document.getElementById('ping');
  if (pingElement) {
    const ping = getPing();
    pingElement.textContent = ping > 0 ? `${ping}ms` : '-';
  }
  
  // Update players list
  const playersListElement = document.getElementById('playersList');
  if (playersListElement && currentLobbyData) {
    const playerItems = Array.from(currentState.snakes.values()).map(snake => {
      const player = currentLobbyData ? currentLobbyData.players.find(p => p.id === snake.id) : null;
      if (!player) return '';
      
      return `
        <div class="player-item">
          <div class="player-color" style="background-color: ${snake.color};"></div>
          <span class="player-name">${player.name}</span>
          <span class="player-status ${snake.alive ? '' : 'dead'}">
            ${snake.alive ? snake.score : '💀'}
          </span>
        </div>
      `;
    }).join('');
    
    playersListElement.innerHTML = playerItems;
  }
}

export function showEndScreen(data: EndedMessage) {
  if (!uiContainer) return;
  
  uiContainer.innerHTML = `
    <div class="menu">
      <h2>Game Over!</h2>
      
      ${data.winner ? `
        <div style="text-align: center; margin: 1.5rem 0;">
          <div style="font-size: 3rem;">🏆</div>
          <div style="color: #ffff00; font-size: 1.2rem;">
            ${data.leaderboard.find(p => p.id === data.winner)?.name} Wins!
          </div>
        </div>
      ` : ''}
      
      <div class="leaderboard">
        ${data.leaderboard.map((player, index) => `
          <div class="leaderboard-item ${index === 0 ? 'winner' : ''}">
            <span style="margin-right: 1rem;">#${index + 1}</span>
            <span class="leaderboard-name">${player.name}</span>
            <span class="leaderboard-score">${player.score}</span>
          </div>
        `).join('')}
      </div>
      
      <button class="button primary" id="playAgainBtn">Play Again</button>
      <button class="button" id="menuBtn">Main Menu</button>
    </div>
  `;
  
  // Add event listeners
  const playAgainBtn = document.getElementById('playAgainBtn');
  playAgainBtn?.addEventListener('click', () => {
    // Wait for server to reset, then mark ready
    setTimeout(() => {
      setReady(true);
    }, 100);
  });
  
  const menuBtn = document.getElementById('menuBtn');
  menuBtn?.addEventListener('click', () => {
    location.reload();
  });
}

export function showError(message: string) {
  const errorElement = document.getElementById('errorMsg');
  if (errorElement) {
    errorElement.textContent = message;
    setTimeout(() => {
      errorElement.textContent = '';
    }, 5000);
  } else {
    // Show error in current UI
    const tempError = document.createElement('div');
    tempError.className = 'error-message';
    tempError.textContent = message;
    tempError.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid #ff3366;
      padding: 1rem 2rem;
      border-radius: 8px;
      z-index: 1000;
    `;
    document.body.appendChild(tempError);
    
    setTimeout(() => {
      tempError.remove();
    }, 5000);
  }
}
