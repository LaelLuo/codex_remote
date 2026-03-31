import { describe, expect, test } from "bun:test";
import {
  buildThreadPermissionSettings,
  resolveApprovalPolicyForSandbox,
  resolveSandboxModeFromPolicy,
} from "./thread-permissions";

describe("thread permission settings", () => {
  test("maps read-only and workspace-write sandboxes to on-request approval", () => {
    expect(resolveApprovalPolicyForSandbox("read-only")).toBe("on-request");
    expect(resolveApprovalPolicyForSandbox("workspace-write")).toBe("on-request");
  });

  test("maps danger-full-access sandbox to never approval", () => {
    expect(buildThreadPermissionSettings("danger-full-access")).toEqual({
      sandbox: "danger-full-access",
      approvalPolicy: "never",
    });
  });

  test("maps external sandbox policy to danger-full-access for UI display", () => {
    expect(
      resolveSandboxModeFromPolicy({
        type: "externalSandbox",
        networkAccess: "enabled",
      }),
    ).toBe("danger-full-access");
  });

  test("maps workspace-write sandbox policies with extra fields to workspace-write", () => {
    expect(
      resolveSandboxModeFromPolicy({
        type: "workspaceWrite",
        writableRoots: [],
        readOnlyAccess: { type: "fullAccess" },
        networkAccess: false,
        excludeTmpdirEnvVar: false,
        excludeSlashTmp: false,
      }),
    ).toBe("workspace-write");
  });
});
