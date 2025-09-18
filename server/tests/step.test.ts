// Unit tests for game step function

import { describe, it, expect } from 'vitest';
import { step, initializeSnake } from '../src/shared/step';
import { GameState, RoomSettings } from '../src/shared/types';
import { RNG } from '../src/shared/rng';
import { DEFAULT_SETTINGS } from '../src/shared/constants';

describe('Game Step Function', () => {
  const settings: RoomSettings = {
    ...DEFAULT_SETTINGS,
    gridWidth: 10,
    gridHeight: 10,
  };
  
  const rng = new RNG(12345);
  
  it('should move snake forward', () => {
    const state: GameState = {
      snakes: new Map([
        ['p1', initializeSnake('p1', { x: 5, y: 5 }, 'right', '#00ffff')]
      ]),
      foods: [],
      events: []
    };
    
    const newState = step(state, {}, settings, rng);
    const snake = newState.snakes.get('p1');
    
    expect(snake?.body[0]).toEqual({ x: 6, y: 5 });
  });
  
  it('should handle direction changes', () => {
    const state: GameState = {
      snakes: new Map([
        ['p1', initializeSnake('p1', { x: 5, y: 5 }, 'right', '#00ffff')]
      ]),
      foods: [],
      events: []
    };
    
    const newState = step(state, { p1: 'up' }, settings, rng);
    const snake = newState.snakes.get('p1');
    
    expect(snake?.direction).toBe('up');
    expect(snake?.body[0]).toEqual({ x: 5, y: 4 });
  });
  
  it('should prevent opposite direction changes', () => {
    const state: GameState = {
      snakes: new Map([
        ['p1', initializeSnake('p1', { x: 5, y: 5 }, 'right', '#00ffff')]
      ]),
      foods: [],
      events: []
    };
    
    const newState = step(state, { p1: 'left' }, settings, rng);
    const snake = newState.snakes.get('p1');
    
    expect(snake?.direction).toBe('right'); // Should ignore opposite
    expect(snake?.body[0]).toEqual({ x: 6, y: 5 });
  });
  
  it('should handle food collision and growth', () => {
    const state: GameState = {
      snakes: new Map([
        ['p1', initializeSnake('p1', { x: 5, y: 5 }, 'right', '#00ffff')]
      ]),
      foods: [{ position: { x: 6, y: 5 }, type: 'normal', value: 1 }],
      events: []
    };
    
    const newState = step(state, {}, settings, rng);
    const snake = newState.snakes.get('p1');
    
    expect(snake?.score).toBe(1);
    expect(snake?.body.length).toBe(4); // Initial 3 + 1
    expect(newState.foods.length).toBe(1); // Should spawn new food
    expect(newState.events.some(e => e.type === 'eat')).toBe(true);
  });
  
  it('should handle self-collision', () => {
    const snake = initializeSnake('p1', { x: 5, y: 5 }, 'right', '#00ffff');
    // Create a loop
    snake.body = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 5, y: 5 } // Collides with head
    ];
    
    const state: GameState = {
      snakes: new Map([['p1', snake]]),
      foods: [],
      events: []
    };
    
    const newState = step(state, {}, settings, rng);
    const updatedSnake = newState.snakes.get('p1');
    
    expect(updatedSnake?.alive).toBe(false);
    expect(newState.events.some(e => e.type === 'death')).toBe(true);
  });
  
  it('should handle wall collision when wrap disabled', () => {
    const noWrapSettings = { ...settings, wrapEnabled: false };
    
    const state: GameState = {
      snakes: new Map([
        ['p1', initializeSnake('p1', { x: 0, y: 5 }, 'left', '#00ffff')]
      ]),
      foods: [],
      events: []
    };
    
    const newState = step(state, {}, noWrapSettings, rng);
    const snake = newState.snakes.get('p1');
    
    expect(snake?.alive).toBe(false);
    expect(newState.events.some(e => e.type === 'death')).toBe(true);
  });
  
  it('should wrap around when wrap enabled', () => {
    const wrapSettings = { ...settings, wrapEnabled: true };
    
    const state: GameState = {
      snakes: new Map([
        ['p1', initializeSnake('p1', { x: 0, y: 5 }, 'left', '#00ffff')]
      ]),
      foods: [],
      events: []
    };
    
    const newState = step(state, {}, wrapSettings, rng);
    const snake = newState.snakes.get('p1');
    
    expect(snake?.alive).toBe(true);
    expect(snake?.body[0]).toEqual({ x: 9, y: 5 }); // Wrapped to right side
  });
  
  it('should handle collision between snakes', () => {
    const snake1 = initializeSnake('p1', { x: 5, y: 5 }, 'right', '#00ffff');
    const snake2 = initializeSnake('p2', { x: 7, y: 5 }, 'left', '#ff00ff');
    
    const state: GameState = {
      snakes: new Map([
        ['p1', snake1],
        ['p2', snake2]
      ]),
      foods: [],
      events: []
    };
    
    // Move them toward each other
    const newState = step(state, {}, settings, rng);
    
    // One or both should collide
    const aliveCount = Array.from(newState.snakes.values()).filter(s => s.alive).length;
    expect(aliveCount).toBeLessThan(2);
  });
});
