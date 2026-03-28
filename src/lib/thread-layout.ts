export const THREAD_CONSOLE_LAYOUT = {
  minHeight: "min(28rem, 68vh)",
  maxHeight: "min(58rem, 72vh)",
  mobileMinHeight: "min(24rem, 56vh)",
  mobileMaxHeight: "min(42rem, 64vh)",
} as const;

export const ARTIFACTS_TIMELINE_LAYOUT = {
  maxHeight: "min(32rem, 42vh)",
  mobileMaxHeight: "min(24rem, 34vh)",
} as const;

export function buildThreadConsoleStyleVars(): string {
  return [
    `--thread-console-min-height: ${THREAD_CONSOLE_LAYOUT.minHeight}`,
    `--thread-console-max-height: ${THREAD_CONSOLE_LAYOUT.maxHeight}`,
    `--thread-console-mobile-min-height: ${THREAD_CONSOLE_LAYOUT.mobileMinHeight}`,
    `--thread-console-mobile-max-height: ${THREAD_CONSOLE_LAYOUT.mobileMaxHeight}`,
  ].join("; ");
}

export function buildArtifactsTimelineStyleVars(): string {
  return [
    `--artifacts-timeline-max-height: ${ARTIFACTS_TIMELINE_LAYOUT.maxHeight}`,
    `--artifacts-timeline-mobile-max-height: ${ARTIFACTS_TIMELINE_LAYOUT.mobileMaxHeight}`,
  ].join("; ");
}
