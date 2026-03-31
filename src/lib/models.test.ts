import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const socketSendMock = mock(() => ({ success: true as const }));
const socketReadCodexConfigMock = mock(async () => ({ content: "" }));
const socketMessageHandlers: Array<(msg: Record<string, unknown>) => void> = [];
const socketConnectHandlers: Array<() => void> = [];
const anchorSelectionHandlers: Array<(anchorId: string | null) => void> = [];

const socketMock = {
  status: "connected",
  send: socketSendMock,
  readCodexConfig: socketReadCodexConfigMock,
  onMessage: mock((handler: (msg: Record<string, unknown>) => void) => {
    socketMessageHandlers.push(handler);
    return () => {};
  }),
  onConnect: mock((handler: () => void) => {
    socketConnectHandlers.push(handler);
    return () => {};
  }),
};

const anchorsMock: {
  selectedId: string | null;
  selected: { id: string } | null;
  onSelectionChange: (handler: (anchorId: string | null) => void) => () => void;
} = {
  selectedId: "anchor-1",
  selected: null,
  onSelectionChange(handler: (anchorId: string | null) => void) {
    anchorSelectionHandlers.push(handler);
    handler(anchorsMock.selectedId);
    return () => {};
  },
};

const authMock = {
  isLocalMode: false,
};

mock.module("./socket.svelte", () => ({
  socket: socketMock,
  getSocketErrorMessage: () => null,
}));
mock.module("./anchors.svelte", () => ({ anchors: anchorsMock }));
mock.module("./auth.svelte", () => ({ auth: authMock }));

async function loadFreshModelsModule() {
  const nonce = `${Date.now()}-${Math.random()}`;
  return import(`./models.svelte.ts?models-test=${nonce}`);
}

function emitLatestModelList() {
  const request = socketSendMock.mock.calls.at(-1)?.[0] as { id: number } | undefined;
  expect(request?.id).toBeDefined();
  socketMessageHandlers[0]?.({
    id: request!.id,
    result: {
      data: [
        { id: "gpt-5.3-codex", label: "GPT 5.3 Codex", isDefault: true },
        { id: "gpt-5.4", label: "GPT 5.4" },
      ],
    },
  });
}

beforeEach(() => {
  mock.clearAllMocks();
  Object.defineProperty(globalThis, "$state", {
    configurable: true,
    writable: true,
    value: <T>(value: T) => value,
  });
  Object.defineProperty(globalThis, "$derived", {
    configurable: true,
    writable: true,
    value: Object.assign(<T>(value: T) => value, {
      by: <T>(fn: () => T) => fn(),
    }),
  });
  socketMessageHandlers.length = 0;
  socketConnectHandlers.length = 0;
  anchorSelectionHandlers.length = 0;
  anchorsMock.selectedId = "anchor-1";
  anchorsMock.selected = null;
  authMock.isLocalMode = false;
  socketMock.status = "connected";
});

afterEach(() => {
  anchorSelectionHandlers.length = 0;
  socketMessageHandlers.length = 0;
  socketConnectHandlers.length = 0;
  delete (globalThis as Record<string, unknown>).$state;
  delete (globalThis as Record<string, unknown>).$derived;
});

describe("models remote default refresh", () => {
  test("refreshes config defaults when the same selected anchor comes online", async () => {
    socketReadCodexConfigMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        content: 'model = "gpt-5.4"\nmodel_reasoning_effort = "high"',
      });

    const { models } = await loadFreshModelsModule();

    await Promise.resolve();
    emitLatestModelList();

    expect(models.options.map((option) => option.value)).toEqual(["gpt-5.3-codex", "gpt-5.4"]);
    expect(models.configDefaults.model).toBeNull();
    expect(models.configDefaultsStatus).toBe("error");
    expect(socketReadCodexConfigMock).toHaveBeenCalledTimes(1);

    anchorsMock.selected = { id: "anchor-1" };
    anchorSelectionHandlers[0]?.("anchor-1");
    await Promise.resolve();
    emitLatestModelList();

    expect(socketReadCodexConfigMock).toHaveBeenCalledTimes(2);
    expect(models.configDefaults.model).toBe("gpt-5.4");
    expect(models.configDefaultsStatus).toBe("success");
    expect(models.resolveDefaultReasoningEffort("gpt-5.4")).toBe("high");
  });
});
