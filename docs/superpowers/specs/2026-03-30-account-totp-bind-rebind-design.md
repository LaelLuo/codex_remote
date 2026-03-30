# 已有账号补绑与重绑 TOTP 设计

## 背景

当前仓库里，TOTP 的后端能力已经不是主要问题，前端入口和用户心智模型才是缺口：

- `services/orbit`、`services/orbit-deno` 与 `services/control-plane` 都已经提供了已登录账号的 `/auth/totp/setup/options` 与 `/auth/totp/setup/verify` 接口。
- 这些接口的语义是“当前已登录用户，为自己的账号创建或覆盖 TOTP factor”。
- 但前端目前只在注册页暴露 TOTP 创建入口：
  - `src/routes/Register.svelte` 支持“注册时直接创建 TOTP 账号”
  - `src/routes/Login.svelte` 支持“用户名 + TOTP 登录”
  - `src/routes/Settings.svelte` 的账户区目前只有“退出登录”，没有“为当前账号补绑/重绑 TOTP”或“补绑 passkey”的入口

这会带来两个实际问题：

1. 旧账号用户缺少“补绑/重绑 TOTP”的前端入口，只能误以为要去注册页重新创建账号。
2. 用户容易把“网页登录方式（passkey / TOTP）”和“设备授权（/device）”混为一谈，以为重绑 TOTP 会自动影响已绑定设备。

## 本轮目标

- 为已登录账号提供明确的前端入口，支持补绑与重绑 TOTP。
- 在设置页的账户区同时展示 `Passkey` 与 `TOTP` 两种网页登录方式的绑定状态。
- 对“已有 TOTP 的重绑”增加显式确认，降低误操作风险。
- 在完成绑定/重绑后留在设置页，并明确提示“该操作不会自动影响已绑定设备”。

## 非目标

- 不新增独立的“账户安全中心”或新路由。
- 不修改 passkey / WebAuthn 底层协议。
- 不修改 Anchor `/device` 设备授权协议。
- 不让未登录状态直接进入补绑/重绑流程。
- 不把 TOTP 完成页改造成“自动跳转设备授权”的联动流程。

## 用户已确认决策

本轮已与用户确认：

1. 入口采用设置页账户区的 `B 方案`，即“登录方式状态卡”。
2. 若账号已经绑定 TOTP，不直接进入流程，而是先提示确认，再进入重绑。
3. 重绑成功后留在设置页，显示成功提示，不自动跳转 `/device`。
4. 对于“用 TOTP 注册、但尚未绑定 passkey”的账号，也要在同一张卡里显示 `Passkey 未绑定`，并提供绑定入口。

## 当前实现现状

### 前端

#### `src/lib/auth.svelte.ts`

当前 store 已具备：

- `hasPasskey`
- `hasTotp`
- `totpSetup`
- TOTP 注册流程：
  - `startTotpRegistration(username)`
  - `completeTotpRegistration(code)`
  - `cancelTotpRegistration()`
- passkey 注册与登录流程

但缺少：

- “当前已登录账号补绑/重绑 TOTP”的显式动作命名与状态
- “当前已登录账号补绑 passkey”的设置页入口语义
- 成功提示与确认提示所需的 UI 状态

#### `src/routes/Register.svelte`

- 当前承担“新账号注册时选择 passkey 或 TOTP”的职责。
- 该页不适合继续承担“旧账号补绑/重绑 TOTP”的职责，否则会让“注册”和“补绑”两类动作混在一起。

#### `src/routes/Login.svelte`

- 当前承担 passkey / TOTP 登录。
- 本轮不新增“从登录页进入补绑/重绑”的绕行入口。

#### `src/routes/Settings.svelte`

- 当前账户区只有“退出登录”。
- 这是最适合增加“登录方式状态卡”的位置，因为这里天然处于“已登录账号上下文”中。

### 后端

#### `services/orbit/src/auth/index.ts`

已经具备：

- `handleTotpSetupStart(req, env)`
- `handleTotpSetupVerify(req, env)`

