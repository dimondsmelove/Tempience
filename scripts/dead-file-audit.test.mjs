import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repository = fileURLToPath(new URL("../", import.meta.url));
test("both route profiles and generator inputs are reachable without hiding dead code", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "tempience-dead-files-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q", fixture]);
  const component = (name) =>
    "<script>import View from " +
    JSON.stringify("$lib/" + name + ".svelte") +
    ";</script><View />";
  const files = {
    "FE Svelte/package.json": JSON.stringify({
      name: "fixture",
      scripts: {
        tokens: "node scripts/generate-theme-tokens.mjs",
        packs: "node scripts/prepare-data-packs.mjs",
      },
    }),
    "FE Svelte/src/routes/+page.svelte": component("View"),
    "FE Svelte/src/routes-public/+page.svelte": component("Public"),
    // The same base name beside the component: an import without an extension is the
    // module, as Vite resolves it, not the component itself. (The specifiers are assembled
    // so that the audit of this repository does not read them as this file's own imports.)
    "FE Svelte/src/lib/View.svelte":
      "<script>import { label } from " +
      JSON.stringify("./View") +
      ";</script><p>{label}</p>",
    "FE Svelte/src/lib/View.ts": "export const label = 'Owner';",
    // A browser check reaches a source module by the path a dev server serves it at.
    "FE Svelte/e2e/measure.spec.ts":
      "await import(" + JSON.stringify("/src/lib/state/probe.ts") + ");",
    "FE Svelte/src/lib/state/probe.ts": "export const probe = 1;",
    "FE Svelte/src/lib/Public.svelte": "<p>Public</p>",
    "FE Svelte/src/lib/Unused.svelte": "<p>Unused</p>",
    "FE Svelte/scripts/generate-theme-tokens.mjs":
      "// Reads its source through fs",
    "FE Svelte/src/theme/design-tokens.json": "{}",
    "FE Svelte/scripts/prepare-data-packs.mjs": "// Copies configured packs",
    "FE Svelte/src/lib/scenarios/DataPacks/catalog.json": JSON.stringify([
      { source: "../belgrade/seed-manifest.json" },
    ]),
    "FE Svelte/src/lib/scenarios/belgrade/seed-manifest.json": "{}",

    "FE Svelte/src/theme/unused.json": "{}",
    "FE Svelte/build-public/generated.js": "export default 1;",
  };
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(fixture, name)), { recursive: true });
    writeFileSync(join(fixture, name), content);
  }
  const run = () => {
    execFileSync(
      join(repository, "node_modules/.bin/tsx"),
      [
        join(repository, "scripts/dead-file-audit.ts"),
        "--output-dir=" + join(fixture, "reports"),
      ],
      { cwd: fixture },
    );
    return JSON.parse(
      readFileSync(join(fixture, "reports/dead-files-audit.json"), "utf8"),
    );
  };
  const report = run();
  assert.deepEqual(report.unresolvedRoots, []);
  assert.deepEqual(report.unresolvedImports, []);
  assert.deepEqual(report.unused, [
    "FE Svelte/src/lib/Unused.svelte",
    "FE Svelte/src/theme/unused.json",
  ]);
  assert.ok(
    report.entryPoints.includes("FE Svelte/src/routes-public/+page.svelte"),
  );
  rmSync(join(fixture, "FE Svelte/scripts/generate-theme-tokens.mjs"));
  writeFileSync(
    join(fixture, "FE Svelte/package.json"),
    JSON.stringify({ name: "fixture" }),
  );
  assert.ok(run().unused.includes("FE Svelte/src/theme/design-tokens.json"));
});
