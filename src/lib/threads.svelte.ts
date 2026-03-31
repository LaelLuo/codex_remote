import type { ApprovalPolicy, CollaborationMode, CollaborationModeMask, ModeKind, ReasoningEffort, SandboxMode, ThreadInfo, RpcMessage, ThreadSettings } from "./types";
import { socket } from "./socket.svelte";
import { messages } from "./messages.svelte";
import { models } from "./models.svelte";
import { anchors } from "./anchors.svelte";
import { auth } from "./auth.svelte";
import { filterSessionsByQuery } from "./session-search";
import { resolveSandboxModeFromPolicy } from "./thread-permissions";
import { buildTurnStartOverrides } from "./thread-turn";
import { navigate } from "../router";

const STORE_KEY = "__codex_remote_threads_store__";
const SETTINGS_STORAGE_KEY = "codex_remote_thread_settings";
const DIRTY_SETTINGS_STORAGE_KEY = "codex_remote_thread_dirty_settings";
const PROJECTS_STORAGE_KEY = "codex_remote_thread_projects";
const DIRTY_SETTING_KEYS: Array<keyof ThreadSettings> = [
  "model",
  "reasoningEffort",
  "approvalPolicy",
  "sandbox",
  "mode",
];

function createDefaultSettings(): ThreadSettings {
  const defaultModel = models.defaultModel?.value ?? "";
  return {
    model: defaultModel,
    reasoningEffort: models.resolveDefaultReasoningEffort(defaultModel),
    approvalPolicy: "on-request",
    sandbox: "workspace-write",
    mode: "code",
  };
}

export type ThreadStartMessage =
  | { kind: "key"; key: string; params?: Record<string, string | number> }
  | { kind: "text"; text: string };

export class ThreadStartError extends Error {
  readonly uiMessage: ThreadStartMessage;

  constructor(uiMessage: ThreadStartMessage, fallbackMessage?: string) {
    super(fallbackMessage ?? (uiMessage.kind === "text" ? uiMessage.text : uiMessage.key));
    this.name = "ThreadStartError";
    this.uiMessage = uiMessage;
  }
}

export function getThreadStartErrorMessage(error: unknown): ThreadStartMessage | null {
  if (error instanceof ThreadStartError) return error.uiMessage;
  return null;
}

interface PendingStart {
  cwd: string | null;
  input: string | null;
  model: string | null;
  approvalPolicy: ApprovalPolicy | null;
  sandbox: SandboxMode | null;
  collaborationMode: CollaborationMode | null;
  suppressNavigation: boolean;
  onThreadStarted: ((threadId: string) => void) | null;
  onThreadStartFailed: ((error: Error) => void) | null;
}

type ThreadListSortMode = "updated" | "newest";

interface PendingListRequest {
  append: boolean;
  cursor: string | null;
  query: string;
  limit: number;
  revision: number;
  sort: ThreadListSortMode;
}

class ThreadsStore {
  list = $state<ThreadInfo[]>([]);
  currentId = $state<string | null>(null);
  loading = $state(false);
  hasMore = $state(false);
  loadingMore = $state(false);

  #settings = $state<Map<string, ThreadSettings>>(new Map());
  #projectByThread = $state<Map<string, string>>(new Map());
  #dirtySettingKeys = new Map<string, Set<keyof ThreadSettings>>();
  #hydratedThreadIds = new Set<string>();
  #openingThreadIds = new Set<string>();
  #nextId = 1;
  #pendingRequests = new Map<number, string>();
  #pendingListRequests = new Map<number, PendingListRequest>();
  #pendingStarts = new Map<number, PendingStart>();
  #collaborationPresets: CollaborationModeMask[] = [];
  #threadListCursor: string | null = null;
  #threadListLoaded: ThreadInfo[] = [];
  #threadListQuery = "";
  #threadListRevision = 0;
  #threadListSort: ThreadListSortMode = "updated";

