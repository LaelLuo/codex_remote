import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const STORE_KEY = "__codex_remote_i18n_store__";
const STORAGE_KEY = "codex_remote_locale";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalStateDescriptor = Object.getOwnPropertyDescriptor(globalThis, "$state");

let storage: Storage;

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

async function loadI18n(savedLocale?: string | null) {
  clearStoreSingleton();
  if (savedLocale === undefined) {
    storage.removeItem(STORAGE_KEY);
  } else if (savedLocale === null) {
    storage.setItem(STORAGE_KEY, "invalid");
  } else {
    storage.setItem(STORAGE_KEY, savedLocale);
  }
  const nonce = `${Date.now()}-${Math.random()}`;
  return import(`./i18n.svelte.ts?i18n-test=${nonce}`);
}

beforeEach(() => {
  storage = createLocalStorageMock();
  installGlobal("localStorage", storage);
  installGlobal("$state", <T>(value: T) => value);
  clearStoreSingleton();
});

afterEach(() => {
  clearStoreSingleton();
  restoreGlobal("localStorage", originalLocalStorageDescriptor);
  restoreGlobal("$state", originalStateDescriptor);
});

describe("i18n store", () => {
  test("defaults to English when no locale is stored", async () => {
    const { i18n } = await loadI18n();
    expect(i18n.current).toBe("en");
    expect(i18n.t("common.settings")).toBe("Settings");
  });

  test("loads persisted zh-CN locale", async () => {
    const { i18n } = await loadI18n("zh-CN");
    expect(i18n.current).toBe("zh-CN");
    expect(i18n.t("common.settings")).toBe("设置");
  });

  test("falls back to English for invalid persisted locale", async () => {
    const { i18n } = await loadI18n(null);
    expect(i18n.current).toBe("en");
  });

  test("persists locale when switching language", async () => {
    const { i18n } = await loadI18n();
    i18n.set("zh-CN");
    expect(storage.getItem(STORAGE_KEY)).toBe("zh-CN");
    expect(i18n.current).toBe("zh-CN");
  });

  test("falls back to English when key is missing in selected locale", async () => {
    const { i18n } = await loadI18n("zh-CN");
    expect(i18n.t("i18n.fallbackOnlyInEnglish")).toBe("English fallback only");
  });

  test("returns key text when translation key does not exist in any locale", async () => {
    const { i18n } = await loadI18n("zh-CN");
    expect(i18n.t("i18n.nonexistent.key")).toBe("i18n.nonexistent.key");
  });

  test("formats dates with current locale", async () => {
    const { i18n } = await loadI18n();
    const sampleDate = new Date("2026-01-02T03:04:05.000Z");
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    };

    expect(i18n.formatDate(sampleDate, options)).toBe(new Intl.DateTimeFormat("en", options).format(sampleDate));

    i18n.set("zh-CN");
    expect(i18n.formatDate(sampleDate, options)).toBe(new Intl.DateTimeFormat("zh-CN", options).format(sampleDate));
  });

  test("localizes theme names for tooltip text", async () => {
    const { i18n } = await loadI18n();
    expect(i18n.themeName("system")).toBe("System");
    expect(i18n.t("common.themeTitle", { theme: i18n.themeName("system") })).toBe("Theme: System");

    i18n.set("zh-CN");
    expect(i18n.themeName("system")).toBe("跟随系统");
    expect(i18n.themeName("light")).toBe("浅色");
    expect(i18n.themeName("dark")).toBe("深色");
    expect(i18n.t("common.themeTitle", { theme: i18n.themeName("system") })).toBe("主题：跟随系统");
  });

  test("translates prompt mode labels", async () => {
    const { i18n } = await loadI18n();
    expect(i18n.t("prompt.mode.code")).toBe("Code");
    expect(i18n.t("prompt.mode.plan")).toBe("Plan");

    i18n.set("zh-CN");
    expect(i18n.t("prompt.mode.code")).toBe("代码");
    expect(i18n.t("prompt.mode.plan")).toBe("规划");
  });

  test("translates review tool title in both locales", async () => {
    const { i18n } = await loadI18n();
    expect(i18n.t("tool.title.review")).toBe("Review");

    i18n.set("zh-CN");
    expect(i18n.t("tool.title.review")).toBe("审查");
  });

  test("translates project picker and worktree modal labels", async () => {
    const { i18n } = await loadI18n();
    expect(i18n.t("projectPicker.browseDirectories")).toBe("Browse directories");
    expect(i18n.t("projectPicker.noSubdirectories")).toBe("No subdirectories");
    expect(i18n.t("worktreeModal.searchStartDirectory")).toBe("Search start directory");
    expect(i18n.t("worktreeModal.gitRepositoryDetected")).toBe("Git repository detected");

    i18n.set("zh-CN");
    expect(i18n.t("projectPicker.browseDirectories")).toBe("浏览目录");
    expect(i18n.t("projectPicker.noSubdirectories")).toBe("没有子目录");
    expect(i18n.t("worktreeModal.searchStartDirectory")).toBe("搜索起始目录");
    expect(i18n.t("worktreeModal.gitRepositoryDetected")).toBe("检测到 Git 仓库");
  });

  test("translates reasoning and socket fallback labels", async () => {
    const { i18n } = await loadI18n();
    expect(i18n.t("reasoning.thinking")).toBe("Thinking...");
    expect(i18n.t("reasoning.thoughtForFewSeconds")).toBe("Thought for a few seconds");
    expect(i18n.t("socket.error.connectionLost")).toBe("Connection lost");
    expect(i18n.t("socket.error.invalidUrl", { url: "bad" })).toBe("Invalid URL: bad");
    expect(i18n.t("socket.error.rpc")).toBe("RPC error");
    expect(i18n.t("socket.send.notConnected")).toBe("Not connected");
    expect(i18n.t("socket.send.failed")).toBe("Failed to send");

    i18n.set("zh-CN");
    expect(i18n.t("reasoning.thinking")).toBe("思考中...");
    expect(i18n.t("reasoning.thoughtForFewSeconds")).toBe("思考了几秒钟");
    expect(i18n.t("socket.error.connectionLost")).toBe("连接已断开");
    expect(i18n.t("socket.error.invalidUrl", { url: "bad" })).toBe("无效 URL：bad");
    expect(i18n.t("socket.error.rpc")).toBe("RPC 错误");
    expect(i18n.t("socket.send.notConnected")).toBe("未连接");
    expect(i18n.t("socket.send.failed")).toBe("发送失败");
  });

  test("translates thread start fallback labels", async () => {
    const { i18n } = await loadI18n();
    expect(i18n.t("threads.error.failedToStartThread")).toBe("Failed to start thread");
    expect(i18n.t("threads.error.noDevicesConnected")).toBe("No devices are connected.");
    expect(i18n.t("threads.error.selectDeviceBeforeSession")).toBe(
      "Select a device in Settings before creating a session.",
    );
    expect(i18n.t("threads.error.selectedDeviceOffline")).toBe(
      "Selected device is offline. Choose another device in Settings.",
    );

    i18n.set("zh-CN");
    expect(i18n.t("threads.error.failedToStartThread")).toBe("启动线程失败");
    expect(i18n.t("threads.error.noDevicesConnected")).toBe("当前没有已连接设备。");
    expect(i18n.t("threads.error.selectDeviceBeforeSession")).toBe("创建会话前请先在设置中选择设备。");
    expect(i18n.t("threads.error.selectedDeviceOffline")).toBe("所选设备离线，请在设置中选择其他设备。");
  });
});
