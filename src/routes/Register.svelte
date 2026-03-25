<script lang="ts">
  import QRCode from "qrcode";
  import { auth } from "../lib/auth.svelte";
  import { i18n } from "../lib/i18n.svelte";
  import { navigate } from "../router";
  import AuthPageLayout from "../lib/components/AuthPageLayout.svelte";

  const authMode = (import.meta.env.AUTH_MODE ?? "passkey").toLowerCase();
  const allowTotp = authMode !== "basic";
  let newUsername = $state("");
  let totpCode = $state("");
  let method = $state<"passkey" | "totp">("passkey");
  let qrDataUrl = $state("");
  let registrationStarted = $state(false);
  const isSignedIn = $derived(auth.status === "signed_in");

  $effect(() => {
    if (isSignedIn) navigate(registrationStarted ? "/device" : "/app");
  });

  async function handleRegister() {
    const username = newUsername.trim();
    if (!username) return;
    registrationStarted = true;
    if (method === "totp") {
      if (!auth.totpSetup) {
        const started = await auth.startTotpRegistration(username);
        if (started && auth.totpSetup?.otpauthUrl) {
          try {
            qrDataUrl = await QRCode.toDataURL(auth.totpSetup.otpauthUrl, {
              width: 220,
              margin: 1,
            });
          } catch {
            qrDataUrl = "";
          }
        }
        return;
      }
      await auth.completeTotpRegistration(totpCode);
      return;
    }
    await auth.register(username);
  }

  function switchMethod(next: "passkey" | "totp") {
    if (method === next) return;
    method = next;
    auth.cancelTotpRegistration();
    totpCode = "";
    qrDataUrl = "";
  }
</script>

<svelte:head>
  <title>{i18n.t("auth.register.title")}</title>
</svelte:head>

<AuthPageLayout>
  <span class="eyebrow">{i18n.t("auth.register.eyebrow")}</span>
  <h1>{i18n.t("auth.register.heading")}</h1>
  <p class="subtitle">
    {#if authMode === "basic"}
      {i18n.t("auth.register.subtitle.basic")}
    {:else if method === "totp"}
      {i18n.t("auth.register.subtitle.totp")}
    {:else}
      {i18n.t("auth.register.subtitle.passkey")}
    {/if}
  </p>

  {#if allowTotp}
    <div class="method-toggle">
      <button type="button" class:active={method === "passkey"} onclick={() => switchMethod("passkey")}>
        {i18n.t("auth.register.method.passkey")}
      </button>
      <button type="button" class:active={method === "totp"} onclick={() => switchMethod("totp")}>
        {i18n.t("auth.register.method.totp")}
      </button>
    </div>
  {/if}

  {#if auth.errorText}
    <div class="auth-error">{auth.errorText}</div>
  {/if}

  <input
    type="text"
    class="auth-input"
    placeholder={i18n.t("auth.register.usernamePlaceholder")}
    autocomplete="username"
    autocapitalize="none"
    autocorrect="off"
    spellcheck="false"
    disabled={auth.busy || (method === "totp" && Boolean(auth.totpSetup))}
    bind:value={newUsername}
    onkeydown={(e) => {
      if (e.key === "Enter" && newUsername.trim()) handleRegister();
    }}
  />
  {#if method === "totp" && auth.totpSetup}
    <div class="totp-setup">
      {#if qrDataUrl}
        <img src={qrDataUrl} alt={i18n.t("auth.register.qrAlt")} class="totp-qr" />
      {/if}
      <code class="totp-secret">{auth.totpSetup.secret}</code>
      <input
        type="text"
        class="auth-input"
        placeholder="123456"
        autocomplete="one-time-code"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        inputmode="numeric"
        pattern="[0-9]*"
        bind:value={totpCode}
        onkeydown={(e) => {
          if (e.key === "Enter" && totpCode.trim()) handleRegister();
        }}
      />
      <button
        class="ghost-btn"
        type="button"
        onclick={() => {
          auth.cancelTotpRegistration();
          totpCode = "";
          qrDataUrl = "";
        }}
        disabled={auth.busy}
      >
        {i18n.t("auth.register.restartSetup")}
      </button>
    </div>
  {/if}
  <button
    class="primary-btn"
    type="button"
    onclick={handleRegister}
    disabled={auth.busy || !newUsername.trim() || (method === "totp" && auth.totpSetup !== null && !totpCode.trim())}
  >
    {#if auth.busy}
      {i18n.t("common.working")}
    {:else if authMode === "basic"}
      {i18n.t("common.createAccount")}
    {:else if method === "totp"}
      {auth.totpSetup ? i18n.t("auth.register.submit.verifyCode") : i18n.t("auth.register.submit.setupTotp")}
    {:else}
      {i18n.t("auth.register.submit.createPasskey")}
    {/if}
  </button>
  <a class="link-btn" href="/login">{i18n.t("auth.register.backToSignIn")}</a>
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
    font-size: clamp(2.4rem, 5vw, 3.8rem);
    line-height: 0.9;
    letter-spacing: -0.018em;
    text-transform: uppercase;
  }

  .subtitle {
    margin: 0;
    color: var(--cli-text-dim);
    font-size: 1.04rem;
    line-height: 1.5;
    max-width: 32ch;
    font-family: var(--font-editorial);
  }

  .method-toggle {
    display: flex;
    gap: 0.5rem;
  }

  .method-toggle button {
    border: 1px solid var(--cli-border);
    background: transparent;
    color: var(--cli-text-dim);
    border-radius: var(--radius-md);
    padding: 0.45rem 0.65rem;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    cursor: pointer;
  }

  .method-toggle button.active {
    color: var(--cli-bg);
    background: var(--cli-text);
    border-color: var(--cli-text);
  }

  .auth-input {
    padding: 0.6rem 0.74rem;
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

  .totp-setup {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .totp-qr {
    width: 220px;
    height: 220px;
    border-radius: var(--radius-md);
    border: 1px solid var(--cli-border);
    background: white;
  }

  .totp-secret {
    padding: 0.42rem 0.56rem;
    border-radius: var(--radius-md);
    border: 1px dashed var(--cli-border);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    user-select: all;
    word-break: break-all;
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

  .ghost-btn {
    align-self: flex-start;
    padding: 0.46rem 0.64rem;
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    border: 1px solid var(--cli-border);
    background: transparent;
    color: var(--cli-text);
    cursor: pointer;
  }

  .ghost-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
