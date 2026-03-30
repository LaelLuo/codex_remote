<script lang="ts">
  import { socket } from "../lib/socket.svelte";
  import { shouldSubmitSessionSearch } from "../lib/session-search";
  import { threads } from "../lib/threads.svelte";
  import { i18n } from "../lib/i18n.svelte";
  import { theme } from "../lib/theme.svelte";
  import AppHeader from "../lib/components/AppHeader.svelte";
  import ShimmerDot from "../lib/components/ShimmerDot.svelte";

  const themeIcons = { system: "◐", light: "○", dark: "●" } as const;
  type SessionSortMode = "updated" | "newest";
  const sessionSortOptions: SessionSortMode[] = ["updated", "newest"];
  let searchQuery = $state("");
  let sortMode = $state<SessionSortMode>("updated");
  let debouncedSearchQuery = $state("");
  let loadMoreSentinel = $state<HTMLDivElement | null>(null);

  function formatTime(ts?: number): string {
    if (!ts) return "";
    const date = new Date(ts * 1000);
    return i18n.formatDate(date, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function submitSearch() {
    const query = searchQuery.trim();
    if (query !== debouncedSearchQuery) {
      debouncedSearchQuery = query;
      return;
    }
    threads.fetchSessions({
      reset: true,
      query,
      sort: sortMode,
    });
  }

  $effect(() => {
    const handle = setTimeout(() => {
      debouncedSearchQuery = searchQuery.trim();
    }, 200);
    return () => clearTimeout(handle);
  });

  $effect(() => {
    if (socket.status !== "connected") return;
    threads.fetchSessions({
      reset: true,
      query: debouncedSearchQuery,
      sort: sortMode,
    });
  });

  $effect(() => {
    if (typeof IntersectionObserver === "undefined" || !loadMoreSentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          threads.fetchNextSessions();
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(loadMoreSentinel);
    return () => observer.disconnect();
  });
</script>

<svelte:head>
  <title>{i18n.t("sessions.title")}</title>
</svelte:head>

<div class="sessions stack">
  <AppHeader status={socket.status}>
    {#snippet actions()}
      <a href="/settings">{i18n.t("sessions.settingsLink")}</a>
      <button
        type="button"
        onclick={() => theme.cycle()}
        title={i18n.t("common.themeTitle", { theme: i18n.themeName(theme.current) })}
      >
        {themeIcons[theme.current]}
      </button>
    {/snippet}
  </AppHeader>

  <main class="sessions-content stack">
    <section class="masthead">
      <span class="section-title">{i18n.t("sessions.allSessions")}</span>
      <h1>{i18n.t("sessions.heading")}</h1>
    </section>

    <section class="workspace stack">
      <div class="section-header split">
        <div class="section-title-row row">
          <span class="section-subtitle">{i18n.t("sessions.history")}</span>
        </div>
        <div class="section-actions row">
          <input
            class="search-input"
            type="search"
            bind:value={searchQuery}
            placeholder={i18n.t("sessions.searchPlaceholder")}
            aria-label={i18n.t("sessions.searchPlaceholder")}
            onkeydown={(event) => {
              if (shouldSubmitSessionSearch(event)) submitSearch();
            }}
          />
          <label class="sort-control row">
            <span>{i18n.t("sessions.sortLabel")}</span>
            <select bind:value={sortMode} aria-label={i18n.t("sessions.sortLabel")}>
              {#each sessionSortOptions as option}
                <option value={option}>
                  {i18n.t(
                    option === "updated"
                      ? "sessions.sortUpdated"
                      : "sessions.sortNewest",
                  )}
                </option>
              {/each}
            </select>
          </label>
          <button
            class="refresh-btn"
            onclick={submitSearch}
            title={i18n.t("common.refresh")}
          >↻</button>
        </div>
      </div>

      {#if threads.loading}
        <div class="loading row">
          <ShimmerDot /> {i18n.t("sessions.loading")}
        </div>
      {:else if threads.list.length === 0}
        <div class="empty row">{debouncedSearchQuery ? i18n.t("sessions.emptyFiltered") : i18n.t("sessions.empty")}</div>
      {:else}
        <ul class="session-list">
          {#each threads.list as thread (thread.id)}
            <li class="session-item row">
              <a class="session-link row" href="/thread/{thread.id}">
                <span class="session-icon">›</span>
                <span class="session-preview">{thread.preview || i18n.t("common.newSession")}</span>
                <span class="session-meta">{formatTime(sortMode === "updated" ? thread.updatedAt ?? thread.createdAt : thread.createdAt)}</span>
              </a>
              <button
                class="archive-btn"
                onclick={() => threads.archive(thread.id)}
                title={i18n.t("sessions.archiveTitle")}
              >×</button>
            </li>
          {/each}
        </ul>
        {#if threads.loadingMore}
          <div class="loading row">
            <ShimmerDot /> {i18n.t("sessions.loadingMore")}
          </div>
        {/if}
        {#if threads.hasMore}
          <div bind:this={loadMoreSentinel} class="load-more-sentinel" aria-hidden="true"></div>
        {/if}
      {/if}
    </section>
  </main>
</div>

<style>
  .sessions {
    min-height: 100vh;
    background: var(--cli-bg);
    color: var(--cli-text);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    --stack-gap: 0;
  }

  .sessions-content {
    width: 100%;
    max-width: min(1480px, calc(100vw - var(--space-lg) * 2));
    margin: 0 auto;
    padding: var(--space-md) var(--space-lg) var(--space-xl);
    --stack-gap: var(--space-lg);
  }

  .masthead {
    display: grid;
    gap: var(--space-xs);
    padding: 0 var(--space-xs);
  }

  .masthead h1 {
    margin: 0;
    font-size: clamp(4.1rem, 16vw, 11rem);
    line-height: 0.82;
    letter-spacing: -0.012em;
    text-transform: uppercase;
    font-weight: 500;
    color: var(--cli-text);
  }

  .workspace {
    --stack-gap: var(--space-sm);
    padding: var(--space-md);
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-lg);
    background: var(--cli-bg-elevated);
  }

  .section-header {
    --split-gap: var(--space-sm);
    padding: 0.58rem 0.7rem;
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--cli-bg) 66%, transparent);
  }

  .section-title-row {
    --row-gap: var(--space-xs);
    align-items: center;
  }

  .section-actions {
    --row-gap: var(--space-sm);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .section-title {
    color: var(--cli-text-muted);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .section-subtitle {
    color: var(--cli-text-dim);
    font-size: var(--text-xs);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-family: var(--font-display);
    font-weight: 500;
  }

  .refresh-btn {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--cli-text-muted);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .refresh-btn:hover {
    color: var(--cli-text);
  }

  .search-input,
  .sort-control select {
    padding: 0.42rem 0.58rem;
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--cli-bg) 88%, transparent);
    color: var(--cli-text);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
  }

  .search-input {
    min-width: min(20rem, 42vw);
  }

  .search-input:focus,
  .sort-control select:focus {
    outline: none;
    border-color: var(--cli-prefix-agent);
  }

  .sort-control {
    --row-gap: 0.4rem;
    align-items: center;
    color: var(--cli-text-muted);
    font-size: var(--text-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-family: var(--font-mono);
  }

  .session-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .session-item {
    --row-gap: 0;
    border-bottom: 1px solid var(--cli-border);
  }

  .session-item:last-child {
    border-bottom: none;
  }

  .session-link {
    flex: 1;
    min-width: 0;
    --row-gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    text-decoration: none;
    color: inherit;
    background: transparent;
  }

  .session-link:hover {
    background: var(--cli-selection);
  }

  .session-icon {
    color: var(--cli-prefix-agent);
    font-weight: 600;
  }

  .session-preview {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: 0.008em;
  }

  .session-meta {
    flex-shrink: 0;
    font-size: var(--text-xs);
    color: var(--cli-text-muted);
  }

  .archive-btn {
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-left: 1px solid var(--cli-border);
    background: transparent;
    color: var(--cli-text-muted);
    font-size: var(--text-base);
    cursor: pointer;
  }

  .archive-btn:hover {
    color: var(--cli-error);
    background: var(--cli-selection);
  }

  .loading,
  .empty {
    color: var(--cli-text-muted);
    padding: var(--space-md);
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--cli-bg) 66%, transparent);
  }

  .load-more-sentinel {
    height: 1px;
  }

  @media (max-width: 900px) {
    .sessions-content {
      padding: var(--space-md);
    }

    .masthead h1 {
      font-size: clamp(3.2rem, 20vw, 6rem);
    }

    .search-input {
      min-width: 100%;
    }

    .section-actions {
      justify-content: stretch;
    }
  }
</style>
