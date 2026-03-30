import type { AuthEnv } from "./env";
import type { StoredCredential, StoredTotpFactor, StoredUser } from "./types";
import { base64UrlEncode } from "./utils";

interface PasskeyUserRow {
  id: string;
  name: string;
  display_name: string;
}

interface PasskeyCredentialRow {
  id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  device_type: string | null;
  backed_up: number;
}

/**
 * created_at and revoked_at use milliseconds (Date.now()).
 * expires_at and refresh_expires_at use seconds (Unix epoch).
 */
interface AuthSessionRow {
  id: string;
  user_id: string;
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
  refresh_token: string | null;
  refresh_expires_at: number | null;
}

interface AnchorSessionRow {
  id: string;
  user_id: string;
  access_token_hash: string;
  refresh_token_hash: string;
  created_at: number;
  updated_at: number;
  access_expires_at: number;
  refresh_expires_at: number;
  revoked_at: number | null;
}

interface TotpFactorRow {
  user_id: string;
  secret_base32: string;
  digits: number;
  period_sec: number;
  algorithm: string;
  last_used_step: number | null;
}

const ANCHOR_ACCESS_TOKEN_TTL_SEC = 60 * 60;
const ANCHOR_REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;

export interface AnchorSessionTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
}

export interface AnchorSessionLookup {
  sessionId: string;
  userId: string;
}

export interface AnchorSessionRefreshResult extends AnchorSessionTokens {
  userId: string;
}

export function randomUserId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

function randomOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

async function hashOpaqueToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

function parseTransports(value: string | null): StoredCredential["transports"] {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as StoredCredential["transports"];
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function getUserById(env: AuthEnv, userId: string): Promise<StoredUser | null> {
  const row = await env.DB.prepare(
    "SELECT id, name, display_name FROM passkey_users WHERE id = ?"
  )
    .bind(userId)
    .first<PasskeyUserRow>();
  if (!row) return null;
  return { id: row.id, name: row.name, displayName: row.display_name };
}

export async function getUserByName(env: AuthEnv, name: string): Promise<StoredUser | null> {
  const row = await env.DB.prepare(
    "SELECT id, name, display_name FROM passkey_users WHERE name = ?"
  )
    .bind(name)
    .first<PasskeyUserRow>();
  if (!row) return null;
  return { id: row.id, name: row.name, displayName: row.display_name };
}

export async function createUser(env: AuthEnv, name: string, displayName: string): Promise<StoredUser> {
  const user: StoredUser = {
    id: randomUserId(),
    name,
    displayName,
  };

  await env.DB.prepare("INSERT INTO passkey_users (id, name, display_name, created_at) VALUES (?, ?, ?, ?)")
    .bind(user.id, user.name, user.displayName, Date.now())
    .run();

  return user;
}

export async function hasAnyUsers(env: AuthEnv): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 FROM passkey_users LIMIT 1").first();
  return row !== null;
}

export async function listCredentials(env: AuthEnv, userId: string): Promise<StoredCredential[]> {
  const result = await env.DB.prepare(
    "SELECT id, user_id, public_key, counter, transports, device_type, backed_up FROM passkey_credentials WHERE user_id = ? ORDER BY created_at ASC"
  )
    .bind(userId)
    .all<PasskeyCredentialRow>();

  return result.results.map((row) => ({
    id: row.id,
    userId: row.user_id,
    publicKey: row.public_key,
    counter: row.counter,
    transports: parseTransports(row.transports),
    deviceType: row.device_type ?? undefined,
    backedUp: Boolean(row.backed_up),
  }));
}

export async function getCredential(env: AuthEnv, id: string): Promise<StoredCredential | null> {
  const row = await env.DB.prepare(
    "SELECT id, user_id, public_key, counter, transports, device_type, backed_up FROM passkey_credentials WHERE id = ?"
  )
    .bind(id)
    .first<PasskeyCredentialRow>();

  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    publicKey: row.public_key,
    counter: row.counter,
    transports: parseTransports(row.transports),
    deviceType: row.device_type ?? undefined,
    backedUp: Boolean(row.backed_up),
  };
}

