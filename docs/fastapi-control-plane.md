# FastAPI Control Plane

如果你需要更简单的 self-host 栈，它可以作为 Orbit（Cloudflare/Deno）的轻量替代方案：

- 部署在 Vercel（或任意 static host）的静态 frontend
- 基于 FastAPI 的 backend，提供 auth + websocket relay
- 运行在 macOS/Linux/Windows 的本地 Anchor

## 已实现内容

- `GET /health`
- `GET /auth/session`
- `POST /auth/register/basic`
- `POST /auth/login/basic`
- `POST /auth/register/options`（`AUTH_MODE=passkey` 模式）
- `POST /auth/register/verify`（`AUTH_MODE=passkey` 模式）
- `POST /auth/login/options`（`AUTH_MODE=passkey` 模式）
- `POST /auth/login/verify`（`AUTH_MODE=passkey` 模式）
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/device/code`
- `POST /auth/device/authorise`
- `POST /auth/device/token`
- `POST /auth/device/refresh`
- `GET /ws/client` 与 `GET /ws/anchor` preflight（升级前在有效 auth 下返回 `426`）
- `WS /ws/client`
- `WS /ws/anchor`

realtime 部分行为与 Orbit 基础流程一致：

- `orbit.subscribe` / `orbit.unsubscribe`
- `orbit.list-anchors`
- `anchor.hello`, `orbit.anchor-connected`, `orbit.anchor-disconnected`
- 从 Anchor 到已订阅客户端的 thread-scoped 消息路由

## 本地运行

```bash
cd services/control-plane
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## 环境变量

基础变量：

- `AUTH_MODE=passkey` 或 `AUTH_MODE=basic`
- `CODEX_REMOTE_WEB_JWT_SECRET=change-me`
- `DATABASE_PATH=./data/control_plane.db`
- `CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173`
- `DEVICE_VERIFICATION_URL=https://your-frontend.vercel.app/device`
- `ACCESS_TTL_SEC=3600`
- `REFRESH_TTL_SEC=604800`
- `DEVICE_CODE_TTL_SEC=600`
- `DEVICE_CODE_POLL_INTERVAL_SEC=5`
- `ANCHOR_ACCESS_TTL_SEC=86400`
- `ANCHOR_REFRESH_TTL_SEC=2592000`

passkey 模式：

- `PASSKEY_ORIGIN=https://your-frontend.vercel.app`
- `PASSKEY_RP_ID=your-frontend.vercel.app`（可选；可从 origin 推导）
- `CHALLENGE_TTL_SEC=300`

## Frontend 配置

构建 web client 时设置：

- `AUTH_URL=https://<your-fastapi-domain>`
- `AUTH_MODE=passkey`（推荐）或 `AUTH_MODE=basic`（快速 dev）

## Anchor 配置

将 Anchor 连接到 FastAPI relay：

- `ANCHOR_ORBIT_URL=wss://<your-fastapi-domain>/ws/anchor`
- `AUTH_URL=https://<your-fastapi-domain>`

Anchor 通过 `/auth/device/token` 获取 device tokens，并通过 `/auth/device/refresh` 续期。

## 生产环境说明

- 使用高强度 secrets
- 仅启用 HTTPS/WSS
- 配置严格的 CORS origins
- 管控日志（避免 token/secret 泄露）

完整 endpoint 参考见 [services/control-plane/README.md](../services/control-plane/README.md)。
