# Decisions

- 暂无。
- 2026-03-25T09:13:46.476Z [agent] 这是跨 Web UI、CLI、后端可见消息和文档的多阶段项目，应分阶段推进，而不是一次性整仓翻译。
- 2026-03-25T10:45:56.606Z [agent] 第一阶段采用轻量本地 i18n store + Settings 语言切换入口，优先覆盖 Web UI 主流程，不在本阶段扩展到 Thread/Device/CLI/文档。
- 2026-03-25T11:30:37.000Z [agent] 第二阶段继续沿用 descriptor/key 渲染策略：UI 状态消息不固化翻译结果，允许语言切换后已显示提示同步刷新；commit+push 组合提示使用可组合 descriptor 而非拼接纯文本。
