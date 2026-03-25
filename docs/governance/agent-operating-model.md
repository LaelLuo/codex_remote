<!-- Managed by task-memory-bootstrap. Update through the skill, not by ad-hoc copy. -->
# Agent Operating Model

## 目标

让人和 agent 在目标仓库中共享同一套：

- 阅读顺序
- 统一工作流
- 信息落点规则
- 项目记忆系统
- 任务系统
- 风险升级规则

## 统一工作流

### 会话开始

1. 先了解 `tasks/` 下当前有哪些活跃任务。
2. 判断本次请求是续做已有任务、创建新任务，还是明显的一次性小问题。
3. 只有明显的一次性小问题，才允许跳过任务目录。

### 开放式工作默认组织方式

- 对“看一下 / 排查 / 整理 / 补齐 / 调研 / 评估”这类开放式工作，默认按任务方式组织，而不是一次性问答。
- 只要工作会跨多个文件、需要持续记录、需要筛选判断、或可能跨会话继续，就应创建或复用 `tasks/<task-id>/`。
- 任务目录是过程记录层；长期稳定知识再提升到 `docs/`、`memory/`、`workspace/` 或 `docs/adr/`。

### 续做与上下文压缩

- 续做已有目标时，必须先读取该任务最新状态。
- `tasks/<task-id>/` 是真实进度源，聊天上下文只作为辅助线索。
- 如果经历上下文压缩，或由新的 worker / agent 接手，不得仅依据会话记忆继续执行，必须重新读取任务状态。

### 任务状态必须跟随真实进度

- 只要工作已经进入 `tasks/<task-id>/`，任务状态、日志和下一步就必须与真实进度同步，不能把任务目录当作事后补账区。
- 创建任务后，一旦开始实际执行，就应立即从 `draft` 切到 `in_progress`，并记录开始日志。
- 只要该任务产出了实质性结果，例如修改文档、修改代码、形成结论、完成提交，就应在同一工作回合内同步更新 `task.yaml`、`log.md` 和 `next-actions.md`。
- 主体工作完成后，应先推进到 `review` 或 `done`，再决定是否归档；归档不替代状态更新。
- 如果发现任务状态、日志或下一步与真实工作区、交付结果、提交历史不一致，续做者必须先修正任务，再继续推进。

### Next Action 生命周期约束

- `next-actions.md` 是任务行动历史，而不是可随意覆盖的临时待办；默认通过 `bun scripts/task-cli.ts next ...` 维护。
- 每条 next action 都应保留稳定 id，格式为 `NA-<时间戳>`；现有 action 不得直接删除。
- `next-actions.md` 结构固定为 `# Next Actions`、`## Open`、`## Closed`；`open` 与 `blocked` 留在 Open 区，`done` 与 `obsolete` 进入 Closed 区。
- 如果某个 next action 的语义已经变化，不应原地改写成另一件事；应新建 action，并把旧 action 标记为 `obsolete`。
- `obsolete` 必须附带 `reason`；否则后续续做者无法判断该 action 是被替代、失效还是误建。
- 子 action 通过 `parent: <action-id>` 明确表达父子关系，不通过手工缩进制造隐式层级。
- 仓库中已有的旧复选框格式 `next-actions.md` 仍应可读；CLI 在首次写入该文件时负责迁移到新结构，而不是直接报错。

## 阅读协议

### 新任务

1. `README.md`
2. `AGENTS.md`
3. 当前活跃任务列表
4. 相关 `docs/`
5. `memory/project-summary.md`
6. `memory/known-gaps.md`

### 续做已有任务

1. `README.md`
2. `AGENTS.md`
3. 当前活跃任务列表
4. `tasks/<task-id>/task.yaml`
5. `tasks/<task-id>/brief.md`
6. `tasks/<task-id>/next-actions.md`
7. 按需回读该任务的 `log.md` / `decisions.md`

## 工具入口

- `bun scripts/task-cli.ts list`
- `bun scripts/task-cli.ts new <中文任务名> --goal <目标> [--in <范围>] [--out <范围>] [--accept <标准>]`
- `bun scripts/task-cli.ts show <task-id>`
- `bun scripts/task-cli.ts start|block|review|done <task-id> [说明] [--source ...]`（`done` 支持 `--archive`）
- `bun scripts/task-cli.ts update <task-id> [--status ...]`
- `bun scripts/task-cli.ts doctor [task-id]`
- `bun scripts/task-cli.ts log <task-id> <内容> [--source human|agent|subagent]`
- `bun scripts/task-cli.ts decision <task-id> <内容> [--source human|agent|subagent]`
- `bun scripts/task-cli.ts next list <task-id>`
- `bun scripts/task-cli.ts next add <task-id> <内容> [--parent <action-id>] [--source ...]`
- `bun scripts/task-cli.ts next update <task-id> <action-id> --status open|blocked|done|obsolete [--reason ...]`
- `bun scripts/task-cli.ts next done <task-id> <action-id|关键字>`
