import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createNodeWebSocket } from "@hono/node-ws";
import { serve } from "@hono/node-server";
import { createTriplitStorageProvider } from "@triplit/server";
import { createTriplitHonoServer } from "@triplit/server/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createDeviceToken,
  createPairingCode,
  DEFAULT_DEVICE_TOKEN_TTL_MS,
  DEFAULT_PAIRING_TTL_MS,
  isPairingCodeValid,
} from "./triplit-auth.mjs";

const readRequiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
};

const readPositiveIntegerEnv = (name, fallback) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`);
  return value;
};

const asText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const port = readPositiveIntegerEnv("TRIPLIT_PORT", 6544);
const host = process.env.TRIPLIT_HOST?.trim() || "127.0.0.1";
const projectId = process.env.TRIPLIT_PROJECT_ID?.trim() || "tempience-local";
const jwtSecret = readRequiredEnv("TRIPLIT_JWT_SECRET");
const databasePath = resolve(
  process.env.TRIPLIT_DATABASE_PATH ?? "data/triplit.sqlite",
);
const pairingTtlMs = readPositiveIntegerEnv(
  "TRIPLIT_PAIRING_TTL_MS",
  DEFAULT_PAIRING_TTL_MS,
);
const deviceTokenTtlMs = readPositiveIntegerEnv(
  "TRIPLIT_DEVICE_TOKEN_TTL_MS",
  DEFAULT_DEVICE_TOKEN_TTL_MS,
);
const pairingCode =
  process.env.TRIPLIT_PAIRING_CODE?.trim() || createPairingCode();
const pairingExpiresAt = Date.now() + pairingTtlMs;

await mkdir(dirname(databasePath), { recursive: true });
process.env.LOCAL_DATABASE_URL = databasePath;

const app = new Hono();
app.use("*", cors());

app.get("/healthz", (context) =>
  context.json({
    ok: true,
    service: "tempience-triplit",
    projectId,
    pairingExpiresAt: new Date(pairingExpiresAt).toISOString(),
  }),
);

app.post("/pair", async (context) => {
  let body;
  try {
    body = await context.req.json();
  } catch {
    return context.json({ error: "invalid_json" }, 400);
  }

  const code = asText(body?.code, 256);
  const deviceId = asText(body?.deviceId, 128);
  const deviceLabel = asText(body?.deviceLabel, 128);
  if (!deviceId) return context.json({ error: "deviceId_required" }, 400);
  if (Date.now() >= pairingExpiresAt) {
    return context.json({ error: "pairing_code_expired" }, 410);
  }
  if (
    !isPairingCodeValid({
      provided: code,
      expected: pairingCode,
      expiresAt: pairingExpiresAt,
    })
  ) {
    return context.json({ error: "invalid_pairing_code" }, 401);
  }

  return context.json(
    createDeviceToken({
      deviceId,
      deviceLabel,
      projectId,
      secret: jwtSecret,
      ttlMs: deviceTokenTtlMs,
    }),
  );
});

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
const triplitApp = await createTriplitHonoServer(
  {
    storage: await createTriplitStorageProvider("sqlite"),
    jwtSecret,
    projectId,
    verboseLogs: process.env.TRIPLIT_VERBOSE_LOGS === "true",
  },
  upgradeWebSocket,
  undefined,
  app,
);

const server = serve(
  {
    fetch: triplitApp.fetch,
    hostname: host,
    port,
  },
  () => {
    console.log(`Tempience Triplit server listening on http://${host}:${port}`);
    console.log(`Triplit database: ${databasePath}`);
    console.log(`Pairing code: ${pairingCode}`);
    console.log(
      `Pairing code expires: ${new Date(pairingExpiresAt).toISOString()}`,
    );
  },
);
injectWebSocket(server);

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; stopping Tempience Triplit server`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};

for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => shutdown(signal));
