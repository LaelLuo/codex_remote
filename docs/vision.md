# Vision

## 目标

让开发者可以通过 web client，在任意远程设备上启动并控制其电脑上的 Codex CLI 会话，同时通过 Anchor 保持命令在本地执行。

## 核心用户

- 在本地使用 Codex 的个人开发者，希望在离开电脑时仍能观察/确认操作

## 关键场景

1. 远程启动 Codex 任务（手动或由外部触发）
2. 在手机/平板上查看流式输出（日志、diff、错误）
3. 对高风险操作进行批准或拒绝
4. 必要时接管控制并发送直接输入

## 非目标（当前聚焦）

- 在云容器中执行 agent 来替代本地机器
- 构建完整 native mobile 应用（优先级为 web）
- 构建 enterprise IAM 平台来替代务实的 self-host/dev 流程

## 原则

- `local-first`：命令仅由本地 Anchor 执行
- `outbound-only`：本地机器主动发起到 relay 的出站连接
- `structured protocol`：通过 JSON-RPC `codex app-server` 交互，不做 PTY 文本解析
- `low coupling`：web client、control plane 与 Anchor 可独立演进
- `provider choice`：Cloudflare 与 Deno 作为等价 self-host providers

## 产品形态

- **Anchor（本地）**：启动 `codex app-server`、代理 JSON-RPC、处理 approvals 与输入
- **Orbit / Control Plane**：auth + websocket relay + 最小会话状态
- **Web client**：统一界面，覆盖线程、状态、审批与控制

## 关键决策

- Anchor 支持多平台（macOS/Linux/Windows）
- 静态 web client
- auth/session 层面的 multi-user 支持
- passkey/TOTP/device-code 认证（取决于 provider/模式）
- 统一的 self-host CLI 流程：`codex-remote self-host --provider ... --login`

## 成功标准

- 远程用户能以低延迟看到 live 输出
- approvals 无需重启任务即可完成
- 会话启动/控制可全部在浏览器中完成
- 本地机器无需开放公网上的入站端口

## Open-core 模式

Codex Remote 以 [MIT license](../LICENSE) 发布。

你可以完整自建 self-host 栈，也可以在条件允许时使用托管 relay。
