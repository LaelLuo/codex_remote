import { describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { AuthEnv } from "./env";
import { createUser, getAnchorSessionByAccessToken } from "./db";
import { createSession } from "./session";

mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
}));

const { handleAuthRequest } = await import("./index");

interface DeviceCodeRecord {
  deviceCode: string;
  userCode: string;
  status: "pending" | "authorised";
  userId?: string;
  expiresAt: number;
}

class TestPreparedStatement {
  constructor(
    private readonly sqlite: Database,
    private readonly query: string,
    private readonly params: unknown[] = []
  ) {}

  bind(...values: unknown[]): TestPreparedStatement {
    return new TestPreparedStatement(this.sqlite, this.query, values);
  }

  async first<T>(): Promise<T | null> {
    const row = this.sqlite.query(this.query).get(...this.params) as T | undefined;
    return row ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const rows = this.sqlite.query(this.query).all(...this.params) as T[];
    return { results: rows };
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    const result = this.sqlite.query(this.query).run(...this.params) as { changes?: number };
    return { success: true, meta: { changes: result.changes ?? 0 } };
  }
}

function loadSql(relativePath: string): string {
  return readFileSync(join(import.meta.dir, relativePath), "utf8");
}

class MemoryChallengeStore {
  private readonly recordsByDeviceCode = new Map<string, DeviceCodeRecord>();
  private readonly deviceCodeByUserCode = new Map<string, string>();

  fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const pathname = new URL(url).pathname;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

    if (pathname === "/device/set") {
      const record = body.record as DeviceCodeRecord;
      this.recordsByDeviceCode.set(record.deviceCode, record);
      this.deviceCodeByUserCode.set(record.userCode, record.deviceCode);
      return Response.json({ ok: true });
    }

    if (pathname === "/device/poll") {
      const deviceCode = String(body.deviceCode ?? "");
      const record = this.recordsByDeviceCode.get(deviceCode) ?? null;
      if (record && Date.now() > record.expiresAt) {
        this.recordsByDeviceCode.delete(deviceCode);
        this.deviceCodeByUserCode.delete(record.userCode);
        return Response.json({ record: null });
      }
      return Response.json({ record });
    }

    if (pathname === "/device/authorise") {
      const userCode = String(body.userCode ?? "");
      const userId = String(body.userId ?? "");
      const deviceCode = this.deviceCodeByUserCode.get(userCode);
      if (!deviceCode) {
        return Response.json({ ok: false, error: "expired" });
      }
      const record = this.recordsByDeviceCode.get(deviceCode);
      if (!record || Date.now() > record.expiresAt) {
        this.recordsByDeviceCode.delete(deviceCode);
        if (record) this.deviceCodeByUserCode.delete(record.userCode);
        return Response.json({ ok: false, error: "expired" });
      }
      const updated: DeviceCodeRecord = { ...record, status: "authorised", userId };
      this.recordsByDeviceCode.set(deviceCode, updated);
      return Response.json({ ok: true });
    }

    if (pathname === "/device/consume") {
      const deviceCode = String(body.deviceCode ?? "");
      const record = this.recordsByDeviceCode.get(deviceCode) ?? null;
      if (!record || record.status !== "authorised") {
        return Response.json({ record: null });
      }
      this.recordsByDeviceCode.delete(deviceCode);
      this.deviceCodeByUserCode.delete(record.userCode);
      return Response.json({ record });
    }

    return new Response("not found", { status: 404 });
  };

  authoriseDeviceCode(deviceCode: string, userId: string): void {
    const record = this.recordsByDeviceCode.get(deviceCode);
    if (!record) {
      throw new Error(`Missing device record for ${deviceCode}`);
    }
    this.recordsByDeviceCode.set(deviceCode, { ...record, status: "authorised", userId });
  }

  hasDeviceCode(deviceCode: string): boolean {
    return this.recordsByDeviceCode.has(deviceCode);
  }
}

function createTestContext(): { env: AuthEnv; challengeStore: MemoryChallengeStore } {
  const sqlite = new Database(":memory:");
  sqlite.exec(loadSql("../../../../migrations/001_create_tables.sql"));
  sqlite.exec(loadSql("../../../../migrations/002_totp_factors.sql"));
  sqlite.exec(loadSql("../../../../migrations/003_anchor_sessions.sql"));

  const db = {
    prepare: (query: string) => new TestPreparedStatement(sqlite, query),
  } as unknown as D1Database;

  const challengeStore = new MemoryChallengeStore();
  const challengeNamespace = {
    idFromName: (_name: string) => ({}),
    get: (_id: unknown) => ({
      fetch: challengeStore.fetch,
    }),
  } as unknown as DurableObjectNamespace;

  return {
    env: {
      DB: db,
      PASSKEY_CHALLENGE_DO: challengeNamespace,
      PASSKEY_ORIGIN: "https://app.test",
      CODEX_REMOTE_WEB_JWT_SECRET: "test-web-secret",
      CODEX_REMOTE_ANCHOR_JWT_SECRET: "test-anchor-secret",
    },
    challengeStore,
  };
}

