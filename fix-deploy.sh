#!/bin/bash

echo "🐍 Fixing Snake Game Deployment..."

# Stop current PM2 processes
pm2 stop all
pm2 delete all

# Install dependencies if needed
if ! command -v http-server &> /dev/null; then
    echo "Installing http-server..."
    npm install -g http-server
fi

# Make sure express is installed
cd server
npm install express
cd ..

# Build the project
echo "Building production bundles..."
npm run build

# Create logs directory
mkdir -p logs

# Update the client production environment with your server IP
echo "Updating client configuration..."
# Try to get external IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
echo "Detected server IP: ${SERVER_IP}"
echo "# Auto-generated production config
VITE_SERVER_URL=ws://${SERVER_IP}:3005" > client/.env.production

# Rebuild client with new config
echo "Rebuilding client with correct WebSocket URL..."
npm run build:client

# Start with PM2 using simple config
echo "Starting with PM2..."
pm2 start ecosystem.simple.json

# Or if that doesn't work, start manually
# pm2 start server/dist/index.js --name snake-server -- --port 3005 --host 0.0.0.0
# pm2 start "npx http-server ./client/dist -p 5173 -a 0.0.0.0 -d false" --name snake-client

pm2 save
pm2 list

echo "✅ Deployment fixed!"
echo ""
echo "Your game should now be accessible at:"
echo "  http://${SERVER_IP}:5173"
echo "WebSocket server at:"
echo "  ws://${SERVER_IP}:3005"
echo ""
echo "Check logs with:"
echo "  pm2 logs snake-client"
echo "  pm2 logs snake-server"
