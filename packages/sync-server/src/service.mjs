import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform as osPlatform, userInfo } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const SERVICE_NAME = "tempience-sync";
export const LAUNCHD_LABEL = "app.tempience.sync";

export const binPath = () =>
  resolve(fileURLToPath(import.meta.url), "..", "..", "bin", "tempience-sync.mjs");

/** npx keeps a downloaded package in a cache it may purge; a service must not point there. */
export const isEphemeralInstall = (path) =>
  path.split(sep).includes("_npx") || path.split("/").includes("_npx");

export const serviceFile = ({ platform = osPlatform(), home = homedir() } = {}) => {
  if (platform === "darwin") {
    return join(home, "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`);
  }
  if (platform === "linux") {
    return join(home, ".config", "systemd", "user", `${SERVICE_NAME}.service`);
  }
  return null;
};

/** The command line the service runs: this node, this package, the run flags given alongside --install-service. */
export const serviceCommand = ({ node = process.execPath, bin = binPath(), port } = {}) => [
  node,
  bin,
  ...(port ? ["--port", String(port)] : []),
];

export const renderSystemdUnit = ({ command, syncHome }) => `[Unit]
Description=Tempience sync server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
${syncHome ? `Environment=TEMPIENCE_SYNC_HOME=${syncHome}\n` : ""}ExecStart=${command.map(systemdQuote).join(" ")}
Restart=always
RestartSec=3
TimeoutStopSec=10

[Install]
WantedBy=default.target
`;

const systemdQuote = (argument) =>
  /^[\w./:@=+-]+$/.test(argument) ? argument : `"${argument.replaceAll('"', '\\"')}"`;

const xml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export const renderLaunchAgent = ({ command, syncHome, home = homedir() }) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${command.map((argument) => `    <string>${xml(argument)}</string>`).join("\n")}
  </array>
${
  syncHome
    ? `  <key>EnvironmentVariables</key>
  <dict>
    <key>TEMPIENCE_SYNC_HOME</key>
    <string>${xml(syncHome)}</string>
  </dict>
`
    : ""
}  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xml(join(home, "Library", "Logs", "tempience-sync.log"))}</string>
  <key>StandardErrorPath</key>
  <string>${xml(join(home, "Library", "Logs", "tempience-sync.log"))}</string>
</dict>
</plist>
`;

export const windowsInstructions = ({ command }) => `Windows: register the server as a scheduled task that starts at logon
(run once in PowerShell, as your own user):

  schtasks /Create /TN "Tempience sync" /SC ONLOGON /RL LIMITED /F ^
    /TR "${command.map((argument) => `\\"${argument}\\"`).join(" ")}"

Start it now:   schtasks /Run /TN "Tempience sync"
Remove it:      schtasks /Delete /TN "Tempience sync" /F
`;

const run = (file, args, { log } = {}) => {
  log?.(`$ ${[file, ...args].join(" ")}`);
  execFileSync(file, args, { stdio: "inherit" });
};

const tryRun = (file, args) => {
  const result = spawnSync(file, args, { encoding: "utf8" });
  return { ok: result.status === 0, out: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
};

/**
 * Installs and starts the service for the current user. Linux: a systemd user
 * unit; macOS: a LaunchAgent; Windows: the manual recipe. The service reads
 * config.json only — no env file is wired in, so a stray TRIPLIT_* file can
 * never point it at another database. Refuses when the package runs out of
 * the npx cache, which would break after a cache purge.
 */
export const installService = ({
  port,
  env = process.env,
  platform = osPlatform(),
  home = homedir(),
  log = console.log,
} = {}) => {
  const bin = binPath();
  if (isEphemeralInstall(bin)) {
    throw new Error(
      "This copy of tempience-sync lives in the npx cache, which npm may purge. " +
        "Install it permanently first, then register the service:\n" +
        "  npm install -g tempience-sync\n  tempience-sync --install-service",
    );
  }
  const command = serviceCommand({ bin, port });
  const syncHome = env.TEMPIENCE_SYNC_HOME?.trim() ? resolve(env.TEMPIENCE_SYNC_HOME) : undefined;
  const file = serviceFile({ platform, home });

  if (platform === "linux") {
    mkdirSync(resolve(file, ".."), { recursive: true });
    writeFileSync(file, renderSystemdUnit({ command, syncHome }));
    log(`Wrote ${file}`);
    run("systemctl", ["--user", "daemon-reload"], { log });
    run("systemctl", ["--user", "enable", "--now", `${SERVICE_NAME}.service`], { log });
    log(`Service ${SERVICE_NAME} is enabled and running.`);
    log(`Logs: journalctl --user -u ${SERVICE_NAME} -f`);
    return file;
  }
  if (platform === "darwin") {
    mkdirSync(resolve(file, ".."), { recursive: true });
    writeFileSync(file, renderLaunchAgent({ command, syncHome, home }));
    log(`Wrote ${file}`);
    const domain = `gui/${userInfo().uid}`;
    tryRun("launchctl", ["bootout", `${domain}/${LAUNCHD_LABEL}`]);
    run("launchctl", ["bootstrap", domain, file], { log });
    log(`Service ${LAUNCHD_LABEL} is loaded and running.`);
    log(`Logs: ${join(home, "Library", "Logs", "tempience-sync.log")}`);
    return file;
  }
  log(windowsInstructions({ command }));
  return null;
};

export const uninstallService = ({
  platform = osPlatform(),
  home = homedir(),
  log = console.log,
} = {}) => {
  const file = serviceFile({ platform, home });
  if (platform === "linux") {
    if (existsSync(file)) {
      tryRun("systemctl", ["--user", "disable", "--now", `${SERVICE_NAME}.service`]);
      rmSync(file);
      log(`Removed ${file}`);
    } else {
      tryRun("systemctl", ["--user", "disable", "--now", `${SERVICE_NAME}.service`]);
      log(`No ${file}; nothing to remove.`);
    }
    run("systemctl", ["--user", "daemon-reload"], { log });
    tryRun("systemctl", ["--user", "reset-failed", `${SERVICE_NAME}.service`]);
    return;
  }
  if (platform === "darwin") {
    tryRun("launchctl", ["bootout", `gui/${userInfo().uid}/${LAUNCHD_LABEL}`]);
    if (existsSync(file)) {
      rmSync(file);
      log(`Removed ${file}`);
    } else {
      log(`No ${file}; nothing to remove.`);
    }
    return;
  }
  log('Windows: schtasks /Delete /TN "Tempience sync" /F');
};

/** installed / enabled / active as the platform reports them; null where there is no service manager. */
export const serviceStatus = ({ platform = osPlatform(), home = homedir() } = {}) => {
  const file = serviceFile({ platform, home });
  if (!file) return null;
  const installed = existsSync(file);
  if (platform === "linux") {
    const enabled = tryRun("systemctl", ["--user", "is-enabled", `${SERVICE_NAME}.service`]);
    const active = tryRun("systemctl", ["--user", "is-active", `${SERVICE_NAME}.service`]);
    return {
      file,
      installed,
      enabled: enabled.ok,
      active: active.ok,
      state: `${active.out || "unknown"}${enabled.ok ? ", enabled" : ""}`,
    };
  }
  const loaded = tryRun("launchctl", ["print", `gui/${userInfo().uid}/${LAUNCHD_LABEL}`]);
  return {
    file,
    installed,
    enabled: loaded.ok,
    active: loaded.ok && /state = running/.test(loaded.out),
    state: loaded.ok ? (/state = running/.test(loaded.out) ? "running" : "loaded") : "not loaded",
  };
};
