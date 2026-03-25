// Managed by task-memory-bootstrap. Update through the skill, not by ad-hoc copy.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import YAML from "js-yaml";

type TaskStatus =
  | "draft"
  | "in_progress"
  | "blocked"
  | "review"
  | "done"
  | "cancelled";

type TaskMeta = {
  id: string;
  title: string;
  status: TaskStatus;
  archived: boolean;
  created_at: string;
  updated_at: string;
  related_repos: string[];
  depends_on: string[];
  blocked_by: string[];
  tags: string[];
};

type RepoRegistry = {
  repos?: Array<{ id: string }>;
};

type NextActionStatus = "open" | "blocked" | "done" | "obsolete";
type NextAction = {
  id: string;
  title: string;
  status: NextActionStatus;
  createdAt: string;
  source: string;
  parent?: string;
  closedAt?: string;
  closedBy?: string;
  reason?: string;
};
type NextActionsFormat = "structured" | "legacy";
type NextActionsDocument = {
  actions: NextAction[];
  format: NextActionsFormat;
};

type NewTaskArgs = {
  title: string;
  goal?: string;
  inScope: string[];
  outOfScope: string[];
  acceptance: string[];
  placeholder: boolean;
};

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tasksDir = resolve(rootDir, "tasks");
const archivedDir = resolve(tasksDir, "archived");
const taskLocksDir = resolve(tasksDir, ".locks");
const workspaceReposPath = resolve(rootDir, "workspace", "repos.yaml");
const agentsPath = resolve(rootDir, "AGENTS.md");
const operatingModelPath = resolve(rootDir, "docs", "governance", "agent-operating-model.md");
const projectSummaryPath = resolve(rootDir, "memory", "project-summary.md");
const knownGapsPath = resolve(rootDir, "memory", "known-gaps.md");
const tasksReadmePath = resolve(rootDir, "tasks", "README.md");
const managedTaskCliHeader = "// Managed by task-memory-bootstrap. Update through the skill, not by ad-hoc copy.";
const managedSectionStart = "<!-- task-memory-bootstrap:begin -->";
const managedSectionEnd = "<!-- task-memory-bootstrap:end -->";
const requiredManagedSectionPhrases = [
  "活跃任务目录 + 长期知识沉淀",
  "只要工作会跨多个文件、需要持续记录、需要筛选判断、或可能跨会话继续，就应创建或复用 `tasks/<task-id>/`",
  "必须先读取该任务最新状态；`tasks/<task-id>/` 是真实进度源",
  "不能把任务文件当作事后补写的流水账",
  "必须立即把状态从 `draft` 更新为 `in_progress`，并写入对应日志",
  "必须先把任务推进到 `review` 或 `done`",
  "next-actions.md` 仍停留在初始化占位内容",
  "第一步应先对齐任务状态，再继续推进",
  "不得把任务进度写进 `memory/`",
  "next-actions.md` 不是可随手覆盖的临时清单，而是任务行动历史",
  "现有 action 不得直接删除",
] as const;
const requiredTaskFiles = [
  "task.yaml",
  "brief.md",
  "log.md",
  "decisions.md",
  "next-actions.md",
] as const;
const defaultNextActions = [
  "回读 brief.md，确认本轮目标与边界",
  "补充相关上下文引用与 affected repos",
  "开始执行后记录首条实质性进展",
];
const nextActionOpenStatuses = new Set<NextActionStatus>(["open", "blocked"]);
const nextActionClosedStatuses = new Set<NextActionStatus>(["done", "obsolete"]);
const legacyActionIdBase = 1700000000000;
let lastGeneratedNextActionTimestamp = 0;

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugifyZh(text: string): string {
  return text.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
}

function formatBulletSection(items: string[], fallback: string): string {
  const source = items.length > 0 ? items : [fallback];
  return source.map((item) => `- ${item}`).join("\n");
}

function nextActionIdToIso(actionId: string): string {
  const value = Number(actionId.replace("NA-", ""));
  if (Number.isFinite(value) && value > 0) {
    try {
      return new Date(value).toISOString();
    } catch {
      return new Date(legacyActionIdBase).toISOString();
    }
  }
  return new Date(legacyActionIdBase).toISOString();
}

function createNextActionId(): string {
  const timestamp = Date.now();
  lastGeneratedNextActionTimestamp = Math.max(lastGeneratedNextActionTimestamp + 1, timestamp);
  return `NA-${lastGeneratedNextActionTimestamp}`;
}

function createNextAction(title: string, source: string, parent?: string): NextAction {
  const id = createNextActionId();
  return {
    id,
    title: title.trim(),
    status: "open",
    createdAt: nowIso(),
    source,
    parent: parent?.trim() || undefined,
  };
}

function normalizeNextActionStatus(value: string): NextActionStatus | null {
  switch (value) {
    case "open":
    case "blocked":
    case "done":
    case "obsolete":
      return value;
    default:
      return null;
  }
}

function isStructuredNextActions(content: string): boolean {
  return content.includes("## Open") && content.includes("## Closed") && /- NA-\d+\s+/.test(content);
}

