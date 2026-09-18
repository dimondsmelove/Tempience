#!/usr/bin/env bash
# Re-exports the public tree into this mirror checkout, commits and pushes it.
#
#   scripts/public-mirror/publish.sh [ref]
#
# Run inside the mirror clone. One-time setup there:
#   git config mirror.source <path | host:/path>   # the canonical Tempience checkout
#   git config mirror.ref forgejo/master            # optional, default master
#
# A remote-tracking ref (remote/branch) is fetched first, so the mirror never
# publishes a stale local branch. The exporter is taken from the source at
# <ref>, not from this checkout, so the mirror never publishes with a stale
# copy of its own tooling either.
set -euo pipefail

mirror=$(git rev-parse --show-toplevel)
src=$(git -C "$mirror" config mirror.source || true)
: "${src:?run once: git config mirror.source <path|host:/path>}"
ref=${1:-$(git -C "$mirror" config mirror.ref || echo master)}

src_git() {
	if [[ $src == *:* ]]; then
		ssh "${src%%:*}" "git -C '${src#*:}' $*"
	else
		git -C "$src" "$@"
	fi
}

if [[ $ref == */* ]]; then src_git fetch --quiet "${ref%%/*}"; fi

exporter=$(mktemp)
trap 'rm -f "$exporter"' EXIT
src_git show "$ref:scripts/public-mirror/export.sh" > "$exporter"

sha=$(TEMPIENCE_SRC="$src" bash "$exporter" "$mirror" "$ref")
cd "$mirror"
git add -A
if git diff --cached --quiet; then
	echo "mirror already matches $ref @ $sha"
	exit 0
fi
git commit -q -m "sync: Tempience $ref @ $sha"
git push
echo "published $ref @ $sha"
