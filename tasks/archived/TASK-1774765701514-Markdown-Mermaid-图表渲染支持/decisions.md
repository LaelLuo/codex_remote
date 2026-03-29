# Decisions

- 暂无。
- 2026-03-29T06:28:54.978Z [agent] 第一版采用共享 Markdown + Mermaid 渲染层，统一支持 MessageBlock、Reasoning、PlanCard 中的 `mermaid fenced code block；Mermaid 渲染失败时回退为原始代码块。
- 2026-03-29T06:34:26.621Z [agent] 第一版采用共享 Markdown + Mermaid 渲染层方案：继续保留 marked + DOMPurify，在共享渲染模块中识别 mermaid fenced code block，并由统一 enhancer 在 MessageBlock、Reasoning、PlanCard 三个入口做受控图表增强。
- 2026-03-29T07:01:35.665Z [agent] Mermaid runtime 改为在 enhancer 中按需动态导入，避免将整套图表能力静态打进主包；共享 renderer 在无 DOM 测试环境下使用最小 fallback sanitize，但浏览器主链仍优先走 DOMPurify。
