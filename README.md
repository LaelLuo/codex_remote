# Codex Remote

Codex Remote 允许你通过手机、平板或任意浏览器，在远程启动并控制你电脑上的 Codex CLI 会话。

界面会实时展示回复流、操作确认，以及应用前的文件改动。

<img width="960" height="422" alt="{FD0D323D-0EAA-4F2C-B725-173BF2B777BA}" src="https://github.com/user-attachments/assets/9de4ac85-be0c-432b-bcb0-499d8bd30490" />


## 架构概览

架构由三部分组成。Anchor 在本地运行并连接你的 `codex app-server`。Orbit 在云端运行，提供认证、WebSocket relay 和 API。Web client 在浏览器中打开并管理会话。

```text
浏览器
  │ HTTPS + WebSocket
  ▼
Orbit (Cloudflare 或 Deno Deploy)
  │ WebSocket
  ▼
Anchor (本地)
  │ JSON-RPC over stdio
  ▼
codex app-server
```
<img width="960" height="429" alt="{EA5336C6-C3D8-434F-8F67-FF20ADA6C4AF}" src="https://github.com/user-attachments/assets/e7b382b6-9eb7-4dc9-a908-bd4d9f09d7be" />


## 最新变化

项目新增第二个 self-host provider：`deno`，并提供统一流程 `codex-remote self-host --provider ... --login`，可在部署后立即完成设备登录，无需额外手动步骤。

| 功能 | 当前行为 |
|---|---|
| 两种 self-host provider | `cloudflare` 和 `deno` |
| 一体化部署+登录 | `codex-remote self-host --provider <name> --login` |
| self-host 更新 | `codex-remote update` 会按 `SELF_HOST_PROVIDER` 重新部署 |
| Deno token 校验 | 向导会检查 `DENO_DEPLOY_TOKEN` 并提示错误 |
| UI/Anchor 兼容性 | 支持 `/ws/client`、`/ws/anchor`、device-login 和 session API |

## 快速开始

### 在 macOS 或 Linux 安装

```bash
curl -fsSL https://raw.githubusercontent.com/dwnmf/codex_remote/main/install.sh | bash
```

### 在 Windows 安装

```powershell
iwr -useb https://raw.githubusercontent.com/dwnmf/codex_remote/main/install.ps1 | iex
```

### 在 Windows 使用 release 或 source 模式安装

```powershell
$env:CODEX_REMOTE_INSTALL_MODE="release"
iwr -useb https://raw.githubusercontent.com/dwnmf/codex_remote/main/install.ps1 | iex
```

```powershell
$env:CODEX_REMOTE_INSTALL_MODE="source"
iwr -useb https://raw.githubusercontent.com/dwnmf/codex_remote/main/install.ps1 | iex
```

### 通过 Cloudflare 启动 self-host

```bash
codex-remote self-host --provider cloudflare --login
codex-remote start
```

### 通过 Deno Deploy 启动 self-host

```bash
codex-remote self-host --provider deno --login
codex-remote start
```

Deno 需要 `DENO_DEPLOY_TOKEN`。你可以在 Deno Deploy 控制台创建该 token：`https://dash.deno.com/account#access-tokens`。当前 `deployctl` 支持 Deno Deploy 的 Classic 组织。

### 在安装过程中直接运行 self-host 向导

```bash
CODEX_REMOTE_RUN_SELF_HOST=1 curl -fsSL https://raw.githubusercontent.com/dwnmf/codex_remote/main/install.sh | bash
```

## CLI 命令

| 命令 | 用途 |
|---|---|
| `codex-remote start` | 启动 Anchor |
| `codex-remote login` | 重新授权设备 |
| `codex-remote doctor` | 检查环境、`.env`、token 和 Anchor 状态 |
| `codex-remote config` | 在编辑器中打开 `.env` |
| `codex-remote update` | 更新代码、依赖和 self-host 部署 |
| `codex-remote self-host --provider cloudflare|deno --login|--no-login` | 运行 self-host 向导并控制 post-setup 登录 |
| `codex-remote uninstall` | 卸载 Codex Remote |
| `codex-remote version` | 显示版本 |
| `codex-remote help` | 显示帮助 |

## Self-Host 流程示意

```text
codex-remote self-host --provider deno --login
        │
        ├─ 检查本地环境
        ├─ 检查 provider 工具
        ├─ 生成 JWT 和 VAPID secrets
        ├─ 部署 Orbit backend
        ├─ 构建并部署 web
        ├─ 写入 Anchor 的 .env
        └─ codex-remote login
```

## Deno Provider：认证

Deno provider 支持两种 web 登录方式：passkey 和 TOTP。

## 会话无法加载时

先用一条命令检查状态。

```bash
codex-remote doctor
```

如果 doctor 结果都是 `OK`，通常重启 Anchor 就能解决。

```bash
codex-remote start
```

在 self-host 模式下，设置中的 URL 应指向你的 Orbit endpoint，并以 `/ws/client` 结尾，例如 `wss://<your-app>.deno.dev/ws/client`。

## 本地开发

```bash
bun run lint
bun run test
bun run ci:local
```

```bash
bun run dev:all
```

默认 frontend 地址为 `http://localhost:5173`，backend 地址为 `http://localhost:8080`。

## 文档

| 章节 | 链接 |
|---|---|
| 安装 | [docs/installation.md](docs/installation.md) |
| Self-hosting | [docs/self-hosting.md](docs/self-hosting.md) |
| 架构 | [docs/architecture.md](docs/architecture.md) |
| 认证 | [docs/auth.md](docs/auth.md) |
| 事件与协议 | [docs/events.md](docs/events.md) |
| 安全 | [docs/security.md](docs/security.md) |
| FastAPI control-plane | [docs/fastapi-control-plane.md](docs/fastapi-control-plane.md) |
| 仓库结构 | [docs/repo-structure.md](docs/repo-structure.md) |
| Vision | [docs/vision.md](docs/vision.md) |

## 许可证

[MIT](LICENSE)
