# 默认模型与思考强度配置修复

## 目标

- 修复首页和线程页默认模型/思考强度不按配置或默认模型元数据继承的问题，并补回归测试

## 范围

### In

- src/routes/Home.svelte,src/lib/models.svelte.ts,src/lib/threads.svelte.ts,测试文件

### Out

- 下游 app-server 的 model/list 实现

## 验收标准

- 首页不再硬编码 medium；默认模型/默认思考强度有明确继承逻辑；新增回归测试覆盖关键路径
