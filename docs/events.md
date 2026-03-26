# 事件参考

本文档描述 web client、Orbit 与 Anchor 之间交换的 JSON-RPC 方法与 Orbit 系统消息。

线上传输格式：基于 WebSocket 的类 JSON-RPC 2.0 消息。

## 客户端 -> 服务器

### 线程管理

| 方法 | 参数 | 说明 |
|---|---|---|
| `thread/start` | `{ cwd, approvalPolicy?, sandbox? }` | 创建新线程 |
| `thread/list` | `{ cursor, limit }` | 分页列表 |
| `thread/resume` | `{ threadId }` | 恢复线程及其历史 |
| `thread/archive` | `{ threadId }` | 软归档 |

### 回合管理（`turn`）

| 方法 | 参数 | 说明 |
|---|---|---|
| `turn/start` | `{ threadId, input, collaborationMode?, model?, effort?, sandboxPolicy? }` | 启动回合。`input` 支持文本与图片 |
| `turn/interrupt` | `{ threadId, turnId }` | 中断当前回合 |

`input` 示例：

```json
[
  { "type": "text", "text": "..." },
  { "type": "input_image", "image_url": "https://...", "detail": "high" }
]
```

### Collaboration mode

| 方法 | 参数 | 说明 |
|---|---|---|
| `collaborationMode/list` | `{}` | 返回可用模式 |

在 `turn/start` 里传入 `collaborationMode` 的示例：

```json
{
  "collaborationMode": {
    "mode": "plan",
    "settings": {
      "model": "o3",
      "reasoning_effort": "medium",
      "developer_instructions": "..."
    }
  }
}
```

支持模式：`"plan"`、`"code"`。

### 审批请求响应

针对具体 `id` 的 JSON-RPC response：

```json
{ "id": 123, "result": { "decision": "accept" } }
```

`decision` 可选值：`accept`、`acceptForSession`、`decline`、`cancel`。

### 用户输入请求响应

```json
{ "id": 123, "result": { "answers": { "questionId": { "answers": ["..."] } } } }
```

## Anchor 本地 helper 方法（`anchor.*`）

这些方法由 Anchor 在本地处理，不会代理到 `codex app-server`。

| 方法 | 参数 | 结果 |
|---|---|---|
| `anchor.listDirs` | `{ path?, startPath? }` | `{ dirs, parent, current, roots }` |
| `anchor.git.inspect` | `{ path }` | `{ isGitRepo, repoRoot?, currentBranch? }` |
| `anchor.git.status` | `{ path }` | `{ repoRoot, branch, clean, entries[] }` |
| `anchor.git.diff` | `{ repoRoot, path }` | `{ repoRoot, path, diff, isBinary?, tooLarge? }` |
| `anchor.git.logGraph` | `{ repoRoot, limit?, all? }` | `{ repoRoot, graph, truncated }` |
| `anchor.git.worktree.list` | `{ repoRoot }` | `{ repoRoot, mainPath, worktrees[] }` |
| `anchor.git.worktree.create` | `{ repoRoot, baseRef?, branchName?, path?, rootDir? }` | `{ repoRoot, path, branch, head }` |
| `anchor.git.worktree.remove` | `{ repoRoot, path, force? }` | `{ removed }` |
| `anchor.git.worktree.prune` | `{ repoRoot }` | `{ prunedCount }` |
| `anchor.git.commit` | `{ repoRoot, message, stageAll?, paths? }` | `{ committed, output }` |
| `anchor.git.push` | `{ repoRoot, remote?, branch? }` | `{ pushed, output }` |
| `anchor.git.revert` | `{ repoRoot, paths? }` | `{ reverted, output }` |
| `anchor.release.inspect` | `{ ... }` | 本地 release 过程状态 |
| `anchor.release.start` | `{ ... }` | 启动本地 release 过程 |
| `anchor.release.status` | `{ ... }` | release 进度 |
| `anchor.config.read` | `{ path?, anchorId? }` | `{ path, exists, content, candidates, platform }` |
| `anchor.config.write` | `{ content, path?, anchorId? }` | `{ saved, path, bytes }` |
| `anchor.image.read` | `{ path, anchorId? }` | `{ path, mimeType, dataBase64, bytes }` |
| `anchor.file.read` | `{ path, anchorId? }` | `{ path, content, bytes, truncated }` |

## Orbit control 消息（非 JSON-RPC）