function parseLegacyTitleAndSource(rawTitle: string, fallbackSource: string): {
  title: string;
  source: string;
  createdAt?: string;
  closedAt?: string;
  closedBy?: string;
} {
  let title = rawTitle.trim();
  let closedAt: string | undefined;
  let closedBy: string | undefined;

  const doneSuffixMatch = title.match(/\s+\(done ([0-9T:.\-+Z]+) \[(human|agent|subagent)\]\)$/);
  if (doneSuffixMatch) {
    closedAt = doneSuffixMatch[1];
    closedBy = doneSuffixMatch[2];
    title = title.slice(0, doneSuffixMatch.index).trim();
  }

  const createdMatch = title.match(/^([0-9T:.\-+Z]+)\s+\[(human|agent|subagent)\]\s+(.+)$/);
  if (createdMatch) {
    return {
      title: createdMatch[3].trim(),
      source: createdMatch[2],
      createdAt: createdMatch[1],
      closedAt,
      closedBy,
    };
  }

  return {
    title,
    source: fallbackSource,
    closedAt,
    closedBy,
  };
}

function parseLegacyNextActions(content: string): NextActionsDocument {
  const actions: NextAction[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/^- \[( |x)\]\s+(.+)$/);
    if (!match) {
      return;
    }

    const id = `NA-${legacyActionIdBase + index}`;
    const checked = match[1].toLowerCase() === "x";
    const parsed = parseLegacyTitleAndSource(match[2], "agent");
    actions.push({
      id,
      title: parsed.title,
      status: checked ? "done" : "open",
      createdAt: parsed.createdAt ?? nextActionIdToIso(id),
      closedAt: checked ? parsed.closedAt : undefined,
      closedBy: parsed.closedBy,
      source: parsed.source,
    });
  });

  return {
    actions,
    format: "legacy",
  };
}

function parseStructuredNextActions(content: string): NextActionsDocument {
  const actions: NextAction[] = [];
  const lines = content.split(/\r?\n/);
  let current: NextAction | null = null;

  for (const line of lines) {
    const itemMatch = line.match(/^- (NA-\d+)\s+(.+)$/);
    if (itemMatch) {
      current = {
        id: itemMatch[1],
        title: itemMatch[2].trim(),
        status: "open",
        createdAt: nextActionIdToIso(itemMatch[1]),
        source: "agent",
      };
      actions.push(current);
      continue;
    }

    const metaMatch = line.match(/^\s{2}- ([a-z_]+):\s*(.+)$/);
    if (!metaMatch || !current) {
      continue;
    }

    const [, key, rawValue] = metaMatch;
    const value = rawValue.trim();
    switch (key) {
      case "status": {
        const status = normalizeNextActionStatus(value);
        if (status) {
          current.status = status;
        }
        break;
      }
      case "created_at":
        current.createdAt = value;
        break;
      case "closed_at":
        current.closedAt = value;
        break;
      case "closed_by":
        current.closedBy = value;
        break;
      case "source":
        current.source = value;
        break;
      case "parent":
        current.parent = value;
        break;
      case "reason":
        current.reason = value;
        break;
      default:
        break;
    }
  }

  return {
    actions,
    format: "structured",
  };
}

function parseNextActionsDocument(content: string): NextActionsDocument {
  return isStructuredNextActions(content)
    ? parseStructuredNextActions(content)
    : parseLegacyNextActions(content);
}

function renderNextActionsDocument(document: NextActionsDocument): string {
  const openActions = document.actions.filter((action) => nextActionOpenStatuses.has(action.status));
  const closedActions = document.actions.filter((action) => nextActionClosedStatuses.has(action.status));

  const renderAction = (action: NextAction): string => {
    const lines = [
      `- ${action.id} ${action.title}`,
      `  - status: ${action.status}`,
      `  - created_at: ${action.createdAt}`,
    ];
    if (nextActionClosedStatuses.has(action.status) && action.closedAt) {
      lines.push(`  - closed_at: ${action.closedAt}`);
    }
    if (action.closedBy) {
      lines.push(`  - closed_by: ${action.closedBy}`);
    }
    lines.push(`  - source: ${action.source}`);
    if (action.parent) {
      lines.push(`  - parent: ${action.parent}`);
    }
    if (action.reason) {
      lines.push(`  - reason: ${action.reason}`);
    }
    return lines.join("\n");
  };

  const openBody = openActions.length > 0 ? openActions.map(renderAction).join("\n\n") : "";
  const closedBody = closedActions.length > 0 ? closedActions.map(renderAction).join("\n\n") : "";

  return `# Next Actions\n\n## Open\n\n${openBody}\n\n## Closed\n\n${closedBody}\n`;
}

function loadNextActionsDocument(taskPath: string): NextActionsDocument {
  return parseNextActionsDocument(readFileSync(resolve(taskPath, "next-actions.md"), "utf-8"));
}

function saveNextActionsDocument(taskPath: string, document: NextActionsDocument): void {
  writeFileSync(resolve(taskPath, "next-actions.md"), renderNextActionsDocument(document));
}

