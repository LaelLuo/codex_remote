import { describe, expect, test } from "bun:test";
import {
  parseCodexConfigModelDefaults,
  pickDefaultModelOption,
  resolveReasoningEffortForModel,
} from "./model-defaults";
import type { ModelOption } from "./types";

const options: ModelOption[] = [
  {
    value: "gpt-first",
    label: "GPT First",
    isDefault: true,
    defaultReasoningEffort: "medium",
  },
  {
    value: "gpt-5.4",
    label: "GPT 5.4",
    defaultReasoningEffort: "low",
    supportedReasoningEfforts: ["low", "medium", "high"],
  },
];

describe("model defaults helpers", () => {
  test("prefers model configured in codex config over list order", () => {
    expect(pickDefaultModelOption(options, "gpt-5.4")?.value).toBe("gpt-5.4");
  });

  test("prefers configured reasoning effort for configured default model", () => {
    expect(
      resolveReasoningEffortForModel(options, {
        selectedModel: "",
        preferredModel: "gpt-5.4",
        preferredReasoningEffort: "high",
      }),
    ).toBe("high");
  });

  test("parses root model defaults from config.toml", () => {
    expect(
      parseCodexConfigModelDefaults(`
model_provider = "new"
model = "gpt-5.4"
model_reasoning_effort = "high"

[profiles.debug]
model_reasoning_effort = "low"
      `),
    ).toEqual({
      model: "gpt-5.4",
      reasoningEffort: "high",
    });
  });
});
