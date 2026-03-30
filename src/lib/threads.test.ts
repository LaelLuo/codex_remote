import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const STORE_KEY = "__codex_remote_threads_store__";

const socketSendMock = mock(() => ({ success: true as const }));
const socketOnMessageMock = mock(() => () => {});
const socketSubscribeThreadMock = mock(() => ({ success: true as const }));
const socketUnsubscribeThreadMock = mock(() => ({ success: true as const }));

const socketMock = {
  send: socketSendMock,
  onMessage: socketOnMessageMock,
  subscribeThread: socketSubscribeThreadMock,
  unsubscribeThread: socketUnsubscribeThreadMock,
};

const messagesMock = {
  clearThread: mock(() => {}),
};

const modelsMock = {
  defaultModel: { value: "gpt-test" },
  resolveDefaultReasoningEffort: mock(() => "high"),
};

const anchorsMock: {
  list: Array<{ id: string }>;
  selectedId: string | null;
  selected: { id: string } | null;
} = {
  list: [],
  selectedId: null,
  selected: null,
};

const authMock = {
  isLocalMode: false,
};

const navigateMock = mock(() => {});

mock.module("./socket.svelte", () => ({
  socket: socketMock,
  getSocketErrorMessage: () => null,
}));
mock.module("./messages.svelte", () => ({ messages: messagesMock }));
mock.module("./models.svelte", () => ({ models: modelsMock }));
mock.module("./anchors.svelte", () => ({ anchors: anchorsMock }));
mock.module("./auth.svelte", () => ({ auth: authMock }));
mock.module("../router", () => ({ navigate: navigateMock }));

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalStateDescriptor = Object.getOwnPropertyDescriptor(globalThis, "$state");

function createLocalStorageMock(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(String(key), String(value));
    },
  } as Storage;
}

function installGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function restoreGlobal(name: string, descriptor?: PropertyDescriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, name);
}

function clearStoreSingleton() {
  Reflect.deleteProperty(globalThis as Record<string, unknown>, STORE_KEY);
}

async function loadFreshThreadsModule() {
  clearStoreSingleton();
  const nonce = `${Date.now()}-${Math.random()}`;
  return import(`./threads.svelte.ts?threads-test=${nonce}`);
}

beforeEach(() => {
  mock.clearAllMocks();
  installGlobal("localStorage", createLocalStorageMock());
  installGlobal("$state", <T>(value: T) => value);
  clearStoreSingleton();

  authMock.isLocalMode = false;
  anchorsMock.list = [];
  anchorsMock.selectedId = null;
  anchorsMock.selected = null;
});

afterEach(() => {
  clearStoreSingleton();
  restoreGlobal("localStorage", originalLocalStorageDescriptor);
  restoreGlobal("$state", originalStateDescriptor);
});

describe("threads start errors", () => {
  test("returns key descriptor for missing devices", async () => {
    const { getThreadStartErrorMessage, threads } = await loadFreshThreadsModule();

    let thrown: unknown = null;
    try {
      threads.start("C:/repo", "task");
    } catch (error) {
      thrown = error;
    }

    expect(getThreadStartErrorMessage(thrown)).toEqual({
      kind: "key",
      key: "threads.error.noDevicesConnected",
    });
  });

  test("returns key descriptor for missing selected device", async () => {
    anchorsMock.list = [{ id: "anchor-1" }];
    const { getThreadStartErrorMessage, threads } = await loadFreshThreadsModule();

    let thrown: unknown = null;
    try {
      threads.start("C:/repo", "task");
    } catch (error) {
      thrown = error;
    }

    expect(getThreadStartErrorMessage(thrown)).toEqual({
      kind: "key",
      key: "threads.error.selectDeviceBeforeSession",
    });
  });

  test("returns key descriptor for offline selected device", async () => {
    anchorsMock.list = [{ id: "anchor-1" }];
    anchorsMock.selectedId = "anchor-1";
    anchorsMock.selected = null;
    const { getThreadStartErrorMessage, threads } = await loadFreshThreadsModule();

    let thrown: unknown = null;
    try {
      threads.start("C:/repo", "task");
    } catch (error) {
      thrown = error;
    }

    expect(getThreadStartErrorMessage(thrown)).toEqual({
      kind: "key",
      key: "threads.error.selectedDeviceOffline",
    });
  });

  test("preserves key descriptor in onThreadStartFailed callback", async () => {
    const { getThreadStartErrorMessage, threads } = await loadFreshThreadsModule();
    let callbackError: Error | null = null;

    try {
      threads.start("C:/repo", "task", {
        onThreadStartFailed: (error) => {
          callbackError = error;
        },
      });
    } catch {
      // expected
    }

    expect(getThreadStartErrorMessage(callbackError)).toEqual({
      kind: "key",
      key: "threads.error.noDevicesConnected",
    });
  });

  test("returns fallback key descriptor when start send fails without explicit message", async () => {
    anchorsMock.list = [{ id: "anchor-1" }];
    anchorsMock.selectedId = "anchor-1";
    anchorsMock.selected = { id: "anchor-1" };
    socketSendMock.mockReturnValueOnce({ success: false });

    const { getThreadStartErrorMessage, threads } = await loadFreshThreadsModule();

    let thrown: unknown = null;
    try {
      threads.start("C:/repo", "task");
    } catch (error) {
      thrown = error;
    }

    expect(getThreadStartErrorMessage(thrown)).toEqual({
      kind: "key",
      key: "threads.error.failedToStartThread",
    });
  });

  test("returns text descriptor when start send fails with explicit message", async () => {
    anchorsMock.list = [{ id: "anchor-1" }];
    anchorsMock.selectedId = "anchor-1";
    anchorsMock.selected = { id: "anchor-1" };
    socketSendMock.mockReturnValueOnce({ success: false, error: "backend exploded" });

    const { getThreadStartErrorMessage, threads } = await loadFreshThreadsModule();

    let thrown: unknown = null;
    try {
      threads.start("C:/repo", "task");
    } catch (error) {
      thrown = error;
    }

    expect(getThreadStartErrorMessage(thrown)).toEqual({
      kind: "text",
      text: "backend exploded",
    });
  });

  test("preserves text descriptor in onThreadStartFailed callback", async () => {
    anchorsMock.list = [{ id: "anchor-1" }];
    anchorsMock.selectedId = "anchor-1";
    anchorsMock.selected = { id: "anchor-1" };
    socketSendMock.mockReturnValueOnce({ success: false, error: "backend exploded" });
    const { getThreadStartErrorMessage, threads } = await loadFreshThreadsModule();
    let callbackError: Error | null = null;

    try {
      threads.start("C:/repo", "task", {
        onThreadStartFailed: (error) => {
          callbackError = error;
        },
      });
    } catch {
      // expected
    }

    expect(getThreadStartErrorMessage(callbackError)).toEqual({
      kind: "text",
      text: "backend exploded",
    });
  });
});