function findNextAction(
  document: NextActionsDocument,
  actionIdOrKeyword: string,
  options?: {
    openOnly?: boolean;
    allowKeywordForStructured?: boolean;
  },
): NextAction | undefined {
  const openOnly = options?.openOnly ?? false;
  const actions = openOnly
    ? document.actions.filter((action) => nextActionOpenStatuses.has(action.status))
    : document.actions;
  const byId = actions.find((action) => action.id === actionIdOrKeyword);
  if (byId) {
    return byId;
  }
  const allowKeyword = document.format === "legacy" || (options?.allowKeywordForStructured ?? false);
  if (!allowKeyword) {
    return undefined;
  }
  return actions.find((action) => action.title.toLowerCase().includes(actionIdOrKeyword.toLowerCase()));
}

function renderDefaultNextActions(): string {
  const actions = defaultNextActions.map((title) => createNextAction(title, "agent"));
  return renderNextActionsDocument({
    actions,
    format: "structured",
  });
}

function renderBriefContent(input: NewTaskArgs): string {
  if (input.placeholder) {
    return `# ${input.title}\n\n## 目标\n\n- TODO\n\n## 范围\n\n### In\n\n- TODO\n\n### Out\n\n- TODO\n\n## 验收标准\n\n- TODO\n`;
  }

  return `# ${input.title}\n\n## 目标\n\n- ${input.goal}\n\n## 范围\n\n### In\n\n${formatBulletSection(input.inScope, "未在创建时指定")}\n\n### Out\n\n${formatBulletSection(input.outOfScope, "未在创建时指定")}\n\n## 验收标准\n\n${formatBulletSection(input.acceptance, "未在创建时指定")}\n`;
}

function listTaskIds(baseDir: string): string[] {
  if (!existsSync(baseDir)) {
    return [];
  }
  const entries = new Bun.Glob("TASK-*").scanSync({ cwd: baseDir, onlyFiles: false });
  return [...entries]
    .filter((entry) => existsSync(resolve(baseDir, entry, "task.yaml")))
    .sort();
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function loadTaskMeta(taskPath: string): TaskMeta {
  const text = readFileSync(resolve(taskPath, "task.yaml"), "utf-8");
  const parsed = YAML.load(text) as TaskMeta & {
    created_at: unknown;
    updated_at: unknown;
  };
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`无效的 task.yaml: ${taskPath}`);
  }
  return {
    ...parsed,
    created_at: normalizeDate(parsed.created_at),
    updated_at: normalizeDate(parsed.updated_at),
    related_repos: normalizeStringArray(parsed.related_repos),
    depends_on: normalizeStringArray(parsed.depends_on),
    blocked_by: normalizeStringArray(parsed.blocked_by),
    tags: normalizeStringArray(parsed.tags),
  };
}

function saveTaskMeta(taskPath: string, meta: TaskMeta): void {
  writeFileSync(resolve(taskPath, "task.yaml"), YAML.dump(meta, { lineWidth: 120 }));
}

function lockPathForTask(taskId: string): string {
  return resolve(taskLocksDir, `${taskId}.lock`);
}

function withTaskLock<T>(taskId: string, work: () => T): T {
  ensureDir(taskLocksDir);
  const lockPath = lockPathForTask(taskId);
  const timeoutAt = Date.now() + 5000;

  while (true) {
    try {
      mkdirSync(lockPath);
      break;
    } catch (error) {
      const alreadyExists = error instanceof Error && "code" in error && error.code === "EEXIST";
      if (!alreadyExists) {
        throw error;
      }
      if (Date.now() >= timeoutAt) {
        throw new Error(`获取任务锁超时: ${taskId}`);
      }
      sleepMs(50);
    }
  }

  try {
    return work();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

function taskPathById(taskId: string): string | null {
  const activePath = resolve(tasksDir, taskId);
  if (existsSync(activePath)) {
    return activePath;
  }
  const archivedPath = resolve(archivedDir, taskId);
  if (existsSync(archivedPath)) {
    return archivedPath;
  }
  return null;
}

function resolveTask(taskId: string): { taskPath: string; meta: TaskMeta } | null {
  const taskPath = taskPathById(taskId);
  if (!taskPath) {
    return null;
  }
  return { taskPath, meta: loadTaskMeta(taskPath) };
}

function ensureTask(taskId: string): { taskPath: string; meta: TaskMeta } | null {
  const resolved = resolveTask(taskId);
  if (!resolved) {
    console.error("找不到任务", taskId);
    process.exitCode = 1;
    return null;
  }
  return resolved;
}

function takeOptionValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value.trim();
}

function parseNewTaskArgs(args: string[]): NewTaskArgs {
  const title = args[0]?.trim() ?? "";
  if (!title) {
    throw new Error("Missing title");
  }

  const parsed: NewTaskArgs = {
    title,
    inScope: [],
    outOfScope: [],
    acceptance: [],
    placeholder: false,
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--goal":
        parsed.goal = takeOptionValue(args, index, arg);
        index += 1;
        break;
      case "--in":
        parsed.inScope.push(takeOptionValue(args, index, arg));
        index += 1;
        break;
      case "--out":
        parsed.outOfScope.push(takeOptionValue(args, index, arg));
        index += 1;
        break;
      case "--accept":
        parsed.acceptance.push(takeOptionValue(args, index, arg));
        index += 1;
        break;
      case "--placeholder":
        parsed.placeholder = true;
        break;
      default:
        throw new Error(`Unknown new arg: ${arg}`);
    }
  }

  if (!parsed.placeholder && !parsed.goal) {
    throw new Error("Missing goal");
  }

  return parsed;
}

