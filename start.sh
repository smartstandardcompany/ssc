#!/bin/bash
# Start backend
cd /app/backend
uvicorn server:app --host 0.0.0.0 --port 8001 &

# Configure nginx to serve frontend and proxy API
sleep 2
nginx -g 'daemon off;'
