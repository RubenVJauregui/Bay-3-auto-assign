#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
fi
echo "Bay 3 Auto Assign Dashboard"
echo "Local URL: http://localhost:3021"
echo "Cleaning old builds..."
rm -rf .next out
echo "Installing dependencies if needed..."
npm install
echo "Building dashboard from current source..."
npm run build
echo "Starting dashboard at http://localhost:3021"
if command -v open >/dev/null 2>&1; then open http://localhost:3021; fi
npx next start -H 0.0.0.0 -p 3021
