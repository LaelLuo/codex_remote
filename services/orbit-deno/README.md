# Orbit Deno

Codex Remote 的 Deno Deploy control-plane provider。

## 端点

- `GET /health`
- `GET /auth/session`
- `POST /auth/register/*`
- `POST /auth/login/*`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/device/*`
- `GET/WS /ws/client`
- `GET/WS /ws/anchor`

## 本地运行

```bash
deno run -A services/orbit-deno/main.ts
```

## 部署

使用 `codex-remote self-host --provider deno`。

## Anchor 认证

- `/auth/device/token` 返回 `anchorAccessToken + anchorRefreshToken + anchorAccessExpiresIn`
- `/auth/device/refresh` 轮换并返回新的 Anchor device tokens
- `/ws/anchor` 仅接受由本 provider 签发并持久化的 opaque `anchorAccessToken`