export async function upsertCredential(env: AuthEnv, credential: StoredCredential): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO passkey_credentials (id, user_id, public_key, counter, transports, device_type, backed_up, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET public_key = excluded.public_key, counter = excluded.counter, transports = excluded.transports, device_type = excluded.device_type, backed_up = excluded.backed_up, updated_at = excluded.updated_at"
  )
    .bind(
      credential.id,
      credential.userId,
      credential.publicKey,
      credential.counter,
      credential.transports ? JSON.stringify(credential.transports) : null,
      credential.deviceType ?? null,
      credential.backedUp ? 1 : 0,
      Date.now(),
      Date.now()
    )
    .run();
}

export async function updateCounter(env: AuthEnv, id: string, counter: number): Promise<void> {
  await env.DB.prepare("UPDATE passkey_credentials SET counter = ?, updated_at = ? WHERE id = ?")
    .bind(counter, Date.now(), id)
    .run();
}

export async function getTotpFactorByUserId(env: AuthEnv, userId: string): Promise<StoredTotpFactor | null> {
  const row = await env.DB.prepare(
    "SELECT user_id, secret_base32, digits, period_sec, algorithm, last_used_step FROM totp_factors WHERE user_id = ?"
  )
    .bind(userId)
    .first<TotpFactorRow>();

  if (!row) return null;
  const algorithm = row.algorithm.toUpperCase() === "SHA1" ? "SHA1" : "SHA1";
  return {
    userId: row.user_id,
    secretBase32: row.secret_base32,
    digits: row.digits,
    periodSec: row.period_sec,
    algorithm,
    lastUsedStep: row.last_used_step ?? null,
  };
}

export async function upsertTotpFactor(env: AuthEnv, factor: StoredTotpFactor): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO totp_factors (user_id, secret_base32, digits, period_sec, algorithm, last_used_step, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET secret_base32 = excluded.secret_base32, digits = excluded.digits, period_sec = excluded.period_sec, algorithm = excluded.algorithm, last_used_step = excluded.last_used_step, updated_at = excluded.updated_at"
  )
    .bind(
      factor.userId,
      factor.secretBase32,
      factor.digits,
      factor.periodSec,
      factor.algorithm,
      factor.lastUsedStep,
      Date.now(),
      Date.now()
    )
    .run();
}

export async function consumeTotpStep(env: AuthEnv, userId: string, step: number): Promise<boolean> {
  const row = await env.DB.prepare(
    "UPDATE totp_factors SET last_used_step = ?, updated_at = ? WHERE user_id = ? AND (last_used_step IS NULL OR last_used_step < ?) RETURNING user_id"
  )
    .bind(step, Date.now(), userId, step)
    .first<{ user_id: string }>();
  return Boolean(row?.user_id);
}

/**
 * Stores a session record. The refreshTokenHash should be the SHA-256 hash
 * of the raw refresh token (only the hash is persisted).
 */
export async function createSessionRecord(
  env: AuthEnv,
  sessionId: string,
  userId: string,
  expiresAt: number,
  refreshTokenHash: string,
  refreshExpiresAt: number
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO auth_sessions (id, user_id, created_at, expires_at, revoked_at, refresh_token, refresh_expires_at) VALUES (?, ?, ?, ?, NULL, ?, ?)"
  )
    .bind(sessionId, userId, Date.now(), expiresAt, refreshTokenHash, refreshExpiresAt)
    .run();
}

export async function getSessionRecord(env: AuthEnv, sessionId: string): Promise<AuthSessionRow | null> {
  return await env.DB.prepare("SELECT id, user_id, created_at, expires_at, revoked_at, refresh_token, refresh_expires_at FROM auth_sessions WHERE id = ?")
    .bind(sessionId)
    .first<AuthSessionRow>();
}

export async function revokeSession(env: AuthEnv, sessionId: string): Promise<void> {
  await env.DB.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
    .bind(Date.now(), sessionId)
    .run();
}

/**
 * Atomically consume a refresh token: find the session, revoke it, and return
 * the old row. The UPDATE ... WHERE ensures only one concurrent caller wins.
 */
