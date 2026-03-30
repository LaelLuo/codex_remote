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
