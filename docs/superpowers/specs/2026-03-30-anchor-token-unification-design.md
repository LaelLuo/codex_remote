# Anchor 令牌链路统一到 Access/Refresh Token 设计

## 背景

当前仓库里，Anchor 认证链路已经处于“半迁移”状态：

- `services/control-plane` 已经通过 `anchorAccessToken + anchorRefreshToken` 为 Anchor 签发和刷新会话。
- `services/orbit-deno` 也已经使用同样的 access/refresh token 模型。
- 只有 `services/orbit` 这条 Cloudflare Worker 链路仍在 `/auth/device/token` 返回 `anchorJwtSecret`，并要求 `/ws/anchor` 使用 legacy anchor JWT 建连。
- `services/anchor` 为了兼容不同 provider，仍保留：
  - 登录时消费 `anchorJwtSecret`
  - 本地凭据中保存 `anchorJwtSecret`
  - Orbit 建连时从 access token 回退到 JWT fallback
  - 启动时把“有 device tokens”与“有 legacy secret”都视为已登录

这让 Anchor 的认证模型同时存在两套主路径：

1. 现代链路：`anchorAccessToken + anchorRefreshToken`
2. legacy 链路：`anchorJwtSecret`

结果是：

- provider 行为不一致
- Anchor 启动和建连逻辑存在分叉
- 文档和配置持续暗示 `anchorJwtSecret` 仍是正式支持模型
- 后续排查 token/WS 鉴权问题时，需要同时理解两套协议

## 本轮目标

- 将三套 provider 的 Anchor device token 返回结构统一为 `anchorAccessToken + anchorRefreshToken`
- 让 `services/orbit` 的 `/ws/anchor` 改为校验 Anchor access token，而不是只认 anchor JWT
- 删除 `services/anchor` 对 `anchorJwtSecret` 的登录消费、本地凭据消费和 Orbit 建连 fallback
- 明确这是一次对 legacy Anchor secret 链路的破坏性移除：旧本地凭据需要重新登录

## 非目标

- 不改动 web 用户 session JWT 模型
- 不改动 `/ws/client` 的鉴权模型
- 不在本轮移除所有与 `CODEX_REMOTE_ANCHOR_JWT_SECRET` 有关的代码
- 不处理和 Anchor 设备认证无关的 Web 认证协议重构
- 不处理 `wrangler.toml`、D1 database id 或部署配置问题

## 用户决策

本轮已与用户确认：

- 直接切断 legacy `anchorJwtSecret` 兼容
- 不再接受 provider 返回 `anchorJwtSecret`
- 不再消费本地旧 `anchorJwtSecret` 凭据

这意味着本轮不是“保留兼容的平滑迁移”，而是“明确切换到 access/refresh 唯一主模型”。

## 当前差异梳理

### `services/control-plane`

当前状态：

- `/auth/device/token` 返回：
  - `status`
  - `userId`
  - `anchorAccessToken`
  - `anchorRefreshToken`
  - `anchorAccessExpiresIn`
- `/auth/device/refresh` 返回：
  - `anchorAccessToken`
  - `anchorRefreshToken`
  - `anchorAccessExpiresIn`
- `/ws/anchor` 通过 `verify_anchor_any_token()` 同时接受：
  - opaque access token
  - legacy anchor JWT

结论：

- 返回结构已经符合目标
- WS 鉴权仍有 legacy 兼容分支，需要在本轮收缩

### `services/orbit-deno`

当前状态：

- `/auth/device/token` 已返回 access/refresh token 结构
- `/auth/device/refresh` 已返回 access/refresh token 结构
- `authorizeWsRequest(..., "anchor")` 已通过 `verifyAnchorAnyToken()` 接受：
  - opaque access token
  - legacy anchor JWT

结论：

- 返回结构已经符合目标
- WS 鉴权仍保留 legacy 兼容分支，需要在本轮收缩

### `services/orbit`

当前状态：

- `/auth/device/token` 在消费 device code 后返回：
  - `status`
  - `userId`
  - `anchorJwtSecret`
- `/auth/device/refresh` 虽然存在，但实际上是基于普通用户 session refresh 重新签一个 anchor JWT access token
- `/ws/anchor` 在 `services/orbit/src/ws/authz.ts` 中只认 anchor JWT

结论：

- 这是当前唯一没有完成 access/refresh 收敛的 provider
- 也是本轮最主要的改造点

### `services/anchor`

