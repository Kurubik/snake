// Game constants

export const DEFAULT_SETTINGS = {
  gridWidth: 50,
  gridHeight: 30,
  wrapEnabled: true,
  tickRate: 10,
  maxPlayers: 6,
  foodCount: 8,
  specialFoodChance: 0.1,
};

export const PUBLIC_ROOM_CODE = 'PUBLIC';
export const BOOST_MULTIPLIER = 2; // Speed multiplier when boosting
export const PROJECTILE_SPEED = 2; // Grid cells per tick
export const PROJECTILE_LIFETIME = 20; // Ticks before projectile disappears
export const PROJECTILE_COST = 1; // Body segments lost when firing
export const PROJECTILE_DAMAGE = 2; // Body segments lost when hit

export const CELL_SIZE = 1;
export const INITIAL_SNAKE_LENGTH = 3;
export const NORMAL_FOOD_VALUE = 1;
export const SPECIAL_FOOD_VALUE = 3;

export const SNAKE_COLORS = [
  '#00ffff', // Cyan
  '#ff00ff', // Magenta
  '#ffff00', // Yellow
  '#00ff00', // Green
  '#ff6600', // Orange
  '#9966ff', // Purple
  '#ff3366', // Pink
  '#66ffcc', // Mint
];

export const MAX_INPUT_RATE = 30; // msgs/sec
export const RECONCILIATION_BUFFER_SIZE = 100;
export const INTERPOLATION_DELAY = 100; // ms

export const ROOM_CODE_LENGTH = 6;
export const ROOM_TIMEOUT = 10 * 60 * 1000; // 10 minutes
export const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export const COUNTDOWN_DURATION = 3000; // 3 seconds

export const OPPOSITE_DIRECTIONS: Record<string, string> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};
