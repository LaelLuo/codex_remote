import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "..", "..");
const globalCss = readFileSync(resolve(rootDir, "src", "global.css"), "utf8");
const headers = readFileSync(resolve(rootDir, "public", "_headers"), "utf8");

function extractContentSecurityPolicy(source: string): string {
  const match = source.match(/Content-Security-Policy:\s*(.+)/);
  return match?.[1]?.trim() ?? "";
}

describe("font csp compatibility", () => {
  test("allows configured Google Fonts sources when global styles import them", () => {
    const csp = extractContentSecurityPolicy(headers);

    expect(globalCss).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
  });
});
