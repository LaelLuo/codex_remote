import type { ThreadInfo } from "./types";

export interface SessionSearchKeyEventLike {
  key: string;
  isComposing?: boolean;
}

export function shouldSubmitSessionSearch(event: SessionSearchKeyEventLike): boolean {
  return event.key === "Enter" && event.isComposing !== true;
}

export function filterSessionsByQuery<T extends Pick<ThreadInfo, "id" | "preview">>(
  sessions: T[],
  query: string,
): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...sessions];
  return sessions.filter((session) => {
    const preview = session.preview?.toLocaleLowerCase() ?? "";
    const id = session.id.toLocaleLowerCase();
    return preview.includes(needle) || id.includes(needle);
  });
}
