import type { ApprovalPolicy, SandboxMode, ThreadSettings } from "./types";

const SANDBOX_APPROVAL_POLICY_MAP: Record<SandboxMode, ApprovalPolicy> = {
  "read-only": "on-request",
  "workspace-write": "on-request",
  "danger-full-access": "never",
};

export function resolveApprovalPolicyForSandbox(sandbox: SandboxMode): ApprovalPolicy {
  return SANDBOX_APPROVAL_POLICY_MAP[sandbox];
}

export function buildThreadPermissionSettings(
  sandbox: SandboxMode,
): Pick<ThreadSettings, "sandbox" | "approvalPolicy"> {
  return {
    sandbox,
    approvalPolicy: resolveApprovalPolicyForSandbox(sandbox),
  };
}

export function resolveSandboxModeFromPolicy(input: unknown): SandboxMode | null {
  if (!input) return null;

  if (typeof input === "string") {
    if (input === "read-only" || input === "workspace-write" || input === "danger-full-access") {
      return input;
    }

    const normalized = input.trim().toLowerCase();
    if (normalized.includes("readonly")) return "read-only";
    if (normalized.includes("workspace")) return "workspace-write";
    if (normalized.includes("danger") || normalized.includes("full")) return "danger-full-access";
    if (normalized.includes("external")) return "danger-full-access";
    return null;
  }

  if (typeof input === "object") {
    const type = (input as { type?: unknown }).type;
    if (typeof type === "string" && type.trim()) {
      return resolveSandboxModeFromPolicy(type);
    }
  }

  return null;
}
