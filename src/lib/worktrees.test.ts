import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const STORE_KEY = "__codex_remote_worktrees_store__";

const gitInspectMock = mock(async () => ({
  isGitRepo: true,
  repoRoot: "/repo",
  currentBranch: "main",
}));
const gitWorktreeListMock = mock(async () => ({
  worktrees: [{ path: "/repo", branch: "main", isMain: true }],
}));
const gitWorktreeCreateMock = mock(async () => ({ path: "/repo/new" }));
const gitWorktreeRemoveMock = mock(async () => ({ removed: true }));
const gitWorktreePruneMock = mock(async () => ({ prunedCount: 0 }));

const socketMock = {
  gitInspect: gitInspectMock,
  gitWorktreeList: gitWorktreeListMock,
  gitWorktreeCreate: gitWorktreeCreateMock,
  gitWorktreeRemove: gitWorktreeRemoveMock,
  gitWorktreePrune: gitWorktreePruneMock,
};

function installSocketMock() {
  mock.module("./socket.svelte", () => ({
    socket: socketMock,
    getSocketErrorMessage: (error: unknown) => {
      if (!error || typeof error !== "object") return null;
      const candidate = error as { uiMessage?: unknown };
      const uiMessage = candidate.uiMessage;
      if (!uiMessage || typeof uiMessage !== "object") return null;
      return uiMessage as { kind: "key" | "text"; key?: string; text?: string };
    },
  }));
}

const originalStateDescriptor = Object.getOwnPropertyDescriptor(globalThis, "$state");

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

async function loadFreshWorktreesModule() {
  clearStoreSingleton();
  const nonce = `${Date.now()}-${Math.random()}`;
  return import(`./worktrees.svelte.ts?worktrees-test=${nonce}`);
}

beforeEach(() => {
  // Other test files may leave a global "./socket.svelte" module mock behind.
  // Reset first so this suite can install its own socket mock shape.
  mock.restore();
  installSocketMock();
  mock.clearAllMocks();
  installGlobal("$state", <T>(value: T) => value);
  clearStoreSingleton();
});

afterEach(() => {
  mock.restore();
  clearStoreSingleton();
  restoreGlobal("$state", originalStateDescriptor);
});

describe("worktrees error messages", () => {
  test("falls back to key descriptor for unknown inspect errors", async () => {
    gitInspectMock.mockRejectedValueOnce({});
    const { worktrees } = await loadFreshWorktreesModule();

    await worktrees.inspect("/repo");

    expect(worktrees.error).toEqual({
      kind: "key",
      key: "worktrees.error.inspectFailed",
    });
  });

  test("uses socket descriptor when inspect throws SocketRpcError-like value", async () => {
    gitInspectMock.mockRejectedValueOnce({
      uiMessage: { kind: "key", key: "socket.rpc.timeout" },
    });
    const { worktrees } = await loadFreshWorktreesModule();

    await worktrees.inspect("/repo");

    expect(worktrees.error).toEqual({
      kind: "key",
      key: "socket.rpc.timeout",
    });
  });

  test("falls back to create key descriptor for unknown create errors", async () => {
    gitWorktreeCreateMock.mockRejectedValueOnce({});
    const { worktrees } = await loadFreshWorktreesModule();
    worktrees.repoRoot = "/repo";

    try {
      await worktrees.create({ path: "/repo/new" });
      throw new Error("Expected create to throw");
    } catch {
      // expected
    }

    expect(worktrees.error).toEqual({
      kind: "key",
      key: "worktrees.error.createFailed",
    });
  });

  test("converts regular Error into text descriptor", async () => {
    const { toWorktreesUiMessage } = await loadFreshWorktreesModule();
    const message = toWorktreesUiMessage(new Error("backend exploded"), "worktrees.error.inspectFailed");

    expect(message).toEqual({
      kind: "text",
      text: "backend exploded",
    });
  });
});
