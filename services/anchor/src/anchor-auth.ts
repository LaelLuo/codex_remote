export interface PersistedAnchorCredentials {
  userId?: string;
  anchorId?: string;
  anchorJwtSecret?: string;
  anchorAccessToken?: string;
  anchorRefreshToken?: string;
  anchorAccessExpiresAtMs?: number;
}

export interface NormalizedPersistedAnchorCredentials {
  userId?: string;
  anchorId?: string;
  anchorAccessToken: string;
  anchorRefreshToken: string;
  anchorAccessExpiresAtMs: number;
  hasDeviceTokens: boolean;
}

export interface ParsedDeviceAuthorisationPayload {
  userId: string;
  anchorAccessToken: string;
  anchorRefreshToken: string;
  anchorAccessExpiresIn: number;
}

export type OrbitWsUrlResolution =
  | { ok: true; url: string }
  | { ok: false; kind: "auth" | "config"; detail: string };

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePersistedAnchorCredentials(
  raw: PersistedAnchorCredentials | null | undefined,
): NormalizedPersistedAnchorCredentials {
  const userId = asNonEmptyString(raw?.userId) || undefined;
  const anchorId = asNonEmptyString(raw?.anchorId) || undefined;
  const anchorAccessToken = asNonEmptyString(raw?.anchorAccessToken);
  const anchorRefreshToken = asNonEmptyString(raw?.anchorRefreshToken);
  const hasDeviceTokens = Boolean(anchorAccessToken && anchorRefreshToken);

  return {
    userId,
    anchorId,
    anchorAccessToken: hasDeviceTokens ? anchorAccessToken : "",
    anchorRefreshToken: hasDeviceTokens ? anchorRefreshToken : "",
    anchorAccessExpiresAtMs:
      hasDeviceTokens && typeof raw?.anchorAccessExpiresAtMs === "number" ? raw.anchorAccessExpiresAtMs : 0,
    hasDeviceTokens,
  };
}

export function parseDeviceAuthorisationPayload(raw: Record<string, unknown>): ParsedDeviceAuthorisationPayload | null {
  if (raw.status !== "authorised") return null;

  const userId = asNonEmptyString(raw.userId);
  const anchorAccessToken = asNonEmptyString(raw.anchorAccessToken);
  const anchorRefreshToken = asNonEmptyString(raw.anchorRefreshToken);
  const anchorAccessExpiresIn =
    typeof raw.anchorAccessExpiresIn === "number" && Number.isFinite(raw.anchorAccessExpiresIn)
      ? raw.anchorAccessExpiresIn
      : NaN;

  if (!userId || !anchorAccessToken || !anchorRefreshToken || !Number.isFinite(anchorAccessExpiresIn)) {
    return null;
  }

  return {
    userId,
    anchorAccessToken,
    anchorRefreshToken,
    anchorAccessExpiresIn,
  };
}

export function resolveOrbitWsUrl(orbitUrl: string, accessToken: string): OrbitWsUrlResolution {
  const normalizedUrl = asNonEmptyString(orbitUrl);
  if (!normalizedUrl) {
    return { ok: false, kind: "config", detail: "invalid ANCHOR_ORBIT_URL" };
  }

  try {
    const url = new URL(normalizedUrl);
    const token = asNonEmptyString(accessToken);
    if (!token) {
      return { ok: false, kind: "auth", detail: "missing anchor access token" };
    }
    url.searchParams.set("token", token);
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, kind: "config", detail: "invalid ANCHOR_ORBIT_URL" };
  }
}