当前状态：

- 已实现 access/refresh token 登录、刷新与持久化
- 仍保留 `anchorJwtSecret`：
  - 登录轮询中接受 `anchorJwtSecret`
  - `Credentials` 中保存 `anchorJwtSecret`
  - `startup()` 中把 `anchorJwtSecret + userId` 视为可用登录态
  - `buildOrbitUrl()` 在 access token 不可用时，会回退为用 `anchorJwtSecret` 临时签 JWT

结论：

- Anchor 本身已经具备 access/refresh 主链
- 本轮要删除的是剩余 legacy 分支，而不是重做整条登录机制

## 目标模型

### Provider 契约统一

三套 provider 对 Anchor 设备登录的契约统一为：

#### `POST /auth/device/token`

成功返回：

```json
{
  "status": "authorised",
  "userId": "<user-id>",
  "anchorAccessToken": "<opaque-access-token>",
  "anchorRefreshToken": "<opaque-refresh-token>",
  "anchorAccessExpiresIn": 3600
}
```

禁止再返回：

- `anchorJwtSecret`

#### `POST /auth/device/refresh`

成功返回：

```json
{
  "anchorAccessToken": "<opaque-access-token>",
  "anchorRefreshToken": "<opaque-refresh-token>",
  "anchorAccessExpiresIn": 3600,
  "userId": "<user-id-optional>"
}
```

说明：

- `userId` 在 refresh 响应里允许存在，也允许缺省
- Anchor 端只依赖 access/refresh/expiresIn，`userId` 用于补齐本地状态

### Anchor 运行时模型

Anchor 启动后只认以下登录态：

- `anchorAccessToken`
- `anchorRefreshToken`

不再把以下状态视为已登录：

- 仅存在 `anchorJwtSecret`
- `anchorJwtSecret + userId`

### Orbit Anchor 鉴权模型

`/ws/anchor` 统一为校验 Anchor access token。

即：

- Anchor 建连时只携带 `anchorAccessToken`
- provider 侧通过 access token 找到对应 Anchor session 并确定 `userId`
- 不再要求 Anchor 临时签 JWT

## 详细方案

### 1. 改造 `services/orbit`

#### 1.1 引入真正的 Anchor session

`services/orbit` 需要像 `control-plane` / `orbit-deno` 一样，具备一套独立于 web session 的 Anchor session 模型：

- 创建 Anchor session
- 轮转 Anchor refresh token
- 根据 Anchor access token 查找活跃 session

这里的“对齐现有 auth 模块组织方式”只表示复用当前认证模块的目录组织、错误处理模式和测试习惯，不表示继续复用 web session 的数据模型、表结构或 refresh 流程。

必须明确满足以下边界：

- Anchor refresh token 与 `/auth/refresh` 使用的 web refresh token 分离
- `/auth/device/refresh` 不得继续接受或轮转 web refresh token
- Anchor access token 的持久化、查找与失效逻辑独立于 `codex-remote-web` JWT/session 体系

这样 `/auth/device/token` 与 `/auth/device/refresh` 才能真正返回 opaque Anchor token，而不是继续依赖 `CODEX_REMOTE_ANCHOR_JWT_SECRET` 临时签 JWT，或把 web session 改名后继续复用。

#### 1.1.1 新增持久化 schema 与 migration

`services/orbit` 当前没有与 Anchor access/refresh token 对应的持久化结构，因此本轮必须新增 D1 持久化 schema（表、必要索引，以及与轮转/查找相关的约束）并纳入 migration 合同。

实现约束：

- 不允许把 Anchor token lookup/refresh 仅落在临时 Durable Object 内存或其他非持久层
- 新 schema 必须支持：
  - 根据 access token 查找活跃 Anchor session
  - 根据 refresh token 原子轮转 Anchor session
  - 过期/撤销后的 access token 与 refresh token 不再可用
- migration 必须纳入 `services/orbit` 当前的 D1 migrations 流程，不能只停留在运行时代码

#### 1.2 统一 `/auth/device/token`

`services/orbit/src/auth/index.ts` 中的 `handleDeviceToken()` 改为：

- 不再检查 `CODEX_REMOTE_ANCHOR_JWT_SECRET`
- 在 consume device code 之前先确认 Anchor session 存储前置条件满足
- 在 device code authorise 成功后创建 Anchor session
- 返回 `anchorAccessToken + anchorRefreshToken + anchorAccessExpiresIn`

