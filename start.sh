#!/bin/bash

# Use Railway's PORT or default to 8080
export PORT=${PORT:-8080}

# Update nginx to listen on the correct port
sed -i "s/listen 8080/listen $PORT/" /etc/nginx/sites-available/default

# Start backend with error logging
cd /app/backend
echo "Starting backend..."
uvicorn server:app --host 0.0.0.0 --port 8001 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend is alive
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Backend started successfully (PID: $BACKEND_PID)"
else
    echo "ERROR: Backend failed to start!"
fi

# Start nginx
echo "Starting nginx on port $PORT..."
nginx -g 'daemon off;'
