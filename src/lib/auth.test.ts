import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const STORE_KEY = "__codex_remote_auth_store__";
const STORAGE_KEY = "codex_remote_auth_token";
const REFRESH_STORAGE_KEY = "codex_remote_refresh_token";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalStateDescriptor = Object.getOwnPropertyDescriptor(globalThis, "$state");
const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

let storage: Storage;
let fetchCalls: FetchCall[];
let fetchMock: ReturnType<typeof mock>;
let startRegistrationMock: ReturnType<typeof mock>;
let sessionHasPasskey = false;
let sessionHasTotp = false;

mock.module("@simplewebauthn/browser", () => ({
  startAuthentication: mock(async () => {
    throw new Error("startAuthentication should not be called in this test");
  }),
  startRegistration: (...args: unknown[]) => startRegistrationMock(...args),
}));

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

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

function installFetchMock() {
  fetchCalls = [];
  fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ input, init });
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/auth/session") && method === "GET") {
      return jsonResponse({
        authenticated: true,
        user: { id: "user-1", name: "carol" },
        hasPasskey: sessionHasPasskey,
        hasTotp: sessionHasTotp,
        systemHasUsers: true,
      });
    }

    if (url.endsWith("/auth/totp/setup/options") && method === "POST") {
      return jsonResponse({
        setupToken: "setup-token-next",
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl: "otpauth://totp/Codex%20Remote:carol?secret=JBSWY3DPEHPK3PXP",
      });
    }

    if (url.endsWith("/auth/totp/setup/verify") && method === "POST") {
      return jsonResponse({ verified: true, hasTotp: true });
    }

    if (url.endsWith("/auth/register/options") && method === "POST") {
      return jsonResponse({
        challenge: "challenge",
        rp: { id: "app.test", name: "Codex Remote" },
        user: { id: "dXNlci0x", name: "carol", displayName: "carol" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      });
    }

    if (url.endsWith("/auth/register/verify") && method === "POST") {
      sessionHasPasskey = true;
      return jsonResponse({
        verified: true,
        token: `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`,
        refreshToken: "refresh-next",
        user: { id: "user-1", name: "carol" },
      });
    }

    if (url.endsWith("/auth/refresh") && method === "POST") {
      return jsonResponse({
        token: `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`,
        refreshToken: "refresh-next",
        user: { id: "user-1", name: "carol" },
      });
    }

    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });

  installGlobal("fetch", fetchMock);
}

async function loadAuthModule() {
  clearStoreSingleton();
  const nonce = `${Date.now()}-${Math.random()}`;
  return import(`./auth.svelte.ts?auth-test=${nonce}`);
}

function primeSignedInStore(
  store: {
    status: string;
    user: { id: string; name: string } | null;
    token: string | null;
    hasPasskey: boolean;
    hasTotp: boolean;
  },
  options?: { hasPasskey?: boolean; hasTotp?: boolean }
) {
  store.status = "signed_in";
  store.user = { id: "user-1", name: "carol" };
  store.token = storage.getItem(STORAGE_KEY);
  store.hasPasskey = options?.hasPasskey ?? false;
  store.hasTotp = options?.hasTotp ?? false;
}

beforeEach(() => {
  storage = createLocalStorageMock();
  storage.setItem(STORAGE_KEY, `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`);
  storage.setItem(REFRESH_STORAGE_KEY, "refresh-initial");
  sessionHasPasskey = false;
  sessionHasTotp = false;
  installGlobal("localStorage", storage);
  installGlobal("$state", <T>(value: T) => value);
  installFetchMock();
  startRegistrationMock = mock(async () => ({
    id: "cred-1",
    rawId: "cred-1",
    response: {
      clientDataJSON: "client-data",
      attestationObject: "attestation-object",
      transports: ["internal"],
    },
    type: "public-key",
  }));
});

afterEach(() => {
  clearStoreSingleton();
  restoreGlobal("localStorage", originalLocalStorageDescriptor);
  restoreGlobal("$state", originalStateDescriptor);
  restoreGlobal("fetch", originalFetchDescriptor);
});

describe("auth account methods", () => {
  test("requestAccountTotpRebind only enters confirm state before network calls", async () => {
    sessionHasTotp = true;
    const { AuthStore } = await loadAuthModule();
    const store = new AuthStore();
    primeSignedInStore(store, { hasTotp: true });

    fetchMock.mockClear();
    fetchCalls.length = 0;

    store.requestAccountTotpRebind();

    expect(store.accountTotpFlow).toBe("confirm_rebind");
    expect(store.totpSetup).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("beginAccountTotpSetup requests setup with auth headers", async () => {
    const { AuthStore } = await loadAuthModule();
    const store = new AuthStore();
    primeSignedInStore(store);

    fetchMock.mockClear();
    fetchCalls.length = 0;

    const started = await store.beginAccountTotpSetup();

    expect(started).toBe(true);
    expect(store.accountTotpFlow).toBe("setting_up");
    expect(store.totpSetup?.setupToken).toBe("setup-token-next");
    const setupCall = fetchCalls.find((call) => String(call.input).endsWith("/auth/totp/setup/options"));
    expect(setupCall).toBeTruthy();
    expect(new Headers(setupCall?.init?.headers).get("authorization")).toBe(`Bearer ${store.token}`);
  });

  test("confirmAccountTotpRebind starts setup only after confirmation", async () => {
    sessionHasTotp = true;
    const { AuthStore } = await loadAuthModule();
    const store = new AuthStore();
    primeSignedInStore(store, { hasTotp: true });

    store.requestAccountTotpRebind();
    fetchMock.mockClear();
    fetchCalls.length = 0;

    const started = await store.confirmAccountTotpRebind();

    expect(started).toBe(true);
    expect(store.accountTotpFlow).toBe("setting_up");
    expect(fetchCalls.some((call) => String(call.input).endsWith("/auth/totp/setup/options"))).toBe(true);
  });

  test("completeAccountTotpSetup marks totp configured and stores notice", async () => {
    const { AuthStore } = await loadAuthModule();
    const store = new AuthStore();
    primeSignedInStore(store);

    await store.beginAccountTotpSetup();
    await store.completeAccountTotpSetup("123456");

    expect(store.hasTotp).toBe(true);
    expect(store.accountTotpFlow).toBe("idle");
    expect(store.totpSetup).toBeNull();
    expect(store.accountNotice?.key).toBe("settings.account.notice.totpBound");
  });

  test("addPasskeyForCurrentUser reuses authenticated passkey flow and updates state", async () => {
    const { AuthStore } = await loadAuthModule();
    const store = new AuthStore();
    primeSignedInStore(store);

    await store.addPasskeyForCurrentUser();

    expect(startRegistrationMock).toHaveBeenCalledTimes(1);
    expect(store.hasPasskey).toBe(true);
    expect(store.accountNotice?.key).toBe("settings.account.notice.passkeyBound");
  });

  test("clearAccountNotice removes stale success state", async () => {
    const { AuthStore } = await loadAuthModule();
    const store = new AuthStore();
    primeSignedInStore(store, { hasPasskey: true, hasTotp: true });
    store.accountNotice = { kind: "key", key: "settings.account.notice.totpRebound" };

    store.clearAccountNotice();

    expect(store.accountNotice).toBeNull();
  });
});
