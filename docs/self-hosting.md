# Self-hosting

Codex Remote 可以在你自己的账号中完整部署，provider 支持 `cloudflare` 或 `deno`。

命令 `codex-remote self-host` 会启动统一的部署向导，适用于这两种方案。

## 前置要求

- macOS/Linux/Windows
- 已安装 [Bun](https://bun.sh)
- 已安装 [Codex CLI](https://github.com/openai/codex)
- 已安装 Codex Remote（见 [installation.md](installation.md)）
- provider 账号：
  - Cloudflare（free tier 可用）
  - Deno Deploy（free tier 可用）

Provider 工具：

- `cloudflare`: `wrangler`
- `deno`: `deployctl`（全局安装，或通过 `deno run -A jsr:@deno/deployctl`）

Deno 需要 `DENO_DEPLOY_TOKEN`。

## 部署内容

| 服务 | 平台 | 用途 |
|---|---|---|
| Orbit / Control Plane | Cloudflare Worker + DO 或 Deno Deploy runtime | auth、token 签发、web 与 Anchor 之间的 websocket relay |
| Web | Cloudflare Pages 或 Deno Deploy static | 静态 Svelte frontend |

状态存储：

- `cloudflare`: D1
- `deno`: Deno KV

JWT/系统 secrets 由向导生成，并自动注入部署环境。

## 启动向导

```bash
codex-remote self-host --provider cloudflare
# 或：
codex-remote self-host --provider deno
# 在配置完成后强制执行 login：
codex-remote self-host --provider deno --login
```

向导可在以下时机运行：

1. 在 `install.sh` / `install.ps1` 执行期间，或
2. 之后在终端手动执行。

## 向导执行内容

1. 检查项目与本地依赖
2. 检查 provider 工具（`wrangler`/`deployctl`）
3. 对 Deno 检查 `DENO_DEPLOY_TOKEN`
4. 生成 JWT/VAPID secrets
5. 部署 backend（Orbit/control-plane）
6. 使用正确的 `AUTH_URL` 构建 frontend
7. 部署静态 web
8. 将配置写入 Anchor 使用的 `.env`

最后会输出 URL 与后续步骤。

默认在部署后会询问是否执行 `codex-remote login`。可用 `--login`/`--no-login` 固定行为。

## 出错行为

若关键阶段失败，`codex-remote self-host` 会以 non-zero 退出码结束。

修复原因后，可以安全地重新执行同一命令。

## 部署后步骤

1. 打开向导输出中的应用 URL，并注册/登录账号
2. 执行 `codex-remote start` 连接本地 Anchor

## 更新 self-host 环境

```bash
codex-remote update
```

该命令会按 `SELF_HOST_PROVIDER` 为当前 provider 重新部署 web + backend。

如果 update 失败，请修复环境问题（例如 provider 认证）后重试。

Cloudflare 手动 redeploy 示例：

```bash
# redeploy orbit
(cd ~/.codex-remote/services/orbit && wrangler deploy)

# rebuild + deploy web
(cd ~/.codex-remote && bun run build && wrangler pages deploy dist --project-name codex-remote)
```

## 架构

组件交互细节见：[architecture.md](architecture.md)。