describe("threads default settings", () => {
  test("uses resolved default reasoning effort when start response omits it", async () => {
    anchorsMock.list = [{ id: "anchor-1" }];
    anchorsMock.selectedId = "anchor-1";
    anchorsMock.selected = { id: "anchor-1" };

    const { threads } = await loadFreshThreadsModule();

    threads.start("C:/repo", "task");

    const startRequest = socketSendMock.mock.calls[0]?.[0] as { id: number } | undefined;
    expect(startRequest?.id).toBeDefined();

    threads.handleMessage({
      id: startRequest!.id,
      result: {
        thread: { id: "thread-1" },
      },
    });

    expect(modelsMock.resolveDefaultReasoningEffort).toHaveBeenCalledWith("gpt-test");
    expect(threads.getSettings("thread-1").reasoningEffort).toBe("high");
  });

  test("persists approval policy and reuses it for the initial turn", async () => {
    anchorsMock.list = [{ id: "anchor-1" }];
    anchorsMock.selectedId = "anchor-1";
    anchorsMock.selected = { id: "anchor-1" };

    const { threads } = await loadFreshThreadsModule();

    threads.start("C:/repo", "task", {
      approvalPolicy: "never",
      sandbox: "danger-full-access",
    });

    const startRequest = socketSendMock.mock.calls[0]?.[0] as { id: number } | undefined;
    expect(startRequest?.params).toMatchObject({
      approvalPolicy: "never",
      sandbox: "danger-full-access",
    });

    threads.handleMessage({
      id: startRequest!.id,
      result: {
        thread: { id: "thread-1" },
        model: "gpt-test",
        reasoningEffort: "medium",
        approvalPolicy: "never",
        sandbox: { type: "dangerFullAccess" },
      },
    });

    expect(threads.getSettings("thread-1")).toMatchObject({
      approvalPolicy: "never",
      sandbox: "danger-full-access",
    });
    expect(threads.isHydrated("thread-1")).toBe(true);

    const turnRequest = socketSendMock.mock.calls[1]?.[0] as
      | { method: string; params: Record<string, unknown> }
      | undefined;
    expect(turnRequest).toMatchObject({
      method: "turn/start",
      params: {
        threadId: "thread-1",
        approvalPolicy: "never",
        sandboxPolicy: { type: "dangerFullAccess" },
      },
    });
  });

  test("hydrates approval policy from thread resume responses", async () => {
    anchorsMock.list = [{ id: "anchor-1" }];
    anchorsMock.selectedId = "anchor-1";
    anchorsMock.selected = { id: "anchor-1" };

    const { threads } = await loadFreshThreadsModule();

    threads.open("thread-1");

    const resumeRequest = socketSendMock.mock.calls[0]?.[0] as { id: number } | undefined;
    threads.handleMessage({
      id: resumeRequest!.id,
      result: {
        thread: { id: "thread-1" },
        model: "gpt-test",
        reasoningEffort: "medium",
        approvalPolicy: "never",
        sandbox: { type: "dangerFullAccess" },
      },
    });

    expect(threads.getSettings("thread-1")).toMatchObject({
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      model: "gpt-test",
      reasoningEffort: "medium",
    });
    expect(threads.isHydrated("thread-1")).toBe(true);
  });
});

