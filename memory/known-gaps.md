# Known Gaps

## 协作与流程缺口

- 任务/记忆系统刚在 2026-03-25 引入，后续仍需要观察团队是否稳定按 `tasks/` + `memory/` 流程执行。
- 当前仓库还没有 `workspace/repos.yaml` 之类的仓库注册表，因此 `task-cli` 的跨仓库关联校验能力暂时没有启用。

## 验证缺口

- 新增的 `scripts/task-cli.ts` 目前主要依赖 CLI smoke test 与 `doctor` 验证，还没有独立自动化测试覆盖。
- `task-cli` 已接入当前 Bun/TypeScript 生态，但尚未纳入现有 `bun run test` 测试矩阵。
- `bun run ci:local` 当前会在 `services/anchor/` 的 TypeScript 阶段失败，原因是仓库现状缺少 Bun 类型声明与若干隐式 `any` 修复；这属于现有基线问题，不是本次 bootstrap 新引入的问题。

## 文档缺口

- 现有项目文档主要描述产品、部署和架构，新增的任务/记忆工作流还需要靠 `AGENTS.md`、`tasks/README.md` 和治理文档来建立共识。
- 如果后续团队形成更细的协作分工或任务模板，需要再补充到 `docs/governance/` 或 `memory/`，而不是只留在聊天里。

不要记录短期任务步骤或一次性待办。
