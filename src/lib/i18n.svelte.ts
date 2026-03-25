const STORE_KEY = "__codex_remote_i18n_store__";
const STORAGE_KEY = "codex_remote_locale";

export type Locale = "en" | "zh-CN";

const SUPPORTED_LOCALES: Locale[] = ["en", "zh-CN"];

type MessageDict = Record<string, string>;
export type TranslationParams = Record<string, string | number>;

const en: MessageDict = {
  "common.settings": "Settings",
  "common.signIn": "Sign in",
  "common.createAccount": "Create account",
  "common.register": "Register",
  "common.goToApp": "Go to app",
  "common.installApp": "Install app",
  "common.themeTitle": "Theme: {theme}",
  "common.theme.system": "System",
  "common.theme.light": "Light",
  "common.theme.dark": "Dark",
  "common.loading": "Loading...",
  "common.working": "Working...",
  "common.refresh": "Refresh",
  "common.connect": "Connect",
  "common.disconnect": "Disconnect",
  "common.cancel": "Cancel",
  "common.stopReconnect": "Stop reconnect",
  "common.save": "Save",
  "common.reload": "Reload",
  "common.clear": "Clear",
  "common.open": "Open",
  "common.stop": "Stop",
  "common.send": "Send",
  "common.project": "Project",
  "common.model": "Model",
  "common.code": "Code",
  "common.plan": "Plan",
  "common.img": "Img",
  "common.newSession": "New session",
  "common.language": "Language",
  "common.english": "English",
  "common.chineseSimplified": "简体中文",

  "i18n.fallbackOnlyInEnglish": "English fallback only",

  "landing.title": "Codex Remote",
  "landing.heroCaptionScript": "Codex workflows",
  "landing.heroCaptionTail": "from any browser",
  "landing.heroDescription":
    "Codex Remote lets you start and supervise Codex CLI sessions running on your machine from any browser.",
  "landing.configureConnection": "Configure connection",
  "landing.configureAnchorUrl": "Configure Anchor URL",
  "landing.localModeHint": "Local mode active - no sign-in required",
  "landing.createAccount": "Create account",
  "landing.fieldNotes": "Field notes",
  "landing.feature.anchor":
    "A lightweight daemon that spawns and manages Codex CLI sessions. Your code stays local.",
  "landing.feature.orbit": "A Cloudflare relay that links your browser to Anchor over secure outbound tunnels.",
  "landing.feature.handheld": "Approve writes, review diffs, and control long-running tasks from a phone.",

  "auth.layout.visualWatermark": "ACCESS",
  "auth.layout.visualLabel": "Remote control for your local Codex.",
  "auth.layout.visualDesc": "Start and supervise Codex CLI sessions from any device.",

  "auth.gate.checkingSession": "Checking session...",
  "auth.gate.redirecting": "Redirecting...",
  "auth.error.backendUnavailable": "Auth backend unavailable.",
  "auth.error.signInFailed": "Sign-in failed.",
  "auth.error.unableToRequestSignIn": "Unable to request sign-in.",
  "auth.error.signInCancelled": "Sign-in cancelled.",
  "auth.error.registrationFailed": "Registration failed.",
  "auth.error.unableToStartRegistration": "Unable to start registration.",
  "auth.error.registrationCancelled": "Registration cancelled.",
  "auth.error.unableToStartTotpSetup": "Unable to start TOTP setup.",
  "auth.error.totpSetupMissing": "TOTP setup is missing.",

  "auth.login.title": "Sign in - Codex Remote",
  "auth.login.eyebrow": "Sign in",
  "auth.login.heading": "Sign in",
  "auth.login.subtitle.basic": "Sign in with your username.",
  "auth.login.subtitle.totp": "Sign in with your username and one-time code.",
  "auth.login.subtitle.passkey": "Use your passkey to access Codex Remote.",
  "auth.login.method.passkey": "Passkey",
  "auth.login.method.totp": "TOTP",
  "auth.login.usernamePlaceholder": "Username",
  "auth.login.submit.totp": "Sign in with TOTP",
  "auth.login.submit.passkey": "Sign in with passkey",
  "auth.login.createAccount": "Create new account",

  "auth.register.title": "Create account - Codex Remote",
  "auth.register.eyebrow": "Register",
  "auth.register.heading": "Create account",
  "auth.register.subtitle.basic": "Create a username for this control-plane.",
  "auth.register.subtitle.totp": "Scan QR in your authenticator app, then confirm with a code.",
  "auth.register.subtitle.passkey": "Register a new account with a passkey.",
  "auth.register.method.passkey": "Passkey",
  "auth.register.method.totp": "TOTP",
  "auth.register.usernamePlaceholder": "Username",
  "auth.register.qrAlt": "TOTP QR code",
  "auth.register.restartSetup": "Restart setup",
  "auth.register.submit.verifyCode": "Verify code",
  "auth.register.submit.setupTotp": "Setup TOTP",
  "auth.register.submit.createPasskey": "Create passkey",
  "auth.register.backToSignIn": "Back to sign in",

  "home.title": "Codex Remote",
  "home.homepage": "Homepage",
  "home.controlCenter": "(remote) control center",
  "home.summary": "Run parallel coding windows, switch projects, and keep approvals in one place.",
  "home.inputWindows": "Input windows",
  "home.paneHint": "Each window has its own project, mode and model.",
  "home.windowLabel": "Window {id}",
  "home.starting": "Starting...",
  "home.terminalHeader": "Terminal - {id}",
  "home.terminalEmpty": "Waiting for output...",
  "home.terminalAttachTitle": "Attach images",
  "home.terminalPlaceholder": "Type message, attach image, !command, or /u command for this window",
  "home.settingsLink": "Settings",
  "home.submitError.paneNotFound": "Pane not found",
  "home.submitError.inputEmpty": "Input is empty",
  "home.submitError.selectDeviceBeforeSend": "Select a device in Settings before sending messages.",
  "home.submitError.selectedDeviceOffline": "Selected device is offline. Choose another device in Settings.",
  "home.submitError.sendFailed": "Failed to send message",
  "home.submitError.sessionNotStarted": "Session is not started for this window.",
  "home.submitError.imagesNormalOnly": "Images can be sent with normal messages only.",
  "home.submitError.ulwConfigUsage": "Usage: /u config max=30 promise=DONE",
  "home.submitError.addTaskAfterU": "Add task after /u for this window.",
  "home.submitError.bangUsage": "Usage: !<command> or !pwsh|cmd|bash|sh|zsh|fish <command>",
  "home.submitError.stopTurnFailed": "Failed to stop turn",
  "home.submitError.selectModel": "Select model",
  "home.submitError.selectProject": "Select project",
  "home.submitError.useStopInsideTerminal": "Use /u stop inside an active window terminal.",
  "home.submitError.startWindowFirstThenConfig": "Start a window session first, then run /u config.",
  "home.submitError.addTaskAfterULaunchHome": "Add task after /u when launching from Home.",
  "home.submitError.failedToCreateTask": "Failed to create task",

  "composer.placeholder": "Fix a bug, build a feature, refactor code... (or attach/paste image, !<command>, /u <task>)",
  "composer.modelLoading": "Loading models...",
  "composer.modelLoadFailed": "Failed to load models",
  "composer.modelUnavailable": "No models available",

  "recent.title": "Recent Sessions",
  "recent.loading": "Loading sessions...",
  "recent.empty": "No sessions yet. Start a task above.",
  "recent.viewAll": "View all sessions",

  "sessions.title": "Codex Remote - Sessions",
  "sessions.settingsLink": "Settings",
  "sessions.allSessions": "All sessions",
  "sessions.heading": "Sessions",
  "sessions.history": "History",
  "sessions.loading": "Loading sessions...",
  "sessions.empty": "No sessions yet. Start one from Home.",
  "sessions.archiveTitle": "Archive session",

  "appHeader.anchorAuthorize": "Authorize device",
  "appHeader.menu": "Menu",
  "appHeader.sandbox.readOnly": "Read Only",
  "appHeader.sandbox.workspace": "Workspace",
  "appHeader.sandbox.fullAccess": "Full Access",

  "settings.title": "Settings - Codex Remote",
  "settings.kicker": "Control plane",
  "settings.heading": "SETTINGS",
  "settings.summary": "Manage connection, devices, notifications, and account-level actions.",
  "settings.section.connection": "Connection",
  "settings.section.devices": "Devices",
  "settings.section.codexConfig": "Codex Config",
  "settings.section.language": "Language",
  "settings.section.account": "Account",
  "settings.label.anchorUrl": "Anchor URL",
  "settings.label.orbitUrl": "Orbit URL",
  "settings.hint.autoConnectPaused": "Auto-connect paused. Click Connect to resume.",
  "settings.hint.autoConnectActive": "Connection is automatic on app load. Disconnect to pause and to change the URL.",
  "settings.hint.localMode":
    "Local mode: Connect directly to Anchor on your network (e.g., via Tailscale). No Orbit authentication required.",
  "settings.hint.connectToLoadDevices": "Connect to load devices.",
  "settings.hint.noDevices":
    "No devices connected. Run codex-remote start in your terminal - a code will appear, then enter it at /device to authorise.",
  "settings.hint.selectDeviceForSessions": "Select a device. New sessions will start only on the selected device.",
  "settings.hint.deviceConnectedTitle": "Connected",
  "settings.hint.deviceMeta": "{platform} - since {since}",
  "settings.hint.selected": "Selected",
  "settings.hint.connectFirstLoadConfig": "Connect first to load config.toml.",
  "settings.hint.selectDeviceLoadConfig": "Select a device to load config.toml.",
  "settings.hint.unsavedChangesDetected": "Unsaved changes detected. Save or reload to discard.",
  "settings.hint.failedLoadConfig": "Failed to load config.toml",
  "settings.hint.connectFirstSaveConfig": "Connect first to save config.toml.",
  "settings.hint.selectDeviceSaveConfig": "Select a device to save config.toml.",
  "settings.hint.configPathEmpty": "config.toml path is empty.",
  "settings.hint.failedSaveConfig": "Failed to save config.toml",
  "settings.hint.loadedPath": "Loaded {path}",
  "settings.hint.configWillCreateAtPath": "config.toml not found. It will be created at {path} when you save.",
  "settings.hint.savedPath": "Saved {path}",
  "settings.hint.connectFirstReadEditConfig": "Connect first to read and edit config.toml.",
  "settings.hint.selectDeviceEditConfig": "Select a device to edit config.toml on that machine.",
  "settings.hint.detectedOs": "Detected OS: {os}",
  "settings.hint.editingExisting": "Editing existing file.",
  "settings.hint.fileNotExistYet": "File does not exist yet; Save will create it.",
  "settings.label.configPath": "config.toml path",
  "settings.label.configContents": "Contents",
  "settings.hint.unsavedChanges": "Unsaved changes.",
  "settings.button.signOut": "Sign out",
  "settings.language.help": "Choose UI language for page labels and controls.",

  "notifications.sectionTitle": "Notifications",
  "notifications.iosHint":
    "To receive notifications on iOS, add this app to your Home Screen: tap the share button, then Add to Home Screen.",
  "notifications.pushLabel": "Push notifications",
  "notifications.disable": "Disable",
  "notifications.test": "Test",
  "notifications.enable": "Enable",
  "notifications.unavailable":
    "Push notifications are not available{iosInstallHint}.",
  "notifications.iosInstallSuffix": " - install as a Home Screen app first",

  "release.sectionTitle": "Release Cockpit",
  "release.hint.connectFirst": "Connect first to inspect and run releases.",
  "release.hint.selectDevice": "Select a device to run release checks on that machine.",
  "release.label.repoPath": "Repo path",
  "release.label.targetRef": "Target ref",
  "release.label.tagOptional": "Tag (optional)",
  "release.label.dryRun": "Dry run",
  "release.button.inspecting": "Inspecting...",
  "release.button.inspectReadiness": "Inspect readiness",
  "release.button.starting": "Starting...",
  "release.button.startRelease": "Start release",
  "release.button.polling": "Polling...",
  "release.button.pollStatus": "Poll status",
  "release.button.stopAutoPoll": "Stop auto-poll",
  "release.button.autoPoll": "Auto-poll",
  "release.readiness": "Readiness",
  "release.ready": "Ready",
  "release.needsFixes": "Needs fixes",
  "release.branch": "Branch: {branch}",
  "release.statusLabel": "Release {releaseId}",
  "release.assets": "Assets",
  "release.links": "Links",
};

