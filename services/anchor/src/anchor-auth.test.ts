import { describe, expect, test } from "bun:test";

import {
  normalizePersistedAnchorCredentials,
  parseDeviceAuthorisationPayload,
  resolveOrbitWsUrl,
} from "./anchor-auth";

describe("anchor auth helpers", () => {
  test("ignores legacy secret-only persisted credentials", () => {
    const normalized = normalizePersistedAnchorCredentials({
      userId: "user-1",
      anchorId: "anchor-1",
      anchorJwtSecret: "legacy-secret",
    });

    expect(normalized).toEqual({
      userId: "user-1",
      anchorId: "anchor-1",
      anchorAccessToken: "",
      anchorRefreshToken: "",
      anchorAccessExpiresAtMs: 0,
      hasDeviceTokens: false,
    });
  });

  test("parses only access refresh device auth payloads", () => {
    const accepted = parseDeviceAuthorisationPayload({
      status: "authorised",
      userId: "user-1",
      anchorAccessToken: "access-token",
      anchorRefreshToken: "refresh-token",
      anchorAccessExpiresIn: 3600,
    });
    expect(accepted).toEqual({
      userId: "user-1",
      anchorAccessToken: "access-token",
      anchorRefreshToken: "refresh-token",
      anchorAccessExpiresIn: 3600,
    });

    const rejected = parseDeviceAuthorisationPayload({
      status: "authorised",
      userId: "user-1",
      anchorJwtSecret: "legacy-secret",
    });
    expect(rejected).toBeNull();
  });

  test("distinguishes orbit auth failures from config failures", () => {
    expect(resolveOrbitWsUrl("not-a-url", "access-token")).toEqual({
      ok: false,
      kind: "config",
      detail: "invalid ANCHOR_ORBIT_URL",
    });

    expect(resolveOrbitWsUrl("wss://orbit.example/ws/anchor", "")).toEqual({
      ok: false,
      kind: "auth",
      detail: "missing anchor access token",
    });

    const resolved = resolveOrbitWsUrl("wss://orbit.example/ws/anchor?foo=bar", "access-token");
    expect(resolved).toEqual({
      ok: true,
      url: "wss://orbit.example/ws/anchor?foo=bar&token=access-token",
    });
  });
});