function createTask(input: NewTaskArgs): void {
  ensureDir(tasksDir);
  ensureDir(archivedDir);

  const taskId = `TASK-${Date.now()}-${slugifyZh(input.title)}`;
  const taskPath = resolve(tasksDir, taskId);
  const createdAt = nowIso();
  const meta: TaskMeta = {
    id: taskId,
    title: input.title,
    status: "draft",
    archived: false,
    created_at: createdAt,
    updated_at: createdAt,
    related_repos: [],
    depends_on: [],
    blocked_by: [],
    tags: [],
  };

  ensureDir(taskPath);
  saveTaskMeta(taskPath, meta);
  writeFileSync(resolve(taskPath, "brief.md"), renderBriefContent(input));
  writeFileSync(resolve(taskPath, "log.md"), "# Task Log\n\n- 初始化任务目录。\n");
  writeFileSync(resolve(taskPath, "decisions.md"), "# Decisions\n\n- 暂无。\n");
  writeFileSync(resolve(taskPath, "next-actions.md"), renderDefaultNextActions());
  console.log(taskId);
}

function listTasks(includeArchived: boolean): void {
  ensureDir(tasksDir);
  ensureDir(archivedDir);

  const active = listTaskIds(tasksDir).map((id) => loadTaskMeta(resolve(tasksDir, id)));
  const archived = includeArchived
    ? listTaskIds(archivedDir).map((id) => loadTaskMeta(resolve(archivedDir, id)))
    : [];

  console.log("STATUS".padEnd(14), "ARCH".padEnd(6), "UPDATED".padEnd(28), "ID");
  console.log("-".repeat(100));
  [...active, ...archived].forEach((task) => {
    console.log(
      task.status.padEnd(14),
      String(task.archived).padEnd(6),
      task.updated_at.padEnd(28),
      task.id,
    );
  });
}

function showTask(taskId: string): void {
  const current = ensureTask(taskId);
  if (!current) {
    return;
  }
  const { taskPath, meta } = current;
  console.log(`ID: ${meta.id}`);
  console.log(`TITLE: ${meta.title}`);
  console.log(`STATUS: ${meta.status}`);
  console.log(`ARCHIVED: ${meta.archived ? "yes" : "no"}`);
  console.log(`RELATED_REPOS: ${meta.related_repos.join(", ") || "-"}`);
  console.log(`UPDATED_AT: ${meta.updated_at}`);
  console.log(`PATH: ${taskPath}`);
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function appendTimestampedLine(taskPath: string, file: string, source: string, content: string): void {
  const filePath = resolve(taskPath, file);
  const line = `- ${nowIso()} [${source}] ${content.trim()}\n`;
  writeFileSync(filePath, `${readFileSync(filePath, "utf-8")}${line}`);
}

function countOpenNextActions(content: string): number {
  return parseNextActionsDocument(content).actions
    .filter((action) => nextActionOpenStatuses.has(action.status))
    .length;
}

function hasLoggedProgress(content: string): boolean {
  return content
    .split(/\r?\n/)
    .some((line) => line.trimStart().startsWith("- ") && !line.includes("初始化任务目录。"));
}

function collectDoctorWarnings(taskPath: string, meta: TaskMeta): string[] {
  const warnings: string[] = [];
  const logContent = readFileSync(resolve(taskPath, "log.md"), "utf-8");
  const nextActionsContent = readFileSync(resolve(taskPath, "next-actions.md"), "utf-8");
  const openNextActionCount = countOpenNextActions(nextActionsContent);

  if (meta.status === "draft" && hasLoggedProgress(logContent)) {
    warnings.push("draft 状态但 log.md 已记录实际进展");
  }

  if ([
    "- [ ] 明确目标与范围",
    "- [ ] 补充相关仓库",
    "- [ ] 更新状态为 `in_progress`",
  ].every((line) => nextActionsContent.includes(line))) {
    warnings.push("next-actions.md 仍是初始化占位内容");
  }

  if ((meta.status === "review" || meta.status === "done") && openNextActionCount > 0) {
    warnings.push(`${meta.status} 状态但仍存在未关闭 next action`);
  }

  return warnings;
}

function warnIfOpenNextActions(taskId: string, taskPath: string): void {
  const nextActionsContent = readFileSync(resolve(taskPath, "next-actions.md"), "utf-8");
  if (countOpenNextActions(nextActionsContent) > 0) {
    console.log(`[WARN] ${taskId}: done 后仍存在未关闭 next action`);
  }
}

function touchTask(taskPath: string): void {
  const meta = loadTaskMeta(taskPath);
  meta.updated_at = nowIso();
  saveTaskMeta(taskPath, meta);
}

function updateTask(taskId: string, args: string[]): void {
  withTaskLock(taskId, () => {
    const current = ensureTask(taskId);
    if (!current) {
      return;
    }

    const validStatuses: TaskStatus[] = [
      "draft",
      "in_progress",
      "blocked",
      "review",
      "done",
      "cancelled",
    ];
    const { taskPath, meta } = current;

    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      const value = args[index + 1];

      switch (arg) {
        case "--status":
          if (!value || !validStatuses.includes(value as TaskStatus)) {
            console.error("无效状态，允许值：", validStatuses.join(", "));
            process.exitCode = 1;
            return;
          }
          meta.status = value as TaskStatus;
          index += 1;
          break;
        case "--title":
          if (!value) {
            console.error("--title 需要值");
            process.exitCode = 1;
            return;
          }
          meta.title = value;
          index += 1;
          break;
        case "--add-repo":
          if (!value) {
            console.error("--add-repo 需要 repo id");
            process.exitCode = 1;
            return;
          }
          meta.related_repos = unique([...meta.related_repos, value]);
          index += 1;
          break;
        case "--remove-repo":
          if (!value) {
            console.error("--remove-repo 需要 repo id");
            process.exitCode = 1;
            return;
          }
          meta.related_repos = meta.related_repos.filter((repo) => repo !== value);
          index += 1;
          break;
        case "--add-tag":
          if (!value) {
            console.error("--add-tag 需要 tag");
            process.exitCode = 1;
            return;
          }
          meta.tags = unique([...meta.tags, value]);
          index += 1;
          break;
        case "--remove-tag":
          if (!value) {
            console.error("--remove-tag 需要 tag");
            process.exitCode = 1;
            return;
          }
          meta.tags = meta.tags.filter((tag) => tag !== value);
          index += 1;
          break;
        default:
          console.error("未知 update 参数", arg);
          process.exitCode = 1;
          return;
      }
    }

    meta.updated_at = nowIso();
    saveTaskMeta(taskPath, meta);
    console.log(`已更新 ${taskId}`);
  });
}

