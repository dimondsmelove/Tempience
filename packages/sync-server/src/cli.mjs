import { readFileSync, statSync } from "node:fs";
import { parseArgs } from "node:util";
import { resolveConfig } from "./config.mjs";
import { startServer } from "./server.mjs";
import { installService, serviceStatus, uninstallService } from "./service.mjs";

export const version = () =>
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const USAGE = `tempience-sync — the Tempience sync server on your own laptop.

  npx tempience-sync                 start; prints a pairing code and http://127.0.0.1:6544/
  npx tempience-sync --port 6544     listen on another port
  tempience-sync --install-service   keep it running (Linux: systemd --user, macOS: launchd,
                                     Windows: prints the recipe); needs a permanent install
  tempience-sync --uninstall-service remove that service
  tempience-sync --status            config path, database path, service and server state
  tempience-sync --version | --help

Configuration lives in config.json in the data folder (Linux ~/.local/share/tempience,
macOS ~/Library/Application Support/Tempience, Windows %APPDATA%\\Tempience); TEMPIENCE_SYNC_HOME
moves that folder. TRIPLIT_PORT, TRIPLIT_HOST, TRIPLIT_PROJECT_ID, TRIPLIT_JWT_SECRET,
TRIPLIT_DATABASE_PATH, TRIPLIT_PAIRING_TTL_MS, TRIPLIT_DEVICE_TOKEN_TTL_MS, TRIPLIT_PAIRING_CODE
and TRIPLIT_VERBOSE_LOGS override the file when set.
Guide: https://github.com/dimondsmelove/Tempience/blob/main/SYNC.md
`;

const describeFile = (path) => {
  try {
    const { size } = statSync(path);
    return `${path} (${size >= 1_048_576 ? `${(size / 1_048_576).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`})`;
  } catch {
    return `${path} (not created yet)`;
  }
};

const probeServer = async (config) => {
  try {
    const response = await fetch(`http://${config.host}:${config.port}/healthz`, {
      signal: AbortSignal.timeout(1500),
    });
    const body = await response.json();
    return body?.ok ? `running (pairing code expires ${body.pairingExpiresAt})` : "answering, but not ours";
  } catch {
    return "not running";
  }
};

export const printStatus = async ({ port, env = process.env, log = console.log } = {}) => {
  const config = resolveConfig({ env, port, create: false });
  const service = serviceStatus();
  log(`tempience-sync ${version()}`);
  log(`  data folder:  ${config.dataDir}`);
  log(
    `  config:       ${config.configUsed ? config.configPath : `${config.configPath} (${env.TRIPLIT_JWT_SECRET ? "not needed: TRIPLIT_JWT_SECRET is set" : "created on first start"})`}`,
  );
  log(`  database:     ${describeFile(config.databasePath)}`);
  log(`  port:         ${config.port}`);
  log(`  status page:  http://${config.host}:${config.port}/`);
  log(`  server:       ${await probeServer(config)}`);
  if (service) {
    log(
      `  service:      ${service.installed ? `installed (${service.file}), ${service.state}` : "not installed"}`,
    );
  } else {
    log("  service:      not managed on this OS (see --install-service)");
  }
  return config;
};

/** The command line: runs the server unless a management flag asks for something else. */
export const main = async (argv = process.argv.slice(2), { log = console.log } = {}) => {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      strict: true,
      options: {
        port: { type: "string", short: "p" },
        "install-service": { type: "boolean" },
        "uninstall-service": { type: "boolean" },
        status: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    }));
  } catch (error) {
    throw new Error(`${error.message}. Run tempience-sync --help for the options.`);
  }
  if (values.help) return log(USAGE);
  if (values.version) return log(version());
  if (values.status) return printStatus({ port: values.port, log });
  if (values["uninstall-service"]) return uninstallService({ log });
  if (values["install-service"]) {
    // Resolve (and create on first use) the config first, so the service starts with a secret in place.
    const config = resolveConfig({ port: values.port });
    installService({ port: values.port, log });
    log(`Status page: http://${config.host}:${config.port}/`);
    return;
  }

  const config = resolveConfig({ port: values.port });
  const running = await startServer(config, { log, version: version() });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`Received ${signal}; stopping Tempience Triplit server`);
    running.server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => shutdown(signal));
  return running;
};
