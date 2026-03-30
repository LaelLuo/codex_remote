import { assertEquals } from "jsr:@std/assert";

import type { KvStore } from "./kv-store.ts";
import type { Settings } from "./types.ts";
import { verifyAnchorAnyToken } from "./jwt.ts";

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    authMode: "passkey",
    webJwtSecret: "web-secret",
    anchorJwtSecret: "legacy-anchor-secret",
    accessTtlSec: 3600,
    refreshTtlSec: 7 * 24 * 3600,
    corsOrigins: ["*"],
    deviceCodeTtlSec: 600,
    devicePollIntervalSec: 5,
    deviceVerificationUrl: "https://app.test/device",
    challengeTtlSec: 300,
    passkeyOrigin: "https://app.test",
    passkeyRpId: "app.test",
    anchorAccessTtlSec: 3600,
    anchorRefreshTtlSec: 30 * 24 * 3600,
    ...overrides,
  };
}

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signHs256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(signature));
}

async function createLegacyAnchorJwt(secret: string, userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: "codex-remote-anchor",
      aud: "codex-remote-orbit-anchor",
      sub: userId,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = await signHs256(secret, `${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

function createStore(
  verifyAnchorAccessToken: (token: string) => Promise<{ userId: string } | null>,
): KvStore {
  return {
    verifyAnchorAccessToken,
  } as unknown as KvStore;
}

Deno.test("verifyAnchorAnyToken accepts opaque anchor access token", async () => {
  const store = createStore(async (token) => (token === "opaque-access-token" ? { userId: "anchor-123" } : null));
  const result = await verifyAnchorAnyToken(createSettings(), store, "opaque-access-token");
  assertEquals(result, { sub: "anchor-123" });
});

Deno.test("verifyAnchorAnyToken rejects legacy anchor jwt fallback", async () => {
  const settings = createSettings();
  const legacyJwt = await createLegacyAnchorJwt(settings.anchorJwtSecret, "anchor-legacy");
  const store = createStore(async () => null);
  const result = await verifyAnchorAnyToken(settings, store, legacyJwt);
  assertEquals(result, null);
});