function ensureSourceOption(value?: string): string {
  const normalized = (value ?? "agent").toLowerCase();
  const allowed = new Set(["human", "agent", "subagent"]);
  if (!allowed.has(normalized)) {
    console.error("--source 支持 human|agent|subagent");
    process.exitCode = 1;
    throw new Error("Invalid source");
  }
  return normalized;
}

function extractTextAndSource(args: string[]): { text: string; source: string } {
  const sourceFlag = "--source";
  const index = args.findIndex((arg) => arg === sourceFlag);
  let source = "agent";
  const contentParts = [...args];
  if (index !== -1) {
    if (index === args.length - 1) {
      console.error(`${sourceFlag} 需要值`);
      process.exitCode = 1;
      throw new Error("Missing source value");
    }
    source = ensureSourceOption(args[index + 1]);
    contentParts.splice(index, 2);
  }
  const text = contentParts.join(" ").trim();
  if (!text) {
    console.error("内容不能为空");
    process.exitCode = 1;
    throw new Error("Empty text");
  }
  return { text, source };
}

function extractNextAddArgs(args: string[]): { text: string; source: string; parent?: string } {
  const parts: string[] = [];
  let source = "agent";
  let parent: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--source") {
      const value = args[index + 1];
      if (!value) {
        console.error("--source 需要值");
        process.exitCode = 1;
        throw new Error("Missing source value");
      }
      source = ensureSourceOption(value);
      index += 1;
      continue;
    }
    if (arg === "--parent") {
      const value = args[index + 1];
      if (!value) {
        console.error("--parent 需要 action-id");
        process.exitCode = 1;
        throw new Error("Missing parent value");
      }
      parent = value.trim();
      index += 1;
      continue;
    }
    parts.push(arg);
  }

  const text = parts.join(" ").trim();
  if (!text) {
    console.error("内容不能为空");
    process.exitCode = 1;
    throw new Error("Empty text");
  }

  return { text, source, parent };
}

function extractNextUpdateArgs(args: string[]): { actionId: string; status: NextActionStatus; reason?: string } {
  const actionId = args[0]?.trim();
  if (!actionId) {
    console.error("next update 需要 action-id");
    process.exitCode = 1;
    throw new Error("Missing action id");
  }

  let status: NextActionStatus | null = null;
  let reason: string | undefined;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--status") {
      const value = args[index + 1];
      const normalized = normalizeNextActionStatus(value ?? "");
      if (!normalized) {
        console.error("next update 的 --status 仅支持 open|blocked|done|obsolete");
        process.exitCode = 1;
        throw new Error("Invalid next status");
      }
      status = normalized;
      index += 1;
      continue;
    }
    if (arg === "--reason") {
      const value = args[index + 1];
      if (!value) {
        console.error("--reason 需要值");
        process.exitCode = 1;
        throw new Error("Missing reason");
      }
      reason = value.trim();
      index += 1;
      continue;
    }
    console.error("未知 next update 参数", arg);
    process.exitCode = 1;
    throw new Error("Unknown next update arg");
  }

  if (!status) {
    console.error("next update 需要 --status");
    process.exitCode = 1;
    throw new Error("Missing next status");
  }
  if (status === "obsolete" && !reason) {
    console.error("obsolete 需要 --reason");
    process.exitCode = 1;
    throw new Error("Missing obsolete reason");
  }

  return { actionId, status, reason };
}

