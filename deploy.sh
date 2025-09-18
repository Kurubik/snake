#!/bin/bash

# Production deployment script for Snake game

echo "🐍 Deploying Snake Game to Production..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}PM2 is not installed. Installing globally...${NC}"
    npm install -g pm2
fi

# Check if serve is installed (for serving static files)
if ! npm list -g serve &> /dev/null; then
    echo -e "${YELLOW}Installing serve for static file serving...${NC}"
    npm install -g serve
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install

# Build the project
echo -e "${GREEN}Building production bundles...${NC}"
npm run build

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop existing PM2 processes if running
echo -e "${YELLOW}Stopping existing PM2 processes...${NC}"
pm2 stop ecosystem.config.json 2>/dev/null || true

# Start with PM2
echo -e "${GREEN}Starting services with PM2...${NC}"
pm2 start ecosystem.config.json

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
echo -e "${GREEN}Setting up PM2 startup script...${NC}"
pm2 startup

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📊 Monitor your application with:"
echo "  pm2 status        - View process status"
echo "  pm2 logs          - View all logs"
echo "  pm2 logs snake-server - View server logs"
echo "  pm2 logs snake-client - View client logs"
echo "  pm2 monit         - Real-time monitoring"
echo ""
echo "🌐 Your game is running at:"
echo "  Client: http://$(hostname -I | awk '{print $1}'):5173"
echo "  Server: ws://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "🔧 Management commands:"
echo "  pm2 restart all   - Restart all processes"
echo "  pm2 stop all      - Stop all processes"
echo "  pm2 delete all    - Remove all processes"
