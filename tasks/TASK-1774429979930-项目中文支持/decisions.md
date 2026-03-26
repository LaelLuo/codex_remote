# Decisions

- 暂无。
- 2026-03-25T09:13:46.476Z [agent] 这是跨 Web UI、CLI、后端可见消息和文档的多阶段项目，应分阶段推进，而不是一次性整仓翻译。
- 2026-03-25T10:45:56.606Z [agent] 第一阶段采用轻量本地 i18n store + Settings 语言切换入口，优先覆盖 Web UI 主流程，不在本阶段扩展到 Thread/Device/CLI/文档。
- 2026-03-25T11:30:37.000Z [agent] 第二阶段继续沿用 descriptor/key 渲染策略：UI 状态消息不固化翻译结果，允许语言切换后已显示提示同步刷新；commit+push 组合提示使用可组合 descriptor 而非拼接纯文本。
- 2026-03-25T11:48:04.000Z [agent] 第三阶段遵循边界：仅本地化 `ProjectPicker`/`WorktreeModal` 的 UI 显示层，不改路径示例、worktree 参数与业务行为。
- 2026-03-25T12:20:37.000Z [agent] socket 连接错误采用 descriptor（key/text）而非纯字符串，三处页面消费在渲染层翻译；浏览器原生 reason 保留 text 直显，fallback 默认文案使用 key。
- 2026-03-25T12:26:26.000Z [agent] RPC fallback 不在 socket 层翻译成文本，而是通过 `SocketRpcError.uiMessage` 保留 key/text 语义到 UI 消费层；仅在无法识别该错误类型时回退到 Error.message 文本。
- 2026-03-25T20:54:33+08:00 [agent] Home 页 submitError 延续 descriptor/key 策略：状态层保存 `UiMessage`（key/text），threads 启动失败优先读取 `getThreadStartErrorMessage`，仅自由文本错误走 text，避免切换语言后旧提示不刷新。
- 2026-03-26T02:00:04+08:00 [agent] `socket.send` fallback 改为携带 `errorMessage` descriptor（同时保留 `error` 兼容旧调用）；Home/Thread 与 `messages.interrupt` 优先消费 descriptor，真实异常 message 仍以 text 透传。
- 2026-03-26T02:25:35+08:00 [agent] socket RPC 请求层的 fallback 统一使用 `SocketRpcError`：send 失败沿用 `SendResult.errorMessage`，timeout/connection closed 使用 key descriptor，确保 catch 消费方（如 Settings）可在渲染层翻译并跟随语言切换。
