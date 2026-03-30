import { describe, expect, test } from "bun:test";
import { filterSessionsByQuery, shouldSubmitSessionSearch } from "./session-search";

describe("session search submit", () => {
  test("submits on Enter when not composing", () => {
    expect(shouldSubmitSessionSearch({ key: "Enter", isComposing: false })).toBe(true);
  });

  test("does not submit on Enter during IME composition", () => {
    expect(shouldSubmitSessionSearch({ key: "Enter", isComposing: true })).toBe(false);
  });

  test("does not submit for other keys", () => {
    expect(shouldSubmitSessionSearch({ key: "Escape", isComposing: false })).toBe(false);
  });
});

describe("session search filtering", () => {
  test("matches preview text case-insensitively", () => {
    expect(
      filterSessionsByQuery(
        [
          { id: "thread-1", preview: "Alpha" },
          { id: "thread-2", preview: "Needle in haystack" },
        ],
        "needle",
      ),
    ).toEqual([{ id: "thread-2", preview: "Needle in haystack" }]);
  });

  test("matches thread id when preview is missing", () => {
    expect(
      filterSessionsByQuery(
        [
          { id: "task-needle-1" },
          { id: "thread-2", preview: "Alpha" },
        ],
        "needle",
      ),
    ).toEqual([{ id: "task-needle-1" }]);
  });
});
