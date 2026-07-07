#!/bin/bash
# MAGNOM AI — one-command start (Node.js + backend + public links)
set -e

NODE="$HOME/.local/node/bin"
export PATH="$NODE:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"

install_node() {
  if command -v node >/dev/null 2>&1; then return; fi
  echo "Installing Node.js..."
  mkdir -p "$HOME/.local/node"
  curl -fsSL "https://nodejs.org/dist/v22.16.0/node-v22.16.0-darwin-arm64.tar.gz" -o /tmp/node.tar.gz
  tar -xzf /tmp/node.tar.gz -C "$HOME/.local/node" --strip-components=1
  export PATH="$HOME/.local/node/bin:$PATH"
}

install_node

cd "$MOBILE"
[ -d node_modules ] || npm install

echo ""
echo "=== MAGNOM AI ==="
echo ""

# Backend on 3001 (3000 may be in use)
if ! curl -sf http://localhost:3001/api/ai/chat -X OPTIONS >/dev/null 2>&1; then
  echo "Starting AI backend on port 3001..."
  cd "$ROOT"
  PORT=3001 python3 server.py &
  sleep 2
fi

# Public API tunnel
echo "Starting public API tunnel..."
LT_LOG=$(mktemp)
npx --yes localtunnel --port 3001 > "$LT_LOG" 2>&1 &
LT_PID=$!
sleep 4
API_URL=$(grep -o 'https://[^ ]*\.loca\.lt' "$LT_LOG" | head -1)
rm -f "$LT_LOG"

if [ -n "$API_URL" ]; then
  echo ""
  echo "  AI Backend (public): $API_URL"
  echo "  Set this in app Settings if needed."
fi

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "YOUR-IP")
echo "  AI Backend (local Wi‑Fi): http://${LAN_IP}:3001"
echo ""

cd "$MOBILE"
echo "Starting Expo (public tunnel for the app)..."
echo "  Install Expo Go: https://expo.dev/go"
echo ""
npx expo start --tunnel

kill $LT_PID 2>/dev/null || true
