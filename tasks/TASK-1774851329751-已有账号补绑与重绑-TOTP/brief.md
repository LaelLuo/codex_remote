# 已有账号补绑与重绑 TOTP

## 目标

- 补齐 Codex Remote 已登录账号补绑/重绑 TOTP 的前端入口与完整链路，避免用户只能通过注册页创建新 TOTP 账号而无法为旧账号增加备用登录方式。

## 范围

### In

- 复用现有 /auth/totp/setup/options 与 /auth/totp/setup/verify 后端接口，为已登录账号提供补绑/重绑 TOTP 的前端能力。
- 梳理 passkey/TOTP 登录与 /device 设备授权之间的关系，避免用户误以为新建 TOTP 会自动关联已绑定设备。
- 补充必要的交互、状态提示与验证，确保手机端 passkey 不可用时仍可通过已有账号的 TOTP 登录并继续设备授权。

### Out

- 不重构 passkey/WebAuthn 底层实现。
- 不改动 Anchor device-code 协议本身。

## 验收标准

- 已登录用户可以在前端发起 TOTP 补绑或重绑，而不是只能在注册页创建新 TOTP 账号。
- 补绑后的旧账号可在登录页通过用户名 + TOTP 正常登录，并继续完成 /device 设备授权。
- 界面文案明确区分网页登录方式与设备授权，减少对已绑定设备关系的误解。
