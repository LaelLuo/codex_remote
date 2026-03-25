# Project Summary

## 项目范围

- `codex_remote` 让用户从手机、平板或浏览器远程连接本机上的 Codex CLI 会话，查看流式输出、审批请求和文件变更。
- 项目覆盖本地 Anchor、云端/自托管 control plane、以及浏览器 Web client 三层，不只是单一前端或单一后端仓库。

## 核心模块

- `src/`：Svelte + Vite 的 Web client。
- `services/anchor/`：本地 Bun bridge，负责连接 `codex app-server` 并与 control plane 通讯。
- `services/orbit/`：Cloudflare Worker + Durable Object 版本的 control plane。
- `services/orbit-deno/`：Deno Deploy 版本的 control plane。
- `services/control-plane/`：FastAPI 版本的 control plane。
- `bin/`：本地 CLI 与 self-host 入口脚本。

## 环境角色

- 运行时以 Bun 为主；前端和 Anchor 相关脚本都围绕 Bun 工作流组织。
- 浏览器侧通过 HTTPS + WebSocket 连接 Orbit / control plane。
- Anchor 在本地与 `codex app-server` 通过 stdio / JSON-RPC 通讯。
- Self-host 当前至少支持 `cloudflare` 与 `deno` 两个 provider。

## 当前稳定共识

- 仓库以“Web client + Anchor + 多 provider control plane”的多组件架构维护。
- 本地开发与提交前校验以 `bun run lint`、`bun run test`、`bun run ci:local` 为标准入口。
- 开放式、多文件、可跨会话工作默认应沉淀到 `tasks/`，长期稳定知识沉淀到 `memory/` 与 `docs/`。

不要在这里记录单个任务进度或会话流水账。
