import { describe, expect, test } from "bun:test";
import {
  getConfiguredCodexExecutablePath,
  resolveCodexExecutable,
} from "./codex-executable";

describe("resolveCodexExecutable", () => {
  test("normalizes an explicit executable override path", () => {
    expect(getConfiguredCodexExecutablePath(undefined)).toBeNull();
    expect(getConfiguredCodexExecutablePath("")).toBeNull();
    expect(getConfiguredCodexExecutablePath("   ")).toBeNull();
    expect(getConfiguredCodexExecutablePath("  /opt/codex/bin/codex  ")).toBe("/opt/codex/bin/codex");
  });

  test("falls back to codex when env value is missing", () => {
    expect(resolveCodexExecutable(undefined)).toBe("codex");
    expect(resolveCodexExecutable("")).toBe("codex");
    expect(resolveCodexExecutable("   ")).toBe("codex");
  });

  test("uses trimmed configured executable path", () => {
    expect(resolveCodexExecutable("  /opt/codex/bin/codex  ")).toBe("/opt/codex/bin/codex");
  });
});