关键语义：

- 必须有有效 web session
- 只能为当前 session 对应账号写入 TOTP
- `upsertTotpFactor()` 已经具备覆盖现有 factor 的能力，因此可天然承载“重绑”

#### `services/orbit-deno/auth.ts`

已提供等价语义的：

- `handleTotpSetupStart`
- `handleTotpSetupVerify`

#### `services/control-plane/app/main.py`

当前主要承载设备授权与会话链路；本轮设计目标仍以复用现有认证 contract 为主，不计划新增“未登录补绑”语义。

## 目标体验

### 设置页账户区

`src/routes/Settings.svelte` 的账户区从“单一退出登录按钮”扩展为“登录方式状态卡 + 退出登录”。

状态卡内容：

- `Passkey`
  - 已绑定：显示 `已绑定`
  - 未绑定：显示 `未绑定`
  - 未绑定时显示 `绑定 Passkey` 按钮
- `TOTP`
  - 已绑定：显示 `已绑定`
  - 未绑定：显示 `未绑定`
  - 未绑定时显示 `绑定 TOTP` 按钮
  - 已绑定时显示 `重绑 TOTP` 按钮
- 说明文案：
  - “这些是网页登录方式，不会自动重新绑定设备授权。”

### TOTP 首次绑定

当当前账号 `hasTotp === false` 时：

- 用户点击 `绑定 TOTP`
- 页面在账户卡内部展开现有 TOTP setup UI：
  - QR code
  - secret
  - 6 位验证码输入框
  - 取消 / 重新开始
- 提交成功后：
  - `hasTotp` 更新为 `true`
  - 折叠 setup UI
  - 在账户卡内显示成功提示：
    - “TOTP 已绑定，可用于网页登录。此操作不会自动影响已绑定设备。”

### TOTP 重绑

当当前账号 `hasTotp === true` 时：

- 用户点击 `重绑 TOTP`
- 先显示确认提示，而不是直接进入二维码流程
- 确认提示文案需明确表达：
  - 新的 TOTP 验证成功后，旧 TOTP 将失效
  - 该操作不会自动重新绑定设备授权
- 用户确认后，进入新的 TOTP setup 流程
- 验证成功后：
  - 覆盖旧 factor
  - 留在设置页
  - 显示成功提示：
    - “TOTP 已更新，可用于网页登录。此操作不会自动影响已绑定设备。”

### Passkey 绑定状态与入口

这轮虽然核心需求是 TOTP，但账户卡必须同时展示 `Passkey` 绑定状态。

原因：

- 用户可能是“先用 TOTP 注册”的账号，这时 `hasTotp === true` 但 `hasPasskey === false`
- 如果只展示 TOTP，用户仍然无法建立“这个账号还没绑 passkey”的完整心智

因此：

- `Passkey` 状态必须始终显示
- 若 `hasPasskey === false`，提供 `绑定 Passkey` 按钮
- 点击后复用现有“已登录用户添加 passkey”的后端能力与浏览器 WebAuthn 流程
- 完成后仅刷新状态与提示，不改动设备授权链路

## 交互与状态模型

### 新增的前端状态

`src/lib/auth.svelte.ts` 需要补足一组面向设置页账户卡的状态，而不是继续把“注册页专用状态”硬复用到设置页：

- 当前账户卡是否正在进行 TOTP setup
- 当前 setup 是：
  - `bind`
  - `rebind`
- 是否显示“重绑确认”提示
- 最近一次账户卡操作的成功提示

建议保留 `totpSetup` 作为底层 setup payload，但补一层更清晰的账户卡语义，例如：

- `accountTotpFlow: "idle" | "confirm_rebind" | "setting_up"`
- `accountNotice`

这样可以避免设置页和注册页共用同一套“注册态文案语义”。

### 状态刷新原则

完成 passkey / TOTP 绑定后：

- 直接更新 store 的 `hasPasskey` / `hasTotp`
- 必要时重新调用 `initialize()` 或会话状态接口，确保 UI 与服务端一致
- 不要求用户手动刷新页面

