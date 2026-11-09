#!/usr/bin/env bash
# Visual FX Reel — local GPU render (Linux / macOS). Extra args are passed to tools/render-gpu.js.
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "need Node.js (https://nodejs.org)"; exit 1; }
command -v ffmpeg >/dev/null || { echo "need ffmpeg"; exit 1; }
if [ ! -d node_modules/playwright ]; then npm install; npx playwright install chromium; fi
GL=vulkan; [ "$(uname)" = "Darwin" ] && GL=metal
EXTRA=""
if ! node tools/render-gpu.js --check --gl $GL; then
  if node tools/render-gpu.js --check --gl gl; then GL=gl; else EXTRA="--chrome"; fi
fi
node tools/render-gpu.js --gl $GL $EXTRA "$@"
echo "done: out/reel_1080p60.mp4"