const zhCN: MessageDict = {
  "common.settings": "设置",
  "common.signIn": "登录",
  "common.createAccount": "创建账户",
  "common.register": "注册",
  "common.goToApp": "进入应用",
  "common.installApp": "安装应用",
  "common.themeTitle": "主题：{theme}",
  "common.theme.system": "跟随系统",
  "common.theme.light": "浅色",
  "common.theme.dark": "深色",
  "common.loading": "加载中...",
  "common.working": "处理中...",
  "common.refresh": "刷新",
  "common.connect": "连接",
  "common.disconnect": "断开连接",
  "common.cancel": "取消",
  "common.stopReconnect": "停止重连",
  "common.save": "保存",
  "common.reload": "重新加载",
  "common.clear": "清空",
  "common.open": "打开",
  "common.stop": "停止",
  "common.send": "发送",
  "common.project": "项目",
  "common.model": "模型",
  "common.code": "代码",
  "common.plan": "规划",
  "common.img": "图片",
  "common.newSession": "新会话",
  "common.language": "语言",
  "common.english": "English",
  "common.chineseSimplified": "简体中文",

  "landing.title": "Codex Remote",
  "landing.heroCaptionScript": "Codex 工作流",
  "landing.heroCaptionTail": "随时随地浏览器可达",
  "landing.heroDescription": "Codex Remote 让你从任意浏览器启动并监管本机运行的 Codex CLI 会话。",
  "landing.configureConnection": "配置连接",
  "landing.configureAnchorUrl": "配置 Anchor 地址",
  "landing.localModeHint": "本地模式已启用，无需登录",
  "landing.createAccount": "创建账户",
  "landing.fieldNotes": "功能速览",
  "landing.feature.anchor": "Anchor 是轻量守护进程，用于启动和管理 Codex CLI 会话，代码始终保留在本地。",
  "landing.feature.orbit": "Orbit 是 Cloudflare 中继层，通过安全出站隧道把浏览器与 Anchor 连接起来。",
  "landing.feature.handheld": "你可以在手机上审批写入、查看 diff，并控制长任务。",

  "auth.layout.visualWatermark": "ACCESS",
  "auth.layout.visualLabel": "你的本地 Codex 远程控制台。",
  "auth.layout.visualDesc": "在任意设备上启动并监管 Codex CLI 会话。",

  "auth.gate.checkingSession": "正在检查会话...",
  "auth.gate.redirecting": "正在跳转...",
  "auth.error.backendUnavailable": "认证服务不可用。",
  "auth.error.signInFailed": "登录失败。",
  "auth.error.unableToRequestSignIn": "无法发起登录请求。",
  "auth.error.signInCancelled": "已取消登录。",
  "auth.error.registrationFailed": "注册失败。",
  "auth.error.unableToStartRegistration": "无法开始注册流程。",
  "auth.error.registrationCancelled": "已取消注册。",
  "auth.error.unableToStartTotpSetup": "无法开始 TOTP 设置。",
  "auth.error.totpSetupMissing": "缺少 TOTP 设置信息。",

  "auth.login.title": "登录 - Codex Remote",
  "auth.login.eyebrow": "登录",
  "auth.login.heading": "登录",
  "auth.login.subtitle.basic": "使用用户名登录。",
  "auth.login.subtitle.totp": "使用用户名和一次性验证码登录。",
  "auth.login.subtitle.passkey": "使用通行密钥访问 Codex Remote。",
  "auth.login.method.passkey": "通行密钥",
  "auth.login.method.totp": "TOTP",
  "auth.login.usernamePlaceholder": "用户名",
  "auth.login.submit.totp": "使用 TOTP 登录",
  "auth.login.submit.passkey": "使用通行密钥登录",
  "auth.login.createAccount": "创建新账户",

  "auth.register.title": "创建账户 - Codex Remote",
  "auth.register.eyebrow": "注册",
  "auth.register.heading": "创建账户",
  "auth.register.subtitle.basic": "为该控制平面创建用户名。",
  "auth.register.subtitle.totp": "用验证器应用扫描二维码，然后输入验证码确认。",
  "auth.register.subtitle.passkey": "使用通行密钥注册新账户。",
  "auth.register.method.passkey": "通行密钥",
  "auth.register.method.totp": "TOTP",
  "auth.register.usernamePlaceholder": "用户名",
  "auth.register.qrAlt": "TOTP 二维码",
  "auth.register.restartSetup": "重新开始设置",
  "auth.register.submit.verifyCode": "验证验证码",
  "auth.register.submit.setupTotp": "设置 TOTP",
  "auth.register.submit.createPasskey": "创建通行密钥",
  "auth.register.backToSignIn": "返回登录",

  "home.title": "Codex Remote",
  "home.homepage": "首页",
  "home.controlCenter": "（远程）控制中心",
  "home.summary": "并行运行多个编码窗口、切换项目，并在同一处处理审批。",
  "home.inputWindows": "输入窗口",
  "home.paneHint": "每个窗口都可以独立配置项目、模式和模型。",
  "home.windowLabel": "窗口 {id}",
  "home.starting": "启动中...",
  "home.terminalHeader": "终端 - {id}",
  "home.terminalEmpty": "等待输出中...",
  "home.terminalAttachTitle": "添加图片",
  "home.terminalPlaceholder": "输入消息、附加图片、!命令，或当前窗口的 /u 命令",
  "home.settingsLink": "设置",
  "home.submitError.paneNotFound": "未找到窗口",
  "home.submitError.inputEmpty": "输入为空",
  "home.submitError.selectDeviceBeforeSend": "发送消息前请先在设置里选择设备。",
  "home.submitError.selectedDeviceOffline": "所选设备离线，请在设置中切换其他设备。",
  "home.submitError.sendFailed": "发送消息失败",
  "home.submitError.sessionNotStarted": "当前窗口尚未启动会话。",
  "home.submitError.imagesNormalOnly": "图片只能随普通消息发送。",
  "home.submitError.ulwConfigUsage": "用法：/u config max=30 promise=DONE",
  "home.submitError.addTaskAfterU": "请在 /u 后面补充任务内容。",
  "home.submitError.bangUsage": "用法：!<command> 或 !pwsh|cmd|bash|sh|zsh|fish <command>",
  "home.submitError.stopTurnFailed": "停止当前轮次失败",
  "home.submitError.selectModel": "选择模型",
  "home.submitError.selectProject": "选择项目",
  "home.submitError.useStopInsideTerminal": "请在活动窗口终端中使用 /u stop。",
  "home.submitError.startWindowFirstThenConfig": "请先启动窗口会话，再执行 /u config。",
  "home.submitError.addTaskAfterULaunchHome": "从首页发起时，请在 /u 后面补充任务。",
  "home.submitError.failedToCreateTask": "创建任务失败",

  "composer.placeholder": "修复 bug、开发功能、重构代码...（也可附加/粘贴图片、!<command>、/u <task>）",
  "composer.modelLoading": "模型加载中...",
  "composer.modelLoadFailed": "模型加载失败",
  "composer.modelUnavailable": "暂无可用模型",

  "recent.title": "最近会话",
  "recent.loading": "正在加载会话...",
  "recent.empty": "还没有会话，可先在上方创建任务。",
  "recent.viewAll": "查看全部会话",

  "sessions.title": "Codex Remote - 会话",
  "sessions.settingsLink": "设置",
  "sessions.allSessions": "全部会话",
  "sessions.heading": "会话",
  "sessions.history": "历史",
  "sessions.loading": "正在加载会话...",
  "sessions.empty": "还没有会话，可从首页发起。",
  "sessions.archiveTitle": "归档会话",

  "appHeader.anchorAuthorize": "授权设备",
  "appHeader.menu": "菜单",
  "appHeader.sandbox.readOnly": "只读",
  "appHeader.sandbox.workspace": "工作区",
  "appHeader.sandbox.fullAccess": "完全访问",

  "settings.title": "设置 - Codex Remote",
  "settings.kicker": "控制平面",
  "settings.heading": "设置",
  "settings.summary": "管理连接、设备、通知与账户级操作。",
  "settings.section.connection": "连接",
  "settings.section.devices": "设备",
  "settings.section.codexConfig": "Codex 配置",
  "settings.section.language": "语言",
  "settings.section.account": "账户",
  "settings.label.anchorUrl": "Anchor 地址",
  "settings.label.orbitUrl": "Orbit 地址",
  "settings.hint.autoConnectPaused": "自动连接已暂停，点击“连接”可恢复。",
  "settings.hint.autoConnectActive": "应用加载时会自动连接。断开连接后可暂停并修改地址。",
  "settings.hint.localMode": "本地模式：直接连接你网络内的 Anchor（例如 Tailscale），无需 Orbit 认证。",
  "settings.hint.connectToLoadDevices": "请先连接再加载设备列表。",
  "settings.hint.noDevices": "尚无已连接设备。请在终端运行 codex-remote start，看到验证码后在 /device 页面输入授权。",
  "settings.hint.selectDeviceForSessions": "请先选择设备，新会话只会在所选设备上启动。",
  "settings.hint.deviceConnectedTitle": "已连接",
  "settings.hint.deviceMeta": "{platform} - 连接于 {since}",
  "settings.hint.selected": "已选择",
  "settings.hint.connectFirstLoadConfig": "请先连接再加载 config.toml。",
  "settings.hint.selectDeviceLoadConfig": "请先选择设备再加载 config.toml。",
  "settings.hint.unsavedChangesDetected": "检测到未保存更改，请保存或重新加载后丢弃更改。",
  "settings.hint.failedLoadConfig": "加载 config.toml 失败",
  "settings.hint.connectFirstSaveConfig": "请先连接再保存 config.toml。",
  "settings.hint.selectDeviceSaveConfig": "请先选择设备再保存 config.toml。",
  "settings.hint.configPathEmpty": "config.toml 路径为空。",
  "settings.hint.failedSaveConfig": "保存 config.toml 失败",
  "settings.hint.loadedPath": "已加载 {path}",
  "settings.hint.configWillCreateAtPath": "未找到 config.toml。保存时会在 {path} 创建。",
  "settings.hint.savedPath": "已保存 {path}",
  "settings.hint.connectFirstReadEditConfig": "请先连接，再读取和编辑 config.toml。",
  "settings.hint.selectDeviceEditConfig": "请先选择设备，再编辑该机器上的 config.toml。",
  "settings.hint.detectedOs": "检测到系统：{os}",
  "settings.hint.editingExisting": "正在编辑现有文件。",
  "settings.hint.fileNotExistYet": "文件尚不存在，点击“保存”后会创建。",
  "settings.label.configPath": "config.toml 路径",
  "settings.label.configContents": "内容",
  "settings.hint.unsavedChanges": "存在未保存更改。",
  "settings.button.signOut": "退出登录",
  "settings.language.help": "选择页面标签与控件的界面语言。",

  "notifications.sectionTitle": "通知",
  "notifications.iosHint":
    "若要在 iOS 接收通知，请先把此应用添加到主屏幕：点击分享按钮，然后选择“添加到主屏幕”。",
  "notifications.pushLabel": "推送通知",
  "notifications.disable": "关闭",
  "notifications.test": "测试",
  "notifications.enable": "开启",
  "notifications.unavailable": "当前不支持推送通知{iosInstallHint}。",
  "notifications.iosInstallSuffix": "，请先安装为主屏幕应用",

  "release.sectionTitle": "发布驾驶舱",
  "release.hint.connectFirst": "请先连接再执行发布检查或发布流程。",
  "release.hint.selectDevice": "请先选择设备，再在该机器上执行发布检查。",
  "release.label.repoPath": "仓库路径",
  "release.label.targetRef": "目标分支/引用",
  "release.label.tagOptional": "标签（可选）",
  "release.label.dryRun": "演练模式",
  "release.button.inspecting": "检查中...",
  "release.button.inspectReadiness": "检查就绪状态",
  "release.button.starting": "启动中...",
  "release.button.startRelease": "开始发布",
  "release.button.polling": "轮询中...",
  "release.button.pollStatus": "查询状态",
  "release.button.stopAutoPoll": "停止自动轮询",
  "release.button.autoPoll": "自动轮询",
  "release.readiness": "就绪度",
  "release.ready": "已就绪",
  "release.needsFixes": "需要修复",
  "release.branch": "分支：{branch}",
  "release.statusLabel": "发布 {releaseId}",
  "release.assets": "产物",
  "release.links": "链接",
};