  constructor() {
    this.#loadSettings();
    this.#loadDirtySettingKeys();
    this.#loadProjectPaths();
  }

  getSettings(threadId: string | null): ThreadSettings {
    if (!threadId) return createDefaultSettings();
    const settings = this.#settings.get(threadId);
    return settings ? { ...settings } : createDefaultSettings();
  }

  updateSettings(
    threadId: string,
    update: Partial<ThreadSettings>,
    source: "local" | "remote" = "local",
  ) {
    const current = this.#settings.get(threadId) ?? createDefaultSettings();
    const effectiveUpdate =
      source === "remote" ? this.#filterRemoteSettingsUpdate(threadId, current, update) : update;
    const next: ThreadSettings = { ...current, ...effectiveUpdate };
    if (
      current.model === next.model &&
      current.reasoningEffort === next.reasoningEffort &&
      current.approvalPolicy === next.approvalPolicy &&
      current.sandbox === next.sandbox &&
      current.mode === next.mode
    ) {
      if (source === "local") {
        this.#markDirtySettingKeys(threadId, current, update);
      }
      return;
    }
    this.#settings = new Map(this.#settings).set(threadId, next);
    if (source === "local") {
      this.#markDirtySettingKeys(threadId, current, update);
    }
    this.#saveSettings();
  }

  getProjectPath(threadId: string | null): string {
    if (!threadId) return "";
    return this.#projectByThread.get(threadId) ?? "";
  }

  isHydrated(threadId: string | null): boolean {
    if (!threadId) return false;
    return this.#hydratedThreadIds.has(threadId);
  }

  isOpening(threadId: string | null): boolean {
    if (!threadId) return false;
    return this.#openingThreadIds.has(threadId);
  }

  setProjectPath(threadId: string, path: string) {
    const normalized = path.trim();
    if (!normalized) return;
    const current = this.#projectByThread.get(threadId);
    if (current === normalized) return;
    this.#projectByThread = new Map(this.#projectByThread).set(threadId, normalized);
    this.#saveProjectPaths();
  }

  fetch() {
    this.fetchSessions({ reset: true, query: "", sort: "updated" });
  }

  fetchSessions(options?: { reset?: boolean; query?: string; sort?: ThreadListSortMode }) {
    const query = (options?.query ?? this.#threadListQuery).trim();
    const sort = options?.sort ?? this.#threadListSort;
    const shouldReset = options?.reset === true || query !== this.#threadListQuery || sort !== this.#threadListSort;
    if (!shouldReset && (!this.hasMore || this.loading || this.loadingMore || !this.#threadListCursor)) {
      return;
    }

    if (shouldReset) {
      this.#threadListQuery = query;
      this.#threadListSort = sort;
      this.#threadListCursor = null;
      this.#threadListLoaded = [];
      this.#threadListRevision += 1;
      this.hasMore = false;
      this.list = [];
    }

    this.#requestSessionList({
      append: !shouldReset,
      cursor: shouldReset ? null : this.#threadListCursor,
      query,
      limit: 25,
      revision: this.#threadListRevision,
      sort,
    });
  }

  fetchNextSessions() {
    this.fetchSessions({ reset: false });
  }

