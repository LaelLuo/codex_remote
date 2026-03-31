import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./SandboxPicker.svelte", import.meta.url),
  "utf8",
);

describe("SandboxPicker styling contract", () => {
  test("reuses shared toolbar button and dropdown classes", () => {
    expect(source).toContain('class="dropdown sandbox-picker"');
    expect(source).toContain('class="tool-btn row sandbox-btn"');
    expect(source).toContain('class="dropdown-menu sandbox-menu"');
    expect(source).toContain('class="dropdown-item split sandbox-item"');
  });
});
