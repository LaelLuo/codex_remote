import { afterEach, describe, expect, mock, test, vi } from "bun:test";
import {
  isReleaseTerminalStatus,
  normalizeReleaseInspectResult,
  normalizeReleaseStatusResult,
  releaseCheckStatusKey,
  releaseLifecycleLabelKey,
} from "./release-cockpit";

const STORE_KEY = "__codex_remote_release_cockpit_store__";

function resetReleaseCockpitSingleton() {
  delete (globalThis as Record<string, unknown>)[STORE_KEY];
}

async function loadFreshReleaseCockpitModule() {
  const nonce = `${Date.now()}-${Math.random()}`;
  return import(`./release-cockpit.svelte.ts?release-cockpit-test=${nonce}`);
}

afterEach(() => {
  vi.useRealTimers();
  mock.restore();
  resetReleaseCockpitSingleton();
  delete (globalThis as Record<string, unknown>).$state;
});

describe("release parser", () => {
  test("normalizes inspect payload with checks", () => {
    const result = normalizeReleaseInspectResult({
      ready: false,
      branch: "main",
      checks: [
        { id: "git-clean", label: "Git clean", status: "pass" },
        { id: "tests", label: "Tests", status: "fail", message: "2 tests failing" },
      ],
      warnings: ["Tag not provided"],
    });

    expect(result.ready).toBe(false);
    expect(result.branch).toBe("main");
    expect(result.checks.map((item) => item.status)).toEqual(["pass", "fail"]);
    expect(result.notes).toEqual(["Tag not provided"]);
  });

  test("normalizes release status logs/assets", () => {
    const result = normalizeReleaseStatusResult(
      {
        releaseId: "rel-1",
        status: "running",
        logs: [{ id: "l1", ts: "2026-01-01T00:00:00.000Z", level: "info", message: "building" }],
        assets: [{ id: "asset-1", name: "zip", path: "dist/app.zip" }],
      },
      "fallback",
    );

    expect(result.releaseId).toBe("rel-1");
    expect(result.logs).toHaveLength(1);
    expect(result.assets[0].path).toBe("dist/app.zip");
    expect(isReleaseTerminalStatus("completed")).toBe(true);
    expect(isReleaseTerminalStatus("running")).toBe(false);
  });

  test("maps check/status/phase tokens to translatable keys", () => {
    expect(releaseCheckStatusKey("pass")).toBe("release.checkStatus.pass");
    expect(releaseCheckStatusKey("warn")).toBe("release.checkStatus.warn");
    expect(releaseCheckStatusKey("fail")).toBe("release.checkStatus.fail");
    expect(releaseCheckStatusKey("unknown")).toBe("release.checkStatus.unknown");

    expect(releaseLifecycleLabelKey("running")).toBe("release.lifecycle.running");
    expect(releaseLifecycleLabelKey("completed")).toBe("release.lifecycle.completed");
    expect(releaseLifecycleLabelKey("in_progress")).toBe("release.lifecycle.running");
    expect(releaseLifecycleLabelKey("blocked")).toBe("release.lifecycle.blocked");
    expect(releaseLifecycleLabelKey("weird-custom")).toBeNull();
  });
});

