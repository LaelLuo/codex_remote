import { describe, expect, test } from "bun:test";
import { applyHomeDefaultModelToPanes } from "./home-pane-models";

describe("home pane default model sync", () => {
  test("waits for config defaults to finish loading before auto-selecting a model", () => {
    const initialPanes = [
      { id: 1, selectedModel: "" },
      { id: 2, selectedModel: "gpt-user-picked" },
    ];

    expect(applyHomeDefaultModelToPanes(initialPanes, "gpt-5.4", "loading")).toEqual({
      panes: initialPanes,
      changed: false,
    });
  });

  test("fills empty panes once config defaults are ready", () => {
    const initialPanes = [
      { id: 1, selectedModel: "" },
      { id: 2, selectedModel: "gpt-user-picked" },
    ];

    expect(applyHomeDefaultModelToPanes(initialPanes, "gpt-5.4", "success")).toEqual({
      panes: [
        { id: 1, selectedModel: "gpt-5.4" },
        { id: 2, selectedModel: "gpt-user-picked" },
      ],
      changed: true,
    });
  });
});
