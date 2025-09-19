// Deterministic game step function

import { Direction, GameState, Position, Snake, Food, GameEvent, RoomSettings, Projectile } from './types.js';
import { RNG } from './rng.js';
import { OPPOSITE_DIRECTIONS, NORMAL_FOOD_VALUE, SPECIAL_FOOD_VALUE, INITIAL_SNAKE_LENGTH, PROJECTILE_DAMAGE, PROJECTILE_SPEED } from './constants.js';

export interface InputMap {
  [playerId: string]: Direction;
}

export interface BoostMap {
  [playerId: string]: boolean;
}

export function step(
  state: GameState,
  inputs: InputMap,
  settings: RoomSettings,
  rng: RNG,
  boosts?: BoostMap
): GameState {
  const newState: GameState = {
    snakes: new Map(),
    foods: [...state.foods],
    projectiles: [...(state.projectiles || [])],
    events: [],
  };

  // Process inputs and update directions
  state.snakes.forEach((snake, id) => {
    if (!snake.alive) {
      newState.snakes.set(id, { ...snake });
      return;
    }

    const newSnake = { ...snake, body: [...snake.body] };
    
    // Apply input if valid (not opposite direction)
    const input = inputs[id];
    if (input && input !== OPPOSITE_DIRECTIONS[snake.direction]) {
      newSnake.direction = input;
    }

    newState.snakes.set(id, newSnake);
  });

  // Move snakes (apply boost by moving twice)
  newState.snakes.forEach((snake, id) => {
    if (!snake.alive) return;

    const moveCount = boosts && boosts[id] ? 2 : 1;
    
    for (let move = 0; move < moveCount; move++) {
      const head = snake.body[0];
      const newHead = movePosition(head, snake.direction, settings);
      
      // Check wall collision (if wrap disabled)
      if (!settings.wrapEnabled) {
        if (newHead.x < 0 || newHead.x >= settings.gridWidth ||
            newHead.y < 0 || newHead.y >= settings.gridHeight) {
          killSnake(snake, newState, settings, rng);
          break;
        }
      }

      // Add new head
      snake.body.unshift(newHead);
      
      // Check food collision
      let ateFood = false;
      let foodValue = 0;
      
      newState.foods = newState.foods.filter(food => {
        if (food.position.x === newHead.x && food.position.y === newHead.y) {
          ateFood = true;
          foodValue = food.value;
          newState.events.push({
            type: 'eat',
            playerId: id,
            position: food.position,
            data: { value: food.value }
          });
          return false;
        }
        return true;
      });

      // Grow or move snake
      if (ateFood) {
        snake.score += foodValue;
        // Grow by food value (don't remove tail segments)
        for (let i = 1; i < foodValue; i++) {
          snake.body.push({ ...snake.body[snake.body.length - 1] });
        }
      } else {
        // Remove tail
        snake.body.pop();
      }
    }
  });

  // Check collisions between snakes
  newState.snakes.forEach((snake, id) => {
    if (!snake.alive) return;

    const head = snake.body[0];

    // Check self collision
    for (let i = 1; i < snake.body.length; i++) {
      if (snake.body[i].x === head.x && snake.body[i].y === head.y) {
        killSnake(snake, newState, settings, rng);
        return;
      }
    }

    // Check collision with other snakes
    newState.snakes.forEach((otherSnake, otherId) => {
      if (otherId === id || !otherSnake.alive) return;
      
      for (const segment of otherSnake.body) {
        if (segment.x === head.x && segment.y === head.y) {
          killSnake(snake, newState, settings, rng);
          return;
        }
      }
    });
  });

  // Update projectiles
  newState.projectiles = newState.projectiles.filter(projectile => {
    // Move projectile
    for (let i = 0; i < PROJECTILE_SPEED; i++) {
      projectile.position = movePosition(projectile.position, projectile.direction, settings);
    }
    
    // Decrease lifetime
    projectile.lifetime--;
    
    // Check if hit wall (remove projectile)
    if (!settings.wrapEnabled) {
      if (projectile.position.x < 0 || projectile.position.x >= settings.gridWidth ||
          projectile.position.y < 0 || projectile.position.y >= settings.gridHeight) {
        return false;
      }
    }
    
    // Check collision with snakes
    let hit = false;
    newState.snakes.forEach((snake, id) => {
      if (!snake.alive || id === projectile.ownerId) return;
      
      for (let i = 0; i < snake.body.length; i++) {
        const segment = snake.body[i];
        if (segment.x === projectile.position.x && segment.y === projectile.position.y) {
          // Hit! Remove segments from snake
          const segmentsToRemove = Math.min(PROJECTILE_DAMAGE, snake.body.length - 1);
          
          if (segmentsToRemove >= snake.body.length - 1) {
            // Kill snake if too small
            killSnake(snake, newState, settings, rng);
          } else {
            // Remove segments from tail
            for (let j = 0; j < segmentsToRemove; j++) {
              snake.body.pop();
            }
          }
          
          newState.events.push({
            type: 'hit',
            playerId: id,
            position: projectile.position,
            data: { damage: segmentsToRemove }
          });
          
          hit = true;
          break;
        }
      }
    });
    
    // Remove projectile if hit or lifetime expired
    return !hit && projectile.lifetime > 0;
  });

  // Spawn new food to maintain food count
  while (newState.foods.length < settings.foodCount) {
    const position = findEmptyPosition(newState, settings, rng);
    if (position) {
      const isSpecial = rng.next() < settings.specialFoodChance;
      newState.foods.push({
        position,
        type: isSpecial ? 'special' : 'normal',
        value: isSpecial ? SPECIAL_FOOD_VALUE : NORMAL_FOOD_VALUE,
      });
      
      newState.events.push({
        type: 'spawn',
        position,
        data: { type: isSpecial ? 'special' : 'normal' }
      });
    } else {
      break; // No empty positions
    }
  }

  return newState;
}

