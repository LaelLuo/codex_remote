<script lang="ts">
  import { auth } from "../lib/auth.svelte";
  import { i18n, type TranslationParams } from "../lib/i18n.svelte";
  import AuthPageLayout from "../lib/components/AuthPageLayout.svelte";

  const AUTH_BASE_URL = (import.meta.env.AUTH_URL ?? "").replace(/\/$/, "");

  type UiMessage =
    | { kind: "key"; key: string; params?: TranslationParams }
    | { kind: "text"; text: string };

  let userCode = $state("");
  let busy = $state(false);
  let error = $state<UiMessage | null>(null);
  let success = $state(false);

  function setErrorKey(key: string, params?: TranslationParams) {
    error = { kind: "key", key, ...(params ? { params } : {}) };
  }

  function setErrorText(text: string) {
    error = { kind: "text", text };
  }

  function renderMessage(message: UiMessage | null): string {
    if (!message) return "";
    if (message.kind === "text") return message.text;
    return i18n.t(message.key, message.params);
  }

  async function handleAuthorise(e?: Event) {
    e?.preventDefault();
    if (busy || !userCode.trim()) return;

    busy = true;
    error = null;

    try {
      const response = await fetch(`${AUTH_BASE_URL}/auth/device/authorise`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(auth.token ? { authorization: `Bearer ${auth.token}` } : {}),
        },
        body: JSON.stringify({ userCode: userCode.trim() }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        if (data.error) {
          setErrorText(data.error);
        } else {
          setErrorKey("device.error.authorizationFailed");
        }
        return;
      }

      success = true;
      setTimeout(() => { window.location.href = "/"; }, 1500);
    } catch {
      setErrorKey("device.error.authBackendUnreachable");
    } finally {
      busy = false;
    }
  }

  function formatInput(value: string): string {
    const clean = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
    if (clean.length > 4) {
      return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return clean;
  }

  function handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    userCode = formatInput(input.value);
    input.value = userCode;
  }
</script>

<svelte:head>
  <title>{i18n.t("device.title")}</title>
</svelte:head>

<AuthPageLayout>
  <span class="eyebrow">{i18n.t("device.eyebrow")}</span>

  {#if auth.status === "loading"}
    <h1>{i18n.t("device.loading")}</h1>
    <p class="subtitle">{i18n.t("device.checkingSession")}</p>
  {:else if auth.status !== "signed_in"}
    <h1>{i18n.t("device.signInRequired")}</h1>
    <p class="subtitle">{i18n.t("device.signInRequiredSubtitle")}</p>
    <a href="/" class="primary-link">{i18n.t("device.goToSignIn")}</a>
  {:else if success}
    <h1>{i18n.t("device.authorised")}</h1>
    <p class="subtitle">{i18n.t("device.authorisedSubtitle")}</p>
    <a href="/app" class="link-btn">{i18n.t("device.openApp")}</a>
  {:else}
    <h1>{i18n.t("device.connectAnchor")}</h1>
    <p class="subtitle">{i18n.t("device.enterCodeHint")}</p>

    {#if error}
      <div class="auth-error">{renderMessage(error)}</div>
    {/if}

    <form class="form stack" onsubmit={handleAuthorise}>
      <input
        type="text"
        class="auth-input code-input"
        placeholder="XXXX-XXXX"
        value={userCode}
        oninput={handleInput}
        maxlength="9"
        autocomplete="off"
        spellcheck="false"
      />
      <button
        type="submit"
        class="primary-btn"
        disabled={busy || userCode.replace(/-/g, "").length !== 8}
      >
        {busy ? i18n.t("device.authorising") : i18n.t("device.authorise")}
      </button>
    </form>
  {/if}
</AuthPageLayout>

<style>
  .eyebrow {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--cli-text-muted);
  }

  h1 {
    margin: 0;
    font-size: clamp(2.2rem, 5vw, 3.6rem);
    line-height: 0.9;
    letter-spacing: -0.018em;
    text-transform: uppercase;
  }

  .subtitle {
    margin: 0;
    color: var(--cli-text-dim);
    font-size: 1.02rem;
    line-height: 1.5;
    max-width: 34ch;
    font-family: var(--font-editorial);
  }

  .auth-error {
    padding: 0.62rem 0.72rem;
    border-radius: var(--radius-md);
    background: var(--cli-error-bg);
    border: 1px solid color-mix(in srgb, var(--cli-error) 46%, transparent);
    color: var(--cli-error);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: 0.01em;
  }

  .form {
    --stack-gap: var(--space-md);
  }

  .auth-input {
    padding: 0.62rem 0.74rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--cli-border);
    background: var(--cli-bg);
    color: var(--cli-text);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    letter-spacing: 0.008em;
    text-transform: none;
    outline: none;
  }

  .auth-input:focus {
    border-color: var(--cli-text-dim);
  }

  .code-input {
    text-align: center;
    letter-spacing: 0.15em;
    font-family: var(--font-mono);
    font-size: 1.22rem;
  }

  .code-input::placeholder {
    color: var(--cli-text-muted);
    letter-spacing: 0.15em;
  }

  .primary-btn {
    padding: 0.58rem 0.72rem;
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    line-height: 1;
    cursor: pointer;
    border: 1px solid var(--cli-prefix-agent);
    background: var(--cli-prefix-agent);
    color: var(--color-text-inverse);
    box-shadow: var(--shadow-sm);
  }

  .primary-btn:hover {
    filter: brightness(0.94);
  }

  .primary-btn:disabled {
    opacity: 1;
    background: color-mix(in srgb, var(--cli-prefix-agent) 58%, var(--cli-bg-elevated));
    border-color: color-mix(in srgb, var(--cli-prefix-agent) 48%, var(--cli-border));
    color: var(--cli-text-muted);
    cursor: not-allowed;
    box-shadow: none;
  }

  .primary-link {
    align-self: flex-start;
    padding: 0.58rem 0.72rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--cli-prefix-agent);
    background: var(--cli-prefix-agent);
    color: var(--color-text-inverse);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    text-decoration: none;
    box-shadow: var(--shadow-sm);
  }

  .link-btn {
    align-self: flex-start;
    color: var(--cli-text-dim);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    text-decoration: none;
    border-bottom: 1px solid color-mix(in srgb, var(--cli-text-muted) 60%, transparent);
  }

  .link-btn:hover {
    color: var(--cli-text);
  }
</style>
