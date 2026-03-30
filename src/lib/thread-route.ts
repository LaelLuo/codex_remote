export function shouldOpenThreadOnRoute(
  threadId: string | null,
  socketStatus: string,
  currentThreadId: string | null,
  hydrated: boolean,
  opening: boolean,
): boolean {
  return Boolean(threadId) && socketStatus === "connected" && !opening && (currentThreadId !== threadId || !hydrated);
}
