import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const STORE_KEY = "__codex_remote_messages_store__";
const socketSendMock = mock(() => ({ success: true as const }));

async function loadFreshMessagesModule() {
  const cacheBust = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return import(`./messages.svelte.ts?test=${cacheBust}`);
}

beforeEach(() => {
  Object.defineProperty(globalThis, "$state", {
    value: <T>(value: T) => value,
    configurable: true,
    writable: true,
  });
  socketSendMock.mockReset();
  socketSendMock.mockImplementation(() => ({ success: true as const }));
  mock.module("./socket.svelte", () => ({
    socket: {
      onMessage: () => () => {},
      send: socketSendMock,
    },
    getSocketErrorMessage: () => null,
  }));
  mock.module("./threads.svelte", () => ({
    threads: {
      currentId: "thread-1",
    },
  }));
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[STORE_KEY];
  delete (globalThis as Record<string, unknown>).$state;
  mock.restore();
});

describe("messages turn terminal handling", () => {
  test("marks turn as Interrupted on turn/cancelled", async () => {
    const { messages } = await loadFreshMessagesModule();
    messages.handleMessage({
      method: "turn/started",
      params: { threadId: "thread-1", turn: { id: "turn-1", status: "InProgress" } },
    });

    messages.handleMessage({
      method: "turn/cancelled",
      params: { threadId: "thread-1", turn: { id: "turn-1", status: "Cancelled" } },
    });

    expect(messages.getThreadTurnStatus("thread-1")).toBe("Interrupted");
  });

  test("marks turn as Failed on turn/failed", async () => {
    const { messages } = await loadFreshMessagesModule();
    messages.handleMessage({
      method: "turn/started",
      params: { threadId: "thread-1", turn: { id: "turn-2", status: "InProgress" } },
    });

    messages.handleMessage({
      method: "turn/failed",
      params: { threadId: "thread-1", turn: { id: "turn-2", status: "Failed" } },
    });

    expect(messages.getThreadTurnStatus("thread-1")).toBe("Failed");
  });

  test("stores structured file-change metadata with line stats", async () => {
    const { messages } = await loadFreshMessagesModule();
    messages.handleMessage({
      method: "item/completed",
      params: {
        threadId: "thread-1",
        item: {
          id: "file-1",
          type: "fileChange",
          changes: [
            {
              path: "src/app.ts",
              diff: [
                "@@ -1,2 +1,3 @@",
                "-const a = 1;",
                "+const a = 2;",
                "+const b = 3;",
              ].join("\n"),
            },
          ],
        },
      },
    });

    const fileMessage = messages.getThreadMessages("thread-1").find((item) => item.id === "file-1");
    expect(fileMessage?.kind).toBe("file");
    expect(fileMessage?.metadata?.linesAdded).toBe(2);
    expect(fileMessage?.metadata?.linesRemoved).toBe(1);
    expect(fileMessage?.metadata?.fileChanges?.[0]?.path).toBe("src/app.ts");
  });

  test("interrupt returns descriptor when socket send fails", async () => {
    socketSendMock.mockReturnValueOnce({
      success: false,
      errorMessage: { kind: "key", key: "socket.send.notConnected" },
    });
    const { messages } = await loadFreshMessagesModule();
    messages.handleMessage({
      method: "turn/started",
      params: { threadId: "thread-1", turn: { id: "turn-3", status: "InProgress" } },
    });

    const result = messages.interrupt("thread-1");
    expect(result.success).toBe(false);
    expect(result.errorMessage).toEqual({
      kind: "key",
      key: "socket.send.notConnected",
    });
  });

  test("stores approval fallback as key descriptor instead of fixed English text", async () => {
    const { messages } = await loadFreshMessagesModule();
    messages.handleMessage({
      id: 99,
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: "thread-1",
        itemId: "approval-1",
      },
    });

    const approvalMessage = messages.getThreadMessages("thread-1").find((item) => item.id === "approval-approval-1");
    expect(approvalMessage?.approval?.descriptionMessage).toEqual({
      kind: "key",
      key: "approval.description.commandExecutionRequired",
    });
    expect(approvalMessage?.approval?.description).toBe("");
  });

  test("stores tool transcript metadata for localization without English prefixes", async () => {
    const { messages } = await loadFreshMessagesModule();

    messages.handleMessage({
      method: "item/completed",
      params: {
        threadId: "thread-1",
        item: {
          id: "mcp-1",
          type: "mcpToolCall",
          tool: "search_web",
          result: { ok: true },
        },
      },
    });
    messages.handleMessage({
      method: "item/completed",
      params: {
        threadId: "thread-1",
        item: {
          id: "web-1",
          type: "webSearch",
          query: "codex remote",
        },
      },
    });
    messages.handleMessage({
      method: "item/completed",
      params: {
        threadId: "thread-1",
        item: {
          id: "review-1",
          type: "enteredReviewMode",
        },
      },
    });
    messages.handleMessage({
      method: "item/completed",
      params: {
        threadId: "thread-1",
        item: {
          id: "collab-1",
          type: "collabAgentToolCall",
          tool: "spawnAgent",
          receiverThreadIds: ["thread-2"],
          prompt: "Check logs",
          status: "running",
        },
      },
    });
    messages.handleMessage({
      method: "item/completed",
      params: {
        threadId: "thread-1",
        item: {
          id: "compact-1",
          type: "contextCompaction",
        },
      },
    });

    const byId = new Map(messages.getThreadMessages("thread-1").map((item) => [item.id, item]));
    expect(byId.get("mcp-1")?.metadata?.toolName).toBe("search_web");
    expect(byId.get("mcp-1")?.text.startsWith("Tool:")).toBe(false);
    expect(byId.get("web-1")?.metadata?.webQuery).toBe("codex remote");
    expect(byId.get("web-1")?.text).toBe("");
    expect(byId.get("review-1")?.metadata?.reviewState).toBe("started");
    expect(byId.get("review-1")?.text).toBe("");
    expect(byId.get("collab-1")?.metadata?.collabStatus).toBe("running");
    expect(byId.get("compact-1")?.text).toBe("");
  });

  test("hydrates replayed tool items with localization metadata", async () => {
    const { messages } = await loadFreshMessagesModule();

    messages.handleMessage({
      result: {
        thread: {
          id: "thread-1",
          turns: [
            {
              items: [
                {
                  id: "history-web",
                  type: "webSearch",
                  query: "history query",
                },
                {
                  id: "history-review",
                  type: "exitedReviewMode",
                },
              ],
            },
          ],
        },
      },
    });

    const byId = new Map(messages.getThreadMessages("thread-1").map((item) => [item.id, item]));
    expect(byId.get("history-web")?.metadata?.webQuery).toBe("history query");
    expect(byId.get("history-web")?.text).toBe("");
    expect(byId.get("history-review")?.metadata?.reviewState).toBe("completed");
    expect(byId.get("history-review")?.text).toBe("");
  });
});
