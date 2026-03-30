# Account TOTP Bind/Rebind Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为已登录账号在设置页补齐 Passkey/TOTP 登录方式状态卡，并支持 TOTP 补绑、确认后重绑，以及不影响设备授权的成功提示。

**Architecture:** 先用一个 focused 后端回归测试锁定“已登录账号重复 setup/verify 会覆盖旧 TOTP factor”的 contract，再在前端 `auth` store 里补一层“账户卡专用状态机”，最后由设置页接线渲染状态卡、确认提示与内联 setup UI。视图文案和状态判断抽到一个小 helper 里做纯逻辑测试，避免在没有组件测试框架的情况下把关键分支只留给手测。

**Tech Stack:** Svelte 5, TypeScript, Bun test, Cloudflare Orbit auth tests

---

## File Structure

**Create:**
- `docs/superpowers/plans/2026-03-30-account-totp-bind-rebind-implementation.md`
- `src/lib/account-auth-card.ts`
- `src/lib/account-auth-card.test.ts`
- `src/lib/auth.test.ts`

**Modify:**
- `src/lib/auth.svelte.ts`
- `src/routes/Settings.svelte`
- `src/lib/i18n.svelte.ts`
- `src/lib/i18n.test.ts`
- `services/orbit/src/auth/totp.integration.test.ts`
- `tasks/TASK-1774851329751-已有账号补绑与重绑-TOTP/log.md`
- `tasks/TASK-1774851329751-已有账号补绑与重绑-TOTP/next-actions.md`
- `tasks/TASK-1774851329751-已有账号补绑与重绑-TOTP/task.yaml`

**Responsibilities:**
- `services/orbit/src/auth/totp.integration.test.ts`
  固定“已登录账号重复 setup/verify 会覆盖旧 factor”的 contract，避免前端按重绑设计落地后才发现服务端语义不一致。
- `src/lib/auth.svelte.ts`
  增加“账户卡专用”状态与动作，包括：Passkey 补绑、TOTP 首绑、TOTP 重绑确认、TOTP setup 完成后的成功提示与状态刷新。
- `src/lib/account-auth-card.ts`
  把设置页账户卡的纯逻辑抽成可测试 helper：根据 `hasPasskey` / `hasTotp` / flow / notice 生成显示状态、按钮文案与提示文案。
- `src/routes/Settings.svelte`
  渲染 `Sign-in methods` 状态卡，接线确认提示、内联 QR/secret/code UI、成功/错误提示与退出登录按钮。
- `src/lib/i18n.svelte.ts`
  增加账户卡新增文案，明确“网页登录方式”和“设备授权”是两条链路。
- `src/lib/i18n.test.ts`
  锁定关键新增文案在中英文中都存在，避免漏 key。
- `src/lib/auth.test.ts`
  锁定 store 级别行为，避免只靠 UI 手测覆盖 TOTP/Passkey 状态切换与重绑确认分支。

## Chunk 1: Lock the Rebind Contract

### Task 1: 先用后端回归测试锁定“已登录账号重绑 TOTP”语义

**Files:**
- Modify: `services/orbit/src/auth/totp.integration.test.ts`

- [ ] **Step 1: 写失败测试**

在 `services/orbit/src/auth/totp.integration.test.ts` 新增一个已登录账号重绑场景：
- 先创建一个带 TOTP 的账号并完成首次绑定
- 登录拿到 web session
- 调 `/auth/totp/setup/options` 获取新的 `setupToken` 与 `secret`
- 用新的验证码调用 `/auth/totp/setup/verify`
- 断言：
  - 新验证码可用于 `/auth/login/totp`
  - 旧 secret 生成的验证码不能再登录

测试示意：

```ts
test("logged-in user can rebind totp and invalidate the old factor", async () => {
  const env = createTestEnv();
  const first = await registerTotpUser(env, "lael");
  const sessionHeaders = await loginTotp(env, "lael", first.currentCode);

  const nextSetup = await callAuth(env, "/auth/totp/setup/options", {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({}),
  });

  const nextCode = generateTotpCode(/* next secret */);
  await callAuth(env, "/auth/totp/setup/verify", {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({ setupToken, code: nextCode }),
  });

  await expect(loginTotp(env, "lael", oldCode)).rejects.toThrow();
  await expect(loginTotp(env, "lael", nextCode)).resolves.toBeTruthy();
});
```

- [ ] **Step 2: 运行 focused test，确认当前是否失败**

Run: `bun --cwd services/orbit test src/auth/totp.integration.test.ts`
Expected:
- 如果 contract 已经成立，新增用例直接通过；记录“无需后端实现改动”
- 如果失败，错误会指出旧 factor 未失效或 setup/verify 无法覆盖已有 factor

- [ ] **Step 3: 仅在测试失败时做最小后端修正**

如果失败，只允许做最小修正：
- 优先检查 `handleTotpSetupVerify()` 与 `upsertTotpFactor()` 的覆盖语义
- 不新增新的 `/auth/totp/rebind` 路由
- 不改 session / device 协议

- [ ] **Step 4: 重新运行 focused test，确认 contract 稳定**