describe("release cockpit store", () => {
  test("handles inspect/start/poll transitions and protocol updates", async () => {
    vi.useFakeTimers();

    const protocolHandlers: Array<(msg: Record<string, unknown>) => void> = [];
    let statusCallCount = 0;
    const socket = {
      releaseInspect: mock(async () => ({
        ready: true,
        branch: "main",
        checks: [{ id: "checks", label: "Checks", status: "pass" }],
      })),
      releaseStart: mock(async () => ({
        releaseId: "release-1",
        status: "queued",
        message: "queued",
      })),
      releaseStatus: mock(async () => {
        statusCallCount += 1;
        if (statusCallCount === 1) {
          return {
            releaseId: "release-1",
            status: "running",
            logs: [{ id: "log-1", ts: "2026-01-01T00:00:00.000Z", level: "info", message: "build started" }],
          };
        }
        return {
          releaseId: "release-1",
          status: "completed",
          logs: [{ id: "log-2", ts: "2026-01-01T00:01:00.000Z", level: "info", message: "build done" }],
          assets: [{ id: "asset-1", label: "bundle.zip", path: "dist/bundle.zip" }],
          links: [{ id: "link-1", label: "Release page", href: "https://example.test/release/1" }],
        };
      }),
      onProtocol(handler: (msg: Record<string, unknown>) => void) {
        protocolHandlers.push(handler);
        return () => {};
      },
    };

    Object.defineProperty(globalThis, "$state", {
      value: <T>(value: T) => value,
      configurable: true,
      writable: true,
    });
    mock.module("./socket.svelte", () => ({
      socket,
      getSocketErrorMessage: () => null,
    }));
    resetReleaseCockpitSingleton();

    const { releaseCockpit } = await loadFreshReleaseCockpitModule();

    await releaseCockpit.inspectRelease({ repoPath: "/repo" });
    expect(releaseCockpit.inspect?.ready).toBe(true);
    expect(releaseCockpit.info).toEqual({
      kind: "key",
      key: "release.info.checksPassed",
    });

    await releaseCockpit.startRelease({ repoPath: "/repo", tag: "v1.0.0" });
    expect(releaseCockpit.releaseId).toBe("release-1");
    expect(releaseCockpit.status?.status).toBe("running");
    expect(releaseCockpit.polling).toBe(true);
    expect(releaseCockpit.info).toEqual({
      kind: "key",
      key: "release.info.started",
      params: { releaseId: "release-1" },
    });

    protocolHandlers[0]({
      type: "orbit.multi-dispatch",
      dispatches: [
        {
          channel: "release.logs",
          releaseId: "release-1",
          data: {
            releaseId: "release-1",
            status: "running",
            logs: [{ id: "log-dispatch", ts: "2026-01-01T00:00:30.000Z", level: "info", message: "tests passed" }],
          },
        },
      ],
    });

    expect(releaseCockpit.status?.logs.some((entry) => entry.id === "log-dispatch")).toBe(true);

    await releaseCockpit.pollStatus();
    expect(releaseCockpit.status?.status).toBe("completed");
    expect(releaseCockpit.polling).toBe(false);
    expect(releaseCockpit.status?.assets[0]?.path).toBe("dist/bundle.zip");
  });

  test("uses fallback key messages for inspect/start/status errors", async () => {
    const protocolHandlers: Array<(msg: Record<string, unknown>) => void> = [];
    const socket = {
      releaseInspect: mock(async () => {
        throw {};
      }),
      releaseStart: mock(async () => {
        throw {};
      }),
      releaseStatus: mock(async () => {
        throw {};
      }),
      onProtocol(handler: (msg: Record<string, unknown>) => void) {
        protocolHandlers.push(handler);
        return () => {};
      },
    };

    Object.defineProperty(globalThis, "$state", {
      value: <T>(value: T) => value,
      configurable: true,
      writable: true,
    });
    mock.module("./socket.svelte", () => ({
      socket,
      getSocketErrorMessage: () => null,
    }));
    resetReleaseCockpitSingleton();

    const { releaseCockpit } = await loadFreshReleaseCockpitModule();

    await releaseCockpit.inspectRelease({ repoPath: "/repo" });
    expect(releaseCockpit.error).toEqual({
      kind: "key",
      key: "release.error.inspectFailed",
    });

    await releaseCockpit.startRelease({ repoPath: "/repo" });
    expect(releaseCockpit.error).toEqual({
      kind: "key",
      key: "release.error.startFailed",
    });

    releaseCockpit.releaseId = "release-1";
    await releaseCockpit.pollStatus();
    expect(releaseCockpit.error).toEqual({
      kind: "key",
      key: "release.error.statusLoadFailed",
    });
  });

  test("prefers socket descriptor when release RPC throws structured error", async () => {
    const marker = { message: "marker" };
    const socket = {
      releaseInspect: mock(async () => {
        throw marker;
      }),
      releaseStart: mock(async () => ({
        releaseId: "unused",
        status: "queued",
      })),
      releaseStatus: mock(async () => ({
        releaseId: "unused",
        status: "queued",
      })),
      onProtocol: () => () => {},
    };

    Object.defineProperty(globalThis, "$state", {
      value: <T>(value: T) => value,
      configurable: true,
      writable: true,
    });
    mock.module("./socket.svelte", () => ({
      socket,
      getSocketErrorMessage: (err: unknown) => {
        if (err === marker) {
          return { kind: "key", key: "socket.rpc.timeout" };
        }
        return null;
      },
    }));
    resetReleaseCockpitSingleton();

    const { releaseCockpit } = await loadFreshReleaseCockpitModule();
    await releaseCockpit.inspectRelease({ repoPath: "/repo" });
    expect(releaseCockpit.error).toEqual({
      kind: "key",
      key: "socket.rpc.timeout",
    });
  });
});
