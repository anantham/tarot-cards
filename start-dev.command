#!/bin/bash

# Navigate to the script's directory
cd "$(dirname "$0")"

echo "Starting Tarot Cards development server..."
echo "The app will be available at http://localhost:5173"
echo "API proxy target: ${API_PROXY_TARGET:-http://localhost:3000}"
echo ""

# Start the development server with API proxy target (default http://localhost:3000)
API_PROXY_TARGET=${API_PROXY_TARGET:-http://localhost:3000} npm run dev
