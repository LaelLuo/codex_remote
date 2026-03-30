import type { CollaborationMode, SandboxMode, ThreadSettings } from "./types";

function buildSandboxPolicy(sandbox: SandboxMode): { type: string } {
  const sandboxTypeMap: Record<SandboxMode, string> = {
    "read-only": "readOnly",
    "workspace-write": "workspaceWrite",
    "danger-full-access": "dangerFullAccess",
  };
  return { type: sandboxTypeMap[sandbox] };
}

export function buildTurnStartOverrides(
  settings: Pick<ThreadSettings, "model" | "reasoningEffort" | "approvalPolicy" | "sandbox" | "mode">,
  collaborationMode?: CollaborationMode,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const model = settings.model.trim();
  if (model) {
    params.model = model;
  }
  if (settings.reasoningEffort) {
    params.effort = settings.reasoningEffort;
  }
  const approvalPolicy = settings.approvalPolicy?.trim();
  if (approvalPolicy) {
    params.approvalPolicy = approvalPolicy;
  }
  params.sandboxPolicy = buildSandboxPolicy(settings.sandbox);
  if (collaborationMode) {
    params.collaborationMode = collaborationMode;
  }
  return params;
}
