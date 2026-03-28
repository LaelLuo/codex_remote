import { describe, expect, test } from "bun:test";
import {
  ARTIFACTS_TIMELINE_LAYOUT,
  THREAD_CONSOLE_LAYOUT,
  buildArtifactsTimelineStyleVars,
  buildThreadConsoleStyleVars,
} from "./thread-layout";

describe("thread layout tokens", () => {
  test("defines bounded thread console heights for desktop and mobile", () => {
    expect(THREAD_CONSOLE_LAYOUT.minHeight).toBe("min(28rem, 68vh)");
    expect(THREAD_CONSOLE_LAYOUT.maxHeight).toBe("min(58rem, 72vh)");
    expect(THREAD_CONSOLE_LAYOUT.mobileMinHeight).toBe("min(24rem, 56vh)");
    expect(THREAD_CONSOLE_LAYOUT.mobileMaxHeight).toBe("min(42rem, 64vh)");
  });

  test("defines a shorter bounded timeline height than the main console", () => {
    expect(ARTIFACTS_TIMELINE_LAYOUT.maxHeight).toBe("min(32rem, 42vh)");
    expect(ARTIFACTS_TIMELINE_LAYOUT.mobileMaxHeight).toBe("min(24rem, 34vh)");
  });

  test("builds css custom properties for both scroll regions", () => {
    expect(buildThreadConsoleStyleVars()).toContain("--thread-console-max-height: min(58rem, 72vh)");
    expect(buildThreadConsoleStyleVars()).toContain("--thread-console-mobile-max-height: min(42rem, 64vh)");
    expect(buildArtifactsTimelineStyleVars()).toContain("--artifacts-timeline-max-height: min(32rem, 42vh)");
    expect(buildArtifactsTimelineStyleVars()).toContain("--artifacts-timeline-mobile-max-height: min(24rem, 34vh)");
  });
});
