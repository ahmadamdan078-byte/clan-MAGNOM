#!/bin/bash
cd "$(dirname "$0")"
export SECRET_KEY="${SECRET_KEY:-$(python3 -c 'import secrets; print(secrets.token_hex(32))')}"

GUNICORN="${GUNICORN:-$HOME/Library/Python/3.9/bin/gunicorn}"
if ! command -v "$GUNICORN" >/dev/null 2>&1; then
  GUNICORN=gunicorn
fi

lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1

"$GUNICORN" server:app --bind 0.0.0.0:3000 --workers 2 --timeout 120 &
sleep 2

echo ""
echo "=== Magnom Clan — Public Link ==="
echo "Starting tunnel... (URL appears below in a few seconds)"
echo "Permanent URL (after Fly.io card): https://clan-magnom.fly.dev"
echo ""

./bin/cloudflared tunnel --url http://localhost:3000