const MESSAGES: Record<Locale, MessageDict> = {
  en,
  "zh-CN": zhCN,
};

function isLocale(value: string | null): value is Locale {
  return value !== null && SUPPORTED_LOCALES.includes(value as Locale);
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, paramName: string) => {
    if (!(paramName in params)) return match;
    return String(params[paramName]);
  });
}

class I18nStore {
  #locale = $state<Locale>("en");

  constructor() {
    if (typeof localStorage !== "undefined") {
      const savedLocale = localStorage.getItem(STORAGE_KEY);
      if (isLocale(savedLocale)) {
        this.#locale = savedLocale;
      }
    }
    applyDocumentLocale(this.#locale);
  }

  get current(): Locale {
    return this.#locale;
  }

  get supportedLocales(): Locale[] {
    return [...SUPPORTED_LOCALES];
  }

  set(locale: Locale) {
    if (locale === this.#locale) return;
    this.#locale = locale;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, locale);
    }
    applyDocumentLocale(locale);
  }

  t(key: string, params?: TranslationParams): string {
    const localeMessages = MESSAGES[this.#locale];
    const template = localeMessages[key] ?? MESSAGES.en[key] ?? key;
    return interpolate(template, params);
  }

  themeName(theme: string): string {
    if (theme === "system") return this.t("common.theme.system");
    if (theme === "light") return this.t("common.theme.light");
    if (theme === "dark") return this.t("common.theme.dark");
    return theme;
  }

  formatDate(value: Date | number | string, options?: Intl.DateTimeFormatOptions): string {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat(this.#locale, options).format(date);
  }
}

function getStore(): I18nStore {
  const global = globalThis as Record<string, unknown>;
  if (!global[STORE_KEY]) {
    global[STORE_KEY] = new I18nStore();
  }
  return global[STORE_KEY] as I18nStore;
}

export const i18n = getStore();
