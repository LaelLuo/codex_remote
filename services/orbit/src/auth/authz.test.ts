import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Env, Role } from "../types";
import { createAnchorSession, createUser } from "./db";
import { getRoleFromPath, isAuthorised } from "../ws/authz";

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

function createEnv(overrides: Partial<Env> = {}): Env {
  const sqlite = new Database(":memory:");
  sqlite.exec(loadSql("../../../../migrations/001_create_tables.sql"));
  sqlite.exec(loadSql("../../../../migrations/002_totp_factors.sql"));
  sqlite.exec(loadSql("../../../../migrations/003_anchor_sessions.sql"));

  const db = {
    prepare: (query: string) => new TestPreparedStatement(sqlite, query),
  } as unknown as D1Database;

  return {
    CODEX_REMOTE_WEB_JWT_SECRET: "web-secret",
    CODEX_REMOTE_ANCHOR_JWT_SECRET: "",
    DB: db,
    ORBIT_DO: {} as DurableObjectNamespace,
    PASSKEY_CHALLENGE_DO: {} as DurableObjectNamespace,
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
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(signature));
}

async function createJwt(
  secret: string,
  payload: { iss: string; aud: string; exp: number; sub?: string }
): Promise<string> {
  const headerPart = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signaturePart = await signHs256(secret, `${headerPart}.${payloadPart}`);
  return `${headerPart}.${payloadPart}.${signaturePart}`;
}

function createRequest(token: string | null, pathname = "/ws/client"): Request {
  const headers = new Headers();
  if (token !== null) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return new Request(`https://orbit.test${pathname}`, { headers });
}

describe("ws authz", () => {
  test("maps websocket paths to roles with trailing slash normalization", () => {
    expect(getRoleFromPath("/ws/client")).toBe("client");
    expect(getRoleFromPath("/ws/client/")).toBe("client");
    expect(getRoleFromPath("/ws/anchor")).toBe("anchor");
    expect(getRoleFromPath("/ws/anchor///")).toBe("anchor");
    expect(getRoleFromPath("/ws/unknown")).toBeNull();
  });

  test("denies unsupported role values instead of falling back to anchor", async () => {
    const env = createEnv();
    const token = "opaque-anchor-token";
    const result = await isAuthorised(createRequest(token), env, "unexpected-role" as Role);
    expect(result).toEqual({ authorised: false, userId: null, jwtType: null });
  });

  test("denies client auth when client secret is missing", async () => {
    const result = await isAuthorised(createRequest("any-token"), createEnv({ CODEX_REMOTE_WEB_JWT_SECRET: "   " }), "client");
    expect(result).toEqual({ authorised: false, userId: null, jwtType: null });
  });

  test("accepts valid client token", async () => {
    const env = createEnv();
    const token = await createJwt(env.CODEX_REMOTE_WEB_JWT_SECRET as string, {
      iss: "codex-remote-auth",
      aud: "codex-remote-web",
      sub: "user-123",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const result = await isAuthorised(createRequest(token), env, "client");
    expect(result).toEqual({ authorised: true, userId: "user-123", jwtType: "web" });
  });

  test("rejects client token that verifies without a subject", async () => {
    const env = createEnv();
    const token = await createJwt(env.CODEX_REMOTE_WEB_JWT_SECRET as string, {
      iss: "codex-remote-auth",
      aud: "codex-remote-web",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const result = await isAuthorised(createRequest(token), env, "client");
    expect(result).toEqual({ authorised: false, userId: null, jwtType: null });
  });

  test("accepts valid anchor access token without requiring anchor jwt secret", async () => {
    const env = createEnv();
    const user = await createUser(env, "anchor-user", "Anchor User");
    const anchorSession = await createAnchorSession(env, user.id);
    const result = await isAuthorised(createRequest(anchorSession.accessToken, "/ws/anchor"), env, "anchor");
    expect(result).toEqual({ authorised: true, userId: user.id, jwtType: "anchor" });
  });

  test("rejects missing token before verifier calls", async () => {
    const result = await isAuthorised(createRequest(null, "/ws/anchor"), createEnv(), "anchor");
    expect(result).toEqual({ authorised: false, userId: null, jwtType: null });
  });

  test("rejects unknown anchor access token", async () => {
    const result = await isAuthorised(createRequest("missing-token", "/ws/anchor"), createEnv(), "anchor");
    expect(result).toEqual({ authorised: false, userId: null, jwtType: null });
  });
});
