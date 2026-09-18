import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const DEFAULT_PAIRING_TTL_MS = 10 * 60 * 1000;
export const DEFAULT_DEVICE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const sign = (value, secret) =>
  createHmac("sha256", secret).update(value).digest("base64url");

const normalizeText = (value, field, maxLength) => {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new Error(`${field} must contain 1-${maxLength} characters`);
  }
  return normalized;
};

export const createPairingCode = () => randomBytes(18).toString("base64url");

export const isPairingCodeValid = ({
  provided,
  expected,
  expiresAt,
  now = Date.now(),
}) => {
  if (
    now >= expiresAt ||
    typeof provided !== "string" ||
    provided.trim().length === 0
  ) {
    return false;
  }

  const providedBytes = Buffer.from(provided.trim());
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
};

export const createDeviceToken = ({
  deviceId,
  deviceLabel,
  projectId,
  secret,
  now = Date.now(),
  ttlMs = DEFAULT_DEVICE_TOKEN_TTL_MS,
}) => {
  const normalizedDeviceId = normalizeText(deviceId, "deviceId", 128);
  const normalizedProjectId = normalizeText(projectId, "projectId", 128);
  const normalizedSecret = normalizeText(secret, "secret", 4096);
  const normalizedLabel =
    typeof deviceLabel === "string" ? deviceLabel.trim().slice(0, 128) : "";
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + Math.floor(ttlMs / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: normalizedDeviceId,
    "x-triplit-project-id": normalizedProjectId,
    ...(normalizedLabel ? { device_label: normalizedLabel } : {}),
    iat: issuedAt,
    exp: expiresAt,
  });
  const unsigned = `${header}.${payload}`;

  return {
    token: `${unsigned}.${sign(unsigned, normalizedSecret)}`,
    deviceId: normalizedDeviceId,
    deviceLabel: normalizedLabel || "Browser device",
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
};
