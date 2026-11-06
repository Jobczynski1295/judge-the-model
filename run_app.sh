#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required. Install Node.js and try again." >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20 or newer is required (found $(node --version))." >&2
  exit 1
fi
echo "Open http://localhost:8766/ in your browser. Press Ctrl+C to stop."
node web/server.mjs