这里必须保留当前 Cloudflare Worker 链路“签发前先检查服务端是否已准备好”的语义，避免把已经 authorise 的 device code 过早消费掉。

新顺序要求：

1. 读取 device code 当前状态（不消费）
2. 若仍 pending，则返回 pending
3. 若已 authorised，则先检查 Anchor session 存储、migration 与写入前置条件
4. 只有在前置条件满足时才真正 consume device code
5. consume 后立即创建 Anchor session 并返回 access/refresh token

失败语义要求：

- 若前置条件未满足，返回明确错误，且 device code 保持可重试状态
- 不允许出现“device code 已 consume，但 session 创建失败，用户只能重新登录”的行为

#### 1.3 统一 `/auth/device/refresh`

`handleDeviceRefresh()` 改为：

- 使用 Anchor refresh token 轮转 Anchor session
- 返回新的 `anchorAccessToken + anchorRefreshToken + anchorAccessExpiresIn`
- 不再走用户 session refresh -> 再签 anchor JWT 的间接链路
- 不得继续调用 web session 的 `refreshSession()` 或接受 `/auth/refresh` 使用的 refresh token

#### 1.4 改造 `/ws/anchor` 鉴权

`services/orbit/src/ws/authz.ts` 改为：

- Anchor role 不再调用 `verifyOrbitAnchorJwt()`
- 改为验证 Anchor access token 并解析用户归属
- 删除 `CODEX_REMOTE_ANCHOR_JWT_SECRET` 缺失时直接拒绝 Anchor 请求的前置 gate
- `AuthResult.jwtType` 若保留，需明确处理是否改名或仅保留兼容字段

本轮优先目标是行为收敛，不要求一并做大范围命名清洗；但不能继续让 Anchor role 只认 JWT。

### 2. 收缩 `services/orbit-deno`

`services/orbit-deno` 已具备正确的 access/refresh 主链，但其 `verifyAnchorAnyToken()` 仍接受 legacy anchor JWT。

本轮改为：

- `/ws/anchor` 只接受 Anchor access token
- 删除或停用 Anchor JWT legacy 校验入口

### 3. 收缩 `services/control-plane`

`services/control-plane` 已具备正确的 access/refresh 主链，但 `verify_anchor_any_token()` 仍回退到 `verify_anchor_jwt_legacy()`。

本轮改为：

- `/ws/anchor` preflight 与 websocket 只接受 Anchor access token
- `verify_anchor_jwt_legacy()` 不再参与 Anchor WS 鉴权

是否彻底删除该函数，可以在实现时按最小改动决定：

- 若仅 Anchor 链路使用它，则直接删除
- 若还有其他未识别调用点，则先切断调用，再做文件内收敛

### 4. 收缩 `services/anchor`

#### 4.1 删除登录轮询中的 legacy 消费

`deviceLogin()` 中不再接受：

- `tokenData.anchorJwtSecret`

登录成功条件统一为：

- `status === "authorised"`
- 存在 `anchorAccessToken`
- 存在 `anchorRefreshToken`
- 存在 `anchorAccessExpiresIn`

#### 4.2 删除本地凭据里的 legacy secret 主用途

`Credentials` 结构改为只保留：

- `userId`
- `anchorId`
- `anchorAccessToken`
- `anchorRefreshToken`
- `anchorAccessExpiresAtMs`

不再读取旧 `anchorJwtSecret` 作为登录依据。

本轮可以接受：

- 旧文件里仍残留 `anchorJwtSecret` 字段，但启动时忽略它

也可以进一步在成功登录/保存凭据时把该字段从新写入内容中移除。

#### 4.3 删除 Orbit JWT fallback

`buildOrbitUrl()` 改为：

- access token 可用 -> 直接带 `token=<anchorAccessToken>`
- access token 不可用 -> 返回失败，触发重新登录或刷新失败处理

不再用 `CODEX_REMOTE_ANCHOR_JWT_SECRET` 现签 JWT。

这里不能继续复用当前“返回 `null` 就表示 URL 配置错误”的契约。

需要同步调整调用链语义：

- `buildOrbitUrl()` 必须能够区分：
  - `config`：`ANCHOR_ORBIT_URL` 无效
  - `auth`：Anchor access token 缺失、过期且刷新失败，或当前没有可用 Anchor 登录态
