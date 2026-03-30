<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { i18n } from "../i18n.svelte";
  import type { SandboxMode } from "../types";

  interface Props {
    sandbox: SandboxMode;
    disabled?: boolean;
  }

  const { sandbox, disabled = false }: Props = $props();

  const dispatch = createEventDispatcher<{
    change: { value: SandboxMode };
  }>();

  let open = $state(false);

  const sandboxOptions: SandboxMode[] = ["read-only", "workspace-write", "danger-full-access"];

  function sandboxLabel(value: SandboxMode): string {
    if (value === "read-only") return i18n.t("appHeader.sandbox.readOnly");
    if (value === "danger-full-access") return i18n.t("appHeader.sandbox.fullAccess");
    return i18n.t("appHeader.sandbox.workspace");
  }

  function handleWindowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".sandbox-picker")) {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="sandbox-picker" class:open>
  <button
    type="button"
    class="sandbox-btn row"
    class:danger={sandbox === "danger-full-access"}
    {disabled}
    onclick={(event) => {
      event.stopPropagation();
      if (disabled) return;
      open = !open;
    }}
  >
    <svg class="shield-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
    <span class="sandbox-label">{sandboxLabel(sandbox)}</span>
    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </button>

  {#if open}
    <div class="sandbox-menu">
      {#each sandboxOptions as option}
        <button
          type="button"
          class="sandbox-item split"
          class:selected={sandbox === option}
          class:danger={option === "danger-full-access"}
          onclick={() => {
            dispatch("change", { value: option });
            open = false;
          }}
        >
          <span>{sandboxLabel(option)}</span>
          {#if sandbox === option}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sandbox-picker {
    position: relative;
    display: inline-flex;
    align-self: center;
  }

  .sandbox-btn {
    --row-gap: var(--space-xs);
    padding: 0.32rem 0.56rem;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--cli-border) 52%, transparent);
    border-radius: var(--radius-md);
    color: var(--cli-text-dim);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .sandbox-btn:hover:not(:disabled) {
    background: var(--cli-bg-hover);
    color: var(--cli-text);
    border-color: color-mix(in srgb, var(--cli-border) 72%, transparent);
  }

  .sandbox-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .sandbox-btn.danger {
    color: color-mix(in srgb, var(--cli-error) 84%, var(--cli-text-dim));
    border-color: color-mix(in srgb, var(--cli-error) 35%, var(--cli-border));
  }

  .shield-icon {
    width: 0.95rem;
    height: 0.95rem;
    flex-shrink: 0;
  }

  .sandbox-label {
    white-space: nowrap;
  }

  .chevron {
    width: 0.75rem;
    height: 0.75rem;
    opacity: 0.5;
  }

  .sandbox-menu {
    position: absolute;
    bottom: calc(100% + var(--space-xs));
    left: 0;
    min-width: 11rem;
    padding: var(--space-xs);
    background: var(--cli-bg-elevated);
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-popover);
    z-index: 100;
    animation: fadeIn 0.1s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .sandbox-item {
    --split-gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-sm);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--cli-text);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    text-align: left;
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .sandbox-item:hover {
    background: var(--cli-bg-hover);
  }

  .sandbox-item.selected {
    color: var(--cli-prefix-agent);
  }

  .sandbox-item.danger {
    color: var(--cli-error);
  }

  .sandbox-item svg {
    width: 0.875rem;
    height: 0.875rem;
    flex-shrink: 0;
  }
</style>
