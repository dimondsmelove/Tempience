#!/usr/bin/env bash
# Capture mobile UI screenshot for visual verification.
# Usage: ./scripts/ui-screenshot.sh [url] [output.png]
set -euo pipefail
URL="${1:-http://[::1]:5173/}"
OUT="${2:-/tmp/chronograph-ui.png}"
VIEWPORT="${UI_SCREENSHOT_VIEWPORT:-390,844}"

google-chrome --headless=new --disable-gpu \
	--screenshot="$OUT" \
	--window-size="$VIEWPORT" \
	--virtual-time-budget=8000 \
	"$URL" 2>/dev/null

echo "screenshot: $OUT ($(wc -c <"$OUT") bytes)"
