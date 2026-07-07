#!/bin/bash
set -e
cd "$(dirname "$0")"

export PATH="$HOME/.local/bin:$PATH"

# Google Cloud SDK (install if missing)
if [ ! -f "$HOME/google-cloud-sdk/bin/gcloud" ]; then
  echo "Installing Google Cloud SDK..."
  curl -fsSL "https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-arm.tar.gz" -o /tmp/gcloud.tar.gz
  tar -xzf /tmp/gcloud.tar.gz -C "$HOME"
  "$HOME/google-cloud-sdk/install.sh" --quiet --usage-reporting false --path-update false
fi

GCLOUD="$HOME/google-cloud-sdk/bin/gcloud"

# Python 3.12+ required for gcloud
if command -v uv >/dev/null 2>&1; then
  uv python install 3.12 2>/dev/null || true
  export CLOUDSDK_PYTHON="$(uv python find 3.12)"
fi

echo "=== Magnom Clan Dashboard — Google App Engine ==="
echo ""
echo "1. Log in to Google Cloud (browser will open)"
$GCLOUD auth login

echo ""
echo "2. Create or select a project at https://console.cloud.google.com"
read -p "Enter your Google Cloud Project ID: " PROJECT_ID
$GCLOUD config set project "$PROJECT_ID"

echo ""
echo "3. Enable App Engine (first time only)"
$GCLOUD app create --region=us-central 2>/dev/null || echo "App Engine already exists"

echo ""
echo "4. Deploying..."
$GCLOUD app deploy app.yaml --quiet

echo ""
echo "Done! Your app URL:"
$GCLOUD app browse --no-launch-browser 2>/dev/null || $GCLOUD app describe --format='value(defaultHostname)'
