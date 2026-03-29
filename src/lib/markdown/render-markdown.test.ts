import { describe, expect, test } from "bun:test";
import { renderMarkdown } from "./render-markdown";

describe("renderMarkdown", () => {
  test("keeps normal fenced code blocks as pre/code", () => {
    const html = renderMarkdown("```ts\nconst a = 1;\n```");

    expect(html).toContain("<pre><code");
    expect(html).toContain("language-ts");
    expect(html).toContain("const a = 1;");
  });

  test("converts mermaid fences into placeholder nodes", () => {
    const html = renderMarkdown("```mermaid\nflowchart TD\nA-->B\n```");

    expect(html).toContain('class="md-mermaid"');
    expect(html).toContain("data-mermaid-source=");
    expect(html).not.toContain("<pre><code");
  });

  test("sanitizes injected html outside mermaid blocks", () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');

    expect(html).toContain('<img src="x">');
    expect(html).not.toContain("onerror=");
  });
});
