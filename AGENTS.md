# Quick checks

- Run linter: `bun run lint`
- Run tests: `bun run test`
- Run full local CI (lint + typecheck + tests + build): `bun run ci:local`
- Before commit/push: run `bun run ci:local` and fix failures.

<!-- task-memory-bootstrap:begin -->
## Task And Memory Workflow

### 统一工作规范

- 本仓库默认用“活跃任务目录 + 长期知识沉淀”的方式组织工作，而不是把过程留在聊天记录里。
- 每次会话开始时，先了解 `tasks/` 下当前有哪些活跃任务，再判断本次请求是续做已有任务还是创建新任务。
- 对“看一下 / 排查 / 整理 / 补齐 / 调研 / 评估”这类开放式工作，默认按任务方式组织，而不是一次性问答。
- 只要工作会跨多个文件、需要持续记录、需要筛选判断、或可能跨会话继续，就应创建或复用 `tasks/<task-id>/`。
- 续做已有目标时，必须先读取该任务最新状态；`tasks/<task-id>/` 是真实进度源，聊天上下文只作为辅助线索。
- 如果经历上下文压缩，或由新的 worker / agent 接手，不得仅依据会话记忆继续执行，必须重新读取任务状态。
- 新信息默认先进入任务目录；确认长期有效后，再提升到 `docs/`、`memory/`、`workspace/` 或 `docs/adr/`。

### 任务状态同步规则

- 只要某项工作已经进入 `tasks/<task-id>/`，任务状态就必须和真实进度同步，不能把任务文件当作事后补写的流水账。
- 创建任务后，一旦开始实际执行，就必须立即把状态从 `draft` 更新为 `in_progress`，并写入对应日志；不得一边推进工作、一边让任务停留在 `draft`。
- 只要该任务产出了实质性交付，例如修改文档、修改代码、形成结论、完成提交，就必须在同一工作回合内同步更新 `task.yaml`、`log.md` 与 `next-actions.md`；不得等到之后想起来再补。
- 如果主体工作已经完成，必须先把任务推进到 `review` 或 `done`，再决定是否归档；不得出现“交付已提交但任务仍长期停留在 `in_progress` / 初始化占位状态”。
- 如果对应任务仍是 `draft`，或 `next-actions.md` 仍停留在初始化占位内容，就不应继续把该任务视为已正常推进，更不应忽略这些失配直接结束工作。
- 续做时如果发现“任务状态、日志、下一步”与实际工作区或提交历史不一致，第一步应先对齐任务状态，再继续推进；不得带着失配继续工作。
- 长期知识写入 `memory/`，任务过程写入 `tasks/`；不得把任务进度写进 `memory/`。
- 高频任务操作优先通过任务工具入口执行。

### Next Action 规则

- `next-actions.md` 不是可随手覆盖的临时清单，而是任务行动历史；常规维护默认通过 `bun scripts/task-cli.ts next ...` 完成，而不是手改文件。
- `next-actions.md` 的标准结构是 `# Next Actions`、`## Open`、`## Closed`；`open`/`blocked` 留在 Open，`done`/`obsolete` 留在 Closed。
- 每条 next action 都应保留稳定 id；现有 action 不得直接删除，也不得把旧 action 原地改成另一件事。
- 如果某项 next action 已过时、被替代或不再需要执行，应把它标记为 `obsolete` 并写明 `reason`，而不是直接删掉。
- `blocked` 仍属于 Open 区；子 action 通过 `parent: <action-id>` 关系表达，不通过手工缩进制造隐式层级。
- 仓库里若仍有旧复选框格式的 `next-actions.md`，CLI 需要继续能读取；首次通过 CLI 写入时再迁移到新结构。

更多细节见 `docs/governance/agent-operating-model.md`。
<!-- task-memory-bootstrap:end -->
