# Anchor 令牌链路统一到 access/refresh token

## 目标

- 将 Anchor 在不同 provider 下的认证链路统一为 anchorAccessToken + anchorRefreshToken 模型，降低 anchorJwtSecret 这条 legacy 分支带来的认知和维护成本。

## 范围

### In

- 统一梳理 services/orbit、services/orbit-deno、services/control-plane 和 services/anchor 对 Anchor 认证的返回结构、刷新逻辑与建连逻辑。
- 让 Cloudflare Orbit 的 device token 流程与其他 provider 对齐。
- 规划 legacy anchorJwtSecret 的兼容收缩与文档收敛。

### Out

- 本任务不处理与此无关的 Web 用户认证模型重构。

## 验收标准

- 三个 provider 的 Anchor device token 返回结构收敛到同一模型。
- Anchor 主链以 access/refresh token 为准。
- legacy secret 分支有明确迁移与移除路径。
