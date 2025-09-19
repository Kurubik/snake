#!/bin/bash

# Manual script to rebuild client with correct server IP

echo "🔧 Rebuilding client with correct WebSocket URL..."

# Set your server IP here
SERVER_IP="134.209.227.100"

echo "Setting WebSocket URL to: ws://${SERVER_IP}:3005"

# Update the environment file
cat > client/.env.production << EOF
# Auto-generated production config
VITE_SERVER_URL=ws://${SERVER_IP}:3005
EOF

# Rebuild the client
echo "Building client..."
npm run build:client

# Restart the client service
echo "Restarting client service..."
pm2 restart snake-client

echo "✅ Done! The client should now connect to ws://${SERVER_IP}:3005"
echo ""
echo "Test the game at: http://${SERVER_IP}:5173"
