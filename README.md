# Multiplayer Snake Game 🐍

A modern, production-ready multiplayer Snake game built with TypeScript, Three.js, and WebSockets.

## Features

- **Real-time multiplayer** with room-based matchmaking
- **Modern visuals** with Three.js rendering and neon-glow aesthetics
- **Lag compensation** using client-side prediction and server reconciliation
- **Responsive design** for desktop and mobile
- **Spectator mode** when eliminated
- **Configurable rooms** with custom settings

## Quick Start

```bash
# Install dependencies
npm install

# Run development servers (both client and server)
npm run dev

# Or run separately:
npm run dev:server  # Server on :3005
npm run dev:client  # Client on :5173
```

## Production Build

```bash
# Build both client and server
npm run build

# Start production server
npm start
```

## Controls

- **Arrow Keys** or **WASD**: Move snake
- **Touch/Swipe**: Mobile controls
- **Enter**: Ready up in lobby
- **Space**: Spectate when dead

## Game Modes

### Room Settings
- **Grid Size**: 20x20 to 50x50
- **Wrap Mode**: Torus wrap-around or solid walls
- **Tick Rate**: 8-15 ticks per second
- **Max Players**: 2-8 players per room

### Gameplay
- Eat food to grow your snake
- Avoid colliding with yourself, other players, or walls
- Last snake alive wins
- Dead players become spectators until next round

## Networking

The game uses WebSocket for real-time communication with:

- **Server-authoritative** state management
- **Client-side prediction** for responsive controls
- **Server reconciliation** to correct prediction errors
- **Interpolation** for smooth rendering of other players

### How Reconciliation Works

The client predicts its own movement immediately upon input, providing instant feedback. Each input is tagged with a sequence number and sent to the server. The server processes inputs, updates the authoritative game state, and broadcasts the result with acknowledged sequence numbers. When the client receives server state, it discards predictions up to the acknowledged sequence, then re-applies any unacknowledged inputs on top of the server state. This ensures responsive controls while maintaining server authority.

Other players are interpolated between the last two received server states, creating smooth movement despite the discrete tick-based updates. This hybrid approach minimizes perceived lag while preventing cheating.

## Architecture

```
snake/
├── client/           # Vite + Three.js frontend
│   ├── src/
│   │   ├── main.ts          # Entry point
│   │   ├── net.ts           # WebSocket & sync
│   │   ├── scene.ts         # Three.js rendering
│   │   ├── input.ts         # Input handling
│   │   ├── ui.ts            # UI components
│   │   └── shared/          # Shared types & logic
│   └── index.html
├── server/           # Node.js WebSocket server
│   ├── src/
│   │   ├── index.ts         # Server entry
│   │   ├── room.ts          # Room management
│   │   ├── protocol.ts      # Message handling
│   │   └── shared/          # Shared with client
│   └── package.json
└── package.json      # Monorepo root
```

## Development

```bash
# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Environment Variables

### Server
- `PORT`: Server port (default: 3005)
- `HOST`: Server host (default: localhost)

### Client
- `VITE_SERVER_URL`: WebSocket server URL (default: ws://localhost:3005)

## Recording Demo

To record gameplay:
1. Open Chrome DevTools
2. Ctrl+Shift+P → "Show Rendering"
3. Enable "Screenshot" recording
4. Play the game
5. Stop recording and save as GIF/WebM

## License

MIT
