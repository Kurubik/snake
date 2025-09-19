#!/bin/bash

# Stop production servers

echo "🛑 Stopping Snake Game servers..."

# Read PIDs if they exist
if [ -f ".server.pid" ]; then
    SERVER_PID=$(cat .server.pid)
    if ps -p $SERVER_PID > /dev/null; then
        echo "Stopping server (PID: $SERVER_PID)..."
        kill $SERVER_PID
    fi
    rm .server.pid
fi

if [ -f ".client.pid" ]; then
    CLIENT_PID=$(cat .client.pid)
    if ps -p $CLIENT_PID > /dev/null; then
        echo "Stopping client (PID: $CLIENT_PID)..."
        kill $CLIENT_PID
    fi
    rm .client.pid
fi

# Also check for processes on the ports
echo "Checking for remaining processes on ports..."
lsof -ti:3005 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "✅ All servers stopped"
