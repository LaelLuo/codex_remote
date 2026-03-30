import { describe, expect, test } from "bun:test";
import { buildThreadPermissionSettings, resolveApprovalPolicyForSandbox } from "./thread-permissions";

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
});
