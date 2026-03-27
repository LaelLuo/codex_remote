import type { GitWorktree } from "./types";
import { anchors } from "./anchors.svelte";
import { auth } from "./auth.svelte";
import { getSocketErrorMessage, socket, type SocketErrorMessage } from "./socket.svelte";

const STORE_KEY = "__codex_remote_worktrees_store__";

export type WorktreesUiMessage = SocketErrorMessage;

export function toWorktreesUiMessage(error: unknown, fallbackKey: string): WorktreesUiMessage {
  const socketMessage = getSocketErrorMessage(error);
  if (socketMessage) return socketMessage;
  if (error instanceof Error && error.message.trim()) {
    return { kind: "text", text: error.message };
  }
  if (typeof error === "string" && error.trim()) {
    return { kind: "text", text: error };
  }
  return { kind: "key", key: fallbackKey };
}

export function renderWorktreesUiMessage(
  message: WorktreesUiMessage | null,
  translate: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!message) return "";
  if (message.kind === "text") return message.text;
  return translate(message.key, message.params);
}

export function resolveWorktreeAnchorId(): string | null {
  if (auth.isLocalMode) return null;
  return anchors.selectedId;
}

class WorktreesStore {
  projectPath = $state("");
  repoRoot = $state<string | null>(null);
  worktrees = $state<GitWorktree[]>([]);
  selectedWorktreePath = $state("");
  currentBranch = $state<string | null>(null);
  loading = $state(false);
  mutating = $state(false);
  error = $state<WorktreesUiMessage | null>(null);
  #inspectRequestId = 0;

  get isGitRepo() {
    return Boolean(this.repoRoot);
  }

  async inspect(path: string) {
    const normalized = path.trim();
    const requestId = ++this.#inspectRequestId;
    this.projectPath = normalized;
    this.error = null;

    if (!normalized) {
      if (requestId !== this.#inspectRequestId) return;
      this.repoRoot = null;
      this.worktrees = [];
      this.selectedWorktreePath = "";
      this.currentBranch = null;
      return;
    }

    this.loading = true;
    try {
      const anchorId = resolveWorktreeAnchorId();
      const inspect = await socket.gitInspect(normalized, anchorId ?? undefined);
      if (requestId !== this.#inspectRequestId) return;
      if (!inspect.isGitRepo || !inspect.repoRoot) {
        this.repoRoot = null;
        this.worktrees = [];
        this.selectedWorktreePath = normalized;
        this.currentBranch = null;
        return;
      }

      const repoRoot = inspect.repoRoot;
      const currentBranch = inspect.currentBranch ?? null;
      await this.#loadWorktrees(repoRoot, normalized, requestId);
      if (requestId !== this.#inspectRequestId) return;
      this.repoRoot = repoRoot;
      this.currentBranch = currentBranch;
    } catch (err) {
      if (requestId !== this.#inspectRequestId) return;
      this.error = toWorktreesUiMessage(err, "worktrees.error.inspectFailed");
      this.repoRoot = null;
      this.worktrees = [];
      this.selectedWorktreePath = normalized;
      this.currentBranch = null;
    } finally {
      if (requestId !== this.#inspectRequestId) return;
      this.loading = false;
    }
  }

  async refresh() {
    if (!this.repoRoot) return;
    this.loading = true;
    this.error = null;
    try {
      await this.#loadWorktrees(this.repoRoot, this.selectedWorktreePath || this.projectPath);
    } catch (err) {
      this.error = toWorktreesUiMessage(err, "worktrees.error.refreshFailed");
    } finally {
      this.loading = false;
    }
  }

  select(path: string) {
    const trimmed = path.trim();
    if (!trimmed) return;
    this.selectedWorktreePath = trimmed;
    this.projectPath = trimmed;
  }

  async create(options?: { baseRef?: string; path?: string; rootDir?: string }) {
    if (!this.repoRoot) return;
    this.mutating = true;
    this.error = null;
    try {
      const baseRef = options?.baseRef?.trim();
      const path = options?.path?.trim();
      const rootDir = options?.rootDir?.trim();
      const anchorId = resolveWorktreeAnchorId();
      const created = await socket.gitWorktreeCreate({
        repoRoot: this.repoRoot,
        ...(anchorId ? { anchorId } : {}),
        ...(baseRef ? { baseRef } : {}),
        ...(path ? { path } : {}),
        ...(rootDir ? { rootDir } : {}),
      });
      await this.#loadWorktrees(this.repoRoot, created.path);
      this.selectedWorktreePath = created.path;
      this.projectPath = created.path;
    } catch (err) {
      this.error = toWorktreesUiMessage(err, "worktrees.error.createFailed");
      throw err;
    } finally {
      this.mutating = false;
    }
  }

  async remove(path: string, force = false) {
    if (!this.repoRoot) return;
    this.mutating = true;
    this.error = null;
    try {
      const anchorId = resolveWorktreeAnchorId();
      await socket.gitWorktreeRemove(this.repoRoot, path, force, anchorId ?? undefined);
      const fallback = this.repoRoot;
      await this.#loadWorktrees(this.repoRoot, fallback);
      if (!this.worktrees.find((wt) => wt.path === this.selectedWorktreePath)) {
        const main = this.worktrees.find((wt) => wt.isMain);
        const nextPath = main?.path || this.worktrees[0]?.path || fallback;
        this.selectedWorktreePath = nextPath;
        this.projectPath = nextPath;
      }
    } catch (err) {
      this.error = toWorktreesUiMessage(err, "worktrees.error.removeFailed");
      throw err;
    } finally {
      this.mutating = false;
    }
  }

  async prune() {
    if (!this.repoRoot) return 0;
    this.mutating = true;
    this.error = null;
    try {
      const anchorId = resolveWorktreeAnchorId();
      const result = await socket.gitWorktreePrune(this.repoRoot, anchorId ?? undefined);
      await this.#loadWorktrees(this.repoRoot, this.selectedWorktreePath || this.projectPath);
      return result.prunedCount;
    } catch (err) {
      this.error = toWorktreesUiMessage(err, "worktrees.error.pruneFailed");
      throw err;
    } finally {
      this.mutating = false;
    }
  }

  async #loadWorktrees(repoRoot: string, preferredPath: string, requestId?: number) {
    const anchorId = resolveWorktreeAnchorId();
    const result = await socket.gitWorktreeList(repoRoot, anchorId ?? undefined);
    if (requestId != null && requestId !== this.#inspectRequestId) return;
    this.worktrees = result.worktrees;
    const match = this.worktrees.find((wt) => wt.path === preferredPath);
    const main = this.worktrees.find((wt) => wt.isMain);
    const selected = match?.path || main?.path || this.worktrees[0]?.path || preferredPath;
    this.selectedWorktreePath = selected;
    this.projectPath = selected;
  }
}

function getStore(): WorktreesStore {
  const global = globalThis as Record<string, unknown>;
  if (!global[STORE_KEY]) {
    global[STORE_KEY] = new WorktreesStore();
  }
  return global[STORE_KEY] as WorktreesStore;
}

export const worktrees = getStore();