export async function consumeRefreshToken(
  env: AuthEnv,
  refreshTokenHash: string,
  nowSec: number
): Promise<AuthSessionRow | null> {
  const row = await env.DB.prepare(
    "UPDATE auth_sessions SET revoked_at = ? WHERE refresh_token = ? AND revoked_at IS NULL AND refresh_expires_at > ? RETURNING id, user_id, created_at, expires_at, revoked_at, refresh_token, refresh_expires_at"
  )
    .bind(Date.now(), refreshTokenHash, nowSec)
    .first<AuthSessionRow>();
  return row ?? null;
}

export async function createAnchorSession(env: AuthEnv, userId: string): Promise<AnchorSessionTokens> {
  const accessToken = randomOpaqueToken();
  const refreshToken = randomOpaqueToken();
  const [accessTokenHash, refreshTokenHash] = await Promise.all([
    hashOpaqueToken(accessToken),
    hashOpaqueToken(refreshToken),
  ]);
  const createdAt = Date.now();
  const issuedAtSec = nowSec();
  const accessExpiresAt = issuedAtSec + ANCHOR_ACCESS_TOKEN_TTL_SEC;
  const refreshExpiresAt = issuedAtSec + ANCHOR_REFRESH_TOKEN_TTL_SEC;

  await env.DB.prepare(
    "INSERT INTO anchor_sessions (id, user_id, access_token_hash, refresh_token_hash, created_at, updated_at, access_expires_at, refresh_expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)"
  )
    .bind(
      randomUserId(),
      userId,
      accessTokenHash,
      refreshTokenHash,
      createdAt,
      createdAt,
      accessExpiresAt,
      refreshExpiresAt
    )
    .run();

  return {
    accessToken,
    refreshToken,
    accessExpiresIn: ANCHOR_ACCESS_TOKEN_TTL_SEC,
  };
}

export async function getAnchorSessionByAccessToken(
  env: AuthEnv,
  accessToken: string
): Promise<AnchorSessionLookup | null> {
  const accessTokenHash = await hashOpaqueToken(accessToken);
  const row = await env.DB.prepare(
    "SELECT id, user_id FROM anchor_sessions WHERE access_token_hash = ? AND revoked_at IS NULL AND access_expires_at > ?"
  )
    .bind(accessTokenHash, nowSec())
    .first<{ id: string; user_id: string }>();

  if (!row) return null;
  return { sessionId: row.id, userId: row.user_id };
}

export async function ensureAnchorSessionStorageReady(env: AuthEnv): Promise<void> {
  await env.DB.prepare("SELECT id FROM anchor_sessions LIMIT 1").first<{ id: string }>();
}

export async function rotateAnchorRefreshSession(
  env: AuthEnv,
  refreshToken: string
): Promise<AnchorSessionRefreshResult | null> {
  const newAccessToken = randomOpaqueToken();
  const newRefreshToken = randomOpaqueToken();
  const [previousRefreshTokenHash, nextAccessTokenHash, nextRefreshTokenHash] = await Promise.all([
    hashOpaqueToken(refreshToken),
    hashOpaqueToken(newAccessToken),
    hashOpaqueToken(newRefreshToken),
  ]);
  const updatedAt = Date.now();
  const rotatedAtSec = nowSec();
  const accessExpiresAt = rotatedAtSec + ANCHOR_ACCESS_TOKEN_TTL_SEC;
  const refreshExpiresAt = rotatedAtSec + ANCHOR_REFRESH_TOKEN_TTL_SEC;

  const row = await env.DB.prepare(
    "UPDATE anchor_sessions SET access_token_hash = ?, refresh_token_hash = ?, updated_at = ?, access_expires_at = ?, refresh_expires_at = ? WHERE refresh_token_hash = ? AND revoked_at IS NULL AND refresh_expires_at > ? RETURNING id, user_id, access_token_hash, refresh_token_hash, created_at, updated_at, access_expires_at, refresh_expires_at, revoked_at"
  )
    .bind(
      nextAccessTokenHash,
      nextRefreshTokenHash,
      updatedAt,
      accessExpiresAt,
      refreshExpiresAt,
      previousRefreshTokenHash,
      rotatedAtSec
    )
    .first<AnchorSessionRow>();

  if (!row) return null;
  return {
    userId: row.user_id,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    accessExpiresIn: Math.max(row.access_expires_at - rotatedAtSec, 0),
  };
}