| 类型 | 格式 | 用途 |
|---|---|---|
| `orbit.subscribe` | `{ type, threadId }` | 订阅线程事件 |
| `orbit.unsubscribe` | `{ type, threadId }` | 取消订阅线程 |
| `orbit.list-anchors` | `{ type }` | 请求已连接 Anchor 列表 |
| `orbit.anchors` | `{ type, anchors }` | 返回设备列表 |
| `orbit.anchor-connected` | `{ type, anchor }` | 新 Anchor 连接通知 |
| `orbit.anchor-disconnected` | `{ type, anchorId }` | Anchor 断开通知 |
| `orbit.hello` | `{ type, ... }` | 建连欢迎消息 |
| `ping` / `pong` | `{ type }` | Keepalive |

## 服务器 -> 客户端

### 线程生命周期

| 方法 | 参数 | 说明 |
|---|---|---|
| `thread/started` | `{ thread: ThreadInfo }` | `thread/start` 后通知 |
| `thread/list` (response) | `{ data: ThreadInfo[] }` | RPC 响应 |
| `thread/resume` (response) | `{ thread: { id, turns: [{ items }] } }` | 完整线程历史 |

### 回合生命周期

| 方法 | 参数 | 说明 |
|---|---|---|
| `turn/started` | `{ turn: { id, status } }` | 初始化 UI 状态 |
| `turn/completed` | `{ turn: { id, status } }` | 状态：`Completed`、`Interrupted`、`Failed` |
| `turn/plan/updated` | `{ turnId, explanation?, plan[] }` | 计划进度（`Pending/InProgress/Completed`） |
| `turn/diff/updated` | `{ threadId, turnId, diff }` | workspace 累积 diff |

### 流式 item 通知

| 方法 | 参数 | 说明 |
|---|---|---|
| `item/started` | `{ item }` | item 开始 |
| `item/agentMessage/delta` | `{ threadId, itemId, delta }` | assistant 回复文本流 |
| `item/reasoning/summaryTextDelta` | `{ threadId, delta }` | reasoning 摘要流 |
| `item/reasoning/textDelta` | `{ threadId, delta }` | reasoning 全量流 |
| `item/reasoning/summaryPartAdded` | `{ threadId }` | reasoning 分段 |
| `item/commandExecution/outputDelta` | `{ threadId, itemId, delta }` | 命令 stdout/stderr |
| `item/fileChange/outputDelta` | `{ threadId, itemId, delta }` | file diff 流 |
| `item/commandExecution/terminalInteraction` | `{ threadId, itemId, processId?, stdin }` | 进程交互输入 |
| `item/mcpToolCall/progress` | `{ threadId, itemId, message }` | MCP 调用进度 |
| `item/plan/delta` | `{ threadId, itemId, delta }` | 计划文本流 |
| `item/completed` | `{ item }` | item 最终状态 |

### 来自服务器的审批请求

| 方法 | 参数 |
|---|---|
| `item/commandExecution/requestApproval` | `{ threadId, itemId, reason? }` |
| `item/fileChange/requestApproval` | `{ threadId, itemId, reason? }` |
| `item/mcpToolCall/requestApproval` | `{ threadId, itemId, reason? }` |

### 来自服务器的用户输入请求

| 方法 | 参数 |
|---|---|
| `item/tool/requestUserInput` | `{ threadId, itemId, questions[] }` |

问题格式：

```json
{
  "id": "...",
  "header": "...",
  "question": "...",
  "isOther": false,
  "isSecret": false,
  "options": [{ "label": "...", "description": "..." }]
}
```

## `item/completed` 中的 `item` 类型

| Type | Payload | MessageKind |
|---|---|---|
| `userMessage` | `{ content: [{ type: "text", text }] }` | user |
| `agentMessage` | `{ text }` | assistant |
| `reasoning` | `{ summary: string[], content: string[] }` | `reasoning` |
| `commandExecution` | `{ command, aggregatedOutput, exitCode }` | `command` |
| `fileChange` | `{ changes: [{ path, diff? }] }` | `file` |
| `mcpToolCall` | `{ tool, result?, error? }` | `mcp` |
| `webSearch` | `{ query }` | `web` |
| `imageView` | `{ path?, imageUrl?, image_url?, mimeType?, mime_type?, width?, height?, bytes? }` | `image` |
| `enteredReviewMode` | `{ review }` | `review` |
| `exitedReviewMode` | `{ review }` | `review` |
| `plan` | `{ text }` | `plan` |
| `collabAgentToolCall` | `{ tool, status, receiverThreadIds, prompt }` | `collab` |
| `contextCompaction` | `{}` | `compaction` |

## 客户端渲染说明

- reasoning deltas 会缓冲后以单个可折叠块展示
- `terminalInteraction` 中空 `stdin` 视为等待状态
- 会从 `agentMessage` 中移除 `<proposed_plan>` 标签
- plan-item 渲染为单独卡片并带确认流程
- `contextCompaction` 显示为中性分隔信息
- `collaborationMode` 与计划确认状态同步
