#!/bin/bash

# Script for development with ngrok and Telegram
echo "🚀 Starting development with ngrok..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Install it with: npm install -g ngrok"
    exit 1
fi

# API Gateway port
API_PORT=${API_PORT:-3001}

# Start ngrok in background
echo "🌐 Starting ngrok on port ${API_PORT}..."
ngrok http ${API_PORT} --log=stdout > ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to be ready
echo "⏳ Waiting for ngrok to be ready..."
sleep 3

# Get ngrok URL
RAW_RESPONSE=$(curl -s http://localhost:4040/api/tunnels)
echo "🔍 Raw ngrok response: $RAW_RESPONSE"

NGROK_URL=$(echo "$RAW_RESPONSE" | node -e 'try { const data = JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log(data.tunnels[0].public_url); } catch(e) { console.error(e); }')

if [ "$NGROK_URL" == "null" ] || [ -z "$NGROK_URL" ]; then
    echo "❌ Could not get ngrok URL"
    echo "Debug: NGROK_URL value is: '$NGROK_URL'"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

# Update environment variables
export TELEGRAM_WEBHOOK_URL="$NGROK_URL/api/v1/telegram/webhook"

# Show information
echo ""
echo "📋 Configuration:"
echo "   - ngrok URL: $NGROK_URL"
echo "   - API Port: $API_PORT"
echo ""
echo "🛠️  Update your .env with:"
echo "   TELEGRAM_WEBHOOK_URL=\"$NGROK_URL/api/v1/telegram/webhook\""
echo ""
echo "🤖 Now you can test your Telegram bot"
echo "💡 Press Ctrl+C to stop ngrok"

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    kill $NGROK_PID 2>/dev/null
    rm -f ngrok.log
    echo "✅ ngrok stopped"
    exit 0
}

# Capture interrupt signal
trap cleanup SIGINT SIGTERM

# Keep the script running
wait $NGROK_PID
