import { decodeMermaidSource } from "./render-markdown";

type MermaidNode = {
  dataset: DOMStringMap & Record<string, string>;
  innerHTML: string;
};

type MermaidContainer = {
  querySelectorAll: (selector: string) => ArrayLike<MermaidNode>;
};

type MermaidRenderResult = {
  svg: string;
  bindFunctions?: (element: Element) => void;
};

type MermaidRuntime = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, source: string) => Promise<MermaidRenderResult>;
};

let mermaidRenderCount = 0;
let mermaidRuntimePromise: Promise<MermaidRuntime> | null = null;

function nextMermaidRenderId(): string {
  mermaidRenderCount += 1;
  return `md-mermaid-${mermaidRenderCount}`;
}

async function loadMermaidRuntime(): Promise<MermaidRuntime> {
  if (!mermaidRuntimePromise) {
    mermaidRuntimePromise = import("mermaid").then((module) => module.default as MermaidRuntime);
  }

  return mermaidRuntimePromise;
}

function escapeHtml(source: string): string {
  return source
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildMermaidFallback(source: string): string {
  return `<div class="md-mermaid-fallback"><pre><code>${escapeHtml(source)}</code></pre></div>`;
}

function getRenderedTheme(node: MermaidNode): string {
  return node.dataset.mermaidTheme ?? "";
}

export function resolveMermaidTheme(): "default" | "dark" {
  if (typeof document === "undefined") {
    return "default";
  }

  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default";
}

export async function enhanceMermaid(
  container: MermaidContainer,
  runtime?: MermaidRuntime,
): Promise<void> {
  const nodes = Array.from(container.querySelectorAll(".md-mermaid[data-mermaid-source]"));
  if (nodes.length === 0) return;

  const theme = resolveMermaidTheme();
  const resolvedRuntime = runtime ?? await loadMermaidRuntime();
  resolvedRuntime.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme,
  });

  for (const node of nodes) {
    const encodedSource = node.dataset.mermaidSource ?? "";
    const source = decodeMermaidSource(encodedSource);

    if (
      node.dataset.mermaidRendered === "true" &&
      node.dataset.mermaidRenderedSource === encodedSource &&
      getRenderedTheme(node) === theme
    ) {
      continue;
    }

    try {
      const result = await resolvedRuntime.render(nextMermaidRenderId(), source);
      node.innerHTML = result.svg;
      node.dataset.mermaidRendered = "true";
      node.dataset.mermaidRenderedSource = encodedSource;
      node.dataset.mermaidTheme = theme;
      if (typeof Element !== "undefined" && node instanceof Element) {
        result.bindFunctions?.(node);
      }
    } catch {
      node.innerHTML = buildMermaidFallback(source);
      node.dataset.mermaidRendered = "fallback";
      node.dataset.mermaidRenderedSource = encodedSource;
      node.dataset.mermaidTheme = theme;
    }
  }
}

export function mermaidEnhancer(node: HTMLElement, _contentKey?: string) {
  let destroyed = false;
  let observer: MutationObserver | null = null;

  const render = async () => {
    if (destroyed) return;
    await enhanceMermaid(node);
  };

  queueMicrotask(() => {
    void render();
  });

  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
    observer = new MutationObserver(() => {
      void render();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-theme-mode"],
    });
  }

  return {
    update(_nextContentKey?: string) {
      void render();
    },
    destroy() {
      destroyed = true;
      observer?.disconnect();
    },
  };
}
