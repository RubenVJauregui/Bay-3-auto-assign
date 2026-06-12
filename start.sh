#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "Bay 3 Auto Assign Dashboard"
echo "Installing dependencies if needed..."
npm install
echo "Building dashboard..."
npm run build
echo "Starting dashboard at http://localhost:3000"
echo "Keep this terminal open while using the dashboard."
if command -v open >/dev/null 2>&1; then open http://localhost:3000; fi
npm run start
