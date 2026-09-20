import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createNodeWebSocket } from "@hono/node-ws";
import { createTriplitStorageProvider } from "@triplit/server";
import { createTriplitHonoServer } from "@triplit/server/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createDeviceToken,
  createPairingCode,
  isPairingCodeValid,
} from "./auth.mjs";
import { pickLanguage, statusPage } from "./page.mjs";

const asText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

/** The current pairing code and its expiry; «New code» replaces both. */
export const createPairing = ({ pairingCode, pairingTtlMs }, now = Date.now) => {
  let code = pairingCode;
  let expiresAt = now() + pairingTtlMs;
  return {
    get code() {
      return code;
    },
    get expiresAt() {
      return expiresAt;
    },
    rotate() {
      code = createPairingCode();
      expiresAt = now() + pairingTtlMs;
      return { code, expiresAt };
    },
    expired() {
      return now() >= expiresAt;
    },
    accepts(provided) {
      return isPairingCodeValid({ provided, expected: code, expiresAt, now: now() });
    },
  };
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

const isLoopbackAddress = (address) =>
  typeof address === "string" &&
  (address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1" ||
    address.startsWith("127."));

/**
 * True only for a browser on this machine: the socket peer is loopback, the
 * Host header names loopback and nothing forwarded the request. A request that
 * arrives through `tailscale serve` also comes from 127.0.0.1 — but with the
 * tailnet host and X-Forwarded-* headers, so it does not qualify.
 */
export const isLocalRequest = ({ address, host, forwarded }) => {
  if (!isLoopbackAddress(address)) return false;
  if (forwarded) return false;
  const hostname = (host ?? "").replace(/:\d+$/, "").toLowerCase();
  return LOOPBACK_HOSTS.has(hostname);
};

const localRequest = (context) => {
  let address;
  try {
    address = getConnInfo(context).remote.address;
  } catch {
    return false;
  }
  return isLocalRequest({
    address,
    host: context.req.header("host"),
    forwarded: Boolean(
      context.req.header("x-forwarded-for") ??
        context.req.header("x-forwarded-host") ??
        context.req.header("x-forwarded-proto") ??
        context.req.header("forwarded"),
    ),
  });
};

/** The pairing routes and the status page; Triplit's own routes are added on top by startServer. */
export const createApp = ({ config, pairing, version = "" }) => {
  const app = new Hono();
  app.use("*", cors());

  app.get("/healthz", (context) =>
    context.json({
      ok: true,
      service: "tempience-triplit",
      projectId: config.projectId,
      pairingExpiresAt: new Date(pairing.expiresAt).toISOString(),
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
    if (pairing.expired()) {
      return context.json({ error: "pairing_code_expired" }, 410);
    }
    if (!pairing.accepts(code)) {
      return context.json({ error: "invalid_pairing_code" }, 401);
    }

    return context.json(
      createDeviceToken({
        deviceId,
        deviceLabel,
        projectId: config.projectId,
        secret: config.jwtSecret,
        ttlMs: config.deviceTokenTtlMs,
      }),
    );
  });

  // Triplit's sync socket is also GET / (with Upgrade: websocket); let it through.
  app.get("/", (context, next) => {
    if (context.req.header("upgrade")?.toLowerCase() === "websocket") return next();
    const local = localRequest(context);
    return context.html(
      statusPage({
        language: pickLanguage(context.req.header("accept-language")),
        local,
        code: local ? pairing.code : undefined,
        expiresAt: new Date(pairing.expiresAt).toISOString(),
        port: config.port,
        databasePath: config.databasePath,
        version,
      }),
    );
  });

  app.post("/pairing-code/rotate", (context) => {
    if (!localRequest(context)) return context.json({ error: "local_only" }, 403);
    const next = pairing.rotate();
    return context.json({
      code: next.code,
      expiresAt: new Date(next.expiresAt).toISOString(),
    });
  });

  return app;
};

/** Starts the sync server: pairing routes, the status page and Triplit over SQLite. */
export const startServer = async (config, { log = console.log, version = "" } = {}) => {
  await mkdir(dirname(config.databasePath), { recursive: true });
  process.env.LOCAL_DATABASE_URL = config.databasePath;

  const pairing = createPairing(config);
  const app = createApp({ config, pairing, version });
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
  const triplitApp = await createTriplitHonoServer(
    {
      storage: await createTriplitStorageProvider("sqlite"),
      jwtSecret: config.jwtSecret,
      projectId: config.projectId,
      verboseLogs: config.verboseLogs,
    },
    upgradeWebSocket,
    undefined,
    app,
  );

  const pageUrl = `http://${config.host}:${config.port}/`;
  const server = await new Promise((resolve, reject) => {
    const listening = serve(
      { fetch: triplitApp.fetch, hostname: config.host, port: config.port },
      () => {
        log(`Tempience Triplit server listening on http://${config.host}:${config.port}`);
        log(`Triplit database: ${config.databasePath}`);
        if (config.configUsed) log(`Config: ${config.configPath}`);
        log(`Pairing code: ${pairing.code}`);
        log(`Pairing code expires: ${new Date(pairing.expiresAt).toISOString()}`);
        log(`Status page: ${pageUrl}`);
        resolve(listening);
      },
    );
    listening.once("error", (error) => {
      if (error?.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${config.port} is already in use. Is the sync server already running? ` +
              `Open ${pageUrl} to check, or start this one with --port <other port>.`,
          ),
        );
        return;
      }
      reject(error);
    });
  });
  injectWebSocket(server);

  return {
    server,
    pairing,
    pageUrl,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};
