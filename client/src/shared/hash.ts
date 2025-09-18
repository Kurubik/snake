// Fast state hashing for debugging

import { GameState } from './types';

// Simple hash function for game state
export function hashState(state: GameState): string {
  const parts: string[] = [];
  
  // Hash snakes
  const snakes = Array.from(state.snakes.values()).sort((a, b) => a.id.localeCompare(b.id));
  snakes.forEach(snake => {
    parts.push(`s:${snake.id}:${snake.alive ? '1' : '0'}:${snake.score}`);
    if (snake.alive) {
      parts.push(`b:${snake.body.map(p => `${p.x},${p.y}`).join(';')}`);
      parts.push(`d:${snake.direction}`);
    }
  });
  
  // Hash foods
  const foods = [...state.foods].sort((a, b) => {
    const diff = a.position.x - b.position.x;
    return diff !== 0 ? diff : a.position.y - b.position.y;
  });
  foods.forEach(food => {
    parts.push(`f:${food.position.x},${food.position.y}:${food.type}:${food.value}`);
  });
  
  return simpleHash(parts.join('|'));
}

// Simple string hash
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
