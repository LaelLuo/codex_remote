import { describe, expect, test } from "bun:test";
import { shouldOpenThreadOnRoute } from "./thread-route";

describe("thread route hydration", () => {
  test("opens thread when connected and current thread differs", () => {
    expect(shouldOpenThreadOnRoute("thread-1", "connected", "thread-2", false, false)).toBe(true);
  });

  test("opens thread when current thread matches but has not been hydrated", () => {
    expect(shouldOpenThreadOnRoute("thread-1", "connected", "thread-1", false, false)).toBe(true);
  });

  test("does not open thread when already current and hydrated", () => {
    expect(shouldOpenThreadOnRoute("thread-1", "connected", "thread-1", true, false)).toBe(false);
  });

  test("does not open thread when socket is not connected", () => {
    expect(shouldOpenThreadOnRoute("thread-1", "connecting", null, false, false)).toBe(false);
  });

  test("does not open thread while a resume request is already in flight", () => {
    expect(shouldOpenThreadOnRoute("thread-1", "connected", "thread-1", false, true)).toBe(false);
  });
});