function extractNextDoneArgs(args: string[]): { target: string; source: string } {
  const parts: string[] = [];
  let source = "agent";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--source") {
      const value = args[index + 1];
      if (!value) {
        console.error("--source 需要值");
        process.exitCode = 1;
        throw new Error("Missing source value");
      }
      source = ensureSourceOption(value);
      index += 1;
      continue;
    }
    parts.push(arg);
  }

  const target = parts.join(" ").trim();
  if (!target) {
    console.error("关键字不能为空");
    process.exitCode = 1;
    throw new Error("Empty keyword");
  }

  return { target, source };
}

function extractOptionalTextAndSource(args: string[]): { text: string; source: string } {
  const sourceFlag = "--source";
  const index = args.findIndex((arg) => arg === sourceFlag);
  let source = "agent";
  const contentParts = [...args];
  if (index !== -1) {
    if (index === args.length - 1) {
      console.error(`${sourceFlag} 需要值`);
      process.exitCode = 1;
      throw new Error("Missing source value");
    }
    source = ensureSourceOption(args[index + 1]);
    contentParts.splice(index, 2);
  }
  return { text: contentParts.join(" ").trim(), source };
}

function extractDoneArgs(args: string[]): { text: string; source: string; archive: boolean } {
  const contentParts: string[] = [];
  let source = "agent";
  let archive = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--archive") {
      archive = true;
      continue;
    }
    if (arg === "--source") {
      const value = args[index + 1];
      if (!value) {
        console.error("--source 需要值");
        process.exitCode = 1;
        throw new Error("Missing source value");
      }
      source = ensureSourceOption(value);
      index += 1;
      continue;
    }
    contentParts.push(arg);
  }

  return { text: contentParts.join(" ").trim(), source, archive };
}

function addLog(taskId: string, source: string, content: string): void {
  withTaskLock(taskId, () => {
    const current = ensureTask(taskId);
    if (!current) {
      return;
    }
    appendTimestampedLine(current.taskPath, "log.md", source, content);
    touchTask(current.taskPath);
    console.log("已写入 log");
  });
}

function addDecision(taskId: string, source: string, content: string): void {
  withTaskLock(taskId, () => {
    const current = ensureTask(taskId);
    if (!current) {
      return;
    }
    appendTimestampedLine(current.taskPath, "decisions.md", source, content);
    touchTask(current.taskPath);
    console.log("已写入 decision");
  });
}

function addNextAction(taskId: string, source: string, content: string, parent?: string): void {
  withTaskLock(taskId, () => {
    const current = ensureTask(taskId);
    if (!current) {
      return;
    }
    const document = loadNextActionsDocument(current.taskPath);
    if (parent && !document.actions.some((action) => action.id === parent)) {
      console.error("未找到 parent action");
      process.exitCode = 1;
      return;
    }
    document.actions.push(createNextAction(content, source, parent));
    saveNextActionsDocument(current.taskPath, document);
    touchTask(current.taskPath);
    console.log("已写入 next action");
  });
}

function updateNextAction(taskId: string, actionId: string, status: NextActionStatus, reason?: string): void {
  withTaskLock(taskId, () => {
    const current = ensureTask(taskId);
    if (!current) {
      return;
    }

    const document = loadNextActionsDocument(current.taskPath);
    const action = document.actions.find((item) => item.id === actionId);
    if (!action) {
      console.error("未找到 action-id");
      process.exitCode = 1;
      return;
    }

    action.status = status;
    if (nextActionClosedStatuses.has(status)) {
      action.closedAt = nowIso();
      action.closedBy = undefined;
      action.reason = status === "obsolete" ? reason : undefined;
    } else {
      action.closedAt = undefined;
      action.closedBy = undefined;
      action.reason = undefined;
    }

    saveNextActionsDocument(current.taskPath, document);
    touchTask(current.taskPath);
    console.log("已更新 next action");
  });
}

function completeNextAction(taskId: string, source: string, target: string): void {
  withTaskLock(taskId, () => {
    const current = ensureTask(taskId);
    if (!current) {
      return;
    }
    const document = loadNextActionsDocument(current.taskPath);
    const action = findNextAction(document, target, {
      openOnly: true,
      allowKeywordForStructured: false,
    });
    if (!action) {
      const looksLikeActionId = /^NA-\d+$/.test(target);
      console.error(
        document.format === "structured" && !looksLikeActionId
          ? "新结构 next action 只能用 action-id，且只能操作开放 action"
          : "未找到匹配的开放 next action",
      );
      process.exitCode = 1;
      return;
    }

    action.status = "done";
    action.closedAt = nowIso();
    action.closedBy = source;
    action.reason = undefined;

    saveNextActionsDocument(current.taskPath, document);
    touchTask(current.taskPath);
    console.log("已完成一项 next action");
  });
}

function listNextActions(taskId: string): void {
  const current = ensureTask(taskId);
  if (!current) {
    return;
  }

  const document = loadNextActionsDocument(current.taskPath);
  console.log("ID SECTION STATUS TITLE");
  console.log("-".repeat(100));
  document.actions.forEach((action) => {
    const section = nextActionOpenStatuses.has(action.status) ? "open" : "closed";
    console.log(`${action.id} ${section} ${action.status} ${action.title}`);
  });
}

