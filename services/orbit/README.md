# Orbit

基于 Cloudflare Worker + Durable Object 的服务，提供 auth，并在 Anchor 与 web client 之间做 relay。

## 本地运行

```bash
cd services/orbit
bun install
bun run dev
```

## 端点

- `GET /health`
- `GET /auth/session`
- `POST /auth/*` (passkey + device code flows)
- `GET /ws/client`
- `GET /ws/anchor`

## 认证

Orbit 期望其 auth endpoints 签发的 passkey session JWT：

- `Authorization: Bearer <jwt>` header，或
- `?token=<jwt>` query param（用于浏览器）

对于 Anchor 连接，Orbit 期望 `/auth/device/token` 与 `/auth/device/refresh` 签发的 opaque device token：

- `wss://.../ws/anchor?token=<anchorAccessToken>`
- provider 侧刷新入口：`POST /auth/device/refresh`

## D1 配置

步骤：

1. 创建 D1 数据库（示例名称 `codex-remote-orbit`）。
2. 在 `wrangler.toml` 中填入真实 `database_id`。
3. 应用 migrations：

```bash
bunx wrangler d1 migrations apply codex-remote-orbit --remote
```