async function callAuth(
  env: AuthEnv,
  path: string,
  init: { method: string; payload?: unknown; token?: string }
): Promise<Response> {
  const headers = new Headers();
  headers.set("origin", "https://app.test");
  if (init.payload !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (init.token) {
    headers.set("authorization", `Bearer ${init.token}`);
  }
  const request = new Request(`https://orbit.test${path}`, {
    method: init.method,
    headers,
    body: init.payload !== undefined ? JSON.stringify(init.payload) : undefined,
  });
  const response = await handleAuthRequest(request, env);
  if (!response) {
    throw new Error("Expected auth response");
  }
  return response;
}

describe("device auth integration", () => {
  test("returns opaque anchor tokens for authorised device codes", async () => {
    const { env, challengeStore } = createTestContext();
    const user = await createUser(env, "alice", "Alice");

    const codeResponse = await callAuth(env, "/auth/device/code", { method: "POST" });
    expect(codeResponse.status).toBe(200);
    const codeData = (await codeResponse.json()) as { deviceCode: string };
    challengeStore.authoriseDeviceCode(codeData.deviceCode, user.id);

    const tokenResponse = await callAuth(env, "/auth/device/token", {
      method: "POST",
      payload: { deviceCode: codeData.deviceCode },
    });
    expect(tokenResponse.status).toBe(200);

    const tokenData = (await tokenResponse.json()) as {
      status: string;
      userId: string;
      anchorAccessToken?: string;
      anchorRefreshToken?: string;
      anchorAccessExpiresIn?: number;
      anchorJwtSecret?: string;
    };

    expect(tokenData.status).toBe("authorised");
    expect(tokenData.userId).toBe(user.id);
    expect(tokenData.anchorAccessToken).toBeString();
    expect(tokenData.anchorRefreshToken).toBeString();
    expect(tokenData.anchorAccessExpiresIn).toBe(60 * 60);
    expect(tokenData.anchorJwtSecret).toBeUndefined();
    expect(challengeStore.hasDeviceCode(codeData.deviceCode)).toBe(false);

    const stored = await getAnchorSessionByAccessToken(env, tokenData.anchorAccessToken!);
    expect(stored).toMatchObject({ userId: user.id });
  });

  test("refreshes only anchor device sessions and rejects web refresh tokens", async () => {
    const { env, challengeStore } = createTestContext();
    const user = await createUser(env, "bob", "Bob");

    const codeResponse = await callAuth(env, "/auth/device/code", { method: "POST" });
    const codeData = (await codeResponse.json()) as { deviceCode: string };
    challengeStore.authoriseDeviceCode(codeData.deviceCode, user.id);

    const issuedResponse = await callAuth(env, "/auth/device/token", {
      method: "POST",
      payload: { deviceCode: codeData.deviceCode },
    });
    const issued = (await issuedResponse.json()) as {
      anchorAccessToken: string;
      anchorRefreshToken: string;
      anchorAccessExpiresIn: number;
      userId: string;
    };

    const rotatedResponse = await callAuth(env, "/auth/device/refresh", {
      method: "POST",
      payload: { refreshToken: issued.anchorRefreshToken },
    });
    expect(rotatedResponse.status).toBe(200);

    const rotated = (await rotatedResponse.json()) as {
      anchorAccessToken: string;
      anchorRefreshToken: string;
      anchorAccessExpiresIn: number;
      userId: string;
    };

    expect(rotated.userId).toBe(user.id);
    expect(rotated.anchorAccessToken).not.toBe(issued.anchorAccessToken);
    expect(rotated.anchorRefreshToken).not.toBe(issued.anchorRefreshToken);
    expect(rotated.anchorAccessExpiresIn).toBe(60 * 60);

    const staleAccess = await getAnchorSessionByAccessToken(env, issued.anchorAccessToken);
    expect(staleAccess).toBeNull();

    const freshAccess = await getAnchorSessionByAccessToken(env, rotated.anchorAccessToken);
    expect(freshAccess).toMatchObject({ userId: user.id });

    const oldRefreshResponse = await callAuth(env, "/auth/device/refresh", {
      method: "POST",
      payload: { refreshToken: issued.anchorRefreshToken },
    });
    expect(oldRefreshResponse.status).toBe(401);

    const webTokens = await createSession(env, user);
    const wrongRefreshResponse = await callAuth(env, "/auth/device/refresh", {
      method: "POST",
      payload: { refreshToken: webTokens.refreshToken },
    });
    expect(wrongRefreshResponse.status).toBe(401);
  });
});
