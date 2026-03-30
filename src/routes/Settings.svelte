<script lang="ts">
  import QRCode from "qrcode";
  import { auth } from "../lib/auth.svelte";
  import { buildAccountAuthCardModel } from "../lib/account-auth-card";
  import { theme } from "../lib/theme.svelte";
  import { i18n, type Locale, type TranslationParams } from "../lib/i18n.svelte";
  import { config } from "../lib/config.svelte";
  import { connectionManager } from "../lib/connection-manager.svelte";
  import { getSocketErrorMessage, socket } from "../lib/socket.svelte";
  import AppHeader from "../lib/components/AppHeader.svelte";
  import NotificationSettings from "../lib/components/NotificationSettings.svelte";
  import ReleaseCockpit from "../lib/components/ReleaseCockpit.svelte";
  import { anchors } from "../lib/anchors.svelte";
  import { releaseCockpit } from "../lib/release-cockpit.svelte";

  const themeIcons = { system: "◐", light: "○", dark: "●" } as const;

  const anchorList = $derived(anchors.list);
  const selectedAnchorId = $derived(anchors.selectedId);

  const platformLabels: Record<string, string> = {
    darwin: "macOS",
    linux: "Linux",
    win32: "Windows",
  };

  const urlLocked = $derived(
    socket.status === "connected" || socket.status === "connecting" || socket.status === "reconnecting"
  );
  const canDisconnect = $derived(
    socket.status === "connected" || socket.status === "connecting" || socket.status === "reconnecting"
  );
  const canConnect = $derived(socket.status === "disconnected" || socket.status === "error");
  const isSocketConnected = $derived(socket.status === "connected");
  const canManageCodexConfig = $derived(auth.isLocalMode || Boolean(selectedAnchorId));
  const canManageRelease = $derived(auth.isLocalMode || Boolean(selectedAnchorId));
  const connectionActionLabel = $derived.by(() => {
    if (socket.status === "connecting") return i18n.t("common.cancel");
    if (socket.status === "reconnecting") return i18n.t("common.stopReconnect");
    if (socket.status === "connected") return i18n.t("common.disconnect");
    return i18n.t("common.connect");
  });

  type UiMessage =
    | { kind: "key"; key: string; params?: TranslationParams }
    | { kind: "text"; text: string };

  type MessageLike = UiMessage | { kind: "key"; key: string; params?: TranslationParams } | { kind: "text"; text: string } | null;

  let codexConfigPath = $state("");
  let codexConfigCandidates = $state<string[]>([]);
  let codexConfigPlatform = $state("");
  let codexConfigExists = $state(false);
  let codexConfigContent = $state("");
  let codexConfigLoading = $state(false);
  let codexConfigSaving = $state(false);
  let codexConfigDirty = $state(false);
  let codexConfigError = $state<UiMessage | null>(null);
  let codexConfigInfo = $state<UiMessage | null>(null);
  let codexConfigLoadedFor = $state<string | null>(null);
  let accountTotpCode = $state("");
  let accountTotpQrDataUrl = $state("");

  const accountAuthCard = $derived.by(() =>
    buildAccountAuthCardModel({
      hasPasskey: auth.hasPasskey,
      hasTotp: auth.hasTotp,
      accountTotpFlow: auth.accountTotpFlow,
      accountNotice: auth.accountNotice,
    }),
  );
  const accountRowActionsDisabled = $derived(auth.busy || auth.accountTotpFlow !== "idle");
  const accountTotpSubmitKey = $derived(
    auth.accountTotpMode === "rebind" ? "settings.account.totp.rebind" : "settings.account.totp.bind",
  );

  function toMessageText(message: MessageLike): string {
    if (!message) return "";
    if (message.kind === "text") return message.text;
    return i18n.t(message.key, message.params);
  }

  function setCodexConfigErrorKey(key: string, params?: TranslationParams) {
    codexConfigError = { kind: "key", key, ...(params ? { params } : {}) };
  }

  function setCodexConfigErrorText(text: string) {
    codexConfigError = { kind: "text", text };
  }

  function setCodexConfigInfoKey(key: string, params?: TranslationParams) {
    codexConfigInfo = { kind: "key", key, ...(params ? { params } : {}) };
  }

  function setCodexConfigErrorFromUnknown(err: unknown, fallbackKey: string) {
    const socketMessage = getSocketErrorMessage(err);
    if (socketMessage?.kind === "key") {
      setCodexConfigErrorKey(socketMessage.key, socketMessage.params);
      return;
    }
    if (socketMessage?.kind === "text") {
      setCodexConfigErrorText(socketMessage.text);
      return;
    }
    if (err instanceof Error) {
      setCodexConfigErrorText(err.message);
      return;
    }
    setCodexConfigErrorKey(fallbackKey);
  }

  function formatSince(iso: string): string {
    const date = new Date(iso);
    return i18n.formatDate(date, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleSelectAnchor(anchorId: string) {
    anchors.select(anchorId);
  }

  function resolveConfigTargetKey(): string {
    if (auth.isLocalMode) return "local";
    if (!selectedAnchorId) return "anchor:none";
    return `anchor:${selectedAnchorId}`;
  }

  function resolveAnchorIdForConfig(): string | undefined {
    if (auth.isLocalMode) return undefined;
    const candidate = selectedAnchorId?.trim();
    return candidate ? candidate : undefined;
  }

  function resolveAnchorIdForRelease(): string | undefined {
    if (auth.isLocalMode) return undefined;
    const candidate = selectedAnchorId?.trim();
    return candidate ? candidate : undefined;
  }

  async function loadCodexConfig(path?: string, force = false) {
    if (!isSocketConnected) {
      setCodexConfigErrorKey("settings.hint.connectFirstLoadConfig");
      return;
    }
    if (!canManageCodexConfig) {
      setCodexConfigErrorKey("settings.hint.selectDeviceLoadConfig");
      return;
    }
    if (codexConfigDirty && !force && !path) {
      setCodexConfigInfoKey("settings.hint.unsavedChangesDetected");
      return;
    }

    codexConfigLoading = true;
    codexConfigError = null;
    codexConfigInfo = null;
    try {
      const result = await socket.readCodexConfig(path, resolveAnchorIdForConfig());
      codexConfigPath = result.path;
      codexConfigCandidates = result.candidates;
      codexConfigPlatform = platformLabels[result.platform] ?? result.platform;
      codexConfigExists = result.exists;
      codexConfigContent = result.content;
      codexConfigDirty = false;
      codexConfigLoadedFor = resolveConfigTargetKey();
      if (result.exists) {
        setCodexConfigInfoKey("settings.hint.loadedPath", { path: result.path });
      } else {
        setCodexConfigInfoKey("settings.hint.configWillCreateAtPath", { path: result.path });
      }
    } catch (err) {
      setCodexConfigErrorFromUnknown(err, "settings.hint.failedLoadConfig");
    } finally {
      codexConfigLoading = false;
    }
  }

  async function saveCodexConfig() {
    if (!isSocketConnected) {
      setCodexConfigErrorKey("settings.hint.connectFirstSaveConfig");
      return;
    }
    if (!canManageCodexConfig) {
      setCodexConfigErrorKey("settings.hint.selectDeviceSaveConfig");
      return;
    }
    if (!codexConfigPath.trim()) {
      setCodexConfigErrorKey("settings.hint.configPathEmpty");
      return;
    }

    codexConfigSaving = true;
    codexConfigError = null;
    codexConfigInfo = null;
    try {
      const result = await socket.writeCodexConfig(codexConfigContent, codexConfigPath, resolveAnchorIdForConfig());
      codexConfigPath = result.path;
      if (!codexConfigCandidates.includes(result.path)) {
        codexConfigCandidates = [result.path, ...codexConfigCandidates];
      }
      codexConfigExists = true;
      codexConfigDirty = false;
      codexConfigLoadedFor = resolveConfigTargetKey();
      setCodexConfigInfoKey("settings.hint.savedPath", { path: result.path });
    } catch (err) {
      setCodexConfigErrorFromUnknown(err, "settings.hint.failedSaveConfig");
    } finally {
      codexConfigSaving = false;
    }
  }

  function handleConfigContentInput(value: string) {
    codexConfigContent = value;
    codexConfigDirty = true;
    codexConfigInfo = null;
  }

  function handleConfigPathSelect(path: string) {
    if (!path || path === codexConfigPath) return;
    void loadCodexConfig(path, true);
  }

  $effect(() => {
    if (!isSocketConnected) return;
    if (!canManageCodexConfig) return;
    const targetKey = resolveConfigTargetKey();
    if (codexConfigLoadedFor === targetKey) return;
    if (codexConfigDirty) return;
    void loadCodexConfig(undefined, true);
  });

  $effect(() => {
    if (!isSocketConnected || !canManageRelease) {
      releaseCockpit.stopPolling();
    }
  });

  function inspectRelease(params: { repoPath?: string; targetRef?: string; tag?: string }) {
    void releaseCockpit.inspectRelease({
      ...params,
      ...(resolveAnchorIdForRelease() ? { anchorId: resolveAnchorIdForRelease() } : {}),
    });
  }

  function startRelease(params: { repoPath?: string; targetRef?: string; tag?: string; dryRun?: boolean }) {
    void releaseCockpit.startRelease({
      ...params,
      ...(resolveAnchorIdForRelease() ? { anchorId: resolveAnchorIdForRelease() } : {}),
    });
  }

  function pollReleaseStatus() {
    void releaseCockpit.pollStatus(resolveAnchorIdForRelease());
  }

  function startReleasePolling() {
    releaseCockpit.startPolling(resolveAnchorIdForRelease());
  }

  async function handleAccountTotpSubmit() {
    const code = accountTotpCode.trim();
    if (!code) return;
    await auth.completeAccountTotpSetup(code);
  }

  function resetAccountTotpUi() {
    accountTotpCode = "";
    accountTotpQrDataUrl = "";
  }

  $effect(() => {
    if (!auth.totpSetup?.otpauthUrl || auth.accountTotpFlow !== "setting_up") {
      accountTotpQrDataUrl = "";
      return;
    }

    let cancelled = false;
    void QRCode.toDataURL(auth.totpSetup.otpauthUrl, {
      width: 220,
      margin: 1,
    })
      .then((value) => {
        if (!cancelled) accountTotpQrDataUrl = value;
      })
      .catch(() => {
        if (!cancelled) accountTotpQrDataUrl = "";
      });

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (auth.totpSetup) return;
    accountTotpCode = "";
  });

  $effect(() => {
    return () => {
      auth.clearAccountNotice();
    };
  });

</script>

<svelte:head>
  <title>{i18n.t("settings.title")}</title>
</svelte:head>

<div class="settings stack">
  <AppHeader status={socket.status}>
    {#snippet actions()}
      <button
        type="button"
        onclick={() => theme.cycle()}
        title={i18n.t("common.themeTitle", { theme: i18n.themeName(theme.current) })}
      >
        {themeIcons[theme.current]}
      </button>
    {/snippet}
  </AppHeader>

  <div class="content stack">
    <section class="settings-masthead stack">
      <span class="settings-kicker">{i18n.t("settings.kicker")}</span>
      <h1>{i18n.t("settings.heading")}</h1>
      <p>{i18n.t("settings.summary")}</p>
    </section>

    <div class="section stack">
      <div class="section-header">
        <span class="section-index">01</span>
        <span class="section-title">{i18n.t("settings.section.connection")}</span>
      </div>
      <div class="section-body stack">
        <div class="field stack">
          <label for="orbit-url">{auth.isLocalMode ? i18n.t("settings.label.anchorUrl") : i18n.t("settings.label.orbitUrl")}</label>
          <input
            id="orbit-url"
            type="text"
            bind:value={config.url}
            placeholder={auth.isLocalMode ? "ws://<anchor-ip>:8788/ws" : "wss://orbit.example.com/ws/client"}
            disabled={urlLocked}
          />
        </div>
        <div class="connect-actions row">
          <button
            class="action-btn"
            type="button"
            onclick={() => {
              if (canDisconnect) {
                connectionManager.requestDisconnect();
              } else if (canConnect) {
                connectionManager.requestConnect();
              }
            }}
            disabled={!canDisconnect && !canConnect}
          >
            {connectionActionLabel}
          </button>
        </div>
        {#if socket.error}
          <p class="hint hint-error">{toMessageText(socket.error)}</p>
        {/if}
        <p class="hint">
          {socket.status === "disconnected"
            ? i18n.t("settings.hint.autoConnectPaused")
            : i18n.t("settings.hint.autoConnectActive")}
        </p>
        {#if auth.isLocalMode}
          <p class="hint hint-local">
            {i18n.t("settings.hint.localMode")}
          </p>
        {/if}
      </div>
    </div>

    <div class="section stack">
      <div class="section-header">
        <span class="section-index">02</span>
        <span class="section-title">{i18n.t("settings.section.devices")}</span>
      </div>
      <div class="section-body stack">
        {#if !isSocketConnected}
          <p class="hint">
            {i18n.t("settings.hint.connectToLoadDevices")}
          </p>
        {:else if anchorList.length === 0}
          <p class="hint">
            {i18n.t("settings.hint.noDevices")}
          </p>
        {:else}
          <ul class="anchor-list">
            {#each anchorList as anchor (anchor.id)}
              <li class="anchor-item">
                <button
                  type="button"
                  class="anchor-select"
                  class:selected={selectedAnchorId === anchor.id}
                  onclick={() => handleSelectAnchor(anchor.id)}
                  aria-pressed={selectedAnchorId === anchor.id}
                >
                  <span class="anchor-status" title={i18n.t("settings.hint.deviceConnectedTitle")}>●</span>
                </button>
                <div class="anchor-info">
                  <span class="anchor-hostname">{anchor.hostname}</span>
                  <span class="anchor-meta">
                    {i18n.t("settings.hint.deviceMeta", {
                      platform: platformLabels[anchor.platform] ?? anchor.platform,
                      since: formatSince(anchor.connectedAt),
                    })}
                  </span>
                </div>
                {#if selectedAnchorId === anchor.id}
                  <span class="anchor-selected-label">{i18n.t("settings.hint.selected")}</span>
                {/if}
              </li>
            {/each}
          </ul>
          {#if !selectedAnchorId}
            <p class="hint hint-error">{i18n.t("settings.hint.selectDeviceForSessions")}</p>
          {/if}
        {/if}
      </div>
    </div>

    <div class="section stack">
      <div class="section-header">
        <span class="section-index">03</span>
        <span class="section-title">{i18n.t("settings.section.codexConfig")}</span>
      </div>
      <div class="section-body stack">
        {#if !isSocketConnected}
          <p class="hint">{i18n.t("settings.hint.connectFirstReadEditConfig")}</p>
        {:else if !canManageCodexConfig}
          <p class="hint">{i18n.t("settings.hint.selectDeviceEditConfig")}</p>
        {:else}
          <div class="field stack">
            <label for="codex-config-path">{i18n.t("settings.label.configPath")}</label>
            {#if codexConfigCandidates.length > 1}
              <select
                id="codex-config-path"
                value={codexConfigPath}
                onchange={(e) => handleConfigPathSelect((e.currentTarget as HTMLSelectElement).value)}
                disabled={codexConfigLoading || codexConfigSaving}
              >
                {#each codexConfigCandidates as path}
                  <option value={path}>{path}</option>
                {/each}
              </select>
            {:else}
              <input
                id="codex-config-path"
                type="text"
                value={codexConfigPath}
                readonly
                disabled
              />
            {/if}
          </div>

          {#if codexConfigPlatform}
            <p class="hint">{i18n.t("settings.hint.detectedOs", { os: codexConfigPlatform })}</p>
          {/if}
          <p class="hint">
            {codexConfigExists
              ? i18n.t("settings.hint.editingExisting")
              : i18n.t("settings.hint.fileNotExistYet")}
          </p>

          <div class="field stack">
            <label for="codex-config-content">{i18n.t("settings.label.configContents")}</label>
            <textarea
              id="codex-config-content"
              class="config-editor"
              value={codexConfigContent}
              oninput={(e) => handleConfigContentInput((e.currentTarget as HTMLTextAreaElement).value)}
              placeholder={'model = "o3"\napproval_policy = "on-request"\nsandbox_mode = "workspace-write"'}
              spellcheck="false"
              disabled={codexConfigLoading || codexConfigSaving}
            ></textarea>
          </div>

          <div class="connect-actions row">
            <button
              class="action-btn"
              type="button"
              onclick={() => loadCodexConfig(undefined, true)}
              disabled={codexConfigLoading || codexConfigSaving}
            >
              {codexConfigLoading ? i18n.t("common.loading") : i18n.t("common.reload")}
            </button>
            <button
              class="action-btn"
              type="button"
              onclick={saveCodexConfig}
              disabled={codexConfigLoading || codexConfigSaving || !codexConfigPath || !codexConfigDirty}
            >
              {codexConfigSaving ? i18n.t("common.working") : i18n.t("common.save")}
            </button>
          </div>
          {#if codexConfigDirty}
            <p class="hint">{i18n.t("settings.hint.unsavedChanges")}</p>
          {/if}
          {#if codexConfigInfo}
            <p class="hint hint-local">{toMessageText(codexConfigInfo)}</p>
          {/if}
          {#if codexConfigError}
            <p class="hint hint-error">{toMessageText(codexConfigError)}</p>
          {/if}
        {/if}
      </div>
    </div>

    <div class="section stack">
      <div class="section-header">
        <span class="section-index">04</span>
        <span class="section-title">{i18n.t("settings.section.language")}</span>
      </div>
      <div class="section-body stack">
        <div class="field stack">
          <label for="ui-language">{i18n.t("common.language")}</label>
          <select
            id="ui-language"
            value={i18n.current}
            onchange={(e) => i18n.set((e.currentTarget as HTMLSelectElement).value as Locale)}
          >
            <option value="en">{i18n.t("common.english")}</option>
            <option value="zh-CN">{i18n.t("common.chineseSimplified")}</option>
          </select>
        </div>
        <p class="hint">{i18n.t("settings.language.help")}</p>
      </div>
    </div>

    <NotificationSettings sectionIndex="05" />

    <ReleaseCockpit
      sectionIndex="06"
      connected={isSocketConnected}
      canManage={canManageRelease}
      inspect={releaseCockpit.inspect}
      status={releaseCockpit.status}
      inspectLoading={releaseCockpit.inspectLoading}
      startLoading={releaseCockpit.startLoading}
      statusLoading={releaseCockpit.statusLoading}
      polling={releaseCockpit.polling}
      error={releaseCockpit.error}
      info={releaseCockpit.info}
      onInspect={inspectRelease}
      onStart={startRelease}
      onPoll={pollReleaseStatus}
      onStartPolling={startReleasePolling}
      onStopPolling={() => releaseCockpit.stopPolling()}
    />

    {#if !auth.isLocalMode}
      <div class="section stack">
        <div class="section-header">
          <span class="section-index">07</span>
          <span class="section-title">{i18n.t("settings.section.account")}</span>
        </div>
        <div class="section-body stack">
          <div class="account-card stack">
            <div class="account-card-header stack">
              <div class="account-card-title-row">
                <div class="stack account-card-title-block">
                  <span class="account-card-title">{i18n.t(accountAuthCard.titleKey)}</span>
                  <p class="hint account-scope-hint">{i18n.t("settings.account.hint.signInMethodsScope")}</p>
                </div>
                {#if auth.user}
                  <span class="account-username">{auth.user.name}</span>
                {/if}
              </div>
            </div>

            <div class="account-method-list">
              <div class="account-method-row">
                <div class="account-method-copy">
                  <span class="account-method-label">{i18n.t("auth.login.method.passkey")}</span>
                  <span class="account-method-status">{i18n.t(accountAuthCard.passkey.statusKey)}</span>
                </div>
                {#if accountAuthCard.passkey.actionKey}
                  <button
                    class="action-btn"
                    type="button"
                    onclick={() => void auth.addPasskeyForCurrentUser()}
                    disabled={accountRowActionsDisabled}
                  >
                    {i18n.t(accountAuthCard.passkey.actionKey)}
                  </button>
                {/if}
              </div>

              <div class="account-method-row">
                <div class="account-method-copy">
                  <span class="account-method-label">{i18n.t("auth.login.method.totp")}</span>
                  <span class="account-method-status">{i18n.t(accountAuthCard.totp.statusKey)}</span>
                </div>
                {#if accountAuthCard.totp.actionKey}
                  <button
                    class="action-btn"
                    type="button"
                    onclick={() => {
                      if (auth.hasTotp) {
                        auth.requestAccountTotpRebind();
                        return;
                      }
                      void auth.beginAccountTotpSetup();
                    }}
                    disabled={accountRowActionsDisabled}
                  >
                    {i18n.t(accountAuthCard.totp.actionKey)}
                  </button>
                {/if}
              </div>
            </div>

            {#if accountAuthCard.confirmation}
              <div class="account-callout account-callout-warning stack">
                <strong>{i18n.t(accountAuthCard.confirmation.titleKey)}</strong>
                <p class="hint">{i18n.t(accountAuthCard.confirmation.detailKey)}</p>
                <p class="hint">{i18n.t(accountAuthCard.confirmation.noteKey)}</p>
                <div class="row account-callout-actions">
                  <button
                    class="action-btn"
                    type="button"
                    onclick={() => void auth.confirmAccountTotpRebind()}
                    disabled={auth.busy}
                  >
                    {i18n.t("settings.account.totp.rebind")}
                  </button>
                  <button
                    class="action-btn"
                    type="button"
                    onclick={() => {
                      auth.cancelAccountTotpSetup();
                      resetAccountTotpUi();
                    }}
                    disabled={auth.busy}
                  >
                    {i18n.t("common.cancel")}
                  </button>
                </div>
              </div>
            {/if}

            {#if auth.accountTotpFlow === "setting_up" && auth.totpSetup}
              <div class="account-callout stack">
                <p class="hint">{i18n.t("settings.account.totp.setupHint")}</p>
                {#if accountTotpQrDataUrl}
                  <img src={accountTotpQrDataUrl} alt={i18n.t("auth.register.qrAlt")} class="totp-qr" />
                {/if}
                <code class="totp-secret">{auth.totpSetup.secret}</code>
                <input
                  type="text"
                  class="field-input"
                  placeholder={i18n.t("settings.account.totp.codePlaceholder")}
                  autocomplete="one-time-code"
                  autocapitalize="none"
                  autocorrect="off"
                  spellcheck="false"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  bind:value={accountTotpCode}
                  onkeydown={(event) => {
                    if (event.key === "Enter" && accountTotpCode.trim()) {
                      void handleAccountTotpSubmit();
                    }
                  }}
                />
                <div class="row account-callout-actions">
                  <button
                    class="action-btn"
                    type="button"
                    onclick={() => void handleAccountTotpSubmit()}
                    disabled={auth.busy || !accountTotpCode.trim()}
                  >
                    {i18n.t(accountTotpSubmitKey)}
                  </button>
                  <button
                    class="action-btn"
                    type="button"
                    onclick={() => {
                      auth.cancelAccountTotpSetup();
                      resetAccountTotpUi();
                    }}
                    disabled={auth.busy}
                  >
                    {i18n.t("common.cancel")}
                  </button>
                </div>
              </div>
            {/if}

            {#if accountAuthCard.notice}
              <p class="hint hint-success">{toMessageText(accountAuthCard.notice)}</p>
            {/if}

            {#if auth.errorText}
              <p class="hint hint-error">{auth.errorText}</p>
            {/if}
          </div>

          <button class="action-btn danger" type="button" onclick={() => auth.signOut()}>
            {i18n.t("settings.button.signOut")}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .settings {
    --stack-gap: 0;
    min-height: 100vh;
    background: var(--cli-bg);
    color: var(--cli-text);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .content {
    --stack-gap: var(--space-lg);
    padding: var(--space-md) var(--space-md) var(--space-xl);
    max-width: min(1480px, calc(100vw - var(--space-md) * 2));
    margin: 0 auto;
    width: 100%;
  }

  .settings-masthead {
    --stack-gap: 0.3rem;
    padding: 0.3rem 0 0.6rem;
  }

  .settings-kicker {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--cli-text-muted);
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(3rem, 9vw, 6.8rem);
    line-height: 0.82;
    letter-spacing: -0.015em;
    text-transform: uppercase;
  }

  .settings-masthead p {
    margin: 0;
    max-width: 56ch;
    color: var(--cli-text-dim);
    font-family: var(--font-editorial);
    font-size: 1rem;
    line-height: 1.45;
  }

  .section {
    --stack-gap: 0;
    border: 1px solid color-mix(in srgb, var(--cli-border) 46%, transparent);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: color-mix(in srgb, var(--cli-bg-elevated) 78%, transparent);
  }

  .section-header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: var(--space-sm) var(--space-md);
    background: color-mix(in srgb, var(--cli-bg-elevated) 90%, var(--cli-bg));
    border-bottom: 1px solid color-mix(in srgb, var(--cli-border) 46%, transparent);
  }

  .section-index {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.11em;
    color: var(--cli-prefix-agent);
    font-weight: 600;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 1.15rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--cli-text);
    font-weight: 500;
  }

  .section-body {
    --stack-gap: var(--space-md);
    padding: var(--space-md);
  }

  .field {
    --stack-gap: var(--space-xs);
  }

  .field label {
    font-family: var(--font-mono);
    color: var(--cli-text-dim);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
  }

  .field input {
    padding: 0.55rem 0.62rem;
    background: var(--cli-bg);
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    color: var(--cli-text);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
  }

  .field-input {
    padding: 0.55rem 0.62rem;
    background: var(--cli-bg);
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    color: var(--cli-text);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
  }

  .field select {
    padding: 0.55rem 0.62rem;
    background: var(--cli-bg);
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    color: var(--cli-text);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
  }

  .field input:focus,
  .field select:focus,
  .field-input:focus {
    outline: none;
    border-color: var(--cli-prefix-agent);
  }

  .field input:disabled,
  .field select:disabled,
  .field-input:disabled {
    opacity: 0.6;
    background: var(--cli-bg-elevated);
  }

  .config-editor {
    min-height: 13rem;
    width: 100%;
    padding: 0.62rem 0.68rem;
    background: var(--cli-bg);
    border: 1px solid var(--cli-border);
    border-radius: var(--radius-md);
    color: var(--cli-text);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.45;
    resize: vertical;
  }

  .config-editor:focus {
    outline: none;
    border-color: var(--cli-prefix-agent);
  }

  .config-editor:disabled {
    opacity: 0.6;
    background: var(--cli-bg-elevated);
  }

  .connect-actions {
    align-items: center;
    gap: var(--space-sm);
  }

  .action-btn {
    padding: var(--space-xs) var(--space-sm);
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--cli-border) 72%, transparent);
    border-radius: var(--radius-md);
    color: var(--cli-text);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.035em;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .action-btn:hover:enabled {
    background: var(--cli-bg-hover);
    border-color: var(--cli-text-muted);
  }

  .action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-btn.danger {
    color: var(--cli-error);
    border-color: color-mix(in srgb, var(--cli-error) 42%, var(--cli-border));
  }

  .action-btn.danger:hover {
    background: var(--cli-error-bg);
    border-color: var(--cli-error);
  }

  .anchor-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .anchor-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    padding: var(--space-xs) 0;
  }

  .anchor-select {
    border: 1px solid var(--cli-border);
    background: transparent;
    border-radius: 999px;
    width: 1.2rem;
    height: 1.2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
  }

  .anchor-select.selected {
    border-color: var(--cli-prefix-agent);
    background: color-mix(in srgb, var(--cli-prefix-agent) 22%, transparent);
  }

  .anchor-status {
    font-size: var(--text-xs);
    color: var(--cli-success, #4ade80);
    margin-top: 1px;
  }

  .anchor-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .anchor-hostname {
    color: var(--cli-text);
    font-weight: 500;
  }

  .anchor-meta {
    color: var(--cli-text-muted);
    font-size: var(--text-xs);
  }

  .anchor-selected-label {
    margin-left: auto;
    color: var(--cli-prefix-agent);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-top: 2px;
  }

  .hint {
    color: var(--cli-text-muted);
    font-size: 0.78rem;
    line-height: 1.5;
    margin: 0;
    font-family: var(--font-sans);
  }

  .hint-error {
    color: var(--cli-error);
  }

  .hint-success {
    color: var(--cli-success, #4ade80);
  }

  .hint-local {
    color: var(--cli-success, #4ade80);
  }

  .account-card {
    --stack-gap: var(--space-md);
    padding: var(--space-md);
    border: 1px solid color-mix(in srgb, var(--cli-border) 54%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--cli-bg) 84%, var(--cli-bg-elevated));
  }

  .account-card-header {
    --stack-gap: var(--space-xs);
  }

  .account-card-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .account-card-title-block {
    --stack-gap: 0.25rem;
  }

  .account-card-title {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--cli-text-dim);
    font-weight: 600;
  }

  .account-scope-hint {
    max-width: 56ch;
  }

  .account-username {
    padding: 0.24rem 0.5rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--cli-border) 54%, transparent);
    color: var(--cli-text);
    font-size: var(--text-xs);
    line-height: 1.2;
  }

  .account-method-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .account-method-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: 0.78rem 0.82rem;
    border: 1px solid color-mix(in srgb, var(--cli-border) 46%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--cli-bg-elevated) 72%, transparent);
  }

  .account-method-copy {
    display: flex;
    flex-direction: column;
    gap: 0.16rem;
    min-width: 0;
  }

  .account-method-label {
    color: var(--cli-text);
    font-size: 0.86rem;
    font-weight: 600;
  }

  .account-method-status {
    color: var(--cli-text-muted);
    font-size: var(--text-xs);
  }

  .account-callout {
    --stack-gap: 0.65rem;
    padding: 0.82rem;
    border-radius: var(--radius-md);
    border: 1px solid color-mix(in srgb, var(--cli-border) 50%, transparent);
    background: color-mix(in srgb, var(--cli-bg-elevated) 76%, transparent);
  }

  .account-callout-warning {
    border-color: color-mix(in srgb, var(--cli-prefix-agent) 42%, var(--cli-border));
    background: color-mix(in srgb, var(--cli-prefix-agent) 10%, var(--cli-bg-elevated));
  }

  .account-callout-actions {
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .totp-qr {
    width: 220px;
    height: 220px;
    max-width: 100%;
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
</style>
