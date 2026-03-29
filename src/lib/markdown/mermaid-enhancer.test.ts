import { afterEach, describe, expect, mock, test } from "bun:test";
import { decodeMermaidSource } from "./render-markdown";
import { enhanceMermaid, resolveMermaidTheme } from "./mermaid-enhancer";

type FakeMermaidNode = {
  dataset: Record<string, string>;
  innerHTML: string;
};

type FakeContainer = {
  querySelectorAll: (selector: string) => FakeMermaidNode[];
};

function createContainer(source: string): { container: FakeContainer; node: FakeMermaidNode } {
  const node: FakeMermaidNode = {
    dataset: { mermaidSource: encodeURIComponent(source) },
    innerHTML: "",
  };

  return {
    node,
    container: {
      querySelectorAll(selector: string) {
        return selector === ".md-mermaid[data-mermaid-source]" ? [node] : [];
      },
    },
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).document;
});

describe("resolveMermaidTheme", () => {
  test("maps dark root theme to dark mermaid theme", () => {
    Object.defineProperty(globalThis, "document", {
      value: {
        documentElement: {
          getAttribute: (name: string) => (name === "data-theme" ? "dark" : null),
        },
      },
      configurable: true,
    });

    expect(resolveMermaidTheme()).toBe("dark");
  });

  test("defaults to neutral theme when no dark root theme is available", () => {
    expect(resolveMermaidTheme()).toBe("default");
  });
});

describe("enhanceMermaid", () => {
  test("renders svg into mermaid placeholders", async () => {
    const { container, node } = createContainer("flowchart TD\nA-->B");
    const initialize = mock(() => {});
    const render = mock(async () => ({ svg: "<svg><text>diagram</text></svg>" }));

    await enhanceMermaid(container, { initialize, render });

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);
    expect(node.innerHTML).toContain("<svg>");
    expect(node.dataset.mermaidRendered).toBe("true");
  });

  test("falls back to pre/code when mermaid render throws", async () => {
    const { container, node } = createContainer("bad graph");
    const render = mock(async () => {
      throw new Error("parse failed");
    });

    await enhanceMermaid(container, { initialize: mock(() => {}), render });

    expect(node.innerHTML).toContain("md-mermaid-fallback");
    expect(node.innerHTML).toContain("<pre><code>");
    expect(node.innerHTML).toContain(decodeMermaidSource(node.dataset.mermaidSource));
  });
});
