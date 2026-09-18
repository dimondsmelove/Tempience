#!/usr/bin/env bash
# Re-exports the public tree into this mirror checkout, commits and pushes it.
#
#   scripts/public-mirror/publish.sh [ref]
#
# Run inside the mirror clone. One-time setup there:
#   git config mirror.source <path | host:/path>   # the canonical Tempience checkout
#   git config mirror.ref master                    # optional, default master
set -euo pipefail

mirror=$(git rev-parse --show-toplevel)
src=$(git -C "$mirror" config mirror.source || true)
: "${src:?run once: git config mirror.source <path|host:/path>}"
ref=${1:-$(git -C "$mirror" config mirror.ref || echo master)}

sha=$(TEMPIENCE_SRC="$src" "$mirror/scripts/public-mirror/export.sh" "$mirror" "$ref")
cd "$mirror"
git add -A
if git diff --cached --quiet; then
	echo "mirror already matches $ref @ $sha"
	exit 0
fi
git commit -q -m "sync: Tempience $ref @ $sha"
git push
echo "published $ref @ $sha"
