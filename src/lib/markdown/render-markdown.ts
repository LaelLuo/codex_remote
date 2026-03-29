import DOMPurify from "dompurify";
import { marked, type Tokens } from "marked";

const fallbackRenderer = new marked.Renderer();
const renderer = new marked.Renderer();

function encodeMermaidSource(source: string): string {
  return encodeURIComponent(source);
}

function renderMermaidPlaceholder(source: string): string {
  return `<div class="md-mermaid" data-mermaid-source="${encodeMermaidSource(source)}"></div>`;
}

function stripEventHandlerAttributes(html: string): string {
  return html.replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
}

function stripUnsafeScriptTags(html: string): string {
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function stripJavascriptUrls(html: string): string {
  return html.replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "");
}

function fallbackSanitize(html: string): string {
  return stripJavascriptUrls(stripEventHandlerAttributes(stripUnsafeScriptTags(html)));
}

function sanitizeHtml(html: string): string {
  if (typeof DOMPurify.sanitize === "function") {
    return DOMPurify.sanitize(html);
  }

  // Bun tests run without a browser DOM, so DOMPurify cannot bootstrap there.
  return fallbackSanitize(html);
}

renderer.code = (token: Tokens.Code): string => {
  if ((token.lang ?? "").trim().toLowerCase() !== "mermaid") {
    return fallbackRenderer.code(token);
  }

  return renderMermaidPlaceholder(token.text);
};

export function renderMarkdown(source: string, options?: { breaks?: boolean }): string {
  return sanitizeHtml(
    marked.parse(source, {
      async: false,
      breaks: options?.breaks ?? true,
      renderer,
    }) as string,
  );
}

export function decodeMermaidSource(source: string): string {
  return decodeURIComponent(source);
}