- `preflightOrbitConnection()` 必须把上述 `auth` 情况映射为认证错误，而不是配置错误
- `startup()` 与重连路径必须在 `preflight.kind === "auth"` 时走 refresh / 重新登录，而不是把这类失败打印成 `invalid ANCHOR_ORBIT_URL`

换句话说，本轮除了删除 JWT fallback，还必须把“认证失败”和“配置错误”在 Anchor 调用链里彻底拆开。

#### 4.4 收缩启动登录判断

`startup()` 中的：

- `hasLegacySecret`
- `needsLogin` 对 legacy secret 的兼容

都应删除。

Anchor 只要没有完整 access/refresh token，就应进入重新登录流程。

### 5. 文档与配置收敛

文档要同步反映：

- Anchor 设备链路主模型是 access/refresh token
- 旧 `anchorJwtSecret` 不再是 Anchor 登录或建连所需配置

重点更新：

- `docs/auth.md`
- `docs/architecture.md`
- `docs/security.md`
- `.env.example`
- `services/anchor/README.md`
- `services/orbit/README.md`
- `services/control-plane/README.md`
- `bin/codex-remote`
- `bin/codex-remote.ps1`
- 如有必要，再扩展到自托管脚本生成的 `.env` 注释与诊断文案

本轮不强制要求立刻删掉所有 provider/部署脚本中的 `CODEX_REMOTE_ANCHOR_JWT_SECRET`，但至少不能让任何一线文档、协议总览文档、示例配置或默认模板继续把它描述成 Anchor 设备登录或 Anchor 建连的现行主模型。

## 兼容性与破坏性变更

这是一次明确的破坏性更新：

- 旧的 Cloudflare Orbit provider 不再返回 `anchorJwtSecret`
- Anchor 不再消费本地旧 `anchorJwtSecret` 凭据
- 旧用户升级后，如果本地只保存了 secret 而没有 access/refresh token，需要重新执行一次 `codex-remote login`

这是符合用户要求的预期行为，不提供 runtime fallback。

## 风险

### 风险 1：`services/orbit` 需要补齐完整 session 能力

如果 Cloudflare Worker 侧当前没有完整的 Anchor session 抽象，本轮改动会比“只改返回字段”更深入。

应对方式：

- 对齐现有 auth 模块的组织方式与测试风格，但不要复用 web `auth_sessions` / `refreshSession()` 数据流
- 优先对齐 `orbit-deno` / `control-plane` 的数据模型和测试样式

### 风险 2：Anchor 启动时旧凭据会立即失效

这会让已有本地开发环境在升级后第一次启动时重新走登录。

这是接受范围内的破坏性变更，但文档和日志提示要足够明确。

### 风险 3：Orbit worker 的 WS 鉴权改造容易漏测

如果只测 `/auth/device/token` 返回而不测 `/ws/anchor` preflight / websocket，可能出现“登录成功但建连失败”。

因此测试必须覆盖：

- device token issuance
- device refresh
- `/ws/anchor` preflight
- `/ws/anchor` websocket connect
- D1 migration 后的查找/轮转行为在实例切换或重启后仍然成立

## 验收标准

- 三套 provider 的 `/auth/device/token` 都返回 `anchorAccessToken + anchorRefreshToken + anchorAccessExpiresIn`
- 三套 provider 的 `/auth/device/refresh` 都返回同一套字段
- `services/orbit` 的 Anchor token 持久化通过独立 D1 schema 与 migration 落地，而不是复用 web session 或临时状态
- `services/orbit` 的 `/ws/anchor` 不再要求 anchor JWT
- `services/orbit` 的 `/ws/anchor` 不再依赖 `CODEX_REMOTE_ANCHOR_JWT_SECRET` 是否配置
- `services/orbit` 的 `/auth/device/token` 在签发前置条件不满足时不会消费已 authorise 的 device code
- `services/anchor` 不再消费 `anchorJwtSecret` 登录结果或本地旧 secret 凭据
- Anchor 对 Orbit 的建连只走 access token
- 文档、示例配置与默认模板不再把 `anchorJwtSecret` / `ANCHOR_JWT_TTL_SEC` 描述为 Anchor 设备链路的正式模型

## 实现边界总结

本轮做的是：

- 统一 Anchor 设备令牌契约
- 切掉 Anchor legacy secret 链路
- 统一 Anchor WS 鉴权到 access token

本轮不做的是：

- web client JWT 模型重构
- 全仓所有 JWT 机制删除
- 部署配置与数据库配置治理
