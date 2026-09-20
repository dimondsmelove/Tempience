import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { DEFAULT_DEVICE_TOKEN_TTL_MS, DEFAULT_PAIRING_TTL_MS } from "../src/auth.mjs";
import { DEFAULT_PORT, dataDir, resolveConfig } from "../src/config.mjs";

describe("data dir", () => {
  const home = "/home/alice";
  it("follows XDG on Linux", () => {
    assert.equal(dataDir({ platform: "linux", home, env: {} }), "/home/alice/.local/share/tempience");
    assert.equal(
      dataDir({ platform: "linux", home, env: { XDG_DATA_HOME: "/data" } }),
      "/data/tempience",
    );
  });
  it("uses Application Support on macOS", () => {
    assert.equal(
      dataDir({ platform: "darwin", home, env: {} }),
      "/home/alice/Library/Application Support/Tempience",
    );
  });
  it("uses APPDATA on Windows", () => {
    assert.match(
      dataDir({ platform: "win32", home: "C:\\Users\\alice", env: { APPDATA: "C:\\Users\\alice\\AppData\\Roaming" } }),
      /AppData[\\/]Roaming[\\/]Tempience$/,
    );
  });
  it("is overridden by TEMPIENCE_SYNC_HOME on every OS", () => {
    for (const platform of ["linux", "darwin", "win32"]) {
      assert.equal(
        dataDir({ platform, home, env: { TEMPIENCE_SYNC_HOME: "/tmp/sync-home" } }),
        "/tmp/sync-home",
      );
    }
  });
});

describe("resolveConfig", () => {
  let home;
  before(() => {
    home = mkdtempSync(join(tmpdir(), "tempience-sync-config-"));
  });
  after(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("creates config.json with a generated secret and defaults on the first run (mode 600)", () => {
    const env = { TEMPIENCE_SYNC_HOME: join(home, "first") };
    const config = resolveConfig({ env });
    assert.equal(config.configPath, join(home, "first", "config.json"));
    assert.equal(config.configUsed, true);
    assert.ok(existsSync(config.configPath));
    assert.equal(statSync(config.configPath).mode & 0o777, 0o600);
    const file = JSON.parse(readFileSync(config.configPath, "utf8"));
    assert.match(file.jwtSecret, /^[0-9a-f]{64}$/);
    assert.deepEqual(
      { ...file, jwtSecret: undefined },
      {
        jwtSecret: undefined,
        projectId: "tempience-local",
        port: DEFAULT_PORT,
        pairingTtlMs: DEFAULT_PAIRING_TTL_MS,
        deviceTokenTtlMs: DEFAULT_DEVICE_TOKEN_TTL_MS,
      },
    );
    assert.equal(config.jwtSecret, file.jwtSecret);
    assert.equal(config.port, DEFAULT_PORT);
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.databasePath, join(home, "first", "triplit.sqlite"));
    assert.equal(config.pairingCode.length > 10, true);

    const again = resolveConfig({ env });
    assert.equal(again.jwtSecret, config.jwtSecret, "the second run reuses the file");
  });

  it("does not write a file when the environment carries the secret", () => {
    const env = {
      TEMPIENCE_SYNC_HOME: join(home, "env-only"),
      TRIPLIT_JWT_SECRET: "owner-secret",
      TRIPLIT_DATABASE_PATH: join(home, "owner", "triplit.sqlite"),
      TRIPLIT_PORT: "6599",
      TRIPLIT_HOST: "127.0.0.2",
      TRIPLIT_PROJECT_ID: "owner-project",
      TRIPLIT_PAIRING_TTL_MS: "1000",
      TRIPLIT_DEVICE_TOKEN_TTL_MS: "2000",
      TRIPLIT_PAIRING_CODE: "fixed-code",
      TRIPLIT_VERBOSE_LOGS: "true",
    };
    const config = resolveConfig({ env });
    assert.equal(config.configUsed, false);
    assert.equal(existsSync(config.configPath), false);
    assert.equal(config.jwtSecret, "owner-secret");
    assert.equal(config.databasePath, join(home, "owner", "triplit.sqlite"));
    assert.equal(config.port, 6599);
    assert.equal(config.host, "127.0.0.2");
    assert.equal(config.projectId, "owner-project");
    assert.equal(config.pairingTtlMs, 1000);
    assert.equal(config.deviceTokenTtlMs, 2000);
    assert.equal(config.pairingCode, "fixed-code");
    assert.equal(config.verboseLogs, true);
  });

  it("lets the environment override an existing config.json, key by key", () => {
    const dir = join(home, "mixed");
    resolveConfig({ env: { TEMPIENCE_SYNC_HOME: dir } });
    const file = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
    const config = resolveConfig({
      env: { TEMPIENCE_SYNC_HOME: dir, TRIPLIT_PORT: "6598", TRIPLIT_JWT_SECRET: "from-env" },
    });
    assert.equal(config.configUsed, true);
    assert.equal(config.port, 6598);
    assert.equal(config.jwtSecret, "from-env");
    assert.equal(config.projectId, file.projectId, "keys the env does not set come from the file");
    assert.equal(config.deviceTokenTtlMs, file.deviceTokenTtlMs);
  });

  it("prefers an explicit port over the environment and the file", () => {
    const dir = join(home, "explicit");
    const config = resolveConfig({ env: { TEMPIENCE_SYNC_HOME: dir, TRIPLIT_PORT: "6598" }, port: "6597" });
    assert.equal(config.port, 6597);
    assert.throws(() => resolveConfig({ env: { TEMPIENCE_SYNC_HOME: dir }, port: "zero" }), /port must be a positive integer/);
  });

  it("reads the user's edits to config.json", () => {
    const dir = join(home, "edited");
    resolveConfig({ env: { TEMPIENCE_SYNC_HOME: dir } });
    const path = join(dir, "config.json");
    writeFileSync(path, JSON.stringify({ jwtSecret: "hand-written", port: 6596, projectId: "mine" }));
    const config = resolveConfig({ env: { TEMPIENCE_SYNC_HOME: dir } });
    assert.equal(config.jwtSecret, "hand-written");
    assert.equal(config.port, 6596);
    assert.equal(config.projectId, "mine");
    assert.equal(config.pairingTtlMs, DEFAULT_PAIRING_TTL_MS, "missing keys fall back to defaults");
    writeFileSync(path, "{ not json");
    assert.throws(() => resolveConfig({ env: { TEMPIENCE_SYNC_HOME: dir } }), /not valid JSON/);
  });

  it("is read-only with create: false and tolerates the missing secret", () => {
    const dir = join(home, "readonly");
    const config = resolveConfig({ env: { TEMPIENCE_SYNC_HOME: dir }, create: false });
    assert.equal(config.configUsed, false);
    assert.equal(config.jwtSecret, undefined);
    assert.equal(config.port, DEFAULT_PORT);
    assert.equal(existsSync(join(dir, "config.json")), false);
  });

  it("refuses to run without a secret when the file has none", () => {
    const dir = join(home, "no-secret");
    resolveConfig({ env: { TEMPIENCE_SYNC_HOME: dir } });
    writeFileSync(join(dir, "config.json"), JSON.stringify({ port: 6595 }));
    assert.throws(
      () => resolveConfig({ env: { TEMPIENCE_SYNC_HOME: dir } }),
      /TRIPLIT_JWT_SECRET must be configured/,
    );
  });
});
