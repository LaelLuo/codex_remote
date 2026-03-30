export function getConfiguredCodexExecutablePath(configuredPath?: string | null): string | null {
  const trimmed = configuredPath?.trim();
  return trimmed ? trimmed : null;
}

export function resolveCodexExecutable(configuredPath?: string | null): string {
  return getConfiguredCodexExecutablePath(configuredPath) ?? "codex";
}
