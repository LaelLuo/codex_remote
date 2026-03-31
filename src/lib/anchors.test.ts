import { afterEach, describe, expect, mock, test, vi } from "bun:test";

const STORE_KEY = "__codex_remote_anchors_store__";
const SELECTED_STORAGE_KEY = "codex_remote_selected_anchor_id";
const ANCHOR_CHECK_TIMEOUT_MS = 5_000;

function createLocalStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

function resetAnchorsStoreSingleton() {
  const global = globalThis as Record<string, unknown>;
  delete global[STORE_KEY];
}

async function importFreshAnchors() {
  return await import(`./anchors.svelte.ts?test=${Math.random().toString(36).slice(2)}`);
}

afterEach(() => {
  vi.useRealTimers();
  mock.restore();
  resetAnchorsStoreSingleton();
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).localStorage;
  delete (globalThis as Record<string, unknown>).$state;
});

describe("anchors timeout reconciliation", () => {
  test("clears stale list and stale selection when a request times out", async () => {
    vi.useFakeTimers();

    const protocolHandlers: Array<(msg: Record<string, unknown>) => void> = [];
    const socket = {
      isHealthy: true,
      requestAnchors: vi.fn(),
      onConnect(_handler: () => void) {
        return () => {};
      },
      onProtocol(handler: (msg: Record<string, unknown>) => void) {
        protocolHandlers.push(handler);
        return () => {};
      },
    };

    const storage = createLocalStorage();
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true, writable: true });
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
    Object.defineProperty(globalThis, "$state", { value: <T>(value: T) => value, configurable: true, writable: true });

    resetAnchorsStoreSingleton();
    mock.module("./socket.svelte", () => ({
      socket,
      getSocketErrorMessage: () => null,
    }));
    const { anchors } = await importFreshAnchors();

    expect(socket.requestAnchors).toHaveBeenCalledTimes(1);
    expect(protocolHandlers).toHaveLength(1);

    protocolHandlers[0]({
      type: "orbit.anchors",
      anchors: [
        {
          id: "anchor-1",
          hostname: "laptop",
          platform: "linux",
          connectedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(anchors.list.map((anchor) => anchor.id)).toEqual(["anchor-1"]);
    expect(anchors.selectedId).toBe("anchor-1");
    expect(storage.getItem(SELECTED_STORAGE_KEY)).toBe("anchor-1");

    anchors.request();
    expect(anchors.status).toBe("checking");
    expect(socket.requestAnchors).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(ANCHOR_CHECK_TIMEOUT_MS);

    expect(anchors.status).toBe("none");
    expect(anchors.list).toEqual([]);
    expect(anchors.selectedId).toBeNull();
    expect(storage.getItem(SELECTED_STORAGE_KEY)).toBeNull();
  });

  test("keeps the manually selected anchor when it temporarily disconnects", async () => {
    const protocolHandlers: Array<(msg: Record<string, unknown>) => void> = [];
    const socket = {
      isHealthy: true,
      requestAnchors: vi.fn(),
      onConnect(_handler: () => void) {
        return () => {};
      },
      onProtocol(handler: (msg: Record<string, unknown>) => void) {
        protocolHandlers.push(handler);
        return () => {};
      },
    };

    const storage = createLocalStorage();
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true, writable: true });
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
    Object.defineProperty(globalThis, "$state", { value: <T>(value: T) => value, configurable: true, writable: true });

    resetAnchorsStoreSingleton();
    mock.module("./socket.svelte", () => ({
      socket,
      getSocketErrorMessage: () => null,
    }));
    const { anchors } = await importFreshAnchors();

    expect(protocolHandlers).toHaveLength(1);

    protocolHandlers[0]({
      type: "orbit.anchors",
      anchors: [
        {
          id: "anchor-1",
          hostname: "desktop",
          platform: "linux",
          connectedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "anchor-2",
          hostname: "laptop",
          platform: "macos",
          connectedAt: "2026-01-01T00:01:00.000Z",
        },
      ],
    });

    anchors.select("anchor-2");

    expect(anchors.selectedId).toBe("anchor-2");
    expect(storage.getItem(SELECTED_STORAGE_KEY)).toBe("anchor-2");

    protocolHandlers[0]({
      type: "orbit.anchor-disconnected",
      anchorId: "anchor-2",
    });

    expect(anchors.list.map((anchor) => anchor.id)).toEqual(["anchor-1"]);
    expect(anchors.selectedId).toBe("anchor-2");
    expect(storage.getItem(SELECTED_STORAGE_KEY)).toBe("anchor-2");

    protocolHandlers[0]({
      type: "orbit.anchor-connected",
      anchor: {
        id: "anchor-2",
        hostname: "laptop",
        platform: "macos",
        connectedAt: "2026-01-01T00:02:00.000Z",
      },
    });

    expect(anchors.list.map((anchor) => anchor.id)).toEqual(["anchor-1", "anchor-2"]);
    expect(anchors.selectedId).toBe("anchor-2");
    expect(storage.getItem(SELECTED_STORAGE_KEY)).toBe("anchor-2");
  });

  test("notifies selection listeners when the same selected anchor comes back online", async () => {
    const protocolHandlers: Array<(msg: Record<string, unknown>) => void> = [];
    const socket = {
      isHealthy: true,
      requestAnchors: vi.fn(),
      onConnect(_handler: () => void) {
        return () => {};
      },
      onProtocol(handler: (msg: Record<string, unknown>) => void) {
        protocolHandlers.push(handler);
        return () => {};
      },
    };

    const storage = createLocalStorage();
    storage.setItem(SELECTED_STORAGE_KEY, "anchor-1");
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true, writable: true });
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
    Object.defineProperty(globalThis, "$state", { value: <T>(value: T) => value, configurable: true, writable: true });

    resetAnchorsStoreSingleton();
    mock.module("./socket.svelte", () => ({
      socket,
      getSocketErrorMessage: () => null,
    }));
    const { anchors } = await importFreshAnchors();

    const notifications: Array<string | null> = [];
    anchors.onSelectionChange((anchorId) => {
      notifications.push(anchorId);
    });

    expect(notifications).toEqual(["anchor-1"]);

    protocolHandlers[0]({
      type: "orbit.anchor-connected",
      anchor: {
        id: "anchor-1",
        hostname: "desktop",
        platform: "linux",
        connectedAt: "2026-01-01T00:02:00.000Z",
      },
    });

    expect(notifications).toEqual(["anchor-1", "anchor-1"]);
    expect(anchors.selectedId).toBe("anchor-1");
    expect(anchors.selected?.id).toBe("anchor-1");
  });
});
