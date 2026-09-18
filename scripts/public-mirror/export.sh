#!/usr/bin/env bash
# Writes the clean public tree of Tempience into <dest> and prints the exported commit.
#
#   scripts/public-mirror/export.sh <dest> [ref]        (ref defaults to master)
#
# Source checkout: $TEMPIENCE_SRC — a local path (default: the checkout this script
# lives in) or host:/path, in which case `git archive` runs over ssh.
set -euo pipefail

dest=$(realpath -m "${1:?usage: export.sh <dest> [ref]}")
ref=${2:-master}
src=${TEMPIENCE_SRC:-$(cd "$(dirname "$0")/../.." && pwd)}

src_git() {
	if [[ $src == *:* ]]; then
		ssh "${src%%:*}" "git -C '${src#*:}' $*"
	else
		git -C "$src" "$@"
	fi
}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
src_git archive --format=tar "$ref" | tar -x -C "$work"
cd "$work"

# Internal working material, agent instructions and owner-only deployment.
rm -rf context research reports AGENTS.md PROJECT_CONTEXT.md \
	API/AGENTS.md "FE Svelte/AGENTS.md" "FE Svelte/skills" \
	deploy/OWNER.md deploy/PUBLIC.md deploy/PUBLIC-ACCEPTANCE.md \
	deploy/systemd/chronograph-fe.service deploy/systemd/tempience-triplit.service \
	deploy/systemd/tempience-backup.service deploy/systemd/tempience-backup.timer \
	scripts/backup-triplit.py scripts/backup-triplit.test.py \
	scripts/context-audit.mjs scripts/context-audit.test.mjs

# Personal data: the Belgrade seed corpus, its data-pack catalog entry and the
# tests that assert that corpus (exact counts, the belgrade DataSpace and pack).
rm -f "FE Svelte/src/lib/scenarios/belgrade/seed-manifest.json" \
	"FE Svelte/src/lib/scenarios/belgrade/bootstrap.test.ts" \
	"FE Svelte/src/lib/scenarios/DataPacks/DataPacks.test.ts" \
	"FE Svelte/src/lib/state/triplit/data-space.test.ts"
printf '[]\n' > "FE Svelte/src/lib/scenarios/DataPacks/catalog.json"

# Root scripts that pointed at removed files.
node -e '
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const key of ["context:audit", "context:audit:check", "test:context"]) delete pkg.scripts[key];
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
'

# Public overlay: README, LICENSE, GitHub Pages workflow.
cp -a scripts/public-mirror/overlay/. .

mkdir -p "$dest"
rsync -a --delete --exclude .git "$work/" "$dest/"
src_git rev-parse --short=12 "$ref"
