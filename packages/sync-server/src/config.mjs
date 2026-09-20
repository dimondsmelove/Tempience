import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform as osPlatform } from "node:os";
import { join, resolve } from "node:path";
import {
  DEFAULT_DEVICE_TOKEN_TTL_MS,
  DEFAULT_PAIRING_TTL_MS,
  createPairingCode,
} from "./auth.mjs";

export const DEFAULT_PORT = 6544;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PROJECT_ID = "tempience-local";
export const CONFIG_FILE = "config.json";
export const DATABASE_FILE = "triplit.sqlite";

/**
 * Where config.json and the database live. TEMPIENCE_SYNC_HOME overrides the
 * per-OS default (tests, or a user who wants everything in one folder).
 */
export const dataDir = ({
  env = process.env,
  platform = osPlatform(),
  home = homedir(),
} = {}) => {
  const override = env.TEMPIENCE_SYNC_HOME?.trim();
  if (override) return resolve(override);
  if (platform === "win32") {
    return join(
      env.APPDATA?.trim() || join(home, "AppData", "Roaming"),
      "Tempience",
    );
  }
  if (platform === "darwin") {
    return join(home, "Library", "Application Support", "Tempience");
  }
  return join(env.XDG_DATA_HOME?.trim() || join(home, ".local", "share"), "tempience");
};

const positiveInteger = (value, name) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return number;
};

const readConfigFile = (path) => {
  if (!existsSync(path)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new Error(`${path} is not valid JSON: ${cause.message}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path} must contain a JSON object`);
  }
  return parsed;
};

/** The first run writes a config with a fresh secret; the file is the user's to edit afterwards. */
const createConfigFile = (path) => {
  const config = {
    jwtSecret: randomBytes(32).toString("hex"),
    projectId: DEFAULT_PROJECT_ID,
    port: DEFAULT_PORT,
    pairingTtlMs: DEFAULT_PAIRING_TTL_MS,
    deviceTokenTtlMs: DEFAULT_DEVICE_TOKEN_TTL_MS,
  };
  mkdirSync(resolve(path, ".."), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return config;
};

/**
 * Resolves the server configuration. Precedence: explicit options (the command
 * line) > TRIPLIT_* environment variables > config.json in the data dir >
 * defaults. config.json is created on the first run unless the environment
 * already carries the secret (the owner's env-file setup needs no file), and
 * never when `create` is false (`--status` is read-only and then tolerates a
 * missing secret).
 */
export const resolveConfig = ({
  env = process.env,
  platform,
  home,
  port,
  create = true,
} = {}) => {
  const dir = dataDir({ env, platform, home });
  const configPath = join(dir, CONFIG_FILE);
  const secretFromEnv = env.TRIPLIT_JWT_SECRET?.trim();
  let file = readConfigFile(configPath);
  if (!file && !secretFromEnv && create) file = createConfigFile(configPath);
  const fromFile = file ?? {};

  const pick = (envName, fileKey, fallback) => {
    const fromEnv = env[envName]?.trim();
    if (fromEnv) return fromEnv;
    if (fromFile[fileKey] !== undefined && fromFile[fileKey] !== null) {
      return fromFile[fileKey];
    }
    return fallback;
  };

  const jwtSecret = secretFromEnv || fromFile.jwtSecret;
  const hasSecret = typeof jwtSecret === "string" && jwtSecret.trim().length > 0;
  if (!hasSecret && create) {
    throw new Error(
      `TRIPLIT_JWT_SECRET must be configured (or "jwtSecret" in ${configPath})`,
    );
  }

  return {
    dataDir: dir,
    configPath,
    configUsed: file !== null,
    port: positiveInteger(
      port ?? pick("TRIPLIT_PORT", "port", DEFAULT_PORT),
      "port",
    ),
    host: env.TRIPLIT_HOST?.trim() || fromFile.host || DEFAULT_HOST,
    projectId: String(pick("TRIPLIT_PROJECT_ID", "projectId", DEFAULT_PROJECT_ID)),
    jwtSecret: hasSecret ? jwtSecret.trim() : undefined,
    databasePath: resolve(env.TRIPLIT_DATABASE_PATH?.trim() || join(dir, DATABASE_FILE)),
    pairingTtlMs: positiveInteger(
      pick("TRIPLIT_PAIRING_TTL_MS", "pairingTtlMs", DEFAULT_PAIRING_TTL_MS),
      "TRIPLIT_PAIRING_TTL_MS",
    ),
    deviceTokenTtlMs: positiveInteger(
      pick(
        "TRIPLIT_DEVICE_TOKEN_TTL_MS",
        "deviceTokenTtlMs",
        DEFAULT_DEVICE_TOKEN_TTL_MS,
      ),
      "TRIPLIT_DEVICE_TOKEN_TTL_MS",
    ),
    pairingCode: env.TRIPLIT_PAIRING_CODE?.trim() || createPairingCode(),
    verboseLogs: env.TRIPLIT_VERBOSE_LOGS === "true",
  };
};