Run: `bun --cwd services/orbit test src/auth/totp.integration.test.ts`
Expected: PASS，并证明前端可以安全按“确认后重绑”建模

- [ ] **Step 5: 提交这一小步**

```bash
git add -- services/orbit/src/auth/totp.integration.test.ts
git commit -m ":white_check_mark: test(auth): 锁定已登录账号 TOTP 重绑契约"
```

## Chunk 2: Add Account-Scoped Auth Actions

### Task 2: 给 auth store 增加账户卡专用状态机与动作

**Files:**
- Create: `src/lib/auth.test.ts`
- Modify: `src/lib/auth.svelte.ts`

- [ ] **Step 1: 写 auth store 的 failing tests**

在 `src/lib/auth.test.ts` 补一组只测 store 行为的用例。建议先把 `AuthStore` class 从 `auth.svelte.ts` 导出，测试中直接 new 一个 store，并 mock：
- `fetch`
- `@simplewebauthn/browser`
- `localStorage`

至少覆盖：
- 已登录用户触发 `beginAccountTotpSetup()` 时，会带认证头调用 `/auth/totp/setup/options`
- `requestAccountTotpRebind()` 不发请求，只把 flow 切到 `confirm_rebind`
- `confirmAccountTotpRebind()` 后才真正发起新的 setup 请求
- `completeAccountTotpSetup()` 成功后：
  - `hasTotp = true`
  - 清空 setup / confirm 状态
  - 写入“不会自动影响已绑定设备”的 notice
- `addPasskeyForCurrentUser()` 成功后：
  - 复用现有 passkey add flow
  - `hasPasskey = true`

测试示意：

