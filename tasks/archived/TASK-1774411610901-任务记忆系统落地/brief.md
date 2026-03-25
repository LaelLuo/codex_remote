# 任务记忆系统落地

## 目标

- 为 codex_remote 落地任务/记忆工作流并验证可续做

## 范围

### In

- 创建 tasks、memory、治理文档与 task CLI
- 注入 AGENTS 受管区块
- 初始化首条活跃任务并记录本次 bootstrap

### Out

- 修改产品业务逻辑
- 引入额外部署流程

## 验收标准

- bun run task -- doctor 通过
- 后续会话可直接读取任务目录续做
