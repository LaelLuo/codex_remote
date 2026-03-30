# FastAPI Control Plane

当你希望使用更简单的 self-hosted 栈时，可用它作为 Orbit 的轻量替代。

## 已实现内容

- `GET /health`
- `GET /auth/session`
- `POST /auth/register/basic`
- `POST /auth/login/basic`
- `POST /auth/register/options` (passkey mode)
- `POST /auth/register/verify` (passkey mode)
- `POST /auth/login/options` (passkey mode)
- `POST /auth/login/verify` (passkey mode)
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/device/code`
- `POST /auth/device/authorise`
- `POST /auth/device/token`
- `POST /auth/device/refresh`
- `GET /ws/client` and `GET /ws/anchor` preflight (`426` on valid auth)
- `WS /ws/client`
- `WS /ws/anchor`

实时行为与 Orbit 基础能力保持一致：

- `orbit.subscribe` / `orbit.unsubscribe`
- `orbit.list-anchors`
- `anchor.hello`, `orbit.anchor-connected`, `orbit.anchor-disconnected`
- 从 anchor 到 clients 的 thread 级路由

## 本地运行

```bash
cd services/control-plane
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## 环境变量

- `AUTH_MODE=passkey` or `AUTH_MODE=basic`
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

Passkey 模式变量：

- `PASSKEY_ORIGIN=https://your-frontend.vercel.app`
- `PASSKEY_RP_ID=your-frontend.vercel.app` (optional; derived from origin if omitted)
- `CHALLENGE_TTL_SEC=300`

## Frontend 配置

构建 frontend 时使用：

- `AUTH_URL=https://<your-fastapi-domain>`
- `AUTH_MODE=passkey` (or `basic` for quick local setup)

## Anchor 配置

将 anchor 指向 FastAPI endpoints：

- `ANCHOR_ORBIT_URL=wss://<your-fastapi-domain>/ws/anchor`
- `AUTH_URL=https://<your-fastapi-domain>`

Anchor 通过 `/auth/device/token` 获取 opaque device access token，并通过 `/auth/device/refresh` 刷新（设备端不需要共享 JWT 签名 secret）。
