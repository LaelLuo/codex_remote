import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { AuthEnv } from "./env";
import { createUser } from "./db";
import * as authDb from "./db";

type CreateAnchorSessionFn = (env: AuthEnv, userId: string) => Promise<{
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
}>;
type GetAnchorSessionByAccessTokenFn = (
  env: AuthEnv,
  accessToken: string
) => Promise<{ sessionId: string; userId: string } | null>;
type RotateAnchorRefreshSessionFn = (
  env: AuthEnv,
  refreshToken: string
) => Promise<{
  userId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
} | null>;

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

function maybeLoadSql(relativePath: string): string | null {
  try {
    return loadSql(relativePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function createTestEnv(): AuthEnv {
  const sqlite = new Database(":memory:");
  sqlite.exec(loadSql("../../../../migrations/001_create_tables.sql"));
  sqlite.exec(loadSql("../../../../migrations/002_totp_factors.sql"));
  const anchorSessionSql = maybeLoadSql("../../../../migrations/003_anchor_sessions.sql");
  if (anchorSessionSql) {
    sqlite.exec(anchorSessionSql);
  }

  const db = {
    prepare: (query: string) => new TestPreparedStatement(sqlite, query),
  } as unknown as D1Database;

  return {
    DB: db,
    PASSKEY_CHALLENGE_DO: {} as DurableObjectNamespace,
    CODEX_REMOTE_WEB_JWT_SECRET: "test-web-secret",
    CODEX_REMOTE_ANCHOR_JWT_SECRET: "test-anchor-secret",
  };
}

const helpers = authDb as {
  createAnchorSession?: CreateAnchorSessionFn;
  getAnchorSessionByAccessToken?: GetAnchorSessionByAccessTokenFn;
  rotateAnchorRefreshSession?: RotateAnchorRefreshSessionFn;
};

describe("anchor session integration", () => {
  test("creates an anchor session and looks it up by access token", async () => {
    const env = createTestEnv();
    const user = await createUser(env, "alice", "Alice");

    expect(typeof helpers.createAnchorSession).toBe("function");
    expect(typeof helpers.getAnchorSessionByAccessToken).toBe("function");
    if (!helpers.createAnchorSession || !helpers.getAnchorSessionByAccessToken) return;

    const session = await helpers.createAnchorSession(env, user.id);
    expect(session.accessToken.length).toBeGreaterThan(10);
    expect(session.refreshToken.length).toBeGreaterThan(10);
    expect(session.accessExpiresIn).toBe(60 * 60);

    const stored = await helpers.getAnchorSessionByAccessToken(env, session.accessToken);
    expect(stored).toMatchObject({ userId: user.id });
  });

  test("rotates anchor refresh tokens and invalidates old tokens", async () => {
    const env = createTestEnv();
    const user = await createUser(env, "bob", "Bob");

    expect(typeof helpers.createAnchorSession).toBe("function");
    expect(typeof helpers.getAnchorSessionByAccessToken).toBe("function");
    expect(typeof helpers.rotateAnchorRefreshSession).toBe("function");
    if (
      !helpers.createAnchorSession ||
      !helpers.getAnchorSessionByAccessToken ||
      !helpers.rotateAnchorRefreshSession
    ) {
      return;
    }

    const original = await helpers.createAnchorSession(env, user.id);
    const rotated = await helpers.rotateAnchorRefreshSession(env, original.refreshToken);

    expect(rotated).not.toBeNull();
    expect(rotated?.userId).toBe(user.id);
    expect(rotated?.accessToken).not.toBe(original.accessToken);
    expect(rotated?.refreshToken).not.toBe(original.refreshToken);
    expect(rotated?.accessExpiresIn).toBe(60 * 60);

    const staleAccess = await helpers.getAnchorSessionByAccessToken(env, original.accessToken);
    expect(staleAccess).toBeNull();

    const currentAccess = await helpers.getAnchorSessionByAccessToken(env, rotated!.accessToken);
    expect(currentAccess).toMatchObject({ userId: user.id });

    const reusedRefresh = await helpers.rotateAnchorRefreshSession(env, original.refreshToken);
    expect(reusedRefresh).toBeNull();
  });
});
