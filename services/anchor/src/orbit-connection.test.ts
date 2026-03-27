import { describe, expect, test } from "bun:test";
import {
  ORBIT_HEARTBEAT_INTERVAL_MS,
  ORBIT_HEARTBEAT_TIMEOUT_MS,
  formatOrbitCloseSummary,
  getOrbitReconnectDelayMs,
} from "./orbit-connection";

describe("orbit connection helpers", () => {
  test("uses a less aggressive heartbeat timeout than half-open detection", () => {
    expect(ORBIT_HEARTBEAT_INTERVAL_MS).toBe(30_000);
    expect(ORBIT_HEARTBEAT_TIMEOUT_MS).toBe(20_000);
    expect(ORBIT_HEARTBEAT_TIMEOUT_MS).toBeLessThan(ORBIT_HEARTBEAT_INTERVAL_MS);
  });

  test("grows reconnect delay exponentially and caps it", () => {
    expect(getOrbitReconnectDelayMs(1)).toBe(2_000);
    expect(getOrbitReconnectDelayMs(2)).toBe(4_000);
    expect(getOrbitReconnectDelayMs(3)).toBe(8_000);
    expect(getOrbitReconnectDelayMs(4)).toBe(16_000);
    expect(getOrbitReconnectDelayMs(5)).toBe(30_000);
    expect(getOrbitReconnectDelayMs(9)).toBe(30_000);
  });

  test("formats close events with code and reason", () => {
    const summary = formatOrbitCloseSummary({
      code: 1006,
      reason: "edge reset",
      wasClean: false,
    });

    expect(summary).toBe("code=1006 clean=false reason=edge reset");
  });

  test("formats close events without reason", () => {
    const summary = formatOrbitCloseSummary({
      code: 1000,
      reason: "",
      wasClean: true,
    });

    expect(summary).toBe("code=1000 clean=true");
  });
});
