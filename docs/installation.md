# 安装 Codex Remote

Codex Remote 会在你的机器上启动本地 Anchor 服务，并将其连接到 Orbit（control plane），从而让你可以通过浏览器远程管理 Codex 会话。

## 前置要求

- 使用 `install.sh` 安装时需要 macOS 或 Linux
- 使用 `install.ps1` 安装时需要 Windows
- 需要可访问互联网以下载依赖

Windows 安装脚本 `install.ps1` 支持以下模式：

- `source`：克隆仓库并通过 Bun 运行（需要 `git` 和 `bun`）
- `release`：从 GitHub Releases 下载预构建包（客户端无需 `git` 和 `bun`）

默认模式：`auto`。

- 如果同时安装了 `git` 和 `bun` -> 使用 `source`
- 否则 -> 使用 `release`

安装器会检查 [Codex CLI](https://github.com/openai/codex) 是否可用，并执行 `codex login`。

如果你希望使用轻量 backend 替代 Cloudflare Orbit，请参阅 [FastAPI Control Plane](fastapi-control-plane.md)。

## 安装

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/dwnmf/codex_remote/main/install.sh | bash
```

Windows（PowerShell）：

```powershell
iwr -useb https://raw.githubusercontent.com/dwnmf/codex_remote/main/install.ps1 | iex
```

在 Windows 上强制指定安装模式：

```powershell
$env:CODEX_REMOTE_INSTALL_MODE="release"   # 或 "source"
iwr -useb https://raw.githubusercontent.com/dwnmf/codex_remote/main/install.ps1 | iex
```

在 `release` 模式下，安装器会将 `codex-remote-windows-x64.zip` 下载到 `~/.codex-remote`，安装 CLI 包装命令，并使用内置 `anchor.exe`。

在安装过程中直接运行 self-host 向导：

```bash
CODEX_REMOTE_RUN_SELF_HOST=1 curl -fsSL https://raw.githubusercontent.com/dwnmf/codex_remote/main/install.sh | bash
```

## 从源码构建

```bash
git clone https://github.com/dwnmf/codex_remote.git ~/.codex-remote
cd ~/.codex-remote/services/anchor && bun install
```

将 `~/.codex-remote/bin` 加入 `PATH`。

## 初始配置

1. 如果安装时未运行 self-host：执行 `codex-remote self-host --provider cloudflare --login`（或 `--provider deno --login`）
2. 运行 `codex-remote start`（或使用 `codex-remote login` 重新授权）
3. 终端会显示 device code
4. 浏览器会打开并等待你确认登录
5. 凭据会保存到 `~/.codex-remote/credentials.json`

## 启动

```bash
codex-remote start
```

启动后，Anchor 会连接 Orbit 并等待来自 web client 的命令。

## CLI 命令

| 命令 | 用途 |
|---|---|
| `codex-remote start` | 启动 Anchor |
| `codex-remote login` | 重新授权设备 |
| `codex-remote doctor` | 检查环境与配置 |
| `codex-remote config` | 在编辑器中打开 `.env` |
| `codex-remote update` | 更新代码、依赖，并在已配置时重新部署 self-host |
| `codex-remote self-host --provider cloudflare\|deno --login\|--no-login` | self-host 向导与 post-setup 登录控制 |
| `codex-remote uninstall` | 卸载 Codex Remote |
| `codex-remote version` | 显示版本 |
| `codex-remote help` | 显示帮助 |

## 验证安装

```bash
codex-remote doctor
```

会检查 Bun、Codex CLI、Anchor 源码、依赖、`.env`、凭据与 Anchor 状态。

## 更新

```bash
codex-remote update
```

该命令会拉取最新代码、重装依赖，并在已配置 self-host 时为所选 provider 重新部署 backend/frontend。

## Self-host

```bash
codex-remote self-host --provider cloudflare
# 或：
codex-remote self-host --provider deno
```

完整部署流程见 [self-hosting.md](self-hosting.md)。

## 常见问题

### `codex-remote: command not found`

请确认 `~/.codex-remote/bin` 已加入 `PATH`：

```bash
echo 'export PATH="$HOME/.codex-remote/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 连接错误

```bash
codex-remote login
```

### 诊断

```bash
codex-remote doctor
```