### 错误处理原则

账户卡里的错误要优先使用“就地提示”，而不是跳页：

- setup start 失败：提示无法开始绑定
- verify 失败：提示验证码无效或 token 过期
- passkey 浏览器流程失败：提示绑定失败，并保留当前账户卡上下文

错误与成功提示都需要和“设备授权无关”这件事解耦，不出现“请重新绑定设备”之类暗示。

## 文案策略

### 核心原则

所有新增文案都要清楚地区分两类动作：

1. 账号网页登录方式
2. Anchor 设备授权

推荐文案方向：

- 标题：`Sign-in methods` / `登录方式`
- 提示：`用于网页登录，不会自动影响已绑定设备`
- 重绑确认：`重绑后，旧的 TOTP 验证码将失效`

### 不应出现的误导性文案

- “重新绑定设备”
- “同步到设备”
- “更新后将自动授权”
- 把 TOTP 描述成 Anchor 设备认证因子

## 对后端契约的要求

本轮以前端补齐为主，但需明确依赖以下 contract：

- 已登录账号调用 `/auth/totp/setup/options` 时：
  - 返回新的 setupToken / secret / otpauthUrl
  - 若账号已有旧 TOTP，允许继续返回新的 setup payload
- 已登录账号调用 `/auth/totp/setup/verify` 时：
  - 覆盖旧 factor
  - 返回 `verified: true, hasTotp: true`
- 已登录账号走现有 passkey 添加流程时：
  - 成功后能让 `hasPasskey` 切为 true

如果三套 provider 中某一套 contract 与以上语义不一致，本轮只做最小补齐，不引入新的认证模型。

## 测试要求

### 前端 store / UI

至少补充这些测试：

1. 已登录且 `hasPasskey=false, hasTotp=true` 时，设置页账户卡同时显示：
   - `Passkey 未绑定`
   - `TOTP 已绑定`
2. `hasTotp=false` 时，点击 `绑定 TOTP` 会进入 setup UI。
3. `hasTotp=true` 时，点击 `重绑 TOTP` 不会直接进入 setup，而是先显示确认提示。
4. 用户确认后才开始新的 TOTP setup。
5. TOTP verify 成功后显示“不会自动影响已绑定设备”的成功提示。
6. Passkey 绑定成功后状态更新，不要求刷新页面。

### Provider 契约

对现有 provider 测试的要求是“确认接口契约足够支撑前端”，而不是为本轮新增另一套未登录补绑协议：

- `services/orbit`
- `services/orbit-deno`
- `services/control-plane`

若当前测试未覆盖“已登录账号重复 setup TOTP 覆盖旧 factor”，需要补一条 focused 测试证明重绑语义成立。

## 风险与约束

### 风险 1：设置页直接复用注册页状态导致语义混乱

如果直接把 `Register.svelte` 的状态机原封不动挪到设置页，容易出现：

- 文案仍然偏“注册”
- 取消 / 成功跳转逻辑不适合设置页

因此设置页需要一层独立的账户卡流程状态。

### 风险 2：用户继续误以为 TOTP 与设备授权绑定在一起

这不是接口问题，而是文案与信息架构问题。

所以本轮必须把“登录方式状态卡”与“不会自动影响已绑定设备”写进首版交付，而不是留到以后补。

### 风险 3：Passkey 与 TOTP 状态只展示其一

如果只补 TOTP，不同时展示 Passkey 状态，那么“TOTP 注册账号但没绑 passkey”的用户仍然不知道下一步该做什么。

因此账户卡必须同时展示两者状态。

## 交付结果

本轮完成后，用户应能做到：

1. 登录已有账号后进入设置页
2. 在账户区看到 `Passkey` 与 `TOTP` 两种登录方式的绑定状态
3. 对未绑定 TOTP 的账号进行补绑
4. 对已绑定 TOTP 的账号先确认，再执行重绑
5. 在成功后留在设置页，并明确知道该操作不会自动影响已绑定设备
