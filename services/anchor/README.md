# Anchor

在本地运行 `codex app-server` 并通过 WebSocket 转发 JSON-RPC 的桥接服务。

## 运行

```bash
cd services/anchor
bun install
bun run dev
```

要求：

- 已安装并完成认证的 Codex CLI（`codex login`）
- `codex` 可在 PATH 中找到，或通过仓库根目录 `.env` 中的 `CODEX_REMOTE_CODEX_PATH` 指定单个可执行文件路径

## 配置

运行脚本会从仓库根目录的 `.env` 加载环境变量。

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `ANCHOR_PORT` | `8788` | 本地 WebSocket 服务端口 |
| `ANCHOR_ORBIT_URL` | _(empty)_ | Orbit relay URL（例如 `wss://orbit.<domain>.workers.dev/ws/anchor`） |
| `AUTH_URL` | _(empty)_ | device code 登录使用的 Auth endpoint base URL（由 Orbit 提供） |
| `CODEX_REMOTE_ANCHOR_JWT_SECRET` | _(empty)_ | Orbit service-to-service auth 的共享 secret |
| `CODEX_REMOTE_CODEX_PATH` | _(empty)_ | 可选：覆盖默认 `codex` 命令，指定用于启动 `codex app-server` 的单个可执行文件路径 |
| `ANCHOR_JWT_TTL_SEC` | `300` | JWT token 生命周期（秒） |
| `ANCHOR_APP_CWD` | `process.cwd()` | 初始化时发送给 app-server 的工作目录 |
| `CODEX_REMOTE_CREDENTIALS_FILE` | `~/.codex-remote/credentials.json` | 已保存登录凭据的路径 |

## WebSocket endpoint

- `ws://localhost:8788/ws/anchor`
