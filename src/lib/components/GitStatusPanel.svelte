<script lang="ts">
  import { onDestroy } from "svelte";
  import { socket } from "../socket.svelte";
  import { i18n, type TranslationParams } from "../i18n.svelte";
  import type { GitStatusResult } from "../types";

  type Props = {
    threadId?: string | null;
    initialPath?: string;
    anchorId?: string;
    autoRefreshKey?: string | number | null;
    onResolvedRepoPath?: (repoRoot: string) => void;
  };

  const {
    threadId = null,
    initialPath = "",
    anchorId,
    autoRefreshKey = null,
    onResolvedRepoPath,
  }: Props = $props();

  type UiMessage =
    | { kind: "key"; key: string; params?: TranslationParams }
    | { kind: "text"; text: string }
    | { kind: "parts"; parts: UiMessage[] };

  let repoPath = $state("");
  let status = $state<GitStatusResult | null>(null);
  let selectedPaths = $state<Set<string>>(new Set());
  let loading = $state(false);
  let error = $state<UiMessage | null>(null);
  let commitMessage = $state("");
  let commitBusy = $state(false);
  let pushBusy = $state(false);
  let revertBusy = $state(false);
  let pushAfterCommit = $state(false);
  let actionMessage = $state<UiMessage | null>(null);

  let activeView = $state<"changes" | "history">("changes");

  let selectedDiffPath = $state<string | null>(null);
  let diffText = $state("");
  let diffLoading = $state(false);
  let diffError = $state<UiMessage | null>(null);
  let diffIsBinary = $state(false);
  let diffTooLarge = $state(false);
  let diffRequestId = 0;

  let graphText = $state("");
  let graphLoading = $state(false);
  let graphError = $state<UiMessage | null>(null);
  let graphTruncated = $state(false);
  let graphRequestId = 0;

  let initialAutoLoadedPath = "";
  let lastAutoRefreshSignature = "";
  let autoRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  function messageKey(key: string, params?: TranslationParams): UiMessage {
    return { kind: "key", key, ...(params ? { params } : {}) };
  }

  function messageText(text: string): UiMessage {
    return { kind: "text", text };
  }

  function messageParts(parts: UiMessage[]): UiMessage {
    return { kind: "parts", parts };
  }

  function renderMessage(message: UiMessage | null): string {
    if (!message) return "";
    if (message.kind === "parts") {
      return message.parts
        .map((part) => renderMessage(part))
        .filter((part) => part.trim().length > 0)
        .join("\n\n");
    }
    if (message.kind === "text") return message.text;
    return i18n.t(message.key, message.params);
  }

  const isBusy = $derived(loading || commitBusy || pushBusy || revertBusy);
  const selectedCount = $derived(selectedPaths.size);
  const allSelected = $derived.by(() => {
    if (!status || status.entries.length === 0) return false;
    return status.entries.every((entry) => selectedPaths.has(entry.path));
  });

  function clearAutoRefreshTimer() {
    if (!autoRefreshTimer) return;
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  function scheduleAutoRefresh(delayMs = 250) {
    if (isBusy) return;
    clearAutoRefreshTimer();
    autoRefreshTimer = setTimeout(() => {
      autoRefreshTimer = null;
      void refreshStatus({ silent: true, keepActionMessage: true });
    }, delayMs);
  }

  onDestroy(() => {
    clearAutoRefreshTimer();
  });

  $effect(() => {
    if (!repoPath.trim() && initialPath.trim()) {
      repoPath = initialPath.trim();
    }
  });

  $effect(() => {
    const path = repoPath.trim();
    const initial = initialPath.trim();
    if (!path || !initial) return;
    if (path !== initial) return;
    if (initialAutoLoadedPath === path) return;
    initialAutoLoadedPath = path;
    scheduleAutoRefresh(0);
  });

  $effect(() => {
    const path = repoPath.trim();
    if (!path) return;
    const signature = `${autoRefreshKey ?? ""}|${path}|${anchorId ?? ""}`;
    if (signature === lastAutoRefreshSignature) return;
    lastAutoRefreshSignature = signature;
    if (autoRefreshKey == null || autoRefreshKey === "") return;
    scheduleAutoRefresh(220);
  });

  $effect(() => {
    if (activeView !== "history") return;
    if (graphText || graphLoading) return;
    void loadGitGraph({ silent: true });
  });

  function syncSelection(entries: GitStatusResult["entries"]) {
    if (entries.length === 0) {
      selectedPaths = new Set();
      return;
    }

    if (selectedPaths.size === 0) {
      selectedPaths = new Set(entries.map((entry) => entry.path));
      return;
    }

    const next = new Set<string>();
    for (const entry of entries) {
      if (selectedPaths.has(entry.path)) {
        next.add(entry.path);
      }
    }

    if (next.size === 0) {
      selectedPaths = new Set(entries.map((entry) => entry.path));
      return;
    }

    selectedPaths = next;
  }

  function syncDiffSelection(entries: GitStatusResult["entries"]) {
    if (!selectedDiffPath) return;
    const stillExists = entries.some((entry) => entry.path === selectedDiffPath);
    if (stillExists) return;
    selectedDiffPath = null;
    diffText = "";
    diffError = null;
    diffLoading = false;
    diffIsBinary = false;
    diffTooLarge = false;
  }

  async function refreshStatus(options?: { silent?: boolean; keepActionMessage?: boolean }): Promise<void> {
    const silent = options?.silent === true;
    const keepActionMessage = options?.keepActionMessage === true;

    if (!repoPath.trim()) {
      status = null;
      selectedPaths = new Set();
      if (!silent) {
        error = messageKey("git.error.setPathFirst");
      }
      return;
    }
    if (isBusy && silent) return;

    loading = true;
    if (!silent) {
      error = null;
      if (!keepActionMessage) actionMessage = null;
    }
    try {
      status = await socket.gitStatus(repoPath.trim(), anchorId);
      syncSelection(status.entries);
      syncDiffSelection(status.entries);
      const repoRoot = status.repoRoot.trim();
      if (repoRoot && onResolvedRepoPath) {
        onResolvedRepoPath(repoRoot);
      }
      if (activeView === "history") {
        void loadGitGraph({ silent: true, repoRoot });
      } else if (selectedDiffPath && status.entries.some((entry) => entry.path === selectedDiffPath)) {
        void loadFileDiff(selectedDiffPath, { silent: true, repoRoot });
      }
      if (!silent) {
        error = null;
      }
    } catch (err) {
      status = null;
      selectedPaths = new Set();
      error = err instanceof Error ? messageText(err.message) : messageKey("git.error.readStatusFailed");
    } finally {
      loading = false;
    }
  }

  async function ensureRepoRoot(): Promise<string | null> {
    const resolved = status?.repoRoot?.trim();
    if (resolved) return resolved;
    await refreshStatus({ silent: true, keepActionMessage: true });
    return status?.repoRoot?.trim() || null;
  }

  async function loadFileDiff(path: string, options?: { silent?: boolean; repoRoot?: string }): Promise<void> {
    const silent = options?.silent === true;
    const repoRoot = options?.repoRoot?.trim() || status?.repoRoot?.trim();
    if (!repoRoot) {
      if (!silent) error = messageKey("git.error.refreshFirstResolveRoot");
      return;
    }

    selectedDiffPath = path;
    diffLoading = true;
    if (!silent) {
      error = null;
      diffError = null;
    }
    const requestId = ++diffRequestId;

    try {
      const result = await socket.gitDiff(repoRoot, path, anchorId);
      if (requestId !== diffRequestId) return;
      diffText = result.diff || "";
      diffError = null;
      diffIsBinary = Boolean(result.isBinary);
      diffTooLarge = Boolean(result.tooLarge);
    } catch (err) {
      if (requestId !== diffRequestId) return;
      diffText = "";
      diffIsBinary = false;
      diffTooLarge = false;
      diffError = err instanceof Error ? messageText(err.message) : messageKey("git.error.loadDiffFailed");
    } finally {
      if (requestId === diffRequestId) {
        diffLoading = false;
      }
    }
  }

  async function loadGitGraph(options?: { silent?: boolean; repoRoot?: string }): Promise<void> {
    const silent = options?.silent === true;
    const repoRoot = options?.repoRoot?.trim() || await ensureRepoRoot();
    if (!repoRoot) {
      if (!silent) error = messageKey("git.error.refreshFirstResolveRoot");
      return;
    }

    graphLoading = true;
    if (!silent) {
      error = null;
      graphError = null;
    }
    const requestId = ++graphRequestId;

    try {
      const result = await socket.gitLogGraph(repoRoot, 300, anchorId);
      if (requestId !== graphRequestId) return;
      graphText = result.graph || "";
      graphError = null;
      graphTruncated = result.truncated;
    } catch (err) {
      if (requestId !== graphRequestId) return;
      graphText = "";
      graphTruncated = false;
      graphError = err instanceof Error ? messageText(err.message) : messageKey("git.error.loadGraphFailed");
    } finally {
      if (requestId === graphRequestId) {
        graphLoading = false;
      }
    }
  }

  function setView(nextView: "changes" | "history") {
    activeView = nextView;
    if (nextView === "history") {
      void loadGitGraph({ silent: true });
    }
  }

  function setAllSelected(nextChecked: boolean) {
    if (!status) return;
    if (!nextChecked) {
      selectedPaths = new Set();
      return;
    }
    selectedPaths = new Set(status.entries.map((entry) => entry.path));
  }

  function setPathSelected(path: string, nextChecked: boolean) {
    const next = new Set(selectedPaths);
    if (nextChecked) {
      next.add(path);
    } else {
      next.delete(path);
    }
    selectedPaths = next;
  }

  function getSelectedEntryPaths(): string[] {
    if (!status) return [];
    return status.entries
      .map((entry) => entry.path)
      .filter((path) => selectedPaths.has(path));
  }

  async function commitSelected(): Promise<void> {
    const repoRoot = status?.repoRoot?.trim();
    if (!repoRoot) {
      error = messageKey("git.error.refreshFirstResolveRoot");
      return;
    }
    if (!commitMessage.trim()) {
      error = messageKey("git.error.commitMessageRequired");
      return;
    }

    const selected = getSelectedEntryPaths();
    if (selected.length === 0) {
      error = messageKey("git.error.selectAtLeastOneCommit");
      return;
    }

    commitBusy = true;
    error = null;
    actionMessage = null;
    try {
      const allSelectedNow = status ? selected.length === status.entries.length : false;
      const commitResult = await socket.gitCommit(
        repoRoot,
        commitMessage.trim(),
        allSelectedNow,
        anchorId,
        allSelectedNow ? undefined : selected,
      );
      const committedMessage: UiMessage = commitResult.output
        ? messageText(commitResult.output)
        : messageKey("git.action.committed");
      if (pushAfterCommit) {
        const pushResult = await socket.gitPush(repoRoot, undefined, undefined, anchorId);
        const pushedMessage: UiMessage = pushResult.output
          ? messageText(pushResult.output)
          : messageKey("git.action.pushed");
        actionMessage = messageParts([committedMessage, pushedMessage]);
      } else {
        actionMessage = committedMessage;
      }
      commitMessage = "";
      await refreshStatus({ silent: true, keepActionMessage: true });
    } catch (err) {
      error = err instanceof Error ? messageText(err.message) : messageKey("git.error.commitFailed");
    } finally {
      commitBusy = false;
    }
  }

  async function pushChanges(): Promise<void> {
    const repoRoot = status?.repoRoot?.trim();
    if (!repoRoot) {
      error = messageKey("git.error.refreshFirstResolveRoot");
      return;
    }

    pushBusy = true;
    error = null;
    actionMessage = null;
    try {
      const result = await socket.gitPush(repoRoot, undefined, undefined, anchorId);
      actionMessage = result.output ? messageText(result.output) : messageKey("git.action.pushed");
      await refreshStatus({ silent: true, keepActionMessage: true });
    } catch (err) {
      error = err instanceof Error ? messageText(err.message) : messageKey("git.error.pushFailed");
    } finally {
      pushBusy = false;
    }
  }

  async function revertSelected(): Promise<void> {
    const repoRoot = status?.repoRoot?.trim();
    if (!repoRoot) {
      error = messageKey("git.error.refreshFirstResolveRoot");
      return;
    }

    const selected = getSelectedEntryPaths();
    if (selected.length === 0) {
      error = messageKey("git.error.selectAtLeastOneRevert");
      return;
    }
    if (!confirm(i18n.t("git.confirm.revertSelected", { count: selected.length }))) return;

    revertBusy = true;
    error = null;
    actionMessage = null;
    try {
      const result = await socket.gitRevert(repoRoot, anchorId, selected);
      actionMessage = result.output
        ? messageText(result.output)
        : messageKey("git.action.revertedCount", { count: result.reverted });
      await refreshStatus({ silent: true, keepActionMessage: true });
    } catch (err) {
      error = err instanceof Error ? messageText(err.message) : messageKey("git.error.revertFailed");
    } finally {
      revertBusy = false;
    }
  }

  async function revertSingle(path: string): Promise<void> {
    const repoRoot = status?.repoRoot?.trim();
    if (!repoRoot) {
      error = messageKey("git.error.refreshFirstResolveRoot");
      return;
    }
    if (!confirm(i18n.t("git.confirm.revertPath", { path }))) return;

    revertBusy = true;
    error = null;
    actionMessage = null;
    try {
      const result = await socket.gitRevert(repoRoot, anchorId, [path]);
      actionMessage = result.output ? messageText(result.output) : messageKey("git.action.revertedPath", { path });
      await refreshStatus({ silent: true, keepActionMessage: true });
    } catch (err) {
      error = err instanceof Error ? messageText(err.message) : messageKey("git.error.revertFailed");
    } finally {
      revertBusy = false;
    }
  }

  async function revertAll(): Promise<void> {
    const repoRoot = status?.repoRoot?.trim();
    if (!repoRoot) {
      error = messageKey("git.error.refreshFirstResolveRoot");
      return;
    }
    if (!confirm(i18n.t("git.confirm.revertAll"))) return;

    revertBusy = true;
    error = null;
    actionMessage = null;
    try {
      const result = await socket.gitRevert(repoRoot, anchorId);
      actionMessage = result.output ? messageText(result.output) : messageKey("git.action.revertedAll");
      await refreshStatus({ silent: true, keepActionMessage: true });
    } catch (err) {
      error = err instanceof Error ? messageText(err.message) : messageKey("git.error.revertAllFailed");
    } finally {
      revertBusy = false;
    }
  }
</script>

<section class="git-panel stack" aria-live="polite">
  <header class="panel-head row">
    <div class="panel-title-wrap stack">
      <span class="panel-kicker">{i18n.t("git.panelKicker")}</span>
      <h2>{i18n.t("git.title")}</h2>
      {#if threadId}
        <p class="panel-subtle">{i18n.t("git.threadLabel", { id: threadId.slice(0, 8) })}</p>
      {/if}
    </div>
    <button type="button" class="refresh-btn" onclick={() => void refreshStatus()} disabled={isBusy}>
      {loading ? i18n.t("git.refreshing") : i18n.t("git.refresh")}
    </button>
  </header>

  <div class="row path-row">
    <input
      class="path-input"
      type="text"
      placeholder={i18n.t("git.pathPlaceholder")}
      bind:value={repoPath}
      onkeydown={(e) => {
        if (e.key === "Enter") void refreshStatus();
      }}
    />
  </div>

  {#if status}
    <div class="status-line row">
      <span class="chip">{status.clean ? i18n.t("git.status.clean") : i18n.t("git.status.dirty")}</span>
      <span class="chip">{status.branch ? i18n.t("git.status.branch", { branch: status.branch }) : i18n.t("git.status.detached")}</span>
      <span class="chip">{status.repoRoot}</span>
      <span class="chip">{i18n.t("git.status.changes", { count: status.entries.length })}</span>
      <span class="chip">{i18n.t("git.status.selected", { count: selectedCount })}</span>
    </div>

    <div class="view-tabs row">
      <button type="button" class="tab-btn" class:active={activeView === "changes"} onclick={() => setView("changes")}>
        {i18n.t("git.tab.changes")}
      </button>
      <button type="button" class="tab-btn" class:active={activeView === "history"} onclick={() => setView("history")}>
        {i18n.t("git.tab.history")}
      </button>
    </div>

    {#if activeView === "changes"}
      {#if status.entries.length > 0}
        <div class="selection-toolbar row">
          <label class="select-all row">
            <input
              type="checkbox"
              checked={allSelected}
              onchange={(e) => setAllSelected((e.currentTarget as HTMLInputElement).checked)}
              disabled={isBusy}
            />
            <span>{i18n.t("git.selectAll")}</span>
          </label>
          <button type="button" class="mini-btn danger" onclick={() => void revertSelected()} disabled={isBusy || selectedCount === 0}>
            {i18n.t("git.revertSelected")}
          </button>
          <button type="button" class="mini-btn danger" onclick={() => void revertAll()} disabled={isBusy}>
            {i18n.t("git.revertAll")}
          </button>
        </div>

        <div class="entries">
          {#each status.entries as entry (entry.path + entry.rawStatus)}
            <div class="entry row" class:diff-active={selectedDiffPath === entry.path}>
              <label class="entry-select row">
                <input
                  type="checkbox"
                  checked={selectedPaths.has(entry.path)}
                  onchange={(e) => setPathSelected(entry.path, (e.currentTarget as HTMLInputElement).checked)}
                  disabled={isBusy}
                />
              </label>
              <span class="entry-status">{entry.rawStatus}</span>
              <span class="entry-path">{entry.path}</span>
              <div class="entry-actions row">
                <button type="button" class="entry-diff-btn" onclick={() => void loadFileDiff(entry.path)} disabled={isBusy}>
                  {i18n.t("git.diff")}
                </button>
                <button type="button" class="entry-revert-btn" onclick={() => void revertSingle(entry.path)} disabled={isBusy}>
                  {i18n.t("git.revert")}
                </button>
              </div>
            </div>
          {/each}
        </div>

        <div class="diff-preview stack">
          <div class="diff-preview-head row">
            <span class="chip">{selectedDiffPath ? selectedDiffPath : i18n.t("git.selectFileForDiff")}</span>
            {#if diffIsBinary}
              <span class="chip">{i18n.t("git.binary")}</span>
            {/if}
            {#if diffTooLarge}
              <span class="chip">{i18n.t("git.truncated")}</span>
            {/if}
          </div>
          {#if diffLoading}
            <p class="hint">{i18n.t("git.loadingDiff")}</p>
          {:else if diffError}
            <p class="hint hint-error">{renderMessage(diffError)}</p>
          {:else if selectedDiffPath}
            <pre class="diff-output">{diffText || i18n.t("git.noDiffPayloadPath")}</pre>
          {:else}
            <p class="hint">{i18n.t("git.pickFilePreview")}</p>
          {/if}
        </div>

        <div class="actions stack">
          <input
            class="commit-input"
            type="text"
            placeholder={i18n.t("git.commitMessage")}
            bind:value={commitMessage}
            onkeydown={(e) => {
              if (e.key === "Enter" && !commitBusy) void commitSelected();
            }}
          />
          <label class="push-after row">
            <input type="checkbox" bind:checked={pushAfterCommit} disabled={isBusy} />
            <span>{i18n.t("git.pushAfterCommit")}</span>
          </label>
          <div class="row action-buttons">
            <button type="button" class="action-btn" onclick={() => void commitSelected()} disabled={isBusy || selectedCount === 0}>
              {commitBusy ? i18n.t("git.committing") : i18n.t("git.commitSelected")}
            </button>
            <button type="button" class="action-btn" onclick={() => void pushChanges()} disabled={isBusy}>
              {pushBusy ? i18n.t("git.pushing") : i18n.t("git.push")}
            </button>
          </div>
        </div>
      {:else}
        <p class="hint">{i18n.t("git.noLocalChanges")}</p>
      {/if}
    {:else}
      <div class="history-toolbar row">
        <button type="button" class="mini-btn" onclick={() => void loadGitGraph()} disabled={graphLoading}>
          {graphLoading ? i18n.t("common.loading") : i18n.t("git.reloadGraph")}
        </button>
      </div>

      {#if graphLoading && !graphText}
        <p class="hint">{i18n.t("git.loadingGraph")}</p>
      {:else if graphError}
        <p class="hint hint-error">{renderMessage(graphError)}</p>
      {:else if !graphText}
        <p class="hint">{i18n.t("git.noCommits")}</p>
      {:else}
        <pre class="graph-output">{graphText}</pre>
        {#if graphTruncated}
          <p class="hint">{i18n.t("git.graphTruncated")}</p>
        {/if}
      {/if}
    {/if}
  {/if}

  {#if error}
    <p class="hint hint-error">{renderMessage(error)}</p>
  {/if}
  {#if actionMessage}
    <p class="hint">{renderMessage(actionMessage)}</p>
  {/if}
</section>

<style>
  .git-panel {
    --stack-gap: var(--space-sm);
    border: 1px solid color-mix(in srgb, var(--cli-border) 70%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--cli-bg-elevated) 86%, transparent);
    padding: var(--space-md);
  }

  .panel-head {
    justify-content: space-between;
    align-items: flex-start;
  }

  .panel-title-wrap {
    --stack-gap: 0.14rem;
  }

  .panel-kicker {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--cli-text-muted);
  }

  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.26rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--cli-text);
  }

  .panel-subtle {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--cli-text-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .refresh-btn,
  .action-btn,
  .mini-btn,
  .entry-diff-btn,
  .entry-revert-btn {
    padding: var(--space-xs) var(--space-sm);
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--cli-border) 74%, transparent);
    border-radius: var(--radius-md);
    color: var(--cli-text);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
  }

  .refresh-btn:hover:enabled,
  .action-btn:hover:enabled,
  .mini-btn:hover:enabled,
  .entry-diff-btn:hover:enabled,
  .entry-revert-btn:hover:enabled {
    border-color: var(--cli-prefix-agent);
    background: color-mix(in srgb, var(--cli-prefix-agent) 10%, transparent);
  }

  .mini-btn.danger:hover:enabled,
  .entry-revert-btn:hover:enabled {
    border-color: var(--cli-error);
    background: color-mix(in srgb, var(--cli-error) 10%, transparent);
  }

  .refresh-btn:disabled,
  .action-btn:disabled,
  .mini-btn:disabled,
  .entry-diff-btn:disabled,
  .entry-revert-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .path-row {
    --row-gap: var(--space-sm);
  }

  .path-input,
  .commit-input {
    width: 100%;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    background: var(--cli-bg);
    color: var(--cli-text);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .status-line {
    --row-gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .view-tabs {
    --row-gap: var(--space-xs);
  }

  .tab-btn {
    padding: 0.28rem 0.55rem;
    border: 1px solid color-mix(in srgb, var(--cli-border) 72%, transparent);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--cli-text-muted);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
  }

  .tab-btn.active {
    color: var(--cli-text);
    border-color: var(--cli-prefix-agent);
    background: color-mix(in srgb, var(--cli-prefix-agent) 12%, transparent);
  }

  .chip {
    border: 1px solid var(--cli-border);
    border-radius: 999px;
    padding: 0.08rem 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.64rem;
    color: var(--cli-text-dim);
  }

  .selection-toolbar {
    --row-gap: var(--space-sm);
    align-items: center;
    flex-wrap: wrap;
  }

  .select-all {
    --row-gap: 0.4rem;
    align-items: center;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--cli-text);
  }

  .entries {
    max-height: 280px;
    overflow: auto;
    border: 1px solid color-mix(in srgb, var(--cli-border) 60%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--cli-bg) 80%, transparent);
  }

  .entry {
    --row-gap: var(--space-sm);
    padding: 0.32rem 0.48rem;
    border-bottom: 1px solid color-mix(in srgb, var(--cli-border) 40%, transparent);
    align-items: center;
  }

  .entry.diff-active {
    background: color-mix(in srgb, var(--cli-prefix-agent) 7%, transparent);
  }

  .entry:last-child {
    border-bottom: none;
  }

  .entry-select {
    --row-gap: 0.3rem;
    align-items: center;
  }

  .entry-status {
    width: 2rem;
    color: var(--cli-prefix-agent);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .entry-path {
    color: var(--cli-text);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
    flex: 1;
  }

  .entry-actions {
    --row-gap: var(--space-xs);
    flex-shrink: 0;
  }

  .entry-revert-btn {
    flex-shrink: 0;
  }

  .diff-preview {
    --stack-gap: var(--space-xs);
    border: 1px solid color-mix(in srgb, var(--cli-border) 60%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--cli-bg) 80%, transparent);
    padding: var(--space-sm);
  }

  .diff-preview-head {
    --row-gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .history-toolbar {
    --row-gap: var(--space-xs);
  }

  .diff-output,
  .graph-output {
    margin: 0;
    max-height: 320px;
    overflow: auto;
    border: 1px solid color-mix(in srgb, var(--cli-border) 56%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--cli-bg-elevated) 72%, transparent);
    padding: var(--space-sm);
    color: var(--cli-text);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    line-height: 1.45;
    white-space: pre;
  }

  .actions {
    --stack-gap: var(--space-xs);
  }

  .push-after {
    --row-gap: 0.4rem;
    align-items: center;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--cli-text);
  }

  .action-buttons {
    --row-gap: var(--space-xs);
  }

  .hint {
    margin: 0;
    color: var(--cli-text-muted);
    font-family: var(--font-sans);
    font-size: 0.8rem;
    line-height: 1.45;
    white-space: pre-wrap;
  }

  .hint-error {
    color: var(--cli-error);
  }
</style>
