<script lang="ts">
  import type { ApprovalRequest } from "../types";
  import { i18n } from "../i18n.svelte";

  interface Props {
    approval: ApprovalRequest;
    onApprove: (forSession?: boolean) => void;
    onDecline: () => void;
    onCancel: () => void;
  }

  const { approval, onApprove, onDecline, onCancel }: Props = $props();

  let selectedIndex = $state(0);

  const options = $derived.by(() => [
    { key: "Y", label: i18n.t("approval.option.proceed"), action: () => onApprove(false) },
    { key: "A", label: i18n.t("approval.option.alwaysSession"), action: () => onApprove(true) },
    { key: "N", label: i18n.t("approval.option.decline"), action: () => onDecline() },
    { key: "Esc", label: i18n.t("approval.option.cancelTurn"), action: () => onCancel() },
  ]);

  const actionLabels = $derived.by(() => ({
    command: i18n.t("approval.action.command"),
    file: i18n.t("approval.action.file"),
    mcp: i18n.t("approval.action.mcp"),
    other: i18n.t("approval.action.other"),
  }));

  const statusLabels = $derived.by(() => ({
    approved: { text: i18n.t("approval.status.approved"), color: "var(--cli-success)" },
    declined: { text: i18n.t("approval.status.declined"), color: "var(--cli-error)" },
    cancelled: { text: i18n.t("approval.status.cancelled"), color: "var(--cli-text-muted)" },
  }));

  const descriptionText = $derived.by(() => {
    const message = approval.descriptionMessage;
    if (message?.kind === "text") return message.text;
    if (message?.kind === "key") return i18n.t(message.key, message.params);
    return approval.description;
  });

  function handleOptionClick(index: number) {
    if (approval.status !== "pending") return;
    selectedIndex = index;
    options[index].action();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (approval.status !== "pending") return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = e.key.toLowerCase();

    if (key === "arrowdown" || key === "j") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
    } else if (key === "arrowup" || key === "k") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (key === "enter") {
      e.preventDefault();
      options[selectedIndex].action();
    } else if (key === "y") {
      e.preventDefault();
      onApprove(false);
    } else if (key === "a" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      onApprove(true);
    } else if (key === "n") {
      e.preventDefault();
      onDecline();
    } else if (key === "escape") {
      e.preventDefault();
      onCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="approval-card" class:resolved={approval.status !== "pending"}>
  <div class="card-header">
    <span class="header-label">{i18n.t("approval.header")}</span>
    <span class="header-type">{actionLabels[approval.type]}</span>
  </div>

  <div class="card-body">
    {#if approval.command}
      <div class="command-block">
        <span class="prompt">$</span>
        <span class="command-text">{approval.command}</span>
      </div>
    {/if}

    {#if approval.filePath}
      <div class="file-path">{approval.filePath}</div>
    {/if}

    {#if descriptionText && descriptionText !== approval.command}
      <div class="description">{descriptionText}</div>
    {/if}
  </div>

  <div class="card-actions">
    {#if approval.status === "pending"}
      {#each options as option, i}
        <button
          type="button"
          class="option-btn"
          class:focused={i === selectedIndex}
          onclick={() => handleOptionClick(i)}
        >
          <span class="option-key">{option.key}</span>
          <span class="option-label">{option.label}</span>
        </button>
      {/each}
    {:else}
      <div class="status-badge" style:color={statusLabels[approval.status].color}>
        {statusLabels[approval.status].text}
      </div>
    {/if}
  </div>
</div>

<style>
  .approval-card {
    margin: var(--space-xs) var(--space-md);
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    background: var(--cli-bg-elevated);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    overflow: hidden;
  }

  .approval-card.resolved {
    opacity: 0.6;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--cli-border);
  }

  .header-label {
    color: var(--cli-prefix-tool);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .header-type {
    color: var(--cli-text-muted);
    font-size: var(--text-xs);
  }

  .card-body {
    padding: var(--space-sm) var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .command-block {
    display: flex;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    background: var(--cli-bg);
    border-radius: var(--radius-sm);
  }

  .prompt {
    color: var(--cli-prefix-reasoning);
    font-weight: 600;
    flex-shrink: 0;
  }

  .command-text {
    color: var(--cli-text);
    word-break: break-all;
  }

  .file-path {
    color: var(--cli-prefix-user);
    font-size: var(--text-xs);
  }

  .description {
    color: var(--cli-text-dim);
    font-size: var(--text-xs);
  }

  .card-actions {
    display: flex;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    border-top: 1px solid var(--cli-border);
    flex-wrap: wrap;
  }

  .option-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: transparent;
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-sm);
    color: var(--cli-text);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .option-btn:hover {
    border-color: var(--cli-text-muted);
    background: var(--cli-bg-hover);
  }

  .option-btn.focused {
    border-color: var(--cli-prefix-agent);
    background: color-mix(in srgb, var(--cli-prefix-agent) 10%, transparent);
  }

  .option-btn.focused .option-label {
    color: var(--cli-prefix-agent);
  }

  .option-key {
    color: var(--cli-text-muted);
    font-size: var(--text-xs);
    min-width: 1.5ch;
    text-align: center;
  }

  .option-label {
    color: var(--cli-text);
  }

  .status-badge {
    font-size: var(--text-xs);
    font-weight: 600;
  }
</style>