  open(threadId: string) {
    if (this.#openingThreadIds.has(threadId)) return;
    const anchorId = this.#resolveAnchorIdForRequest(false);
    const id = this.#nextId++;
    this.#openingThreadIds.add(threadId);
    this.loading = true;
    this.currentId = threadId;
    messages.clearThread(threadId);
    socket.subscribeThread(threadId);
    this.#pendingRequests.set(id, "resume");
    socket.send({
      method: "thread/resume",
      id,
      params: { threadId, ...(anchorId ? { anchorId } : {}) },
    });
  }

  start(
    cwd: string,
    input?: string,
    options?: {
      approvalPolicy?: ApprovalPolicy | string;
      sandbox?: SandboxMode | string;
      suppressNavigation?: boolean;
      onThreadStarted?: (threadId: string) => void;
      onThreadStartFailed?: (error: Error) => void;
      collaborationMode?: CollaborationMode;
    }
  ) {
    this.#startThread(cwd, input, options);
  }

  fetchCollaborationPresets() {
    const id = this.#nextId++;
    this.#pendingRequests.set(id, "collaborationPresets");
    const anchorId = this.#resolveAnchorIdForRequest(false);
    socket.send({
      method: "collaborationMode/list",
      id,
      params: anchorId ? { anchorId } : {},
    });
  }

  resolveCollaborationMode(
    mode: ModeKind,
    model: string,
    reasoningEffort?: ReasoningEffort,
  ): CollaborationMode {
    const preset = this.#collaborationPresets.find((p) => p.mode === mode);
    return {
      mode,
      settings: {
        model,
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        ...(preset?.developer_instructions
          ? { developer_instructions: preset.developer_instructions }
          : {}),
      },
    };
  }

  archive(threadId: string) {
    const anchorId = this.#resolveAnchorIdForRequest(false);
    const id = this.#nextId++;
    this.#pendingRequests.set(id, "archive");
    socket.unsubscribeThread(threadId);
    socket.send({
      method: "thread/archive",
      id,
      params: { threadId, ...(anchorId ? { anchorId } : {}) },
    });
    this.list = this.list.filter((t) => t.id !== threadId);
    if (this.currentId === threadId) {
      this.currentId = null;
    }
    if (this.#settings.has(threadId)) {
      const next = new Map(this.#settings);
      next.delete(threadId);
      this.#settings = next;
      this.#saveSettings();
    }
    if (this.#dirtySettingKeys.has(threadId)) {
      this.#dirtySettingKeys.delete(threadId);
      this.#saveDirtySettingKeys();
    }
    this.#hydratedThreadIds.delete(threadId);
    if (this.#projectByThread.has(threadId)) {
      const next = new Map(this.#projectByThread);
      next.delete(threadId);
      this.#projectByThread = next;
      this.#saveProjectPaths();
    }
  }

  handleMessage(msg: RpcMessage) {
    if (msg.method === "thread/started") {
      const params = msg.params as { thread: ThreadInfo };
      if (params?.thread && !this.#threadListQuery) {
        socket.subscribeThread(params.thread.id);
        this.#addThread(params.thread);
      }
      return;
    }

    if (msg.id != null && this.#pendingRequests.has(msg.id as number)) {
      const type = this.#pendingRequests.get(msg.id as number);
      this.#pendingRequests.delete(msg.id as number);

      if (type === "list" && msg.result) {
        const pending = this.#pendingListRequests.get(msg.id as number) ?? null;
        this.#pendingListRequests.delete(msg.id as number);
        const result = msg.result as { data?: ThreadInfo[]; nextCursor?: string | null };
        if (!pending || pending.revision !== this.#threadListRevision) {
          return;
        }
        const nextCursor = typeof result.nextCursor === "string" && result.nextCursor.trim() && result.nextCursor !== pending.cursor
          ? result.nextCursor
          : null;
        const loaded = pending.append
          ? this.#mergeThreads(this.#threadListLoaded, result.data ?? [])
          : [...(result.data ?? [])];
        const visible = filterSessionsByQuery(loaded, pending.query);
        const shouldContinueSearch = pending.query.length > 0 && nextCursor !== null;
        const shouldKeepPrimaryLoading = pending.query.length > 0 && visible.length === 0 && shouldContinueSearch;

        this.#threadListCursor = nextCursor;
        this.#threadListLoaded = loaded;
        this.hasMore = nextCursor !== null;
        this.list = visible;
        if (pending.append) {
          this.loadingMore = false;
        } else {
          this.loading = false;
        }
        this.loading = shouldKeepPrimaryLoading;

        if (shouldContinueSearch) {
          this.#requestSessionList({
            append: true,
            cursor: nextCursor,
            query: pending.query,
            limit: pending.limit,
            revision: pending.revision,
            sort: pending.sort,
          });
        }
      }
      if (type === "list" && msg.error) {
        const pending = this.#pendingListRequests.get(msg.id as number) ?? null;
        this.#pendingListRequests.delete(msg.id as number);
        if (!pending || pending.revision !== this.#threadListRevision) {
          return;
        }
        if (pending.append) {
          this.loadingMore = false;
        } else {
          this.loading = false;
        }
        this.loading = false;
      }

      if (type === "resume") {
        if (msg.result) {
          const result = msg.result as {
            thread?: ThreadInfo;
            model?: string;
            reasoningEffort?: ReasoningEffort;
            approvalPolicy?: ApprovalPolicy | { kind?: string } | null;
            sandbox?: { type?: string } | string;
          };
          const thread = result.thread;
          if (thread?.id) {
            this.#openingThreadIds.delete(thread.id);
            const sandbox = resolveSandboxModeFromPolicy(result.sandbox);
            const approvalPolicy = this.#normalizeApprovalPolicy(result.approvalPolicy);
            this.#hydratedThreadIds.add(thread.id);
            this.updateSettings(thread.id, {
              model: result.model ?? this.getSettings(thread.id).model,
              reasoningEffort:
                result.reasoningEffort ??
                models.resolveDefaultReasoningEffort(result.model ?? this.getSettings(thread.id).model ?? null),
              ...(approvalPolicy ? { approvalPolicy } : {}),
              ...(sandbox ? { sandbox } : {}),
            }, "remote");
          }
        }
        if (msg.error && this.currentId) {
          this.#openingThreadIds.delete(this.currentId);
        }
        this.loading = false;
      }

      if (type === "collaborationPresets" && msg.result) {
        const result = msg.result as { data: CollaborationModeMask[] };
        this.#collaborationPresets = result.data || [];
      }

      if (type === "start" && msg.error) {
        const pending = this.#pendingStarts.get(msg.id as number) ?? null;
        this.#pendingStarts.delete(msg.id as number);
        this.#handleStartFailure(msg.error, pending);
      }

      if (type === "start" && msg.result) {
        const pending = this.#pendingStarts.get(msg.id as number) ?? null;
        this.#pendingStarts.delete(msg.id as number);
        const result = msg.result as {
          thread?: ThreadInfo;
          model?: string;
          reasoningEffort?: ReasoningEffort;
          approvalPolicy?: ApprovalPolicy | { kind?: string } | null;
          sandbox?: { type?: string } | string;
        };
        const thread = result.thread;
        if (thread?.id) {
          const sandbox = resolveSandboxModeFromPolicy(result.sandbox);
          const approvalPolicy = this.#normalizeApprovalPolicy(result.approvalPolicy);
          this.#hydratedThreadIds.add(thread.id);
          this.updateSettings(thread.id, {
            model: result.model ?? pending?.model ?? "",
            reasoningEffort:
              result.reasoningEffort ??
              models.resolveDefaultReasoningEffort(result.model ?? pending?.model ?? null),
            approvalPolicy: approvalPolicy ?? pending?.approvalPolicy ?? "on-request",
            ...(sandbox ? { sandbox } : {}),
            ...(!sandbox && pending?.sandbox ? { sandbox: pending.sandbox } : {}),
          }, "remote");

          socket.subscribeThread(thread.id);
          this.#handleStartedThread(thread, pending);
        }
      }
    }
  }

  #addThread(thread: ThreadInfo) {
    if (this.list.some((t) => t.id === thread.id)) return;
    this.list = [thread, ...this.list];
  }

