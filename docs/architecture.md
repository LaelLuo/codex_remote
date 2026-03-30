# 架构

## 高层示意

```text
      Web Client（浏览器）
              |
              | HTTPS + WebSocket
              v
   Orbit / Control Plane（Cloudflare 或 Deno）
              |
              | WebSocket relay（由本地机器发起的出站连接）
              v
   Anchor（本地 bridge：macOS/Linux/Windows）
              |
              | JSON-RPC over stdio
              v
        codex app-server
```

## 组件

### 1) Anchor（本地 bridge）

职责：

- 启动并维护 `codex app-server` 进程
- 在 web client 与 `app-server` 之间代理 JSON-RPC
- 转发用户输入（包含交互式输入）
- 转发需要用户确认的请求
- 执行本地 helper 方法（`anchor.*`），用于 git/config/file/image/release 操作

技术栈：

- Bun runtime
- 基于 stdio 的 JSONL/JSON-RPC
- 连接 control plane 的 WebSocket
- device access tokens（`anchorAccessToken` + `anchorRefreshToken`）

### 2) Orbit / Control Plane

职责：

- 对 web client 做身份认证（passkey/TOTP；FastAPI 还支持 basic 模式）
- 签发用户 token 与 refresh token
- 为 Anchor 提供 device-code flow
- 校验 `/ws/client` 与 `/ws/anchor` 连接
- 按 `threadId` 在 Anchor 与 clients 之间路由消息

Providers：

- `services/orbit`: Cloudflare Worker + Durable Objects + D1
- `services/orbit-deno`: Deno Deploy runtime + Deno KV
- `services/control-plane`: 用于轻量 self-host 的 FastAPI 实现

### 3) Web Client

职责：

- 用户登录（passkey/TOTP/device authorisation）
- 线程列表、历史记录与流式更新
- 发送命令、确认结果与用户输入
- 自动重连

技术栈：

- Svelte + Vite
- 带重连逻辑的 WebSocket
- 静态部署（Cloudflare Pages、Deno Deploy、Vercel 等）

## 数据流

### A) 用户登录

1. 客户端调用 auth endpoints（`/auth/register/*`、`/auth/login/*`）
2. Control plane 返回 `token` + `refreshToken`
3. 客户端保存 token，并通过 `/auth/refresh` 刷新 access token
4. 结束会话时调用 `/auth/logout`

### B) Anchor 的 Device login

1. Anchor 通过 `POST /auth/device/code` 请求 code
2. 用户在浏览器中通过 `POST /auth/device/authorise` 确认 code
3. Anchor 轮询 `POST /auth/device/token`
4. 授权完成后，Anchor 获取 `anchorAccessToken` + `anchorRefreshToken`
5. token 过期后，Anchor 通过 `POST /auth/device/refresh` 刷新

### C) 工作会话

1. Web client 连接 `/ws/client?token=<jwt>`
2. Anchor 连接 `/ws/anchor?token=<anchor-token>`
3. 客户端通过 `orbit.subscribe` 订阅线程
4. RPC `thread/*` 与 `turn/*` 通过 control plane 转发到 Anchor
5. Anchor 将调用转发给 `codex app-server`
6. 通知与结果回传给已订阅的客户端

### D) 审批确认

1. `codex app-server` 发送 `item/*/requestApproval`
2. Anchor/Orbit 将请求转发到客户端
3. 客户端以包含 `decision` 的 JSON-RPC result 响应
4. 响应返回到 `app-server`

## 消息协议

主协议为基于 WebSocket 的类 JSON-RPC 格式。

- 业务消息：方法 `thread/*`、`turn/*`、`item/*`
- Orbit control-frame：`orbit.hello`、`orbit.subscribe`、`orbit.unsubscribe`、`orbit.list-anchors`、`orbit.anchors`、`orbit.anchor-connected`、`orbit.anchor-disconnected`、`ping/pong`
- Anchor metadata：`anchor.hello`

可通过以下命令为客户端集成生成 TypeScript schema：

```bash
codex app-server generate-ts --out DIR
```

## HTTP/WS endpoints

### WebSocket

- `GET /ws/client` - web client socket
- `GET /ws/anchor` - Anchor socket

### Auth/API（通用集合）

- `GET /health`
- `GET /auth/session`
- `POST /auth/register/*`
- `POST /auth/login/*`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/device/code`
- `POST /auth/device/token`
- `POST /auth/device/authorise`
- `POST /auth/device/refresh`

说明：`register/login` endpoints 的精确集合取决于 provider 与 `AUTH_MODE`。

## 路由状态

- Cloudflare provider 将 relay 状态存储在每用户 Durable Object 中
- Deno/FastAPI providers 实现等价的 `threadId` 路由
- 所有方案的核心目标：仅向相关且已订阅的 socket 投递消息

## 安全性

- 用户认证通过 passkey/TOTP（FastAPI 模式还支持 basic）
- access/refresh tokens 带服务端会话校验与撤销能力
- web 与 anchor 上下文使用独立 token/session 模型
- 外部流量使用 TLS

详情见 [auth.md](auth.md) 与 [security.md](security.md)。