function updateStatusWithLog(taskId: string, status: TaskStatus, source: string, content?: string): void {
  withTaskLock(taskId, () => {
    const current = ensureTask(taskId);
    if (!current) {
      return;
    }
    const { taskPath, meta } = current;
    meta.status = status;
    meta.updated_at = nowIso();
    saveTaskMeta(taskPath, meta);

    const defaultMessages: Record<TaskStatus, string> = {
      draft: "任务状态更新为 draft",
      in_progress: "任务状态更新为 in_progress",
      blocked: "任务状态更新为 blocked",
      review: "任务状态更新为 review",
      done: "任务状态更新为 done",
      cancelled: "任务状态更新为 cancelled",
    };
    const message = content ? `${defaultMessages[status]}：${content}` : defaultMessages[status];
    appendTimestampedLine(taskPath, "log.md", source, message);
    touchTask(taskPath);
    console.log(`已更新状态为 ${status}`);
  });
}

function loadRepoIds(): Set<string> | null {
  if (!existsSync(workspaceReposPath)) {
    return null;
  }
  const text = readFileSync(workspaceReposPath, "utf-8");
  const parsed = YAML.load(text) as RepoRegistry;
  return new Set((parsed.repos ?? []).map((repo) => repo.id));
}

function doctorBootstrapStructure(): { hasError: boolean } {
  let hasError = false;
  const taskCliPath = resolve(rootDir, "scripts", "task-cli.ts");
  const requiredPaths = [
    tasksReadmePath,
    projectSummaryPath,
    knownGapsPath,
    operatingModelPath,
    agentsPath,
    taskCliPath,
  ];

  requiredPaths.forEach((path) => {
    if (!existsSync(path)) {
      console.log(`[ERROR] bootstrap: 缺少 ${path}`);
      hasError = true;
    }
  });

  if (!existsSync(resolve(tasksDir, "archived"))) {
    console.log(`[ERROR] bootstrap: 缺少 ${resolve(tasksDir, "archived")}`);
    hasError = true;
  }

  if (existsSync(agentsPath)) {
    const agentsContent = readFileSync(agentsPath, "utf-8");
    if (!agentsContent.includes(managedSectionStart) || !agentsContent.includes(managedSectionEnd)) {
      console.log("[ERROR] bootstrap: AGENTS.md 缺少 task-memory-bootstrap 受管区块");
      hasError = true;
    } else {
      const missingPhrases = requiredManagedSectionPhrases.filter((phrase) => !agentsContent.includes(phrase));
      if (missingPhrases.length > 0) {
        console.log(`[ERROR] bootstrap: AGENTS.md 受管区块缺少关键约束: ${missingPhrases.join(" / ")}`);
        hasError = true;
      }
    }
  }

  if (existsSync(taskCliPath)) {
    const taskCliContent = readFileSync(taskCliPath, "utf-8");
    if (!taskCliContent.startsWith(managedTaskCliHeader)) {
      console.log("[ERROR] bootstrap: scripts/task-cli.ts 缺少 task-memory-bootstrap 受管标记");
      hasError = true;
    }
  }

  if (!hasError) {
    console.log("[OK] bootstrap structure");
  }

  return { hasError };
}

function doctorTask(taskId?: string): void {
  const repoIds = loadRepoIds();
  const bootstrap = doctorBootstrapStructure();
  const taskIds = taskId
    ? [taskId]
    : [
        ...listTaskIds(tasksDir),
        ...listTaskIds(archivedDir),
      ];

  let hasError = bootstrap.hasError;

  if (taskIds.length === 0) {
    if (!hasError) {
      console.log("[OK] no tasks yet");
    }
    if (hasError) {
      process.exitCode = 1;
    }
    return;
  }

  taskIds.forEach((id) => {
    let taskHasError = false;
    const taskPath = taskPathById(id);
    if (!taskPath) {
      console.log(`[ERROR] ${id}: 任务目录不存在`);
      hasError = true;
      return;
    }

    const meta = loadTaskMeta(taskPath);
    const locationArchived = taskPath.startsWith(archivedDir);

    requiredTaskFiles.forEach((file) => {
      if (!existsSync(resolve(taskPath, file))) {
        console.log(`[ERROR] ${id}: 缺少 ${file}`);
        hasError = true;
        taskHasError = true;
      }
    });

    if (meta.archived !== locationArchived) {
      console.log(`[ERROR] ${id}: archived=${meta.archived} 与目录位置不一致`);
      hasError = true;
      taskHasError = true;
    }

    if (repoIds) {
      meta.related_repos.forEach((repoId) => {
        if (!repoIds.has(repoId)) {
          console.log(`[ERROR] ${id}: related_repos 包含未知仓库 ${repoId}`);
          hasError = true;
          taskHasError = true;
        }
      });
    }

    const warnings = taskHasError ? [] : collectDoctorWarnings(taskPath, meta);
    warnings.forEach((warning) => {
      console.log(`[WARN] ${id}: ${warning}`);
    });

    if (!taskHasError && warnings.length === 0) {
      console.log(`[OK] ${id}`);
    }
  });

  if (hasError) {
    process.exitCode = 1;
  }
}

