# 认证概览

Codex Remote 结合使用 passkey/TOTP/basic 登录（取决于 provider）、refresh token，以及面向 Anchor 的 device-code flow。

## 组件

- Web client (Svelte)
- Orbit / control plane (`services/orbit`, `services/orbit-deno` 或 `services/control-plane`)
- Anchor（本地 Bun 服务，连接 `codex app-server` 的桥接层）

## Token 与 Secret 模型

### 用户会话（web）

- access token（`token`）用于 API/WS 请求
- refresh token（`refreshToken`）通过 `/auth/refresh` 刷新会话
- access token 为短期有效，refresh token 为长期有效并支持轮换

### Anchor 会话（device flow）

- Anchor 在 device-code 授权后获得 `anchorAccessToken` + `anchorRefreshToken`
- access token 通过 `/auth/device/refresh` 刷新
- 在 legacy 场景中可使用 `CODEX_REMOTE_ANCHOR_JWT_SECRET`

### Secrets

- `CODEX_REMOTE_WEB_JWT_SECRET`：用于签名/校验用户 JWT
- `CODEX_REMOTE_ANCHOR_JWT_SECRET`：用于 Anchor 的 legacy service-to-service JWT（兼容用途）

## 主要流程

### 1) passkey 登录

1. 客户端调用 `POST /auth/register/options` + `POST /auth/register/verify`（注册）或 `POST /auth/login/options` + `POST /auth/login/verify`（登录）
2. 服务端签发 `token` + `refreshToken`
3. 客户端保存 token，并通过 `POST /auth/refresh` 刷新 `token`
4. 登出时调用 `POST /auth/logout`

### 2) TOTP 登录

在 orbit/orbit-deno 且 `AUTH_MODE=passkey` 时可用：

- `POST /auth/register/totp/start`
- `POST /auth/register/totp/verify`
- `POST /auth/login/totp`
- `POST /auth/totp/setup/options`
- `POST /auth/totp/setup/verify`

TOTP 因子存储在服务端，并通过 `last_used_step` 防止 replay。

### 3) Basic login（仅 FastAPI 和/或 Deno 在 `AUTH_MODE=basic` 下）

- `POST /auth/register/basic`
- `POST /auth/login/basic`

该模式用于本地开发与轻量 self-host 的简化登录方案。

### 4) 面向 Anchor 的 Device code

1. Anchor: `POST /auth/device/code`
2. 用户在 web 端确认代码：`POST /auth/device/authorise`
3. Anchor polling: `POST /auth/device/token`
4. 状态变为 `authorised` 后，Anchor 获取 anchor token
5. Anchor 通过 `POST /auth/device/refresh` 续期会话

Anchor 凭据保存到 `CODEX_REMOTE_CREDENTIALS_FILE`（默认 `~/.codex-remote/credentials.json`）。

## WebSocket 认证

### Web client -> Orbit

连接方式：

- `wss://.../ws/client?token=<jwt>`
- 或使用请求头 `Authorization: Bearer <jwt>`（在适用场景下）

token 会基于 issuer/audience 以及服务端会话状态进行校验。

### Anchor -> Orbit

连接方式：

- `wss://.../ws/anchor?token=<anchorAccessToken>`

在 legacy 模式下，Anchor 可通过 `CODEX_REMOTE_ANCHOR_JWT_SECRET` 签发短期 JWT。

## 必填配置

### Orbit / Orbit Deno

- `PASSKEY_ORIGIN`（passkey 模式）
- `CODEX_REMOTE_WEB_JWT_SECRET`
- `CODEX_REMOTE_ANCHOR_JWT_SECRET`（如果需要 legacy flow）

### FastAPI control-plane

- `AUTH_MODE=passkey|basic`
- `CODEX_REMOTE_WEB_JWT_SECRET`
- `DEVICE_VERIFICATION_URL`
- `CORS_ORIGINS`
- passkey 模式还需：`PASSKEY_ORIGIN`, `PASSKEY_RP_ID`

### Anchor

- `ANCHOR_ORBIT_URL`
- `AUTH_URL`
- 可选 `CODEX_REMOTE_ANCHOR_JWT_SECRET`（legacy）
- 可选 `ANCHOR_APP_CWD`

## 常见问题

- `Orbit unavailable`：`AUTH_URL` 错误，或 origin 不匹配（`PASSKEY_ORIGIN` / CORS）
- `/ws/client` 或 `/ws/anchor` 返回 `401/403`：token 无效或已过期
- `Not initialized` 错误：`codex app-server` 尚未完成 `initialize`
- 项目文件不正确：`ANCHOR_APP_CWD` 配置有误

## 重要说明

- query string 中的 token（`?token=`）可能被写入日志
- 若将 token 存储在 `localStorage`，终端设备安全性至关重要
- 服务端 refresh token 轮换与 `logout` 是会话撤销所必需的
