# 仓库结构

```text
.
├── bin/
│   ├── codex-remote                          # CLI entry point
│   ├── self-host.sh                          # Cloudflare 的 self-host 向导
│   └── self-host-deno.sh                     # Deno Deploy 的 self-host 向导
├── docs/                                     # 项目文档
├── migrations/                               # 数据库迁移（D1/兼容 schema）
├── public/
│   ├── icons/                                # PWA 图标
│   ├── manifest.json                         # PWA manifest
│   └── sw.js                                 # Service worker
├── services/
│   ├── anchor/                               # 本地 Bun bridge + relay 到 app-server
│   │   ├── src/
│   │   └── package.json
│   ├── orbit/                                # Cloudflare Worker + Durable Object（relay + auth）
│   │   ├── src/
│   │   └── wrangler.toml
│   ├── orbit-deno/                           # Deno Deploy runtime（relay + auth）
│   │   └── main.ts
│   └── control-plane/                        # FastAPI control plane（替代 backend）
│       ├── app/
│       ├── tests/
│       └── requirements.txt
├── src/                                      # Web client（Svelte）
│   ├── lib/
│   │   ├── components/
│   │   └── styles/
│   ├── routes/
│   └── global.css
├── .env.example
├── install.sh                                # macOS/Linux 安装脚本
├── install.ps1                               # Windows 安装脚本
├── package.json
├── tsconfig.json
├── vite.config.ts
├── svelte.config.js
└── wrangler.toml                             # web client 部署配置（Cloudflare Pages）
```

## 说明

- 顶层 `src/` 是 web client（Svelte + Vite）。
- Frontend 为静态站点，可部署到 Cloudflare Pages、Deno Deploy、Vercel 或其他 static host。
- Control plane 有三种实现：Cloudflare（`services/orbit`）、Deno（`services/orbit-deno`）和 FastAPI（`services/control-plane`）。
- Anchor（`services/anchor`）在本地运行，并通过 stdio 与 `codex app-server` 通信。
- `bin/codex-remote` 是本地使用的主 CLI。
- `bin/self-host*.sh` 是 provider 特定向导，由 `codex-remote self-host --provider ...` 调用。
- `install.sh`/`install.ps1` 负责 bootstrap、依赖安装与 PATH 配置。
