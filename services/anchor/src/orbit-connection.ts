export const ORBIT_HEARTBEAT_INTERVAL_MS = 30_000;
export const ORBIT_HEARTBEAT_TIMEOUT_MS = 20_000;
export const ORBIT_RECONNECT_BASE_DELAY_MS = 2_000;
export const ORBIT_RECONNECT_MAX_DELAY_MS = 30_000;

export interface OrbitCloseSummary {
  code?: number;
  reason?: string;
  wasClean?: boolean;
}

export function getOrbitReconnectDelayMs(attempt: number): number {
  const normalizedAttempt = Math.max(1, Math.trunc(attempt));
  const exponential = ORBIT_RECONNECT_BASE_DELAY_MS * (2 ** (normalizedAttempt - 1));
  return Math.min(exponential, ORBIT_RECONNECT_MAX_DELAY_MS);
}

export function formatOrbitCloseSummary(event: OrbitCloseSummary | null | undefined): string {
  const code = typeof event?.code === "number" ? event.code : 0;
  const clean = typeof event?.wasClean === "boolean" ? event.wasClean : false;
  const reason = typeof event?.reason === "string" ? event.reason.trim() : "";
  return reason ? `code=${code} clean=${clean} reason=${reason}` : `code=${code} clean=${clean}`;
}
