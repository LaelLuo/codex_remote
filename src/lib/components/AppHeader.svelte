<script lang="ts">
    import type { Snippet } from "svelte";
    import type { ConnectionStatus } from "../types";
    import { anchors } from "../anchors.svelte";
    import { i18n } from "../i18n.svelte";

    interface Props {
        status: ConnectionStatus;
        threadId?: string | null;
        actions?: Snippet;
    }

    const { status, threadId, actions }: Props = $props();

    let mobileMenuOpen = $state(false);
    const showAnchorAlert = $derived(status === "connected" && anchors.status === "none");

    function handleClickOutside(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest(".mobile-menu") && !target.closest(".hamburger-btn")) {
            mobileMenuOpen = false;
        }
    }

</script>

<svelte:window onclick={handleClickOutside} />

<header class="app-header">
    <div class="app-header-inner row">
        <a href="/app" class="brand" aria-label="Codex Remote">
            <span class="brand-main">CODEX</span>
            <span class="brand-accent">Remote</span>
        </a>

        {#if threadId}
            <span class="separator">·</span>
            <span class="thread-id">{threadId.slice(0, 8)}</span>
        {/if}

        {#if showAnchorAlert}
            <span class="separator">·</span>
            <a class="anchor-alert anchor-alert-link" href="/device">{i18n.t("appHeader.anchorAuthorize")}</a>
        {/if}

        <div class="spacer"></div>

        {#if actions}
            <div class="desktop-actions row">
                {@render actions()}
            </div>

            <button
                type="button"
                class="hamburger-btn row"
                onclick={(e) => {
                    e.stopPropagation();
                    mobileMenuOpen = !mobileMenuOpen;
                }}
                aria-label={i18n.t("appHeader.menu")}
                aria-expanded={mobileMenuOpen}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    {#if mobileMenuOpen}
                        <path d="M18 6 6 18M6 6l12 12" />
                    {:else}
                        <path d="M3 12h18M3 6h18M3 18h18" />
                    {/if}
                </svg>
            </button>
        {/if}
    </div>

    {#if mobileMenuOpen && actions}
        <nav class="mobile-menu stack">
            {@render actions()}
        </nav>
    {/if}
</header>

<style>
    .app-header {
        position: relative;
        width: 100vw;
        margin-left: calc(50% - 50vw);
        background: var(--cli-bg-elevated);
        border-bottom: 1px solid var(--cli-border);
        font-family: var(--font-sans);
        font-size: var(--text-sm);
        color: var(--cli-text);
    }

    .app-header-inner {
        --row-gap: var(--space-sm);
        padding: 0.62rem var(--space-md);
        max-width: var(--app-max-width);
        margin: 0 auto;
    }

    .brand {
        display: inline-flex;
        align-items: baseline;
        gap: 0.3rem;
        color: var(--cli-prefix-agent);
        text-decoration: none;
        transition: opacity var(--transition-fast);
    }

    .brand-main {
        font-family: var(--font-display);
        font-size: 1.22rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        line-height: 1;
    }

    .brand-accent {
        font-family: var(--font-editorial);
        font-size: 1.04rem;
        font-weight: 400;
        letter-spacing: 0.01em;
        font-style: italic;
        color: var(--cli-text-dim);
    }

    .brand:hover {
        opacity: 0.8;
    }

    .separator {
        color: var(--cli-text-muted);
    }

    .anchor-alert {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
        padding: 0.24rem 0.66rem;
        border-radius: var(--radius-md);
        border: 1px solid transparent;
        background: var(--color-btn-primary-bg);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.045em;
        line-height: 1.4;
        color: var(--color-btn-primary-text);
        font-family: var(--font-mono);
        font-weight: 700;
        transition: opacity var(--transition-fast);
    }

    .anchor-alert-link {
        display: inline-block;
        text-decoration: none;
        color: var(--color-btn-primary-text);
    }

    .anchor-alert-link:hover {
        opacity: 0.86;
    }

    .thread-id {
        color: var(--cli-text-dim);
        font-size: var(--text-xs);
    }

    .spacer {
        flex: 1;
    }

    /* Desktop actions */
    .desktop-actions {
        display: none;
        --row-gap: var(--space-sm);
    }

    @media (min-width: 640px) {
        .desktop-actions {
            display: flex;
        }
    }

    /* Global styles for action items passed via snippet */
    .desktop-actions :global(a),
    .desktop-actions :global(button) {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--cli-border);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--cli-text-dim);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.02em;
        text-decoration: none;
        cursor: pointer;
        transition: all var(--transition-fast);
    }

    .desktop-actions :global(a:hover),
    .desktop-actions :global(button:hover) {
        background: var(--cli-selection);
        color: var(--cli-text);
        border-color: var(--cli-text-muted);
    }

    /* Hamburger button */
    .hamburger-btn {
        justify-content: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        background: transparent;
        border: 1px solid var(--cli-border);
        border-radius: var(--radius-md);
        color: var(--cli-text-dim);
        cursor: pointer;
        transition: all var(--transition-fast);
    }

    .hamburger-btn:hover {
        background: var(--cli-selection);
        color: var(--cli-text);
        border-color: var(--cli-text-muted);
    }

    .hamburger-btn svg {
        width: 1rem;
        height: 1rem;
    }

    @media (min-width: 640px) {
        .hamburger-btn {
            display: none;
        }
    }

    /* Mobile menu */
    .mobile-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--cli-bg-elevated);
        border-bottom: 1px solid var(--cli-border);
        z-index: 100;
        animation: slideDown 0.15s ease;
        --stack-gap: 0;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .mobile-menu :global(a),
    .mobile-menu :global(button) {
        display: block;
        width: 100%;
        padding: var(--space-md);
        background: transparent;
        border: none;
        border-top: 1px solid var(--cli-border);
        border-radius: 0;
        color: var(--cli-text);
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        text-decoration: none;
        text-align: left;
        cursor: pointer;
        transition: background var(--transition-fast);
    }

    .mobile-menu :global(a:first-child),
    .mobile-menu :global(button:first-child) {
        border-top: none;
    }

    .mobile-menu :global(a:hover),
    .mobile-menu :global(button:hover) {
        background: var(--cli-selection);
    }

    @media (min-width: 640px) {
        .mobile-menu {
            display: none;
        }
    }
</style>
