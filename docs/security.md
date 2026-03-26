# 安全

## 威胁模型

- 未授权的远程控制本地机器
- 会话 tokens（access/refresh）被窃取或重放
- 通过日志或模型请求泄露敏感数据
- 滥用本地 Anchor WebSocket/API

## 当前防护措施

### 用户认证

- 支持 passkey（WebAuthn）、TOTP 和 basic-flow（取决于 provider/`AUTH_MODE`）
- access token 与 refresh token 分离签发
- refresh token 在会话刷新时轮换（`/auth/refresh`）
- 服务端会话校验支持通过 `/auth/logout` 撤销 token

### Anchor 认证

- 主路径：device-code（`/auth/device/code` -> `/auth/device/authorise` -> `/auth/device/token`）
- Anchor 获取 `anchorAccessToken` + `anchorRefreshToken`，并通过 `/auth/device/refresh` 刷新
- 为向后兼容保留 legacy JWT secret flow
- 凭据保存到 `~/.codex-remote/credentials.json`，权限为 `0600`

### 本地 Anchor WebSocket 防护

默认情况下，本地 Anchor socket 不会对任意外部访问开放。

- 可通过 `ANCHOR_WS_TOKEN` 强制要求显式 token
- 未设置 token 时仅允许 loopback/private 地址
- `ANCHOR_WS_ALLOW_PUBLIC=1` 会取消该限制（高风险模式）

### 传输安全

- 外部流量走 HTTPS/WSS
- Anchor 主动发起到 control plane 的出站连接
- 本地机器不需要为 Orbit 开放入站端口

### CORS 与安全响应头（Orbit）

- origin 基于 `PASSKEY_ORIGIN` / `ALLOWED_ORIGIN` 校验
- `localhost` 与 `127.0.0.1` 在 dev 环境允许
- Orbit 响应包含 `X-Content-Type-Options: nosniff` 与 `X-Frame-Options: DENY`

## 数据隔离

- 事件路由按 `threadId` 与 socket 订阅关系执行
- Cloudflare provider 使用 per-user Durable Object
- 会话状态存储在 backend 侧（依据 provider 为 D1 或 KV）

## 已知限制

- web token 存储在 `localStorage`；设备被攻破会导致会话被攻破
- WebSocket query string token（`?token=`）可能进入基础设施日志
- web client 与 Anchor 之间没有端到端 E2E 加密（TLS 在 edge/backend 终止）
- Anchor credentials 文件以 plaintext 保存敏感 tokens/secrets
- 应用层未实现独立的 auth/ws endpoints rate limiting
- localhost-origin 自动放行便于 dev，但在 shared 机器上需谨慎

## 运维建议

- 定期轮换 secrets（`CODEX_REMOTE_WEB_JWT_SECRET`，以及 legacy-flow 下的 `CODEX_REMOTE_ANCHOR_JWT_SECRET`）
- 设备更换或怀疑泄露时使用 `codex-remote logout`/`/auth/logout`
- 无必要不要开启 `ANCHOR_WS_ALLOW_PUBLIC=1`
- 不要在与 agent 的对话中提供 secrets 或私钥
- 将 CORS origins 限制为 production 域名

## 后续可增强方向

- 为 auth/device/ws endpoints 增加 rate limiting
- 增加 client 与 Anchor 之间 payload 的可选 E2E 加密
- 增加日志中的集中式 secrets 脱敏