function archiveTask(taskId: string): void {
  withTaskLock(taskId, () => {
    const sourcePath = resolve(tasksDir, taskId);
    if (!existsSync(sourcePath)) {
      console.error("只能归档活跃任务", taskId);
      process.exitCode = 1;
      return;
    }

    ensureDir(archivedDir);
    const targetPath = resolve(archivedDir, taskId);
    renameSync(sourcePath, targetPath);

    const meta = loadTaskMeta(targetPath);
    meta.archived = true;
    meta.updated_at = nowIso();
    saveTaskMeta(targetPath, meta);
    console.log(`已归档 ${taskId}`);
  });
}

function resumeTask(taskId: string): void {
  withTaskLock(taskId, () => {
    const sourcePath = resolve(archivedDir, taskId);
    if (!existsSync(sourcePath)) {
      console.error("只能恢复已归档任务", taskId);
      process.exitCode = 1;
      return;
    }

    const targetPath = resolve(tasksDir, taskId);
    renameSync(sourcePath, targetPath);

    const meta = loadTaskMeta(targetPath);
    meta.archived = false;
    meta.updated_at = nowIso();
    saveTaskMeta(targetPath, meta);
    console.log(`已恢复 ${taskId}`);
  });
}

function printHelp(): void {
  console.log("task-cli");
  console.log("Commands:");
  console.log("  list [--archived]");
  console.log("  new <title> --goal <text> [--in <text>] [--out <text>] [--accept <text>] [--placeholder]");
  console.log("  show <task-id>");
  console.log("  start|block|review <task-id> [text] [--source human|agent|subagent]");
  console.log("  done <task-id> [text] [--source human|agent|subagent] [--archive]");
  console.log("  update <task-id> [--status <value>] [--title <text>] [--add-repo <repo-id>] [--remove-repo <repo-id>]");
  console.log("  log <task-id> <text> [--source human|agent|subagent]");
  console.log("  decision <task-id> <text> [--source human|agent|subagent]");
  console.log("  next list <task-id>");
  console.log("  next add <task-id> <text> [--parent <action-id>] [--source human|agent|subagent]");
  console.log("  next update <task-id> <action-id> --status open|blocked|done|obsolete [--reason <text>]");
  console.log("  next done <task-id> <action-id|keyword> [--source human|agent|subagent]");
  console.log("  doctor [task-id]");
  console.log("  archive <task-id>");
  console.log("  resume <task-id>");
}

try {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "list":
      listTasks(rest.includes("--archived"));
      break;
    case "new":
      createTask(parseNewTaskArgs(rest));
      break;
    case "show":
      showTask(rest[0] ?? "");
      break;
    case "start":
      {
        const taskId = rest.shift() ?? "";
        const { text, source } = extractOptionalTextAndSource(rest);
        updateStatusWithLog(taskId, "in_progress", source, text || undefined);
      }
      break;
    case "block":
      {
        const taskId = rest.shift() ?? "";
        const { text, source } = extractOptionalTextAndSource(rest);
        updateStatusWithLog(taskId, "blocked", source, text || undefined);
      }
      break;
    case "review":
      {
        const taskId = rest.shift() ?? "";
        const { text, source } = extractOptionalTextAndSource(rest);
        updateStatusWithLog(taskId, "review", source, text || undefined);
      }
      break;
    case "done":
      {
        const taskId = rest.shift() ?? "";
        const { text, source, archive } = extractDoneArgs(rest);
        updateStatusWithLog(taskId, "done", source, text || undefined);
        const current = ensureTask(taskId);
        if (!current) {
          break;
        }
        warnIfOpenNextActions(taskId, current.taskPath);
        if (archive) {
          archiveTask(taskId);
        }
      }
      break;
    case "update":
      updateTask(rest.shift() ?? "", rest);
      break;
    case "log":
      {
        const taskId = rest.shift() ?? "";
        const { text, source } = extractTextAndSource(rest);
        addLog(taskId, source, text);
      }
      break;
    case "decision":
      {
        const taskId = rest.shift() ?? "";
        const { text, source } = extractTextAndSource(rest);
        addDecision(taskId, source, text);
      }
      break;
    case "next":
      {
        const subcommand = rest.shift();
        if (subcommand === "list") {
          listNextActions(rest.shift() ?? "");
          break;
        }
        const taskId = rest.shift() ?? "";
        if (subcommand === "add") {
          const { text, source, parent } = extractNextAddArgs(rest);
          addNextAction(taskId, source, text, parent);
          break;
        }
        if (subcommand === "update") {
          const { actionId, status, reason } = extractNextUpdateArgs(rest);
          updateNextAction(taskId, actionId, status, reason);
          break;
        }
        if (subcommand === "done") {
          const { target, source } = extractNextDoneArgs(rest);
          completeNextAction(taskId, source, target);
          break;
        }
        printHelp();
      }
      break;
    case "doctor":
      doctorTask(rest[0]);
      break;
    case "archive":
      archiveTask(rest[0] ?? "");
      break;
    case "resume":
      resumeTask(rest[0] ?? "");
      break;
    default:
      printHelp();
      process.exitCode = command ? 1 : 0;
      break;
  }
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
}
