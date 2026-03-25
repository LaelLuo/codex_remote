# Tasks

`tasks/` 用于保存按用户目标拆分的任务上下文。

## 基本规则

- 一个用户目标对应一个任务目录
- 同一目标跨会话复用同一目录
- 活跃任务放在 `tasks/`
- 归档任务放在 `tasks/archived/`
- 归档只改变目录位置，不改变业务状态

## 目录命名

- 格式：`TASK-<13位毫秒时间戳>-<中文简短语义名>`
- 示例：`TASK-1773732090901-任务系统与记忆系统落地`

## 推荐文件

- `task.yaml`：任务元数据
- `brief.md`：目标、范围、验收标准
- `log.md`：过程记录
- `decisions.md`：任务内决策
- `next-actions.md`：下一步和阻塞

## 业务状态

- `draft`
- `in_progress`
- `blocked`
- `review`
- `done`
- `cancelled`

## CLI

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
- `bun scripts/task-cli.ts archive <task-id>`
- `bun scripts/task-cli.ts resume <task-id>`

## 创建建议

- 默认把 `goal` 在创建时写清，避免后续续做还要回溯聊天记录。
- `--in` / `--out` / `--accept` 可以重复传入，多条会按 bullet 写入 `brief.md`。
- 默认生成的 `next-actions.md` 应该能直接指导续做；若发现仍是旧占位内容，优先修正任务再继续推进。
- `next-actions.md` 是行动历史，不是可手动覆盖的临时清单；常规更新默认走 CLI，不直接删旧项。
- `next-actions.md` 的标准结构固定为 `# Next Actions`、`## Open`、`## Closed`；`open`/`blocked` 在 Open，`done`/`obsolete` 在 Closed。
- 每条 next action 都应保留稳定 id；若事项过时，应标记为 `obsolete` 并写明 `reason`，而不是直接删除。
- 子 action 通过 `--parent <action-id>` 建立关系，不通过手工缩进制造隐式层级。
- 旧复选框格式仍允许被 CLI 读取；首次通过 `next add|update|done` 写入时，会自动迁移到新结构。
