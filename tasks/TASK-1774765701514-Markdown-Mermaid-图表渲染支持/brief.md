# Markdown Mermaid 图表渲染支持

## 目标

- 让应用内 Markdown 渲染入口统一支持 Mermaid 流程图/时序图/甘特图/状态图等图表

## 范围

### In

- MessageBlock、Reasoning、PlanCard 等 Markdown 渲染链路统一接入 Mermaid

### Out

- 通用数据图表语法与服务端渲染

## 验收标准

- 助手消息、推理块、计划卡片中的 `mermaid 代码块可渲染为 Mermaid 图表; 渲染失败时优雅回退到代码块文本; 现有 Markdown 与安全策略不退化
