export type ConfigDefaultsStatus = "idle" | "loading" | "success" | "error";

interface PaneWithSelectedModel {
  selectedModel: string;
}

export function applyHomeDefaultModelToPanes<T extends PaneWithSelectedModel>(
  panes: T[],
  defaultModel: string | null | undefined,
  configDefaultsStatus: ConfigDefaultsStatus,
): { panes: T[]; changed: boolean } {
  const normalizedDefaultModel = defaultModel?.trim() ?? "";
  if (!normalizedDefaultModel) {
    return { panes, changed: false };
  }
  if (configDefaultsStatus === "idle" || configDefaultsStatus === "loading") {
    return { panes, changed: false };
  }

  let changed = false;
  const nextPanes = panes.map((pane) => {
    if (pane.selectedModel) return pane;
    changed = true;
    return { ...pane, selectedModel: normalizedDefaultModel };
  });

  return { panes: changed ? nextPanes : panes, changed };
}
