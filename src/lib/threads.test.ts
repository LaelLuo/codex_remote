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

mock.module("./socket.svelte", () => ({ socket: socketMock }));
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
