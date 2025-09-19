#!/bin/bash

# Simple production start script

echo "🐍 Starting Snake Game in Production Mode..."

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if build exists
if [ ! -d "client/dist" ] || [ ! -d "server/dist" ]; then
    echo "Building production bundles..."
    npm run build
fi

# Kill any existing processes on our ports
echo "Checking for existing processes..."
lsof -ti:3005 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Start the server in background
echo "Starting server on port 3005..."
NODE_ENV=production PORT=3005 HOST=0.0.0.0 node server/dist/index.js &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Install serve if not present
if ! command -v serve &> /dev/null; then
    echo "Installing serve..."
    npm install -g serve
fi

# Start the client server
echo "Starting client on port 5173..."
serve -s client/dist -l 5173 &
CLIENT_PID=$!
echo "Client PID: $CLIENT_PID"

echo ""
echo "✅ Snake game is running!"
echo "🌐 Client: http://localhost:5173"
echo "🔌 Server: ws://localhost:3005"
echo ""
echo "To stop the servers, run:"
echo "  kill $SERVER_PID $CLIENT_PID"
echo ""
echo "Or use the stop script: ./stop-production.sh"

# Save PIDs to file for stop script
echo "$SERVER_PID" > .server.pid
echo "$CLIENT_PID" > .client.pid
