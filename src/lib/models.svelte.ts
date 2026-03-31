import type { ModelOption, ReasoningEffort, RpcMessage } from "./types";
import { socket } from "./socket.svelte";
import { anchors } from "./anchors.svelte";
import { auth } from "./auth.svelte";
import {
  parseCodexConfigModelDefaults,
  pickDefaultModelOption,
  resolveReasoningEffortForModel,
  type CodexConfigModelDefaults,
} from "./model-defaults";
import type { ConfigDefaultsStatus } from "./home-pane-models";

type FetchStatus = "idle" | "loading" | "success" | "error";
const MODEL_LIST_TIMEOUT_MS = 12_000;

class ModelsStore {
  options = $state<ModelOption[]>([]);
  status = $state<FetchStatus>("idle");
  configDefaults = $state<CodexConfigModelDefaults>({ model: null, reasoningEffort: null });
  configDefaultsStatus = $state<ConfigDefaultsStatus>("idle");
  defaultModel = $derived(
    pickDefaultModelOption(this.options, this.configDefaults.model)
  );

  #requestId: number | null = null;
  #requestTimeout: ReturnType<typeof setTimeout> | null = null;
  #lastSelectionSignature: string | null = null;

  constructor() {
    socket.onMessage((msg) => this.#handleMessage(msg));
    socket.onConnect(() => {
      if (this.status === "success" && this.options.length > 0) return;
      this.refresh();
    });
    anchors.onSelectionChange((anchorId) => {
      const nextSignature = this.#selectionSignature(anchorId);
      if (this.#lastSelectionSignature === nextSignature) return;
      this.#lastSelectionSignature = nextSignature;
      this.refresh();
    });
  }

  /** Fetch models if we haven't already */
  fetch() {
    if (this.status !== "idle") return;
    void this.#refreshConfigDefaults();
    this.#send();
  }

  /** Force refresh models */
  refresh() {
    this.#clearPendingRequest();
    this.status = "idle";
    this.#send();
    void this.#refreshConfigDefaults();
  }

  resolveDefaultReasoningEffort(modelValue?: string | null): ReasoningEffort {
    return resolveReasoningEffortForModel(this.options, {
      selectedModel: modelValue ?? "",
      preferredModel: this.configDefaults.model,
      preferredReasoningEffort: this.configDefaults.reasoningEffort,
    });
  }

  #selectionSignature(anchorId: string | null): string {
    if (auth.isLocalMode) return "local";
    return `${anchorId ?? ""}|${anchors.selected ? "online" : "offline"}`;
  }

  #send() {
    if (socket.status !== "connected") return;

    this.#requestId = Date.now();
    this.status = "loading";
    this.#armTimeout(this.#requestId);

    socket.send({
      method: "model/list",
      id: this.#requestId,
      params: !auth.isLocalMode && anchors.selectedId ? { anchorId: anchors.selectedId } : {},
    });
  }

  async #refreshConfigDefaults() {
    if (socket.status !== "connected") return;
    this.configDefaultsStatus = "loading";
    if (!auth.isLocalMode && !anchors.selectedId) {
      this.configDefaults = { model: null, reasoningEffort: null };
      this.configDefaultsStatus = "success";
      return;
    }

    try {
      const result = await socket.readCodexConfig(
        undefined,
        !auth.isLocalMode ? anchors.selectedId ?? undefined : undefined,
      );
      this.configDefaults = parseCodexConfigModelDefaults(result.content);
      this.configDefaultsStatus = "success";
    } catch {
      this.configDefaults = { model: null, reasoningEffort: null };
      this.configDefaultsStatus = "error";
    }
  }

  #handleMessage(msg: RpcMessage) {
    // Only handle our request
    if (!this.#requestId || msg.id !== this.#requestId) return;

    this.#clearPendingRequest();

    if (msg.error) {
      this.status = "error";
      console.error("Failed to fetch models:", msg.error);
      return;
    }

    this.options = this.#parseModels(msg.result);
    this.status = this.options.length > 0 ? "success" : "error";
  }

  #armTimeout(requestId: number) {
    this.#clearRequestTimeout();
    this.#requestTimeout = setTimeout(() => {
      if (this.#requestId !== requestId) return;
      this.#clearPendingRequest();
      this.status = "error";
      console.error("Failed to fetch models: request timed out");
    }, MODEL_LIST_TIMEOUT_MS);
  }

  #clearPendingRequest() {
    this.#requestId = null;
    this.#clearRequestTimeout();
  }

  #clearRequestTimeout() {
    if (!this.#requestTimeout) return;
    clearTimeout(this.#requestTimeout);
    this.#requestTimeout = null;
  }

  #parseModels(result: unknown): ModelOption[] {
    // Handle different response shapes
    const items = this.#extractArray(result);

    return items
      .map((item) => this.#parseModelItem(item))
      .filter((m): m is ModelOption => m !== null)
      .filter((model) => !model.hidden);
  }

  #extractArray(result: unknown): unknown[] {
    if (Array.isArray(result)) return result;
    if (!result || typeof result !== "object") return [];

    const obj = result as Record<string, unknown>;
    return (obj.models as unknown[]) ?? (obj.data as unknown[]) ?? (obj.items as unknown[]) ?? [];
  }

  #parseModelItem(item: unknown): ModelOption | null {
    if (typeof item === "string") {
      return { value: item, label: item };
    }

    if (!item || typeof item !== "object") return null;

    const obj = item as Record<string, unknown>;
    const value = String(obj.id ?? obj.model ?? obj.name ?? obj.value ?? "");
    if (!value) return null;

    const label = String(obj.label ?? obj.displayName ?? obj.title ?? value);

    const supportedReasoningEfforts = this.#parseReasoningEfforts(obj.supportedReasoningEfforts);
    const defaultReasoningEffort = this.#parseReasoningEffort(obj.defaultReasoningEffort);

    return {
      value,
      label,
      model: this.#stringOrUndefined(obj.model),
      upgrade: this.#stringOrNull(obj.upgrade),
      description: this.#stringOrUndefined(obj.description),
      hidden: Boolean(obj.hidden),
      supportedReasoningEfforts,
      defaultReasoningEffort,
      inputModalities: this.#parseStringArray(obj.inputModalities),
      supportsPersonality: typeof obj.supportsPersonality === "boolean" ? obj.supportsPersonality : undefined,
      isDefault: typeof obj.isDefault === "boolean" ? obj.isDefault : undefined,
    };
  }

  #stringOrUndefined(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
  }

  #stringOrNull(value: unknown): string | null | undefined {
    if (value === null) return null;
    return this.#stringOrUndefined(value);
  }

  #parseStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const parsed = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    return parsed.length > 0 ? parsed : undefined;
  }

  #parseReasoningEfforts(value: unknown): ReasoningEffort[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const efforts = value
      .map((entry) => {
        if (typeof entry === "string") return this.#parseReasoningEffort(entry);
        if (!entry || typeof entry !== "object") return undefined;
        return this.#parseReasoningEffort((entry as Record<string, unknown>).reasoningEffort);
      })
      .filter((effort): effort is ReasoningEffort => Boolean(effort));

    return efforts.length > 0 ? [...new Set(efforts)] : undefined;
  }

  #parseReasoningEffort(value: unknown): ReasoningEffort | undefined {
    if (value === "low" || value === "medium" || value === "high") return value;
    return undefined;
  }
}

export const models = new ModelsStore();
