import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isEphemeralInstall,
  renderLaunchAgent,
  renderSystemdUnit,
  serviceCommand,
  serviceFile,
  windowsInstructions,
} from "../src/service.mjs";

describe("service files", () => {
  it("knows where each OS keeps the unit", () => {
    assert.equal(
      serviceFile({ platform: "linux", home: "/home/alice" }),
      "/home/alice/.config/systemd/user/tempience-sync.service",
    );
    assert.equal(
      serviceFile({ platform: "darwin", home: "/Users/alice" }),
      "/Users/alice/Library/LaunchAgents/app.tempience.sync.plist",
    );
    assert.equal(serviceFile({ platform: "win32", home: "C:\\Users\\alice" }), null);
  });

  it("builds the command from this node and the package bin, carrying --port", () => {
    assert.deepEqual(serviceCommand({ node: "/usr/bin/node", bin: "/opt/x/bin/tempience-sync.mjs" }), [
      "/usr/bin/node",
      "/opt/x/bin/tempience-sync.mjs",
    ]);
    assert.deepEqual(
      serviceCommand({ node: "/usr/bin/node", bin: "/opt/x/bin/tempience-sync.mjs", port: "6563" }),
      ["/usr/bin/node", "/opt/x/bin/tempience-sync.mjs", "--port", "6563"],
    );
  });

  it("renders a user unit that restarts, reads no env file and pins the test home", () => {
    const unit = renderSystemdUnit({
      command: ["/usr/bin/node", "/opt/x y/bin/tempience-sync.mjs", "--port", "6563"],
      syncHome: "/tmp/sync-npm/home",
    });
    assert.match(unit, /^\[Unit\]/);
    assert.match(unit, /ExecStart=\/usr\/bin\/node "\/opt\/x y\/bin\/tempience-sync.mjs" --port 6563/);
    assert.doesNotMatch(unit, /EnvironmentFile/);
    assert.match(unit, /Environment=TEMPIENCE_SYNC_HOME=\/tmp\/sync-npm\/home/);
    assert.match(unit, /Restart=always/);
    assert.match(unit, /WantedBy=default\.target/);
    assert.doesNotMatch(renderSystemdUnit({ command: ["node", "bin"] }), /Environment=/);
  });

  it("renders a LaunchAgent that keeps the server alive", () => {
    const plist = renderLaunchAgent({
      command: ["/usr/local/bin/node", "/opt/x/bin/tempience-sync.mjs"],
      syncHome: "/tmp/sync-npm/home",
      home: "/Users/alice",
    });
    assert.match(plist, /<string>app\.tempience\.sync<\/string>/);
    assert.match(plist, /<string>\/usr\/local\/bin\/node<\/string>\s*<string>\/opt\/x\/bin\/tempience-sync\.mjs<\/string>/);
    assert.match(plist, /TEMPIENCE_SYNC_HOME<\/key>\s*<string>\/tmp\/sync-npm\/home/);
    assert.match(plist, /<key>KeepAlive<\/key>\s*<true\/>/);
    assert.match(plist, /\/Users\/alice\/Library\/Logs\/tempience-sync\.log/);
  });

  it("prints a schtasks recipe for Windows", () => {
    const text = windowsInstructions({ command: ["C:\\node.exe", "C:\\x\\bin\\tempience-sync.mjs"] });
    assert.match(text, /schtasks \/Create/);
    assert.match(text, /schtasks \/Delete/);
  });

  it("recognises the npx cache", () => {
    assert.equal(isEphemeralInstall("/home/alice/.npm/_npx/abc123/node_modules/tempience-sync/bin/tempience-sync.mjs"), true);
    assert.equal(isEphemeralInstall("/usr/lib/node_modules/tempience-sync/bin/tempience-sync.mjs"), false);
    assert.equal(isEphemeralInstall("/tmp/sync-npm/consumer/node_modules/tempience-sync/bin/tempience-sync.mjs"), false);
  });
});