  #requestSessionList(request: PendingListRequest) {
    const id = this.#nextId++;
    if (request.append) {
      this.loadingMore = true;
    } else {
      this.loading = true;
      this.loadingMore = false;
    }
    this.#pendingRequests.set(id, "list");
    this.#pendingListRequests.set(id, request);
    const anchorId = this.#resolveAnchorIdForRequest(false);
    socket.send({
      method: "thread/list",
      id,
      params: {
        cursor: request.cursor,
        limit: request.limit,
        sortKey: request.sort === "newest" ? "created_at" : "updated_at",
        ...(request.query ? { searchTerm: request.query } : {}),
        ...(anchorId ? { anchorId } : {}),
      },
    });
  }

  #mergeThreads(existing: ThreadInfo[], incoming: ThreadInfo[]): ThreadInfo[] {
    if (incoming.length === 0) return existing;
    const merged = [...existing];
    const seen = new Set(existing.map((thread) => thread.id));
    for (const thread of incoming) {
      if (seen.has(thread.id)) continue;
      seen.add(thread.id);
      merged.push(thread);
    }
    return merged;
  }

  #handleStartedThread(thread: ThreadInfo, pending: PendingStart | null) {
    this.#addThread(thread);

    if (pending?.cwd?.trim()) {
      this.setProjectPath(thread.id, pending.cwd.trim());
    }

    if (pending?.onThreadStarted) {
      pending.onThreadStarted(thread.id);
    }

    if (!pending?.suppressNavigation) {
      this.currentId = thread.id;
      navigate("/thread/:id", { params: { id: thread.id } });
    }

    if (pending?.input) {
      const anchorId = this.#resolveAnchorIdForRequest(false);
      socket.send({
        method: "turn/start",
        id: this.#nextId++,
        params: {
          threadId: thread.id,
          input: [{ type: "text", text: pending.input }],
          ...(anchorId ? { anchorId } : {}),
          ...buildTurnStartOverrides(this.getSettings(thread.id), pending.collaborationMode ?? undefined),
        },
      });
    }
  }

  #normalizeApprovalPolicy(input: unknown): ApprovalPolicy | null {
    if (!input) return null;
    if (typeof input === "string") {
      const normalized = input.trim();
      return normalized || null;
    }
    if (typeof input === "object") {
      const kind = (input as { kind?: unknown }).kind;
      if (typeof kind === "string" && kind.trim()) return kind.trim();
    }
    return null;
  }

  #filterRemoteSettingsUpdate(
    threadId: string,
    current: ThreadSettings,
    update: Partial<ThreadSettings>,
  ): Partial<ThreadSettings> {
    const dirtyKeys = this.#dirtySettingKeys.get(threadId);
    if (!dirtyKeys || dirtyKeys.size === 0) return update;

    const filtered: Partial<ThreadSettings> = { ...update };
    const remainingDirty = new Set(dirtyKeys);
    for (const key of dirtyKeys) {
      const incoming = filtered[key];
      if (incoming === undefined) continue;
      if (current[key] === incoming) {
        remainingDirty.delete(key);
        continue;
      }
      delete filtered[key];
    }
    this.#setDirtySettingKeys(threadId, remainingDirty);
    return filtered;
  }

  #markDirtySettingKeys(
    threadId: string,
    current: ThreadSettings,
    update: Partial<ThreadSettings>,
  ) {
    const nextDirty = new Set(this.#dirtySettingKeys.get(threadId) ?? []);
    for (const key of DIRTY_SETTING_KEYS) {
      const value = update[key];
      if (value === undefined) continue;
      if (current[key] !== value) {
        nextDirty.add(key);
      }
    }
    this.#setDirtySettingKeys(threadId, nextDirty);
  }

  #setDirtySettingKeys(threadId: string, keys: Set<keyof ThreadSettings>) {
    if (keys.size === 0) {
      this.#dirtySettingKeys.delete(threadId);
      this.#saveDirtySettingKeys();
      return;
    }
    this.#dirtySettingKeys.set(threadId, keys);
    this.#saveDirtySettingKeys();
  }

  #startThread(
    cwd: string,
    input: string | undefined,
    options?: {
      approvalPolicy?: ApprovalPolicy | string;
      sandbox?: SandboxMode | string;
      suppressNavigation?: boolean;
      onThreadStarted?: (threadId: string) => void;
      onThreadStartFailed?: (error: Error) => void;
      collaborationMode?: CollaborationMode;
    }
  ) {
    const anchorId = this.#resolveAnchorIdForRequest(true);
    if (!anchorId && !auth.isLocalMode) {
      const message = this.#getAnchorErrorMessage();
      const pending: PendingStart = {
        cwd: cwd.trim() || null,
        input: input?.trim() ? input.trim() : null,
        model: this.#resolveStartModel(options?.collaborationMode),
        approvalPolicy: this.#normalizeApprovalPolicy(options?.approvalPolicy),
        sandbox: resolveSandboxModeFromPolicy(options?.sandbox),
        collaborationMode: options?.collaborationMode ?? null,
        suppressNavigation: options?.suppressNavigation ?? false,
        onThreadStarted: options?.onThreadStarted ?? null,
        onThreadStartFailed: options?.onThreadStartFailed ?? null,
      };
      this.#handleStartFailure(message, pending);
      throw new ThreadStartError(message, this.#messageToFallbackText(message));
    }

    const requestedModel = this.#resolveStartModel(options?.collaborationMode);
    const id = this.#nextId++;
    const pending: PendingStart = {
      cwd: cwd.trim() || null,
      input: input?.trim() ? input.trim() : null,
      model: requestedModel,
      approvalPolicy: this.#normalizeApprovalPolicy(options?.approvalPolicy),
      sandbox: resolveSandboxModeFromPolicy(options?.sandbox),
      collaborationMode: options?.collaborationMode ?? null,
      suppressNavigation: options?.suppressNavigation ?? false,
      onThreadStarted: options?.onThreadStarted ?? null,
      onThreadStartFailed: options?.onThreadStartFailed ?? null,
    };
    this.#pendingRequests.set(id, "start");
    this.#pendingStarts.set(id, pending);
    const sendResult = socket.send({
      method: "thread/start",
      id,
      params: {
        cwd,
        ...(anchorId ? { anchorId } : {}),
        ...(requestedModel ? { model: requestedModel } : {}),
        ...(options?.approvalPolicy ? { approvalPolicy: options.approvalPolicy } : {}),
        ...(options?.sandbox ? { sandbox: options.sandbox } : {}),
      },
    });
    if (!sendResult.success) {
      this.#pendingRequests.delete(id);
      this.#pendingStarts.delete(id);
      const message: ThreadStartMessage = sendResult.error
        ? { kind: "text", text: sendResult.error }
        : { kind: "key", key: "threads.error.failedToStartThread" };
      this.#handleStartFailure(message, pending);
      throw new ThreadStartError(message, this.#messageToFallbackText(message));
    }
  }

  #resolveStartModel(collaborationMode?: CollaborationMode): string | null {
    const collabModel = collaborationMode?.settings?.model?.trim();
    if (collabModel) return collabModel;
    return models.defaultModel?.value ?? null;
  }

  #handleStartFailure(error: unknown, pending: PendingStart | null) {
    const message = this.#getErrorMessage(error);
    if (pending?.onThreadStartFailed) {
      pending.onThreadStartFailed(new ThreadStartError(message, this.#messageToFallbackText(message)));
    }
  }

  #resolveAnchorIdForRequest(requireOnline: boolean): string | null {
    if (auth.isLocalMode) return null;
    if (!anchors.selectedId) return null;
    if (!requireOnline) return anchors.selectedId;
    return anchors.selected?.id ?? null;
  }

  #getAnchorErrorMessage(): ThreadStartMessage {
    if (auth.isLocalMode) return { kind: "key", key: "threads.error.failedToStartThread" };
    if (anchors.list.length === 0) return { kind: "key", key: "threads.error.noDevicesConnected" };
    if (!anchors.selectedId) return { kind: "key", key: "threads.error.selectDeviceBeforeSession" };
    if (!anchors.selected) return { kind: "key", key: "threads.error.selectedDeviceOffline" };
    return { kind: "key", key: "threads.error.failedToStartThread" };
  }

  #getErrorMessage(error: unknown): ThreadStartMessage {
    if (error instanceof ThreadStartError) return error.uiMessage;
    if (error && typeof error === "object") {
      const candidate = error as Record<string, unknown>;
      if (candidate.kind === "key" && typeof candidate.key === "string") {
        const params = candidate.params;
        return {
          kind: "key",
          key: candidate.key,
          ...(params && typeof params === "object"
            ? { params: params as Record<string, string | number> }
            : {}),
        };
      }
      if (candidate.kind === "text" && typeof candidate.text === "string") {
        return { kind: "text", text: candidate.text };
      }
    }
    if (error instanceof Error && error.message.trim()) return { kind: "text", text: error.message };
    if (typeof error === "string" && error.trim()) return { kind: "text", text: error };
    if (error && typeof error === "object") {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return { kind: "text", text: message };
    }
    return { kind: "key", key: "threads.error.failedToStartThread" };
  }

  #messageToFallbackText(message: ThreadStartMessage): string {
    if (message.kind === "text") return message.text;
    return message.key;
  }

  #loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved) as Record<string, ThreadSettings>;
      const next = new Map<string, ThreadSettings>();
      for (const [threadId, settings] of Object.entries(data)) {
        if (!threadId) continue;
        next.set(threadId, { ...createDefaultSettings(), ...settings });
      }
      this.#settings = next;
    } catch {
      // ignore
    }
  }

  #saveSettings() {
    try {
      const data: Record<string, ThreadSettings> = {};
      for (const [threadId, settings] of this.#settings) {
        data[threadId] = settings;
      }
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  #loadDirtySettingKeys() {
    try {
      const saved = localStorage.getItem(DIRTY_SETTINGS_STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved) as Record<string, unknown>;
      const next = new Map<string, Set<keyof ThreadSettings>>();
      for (const [threadId, keys] of Object.entries(data)) {
        if (!threadId || !Array.isArray(keys)) continue;
        const validKeys = keys.filter((key): key is keyof ThreadSettings => {
          return typeof key === "string" && DIRTY_SETTING_KEYS.includes(key as keyof ThreadSettings);
        });
        if (validKeys.length === 0) continue;
        next.set(threadId, new Set(validKeys));
      }
      this.#dirtySettingKeys = next;
    } catch {
      // ignore
    }
  }

  #saveDirtySettingKeys() {
    try {
      const data: Record<string, Array<keyof ThreadSettings>> = {};
      for (const [threadId, keys] of this.#dirtySettingKeys) {
        if (keys.size === 0) continue;
        data[threadId] = [...keys];
      }
      localStorage.setItem(DIRTY_SETTINGS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  #loadProjectPaths() {
    try {
      const saved = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved) as Record<string, string>;
      const next = new Map<string, string>();
      for (const [threadId, path] of Object.entries(data)) {
        const normalizedThreadId = threadId.trim();
        const normalizedPath = typeof path === "string" ? path.trim() : "";
        if (!normalizedThreadId || !normalizedPath) continue;
        next.set(normalizedThreadId, normalizedPath);
      }
      this.#projectByThread = next;
    } catch {
      // ignore
    }
  }

  #saveProjectPaths() {
    try {
      const data: Record<string, string> = {};
      for (const [threadId, path] of this.#projectByThread) {
        data[threadId] = path;
      }
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }
}

function getStore(): ThreadsStore {
  const global = globalThis as Record<string, unknown>;
  if (!global[STORE_KEY]) {
    const store = new ThreadsStore();
    global[STORE_KEY] = store;
    socket.onMessage((msg) => store.handleMessage(msg));
  }
  return global[STORE_KEY] as ThreadsStore;
}

export const threads = getStore();