function movePosition(pos: Position, dir: Direction, settings: RoomSettings): Position {
  let { x, y } = pos;
  
  switch (dir) {
    case 'up':
      y -= 1;
      break;
    case 'down':
      y += 1;
      break;
    case 'left':
      x -= 1;
      break;
    case 'right':
      x += 1;
      break;
  }

  // Apply wrap if enabled
  if (settings.wrapEnabled) {
    x = (x + settings.gridWidth) % settings.gridWidth;
    y = (y + settings.gridHeight) % settings.gridHeight;
  }

  return { x, y };
}

function killSnake(snake: Snake, state: GameState, settings: RoomSettings, rng: RNG) {
  snake.alive = false;
  
  state.events.push({
    type: 'death',
    playerId: snake.id,
    position: snake.body[0],
  });

  // Convert last N segments to food
  const segmentsToConvert = Math.min(3, Math.floor(snake.body.length / 2));
  const tailSegments = snake.body.slice(-segmentsToConvert);
  
  tailSegments.forEach(segment => {
    // Check if position is empty
    let isEmpty = true;
    state.snakes.forEach(s => {
      if (!s.alive) return;
      if (s.body.some(b => b.x === segment.x && b.y === segment.y)) {
        isEmpty = false;
      }
    });
    
    if (isEmpty && !state.foods.some(f => f.position.x === segment.x && f.position.y === segment.y)) {
      state.foods.push({
        position: { ...segment },
        type: 'normal',
        value: NORMAL_FOOD_VALUE,
      });
    }
  });
}

function findEmptyPosition(state: GameState, settings: RoomSettings, rng: RNG): Position | null {
  const occupied = new Set<string>();
  
  // Mark snake positions
  state.snakes.forEach(snake => {
    if (!snake.alive) return;
    snake.body.forEach(segment => {
      occupied.add(`${segment.x},${segment.y}`);
    });
  });
  
  // Mark food positions
  state.foods.forEach(food => {
    occupied.add(`${food.position.x},${food.position.y}`);
  });

  // Mark projectile positions
  state.projectiles?.forEach(projectile => {
    occupied.add(`${projectile.position.x},${projectile.position.y}`);
  });

  // Find empty positions
  const empty: Position[] = [];
  for (let x = 0; x < settings.gridWidth; x++) {
    for (let y = 0; y < settings.gridHeight; y++) {
      if (!occupied.has(`${x},${y}`)) {
        empty.push({ x, y });
      }
    }
  }

  if (empty.length === 0) return null;
  return rng.choice(empty);
}

export function initializeSnake(
  playerId: string,
  position: Position,
  direction: Direction,
  color: string
): Snake {
  const body: Position[] = [];
  
  // Create initial body segments
  for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
    const segment = { ...position };
    
    // Place segments behind the head based on direction
    switch (direction) {
      case 'up':
        segment.y += i;
        break;
      case 'down':
        segment.y -= i;
        break;
      case 'left':
        segment.x += i;
        break;
      case 'right':
        segment.x -= i;
        break;
    }
    
    body.push(segment);
  }

  return {
    id: playerId,
    body,
    direction,
    alive: true,
    score: 0,
    color,
  };
}