```ts
test("requestAccountTotpRebind only enters confirm state before network calls", () => {
  const store = createSignedInStore({ hasTotp: true });
  store.requestAccountTotpRebind();
  expect(store.accountTotpFlow).toBe("confirm_rebind");
  expect(fetch).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行 tests，确认当前失败**

Run: `bun test src/lib/auth.test.ts`
Expected: FAIL，提示缺少 `AuthStore` 导出或缺少账户卡专用方法 / 状态

- [ ] **Step 3: 在 auth store 做最小实现**

在 `src/lib/auth.svelte.ts` 增加：
- 可测试导出的 `AuthStore`
- 账户卡专用状态：
  - `accountTotpFlow: "idle" | "confirm_rebind" | "setting_up"`
  - `accountNotice`
- 账户卡动作：
  - `beginAccountTotpSetup()`
  - `requestAccountTotpRebind()`
  - `confirmAccountTotpRebind()`
  - `completeAccountTotpSetup(code)`
  - `cancelAccountTotpSetup()`
  - `addPasskeyForCurrentUser()`

实现约束：
- 不复用“注册页成功后可能跳转”的语义
- 账户卡动作必须要求当前 `status === "signed_in"` 且有用户
- passkey 补绑直接复用 `/auth/register/options` + `/auth/register/verify` 的“已登录用户添加 passkey”分支
- TOTP setup 用 `/auth/totp/setup/options` + `/auth/totp/setup/verify`
- notice 和错误要在相关动作开始时清理，避免旧提示残留

可接受的实现骨架：

```ts
async beginAccountTotpSetup(): Promise<boolean> {
  if (!this.user) return false;
  this.accountNotice = null;
  this.accountTotpFlow = "setting_up";
  // fetch /auth/totp/setup/options with auth headers
}
```

- [ ] **Step 4: 运行 store tests，确认通过**

Run: `bun test src/lib/auth.test.ts`
Expected: PASS，覆盖首绑 / 重绑确认 / passkey 补绑这三条关键分支

- [ ] **Step 5: 运行最小类型检查**

Run: `bun run typecheck`
Expected: exit 0

- [ ] **Step 6: 提交这一小步**

```bash
git add -- src/lib/auth.svelte.ts src/lib/auth.test.ts
git commit -m ":sparkles: feat(auth): 补账户卡登录方式动作状态机"
```

## Chunk 3: Render the Account Card in Settings

### Task 3: 把账户区改成“Passkey/TOTP 状态卡 + 重绑确认 + 内联 setup UI”

**Files:**
- Create: `src/lib/account-auth-card.ts`
- Create: `src/lib/account-auth-card.test.ts`
- Modify: `src/routes/Settings.svelte`
- Modify: `src/lib/i18n.svelte.ts`
- Modify: `src/lib/i18n.test.ts`

- [ ] **Step 1: 写纯逻辑 helper 的 failing tests**

在 `src/lib/account-auth-card.test.ts` 写纯逻辑用例，输入 auth store 的关键状态，输出卡片行和按钮文案：
- `hasPasskey=false, hasTotp=true` 时：
  - Passkey 行显示 `未绑定` + `绑定 Passkey`
  - TOTP 行显示 `已绑定` + `重绑 TOTP`
- `accountTotpFlow === "confirm_rebind"` 时，应返回重绑确认提示
- `accountNotice` 存在时，应返回成功提示

测试示意：

```ts
test("shows missing passkey next to configured totp", () => {
  const card = buildAccountAuthCardModel({
    hasPasskey: false,
    hasTotp: true,
    accountTotpFlow: "idle",
    accountNotice: null,
  });
  expect(card.passkey.statusKey).toBe("settings.account.passkey.unbound");
  expect(card.totp.actionKey).toBe("settings.account.totp.rebind");
});
```

- [ ] **Step 2: 运行 helper tests，确认失败**

Run: `bun test src/lib/account-auth-card.test.ts`
Expected: FAIL，提示缺少 helper 模块

- [ ] **Step 3: 实现 helper，并补文案 keys**

在 `src/lib/account-auth-card.ts` 实现纯逻辑 helper，负责：
- 构建 Passkey / TOTP 两行状态
- 给出当前应显示的说明文案 key
- 给出 confirm / success notice key

在 `src/lib/i18n.svelte.ts` 增加中英文 key，至少包括：
- `settings.account.title.signInMethods`
- `settings.account.passkey.bound`
- `settings.account.passkey.unbound`
- `settings.account.passkey.bind`
- `settings.account.totp.bound`
- `settings.account.totp.unbound`
- `settings.account.totp.bind`
- `settings.account.totp.rebind`
- `settings.account.notice.deviceUnaffected`
- `settings.account.notice.totpBound`
- `settings.account.notice.totpRebound`
- `settings.account.confirm.totpRebind`
- `settings.account.confirm.totpRebindDetail`

- [ ] **Step 4: 给 i18n 加最小回归断言**

在 `src/lib/i18n.test.ts` 增加断言，确认新增中英文 key 都能解析，不回退为 key 本身。

Run: `bun test src/lib/i18n.test.ts`
Expected: PASS，包含新增断言

- [ ] **Step 5: 在 Settings.svelte 接线状态卡**

在 `src/routes/Settings.svelte` 的 `07 Account` 区：
- 用 helper 渲染 `Sign-in methods` 卡
- 保留 `Sign out` 作为卡片下方独立危险动作
- 当 `accountTotpFlow === "confirm_rebind"` 时显示确认块：
  - 文案说明旧 TOTP 将失效
  - 明确“不影响已绑定设备”
  - `继续重绑` / `取消`
- 当 `accountTotpFlow === "setting_up"` 且存在 `totpSetup` 时，内联显示：
  - QR code
  - secret
  - code input
  - `确认绑定/更新`
  - `取消`
- 点击 `绑定 Passkey` 时直接调用 `auth.addPasskeyForCurrentUser()`

实现约束：
- 不引入新路由
- 不从设置页跳到 `/device`
- 不隐藏另一种登录方式状态
- 不在 local mode 下渲染此卡（沿用现有账户区条件）

- [ ] **Step 6: 运行前端 focused tests**

Run: `bun test src/lib/auth.test.ts src/lib/account-auth-card.test.ts src/lib/i18n.test.ts`
Expected: PASS

- [ ] **Step 7: 运行构建验证设置页接线**

Run: `bun run --env-file .env.example build`
Expected: exit 0，确保新增设置页状态卡不会破坏 Svelte 编译

- [ ] **Step 8: 运行最小质量检查**

Run: `bun run lint`
Expected: exit 0

- [ ] **Step 9: 同步任务记录**

用 `task-cli` 更新：
- `log.md`：记录计划执行完成摘要
- `next-actions.md`：关闭已完成 action，必要时新增 review/verification action
- `task.yaml`：根据真实进度推进到 `review`

- [ ] **Step 10: 提交这一小步**

```bash
git add -- src/lib/account-auth-card.ts src/lib/account-auth-card.test.ts src/routes/Settings.svelte src/lib/i18n.svelte.ts src/lib/i18n.test.ts tasks/TASK-1774851329751-已有账号补绑与重绑-TOTP/log.md tasks/TASK-1774851329751-已有账号补绑与重绑-TOTP/next-actions.md tasks/TASK-1774851329751-已有账号补绑与重绑-TOTP/task.yaml
git commit -m ":sparkles: feat(settings): 增加账号 TOTP 补绑与重绑入口"
```

## Final Verification

- [ ] **Step 1: 运行前端 focused tests**

Run: `bun test src/lib/auth.test.ts src/lib/account-auth-card.test.ts src/lib/i18n.test.ts`
Expected: PASS

- [ ] **Step 2: 运行 Orbit TOTP focused regression**

Run: `bun --cwd services/orbit test src/auth/totp.integration.test.ts`
Expected: PASS，证明重绑 contract 仍成立

- [ ] **Step 3: 运行类型检查**

Run: `bun run typecheck`
Expected: exit 0

- [ ] **Step 4: 运行 lint**

Run: `bun run lint`
Expected: exit 0

- [ ] **Step 5: 运行构建**

Run: `bun run --env-file .env.example build`
Expected: exit 0

- [ ] **Step 6: 请求代码 review**

在实现完成后，发起一次 focused review，优先检查：
- TOTP 重绑是否真的先确认、后 setup
- Passkey 未绑定状态是否对 TOTP 注册用户可见
- 成功/错误提示是否始终把“网页登录方式”和“设备授权”分开
