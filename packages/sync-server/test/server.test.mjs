import assert from "node:assert/strict";
import { request } from "node:http";
import { after, before, describe, it } from "node:test";
import { serve } from "@hono/node-server";
import { createApp, createPairing, isLocalRequest } from "../src/server.mjs";

const TEST_PORT = 6560;

const config = {
  projectId: "tempience-test",
  jwtSecret: "test-secret",
  deviceTokenTtlMs: 60_000,
  pairingCode: "first-code",
  pairingTtlMs: 600_000,
  port: TEST_PORT,
  databasePath: "/tmp/sync-npm/test.sqlite",
};

const json = (body) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("isLocalRequest", () => {
  it("accepts a loopback peer with a loopback Host and nothing forwarded", () => {
    for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
      assert.equal(isLocalRequest({ address, host: "127.0.0.1:6544", forwarded: false }), true);
    }
    assert.equal(isLocalRequest({ address: "127.0.0.1", host: "localhost:6544", forwarded: false }), true);
    assert.equal(isLocalRequest({ address: "::1", host: "[::1]:6544", forwarded: false }), true);
  });
  it("refuses other peers, tailnet hosts and forwarded requests", () => {
    assert.equal(isLocalRequest({ address: "192.168.1.20", host: "127.0.0.1:6544", forwarded: false }), false);
    assert.equal(isLocalRequest({ address: "100.64.0.3", host: "127.0.0.1:6544", forwarded: false }), false);
    assert.equal(isLocalRequest({ address: undefined, host: "127.0.0.1:6544", forwarded: false }), false);
    assert.equal(
      isLocalRequest({ address: "127.0.0.1", host: "laptop.tail1234.ts.net", forwarded: false }),
      false,
    );
    assert.equal(isLocalRequest({ address: "127.0.0.1", host: "127.0.0.1:6544", forwarded: true }), false);
  });
});

describe("app routes (no socket)", () => {
  let now = 1_000_000;
  const pairing = createPairing(config, () => now);
  const app = createApp({ config, pairing, version: "0.1.0" });

  it("answers /healthz as before", async () => {
    const response = await app.request("/healthz");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, "tempience-triplit");
    assert.equal(body.projectId, "tempience-test");
    assert.equal(body.pairingExpiresAt, new Date(1_600_000).toISOString());
  });

  it("pairs with the right code and refuses the rest, exactly as before", async () => {
    let response = await app.request("/pair", { method: "POST", body: "nope" });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_json" });

    response = await app.request("/pair", json({ code: "first-code" }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "deviceId_required" });

    response = await app.request("/pair", json({ code: "wrong", deviceId: "d1" }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "invalid_pairing_code" });

    response = await app.request("/pair", json({ code: "first-code", deviceId: "d1", deviceLabel: "Phone" }));
    assert.equal(response.status, 200);
    const auth = await response.json();
    assert.equal(auth.deviceId, "d1");
    assert.equal(auth.deviceLabel, "Phone");
    assert.match(auth.token, /^.+\..+\..+$/);
    assert.equal(typeof auth.expiresAt, "string");
  });

  it("reports an expired code with 410 pairing_code_expired", async () => {
    let clock = 0;
    const expired = createPairing(config, () => clock);
    const stale = createApp({ config, pairing: expired });
    clock = config.pairingTtlMs;
    const response = await stale.request("/pair", json({ code: "first-code", deviceId: "d1" }));
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), { error: "pairing_code_expired" });
  });

  it("serves the page without the code, and refuses to rotate, when the request is not provably local", async () => {
    let response = await app.request("/", { headers: { "accept-language": "ru" } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    assert.match(html, /lang="ru"/);
    assert.doesNotMatch(html, /first-code/);

    response = await app.request("/pairing-code/rotate", { method: "POST" });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "local_only" });
    assert.equal(pairing.code, "first-code");
  });

  it("lets a websocket upgrade on / fall through to the next handler", async () => {
    const response = await app.request("/", { headers: { upgrade: "websocket" } });
    assert.equal(response.status, 404, "nothing else is mounted in this test; Triplit takes it in the real server");
  });
});

describe("app routes over a real loopback socket", () => {
  const pairing = createPairing(config);
  const app = createApp({ config, pairing });
  let server;
  before(async () => {
    server = await new Promise((resolve) => {
      const listening = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: TEST_PORT }, () =>
        resolve(listening),
      );
    });
  });
  after(() => new Promise((resolve) => server.close(resolve)));

  const base = `http://127.0.0.1:${TEST_PORT}`;
  const withHeaders = (path, headers) =>
    new Promise((resolve, reject) => {
      const req = request(
        { host: "127.0.0.1", port: TEST_PORT, path, method: path === "/" ? "GET" : "POST", headers },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => resolve({ status: res.statusCode, body }));
        },
      );
      req.on("error", reject);
      req.end();
    });

  it("shows the code on the local page and rotates it from localhost", async () => {
    const before = pairing.code;
    let html = await (await fetch(`${base}/`)).text();
    assert.match(html, new RegExp(before));

    const response = await fetch(`${base}/pairing-code/rotate`, { method: "POST" });
    assert.equal(response.status, 200);
    const rotated = await response.json();
    assert.notEqual(rotated.code, before);
    assert.equal(rotated.code, pairing.code);
    assert.equal(rotated.expiresAt, new Date(pairing.expiresAt).toISOString());

    html = await (await fetch(`${base}/`)).text();
    assert.match(html, new RegExp(rotated.code));
    assert.doesNotMatch(html, new RegExp(before));

    let pair = await fetch(`${base}/pair`, json({ code: before, deviceId: "d1" }));
    assert.equal(pair.status, 401, "the old code is dead");
    pair = await fetch(`${base}/pair`, json({ code: rotated.code, deviceId: "d1" }));
    assert.equal(pair.status, 200, "the new code pairs");
  });

  it("treats a request proxied to loopback (tailnet Host or X-Forwarded-*) as not local", async () => {
    const current = pairing.code;
    let result = await withHeaders("/pairing-code/rotate", { "x-forwarded-for": "100.64.0.3" });
    assert.equal(result.status, 403);
    result = await withHeaders("/pairing-code/rotate", { host: "laptop.tail1234.ts.net" });
    assert.equal(result.status, 403);
    assert.equal(pairing.code, current);
    result = await withHeaders("/", { host: "laptop.tail1234.ts.net" });
    assert.equal(result.status, 200);
    assert.doesNotMatch(result.body, new RegExp(current));
  });
});
