import type { ModelOption, ReasoningEffort } from "./types";

export interface CodexConfigModelDefaults {
  model: string | null;
  reasoningEffort: ReasoningEffort | null;
}

interface ResolveReasoningEffortOptions {
  selectedModel?: string | null;
  preferredModel?: string | null;
  preferredReasoningEffort?: ReasoningEffort | null;
}

const ROOT_SECTION = "";

export function pickDefaultModelOption(
  options: ModelOption[],
  preferredModel?: string | null,
): ModelOption | null {
  const normalizedPreferredModel = preferredModel?.trim() ?? "";
  if (normalizedPreferredModel) {
    const configured = options.find((option) => option.value === normalizedPreferredModel);
    if (configured) return configured;
  }
  return options.find((option) => option.isDefault) ?? options[0] ?? null;
}

export function resolveReasoningEffortForModel(
  options: ModelOption[],
  {
    selectedModel,
    preferredModel,
    preferredReasoningEffort,
  }: ResolveReasoningEffortOptions,
): ReasoningEffort {
  const fallbackModel = pickDefaultModelOption(options, preferredModel)?.value ?? "";
  const effectiveModel = selectedModel?.trim() || fallbackModel;

  if (
    preferredReasoningEffort &&
    preferredModel?.trim() &&
    effectiveModel === preferredModel.trim()
  ) {
    return preferredReasoningEffort;
  }

  const matchingOption = options.find((option) => option.value === effectiveModel) ?? null;
  if (matchingOption?.defaultReasoningEffort) {
    return matchingOption.defaultReasoningEffort;
  }
  if (matchingOption?.supportedReasoningEfforts?.length) {
    return matchingOption.supportedReasoningEfforts[0];
  }
  return preferredReasoningEffort ?? "medium";
}

export function parseCodexConfigModelDefaults(content: string): CodexConfigModelDefaults {
  const defaults: CodexConfigModelDefaults = {
    model: null,
    reasoningEffort: null,
  };

  let currentSection = ROOT_SECTION;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1]?.trim() ?? "__non_root__";
      continue;
    }
    if (currentSection !== ROOT_SECTION) continue;

    const entryMatch = line.match(/^([A-Za-z0-9_]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')\s*(?:#.*)?$/);
    if (!entryMatch) continue;

    const key = entryMatch[1];
    const value = parseQuotedTomlString(entryMatch[2]);
    if (value == null) continue;

    if (key === "model") {
      defaults.model = value;
      continue;
    }
    if (key === "model_reasoning_effort") {
      defaults.reasoningEffort = normalizeReasoningEffort(value);
    }
  }

  return defaults;
}

function parseQuotedTomlString(raw: string): string | null {
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return null;
    }
  }

  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1);
  }

  return null;
}

function normalizeReasoningEffort(value: string): ReasoningEffort | null {
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  if (value === "low" || value === "minimal") return "low";
  return null;
}