describe("threads list pagination", () => {
  test("fetchSessions requests the first page with server search and sort params", async () => {
    const { threads } = await loadFreshThreadsModule();

    threads.fetchSessions({ reset: true, query: "needle", sort: "updated" });

    const firstRequest = socketSendMock.mock.calls[0]?.[0] as
      | {
          id: number;
          method: string;
          params: { cursor: string | null; limit: number; sortKey?: string; searchTerm?: string };
        }
      | undefined;
    expect(firstRequest).toMatchObject({
      method: "thread/list",
      params: {
        cursor: null,
        limit: 25,
        sortKey: "updated_at",
        searchTerm: "needle",
      },
    });
    expect(threads.loading).toBe(true);

    threads.handleMessage({
      id: firstRequest!.id,
      result: {
        data: [{ id: "thread-1", preview: "needle result", createdAt: 300, updatedAt: 400 }],
        nextCursor: null,
      },
    });

    expect(threads.loading).toBe(false);
    expect(threads.loadingMore).toBe(false);
    expect(threads.hasMore).toBe(false);
    expect(threads.list).toEqual([{ id: "thread-1", preview: "needle result", createdAt: 300, updatedAt: 400 }]);
  });

  test("fetchNextSessions appends the next page from nextCursor", async () => {
    const { threads } = await loadFreshThreadsModule();

    threads.fetchSessions({ reset: true, query: "", sort: "newest" });

    const firstRequest = socketSendMock.mock.calls[0]?.[0] as
      | {
          id: number;
          method: string;
          params: { cursor: string | null; limit: number; sortKey?: string; searchTerm?: string };
        }
      | undefined;
    expect(firstRequest).toMatchObject({
      method: "thread/list",
      params: {
        cursor: null,
        limit: 25,
        sortKey: "created_at",
      },
    });

    threads.handleMessage({
      id: firstRequest!.id,
      result: {
        data: [{ id: "thread-1", createdAt: 300, updatedAt: 400 }],
        nextCursor: "cursor-2",
      },
    });

    threads.fetchNextSessions();

    const secondRequest = socketSendMock.mock.calls[1]?.[0] as
      | {
          id: number;
          method: string;
          params: { cursor: string | null; limit: number; sortKey?: string; searchTerm?: string };
        }
      | undefined;
    expect(secondRequest).toMatchObject({
      method: "thread/list",
      params: {
        cursor: "cursor-2",
        limit: 25,
        sortKey: "created_at",
      },
    });
    expect(threads.loadingMore).toBe(true);

    threads.handleMessage({
      id: secondRequest!.id,
      result: {
        data: [{ id: "thread-2", createdAt: 200, updatedAt: 250 }],
        nextCursor: null,
      },
    });

    expect(threads.loading).toBe(false);
    expect(threads.loadingMore).toBe(false);
    expect(threads.hasMore).toBe(false);
    expect(threads.list).toEqual([
      { id: "thread-1", createdAt: 300, updatedAt: 400 },
      { id: "thread-2", createdAt: 200, updatedAt: 250 },
    ]);
  });

  test("search mode keeps loading pages until local filtering finds matches", async () => {
    const { threads } = await loadFreshThreadsModule();

    threads.fetchSessions({ reset: true, query: "needle", sort: "updated" });

    const firstRequest = socketSendMock.mock.calls[0]?.[0] as
      | {
          id: number;
          method: string;
          params: { cursor: string | null; limit: number; sortKey?: string; searchTerm?: string };
        }
      | undefined;

    threads.handleMessage({
      id: firstRequest!.id,
      result: {
        data: [{ id: "thread-1", preview: "alpha", createdAt: 300, updatedAt: 400 }],
        nextCursor: "cursor-2",
      },
    });

    const secondRequest = socketSendMock.mock.calls[1]?.[0] as
      | {
          id: number;
          method: string;
          params: { cursor: string | null; limit: number; sortKey?: string; searchTerm?: string };
        }
      | undefined;
    expect(secondRequest).toMatchObject({
      method: "thread/list",
      params: {
        cursor: "cursor-2",
        limit: 25,
        sortKey: "updated_at",
        searchTerm: "needle",
      },
    });
    expect(threads.list).toEqual([]);
    expect(threads.loading).toBe(true);
    expect(threads.loadingMore).toBe(true);

    threads.handleMessage({
      id: secondRequest!.id,
      result: {
        data: [{ id: "thread-2", preview: "Needle match", createdAt: 200, updatedAt: 250 }],
        nextCursor: null,
      },
    });

    expect(threads.loading).toBe(false);
    expect(threads.loadingMore).toBe(false);
    expect(threads.hasMore).toBe(false);
    expect(threads.list).toEqual([
      { id: "thread-2", preview: "Needle match", createdAt: 200, updatedAt: 250 },
    ]);
  });
});
