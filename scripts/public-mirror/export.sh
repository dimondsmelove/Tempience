#!/usr/bin/env bash
# Writes the clean public tree of Tempience into <dest> and prints the exported commit.
#
#   scripts/public-mirror/export.sh <dest> [ref]        (ref defaults to master)
#
# Source checkout: $TEMPIENCE_SRC — a local path (default: the checkout this script
# lives in) or host:/path, in which case `git archive` runs over ssh.
#
# The public tree is what a reader or self-hoster needs: the app, the shared
# package, the sync server and the build tooling. Everything else — working notes,
# agent instructions, owner deployment, e2e harness, experiments and the owner's
# own data — stays in the private repository.
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

# Working notes, agent instructions, owner deployment, owner tooling.
rm -rf context research reports deploy AGENTS.md PROJECT_CONTEXT.md \
	"FE Svelte/AGENTS.md" "FE Svelte/skills" \
	"FE Svelte/playwright.config.ts" "FE Svelte/playwright.appearance.config.ts" \
	"FE Svelte/scripts/generate-synthetic-manifest.mjs" "FE Svelte/scripts/measure-kind-history.mjs" \
	"FE Svelte/scripts/open-lan-firewall.sh" "FE Svelte/scripts/ui-screenshot.sh"
# e2e harness goes; its synthetic fixtures stay (src/lib/scenarios/e2e-synthetic imports them).
find "FE Svelte/e2e" -mindepth 1 -maxdepth 1 ! -name fixtures -exec rm -rf {} +
# scripts/: only the sync server and this exporter survive.
find scripts -mindepth 1 -maxdepth 1 \
	! -name 'triplit-server.mjs' ! -name 'triplit-auth.mjs' ! -name 'triplit-auth.test.mjs' \
	! -name public-mirror -exec rm -rf {} +
# No markdown besides the public README.
find . -name '*.md' -not -path './scripts/public-mirror/*' -delete

# Personal data: the Belgrade seed corpus, its data-pack catalog entry and the
# tests that assert that corpus (exact counts, the belgrade DataSpace and pack).
rm -f "FE Svelte/src/lib/scenarios/belgrade/seed-manifest.json" \
	"FE Svelte/src/lib/scenarios/belgrade/bootstrap.test.ts" \
	"FE Svelte/src/lib/scenarios/DataPacks/DataPacks.test.ts" \
	"FE Svelte/src/lib/state/triplit/data-space.test.ts"
printf '[]\n' > "FE Svelte/src/lib/scenarios/DataPacks/catalog.json"

# package.json scripts that pointed at removed files.
node -e '
const fs = require("node:fs");
const prune = (file, keep) => {
	const text = fs.readFileSync(file, "utf8");
	const indent = (/^([ \t]+)"/m.exec(text) ?? [, "  "])[1];
	const pkg = JSON.parse(text);
	pkg.scripts = Object.fromEntries(Object.entries(pkg.scripts).filter(([k]) => keep(k)));
	fs.writeFileSync(file, JSON.stringify(pkg, null, indent) + "\n");
};
prune("package.json", (k) => k === "sync:triplit" || k === "test:triplit");
prune("FE Svelte/package.json", (k) =>
	!["e2e", "e2e:ui", "e2e:update-snapshots", "fixtures:synthetic", "measure:history", "fe:audit"].includes(k));
'

# Public overlay: README, LICENSE, GitHub Pages workflow.
cp -a scripts/public-mirror/overlay/. .

mkdir -p "$dest"
rsync -a --delete --exclude .git "$work/" "$dest/"
src_git rev-parse --short=12 "$ref"
