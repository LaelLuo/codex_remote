import { describe, expect, test } from "bun:test";
import { buildTurnStartOverrides } from "./thread-turn";

describe("thread turn overrides", () => {
  test("includes approval policy and sandbox policy from thread settings", () => {
    expect(
      buildTurnStartOverrides(
        {
          model: "gpt-test",
          reasoningEffort: "high",
          approvalPolicy: "never",
          sandbox: "danger-full-access",
          mode: "code",
        },
        {
          mode: "code",
          settings: {
            model: "gpt-test",
            reasoning_effort: "high",
          },
        },
      ),
    ).toEqual({
      model: "gpt-test",
      effort: "high",
      approvalPolicy: "never",
      sandboxPolicy: { type: "dangerFullAccess" },
      collaborationMode: {
        mode: "code",
        settings: {
          model: "gpt-test",
          reasoning_effort: "high",
        },
      },
    });
  });
});
