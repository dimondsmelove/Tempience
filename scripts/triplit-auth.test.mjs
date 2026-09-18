import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDeviceToken,
  createPairingCode,
  isPairingCodeValid,
} from "./triplit-auth.mjs";

describe("Triplit device auth", () => {
  it("creates a unique pairing code", () => {
    assert.notEqual(createPairingCode(), createPairingCode());
  });

  it("accepts a valid pairing code only before expiry", () => {
    const code = "pairing-code";
    assert.equal(
      isPairingCodeValid({
        provided: code,
        expected: code,
        expiresAt: 2_000,
        now: 1_000,
      }),
      true,
    );
    assert.equal(
      isPairingCodeValid({
        provided: code,
        expected: code,
        expiresAt: 2_000,
        now: 2_000,
      }),
      false,
    );
    assert.equal(
      isPairingCodeValid({
        provided: "wrong-code",
        expected: code,
        expiresAt: 2_000,
        now: 1_000,
      }),
      false,
    );
  });

  it("creates a device-specific expiring JWT", () => {
    const auth = createDeviceToken({
      deviceId: "device-123",
      deviceLabel: "Phone",
      projectId: "tempience-local",
      secret: "server-only-secret",
      now: 1_700_000_000_000,
      ttlMs: 60_000,
    });
    const [, encodedPayload, signature] = auth.token.split(".");
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString(),
    );

    assert.match(auth.token, /^.+\..+\..+$/);
    assert.equal(payload.sub, "device-123");
    assert.equal(payload.device_label, "Phone");
    assert.equal(payload.exp - payload.iat, 60);
    assert.equal(auth.deviceId, "device-123");
    assert.equal(auth.expiresAt, "2023-11-14T22:14:20.000Z");
    assert.equal(typeof signature, "string");
  });
});
